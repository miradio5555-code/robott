#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 69 (команда на заказах, этапы, задержки) на временной базе.
#
#   bash tests/order_team_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Сценарий 3: существующий заказ назначен закупщику, контролёру и логисту — каждый видит и меняет только своё,
#   а без права «все заказы» к заказам, клиентам и деньгам кабинета напрямую доступа нет.
# Сценарий 4: задержка поставщика — этап «задержан», сроки сдвинуты, состояние заказа «задержка», уведомления
#   нужным людям, корректирующее действие (задача), закрытие задержки, история.
# Плюс: прежний помощник работает как раньше; уход сотрудника передаёт его обязанности; ссылка клиента без изменений.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-ordteam-$$"
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
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 68) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done

# до файла 69: кабинет, прежний помощник и сотрудники, принятые по приглашениям (файлы 67–68), заказ с клиентом
q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner@test'), ('00000000-0000-0000-0000-0000000000b2', 'manager@test'),
  ('00000000-0000-0000-0000-0000000000b3', 'sourcing@test'), ('00000000-0000-0000-0000-0000000000b4', 'qc@test'),
  ('00000000-0000-0000-0000-0000000000b5', 'logist@test'), ('00000000-0000-0000-0000-0000000000b8', 'helper@test');
insert into public.profiles (user_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'buyer', 'Владелец'), ('00000000-0000-0000-0000-0000000000b2', 'buyer', 'Менеджер'),
  ('00000000-0000-0000-0000-0000000000b3', 'buyer', 'Закупщик'), ('00000000-0000-0000-0000-0000000000b4', 'buyer', 'Контролёр'),
  ('00000000-0000-0000-0000-0000000000b5', 'buyer', 'Логист'), ('00000000-0000-0000-0000-0000000000b8', 'buyer', 'Помощник')
on conflict (user_id) do update set role = excluded.role, full_name = excluded.full_name, is_active = true;
delete from public.workspaces w where w.owner_id::text like '00000000-0000-0000-0000-0000000000b%';
insert into public.workspaces (id, name, owner_id) values ('00000000-0000-0000-0000-00000000aa01', 'ULA команда', '00000000-0000-0000-0000-0000000000b1');
insert into public.workspace_members (workspace_id, user_id, role, role_key) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', 'owner', null),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b8', 'staff', 'assistant'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b2', 'staff', 'manager'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b3', 'staff', 'sourcing'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b4', 'staff', 'qc'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b5', 'staff', 'logistics');
insert into public.clients (id, workspace_id, name, phone, city, address)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aa01', 'Клиент Айбек', '+996700123456', 'Бишкек', 'ул. Токтогула 1');
insert into public.orders (workspace_id, client_id, client_name, client_phone, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, supplier, admin_comment)
values ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000c1', 'Клиент Айбек', '+996700123456', 'Кроссовки', 300, 95, 12, 450000, 100000, 'Фабрика Цзиньцзян', 'наценка 30%');
SQL
before_orders=$(echo "select md5(string_agg(o::text, '|' order by o.id)) from public.orders o;" | q -t -A)

echo "▶ Файл 69 и повторный запуск…"
q < migration_69_order_team.sql >/dev/null || { echo "❌ файл 69 не запустился"; exit 1; }
q < migration_69_order_team.sql >/dev/null || { echo "❌ повторный запуск файла 69 упал"; exit 1; }
after_orders=$(echo "select md5(string_agg(o::text, '|' order by o.id)) from public.orders o;" | q -t -A)
[ "$before_orders" = "$after_orders" ] || { echo "❌ Файл 69 изменил заказы"; exit 1; }
echo "   ✓ заказы после файла 69 не изменились"

q 2>&1 <<'SQL' | sed -e 's/^NOTICE:  //'
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
select set_config('t.ord', (select id::text from public.orders limit 1), false);
select set_config('t.tok', (select public_token from public.orders limit 1), false);
select set_config('t.wf', (select id::text from public.workflow_templates where is_system and workspace_id = '00000000-0000-0000-0000-00000000aa01'), false);

