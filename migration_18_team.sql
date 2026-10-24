-- =====================================================
-- ULA FACTORY — миграция 18: помощник в кабинете (команда)
--
-- Владелец кабинета зовёт помощника (менеджера) по ссылке. Помощник входит под СВОИМ паролем
-- и работает в том же кабинете, но с ограниченными правами — владелец больше не отдаёт свой пароль.
--
--   • team_invites           — приглашения помощников (код живёт 3 дня, одноразовый);
--   • team_invite_create(ws) — владелец создаёт приглашение;
--   • team_join(code)        — помощник принимает приглашение;
--   • team_list(ws)          — владелец видит команду и ожидающие приглашения;
--   • team_remove(ws, user)  — владелец убирает помощника.
--
-- Что МОЖЕТ помощник:  заказы, клиенты, партии, поставщики, фото, сообщения клиентам, поддержка.
-- Что НЕ МОЖЕТ (проверяет база): удалять заказы, клиентов, партии, поставщиков;
--   менять настройки кабинета, «Мои курсы», ссылку для заявок; звать и убирать помощников.
-- Отчёт о прибыли и себестоимость помощнику на сайте не показываются
--   (это скрытие на сайте, не защита базы: цены закупки он видит в данных заказа).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_17_requests.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 18) then
      raise exception 'СТОП: файл 18 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Приглашения помощников (напрямую с сайта таблица закрыта — только через функции)
create table if not exists public.team_invites (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '3 days',
  used_by      uuid references auth.users(id) on delete set null,
  used_at      timestamptz
);
create index if not exists team_invites_ws_idx on public.team_invites(workspace_id);
alter table public.team_invites enable row level security;
revoke all on public.team_invites from anon, authenticated;


-- 2. Удалять — только владелец (помощник удалять не может)
drop policy if exists "orders: delete" on public.orders;
create policy "orders: delete" on public.orders for delete to authenticated
  using (public.is_owner(workspace_id));

drop policy if exists "clients: delete" on public.clients;
create policy "clients: delete" on public.clients for delete to authenticated
  using (public.is_owner(workspace_id));

do $$
declare p record;
begin
  -- поставщики и партии: пересоздаём политику удаления (имя берём из базы)
  for p in select schemaname, tablename, policyname from pg_policies
            where schemaname = 'public' and tablename in ('suppliers', 'shipments') and cmd = 'DELETE'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "suppliers: delete own workspace" on public.suppliers for delete to authenticated
  using (public.is_owner(workspace_id));
create policy "shipments: delete own workspace" on public.shipments for delete to authenticated
  using (public.is_owner(workspace_id));


