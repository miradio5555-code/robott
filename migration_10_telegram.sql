-- =====================================================
-- ULA FACTORY — миграция 10: уведомления о техподдержке в Telegram
--
--   • admin_settings — настройки платформы (видит и меняет только админ).
--     Здесь хранится, в какой чат Telegram слать уведомления (telegram_chat_id).
--   • support_messages.notified_at — когда об этом сообщении уже сообщили в Telegram
--     (чтобы не прислать одно и то же дважды).
--   • Сам токен бота хранится НЕ здесь, а в Supabase → Edge Functions → Secrets
--     (TELEGRAM_BOT_TOKEN).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_09_support.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
--    (иначе он перезапишет новые функции). Ничего не будет изменено.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 10) then
      raise exception 'СТОП: файл 10 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;

create table if not exists public.admin_settings (
  key        text primary key check (char_length(key) <= 60),
  value      text check (value is null or char_length(value) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.admin_settings enable row level security;

drop policy if exists "admin_settings: admin" on public.admin_settings;
create policy "admin_settings: admin" on public.admin_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.admin_settings from anon;
grant select, insert, update, delete on public.admin_settings to authenticated;

alter table public.support_messages add column if not exists notified_at timestamptz;

-- ✅ ОТМЕТКА: файл 10 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (10, 'migration_10_telegram.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
