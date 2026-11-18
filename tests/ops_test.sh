#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛОВ 70 и 71 (регламенты, инциденты, календарь, сводка, аналитика) на временной базе.
#
#   bash tests/ops_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Регламент: черновик не виден сотрудникам, публикация уведомляет, «прочитал» привязано к версии, правка хранит
# прежнюю версию. Инцидент: сообщает любой (только по видимому заказу), ответственный, «решён» — с причиной и решением
# и без открытых действий, закрывает только ops.manage, видимость. Календарь и сводка — только видимое и только тем,
# кому положено. Аналитика: без reports.view — только своя строка. Посетителю всё закрыто.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-opstest-$$"
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
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 69) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
echo "▶ Файлы 70, 71 и повторный запуск…"
for f in migration_70_ops_control.sql migration_71_team_analytics.sql; do
  q < "$f" >/dev/null || { echo "❌ $f не запустился"; exit 1; }
done
q < migration_71_team_analytics.sql >/dev/null || { echo "❌ повторный запуск файла 71 упал"; exit 1; }

q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner@test'), ('00000000-0000-0000-0000-0000000000b2', 'manager@test'),
  ('00000000-0000-0000-0000-0000000000b3', 'sourcing@test'), ('00000000-0000-0000-0000-0000000000b4', 'qc@test'),
  ('00000000-0000-0000-0000-0000000000b5', 'logist@test');
insert into public.profiles (user_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'buyer', 'Владелец'), ('00000000-0000-0000-0000-0000000000b2', 'buyer', 'Менеджер'),
  ('00000000-0000-0000-0000-0000000000b3', 'buyer', 'Закупщик'), ('00000000-0000-0000-0000-0000000000b4', 'buyer', 'Контролёр'),
  ('00000000-0000-0000-0000-0000000000b5', 'buyer', 'Логист')
on conflict (user_id) do update set role = excluded.role, full_name = excluded.full_name, is_active = true;
delete from public.workspaces w where w.owner_id::text like '00000000-0000-0000-0000-0000000000b%';
insert into public.workspaces (id, name, owner_id) values ('00000000-0000-0000-0000-00000000aa01', 'ULA команда', '00000000-0000-0000-0000-0000000000b1');
insert into public.workspace_members (workspace_id, user_id, role, role_key) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', 'owner', null),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b2', 'staff', 'manager'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b3', 'staff', 'sourcing'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b4', 'staff', 'qc'),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b5', 'staff', 'logistics');
insert into public.orders (workspace_id, client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price)
values ('00000000-0000-0000-0000-00000000aa01', 'Клиент', 'Сумки', 100, 50, 12, 90000);
insert into public.order_team (order_id, workspace_id, user_id, duty)
select id, workspace_id, '00000000-0000-0000-0000-0000000000b5', 'logistics' from public.orders;
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
select set_config('t.ord', (select id::text from public.orders limit 1), false);
set role authenticated;

-- ===== Регламенты =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; s uuid; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b4');   -- контролёр: нет ops.manage
  perform t.err(format('select public.sop_save(%L, null, %L, null, null, %L, %L)', W, 'x', 'y', 'draft'), 'forbidden');

  perform t.u('00000000-0000-0000-0000-0000000000b2');   -- менеджер
  s := public.sop_save(W, null, 'Приёмка товара на складе', 'Склад', 'qc', '1. Пересчитать коробки. 2. Фото маркировки.', 'draft');
  perform set_config('t.sop', s::text, false);
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  assert jsonb_array_length(public.sop_list(W)) = 0, 'черновик не виден сотруднику';
  perform t.err(format('select public.sop_get(%L)', s), 'not_found');
  perform t.err(format('select public.sop_ack(%L)', s), 'not_found');

  perform t.u('00000000-0000-0000-0000-0000000000b2');
  perform public.sop_save(W, s, 'Приёмка товара на складе', 'Склад', 'qc', '1. Пересчитать коробки. 2. Фото маркировки.', 'published');
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'sop_published'), 'о публикации пришло уведомление';
  assert (public.task_counts(W)->>'sops_unread')::int = 1, 'один непрочитанный регламент';
  assert public.sop_ack(s) = 1, 'прочитал версию 1';
  assert (public.task_counts(W)->>'sops_unread')::int = 0, 'прочитано';
  r := public.sop_get(s);
  assert jsonb_array_length(r->'versions') = 0 and jsonb_array_length(r->'acks') = 0, 'сотруднику история и отметки других не видны';

  perform t.u('00000000-0000-0000-0000-0000000000b2');
  perform public.sop_save(W, s, 'Приёмка товара на складе', 'Склад', 'qc', '1. Пересчитать коробки. 2. Фото маркировки. 3. Взвесить.', 'published');
  r := public.sop_get(s);
  assert (r->>'version')::int = 2 and jsonb_array_length(r->'versions') = 1 and r->'versions'->0->>'body' like '%2. Фото маркировки.', 'прежняя версия сохранена';
  assert exists (select 1 from jsonb_array_elements(r->'acks') a where a->>'name' = 'Контролёр' and (a->>'version')::int = 1), 'видно, что контролёр читал только версию 1';
  perform public.sop_save(W, s, 'Приёмка товара на складе', 'Склад', 'qc', '1. Пересчитать коробки. 2. Фото маркировки. 3. Взвесить.', 'published');
  assert (public.sop_get(s)->>'version')::int = 2, 'сохранение без изменений текста не создаёт версию';
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  assert (public.task_counts(W)->>'sops_unread')::int = 1, 'после новой версии снова непрочитан';
  raise notice '   ✓ регламенты: черновик скрыт, публикация с уведомлением, «прочитал» по версии, история версий, править может только ops.manage';
