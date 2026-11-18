#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛОВ 67 и 68 (команда кабинета и задачи) на временной базе.
#
#   bash tests/team_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Настоящую базу не трогает: поднимает пустой Postgres в Docker, применяет файлы 0–68 и проходит сценарии
# из задания: 1 — приглашение сотрудника с ролью и отделом и только разрешённый доступ; 2 — постановка задачи,
# чек-лист, сдача, возврат, принятие; 5 — отключение сотрудника: доступ пропадает, история заказов и задач
# остаётся, незавершённая работа переходит другому; 6 — посетитель по ссылке клиента не видит ничего из команды.
# Плюс: права ролей нельзя выдать себе, круги в структуре, лимит команды, старые функции, повторный запуск.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-teamtest-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
q() { docker exec -i "$NAME" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

q < tests/supabase_stub.sql >/dev/null
q < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | q >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 66) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done

# Данные ДО файлов 67–68: кабинет с владельцем, старым помощником и заказом — должны остаться как были
q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner@test'),  ('00000000-0000-0000-0000-0000000000b2', 'manager@test'),
  ('00000000-0000-0000-0000-0000000000b3', 'sourcing@test'),('00000000-0000-0000-0000-0000000000b4', 'qc@test'),
  ('00000000-0000-0000-0000-0000000000b5', 'logist@test'), ('00000000-0000-0000-0000-0000000000b6', 'newbie@test'),
  ('00000000-0000-0000-0000-0000000000b7', 'other@test'),  ('00000000-0000-0000-0000-0000000000b8', 'oldhelper@test');
insert into public.profiles (user_id, role, full_name, phone) values
  ('00000000-0000-0000-0000-0000000000b1', 'buyer', 'Владелец', '+996700000001'),
  ('00000000-0000-0000-0000-0000000000b2', 'buyer', 'Менеджер', '+996700000002'),
  ('00000000-0000-0000-0000-0000000000b3', 'buyer', 'Закупщик', '+996700000003'),
  ('00000000-0000-0000-0000-0000000000b4', 'buyer', 'Контролёр', '+996700000004'),
  ('00000000-0000-0000-0000-0000000000b5', 'buyer', 'Логист', '+996700000005'),
  ('00000000-0000-0000-0000-0000000000b6', 'buyer', 'Новичок', '+996700000006'),
  ('00000000-0000-0000-0000-0000000000b7', 'buyer', 'Чужой байер', '+996700000007'),
  ('00000000-0000-0000-0000-0000000000b8', 'buyer', 'Старый помощник', '+996700000008')
on conflict (user_id) do update set role = excluded.role, full_name = excluded.full_name, phone = excluded.phone, is_active = true;
-- кабинеты, созданные при регистрации автоматически, убираем: у каждого будет ровно тот, что ниже
delete from public.workspaces w where w.owner_id::text like '00000000-0000-0000-0000-0000000000b%';
insert into public.workspaces (id, name, owner_id) values
  ('00000000-0000-0000-0000-00000000aa01', 'ULA команда', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000aa07', 'Чужой кабинет', '00000000-0000-0000-0000-0000000000b7');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b8', 'staff'),
  ('00000000-0000-0000-0000-00000000aa07', '00000000-0000-0000-0000-0000000000b7', 'owner');
insert into public.orders (workspace_id, client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, supplier, admin_comment)
values ('00000000-0000-0000-0000-00000000aa01', 'Клиент Айбек', 'Кроссовки', 2, 100, 12, 3000, 1000, 'Фабрика Гуанчжоу', 'закупка 100 юаней'),
       ('00000000-0000-0000-0000-00000000aa07', 'Чужой клиент', 'Сумки', 1, 50, 12, 900, 0, null, null);
SQL
before_orders=$(echo "select md5(string_agg(o::text, '|' order by o.id)) from public.orders o;" | q -t -A)

