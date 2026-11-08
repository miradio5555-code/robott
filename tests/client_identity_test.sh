#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ПЕРЕНОСА КЛИЕНТОВ (файл 56): bash tests/client_identity_test.sh
# Нужен Docker Desktop. Всё делается во временной базе: настоящая не затрагивается.
# 1) файлы 0–51 + «старые» данные с трудными случаями; 2) файл 56; 3) проверки.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-ident-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }

echo "▶ Файлы 0–51…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 56) print }'); do
  run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }
done
echo "▶ Старые данные, файл 56, проверки (одна сессия)…"
{ cat tests/client_identity_legacy.sql
  echo '\echo "   ✓ старые данные созданы"'
  cat migration_56_client_identity.sql
  echo '\echo "   ✓ файл 56 применён"'
  # в проверках строка «\i migration_52…» означает «запустить файл 56 ещё раз» (psql внутри Docker не видит файлы)
  while IFS= read -r line; do
    if [ "$line" = '\i migration_56_client_identity.sql' ]; then cat migration_56_client_identity.sql; else printf '%s\n' "$line"; fi
  done < tests/client_identity_checks.sql; } | run -P pager=off -o /dev/null