do $$
begin
  assert (select permissions from public.ws_roles where workspace_id = '00000000-0000-0000-0000-00000000aa01' and key = 'assistant') @> array['orders.all'], 'помощник: все заказы';
  assert (select permissions from public.ws_roles where workspace_id = '00000000-0000-0000-0000-00000000aa01' and key = 'manager') @> array['orders.all', 'orders.assign'], 'менеджер: все заказы и назначение';
  assert not (select permissions from public.ws_roles where workspace_id = '00000000-0000-0000-0000-00000000aa01' and key = 'sourcing') @> array['orders.all'], 'закупщик: только свои заказы';
  assert (select count(*) from public.workflow_templates where workspace_id = '00000000-0000-0000-0000-00000000aa01' and is_system) = 1, 'готовый шаблон';
  raise notice '   ✓ права ролей обновлены, готовый шаблон «Закупка в Китае» есть';
end $$;

set role authenticated;

-- ===== Доступ: прежний помощник — как раньше; закупщик без назначения — ничего =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; n int;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b8');
  select count(*) into n from public.orders where workspace_id = W; assert n = 1, 'помощник видит заказы';
  select count(*) into n from public.clients where workspace_id = W; assert n = 1, 'помощник видит клиентов';
  assert public.is_member(W), 'помощник — участник кабинета';

  perform t.u('00000000-0000-0000-0000-0000000000b3');
  assert not public.is_member(W) and public.team_in(W), 'закупщик: не участник кабинета, но в команде';
  select count(*) into n from public.orders;  assert n = 0, 'закупщик не видит заказы напрямую';
  select count(*) into n from public.clients; assert n = 0, 'закупщик не видит клиентов напрямую';
  select count(*) into n from public.workspaces; assert n = 0, 'закупщик не читает настройки кабинета';
  update public.orders set client_price = 1 where workspace_id = W; get diagnostics n = row_count; assert n = 0, 'закупщик не меняет заказы';
  perform t.err(format('select public.order_ops_get(%L)', current_setting('t.ord')), 'order_not_found');
  assert jsonb_array_length(public.order_ops_list(W, 'mine')) = 0, 'своих заказов пока нет';
  assert (public.my_team_workspaces()->0->>'full')::boolean = false, 'вход: кабинет с ограниченным доступом';
  assert jsonb_typeof(public.team_overview(W)) = 'object' and (public.task_counts(W)->>'full')::boolean = false, 'команда и задачи доступны';
  perform t.err(format('select public.order_ops_list(%L, %L)', W, 'attention'), 'forbidden');
  raise notice '   ✓ прежний помощник видит всё как раньше; закупщик без назначения не видит заказы, клиентов и настройки';
end $$;

