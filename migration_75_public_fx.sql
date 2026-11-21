-- =====================================================
-- ULA FACTORY — миграция 75: курс юаня ULA на главной странице для всех
--
-- ЗАЧЕМ. Курс ULA (таблица platform_fx, ставит администратор) раньше видели только вошедшие байеры.
-- Теперь его видит любой посетитель главной ulafactory.com — без регистрации: курс на сегодня,
-- ступени «от 1 000 ¥ — …», как курс изменился и график за 7 / 30 дней.
--
-- ЧТО ОТДАЁТ public_fx(). Только цифры курса:
--   { tiers: [{from, rate}], eta, updated_at, hist: [{at, r}] }   (hist — курс первой ступени за 31 день)
-- НЕ отдаёт заметку администратора (note): в ней реквизиты для оплаты. Таблицы platform_fx и
-- platform_fx_history по-прежнему закрыты для гостей — гость получает только то, что вернула функция.
--
-- Заказы, клиенты, платежи, балансы и аккаунты этот файл НЕ меняет.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, и ни один файл новее 75 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 75) then
    raise exception 'СТОП: файл 75 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
  if to_regclass('public.platform_fx_history') is null then
    raise exception 'СТОП: сначала запустите миграцию 34 (история курса). Ничего не изменено.';
  end if;
end $$;

-- курс первой (самой маленькой) ступени — по нему рисуется график
create or replace function public.fx_main_rate(p_tiers jsonb)
returns numeric
language sql
immutable
set search_path = public
as $$
  select (e->>'rate')::numeric
    from jsonb_array_elements(case when jsonb_typeof(p_tiers) = 'array' then p_tiers else '[]'::jsonb end) e
   where jsonb_typeof(e) = 'object' and (e->>'rate') ~ '^[0-9]+(\.[0-9]+)?$' and (e->>'rate')::numeric > 0
   order by coalesce(nullif(e->>'from', '')::numeric, 0)
   limit 1;
$$;
revoke all on function public.fx_main_rate(jsonb) from public, anon, authenticated;

create or replace function public.public_fx()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when p.tiers is null or public.fx_main_rate(p.tiers) is null then null else jsonb_build_object(
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object('from', coalesce(nullif(e->>'from', '')::numeric, 0), 'rate', (e->>'rate')::numeric)
                                        order by coalesce(nullif(e->>'from', '')::numeric, 0)), '[]'::jsonb)
                from jsonb_array_elements(p.tiers) e
               where jsonb_typeof(e) = 'object' and (e->>'rate') ~ '^[0-9]+(\.[0-9]+)?$' and (e->>'rate')::numeric > 0),
    'eta', p.eta,
    'updated_at', p.updated_at,
    'hist', (select coalesce(jsonb_agg(jsonb_build_object('at', h.created_at, 'r', h.r) order by h.created_at), '[]'::jsonb)
               from ((select created_at, public.fx_main_rate(tiers) r
                        from public.platform_fx_history
                       where created_at >= now() - interval '31 days'
                       order by created_at desc limit 300)
                     union all   -- курс, который действовал на начало периода
                     (select created_at, public.fx_main_rate(tiers) r
                        from public.platform_fx_history
                       where created_at < now() - interval '31 days' and public.fx_main_rate(tiers) is not null
                       order by created_at desc limit 1)) h
              where h.r is not null)
  ) end
  from public.platform_fx p where p.id = 1;
$$;
revoke all on function public.public_fx() from public;
grant execute on function public.public_fx() to anon, authenticated;

insert into public.schema_migrations (version, name) values (75, 'migration_75_public_fx.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
