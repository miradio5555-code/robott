-- =====================================================
-- ULA FACTORY — миграция 39: живой чат поддержки
--
-- Чат поддержки работает как мессенджер:
--   • Новые сообщения приходят сразу, без ожидания (Supabase Realtime).
--     Байер получает только свою переписку, админ — все (правило «support: read» из файла 9).
--   • support_agent() — профиль админа для шапки чата у байера: имя, фото, когда последний раз отвечал.
--     Почту, телефон и id админа байер не видит.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_38_client_errors.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 39) then
      raise exception 'СТОП: файл 39 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Сообщения поддержки — в Realtime (новые и прочитанные приходят на сайт сразу)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_messages') then
    alter publication supabase_realtime add table public.support_messages;
  end if;
end $$;


-- 2. Профиль поддержки для байера: админ, который отвечал последним (или первый админ)
create or replace function public.support_agent()
returns table (full_name text, avatar_path text, last_reply_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.full_name, p.avatar_path,
         (select max(m.created_at) from public.support_messages m where m.from_admin)
    from public.profiles p
   where p.role = 'admin' and p.is_active
   order by (p.avatar_path is not null) desc, p.created_at
   limit 1;
$$;
revoke all on function public.support_agent() from public, anon, authenticated;
grant execute on function public.support_agent() to authenticated;


-- Отметка: файл 39 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (39, 'migration_39_support_live.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
