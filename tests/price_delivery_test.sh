#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 61 (цена для клиента и адрес заказа): bash tests/price_delivery_test.sh
# Публичные ответы без себестоимости, суммы по валютам, адрес по ссылке заказа и общей ссылке, заявка с чужим телефоном,
# объединение клиентов в обе стороны, отзыв ссылки, изоляция кабинетов, уведомления. Нужен Docker Desktop и Node.
# Временная база; настоящая не затрагивается.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-pricedel-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }
echo "▶ Файлы 0–62 и тестовые данные…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 57) print }'); do run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
run < tests/notify_setup.sql >/dev/null
for n in 57_notify_queue 58_deadlines 59_daily_work 60_client_cabinet_view 61_price_and_delivery; do
  run < "migration_${n}.sql" >/dev/null || { echo "❌ файл ${n}"; exit 1; }
done
echo "▶ Повторный запуск файла 61…"
run < migration_61_price_and_delivery.sql >/dev/null || { echo "❌ повторный запуск файла 61 упал"; exit 1; }
echo "▶ Файл 62 (WhatsApp-расчёт) и его повторный запуск…"
run < migration_62_whatsapp_quote_price.sql >/dev/null || { echo "❌ файл 62 не запустился"; exit 1; }
run < migration_62_whatsapp_quote_price.sql >/dev/null || { echo "❌ повторный запуск файла 62 упал"; exit 1; }
echo "▶ Сценарии…"
ULA_PG_CONTAINER="$NAME" node tests/price_delivery_test.mjs
echo "🎉 Цена и адрес заказа (файлы 61 и 62) проверены"
