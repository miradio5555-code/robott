#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 75 (курс юаня ULA на главной для всех) на временной базе.
#
#   bash tests/public_fx_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Гость вызывает public_fx() и получает только цифры курса: ступени, срок, время и историю за 31 день
# (плюс курс на начало периода). Заметку администратора с реквизитами — нет. Таблицы курса гостю закрыты.
# Курса нет — null. Испорченные ступени не ломают ответ. Повторный запуск файла ничего не ломает.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-pubfxtest-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
q() { docker exec -i "$NAME" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

q < tests/supabase_stub.sql >/dev/null
q < supabase_schema.sql >/dev/null 2>&1
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 74) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
echo "▶ Файл 75 и повторный запуск…"
q < migration_75_public_fx.sql >/dev/null || { echo "❌ файл 75 не запустился"; exit 1; }
q < migration_75_public_fx.sql >/dev/null || { echo "❌ повторный запуск файла 75 упал"; exit 1; }

q >/dev/null <<'SQL'
create schema t;
grant usage on schema t to anon;
create function t.err(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ОЖИДАЛАСЬ ОШИБКА «%», а запрос прошёл: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'ОЖИДАЛАСЬ%' or sqlerrm !~* p_pattern then raise exception 'ожидалось «%», получено «%» в %', p_pattern, sqlerrm, p_sql; end if;
end $$;
grant execute on function t.err(text, text) to anon;
SQL

q <<'SQL'
-- курса ещё нет
update public.platform_fx set tiers = null where id = 1;
set role anon;
do $$ begin
  assert public.public_fx() is null, 'курса нет — null';
  raise notice '   ✓ курса нет — гость получает null';
end $$;
reset role;

-- курс с заметкой-реквизитами и история (одна точка старше 31 дня — «курс на начало периода»)
alter table public.platform_fx disable trigger platform_fx_log;
update public.platform_fx set tiers = '[{"from":10000,"rate":12.4},{"from":1000,"rate":12.6}]', note = 'РЕКВИЗИТЫ 4169 0000', eta = 120, updated_at = now() where id = 1;
alter table public.platform_fx enable trigger platform_fx_log;
delete from public.platform_fx_history;
insert into public.platform_fx_history (tiers, created_at) values
  ('[{"from":1000,"rate":12.8}]', now() - interval '60 days'),
  ('[{"from":1000,"rate":12.7}]', now() - interval '40 days'),
  ('[{"from":1000,"rate":12.5}]', now() - interval '3 days'),
  ('[{"from":1000,"rate":12.6},{"from":10000,"rate":12.4}]', now() - interval '1 hour'),
  ('[]', now() - interval '30 minutes');

set role anon;
do $$
declare v jsonb := public.public_fx();
begin
  assert v->'tiers' = '[{"from":1000,"rate":12.6},{"from":10000,"rate":12.4}]'::jsonb, 'ступени по порядку: ' || (v->'tiers')::text;
  assert (v->>'eta')::int = 120 and v ? 'updated_at', 'срок и время обновления';
  assert not (v ? 'note') and position('4169' in v::text) = 0, 'реквизитов в ответе нет';
  assert jsonb_array_length(v->'hist') = 3, 'история: начало периода + 2 точки за 31 день, пустая точка отброшена: ' || (v->'hist')::text;
  assert (v->'hist'->0->>'r')::numeric = 12.7, 'курс на начало периода — последний до 31 дня';
  assert (v->'hist'->2->>'r')::numeric = 12.6, 'последняя точка — нынешний курс первой ступени';
  raise notice '   ✓ гость получает ступени, срок, время и историю — без реквизитов';
  perform t.err('select count(*) from public.platform_fx', 'permission denied');
  perform t.err('select count(*) from public.platform_fx_history', 'permission denied');
  perform t.err('select public.fx_main_rate(''[]'')', 'permission denied');
  raise notice '   ✓ таблицы курса и помощник гостю закрыты';
end $$;
SQL
echo "✅ Файл 75 проверен"
