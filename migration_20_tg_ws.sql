-- =====================================================
-- ULA FACTORY — миграция 20: Telegram-уведомления байеру о новых заявках
--
-- Байер подключает свой Telegram к кабинету (кнопка в Настройках), и когда клиент оставляет заявку
-- по ссылке, бот присылает сообщение: кто, что, сколько и ссылку на сайт.
--
--   • ws_telegram          — к какому чату Telegram подключён кабинет (с сайта таблица закрыта);
--   • orders.notified_at   — когда о заявке уже сообщили (чтобы не слать дважды);
--   • tg_connect_start(ws) — владелец получает одноразовый код для кнопки «Start» у бота;
--   • tg_status(ws)        — подключено ли и к какому чату;
--   • tg_disconnect(ws)    — отключить.
-- Саму отправку делает функция telegram-notify (supabase/functions/telegram-notify/index.ts).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_19_goal.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 20) then
      raise exception 'СТОП: файл 20 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Заявка уже отправлена в Telegram?
alter table public.orders add column if not exists notified_at timestamptz;


-- 2. Подключение кабинета к Telegram (читает и пишет только функция telegram-notify)
create table if not exists public.ws_telegram (
  workspace_id    uuid primary key references public.workspaces(id) on delete cascade,
  chat_id         text,
  chat_name       text check (chat_name is null or char_length(chat_name) <= 200),
  code            text unique check (code is null or code ~ '^[a-f0-9]{24}$'),
  code_expires_at timestamptz,
  connected_at    timestamptz
);
alter table public.ws_telegram enable row level security;
revoke all on public.ws_telegram from anon, authenticated;


-- 3. Владелец: получить одноразовый код подключения (живёт 30 минут)
create or replace function public.tg_connect_start(p_ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  insert into public.ws_telegram (workspace_id, code, code_expires_at)
  values (p_ws, v_code, now() + interval '30 minutes')
  on conflict (workspace_id) do update set code = excluded.code, code_expires_at = excluded.code_expires_at;
  return v_code;
end;
$$;


-- 4. Владелец: подключено ли
create or replace function public.tg_status(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r public.ws_telegram;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  select * into r from public.ws_telegram where workspace_id = p_ws;
  return jsonb_build_object('connected', r.chat_id is not null, 'name', r.chat_name);
end;
$$;


-- 5. Владелец: отключить
create or replace function public.tg_disconnect(p_ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  update public.ws_telegram
     set chat_id = null, chat_name = null, code = null, code_expires_at = null, connected_at = null
   where workspace_id = p_ws;
end;
$$;

revoke all on function public.tg_connect_start(uuid) from public, anon;
revoke all on function public.tg_status(uuid)        from public, anon;
revoke all on function public.tg_disconnect(uuid)    from public, anon;
grant execute on function public.tg_connect_start(uuid) to authenticated;
grant execute on function public.tg_status(uuid)        to authenticated;
grant execute on function public.tg_disconnect(uuid)    to authenticated;

-- ✅ ОТМЕТКА: файл 20 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (20, 'migration_20_tg_ws.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
