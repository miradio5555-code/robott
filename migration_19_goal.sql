-- =====================================================
-- ULA FACTORY — миграция 19: цель по прибыли на месяц
--
-- Владелец кабинета ставит цель («хочу зарабатывать 100 000 KGS в месяц»),
-- а в разделе «Аналитика» показывается полоска прогресса.
--
--   • workspaces.profit_goals     — цели по валютам, например {"KGS": 100000, "USD": 2000};
--   • set_profit_goal(ws, cur, n) — поставить цель; число 0 или пусто — убрать цель.
--
-- Менять цель может только владелец (помощник не может). Напрямую таблицу менять нельзя — только через функцию.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_18_team.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 19) then
      raise exception 'СТОП: файл 19 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Цели по прибыли (по валютам)
alter table public.workspaces add column if not exists profit_goals jsonb not null default '{}'::jsonb;
alter table public.workspaces drop constraint if exists workspaces_profit_goals_chk;
alter table public.workspaces add  constraint workspaces_profit_goals_chk
  check (jsonb_typeof(profit_goals) = 'object' and pg_column_size(profit_goals) < 2000);


-- 2. Поставить или убрать цель (только владелец)
create or replace function public.set_profit_goal(p_ws uuid, p_cur text, p_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_goals jsonb;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden'; end if;
  if p_cur is null or p_cur !~ '^[A-Z]{3}$' then raise exception 'invalid_currency' using errcode = '22023'; end if;
  if p_amount is not null and (p_amount < 0 or p_amount > 1000000000000) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  select profit_goals into v_goals from public.workspaces where id = p_ws for update;
  if p_amount is null or p_amount = 0 then
    v_goals := v_goals - p_cur;
  else
    v_goals := v_goals || jsonb_build_object(p_cur, round(p_amount, 2));
  end if;
  update public.workspaces set profit_goals = v_goals where id = p_ws;
  return v_goals;
end;
$$;

revoke all on function public.set_profit_goal(uuid, text, numeric) from public, anon;
grant execute on function public.set_profit_goal(uuid, text, numeric) to authenticated;

-- ✅ ОТМЕТКА: файл 19 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (19, 'migration_19_goal.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
