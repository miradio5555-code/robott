-- =====================================================
-- ULA FACTORY — миграция 03: телефон байера (обязателен при регистрации)
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_02_workspaces.sql. Можно запускать повторно.
-- ВАЖНО: если когда-нибудь повторно запускаете 02 — после него снова запустите 03.
-- =====================================================


-- 1. Телефон в профиле: только цифры и + в начале, 9–15 цифр
alter table public.profiles add column if not exists phone text;

alter table public.profiles drop constraint if exists profiles_phone_fmt;
alter table public.profiles add constraint profiles_phone_fmt
  check (phone is null or phone ~ '^\+?[0-9]{9,15}$');

-- байер может сам поправить своё имя и телефон (но не роль)
grant update (full_name, phone) on public.profiles to authenticated;


-- 2. Приведение телефона к одному виду: убрать пробелы, скобки, дефисы; 00996… → +996…
create or replace function public._clean_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when x like '00%' then '+' || substr(x, 3)
    else x
  end
  from (select regexp_replace(coalesce(p, ''), '[[:space:]().-]', '', 'g') as x) s;
$$;


-- 3. Принять приглашение — теперь с телефоном.
--    Без правильного телефона кабинет НЕ создаётся.
drop function if exists public._claim_invite(uuid, text, text, text);

create or replace function public._claim_invite(
  p_user uuid, p_code text, p_full_name text, p_ws_name text, p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_ws        uuid;
  v_name      text := nullif(left(btrim(coalesce(p_full_name, '')), 120), '');
  v_ws_name   text := nullif(left(btrim(coalesce(p_ws_name, '')), 120), '');
  v_phone     text := public._clean_phone(p_phone);
begin
  if p_user is null or p_code is null or p_code !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    return null;
  end if;
  if exists (select 1 from public.profiles where user_id = p_user) then
    return null;
  end if;

  select id into v_invite_id
    from public.invites
   where code = p_code and used_at is null and expires_at > now()
   for update;
  if v_invite_id is null then
    return null;
  end if;

  insert into public.profiles (user_id, role, full_name, phone)
  values (p_user, 'buyer', v_name, v_phone);

  insert into public.workspaces (name, owner_id)
  values (coalesce(v_ws_name, v_name, 'Мой кабинет'), p_user)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, p_user, 'owner');

  update public.invites set used_by = p_user, used_at = now() where id = v_invite_id;
  return v_ws;
end;
$$;
revoke all on function public._claim_invite(uuid, text, text, text, text) from public, anon, authenticated;

-- При регистрации: телефон берётся из данных формы
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'invite_code' then
    begin
      perform public._claim_invite(
        new.id,
        new.raw_user_meta_data ->> 'invite_code',
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'workspace_name',
        new.raw_user_meta_data ->> 'phone');
    exception when others then
      raise warning 'invite claim failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

-- Запасной путь для уже вошедшего пользователя — тоже с телефоном
drop function if exists public.claim_invite(text, text, text);

create or replace function public.claim_invite(p_code text, p_full_name text, p_ws_name text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  if public._clean_phone(p_phone) !~ '^\+?[0-9]{9,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  v_ws := public._claim_invite(auth.uid(), p_code, p_full_name, p_ws_name, p_phone);
  if v_ws is null then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;
  return v_ws;
end;
$$;
revoke all on function public.claim_invite(text, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_invite(text, text, text, text) to authenticated;


-- 4. Список кабинетов для админа — теперь с телефоном владельца
drop function if exists public.admin_list_workspaces();

create or replace function public.admin_list_workspaces()
returns table (
  id uuid, name text, owner_id uuid, owner_email text, owner_name text, owner_phone text,
  owner_active boolean, owner_role text, orders_count bigint, clients_count bigint, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select w.id, w.name, w.owner_id, u.email::text, p.full_name, p.phone,
           coalesce(p.is_active, false), p.role,
           (select count(*) from public.orders  o where o.workspace_id = w.id),
           (select count(*) from public.clients c where c.workspace_id = w.id),
           w.created_at
      from public.workspaces w
      left join auth.users u     on u.id = w.owner_id
      left join public.profiles p on p.user_id = w.owner_id
     order by w.created_at;
end;
$$;
revoke all on function public.admin_list_workspaces() from public, anon, authenticated;
grant execute on function public.admin_list_workspaces() to authenticated;

-- ГОТОВО ✅