-- ===== Сценарий 3: заказ назначен закупщику, контролёру и логисту =====
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  O uuid := current_setting('t.ord')::uuid;
  r jsonb; ms jsonb; n int;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b4');   -- контролёр назначать не может
  perform t.err(format('select public.order_team_set(%L, %L, %L, true)', O, '00000000-0000-0000-0000-0000000000b4', 'qc'), 'order_not_found');

  perform t.u('00000000-0000-0000-0000-0000000000b2');   -- менеджер: назначает
  perform public.order_team_set(O, '00000000-0000-0000-0000-0000000000b2', 'lead', true);
  perform public.order_team_set(O, '00000000-0000-0000-0000-0000000000b3', 'sourcing', true);
  perform public.order_team_set(O, '00000000-0000-0000-0000-0000000000b4', 'qc', true);
  perform public.order_team_set(O, '00000000-0000-0000-0000-0000000000b5', 'logistics', true);
  perform t.err(format('select public.order_team_set(%L, %L, %L, true)', O, '00000000-0000-0000-0000-0000000000b7', 'qc'), 'bad_assignee');
  assert public.order_apply_template(O, current_setting('t.wf')::uuid) = 7, '7 этапов из шаблона';
  perform t.err(format('select public.order_apply_template(%L, %L)', O, current_setting('t.wf')::uuid), 'milestones_exist');
  raise notice '   ✓ менеджер назначил ведущего, закупщика, контролёра и логиста, этапы — из шаблона (повторно без замены нельзя)';

  -- закупщик: свои поля и этапы
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  assert jsonb_array_length(public.order_ops_list(W, 'mine')) = 1, 'закупщик видит свой заказ';
  r := public.order_ops_get(O);
  assert r->>'access' = 'team' and r->'my_duties' = '["sourcing"]'::jsonb, 'доступ через команду заказа';
  assert r->'order'->>'supplier' = 'Фабрика Цзиньцзян' and (r->'order'->>'unit_price_cny')::numeric = 95, 'закупщик видит поставщика и цену закупки';
  assert not (r->'order' ?| array['client_price', 'paid_amount', 'exchange_rate', 'delivery_cost', 'admin_comment', 'client_name', 'client_phone', 'tracking_number', 'client_address']),
    'закупщик не видит денег клиента, заметок, контактов клиента и доставки: ' || (r->'order')::text;
  perform public.order_ops_fields(O, '{"supplier": "Фабрика Путянь", "supplier_wechat": "pt-shoes"}');
  perform t.err(format('select public.order_ops_fields(%L, %L)', O, '{"tracking_number": "X1"}'), 'forbidden');
  perform t.err(format('select public.order_ops_fields(%L, %L)', O, '{"client_price": 1}'), 'bad_fields');
  ms := r->'milestones';
  assert public.order_milestone_set((ms->0->>'id')::uuid, 'done') = 'done', 'свой этап выполнен';
  perform t.err(format('select public.order_milestone_set(%L, %L)', ms->3->>'id', 'done'), 'forbidden');   -- этап контроля качества
  perform t.err(format('select public.order_milestone_set(%L, %L)', ms->1->>'id', 'skipped'), 'forbidden');
  perform t.err(format('select public.order_team_set(%L, %L, %L, true)', O, '00000000-0000-0000-0000-0000000000b3', 'lead'), 'forbidden');
  raise notice '   ✓ закупщик: видит поставщика и цену закупки, меняет поставщика и свои этапы; денег клиента и чужих этапов нет';

  perform t.u('00000000-0000-0000-0000-0000000000b4');   -- контролёр
  r := public.order_ops_get(O);
  assert not (r->'order' ?| array['supplier', 'unit_price_cny', 'client_price', 'client_phone', 'tracking_number']), 'контролёр видит только общее: ' || (r->'order')::text;
  assert public.order_milestone_set((r->'milestones'->3->>'id')::uuid, 'in_progress') = 'in_progress', 'контролёр ведёт свой этап';
  perform t.err(format('select public.order_ops_fields(%L, %L)', O, '{"supplier": "x"}'), 'forbidden');

  perform t.u('00000000-0000-0000-0000-0000000000b5');   -- логист
  r := public.order_ops_get(O);
  assert r->'order'->>'client_city' = 'Бишкек' and r->'order' ? 'tracking_number', 'логист видит город и трек';
  assert not (r->'order' ?| array['supplier', 'unit_price_cny', 'client_price', 'paid_amount']), 'логист не видит поставщика и денег';
  perform public.order_ops_fields(O, '{"tracking_number": "YT123456"}');
  perform t.err(format('select public.order_ops_fields(%L, %L)', O, '{"supplier": "x"}'), 'forbidden');

  perform t.u('00000000-0000-0000-0000-0000000000b2');   -- ведущий видит контакты клиента
  r := public.order_ops_get(O);
  assert r->>'access' = 'full' and r->'order'->>'client_phone' = '+996700123456', 'ведущий (с доступом ко всем заказам) видит клиента';
  raise notice '   ✓ контролёр и логист видят и меняют только своё; ведущий видит клиента';
end $$;

reset role;
do $$
declare o public.orders;
begin
  select * into o from public.orders where id = current_setting('t.ord')::uuid;
  assert o.supplier = 'Фабрика Путянь' and o.supplier_wechat = 'pt-shoes' and o.tracking_number = 'YT123456', 'поля записаны в заказ';
  assert o.client_price = 450000 and o.paid_amount = 100000 and o.unit_price_cny = 95, 'деньги заказа не тронуты';
  assert (select count(*) from public.order_ops_events where kind = 'fields') = 2, 'каждое изменение полей записано в историю';
  raise notice '   ✓ изменения сотрудников записаны в заказ и историю; суммы не тронуты';