echo "▶ Файл 67 и повторный запуск…"
q < migration_67_team_foundation.sql >/dev/null || { echo "❌ файл 67 не запустился"; exit 1; }
q < migration_67_team_foundation.sql >/dev/null || { echo "❌ повторный запуск файла 67 упал"; exit 1; }
echo "▶ Файл 68 и повторный запуск…"
q < migration_68_team_tasks.sql >/dev/null || { echo "❌ файл 68 не запустился"; exit 1; }
q < migration_68_team_tasks.sql >/dev/null || { echo "❌ повторный запуск файла 68 упал"; exit 1; }

after_orders=$(echo "select md5(string_agg(o::text, '|' order by o.id)) from public.orders o;" | q -t -A)
[ "$before_orders" = "$after_orders" ] || { echo "❌ Файлы 67–68 изменили заказы"; exit 1; }
echo "   ✓ заказы после файлов 67–68 не изменились"

q 2>&1 <<'SQL' | sed -e 's/^NOTICE:  //'
-- помощник: ожидаемая ошибка (текст ошибки должен содержать pattern)
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

-- старый помощник получил роль «Помощник» с правом ставить задачи
do $$
begin
  assert (select role_key from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b8') = 'assistant', 'старый помощник: роль assistant';
  assert (select count(*) from public.ws_roles where workspace_id = '00000000-0000-0000-0000-00000000aa01' and is_system) = 5, '5 готовых ролей в кабинете';
  raise notice '   ✓ старый помощник получил роль «Помощник», в кабинетах по 5 готовых ролей';
end $$;

set role authenticated;

-- ===== Сценарий 1: приём сотрудников =====
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  O text := '00000000-0000-0000-0000-0000000000b1';
  d_src uuid; d_qc uuid; d_log uuid; c text; r jsonb;
begin
  perform t.u(O);
  d_src := public.team_department_save(W, null, 'Закупки', null, null);
  d_qc  := public.team_department_save(W, null, 'Контроль качества', null, null);
  d_log := public.team_department_save(W, null, 'Логистика', null, null);
  perform t.err(format('select public.team_department_save(%L, null, %L, null, null)', W, ' закупки '), 'duplicate_name');
  perform set_config('t.d_src', d_src::text, false);
  perform set_config('t.d_qc', d_qc::text, false);
  perform set_config('t.d_log', d_log::text, false);

  perform set_config('t.c_m', public.team_invite_new(W, 'manager',   null,  'Операционный менеджер', 'Менеджер'), false);
  perform set_config('t.c_s', public.team_invite_new(W, 'sourcing',  d_src, 'Закупщик', null), false);
  perform set_config('t.c_q', public.team_invite_new(W, 'qc',        d_qc,  null, null), false);
  perform set_config('t.c_l', public.team_invite_new(W, 'logistics', d_log, null, null), false);
  perform t.err(format('select public.team_invite_new(%L, %L, null, null, null)', W, 'nope'), 'role_not_allowed');
  raise notice '   ✓ владелец создал отделы и приглашения с ролью, отделом и должностью';
end $$;

do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01';
begin
  perform t.u('00000000-0000-0000-0000-0000000000b2'); assert public.team_join(current_setting('t.c_m')) = W;
  -- менеджер (право «команда») сразу зовёт ещё одного, но роль с правом «команда» выдать не может
  perform t.err(format('select public.team_invite_new(%L, %L, null, null, null)', W, 'manager'), 'role_not_allowed');
  perform set_config('t.c_n', public.team_invite_new(W, 'sourcing', current_setting('t.d_src')::uuid, null, 'Новичок'), false);
  perform t.u('00000000-0000-0000-0000-0000000000b3'); assert public.team_join(current_setting('t.c_s')) = W;
  perform t.u('00000000-0000-0000-0000-0000000000b4'); assert public.team_join(current_setting('t.c_q')) = W;
  perform t.u('00000000-0000-0000-0000-0000000000b5'); assert public.team_join(current_setting('t.c_l')) = W;
  perform t.u('00000000-0000-0000-0000-0000000000b5');
  perform t.err(format('select public.team_join(%L)', current_setting('t.c_l')), 'invalid_invite');
  raise notice '   ✓ четыре сотрудника приняли приглашения; ссылка одноразовая';
end $$;

do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  r jsonb; m jsonb; n int;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b3');   -- закупщик
  r := public.team_overview(W);
  assert r->'me'->>'role_key' = 'sourcing', 'роль из приглашения';
  assert r->'me'->>'department_id' = current_setting('t.d_src'), 'отдел из приглашения';
  assert r->'me'->>'title' = 'Закупщик', 'должность из приглашения';
  assert r->'me'->'permissions' = '["tasks.create"]'::jsonb, 'права закупщика: ' || (r->'me'->'permissions')::text;
  assert jsonb_array_length(r->'invites') = 0 and jsonb_array_length(r->'audit') = 0, 'приглашения и журнал закупщику не видны';
  for m in select * from jsonb_array_elements(r->'members') loop
    assert m->>'phone' is null and m->>'email' is null, 'телефоны и почты сотрудников закупщику не видны';
  end loop;
  raise notice '   ✓ сотрудник видит свою роль, отдел и должность; контакты, приглашения и журнал — нет';

  perform t.err(format('select public.team_invite_new(%L, %L, null, null, null)', W, 'assistant'), 'forbidden');
  perform t.err(format('select public.team_member_update(%L, %L, %L, null, null, null)', W, '00000000-0000-0000-0000-0000000000b3', 'manager'), 'forbidden');
  perform t.err(format('select public.team_role_save(%L, null, %L, array[%L])', W, 'Хак', 'team.manage'), 'forbidden');
  perform t.err(format('select public.team_department_save(%L, null, %L, null, null)', W, 'Свой отдел'), 'forbidden');
  perform t.err(format('select public.team_deactivate(%L, %L)', W, '00000000-0000-0000-0000-0000000000b4'), 'forbidden');
  raise notice '   ✓ без права «команда» нельзя приглашать, менять роли, отделы и отключать';

  -- доступ к заказам — как у помощника из файла 18: видит заказы своего кабинета, удалить не может, чужие не видит
  select count(*) into n from public.orders where workspace_id = W;
  assert n = 1, 'сотрудник видит заказы своего кабинета';
  select count(*) into n from public.orders where workspace_id = '00000000-0000-0000-0000-00000000aa07';
  assert n = 0, 'чужой кабинет не виден';
  delete from public.orders where workspace_id = W;
  get diagnostics n = row_count;
  assert n = 0, 'сотрудник не может удалять заказы';
  raise notice '   ✓ заказы: свой кабинет виден, чужой — нет, удалять нельзя (как раньше у помощника)';
end $$;

-- менеджер с правом «команда»: зовёт и меняет сотрудников, но не выдаёт права «команда» и не трогает себя и владельца
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  M text := '00000000-0000-0000-0000-0000000000b2';
begin
  perform t.u(M);
  perform t.err(format('select public.team_member_update(%L, %L, %L, null, null, null)', W, M, 'manager'), 'forbidden');
  perform t.err(format('select public.team_member_update(%L, %L, null, null, %L, null)', W, '00000000-0000-0000-0000-0000000000b1', 'Директор'), 'forbidden');
  perform t.err(format('select public.team_member_update(%L, %L, %L, null, null, null)', W, '00000000-0000-0000-0000-0000000000b4', 'manager'), 'role_not_allowed');
  -- структура: логист подчиняется контролёру, контролёр — менеджеру; круг не даётся
  perform public.team_member_update(W, '00000000-0000-0000-0000-0000000000b4', 'qc', current_setting('t.d_qc')::uuid, 'Старший контролёр', M::uuid);
  perform public.team_member_update(W, '00000000-0000-0000-0000-0000000000b5', 'logistics', current_setting('t.d_log')::uuid, null, '00000000-0000-0000-0000-0000000000b4');
  perform t.err(format('select public.team_member_update(%L, %L, %L, null, null, %L)', W, '00000000-0000-0000-0000-0000000000b4', 'qc', '00000000-0000-0000-0000-0000000000b5'), 'manager_cycle');
  -- отделы: вложенность без кругов
  perform public.team_department_save(W, current_setting('t.d_qc')::uuid, 'Контроль качества', current_setting('t.d_src')::uuid, '00000000-0000-0000-0000-0000000000b4');
  perform t.err(format('select public.team_department_save(%L, %L, %L, %L, null)', W, current_setting('t.d_src'), 'Закупки', current_setting('t.d_qc')), 'department_cycle');
  raise notice '   ✓ менеджер зовёт и настраивает сотрудников, но не выдаёт право «команда», не меняет себя и владельца; кругов нет';
end $$;

do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01';
begin
  perform t.u('00000000-0000-0000-0000-0000000000b6');
  assert public.team_join(current_setting('t.c_n')) = W;
  -- в команде 5 действующих помощников (старый, менеджер, закупщик, контролёр, логист — 5) + новичок = 6? нет: лимит 5
  raise exception 'лимит не сработал';
exception when others then
  if sqlerrm !~ 'team_full' then raise; end if;
  raise notice '   ✓ лимит команды: не больше 5 действующих помощников';
end $$;

-- владелец отключает старого помощника — место освобождается, новичок входит
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  r := public.team_deactivate(W, '00000000-0000-0000-0000-0000000000b8', null, 'Уволился');
  perform t.u('00000000-0000-0000-0000-0000000000b6');
  assert public.team_join(current_setting('t.c_n')) = W, 'новичок вошёл после отключения старого помощника';
  r := public.team_overview(W);
  assert r->'me'->>'role_key' = 'sourcing', 'роль новичка из приглашения менеджера';
  raise notice '   ✓ отключённый не занимает место; новичок принят с ролью от менеджера';
end $$;

-- старые функции файла 18 продолжают работать (вкладка со старым сайтом)
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; r jsonb; c text;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  r := public.team_list(W);
  assert jsonb_array_length(r->'members') >= 6, 'team_list по-прежнему отдаёт команду';
  perform t.err(format('select public.team_invite_create(%L)', W), 'team_full');
  raise notice '   ✓ старые team_list и team_invite_create работают (и соблюдают лимит)';
end $$;

-- ===== Сценарий 2: задача — постановка, чек-лист, сдача, возврат, принятие =====
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  M uuid := '00000000-0000-0000-0000-0000000000b2';
  S uuid := '00000000-0000-0000-0000-0000000000b3';
  Q uuid := '00000000-0000-0000-0000-0000000000b4';
  L uuid := '00000000-0000-0000-0000-0000000000b5';
  tid uuid; r jsonb; it jsonb; n int;
begin
  perform t.u(M::text);
  tid := public.task_create(W, 'Найти поставщика кроссовок', 'Нужно 3 варианта', S, Q, now() + interval '2 days', 'high',
                            current_setting('t.d_src')::uuid, array['Сравнить цены', 'Запросить фото образца', '  ']);
  perform set_config('t.task1', tid::text, false);
  r := public.task_get(tid);
  assert (r->>'number')::int = 1 and r->>'status' = 'todo' and (r->>'items_total')::int = 2, 'задача создана: ' || r::text;
  perform t.err(format('select public.task_create(%L, %L, null, %L, %L, null, null, null)', W, 'x', S, S), 'bad_reviewer');
  perform t.err(format('select public.task_create(%L, %L, null, %L, null, null, %L, null)', W, 'x', S, 'супер'), 'bad_priority');
  perform t.err(format('select public.task_create(%L, %L, null, %L, null, null, null, null)', W, 'x', '00000000-0000-0000-0000-0000000000b7'), 'bad_assignee');

  perform t.u(S::text);
  r := public.task_list(W, 'mine');
  assert jsonb_array_length(r) = 1 and r->0->>'id' = tid::text, 'исполнитель видит задачу у себя';
  assert (public.task_counts(W)->>'unread')::int = 1, 'исполнителю пришло уведомление';
  assert (public.team_notif_list(W)->0->>'kind') = 'assigned', 'уведомление «назначена»';

  perform t.u(L::text);
  assert jsonb_array_length(public.task_list(W, 'all')) = 0, 'посторонний сотрудник задачу не видит';
  perform t.err(format('select public.task_get(%L)', tid), 'task_not_found');
  perform t.err(format('select public.task_comment_add(%L, %L)', tid, 'привет'), 'task_not_found');

  perform t.u(S::text);
  perform t.err(format('select public.task_set_status(%L, %L)', tid, 'submitted'), 'checklist_incomplete');
  perform t.err(format('select public.task_set_status(%L, %L)', tid, 'done'), 'review_required');
  perform t.err(format('select public.task_set_status(%L, %L)', tid, 'blocked'), 'note_required');
  assert public.task_set_status(tid, 'in_progress') = 'in_progress';
  for it in select * from jsonb_array_elements(public.task_get(tid)->'items') loop
    perform public.task_item_toggle((it->>'id')::uuid, true);
  end loop;
  perform t.err(format('select public.task_item_delete(%L)', (public.task_get(tid)->'items'->0->>'id')), 'forbidden');
  assert public.task_set_status(tid, 'submitted') = 'submitted';
  perform t.err(format('select public.task_item_toggle(%L, false)', (public.task_get(tid)->'items'->0->>'id')), 'task_locked');
  perform t.err(format('select public.task_review(%L, true)', tid), 'forbidden');
  raise notice '   ✓ исполнитель: без отмеченного чек-листа сдать нельзя; сдал на проверку; сам себя не принимает';

  perform t.u(Q::text);
  assert (public.task_counts(W)->>'review')::int = 1, 'у проверяющего одна задача на проверке';
  perform t.err(format('select public.task_review(%L, false)', tid), 'note_required');
  assert public.task_review(tid, false, 'Нет фото образца') = 'in_progress';

  perform t.u(S::text);
  r := public.task_get(tid);
  assert r->>'status' = 'in_progress' and (r->>'comments')::int = 1, 'возврат с причиной в комментариях';
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'rejected' and x->>'note' = 'Нет фото образца'), 'уведомление «вернули» с причиной';
  perform public.task_comment_add(tid, 'Фото добавил');
  assert public.task_set_status(tid, 'submitted') = 'submitted';

  perform t.u(Q::text);
  assert public.task_review(tid, true, null) = 'done';
  r := public.task_get(tid);
  assert r->>'status' = 'done' and r->>'completed_by' = Q::text and r->>'completed_at' is not null, 'принята проверяющим';
  select count(*) into n from jsonb_array_elements(r->'events');
  assert n >= 8, 'история задачи записана: ' || n;

  perform t.u(M::text);
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'done'), 'автору пришло «выполнена»';
  perform t.err(format('select public.task_update(%L, %L, null, null, null, null)', tid, 'новое'), 'task_closed');
  perform t.err(format('select public.task_set_status(%L, %L)', tid, 'in_progress'), 'note_required');
  assert public.task_set_status(tid, 'in_progress', 'Поставщик поднял цену') = 'in_progress';
  assert public.task_set_status(tid, 'cancelled', 'Заказ отменён') = 'cancelled';
  raise notice '   ✓ проверяющий вернул с причиной, затем принял; автор видит итог, может переоткрыть и отменить';

  -- уведомления: отметить прочитанными свои
  perform t.u(S::text);
  assert public.team_notif_read(W, null) >= 1;
  assert (public.task_counts(W)->>'unread')::int = 0, 'все прочитаны';
  raise notice '   ✓ уведомления отмечаются прочитанными';
