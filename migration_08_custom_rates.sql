-- =====================================================
-- ULA FACTORY — миграция 08: свои курсы валют у каждого байера
--
-- Каждый кабинет хранит свои курсы, например:
--   {"CNY_KGS": 13.2, "USD_KGS": 88.5}
-- означает 1 CNY = 13,2 KGS и 1 USD = 88,5 KGS.
-- Эти курсы сами подставляются в новые заказы и в калькулятор.
-- Другие байеры и клиенты их не видят (правила доступа кабинета).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_07_client_price.sql. Можно запускать повторно.
-- =====================================================

alter table public.workspaces
  add column if not exists custom_rates jsonb not null default '{}'::jsonb;

-- только объект вида {"CNY_KGS": 13.2, ...}
alter table public.workspaces drop constraint if exists workspaces_custom_rates_obj;
alter table public.workspaces add  constraint workspaces_custom_rates_obj
  check (jsonb_typeof(custom_rates) = 'object');

-- владелец кабинета может менять и свои курсы
grant update (name, order_prefix, warehouse_address, warehouse_contacts,
              default_purchase_currency, default_client_currency,
              default_delivery_currency, default_delivery_tariff, custom_rates)
  on public.workspaces to authenticated;

-- ГОТОВО ✅