end $$;
set role authenticated;

-- ===== Сценарий 4: задержка поставщика =====
do $$
declare
  W uuid := '00000000-0000-0000-0000-00000000aa01';
  O uuid := current_setting('t.ord')::uuid;
  r jsonb; ms jsonb; d uuid; tk uuid; old_due timestamptz; next_due timestamptz; n int;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  ms := public.order_ops_get(O)->'milestones';
  old_due := (ms->2->>'due_at')::timestamptz; next_due := (ms->3->>'due_at')::timestamptz;
  perform t.err(format('select public.order_report_delay(%L, %L, %L, %L)', O, ms->2->>'id', 'supplier', ''), 'note_required');
  perform t.err(format('select public.order_report_delay(%L, %L, %L, %L)', O, ms->2->>'id', 'weather', 'дождь'), 'bad_category');
  d := public.order_report_delay(O, (ms->2->>'id')::uuid, 'supplier', 'Фабрика не успевает: нет подошвы', old_due + interval '5 days', true);
  perform set_config('t.delay', d::text, false);
  r := public.order_ops_get(O);
  assert r->>'state' = 'delayed', 'состояние заказа — задержка';
  assert r->'milestones'->2->>'status' = 'delayed' and (r->'milestones'->2->>'due_at')::timestamptz = old_due + interval '5 days', 'этап задержан, новый срок';
  assert (r->'milestones'->3->>'due_at')::timestamptz = next_due + interval '5 days', 'следующие этапы сдвинуты';
  assert (r->'milestones'->0->>'status') = 'done', 'выполненный этап не тронут';
  perform t.err(format('select public.order_milestone_set(%L, %L)', ms->2->>'id', 'in_progress'), 'delay_open');
  raise notice '   ✓ задержка: этап «задержан», сроки сдвинуты, заказ в состоянии «задержка»';

  -- уведомления: ведущий (менеджер) и владелец; не сам сообщивший
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'order_delay' and x->>'order_id' = O::text), 'ведущему пришло';
  assert jsonb_array_length(public.order_ops_list(W, 'attention')) = 1 and (public.task_counts(W)->>'alerts')::int = 1, 'заказ в сводке «Требует внимания»';
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'order_delay'), 'владельцу пришло';
  perform t.u('00000000-0000-0000-0000-0000000000b5');
  assert not exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'order_delay'), 'логисту (не его этап) не пришло';
  raise notice '   ✓ о задержке узнали ведущий и владелец, лишним не пришло';

  -- корректирующее действие — задача закупщику, привязанная к заказу
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  perform t.err(format('select public.order_delay_action(%L, %L, %L)', d, 'Найти другую фабрику подошвы', '00000000-0000-0000-0000-0000000000b3'), 'forbidden');
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  tk := public.order_delay_action(d, 'Найти запасную фабрику подошвы', '00000000-0000-0000-0000-0000000000b3', now() + interval '2 days');
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  r := public.task_list(W, 'mine')->0;
  assert r->>'id' = tk::text and r->>'order_id' = O::text and r->>'order_number' is not null and r->>'delay_id' = d::text, 'задача-действие у закупщика, с номером заказа';
  r := public.order_ops_get(O);
  assert jsonb_array_length(r->'delays'->0->'actions') = 1, 'действие видно в задержке';

  -- закрыть может ведущий / назначающий / сообщивший; контролёр — нет
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  perform t.err(format('select public.order_delay_resolve(%L, %L)', d, 'ok'), 'forbidden');
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  perform t.err(format('select public.order_delay_resolve(%L, %L)', d, ''), 'note_required');
  perform public.order_delay_resolve(d, 'Нашли подошву у второй фабрики, срок +5 дней подтверждён');
  r := public.order_ops_get(O);
  assert r->>'state' = 'on_track' and r->'milestones'->2->>'status' = 'in_progress' and r->'delays'->0->>'status' = 'resolved', 'задержка закрыта: заказ в графике, этап в работе';
  select count(*) into n from jsonb_array_elements(r->'events') e where e->>'kind' in ('delay.report', 'delay.action', 'delay.resolve');
  assert n = 3, 'вся история задержки записана: ' || n;
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'order_resolved'), 'сообщившему пришло «закрыта»';
  raise notice '   ✓ корректирующее действие — задача закупщику; закрыл ведущий с итогом; история и уведомления на месте';
