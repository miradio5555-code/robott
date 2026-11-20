-- =====================================================
-- ULA FACTORY — миграция 72: «Мои цели» — личные цели (5 лет → год → месяц → неделя), доска задач, фокус дня,
-- минуты в фокусе
--
-- КАК УСТРОЕНО
--   • my_goals — цель человека: название, горизонт (5y / year / month / week), к какой большей цели ведёт (parent_id),
--     сфера, срок, «зачем мне это», стратегия, статус (active / done).
--   • my_tasks — задача на личной доске: колонка (inbox → plan → doing → done), цель, срок, заметки, чек-лист (jsonb),
--     фокус дня (focus_date + порядок), сколько минут было в фокусе.
--   • my_focus_days — сколько минут человек провёл в фокусе за день (одна строка на день). Пишется только функцией
--     my_focus_add(): минуты прибавляются в одной транзакции к дню и к задаче, без «прочитал — прибавил — записал».
--   • Фокус дня — не больше трёх задач на одну дату (проверяет база, а не только сайт).
--
-- ЧЬИ ДАННЫЕ. Всё личное: строку видит и меняет только её владелец (user_id = auth.uid()), даже владелец кабинета и
-- администратор чужие цели не видят. Кабинет (workspace) здесь не участвует: цели есть у байера и у сотрудника.
-- Посетителю без входа (anon) закрыто всё. Публичные ссылки клиента, витрина и заявки эти таблицы не читают.
-- Заказы, клиенты, платежи и балансы этот файл НЕ меняет.
--
-- Удаление аккаунта удаляет и его цели (on delete cascade). Удаление цели не удаляет задачи: у них просто пропадает
-- привязка к цели; у подцелей — к большей цели.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, и ни один файл новее 72 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 72) then
    raise exception 'СТОП: файл 72 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Таблицы
create table if not exists public.my_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  horizon     text not null default 'year' check (horizon in ('5y', 'year', 'month', 'week')),
  parent_id   uuid references public.my_goals(id) on delete set null,
  area        text check (area is null or char_length(area) <= 40),
  due         date,
  why         text check (why is null or char_length(why) <= 2000),
  strategy    text check (strategy is null or char_length(strategy) <= 4000),
  status      text not null default 'active' check (status in ('active', 'done')),
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index if not exists my_goals_user_idx on public.my_goals (user_id, horizon);

create table if not exists public.my_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  col          text not null default 'inbox' check (col in ('inbox', 'plan', 'doing', 'done')),
  goal_id      uuid references public.my_goals(id) on delete set null,
  due          date,
  notes        text check (notes is null or char_length(notes) <= 4000),
  checklist    jsonb not null default '[]'::jsonb
                 check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 50 and pg_column_size(checklist) <= 20000),
  focus_date   date,
  focus_order  integer not null default 0,
  focus_min    integer not null default 0 check (focus_min between 0 and 1000000),
  done_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists my_tasks_user_idx  on public.my_tasks (user_id, col);
create index if not exists my_tasks_focus_idx on public.my_tasks (user_id, focus_date) where focus_date is not null;

create table if not exists public.my_focus_days (
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day      date not null,
  minutes  integer not null default 0 check (minutes between 0 and 1440),
  primary key (user_id, day)
);


-- 2. Проверки, которые не выражаются простым check
--    • цель и большая цель — того же человека (внешний ключ сам по себе этого не проверяет);
--    • большая цель — горизонтом крупнее, без циклов;
--    • в фокусе дня не больше трёх задач на одну дату;
--    • лимиты, чтобы одна учётная запись не забила базу: 500 целей, 5000 задач.
create or replace function public._my_goals_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_rank  constant jsonb := '{"week":1,"month":2,"year":3,"5y":4}';
  v_p     public.my_goals;
  v_cur   uuid;
  v_steps integer := 0;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.my_goals where user_id = new.user_id) >= 500 then
    raise exception 'too_many_goals' using errcode = '54000';
  end if;
  if new.status = 'done' and new.done_at is null then new.done_at := now(); end if;
  if new.status = 'active' then new.done_at := null; end if;
  if new.parent_id is not null then
    select * into v_p from public.my_goals where id = new.parent_id;
    if not found or v_p.user_id <> new.user_id then raise exception 'bad_parent' using errcode = '22023'; end if;
    if (v_rank ->> v_p.horizon)::int <= (v_rank ->> new.horizon)::int then raise exception 'bad_parent' using errcode = '22023'; end if;
    v_cur := v_p.parent_id;
    while v_cur is not null and v_steps < 10 loop
      if v_cur = new.id then raise exception 'bad_parent' using errcode = '22023'; end if;
      select parent_id into v_cur from public.my_goals where id = v_cur;
      v_steps := v_steps + 1;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists my_goals_guard on public.my_goals;
