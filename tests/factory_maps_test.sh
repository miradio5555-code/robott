#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 73 («Карта фабрик» у каждого байера своя) на временной базе.
#
#   bash tests/factory_maps_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Чужая карта не видна и не меняется, подменить владельца нельзя, запись только от последней версии,
# неверная структура и удаление не проходят, посетителю без входа закрыто всё. Повторный запуск файла ничего не ломает.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-fmaptest-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
q() { docker exec -i "$NAME" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

q < tests/supabase_stub.sql >/dev/null
q < supabase_schema.sql >/dev/null 2>&1
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 72) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
echo "▶ Файл 73 и повторный запуск…"
q < migration_73_factory_maps.sql >/dev/null || { echo "❌ файл 73 не запустился"; exit 1; }
q < migration_73_factory_maps.sql >/dev/null || { echo "❌ повторный запуск файла 73 упал"; exit 1; }

q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'buyer1@test'), ('00000000-0000-0000-0000-0000000000d2', 'buyer2@test');
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
declare empty jsonb := '{"factories":[],"areas":[],"tasks":[],"news":[],"visits":[],"logs":[],"cities":[]}';
        n int;
begin
  -- второй байер заводит свою карту с фабрикой
  perform t.u('00000000-0000-0000-0000-0000000000d2');
  insert into public.factory_maps (data) values (jsonb_set(empty, '{factories}', '[{"id":"f1","company_cn":"义乌某某有限公司","phone":"138"}]'));
  assert (select version from public.factory_maps) = 1, 'новая карта — версия 1';

  perform t.u('00000000-0000-0000-0000-0000000000d1');
  assert (select count(*) from public.factory_maps) = 0, 'чужая карта не видна';
  update public.factory_maps set data = empty, version = version + 1 where user_id = '00000000-0000-0000-0000-0000000000d2';
  get diagnostics n = row_count;
  assert n = 0, 'чужую карту не поменять';
  perform t.err(format('insert into public.factory_maps (user_id, data) values (%L, %L)', '00000000-0000-0000-0000-0000000000d2', empty), 'row-level security|forbidden|duplicate');
  perform t.err('delete from public.factory_maps', 'permission denied');

  insert into public.factory_maps (data, version) values (empty, 99);
  assert (select version from public.factory_maps) = 1, 'версию при создании ставит база';
  perform t.err(format('insert into public.factory_maps (data) values (%L)', empty), 'duplicate');
  perform t.err(format('update public.factory_maps set data = %L, version = 1', '{"factories":{}}'), 'check|stale');
  perform t.err(format('update public.factory_maps set data = %L, version = 2', '{"factories":[]}'), 'check');
  perform t.err('update public.factory_maps set version = 5', 'stale_version');
  update public.factory_maps set data = jsonb_set(empty, '{factories}', '[{"id":"m1","company_cn":"我的工厂"}]'), version = version + 1;
  assert (select version from public.factory_maps) = 2, 'запись от последней версии прошла';
  perform t.err('update public.factory_maps set version = 2', 'stale_version');
  perform t.err(format('update public.factory_maps set user_id = %L, version = 3', '00000000-0000-0000-0000-0000000000d2'), 'forbidden|row-level security');

  perform t.u('00000000-0000-0000-0000-0000000000d2');
  assert (select data->'factories'->0->>'company_cn' from public.factory_maps) = '义乌某某有限公司', 'чужую фабрику никто не поменял';
  assert (select count(*) from public.factory_maps) = 1, 'второй байер видит только свою карту';
  raise notice '   ✓ карта фабрик: у каждого своя, чужая не видна и не меняется, запись только от последней версии';
end $$;

reset role;
set role anon;
do $$
begin
  perform t.err('select count(*) from public.factory_maps', 'permission denied');
  raise notice '   ✓ посетителю без входа карта закрыта';
end $$;

reset role;
do $$
begin
  delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
  assert (select count(*) from public.factory_maps) = 1, 'удалили аккаунт — удалена и его карта, чужая на месте';
  raise notice '   ✓ удаление аккаунта удаляет только его карту';
end $$;
SQL
echo "✅ Файл 73 проверен"
