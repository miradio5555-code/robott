#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 72 («Мои цели») на временной базе.
#
#   bash tests/goals_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Личное остаётся личным: чужие цели, задачи и минуты не видны и не меняются; привязать задачу или подцель к чужой
# цели нельзя. Большая цель — только крупнее горизонтом, без циклов. В фокусе дня не больше трёх задач. Минуты в фокусе
# меняет только my_focus_add(), сайт не может их подделать. Посетителю без входа закрыто всё. Повторный запуск файла
# ничего не ломает. Доски: чужие доски и списки не видны; карточку нельзя положить в чужой список или в список другой
# доски; список с карточками удалить нельзя; доска удаляется вместе со своими списками и карточками.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-goalstest-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
q() { docker exec -i "$NAME" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

q < tests/supabase_stub.sql >/dev/null
q < supabase_schema.sql >/dev/null 2>&1
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 71) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
echo "▶ Файл 72 и повторный запуск…"
q < migration_72_personal_goals.sql >/dev/null || { echo "❌ файл 72 не запустился"; exit 1; }
q < migration_72_personal_goals.sql >/dev/null || { echo "❌ повторный запуск файла 72 упал"; exit 1; }

q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'me@test'), ('00000000-0000-0000-0000-0000000000c2', 'other@test');
create schema t;
grant usage on schema t to authenticated, anon;
create function t.err(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ОЖИДАЛАСЬ ОШИБКА «%», а запрос прошёл: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'ОЖИДАЛАСЬ%' or sqlerrm !~* p_pattern then raise exception 'ожидалось «%», получено «%» в %', p_pattern, sqlerrm, p_sql; end if;
end $$;
grant execute on function t.err(text, text) to authenticated, anon;
create function t.u(p text) returns void language sql as $$ select set_config('request.uid', p, false); $$;
grant execute on function t.u(text) to authenticated, anon;
SQL

q 2>&1 <<'SQL' | sed -e 's/^NOTICE:  //'
set role authenticated;
do $$
declare y uuid; m uuid; w uuid; og uuid; t1 uuid; t2 uuid; t3 uuid; t4 uuid; ot uuid; r jsonb;
begin
  -- чужой человек заводит свою цель и задачу
  perform t.u('00000000-0000-0000-0000-0000000000c2');
  insert into public.my_goals (title, horizon) values ('Чужая цель', 'year') returning id into og;
  insert into public.my_tasks (title, col) values ('Чужая задача', 'plan') returning id into ot;

  perform t.u('00000000-0000-0000-0000-0000000000c1');
  assert (select count(*) from public.my_goals) = 0 and (select count(*) from public.my_tasks) = 0, 'чужое не видно';
  update public.my_tasks set title = 'взлом' where id = ot;
  delete from public.my_goals where id = og;
  perform t.err(format('insert into public.my_goals (user_id, title) values (%L, %L)', '00000000-0000-0000-0000-0000000000c2', 'x'), 'row-level security');

  insert into public.my_goals (title, horizon, why, strategy) values ('Сдать HSK 5', 'year', 'Учёба и работа без переводчика', '2–3 часа каждое утро') returning id into y;
  insert into public.my_goals (title, horizon, parent_id) values ('Пройти уроки 5–10', 'month', y) returning id into m;
  insert into public.my_goals (title, horizon, parent_id) values ('Урок 5 и 6', 'week', m) returning id into w;
  perform t.err(format('insert into public.my_goals (title, horizon, parent_id) values (%L, %L, %L)', 'x', 'week', og), 'bad_parent');
  perform t.err(format('update public.my_goals set parent_id = %L where id = %L', w, y), 'bad_parent');
  perform t.err(format('insert into public.my_goals (title, horizon, parent_id) values (%L, %L, %L)', 'x', 'year', m), 'bad_parent');
  perform t.err(format('insert into public.my_goals (title) values (%L)', '   '), 'check');

  insert into public.my_tasks (title, col, goal_id, focus_date) values ('Слова урока 5', 'doing', w, current_date) returning id into t1;
  insert into public.my_tasks (title, col, goal_id, focus_date) values ('Аудирование', 'plan', w, current_date) returning id into t2;
  insert into public.my_tasks (title, col, focus_date) values ('Сочинение 80 иероглифов', 'plan', current_date) returning id into t3;
  perform t.err(format('insert into public.my_tasks (title, focus_date) values (%L, current_date)', 'четвёртое'), 'focus_full');
  insert into public.my_tasks (title) values ('Четвёртое дело') returning id into t4;
  perform t.err(format('update public.my_tasks set focus_date = current_date where id = %L', t4), 'focus_full');
  update public.my_tasks set focus_date = current_date + 1 where id = t4;
  perform t.err(format('update public.my_tasks set goal_id = %L where id = %L', og, t4), 'bad_goal');
  perform t.err(format('update public.my_tasks set checklist = %L where id = %L', '{"a":1}', t4), 'check');

  update public.my_tasks set col = 'done' where id = t1;
  assert (select done_at is not null from public.my_tasks where id = t1), 'выполнено — есть время';
  update public.my_tasks set col = 'plan' where id = t1;
  assert (select done_at is null from public.my_tasks where id = t1), 'вернули — время снято';

  update public.my_tasks set focus_min = 999 where id = t2;
  assert (select focus_min from public.my_tasks where id = t2) = 0, 'минуты напрямую не меняются';
  perform t.err(format('insert into public.my_focus_days (day, minutes) values (current_date, %s)', 500), 'permission denied');
  r := public.my_focus_add(t2, 25, current_date);
  r := public.my_focus_add(t2, 50, current_date);
  assert (r->>'day_minutes')::int = 75 and (r->>'task_minutes')::int = 75, 'минуты прибавились к дню и задаче';
  perform t.err(format('select public.my_focus_add(%L, 500, current_date)', t2), 'bad_minutes');
  perform t.err(format('select public.my_focus_add(%L, 10, current_date - 10)', t2), 'bad_day');
  r := public.my_focus_add(ot, 30, current_date);
  assert r->>'task_minutes' is null, 'к чужой задаче минуты не прибавляются';

  update public.my_goals set status = 'done' where id = w;
  assert (select done_at is not null from public.my_goals where id = w), 'цель достигнута — есть время';
  delete from public.my_goals where id = m;
  assert (select parent_id is null from public.my_goals where id = w), 'удалили большую цель — подцель осталась без привязки';
  delete from public.my_goals where id = w;
  assert (select goal_id is null from public.my_tasks where id = t1), 'удалили цель — задача осталась';

  perform t.u('00000000-0000-0000-0000-0000000000c2');
  assert (select title from public.my_tasks where id = ot) = 'Чужая задача', 'чужую задачу никто не поменял';
  assert (select count(*) from public.my_goals where id = og) = 1, 'чужую цель никто не удалил';
  assert (select focus_min from public.my_tasks where id = ot) = 0, 'и минут ей не добавили';
  assert (select count(*) from public.my_focus_days) = 0, 'чужие минуты не видны';
  raise notice '   ✓ цели и задачи: только свои, большая цель крупнее и без циклов, фокус ≤ 3, минуты только через my_focus_add';
end $$;

do $$
declare b1 uuid; b2 uuid; l1 uuid; l2 uuid; l3 uuid; ob uuid; ol uuid; c1 uuid; g uuid;
begin
  perform t.u('00000000-0000-0000-0000-0000000000c2');
  insert into public.my_boards (title) values ('Чужая доска') returning id into ob;
  insert into public.my_lists (board_id, title) values (ob, 'Чужой список') returning id into ol;

  perform t.u('00000000-0000-0000-0000-0000000000c1');
  assert (select count(*) from public.my_boards) = 0 and (select count(*) from public.my_lists) = 0, 'чужие доски не видны';
  perform t.err(format('insert into public.my_lists (board_id, title) values (%L, %L)', ob, 'x'), 'bad_board');
  insert into public.my_goals (title, horizon) values ('Цель доски', 'year') returning id into g;
  insert into public.my_boards (title, color, goal_id, starred) values ('HSK 5', 'green', g, true) returning id into b1;
  insert into public.my_boards (title) values ('Дневные задачи') returning id into b2;
  perform t.err(format('insert into public.my_boards (title, color) values (%L, %L)', 'x', 'neon'), 'check');
  insert into public.my_lists (board_id, title, pos) values (b1, 'Ноябрь', 1) returning id into l1;
  insert into public.my_lists (board_id, title, pos) values (b1, 'Декабрь', 2) returning id into l2;
  insert into public.my_lists (board_id, title, pos) values (b2, 'Утро', 1) returning id into l3;
  perform t.err(format('update public.my_lists set board_id = %L where id = %L', b2, l1), 'forbidden');

  insert into public.my_tasks (title, board_id, list_id) values ('Слова 1–50', b1, l1) returning id into c1;
  perform t.err(format('insert into public.my_tasks (title, board_id, list_id) values (%L, %L, %L)', 'x', b1, l3), 'bad_list');
  perform t.err(format('insert into public.my_tasks (title, board_id, list_id) values (%L, %L, %L)', 'x', ob, ol), 'bad_list');
  perform t.err(format('insert into public.my_tasks (title, board_id) values (%L, %L)', 'x', b1), 'my_tasks_board_list_pair');
  update public.my_tasks set list_id = l2 where id = c1;
  update public.my_tasks set board_id = b2, list_id = l3 where id = c1;
  update public.my_tasks set board_id = b1, list_id = l1 where id = c1;
  perform t.err(format('delete from public.my_lists where id = %L', l1), 'foreign key');
  delete from public.my_lists where id = l2;
  update public.my_tasks set col = 'done' where id = c1;
  assert (select done_at is not null from public.my_tasks where id = c1), 'карточка доски отмечается сделанной';

  delete from public.my_goals where id = g;
  assert (select goal_id is null from public.my_boards where id = b1), 'удалили цель — доска осталась';
  delete from public.my_boards where id = b1;
  assert (select count(*) from public.my_tasks where id = c1) = 0 and (select count(*) from public.my_lists where board_id = b1) = 0, 'доска удалена вместе со списками и карточками';

  perform t.u('00000000-0000-0000-0000-0000000000c2');
  assert (select count(*) from public.my_lists where id = ol) = 1, 'чужой список на месте';
  raise notice '   ✓ доски: только свои, карточка — в список своей доски, список с карточками не удаляется';
end $$;

reset role;
set role anon;
do $$
begin
  perform t.err('select count(*) from public.my_goals', 'permission denied');
  perform t.err('select count(*) from public.my_tasks', 'permission denied');
  perform t.err('select count(*) from public.my_boards', 'permission denied');
  perform t.err('select count(*) from public.my_lists', 'permission denied');
  perform t.err('select public.my_focus_add(null, 10, current_date)', 'permission denied');
  raise notice '   ✓ посетителю без входа закрыто всё';
end $$;
SQL
echo "✅ Файл 72 проверен"
