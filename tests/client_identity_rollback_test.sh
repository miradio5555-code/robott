#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ОТКАТА ФАЙЛА 56: bash tests/client_identity_rollback_test.sh
# Во временной базе (Docker) в файл 56 нарочно вставляется ошибка в разных местах — после начала изменений.
# Ожидается: ошибка, и вся база (структуры, данные, функции, отметки миграций) в точности как до запуска.
# Затем настоящий файл 56 запускается и проходит (повтор после неудачи работает).
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-rb-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
TMP="$(mktemp -d)"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X "$@"; }

echo "▶ Файлы 0–51 и старые данные…"
run -v ON_ERROR_STOP=1 < tests/supabase_stub.sql >/dev/null
run -v ON_ERROR_STOP=1 < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run -v ON_ERROR_STOP=1 >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 56) print }'); do
  run -v ON_ERROR_STOP=1 < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }
done
run -v ON_ERROR_STOP=1 -o /dev/null < tests/client_identity_legacy.sql

fingerprint() {   # вся схема public: структуры, функции, правила, ДАННЫЕ; плюс список объектов
  docker exec "$NAME" pg_dump -U postgres --schema=public --no-owner | grep -v 'restrict ' > "$1"
  docker exec "$NAME" psql -U postgres -At -c "select 'v:' || version from public.schema_migrations order by 1" >> "$1"
  docker exec "$NAME" psql -U postgres -At -c "select 'f:' || p.oid::regprocedure::text || md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1" >> "$1"
  docker exec "$NAME" psql -U postgres -At -c "select 'c:' || table_name || '.' || column_name || ':' || data_type from information_schema.columns where table_schema = 'public' order by 1" >> "$1"
  docker exec "$NAME" psql -U postgres -At -c "select 't:' || tgrelid::regclass || '.' || tgname || ':' || tgenabled::text from pg_trigger where not tgisinternal order by 1" >> "$1"
}
fingerprint "$TMP/before.txt"
test "$(grep -c '^v:56' "$TMP/before.txt")" = 0 || { echo "❌ файл 56 уже запущен"; exit 1; }

check_fail() {   # $1 — название, $2 — файл с ошибкой, $3 — режим psql
  local name="$1" file="$2" stop="$3"
  if [ "$stop" = stop ]; then run -v ON_ERROR_STOP=1 < "$file" >/dev/null 2>&1 && { echo "❌ $name: ошибка не сработала"; exit 1; }
  else run < "$file" >/dev/null 2>&1 || true; fi
  fingerprint "$TMP/after.txt"
  if ! diff -q "$TMP/before.txt" "$TMP/after.txt" >/dev/null; then
    echo "❌ $name: база изменилась после неудачного запуска:"; diff "$TMP/before.txt" "$TMP/after.txt" | head -20; exit 1
  fi
  echo "   ✓ $name: ошибка → база в точности как до запуска"
}

python3 - "$TMP" <<'PY'
import sys
t=sys.argv[1]
s=open('migration_56_client_identity.sql',encoding='utf-8').read()
def at(marker,name):
    assert marker in s, marker
    open(f'{t}/{name}.sql','w',encoding='utf-8').write(s.replace(marker,'select 1/0;\n'+marker,1))
at('-- 2. Клиент без карточки','early')                 # почти сразу: изменены только функции
at('-- 6. Новые заказы: к какому клиенту','after_data')  # после переноса данных
at('-- 8. Разбор спорных данных','mid_funcs')           # после смены функций предоплаты
head,sep,tail=s.rpartition('commit;')
open(f'{t}/at_end.sql','w',encoding='utf-8').write(head+'select 1/0;\n'+sep+tail)
PY

echo "▶ Нарочные ошибки внутри файла 56…"
check_fail "ошибка сразу после начала"          "$TMP/early.sql"      stop
check_fail "ошибка после переноса данных"       "$TMP/after_data.sql" stop
check_fail "ошибка после смены функций"         "$TMP/mid_funcs.sql"  stop
check_fail "ошибка в самом конце (до COMMIT)"   "$TMP/at_end.sql"     stop
check_fail "то же, но psql идёт дальше по тексту" "$TMP/after_data.sql" go

echo "▶ Настоящий файл 56 после неудач…"
run -v ON_ERROR_STOP=1 -o /dev/null < migration_56_client_identity.sql 2>/dev/null
test "$(docker exec "$NAME" psql -U postgres -At -c "select count(*) from public.schema_migrations where version = 56")" = 1 || { echo "❌ отметка 56 не поставлена"; exit 1; }
test "$(docker exec "$NAME" psql -U postgres -At -c "select count(*) from public.orders where client_id is null")" = 0 || { echo "❌ остались заказы без клиента"; exit 1; }
echo "   ✓ после неудач файл проходит целиком, отметка 56 стоит"
echo "🎉 Откат файла 56 проверен: при ошибке не остаётся ничего"