create trigger my_goals_guard before insert or update on public.my_goals
for each row execute function public._my_goals_guard();

create or replace function public._my_tasks_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then raise exception 'forbidden' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and new.focus_min <> old.focus_min and coalesce(current_setting('ula.my_focus', true), '') <> 'on' then
    new.focus_min := old.focus_min;   -- минуты меняет только my_focus_add()
  end if;
  if tg_op = 'INSERT' then
    new.focus_min := 0;
    if (select count(*) from public.my_tasks where user_id = new.user_id) >= 5000 then
      raise exception 'too_many_tasks' using errcode = '54000';
    end if;
  end if;
  if new.goal_id is not null and not exists (select 1 from public.my_goals g where g.id = new.goal_id and g.user_id = new.user_id) then
    raise exception 'bad_goal' using errcode = '22023';
  end if;
  if new.focus_date is not null and (tg_op = 'INSERT' or new.focus_date is distinct from old.focus_date)
     and (select count(*) from public.my_tasks t where t.user_id = new.user_id and t.focus_date = new.focus_date and t.id <> new.id) >= 3 then
    raise exception 'focus_full' using errcode = '23514';
  end if;
  if new.col = 'done' and new.done_at is null then new.done_at := now(); end if;
  if new.col <> 'done' then new.done_at := null; end if;
  return new;
end;
$$;
drop trigger if exists my_tasks_guard on public.my_tasks;
create trigger my_tasks_guard before insert or update on public.my_tasks
for each row execute function public._my_tasks_guard();
-- служебные функции триггеров напрямую не вызываются (триггер работает и без этого права)
revoke all on function public._my_goals_guard() from public, anon, authenticated;
revoke all on function public._my_tasks_guard() from public, anon, authenticated;


-- 3. Доступ: только свои строки
alter table public.my_goals      enable row level security;
alter table public.my_tasks      enable row level security;
alter table public.my_focus_days enable row level security;

drop policy if exists my_goals_own on public.my_goals;
create policy my_goals_own on public.my_goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists my_tasks_own on public.my_tasks;
create policy my_tasks_own on public.my_tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists my_focus_days_read on public.my_focus_days;
create policy my_focus_days_read on public.my_focus_days for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.my_goals, public.my_tasks, public.my_focus_days from public, anon, authenticated;
grant select, insert, update, delete on public.my_goals, public.my_tasks to authenticated;
grant select on public.my_focus_days to authenticated;   -- писать дни может только my_focus_add()


-- 4. Минуты в фокусе: прибавить к дню и к задаче одной транзакцией
--    p_day — дата у человека (его часовой пояс знает только телефон), допускается ±2 дня от даты сервера.
create or replace function public.my_focus_add(p_task uuid, p_minutes integer, p_day date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_day integer;
  v_tsk integer;
begin
  if v_me is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 240 then raise exception 'bad_minutes' using errcode = '22023'; end if;
  if p_day is null or abs(p_day - current_date) > 2 then raise exception 'bad_day' using errcode = '22023'; end if;
  insert into public.my_focus_days (user_id, day, minutes) values (v_me, p_day, least(p_minutes, 1440))
  on conflict (user_id, day) do update set minutes = least(public.my_focus_days.minutes + excluded.minutes, 1440)
  returning minutes into v_day;
  if p_task is not null then
    perform set_config('ula.my_focus', 'on', true);
    update public.my_tasks set focus_min = least(focus_min + p_minutes, 1000000)
     where id = p_task and user_id = v_me
    returning focus_min into v_tsk;
    perform set_config('ula.my_focus', '', true);
  end if;
  return jsonb_build_object('day_minutes', v_day, 'task_minutes', v_tsk);
end;
$$;
revoke all on function public.my_focus_add(uuid, integer, date) from public, anon, authenticated;
grant execute on function public.my_focus_add(uuid, integer, date) to authenticated;

insert into public.schema_migrations (version, name) values (72, 'migration_72_personal_goals.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
