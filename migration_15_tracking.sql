-- =====================================================
-- ULA FACTORY — миграция 15: учёт запущенных SQL-файлов
--
-- Создаёт таблицу schema_migrations и отмечает, что файлы 0–14 уже запущены
-- (проверено в базе 21.10.2026). После этого старые файлы сами откажутся
-- запускаться повторно и не сломают новые функции.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- =====================================================

create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;

insert into public.schema_migrations (version, name) values
  (0, 'supabase_schema.sql'),
  (1, 'migration_01_clients.sql'),
  (2, 'migration_02_workspaces.sql'),
  (3, 'migration_03_buyer_phone.sql'),
  (4, 'migration_04_currency.sql'),
  (5, 'migration_05_delivery.sql'),
  (6, 'migration_06_open_signup.sql'),
  (7, 'migration_07_client_price.sql'),
  (8, 'migration_08_custom_rates.sql'),
  (9, 'migration_09_support.sql'),
  (10, 'migration_10_telegram.sql'),
  (11, 'migration_11_status_history.sql'),
  (12, 'migration_12_order_activity.sql'),
  (13, 'migration_13_suppliers.sql'),
  (14, 'migration_14_client_links.sql')
on conflict (version) do nothing;


-- ✅ ОТМЕТКА: файл 15 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (15, 'migration_15_tracking.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