end $$;

-- ===== Инциденты =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; O uuid := current_setting('t.ord')::uuid; i uuid; tk uuid; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b3');   -- закупщик не в команде заказа: заказ ему не виден
  perform t.err(format('select public.incident_create(%L, %L, null, %L, %L, %L, null)', W, 'x', 'high', 'quality', O), 'order_not_found');

  perform t.u('00000000-0000-0000-0000-0000000000b5');   -- логист в команде заказа
  perform t.err(format('select public.incident_create(%L, %L, null, %L, %L, null, null)', W, 'x', 'huge', 'quality'), 'bad_severity');
  perform t.err(format('select public.incident_create(%L, %L, null, %L, %L, null, %L)', W, 'x', 'high', 'quality', '00000000-0000-0000-0000-0000000000b4'), 'forbidden');
  i := public.incident_create(W, 'Коробки промокли на складе', 'Сильный дождь, 12 коробок', 'high', 'logistics', O, null);
  perform set_config('t.inc', i::text, false);
  assert (public.incident_get(i)->>'number')::int = 1, 'номер инцидента';

  perform t.u('00000000-0000-0000-0000-0000000000b3');
  assert jsonb_array_length(public.incident_list(W, 'all')) = 0, 'закупщику (не в команде заказа) инцидент не виден';
  perform t.err(format('select public.incident_get(%L)', i), 'not_found');

  perform t.u('00000000-0000-0000-0000-0000000000b1');
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'incident_new' and x->>'incident_id' = i::text), 'владельцу пришло';
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  assert exists (select 1 from jsonb_array_elements(public.team_notif_list(W)) x where x->>'kind' = 'incident_new'), 'менеджеру пришло';
  perform public.incident_update(i, '00000000-0000-0000-0000-0000000000b4', 'critical');
  tk := public.incident_action(i, 'Пересушить и переупаковать 12 коробок', '00000000-0000-0000-0000-0000000000b5', now() + interval '1 day');

  perform t.u('00000000-0000-0000-0000-0000000000b4');   -- ответственный
  assert public.incident_set_status(i, 'investigating', 'Смотрю склад') = 'investigating';
  perform t.err(format('select public.incident_set_status(%L, %L)', i, 'resolved'), 'resolution_required');
  perform t.err(format('select public.incident_set_status(%L, %L, null, %L, %L)', i, 'resolved', 'Протекает крыша', 'Перенесли на стеллажи'), 'actions_open');
  perform t.u('00000000-0000-0000-0000-0000000000b5');
  r := public.task_list(W, 'mine')->0;
  assert r->>'incident_number' = '1' and r->>'order_id' = O::text, 'действие у логиста, связано с инцидентом и заказом';
  perform public.task_set_status(tk, 'done');
  perform t.u('00000000-0000-0000-0000-0000000000b4');
  assert public.incident_set_status(i, 'resolved', null, 'Протекает крыша склада', 'Перенесли на стеллажи, крышу чинят') = 'resolved';
  perform t.err(format('select public.incident_set_status(%L, %L)', i, 'closed'), 'forbidden');
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  assert public.incident_set_status(i, 'closed') = 'closed';
  r := public.incident_get(i);
  assert r->>'root_cause' like 'Протекает%' and r->>'closed_at' is not null and jsonb_array_length(r->'events') >= 6, 'история инцидента: ' || jsonb_array_length(r->'events');
  raise notice '   ✓ инциденты: по видимому заказу, уведомления, ответственный, действие-задача, «решён» с причиной и без открытых действий, закрывает ops.manage';
