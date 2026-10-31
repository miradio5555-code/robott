-- =====================================================
-- ULA FACTORY — миграция 48: режим правки — администратор меняет данные в кабинете байера
--
-- Раньше администратор чужие кабинеты только смотрел. Теперь он может включить «Режим правки»
-- для одного кабинета на 2 часа: на это время он работает в нём как владелец — заказы, клиенты,
-- партии, поставщики, магазин, расходы, курсы, настройки, команда. Все существующие правила и функции
-- просто начинают пускать его в этот кабинет, ничего отдельного писать не нужно.
-- Каждое изменение записывается в журнал: кто, когда, в какой таблице, что за строка, какие поля.
--
--   • admin_edit — включённый режим правки: администратор → кабинет, до какого времени;
--   • admin_audit — журнал: включил/выключил правку, добавил/изменил/удалил;
--   • is_member / is_owner — «да» и для администратора в режиме правки этого кабинета;
--   • admin_edit_start(кабинет) / admin_edit_stop() — включить и выключить.
-- С 2FA режим правки работает только после ввода кода (как и все права администратора).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_47_devices.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 48) then
      raise exception 'СТОП: файл 48 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Включённый режим правки (у администратора — не больше одного кабинета сразу)
create table if not exists public.admin_edit (
  admin_id     uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  until        timestamptz not null
);
alter table public.admin_edit enable row level security;
drop policy if exists "admin edit: read own" on public.admin_edit;
create policy "admin edit: read own" on public.admin_edit for select to authenticated
  using (admin_id = (select auth.uid()));
revoke insert, update, delete on public.admin_edit from anon, authenticated;
grant select on public.admin_edit to authenticated;


-- 2. Журнал
create table if not exists public.admin_audit (
  id           bigint generated always as identity primary key,
  admin_id     uuid not null,
  workspace_id uuid,
  tbl          text not null,
  op           text not null,      -- INSERT | UPDATE | DELETE | edit_on | edit_off
  row_id       text,
  cols         text[],             -- для UPDATE: какие поля изменились
  at           timestamptz not null default now()
);
create index if not exists admin_audit_ws_idx on public.admin_audit (workspace_id, at desc);
alter table public.admin_audit enable row level security;
drop policy if exists "admin audit: read" on public.admin_audit;
create policy "admin audit: read" on public.admin_audit for select to authenticated
  using ((select public.is_admin()));
revoke insert, update, delete on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;


-- 3. Администратор в режиме правки этого кабинета
create or replace function public.admin_editing(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_edit e
                  where e.admin_id = auth.uid() and e.workspace_id = p_ws and e.until > now())
     and public.is_admin();
$$;
revoke all on function public.admin_editing(uuid) from public, anon, authenticated;

create or replace function public.is_member(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws
       and m.user_id = auth.uid()
       and p.is_active
  ) or public.admin_editing(p_ws);
$$;

create or replace function public.is_owner(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws
       and m.user_id = auth.uid()
       and m.role = 'owner'
       and p.is_active
  ) or public.admin_editing(p_ws);
$$;
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;


-- 4. Включить / выключить
create or replace function public.admin_edit_start(p_ws uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_until timestamptz := now() + interval '2 hours';
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.workspaces where id = p_ws) then raise exception 'workspace_not_found'; end if;
  insert into public.admin_edit (admin_id, workspace_id, until) values (auth.uid(), p_ws, v_until)
  on conflict (admin_id) do update set workspace_id = excluded.workspace_id, until = excluded.until;
  insert into public.admin_audit (admin_id, workspace_id, tbl, op) values (auth.uid(), p_ws, 'workspaces', 'edit_on');
  return v_until;
end;
$$;
revoke all on function public.admin_edit_start(uuid) from public, anon;
grant execute on function public.admin_edit_start(uuid) to authenticated;

create or replace function public.admin_edit_stop()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  delete from public.admin_edit where admin_id = auth.uid() returning workspace_id into v_ws;
  if v_ws is not null then
    insert into public.admin_audit (admin_id, workspace_id, tbl, op) values (auth.uid(), v_ws, 'workspaces', 'edit_off');
  end if;
end;
$$;
revoke all on function public.admin_edit_stop() from public, anon;
grant execute on function public.admin_edit_stop() to authenticated;


-- 5. Журнал изменений: пишем только то, что сделал администратор в режиме правки
create or replace function public._admin_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_rws text;
  v_cols text[];
begin
  if auth.uid() is null then return null; end if;
  select e.workspace_id into v_ws from public.admin_edit e where e.admin_id = auth.uid() and e.until > now();
  if v_ws is null then return null; end if;
  -- строка другого кабинета (например, свой кабинет администратора) — не пишем
  v_rws := case when tg_table_name = 'workspaces' then v_row->>'id' else v_row->>'workspace_id' end;
  if v_rws is not null and v_rws <> v_ws::text then return null; end if;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_cols
      from jsonb_object_keys(to_jsonb(new)) k
     where to_jsonb(new)->k is distinct from to_jsonb(old)->k and k not in ('updated_at');
    if v_cols is null then return null; end if;
  end if;
  insert into public.admin_audit (admin_id, workspace_id, tbl, op, row_id, cols)
  values (auth.uid(), v_ws, tg_table_name, tg_op, v_row->>'id', v_cols);
  return null;
end;
$$;
revoke all on function public._admin_audit() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['orders', 'clients', 'order_photos', 'shipments', 'suppliers', 'shop_products', 'expenses',
                           'workspaces', 'exchange_requests', 'workspace_members', 'team_invites', 'client_cabinets']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists admin_audit on public.%I', t);
      execute format('create trigger admin_audit after insert or update or delete on public.%I for each row execute function public._admin_audit()', t);
    end if;
  end loop;
end $$;


-- ✅ ОТМЕТКА: файл 48 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (48, 'migration_48_admin_edit.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