end $$;

-- права ставить задачи: роль без прав — только себе
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  k text; tid uuid;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  k := public.team_role_save(W, null, 'Стажёр', array[]::text[]);
  perform public.team_member_update(W, '00000000-0000-0000-0000-0000000000b6', k, null, 'Стажёр', null);
  perform t.err(format('select public.team_role_delete(%L, %L)', W, k), 'role_in_use');
  perform t.err(format('select public.team_role_delete(%L, %L)', W, 'manager'), 'system_role');
  perform t.err(format('select public.team_role_save(%L, null, %L, array[%L])', W, 'x', 'orders.delete'), 'bad_permissions');

  perform t.u('00000000-0000-0000-0000-0000000000b6');
  perform t.err(format('select public.task_create(%L, %L, null, %L, null, null, null, null)', W, 'Задача закупщику', '00000000-0000-0000-0000-0000000000b3'), 'forbidden');
  tid := public.task_create(W, 'Моя личная задача', null, '00000000-0000-0000-0000-0000000000b6', null, null, null, null);
  assert public.task_set_status(tid, 'done') = 'done', 'задача без проверяющего закрывается исполнителем';
  raise notice '   ✓ своя роль владельца; без tasks.create — только задачи себе; роли в работе и готовые не удаляются';
end $$;

