#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ЕЖЕДНЕВНОЙ РАБОТЫ (файл 59): bash tests/daily_test.sh
# Режим в профиле, модули «Магазин»/«Обмен», часовой пояс, защита выбора клиента, права сотрудника.
# Нужен Docker Desktop и Node. Временная база; настоящая база не затрагивается.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-daily-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }
echo "▶ Файлы 0–59 и тестовые данные…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 57) print }'); do run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
run < tests/notify_setup.sql >/dev/null
run < migration_57_notify_queue.sql >/dev/null || { echo "❌ файл 57"; exit 1; }
run < migration_58_deadlines.sql >/dev/null || { echo "❌ файл 58"; exit 1; }
run < migration_59_daily_work.sql >/dev/null || { echo "❌ файл 59"; exit 1; }
echo "▶ Повторный запуск файла 59…"
run < migration_59_daily_work.sql >/dev/null || { echo "❌ повторный запуск файла 59 упал"; exit 1; }
echo "▶ Сценарии…"
ULA_PG_CONTAINER="$NAME" node tests/daily_test.mjs
echo "🎉 Ежедневная работа (файл 59) проверена"
