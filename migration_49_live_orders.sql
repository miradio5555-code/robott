-- =====================================================
-- ULA FACTORY — миграция 49: живое обновление кабинета
--
-- Раньше новое появлялось только после «Обновить»: заявка клиента по ссылке, оплата,
-- правка помощника или с другого телефона, заявка на обмен. Теперь база сама сообщает сайту
-- об изменениях (Supabase Realtime), и список обновляется через секунду.
-- Кто что получает — по тем же правилам чтения: байер — только свой кабинет, админ — открытый.
--
--   • orders, clients, shipments, exchange_requests — в Realtime.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_48_admin_edit.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 49) then
      raise exception 'СТОП: файл 49 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


do $$
declare t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then return; end if;
  foreach t in array array['orders', 'clients', 'shipments', 'exchange_requests'] loop
    if to_regclass('public.' || t) is not null
       and not exists (select 1 from pg_publication_tables
                        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;


-- ✅ ОТМЕТКА: файл 49 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (49, 'migration_49_live_orders.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