end $$;

-- ===== Уход сотрудника: обязанности на заказе переходят =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; O uuid := current_setting('t.ord')::uuid; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b1');
  r := public.team_deactivate(W, '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b8', 'Ушёл');
  assert (r->>'moved')::int >= 2, 'переданы задача и обязанность: ' || r::text;
  r := public.order_ops_get(O);
  assert exists (select 1 from jsonb_array_elements(r->'team') x where x->>'user_id' = '00000000-0000-0000-0000-0000000000b8' and x->>'duty' = 'sourcing'), 'закупка перешла помощнику';
  assert not exists (select 1 from jsonb_array_elements(r->'team') x where x->>'user_id' = '00000000-0000-0000-0000-0000000000b3'), 'ушедшего в команде заказа нет';
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  perform t.err(format('select public.order_ops_get(%L)', O), 'order_not_found');
  perform t.err(format('select public.order_ops_list(%L)', W), 'forbidden');
  raise notice '   ✓ уход: обязанность на заказе перешла, у ушедшего доступа нет';
end $$;

-- ===== Шаблоны: свои шаги, проверка =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; id uuid;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  id := public.workflow_template_save(W, null, 'Срочная закупка', '[{"title":"Купить","duty":"sourcing","days":1},{"title":"Отправить","duty":"logistics","days":3}]');
  perform t.err(format('select public.workflow_template_save(%L, null, %L, %L)', W, 'Плохой', '[{"title":"","days":1}]'), 'bad_steps');
  perform t.err(format('select public.workflow_template_save(%L, null, %L, %L)', W, 'Плохой', '[{"title":"x","duty":"boss","days":1}]'), 'bad_steps');
  perform t.err(format('select public.workflow_template_delete(%L, %L)', W, current_setting('t.wf')), 'not_found');
  perform public.workflow_template_delete(W, id);
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  perform t.err(format('select public.workflow_template_save(%L, null, %L, %L)', W, 'X', '[{"title":"x","days":1}]'), 'forbidden');
  raise notice '   ✓ шаблоны: менеджер создаёт и удаляет свои, шаги проверяются; готовый не удаляется; контролёр не может';
end $$;
reset role;

-- ===== Ссылка клиента и посетитель =====
set role anon;
do $$
declare r text; f text;
begin
  perform t.u('');
  r := public.get_client_order(current_setting('t.tok'))::text;
  assert r like '%Кроссовки%' and r not like '%подошв%' and r not like '%Путянь%' and r not like '%Закупщик%', 'на странице клиента нет задержек, поставщика и команды';
  foreach f in array array['order_ops_get(''' || current_setting('t.ord') || ''')', 'order_ops_list(''00000000-0000-0000-0000-00000000aa01'')', 'my_team_workspaces()',
                           'workflow_templates_list(''00000000-0000-0000-0000-00000000aa01'')'] loop
    perform t.err('select public.' || f, 'permission denied');
  end loop;
  foreach f in array array['order_team', 'order_milestones', 'order_delays', 'order_ops', 'order_ops_events', 'workflow_templates'] loop
    perform t.err('select count(*) from public.' || f, 'permission denied');
  end loop;
  raise notice '   ✓ ссылка клиента без изменений; посетителю новые таблицы и функции закрыты';
end $$;
reset role;
SQL

out=$(q < migration_68_team_tasks.sql 2>&1 || true)
grep -q "СТОП" <<<"$out" || { echo "❌ Файл 68 запустился поверх 69 без остановки"; exit 1; }
echo "   ✓ файл 68 поверх 69 останавливается"
echo "🎉 Команда на заказах (файл 69) проверена"