-- пустой проверяющий или исполнитель не должен открывать задачу посторонним (NULL в проверке прав)
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  t1 uuid; t2 uuid;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  t1 := public.task_create(W, 'Без проверяющего', null, '00000000-0000-0000-0000-0000000000b3', null, null, null, null, array['пункт']);
  t2 := public.task_create(W, 'Без исполнителя', null, null, null, null, null, null, array['пункт']);
  perform t.u('00000000-0000-0000-0000-0000000000b5');   -- логист: ни при чём
  perform t.err(format('select public.task_get(%L)', t1), 'task_not_found');
  perform t.err(format('select public.task_get(%L)', t2), 'task_not_found');
  perform t.err(format('select public.task_set_status(%L, %L)', t2, 'in_progress'), 'task_not_found');
  perform t.err(format('select public.task_comment_add(%L, %L)', t1, 'x'), 'task_not_found');
  perform t.err(format('select public.task_item_add(%L, %L)', t2, 'x'), 'task_not_found');
  -- закупщик видит свою задачу без проверяющего, но чужую без исполнителя менять не может
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  assert public.task_get(t1)->>'id' = t1::text;
  perform t.err(format('select public.task_set_status(%L, %L)', t2, 'in_progress'), 'task_not_found');
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  perform public.task_set_status(t1, 'cancelled', 'тест');
  perform public.task_set_status(t2, 'cancelled', 'тест');
  raise notice '   ✓ задача без проверяющего или исполнителя не открывается и не меняется посторонними';