-- 3. Ссылка для заявок — только владелец
create or replace function public.request_link_rotate(p_ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.workspaces set request_token = v_token where id = p_ws;
  return v_token;
end;
$$;

create or replace function public.request_link_revoke(p_ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  update public.workspaces set request_token = null where id = p_ws;
end;
$$;

revoke all on function public.request_link_rotate(uuid) from public, anon;
revoke all on function public.request_link_revoke(uuid) from public, anon;
grant execute on function public.request_link_rotate(uuid) to authenticated;
grant execute on function public.request_link_revoke(uuid) to authenticated;


-- 4. Владелец создаёт приглашение (не больше 5 помощников и 5 ожидающих приглашений)
create or replace function public.team_invite_create(p_ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  if (select count(*) from public.workspace_members where workspace_id = p_ws and role = 'staff') >= 5 then
    raise exception 'team_full' using errcode = 'P0001';
  end if;
  if (select count(*) from public.team_invites
       where workspace_id = p_ws and used_at is null and expires_at > now()) >= 5 then
    raise exception 'too_many_invites' using errcode = 'P0001';
  end if;
  insert into public.team_invites (workspace_id, created_by) values (p_ws, auth.uid())
  returning code into v_code;
  return v_code;
end;
$$;


-- 5. Помощник принимает приглашение. Возвращает id кабинета.
--    Свой пустой кабинет (создался при регистрации) удаляется, чтобы у помощника был один кабинет.
create or replace function public.team_join(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.team_invites;
  v_me  uuid := auth.uid();
  r     record;
begin
  if v_me is null then raise exception 'forbidden'; end if;
  if p_code is null or p_code !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_me and is_active) then
    raise exception 'forbidden';
  end if;
  if public.is_admin() then raise exception 'admin_cannot_join' using errcode = 'P0001'; end if;

  select * into v_inv from public.team_invites
   where code = p_code and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_invite' using errcode = 'P0001'; end if;

  if exists (select 1 from public.workspace_members where workspace_id = v_inv.workspace_id and user_id = v_me) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if (select count(*) from public.workspace_members where workspace_id = v_inv.workspace_id and role = 'staff') >= 5 then
    raise exception 'team_full' using errcode = 'P0001';
  end if;

  -- свои кабинеты: можно оставить только пустые (их удаляем); с заказами или клиентами — нельзя
  for r in
    select m.workspace_id from public.workspace_members m where m.user_id = v_me
  loop
    if exists (select 1 from public.orders  where workspace_id = r.workspace_id)
       or exists (select 1 from public.clients where workspace_id = r.workspace_id) then
      raise exception 'has_own_data' using errcode = 'P0001';
    end if;
  end loop;
  for r in
    select m.workspace_id from public.workspace_members m
     where m.user_id = v_me and m.role = 'owner'
  loop
    delete from public.workspaces where id = r.workspace_id;
  end loop;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_inv.workspace_id, v_me, 'staff');

  update public.team_invites set used_by = v_me, used_at = now() where id = v_inv.id;
  return v_inv.workspace_id;
end;
$$;


-- 6. Команда: кто работает + ожидающие приглашения (только владелец)
create or replace function public.team_list(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', m.user_id, 'role', m.role,
               'full_name', p.full_name, 'phone', p.phone, 'joined_at', m.created_at)
             order by m.role desc, m.created_at)
        from public.workspace_members m
        left join public.profiles p on p.user_id = m.user_id
       where m.workspace_id = p_ws), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('code', i.code, 'expires_at', i.expires_at) order by i.created_at desc)
        from public.team_invites i
       where i.workspace_id = p_ws and i.used_at is null and i.expires_at > now()), '[]'::jsonb));
end;
$$;


-- 7. Отменить приглашение (только владелец)
create or replace function public.team_invite_revoke(p_ws uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  delete from public.team_invites where workspace_id = p_ws and code = p_code and used_at is null;
end;
$$;


-- 8. Убрать помощника (только владелец). Человеку создаётся пустой кабинет, чтобы он мог войти.
create or replace function public.team_remove(p_ws uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  delete from public.workspace_members
   where workspace_id = p_ws and user_id = p_user and role = 'staff';
  if not found then raise exception 'not_staff' using errcode = 'P0001'; end if;

  if not exists (select 1 from public.workspace_members where user_id = p_user) then
    insert into public.workspaces (name, owner_id)
    values (coalesce((select nullif(btrim(full_name), '') from public.profiles where user_id = p_user), 'Мой кабинет'), p_user)
    returning id into v_ws;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, p_user, 'owner');
  end if;
end;
$$;

revoke all on function public.team_invite_create(uuid)       from public, anon;
revoke all on function public.team_join(text)                from public, anon;
revoke all on function public.team_list(uuid)                from public, anon;
revoke all on function public.team_invite_revoke(uuid, text) from public, anon;
revoke all on function public.team_remove(uuid, uuid)        from public, anon;
grant execute on function public.team_invite_create(uuid)       to authenticated;
grant execute on function public.team_join(text)                to authenticated;
grant execute on function public.team_list(uuid)                to authenticated;
grant execute on function public.team_invite_revoke(uuid, text) to authenticated;
grant execute on function public.team_remove(uuid, uuid)        to authenticated;

-- ✅ ОТМЕТКА: файл 18 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (18, 'migration_18_team.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
