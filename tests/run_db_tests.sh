#!/usr/bin/env bash
# =====================================================
# ТЕСТЫ БАЗЫ ULA Factory — запускать перед публикацией изменений в SQL.
#
#   bash tests/run_db_tests.sh
#
# Что делает:
#   1. Запускает временную базу Postgres в Docker (настоящую базу не трогает).
#   2. Применяет все SQL-файлы по порядку (0 → последний).
#   3. Проверяет правила безопасности (tests/db_checks.sql).
#   4. Проверяет защиту: старый файл не запускается поверх новых.
#   5. Удаляет временную базу.
# Нужен Docker Desktop.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="ula-dbtest-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶ Запускаю временную базу ($IMAGE)…"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 1

psql_run() { docker exec -i "$NAME" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

# все SQL-файлы по номеру: supabase_schema.sql = 0, migration_NN_*.sql = NN
FILES=(supabase_schema.sql $(ls migration_*.sql | sort))

echo "▶ Применяю SQL-файлы…"
psql_run < tests/supabase_stub.sql >/dev/null
for f in "${FILES[@]}"; do
  if [ "$f" = "supabase_schema.sql" ]; then
    psql_run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; psql_run < "$f"; exit 1; }
    # администратор платформы (до файла 02, который делает из него админа)
    echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | psql_run >/dev/null
  else
    psql_run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; psql_run < "$f" 2>&1 | grep -iE "error|ошибка" | head -5; exit 1; }
  fi
  echo "   ✓ $f"
done

echo "▶ Повторный запуск последнего файла (должен пройти)…"
LAST="${FILES[${#FILES[@]}-1]}"
psql_run < "$LAST" >/dev/null 2>&1 || { echo "❌ Последний файл $LAST нельзя запустить повторно"; exit 1; }
echo "   ✓ $LAST"

echo "▶ Проверка правил безопасности…"
psql_run < tests/db_checks.sql

echo "▶ Защита от запуска старого файла поверх новых…"
before=$(echo "select md5(prosrc) from pg_proc where proname = 'get_client_order';" | psql_run -t -A)
out=$(psql_run < migration_07_client_price.sql 2>&1 || true)
after=$(echo "select md5(prosrc) from pg_proc where proname = 'get_client_order';" | psql_run -t -A)
if ! grep -q "СТОП" <<<"$out"; then echo "❌ Старый файл 07 запустился без остановки"; exit 1; fi
if [ "$before" != "$after" ]; then echo "❌ Старый файл 07 изменил функцию страницы клиента"; exit 1; fi
echo "✅ 8. Старый файл останавливается и ничего не меняет"

echo ""
echo "🎉 Все проверки пройдены"
