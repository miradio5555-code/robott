-- =====================================================
-- ULA FACTORY — миграция 32: дополнительная защита (проверка безопасности 28.10.2026)
--
--   • Анонимам (посетителям без входа) — никакого прямого доступа к таблицам.
--     Страницы клиентов работают только через проверенные функции (по секретным ссылкам),
--     поэтому прямой доступ им не нужен. Раньше его закрывали только правила строк (RLS);
--     теперь закрыт ещё и сам доступ к таблицам — второй замок на случай ошибки в правилах.
--     То же — для новых таблиц, которые появятся потом.
--   • Фото заказов: не больше 5 МБ (сайт и так сжимает фото до ~260 КБ).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_31_exchange_disputes.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 32) then
      raise exception 'СТОП: файл 32 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Анонимам — без прямого доступа к таблицам и счётчикам (функции для клиентов работают как раньше)
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;


-- 2. Фото заказов — не больше 5 МБ
update storage.buckets set file_size_limit = 5242880 where id = 'order-photos' and coalesce(file_size_limit, 0) > 5242880;


-- ✅ ОТМЕТКА: файл 32 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (32, 'migration_32_security.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
