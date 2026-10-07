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

-- ГОТОВО ✅