end $$;

-- ===== Сценарий 5: уход сотрудника =====
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  M uuid := '00000000-0000-0000-0000-0000000000b2';
  S uuid := '00000000-0000-0000-0000-0000000000b3';
  Q uuid := '00000000-0000-0000-0000-0000000000b4';
  L uuid := '00000000-0000-0000-0000-0000000000b5';
  t1 uuid; t2 uuid; r jsonb;
begin
  perform t.u(M::text);
  t1 := public.task_create(W, 'Отгрузка партии', null, S, Q, null, 'urgent', null, null);   -- закупщик исполняет
  t2 := public.task_create(W, 'Проверить упаковку', null, Q, S, null, null, null, null);    -- закупщик проверяет
  perform t.u(S::text);
  perform public.task_set_status(t1, 'in_progress');
  perform public.task_comment_add(t1, 'Начал');

  perform t.u(M::text);
  perform t.err(format('select public.team_deactivate(%L, %L)', W, M), 'cannot_deactivate_self');
  perform t.err(format('select public.team_deactivate(%L, %L)', W, '00000000-0000-0000-0000-0000000000b1'), 'not_staff');
  perform t.err(format('select public.team_deactivate(%L, %L, %L)', W, S, S), 'bad_reassign');
  r := public.team_deactivate(W, S, L, 'Ушёл из компании');
  assert (r->>'moved')::int = 2, 'передано 2 задачи: ' || r::text;

  r := public.task_get(t1);
  assert r->>'assignee_id' = L::text and r->>'status' = 'todo', 'задача исполнителя перешла логисту и стала «новой»';
  assert exists (select 1 from jsonb_array_elements(r->'comment_list') c where c->>'author_id' = S::text), 'комментарий ушедшего сохранён';
  assert exists (select 1 from jsonb_array_elements(r->'events') e where e->>'kind' = 'handover'), 'передача записана в историю';
  r := public.task_get(t2);
  assert r->>'reviewer_id' = L::text, 'проверка тоже перешла логисту';

  r := public.team_overview(W);
  assert exists (select 1 from jsonb_array_elements(r->'members') mm where mm->>'user_id' = S::text and (mm->>'active')::boolean = false and mm->>'deactivation_note' = 'Ушёл из компании'), 'отключённый виден менеджеру как отключённый';
  assert exists (select 1 from jsonb_array_elements(r->'audit') a where a->>'action' = 'member.deactivate'), 'отключение записано в журнал';

  perform t.u(L::text);
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'handover'), 'новому исполнителю пришло уведомление';
  r := public.team_overview(W);
  assert not exists (select 1 from jsonb_array_elements(r->'members') mm where mm->>'user_id' = S::text), 'обычный сотрудник не видит отключённых';

  -- ушедший: доступа нет ни к чему
  perform t.u(S::text);
  assert not public.is_member(W), 'ушедший больше не участник';
  assert (select count(*) from public.orders) = 0, 'заказы ушедшему не видны';
  assert (select count(*) from public.workspace_members where workspace_id = W) = 1, 'ушедший видит только свою строку участия';
  perform t.err(format('select public.team_overview(%L)', W), 'forbidden');
  perform t.err(format('select public.task_list(%L)', W), 'forbidden');
  perform t.err(format('select public.task_get(%L)', t1), 'task_not_found');
  perform t.err(format('select public.task_comment_add(%L, %L)', t1, 'я ещё тут'), 'task_not_found');
  raise notice '   ✓ ушедший: доступ к кабинету, заказам и задачам закрыт сразу; его комментарии и история остались';
