#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛОВ 64 и 65 (путь заказа для клиента, обычный срок кабинета): bash tests/tracking_db_test.sh
# Поля этапа и срока, ограничения, событие «этап» в истории, смена этапа без уведомлений, публичные ответы
# без закрытых данных, изоляция кабинетов, повторный запуск и защита от старых файлов.
# Нужен Docker Desktop и Node. Временная база; настоящая не затрагивается.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-tracking-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }
echo "▶ Файлы 0–63 и тестовые данные…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 57) print }'); do run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
run < tests/notify_setup.sql >/dev/null
for n in 57_notify_queue 58_deadlines 59_daily_work 60_client_cabinet_view 61_price_and_delivery 62_whatsapp_quote_price 63_restore_45_46; do
  run < "migration_${n}.sql" >/dev/null || { echo "❌ файл ${n}"; exit 1; }
done
echo "▶ Файл 64 и его повторный запуск…"
run < migration_64_tracking_stages.sql >/dev/null || { echo "❌ файл 64 не запустился"; exit 1; }
run < migration_64_tracking_stages.sql >/dev/null || { echo "❌ повторный запуск файла 64 упал"; exit 1; }
echo "▶ Файл 65 (обычный срок кабинета) и его повторный запуск…"
run < migration_65_transit_defaults.sql >/dev/null || { echo "❌ файл 65 не запустился"; exit 1; }
run < migration_65_transit_defaults.sql >/dev/null || { echo "❌ повторный запуск файла 65 упал"; exit 1; }
echo "▶ Сценарии…"
ULA_PG_CONTAINER="$NAME" node tests/tracking_db_test.mjs
echo "🎉 Путь заказа (файлы 64 и 65) проверен"
