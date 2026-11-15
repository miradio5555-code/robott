-- =====================================================
-- ULA FACTORY — миграция 66: серия дней «Всё сделано» в профиле (игра, js/game.js)
--
-- ЗАЧЕМ. Уровни, очки и значки считаются из заказов кабинета и уже одинаковы на всех устройствах.
-- Только серия дней («закрыл все дела на «Сегодня» N дней подряд») хранится в браузере. С этим файлом
-- она хранится ещё и в профиле человека — телефон и компьютер видят одну и ту же серию.
--   • profiles.game_days — даты (не больше 120 последних), когда список «Сегодня» был пуст;
--   • profiles.game_best — лучшая серия;
--   • my_game_get() / my_game_set(p_days, p_best) — только свой профиль. Даты проверяются, лишнее отбрасывается.
-- Заказы, клиенты, деньги — не меняются. Ничего никому не отправляется.
-- Без этого файла сайт работает как раньше: серия — в браузере.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 65.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 65) then
    raise exception 'СТОП: сначала запустите файл 65. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 66) then
    raise exception 'СТОП: файл 66 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Серия в профиле
alter table public.profiles add column if not exists game_days date[] not null default '{}';
alter table public.profiles add column if not exists game_best smallint not null default 0;
alter table public.profiles drop constraint if exists profiles_game_chk;
alter table public.profiles add constraint profiles_game_chk
  check (cardinality(game_days) <= 120 and game_best between 0 and 10000);


-- 2. Прочитать свою серию
create or replace function public.my_game_get()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'days', coalesce((select json_agg(to_char(d, 'YYYY-MM-DD') order by d) from unnest(p.game_days) d), '[]'::json),
    'best', p.game_best)
  from public.profiles p where p.user_id = auth.uid();
$$;
revoke all on function public.my_game_get() from public, anon, authenticated;
grant execute on function public.my_game_get() to authenticated;


-- 3. Сохранить свою серию: даты объединяются с уже сохранёнными (с другого устройства), будущие даты отбрасываются
create or replace function public.my_game_set(p_days text[], p_best integer)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_days date[];
  v_in date[] := '{}';
  x text;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days is null or cardinality(p_days) > 400 then raise exception 'bad_value' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- только настоящие даты «ГГГГ-ММ-ДД»; «2026-02-31» и прочее просто пропускаем
  foreach x in array p_days loop
    if x ~ '^\d{4}-\d{2}-\d{2}$' then
      begin v_in := v_in || x::date; exception when others then null; end;
    end if;
  end loop;

  select coalesce(array_agg(d order by d), '{}') into v_days from (
    select distinct d from (
      select unnest(v_in) as d
      union
      select d from public.profiles p, unnest(p.game_days) d where p.user_id = auth.uid()
    ) a
    where d <= current_date + 1 and d >= current_date - 365
    order by d desc
    limit 120
  ) b;

  update public.profiles
     set game_days = v_days,
         game_best = greatest(game_best, least(coalesce(p_best, 0), cardinality(v_days)))
   where user_id = auth.uid();
  return public.my_game_get();
end;
$$;
revoke all on function public.my_game_set(text[], integer) from public, anon, authenticated;
grant execute on function public.my_game_set(text[], integer) to authenticated;


-- ✅ ОТМЕТКА: файл 66 запущен
insert into public.schema_migrations (version, name) values (66, 'migration_66_game.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