end $$;

-- обновление заказа ушедшим не проходит (RLS: 0 строк), а заказ на месте
do $$
declare n int;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  update public.orders set client_name = 'взлом' where workspace_id = '00000000-0000-0000-0000-00000000aa01';
  get diagnostics n = row_count;
  assert n = 0, 'ушедший не может менять заказы';
end $$;

-- включить обратно и снова отключить без передачи: задачи остаются «без исполнителя», их можно назначить
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  S uuid := '00000000-0000-0000-0000-0000000000b3';
  tid uuid; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b2');   -- включить можно только отключённого
  perform t.err(format('select public.team_reactivate(%L, %L)', W, '00000000-0000-0000-0000-0000000000b2'), 'not_inactive');
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  perform public.team_reactivate(W, S);
  perform t.err(format('select public.team_reactivate(%L, %L)', W, '00000000-0000-0000-0000-0000000000b8'), 'team_full');
  perform t.u(S::text);
  assert public.is_member(W), 'включён обратно';
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  tid := public.task_create(W, 'Сверка остатков', null, S, null, null, null, null, null);
  perform public.team_deactivate(W, S, null, null);
  r := public.task_get(tid);
  assert r->>'assignee_id' is null and r->>'status' = 'todo', 'задача осталась без исполнителя';
  perform public.task_assign(tid, '00000000-0000-0000-0000-0000000000b5', null);
  perform t.err(format('select public.task_assign(%L, %L, null)', tid, S), 'bad_assignee');
  raise notice '   ✓ включение обратно; отключение без передачи оставляет задачи «без исполнителя» для назначения';
