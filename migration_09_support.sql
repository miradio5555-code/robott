-- =====================================================
-- ULA FACTORY — миграция 09: техподдержка для байеров
--
-- Как работает:
--   • у каждого байера — своя переписка с поддержкой (как чат);
--   • байер пишет → админ видит сообщение во вкладке «Поддержка»;
--   • админ отвечает → байер видит ответ в окне 💬;
--   • к сообщению байера сайт сам прикладывает тех. данные
--     (браузер, страница, последние ошибки) — поле meta.
--   • писать можно только через функции ниже (support_send, admin_support_reply),
--     напрямую в таблицу — нельзя. Другие байеры чужую переписку не видят.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_08_custom_rates.sql. Можно запускать повторно.
-- =====================================================

create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,  -- чья переписка (байер)
  from_admin  boolean not null default false,                             -- true = ответ поддержки
  body        text not null check (char_length(btrim(body)) between 1 and 4000),
  meta        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,                                                -- когда прочитал получатель
  created_at  timestamptz not null default now()
);

create index if not exists support_messages_user_idx on public.support_messages (user_id, created_at);
create index if not exists support_messages_unread_idx on public.support_messages (from_admin, read_at) where read_at is null;

alter table public.support_messages enable row level security;

-- читать: байер — только свою переписку, админ — все
drop policy if exists "support: read" on public.support_messages;
create policy "support: read" on public.support_messages for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- писать напрямую нельзя никому — только через функции
revoke insert, update, delete on public.support_messages from anon, authenticated;
grant select on public.support_messages to authenticated;


-- 1. Байер пишет в поддержку
create or replace function public.support_send(p_body text, p_meta jsonb default '{}'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_active) then
    raise exception 'no_access';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'empty_message'; end if;
  -- защита от спама: не больше 30 сообщений в час
  if (select count(*) from public.support_messages
       where user_id = auth.uid() and not from_admin and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_messages';
  end if;
  insert into public.support_messages (user_id, from_admin, body, meta)
  values (auth.uid(), false, left(btrim(p_body), 4000),
          case when jsonb_typeof(p_meta) = 'object' and octet_length(p_meta::text) <= 8000 then p_meta else '{}'::jsonb end)
  returning id into v_id;
  return v_id;
end;
$$;


-- 2. Админ отвечает байеру
create or replace function public.admin_support_reply(p_user uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'empty_message'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'user_not_found'; end if;
  insert into public.support_messages (user_id, from_admin, body)
  values (p_user, true, left(btrim(p_body), 4000))
  returning id into v_id;
  -- ответили — значит, сообщения байера прочитаны
  update public.support_messages set read_at = now()
   where user_id = p_user and not from_admin and read_at is null;
  return v_id;
end;
$$;


-- 3. Отметить прочитанным.
--    Байер (p_user пусто) — читает ответы поддержки.
--    Админ (p_user = байер) — читает сообщения этого байера.
create or replace function public.support_mark_read(p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then
    update public.support_messages set read_at = now()
     where user_id = auth.uid() and from_admin and read_at is null;
  elsif public.is_admin() then
    update public.support_messages set read_at = now()
     where user_id = p_user and not from_admin and read_at is null;
  else
    raise exception 'forbidden';
  end if;
end;
$$;


-- 4. Список переписок для админа: кто писал, последнее сообщение, сколько непрочитанных
drop function if exists public.admin_support_threads();
create function public.admin_support_threads()
returns table (
  user_id      uuid,
  full_name    text,
  phone        text,
  email        text,
  ws_name      text,
  last_body    text,
  last_from_admin boolean,
  last_at      timestamptz,
  unread       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id,
         p.full_name,
         p.phone,
         u.email::text,
         (select w.name from public.workspaces w where w.owner_id = m.user_id order by w.created_at limit 1),
         last.body,
         last.from_admin,
         last.created_at,
         count(*) filter (where not m.from_admin and m.read_at is null)
    from public.support_messages m
    join public.profiles p on p.user_id = m.user_id
    join auth.users u on u.id = m.user_id
    cross join lateral (
      select s.body, s.from_admin, s.created_at from public.support_messages s
       where s.user_id = m.user_id order by s.created_at desc limit 1
    ) last
   where public.is_admin()
   group by m.user_id, p.full_name, p.phone, u.email, last.body, last.from_admin, last.created_at
   order by count(*) filter (where not m.from_admin and m.read_at is null) > 0 desc, last.created_at desc;
$$;


-- 5. Сколько непрочитанных: админу — от всех байеров, байеру — ответов поддержки
create or replace function public.support_unread()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin()
    then (select count(*) from public.support_messages where not from_admin and read_at is null and user_id <> auth.uid())
    else (select count(*) from public.support_messages where user_id = auth.uid() and from_admin and read_at is null)
  end;
$$;

revoke all on function public.support_send(text, jsonb)            from public, anon;
revoke all on function public.admin_support_reply(uuid, text)      from public, anon;
revoke all on function public.support_mark_read(uuid)              from public, anon;
revoke all on function public.admin_support_threads()              from public, anon;
revoke all on function public.support_unread()                     from public, anon;
grant execute on function public.support_send(text, jsonb)         to authenticated;
grant execute on function public.admin_support_reply(uuid, text)   to authenticated;
grant execute on function public.support_mark_read(uuid)           to authenticated;
grant execute on function public.admin_support_threads()           to authenticated;
grant execute on function public.support_unread()                  to authenticated;

-- ГОТОВО ✅