end $$;

-- ===== Календарь и сводка =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; e uuid; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  perform public.order_milestone_save(current_setting('t.ord')::uuid, null, 'Отправка карго', 'logistics', now() + interval '3 days');
  perform t.u('00000000-0000-0000-0000-0000000000b3');
  e := public.event_save(W, null, 'Планёрка по закупкам', now() + interval '1 day', now() + interval '1 day 1 hour', null);
  perform t.err(format('select public.ops_calendar(%L, now(), now() + interval %L)', W, '100 days'), 'bad_dates');
  r := public.ops_calendar(W, now() - interval '1 day', now() + interval '30 days');
  assert exists (select 1 from jsonb_array_elements(r) x where x->>'kind' = 'event'), 'событие в календаре';
  assert not exists (select 1 from jsonb_array_elements(r) x where x->>'kind' = 'milestone'), 'закупщику не виден этап чужого заказа';
  perform t.err(format('select public.ops_dashboard(%L)', W), 'forbidden');
  perform t.u('00000000-0000-0000-0000-0000000000b5');
  r := public.ops_calendar(W, now() - interval '1 day', now() + interval '30 days');
  assert exists (select 1 from jsonb_array_elements(r) x where x->>'kind' = 'milestone' and (x->>'mine')::boolean), 'логисту виден свой этап';
  perform t.err(format('select public.event_delete(%L)', e), 'forbidden');
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  r := public.ops_dashboard(W);
  assert (r->'orders'->>'open')::int = 1 and (r->'milestones'->>'due_7d')::int = 1 and (r->'sops'->>'published')::int = 1
     and jsonb_array_length(r->'workload') = 5, 'сводка: ' || r::text;
  perform public.event_delete(e);
  raise notice '   ✓ календарь — только видимое, период не больше 92 дней; сводка только с доступом ко всем заказам';
end $$;

-- ===== Аналитика =====
do $$
declare W uuid := '00000000-0000-0000-0000-00000000aa01'; r jsonb;
begin
  perform t.u('00000000-0000-0000-0000-0000000000b5');
  r := public.team_analytics(W, now() - interval '30 days', now() + interval '1 day');
  assert jsonb_array_length(r->'people') = 1 and r->'people'->0->>'name' = 'Логист' and r->'totals' = 'null'::jsonb, 'без reports.view — только своя строка';
  assert (r->'people'->0->>'tasks_done')::int = 1, 'логист выполнил 1 задачу';
  perform t.err(format('select public.team_analytics(%L, now() - interval %L, now())', W, '400 days'), 'bad_dates');
  perform t.u('00000000-0000-0000-0000-0000000000b2');
  r := public.team_analytics(W, now() - interval '30 days', now() + interval '1 day');
  assert (r->>'all')::boolean and jsonb_array_length(r->'people') = 5, 'менеджер видит всех';
  assert (r->'totals'->'tasks'->>'done')::int = 1 and (r->'totals'->'incidents'->>'count')::int = 1
     and (r->'totals'->'incidents'->'by_category'->>'logistics')::int = 1 and jsonb_array_length(r->'totals'->'weekly') >= 4, 'итоги: ' || (r->'totals')::text;
  raise notice '   ✓ аналитика: сотрудник видит только себя, reports.view — всех и итоги; период не больше года';
end $$;
reset role;

set role anon;
do $$
declare f text;
begin
  perform t.u('');
  foreach f in array array['sop_list(''00000000-0000-0000-0000-00000000aa01'')', 'incident_list(''00000000-0000-0000-0000-00000000aa01'')',
                           'ops_dashboard(''00000000-0000-0000-0000-00000000aa01'')', 'team_analytics(''00000000-0000-0000-0000-00000000aa01'', now(), now())',
                           'ops_calendar(''00000000-0000-0000-0000-00000000aa01'', now(), now())'] loop
    perform t.err('select public.' || f, 'permission denied');
  end loop;
  foreach f in array array['team_sops', 'team_sop_versions', 'team_sop_acks', 'team_incidents', 'team_incident_events', 'team_events'] loop
    perform t.err('select count(*) from public.' || f, 'permission denied');
  end loop;
  raise notice '   ✓ посетителю новые таблицы и функции закрыты';
end $$;
reset role;
SQL

out=$(q < migration_69_order_team.sql 2>&1 || true)
grep -q "СТОП" <<<"$out" || { echo "❌ Файл 69 запустился поверх 71 без остановки"; exit 1; }
echo "   ✓ файл 69 поверх 71 останавливается"
echo "🎉 Операционный контроль и аналитика (файлы 70–71) проверены"