end $$;

-- вернуть ушедшего новым приглашением: та же строка, история на месте
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; c text;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  c := public.team_invite_new(W, 'logistics', null, null, null);
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  assert public.team_join(c) = W;
  assert public.is_member(W) and (public.team_overview(W)->'me'->>'role_key') = 'logistics', 'вернулся с новой ролью';
  raise notice '   ✓ повторное приглашение возвращает отключённого с новой ролью';
end $$;

reset role;

-- ===== Сценарий 6: ссылка клиента и посетитель без входа =====
do $$
declare tok text; r json;
begin
  select public_token into tok from public.orders where workspace_id = '00000000-0000-0000-0000-00000000aa01' limit 1;
  perform set_config('t.tok', tok, false);
end $$;
set role anon;
do $$
declare r text; f text;
begin
  perform t.u('');
  r := public.get_client_order(current_setting('t.tok'))::text;
  assert r is not null and r like '%Кроссовки%', 'страница клиента работает: ' || coalesce(r, 'null');
  assert r not like '%Найти поставщика%' and r not like '%Нет фото%' and r not like '%Закупщик%' and r not like '%Фабрика%',
    'на странице клиента нет задач, комментариев, сотрудников и поставщика';
  foreach f in array array['team_overview(''00000000-0000-0000-0000-00000000aa01'')', 'task_list(''00000000-0000-0000-0000-00000000aa01'')',
                           'team_notif_list(''00000000-0000-0000-0000-00000000aa01'')', 'team_perm_catalog()'] loop
    perform t.err('select public.' || f, 'permission denied');
  end loop;
  foreach f in array array['team_tasks', 'team_task_comments', 'team_task_items', 'team_task_events', 'team_notifications', 'ws_roles', 'ws_departments', 'team_audit'] loop
    perform t.err('select count(*) from public.' || f, 'permission denied');
  end loop;
  raise notice '   ✓ ссылка клиента не показывает команду; посетителю без входа таблицы и функции команды закрыты';
end $$;
reset role;

-- вошедшему пользователю таблицы напрямую тоже закрыты (только через функции с проверкой прав)
set role authenticated;
do $$
declare f text;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  foreach f in array array['team_tasks', 'team_task_comments', 'team_notifications', 'ws_roles', 'ws_departments', 'team_audit'] loop
    perform t.err('select count(*) from public.' || f, 'permission denied');
  end loop;
  perform t.err('insert into public.workspace_members (workspace_id, user_id, role) values (''00000000-0000-0000-0000-00000000aa01'', ''00000000-0000-0000-0000-0000000000b7'', ''staff'')', 'permission denied');
  perform t.err('update public.workspace_members set deactivated_at = null', 'permission denied');
  -- чужой байер не видит команду и задачи чужого кабинета
  perform t.u('00000000-0000-0000-0000-0000000000b7');
  perform t.err('select public.team_overview(''00000000-0000-0000-0000-00000000aa01'')', 'forbidden');
  perform t.err('select public.task_list(''00000000-0000-0000-0000-00000000aa01'')', 'forbidden');
  raise notice '   ✓ таблицы команды напрямую закрыты; участие нельзя изменить мимо функций; чужой кабинет закрыт';
end $$;
reset role;
SQL

echo "▶ Повторный запуск файла 68 с данными…"
before=$(echo "select count(*) || '/' || (select count(*) from public.team_task_events) || '/' || (select count(*) from public.team_notifications) from public.team_tasks;" | q -t -A)
q < migration_68_team_tasks.sql >/dev/null || { echo "❌ повторный запуск файла 68 упал"; exit 1; }
after=$(echo "select count(*) || '/' || (select count(*) from public.team_task_events) || '/' || (select count(*) from public.team_notifications) from public.team_tasks;" | q -t -A)
[ "$before" = "$after" ] || { echo "❌ Повторный запуск файла 68 изменил данные ($before → $after)"; exit 1; }
echo "   ✓ повторный запуск файла 68 ничего не меняет ($after)"

out=$(q < migration_67_team_foundation.sql 2>&1 || true)
grep -q "СТОП" <<<"$out" || { echo "❌ Файл 67 запустился поверх 68 без остановки"; exit 1; }
out=$(q < migration_66_game.sql 2>&1 || true)
grep -q "СТОП" <<<"$out" || { echo "❌ Файл 66 запустился поверх 68 без остановки"; exit 1; }
echo "   ✓ старые файлы 66 и 67 поверх 68 останавливаются"

echo "🎉 Команда и задачи (файлы 67–68) проверены"
