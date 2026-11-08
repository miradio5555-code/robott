#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ЕДИНОГО КАБИНЕТА КЛИЕНТА (файл 60): bash tests/cabinet_test.sh
# Общая ссылка: заказы, срок, контакт байера, подписка Telegram, предоплата по валютам, адрес по общей ссылке,
# отсутствие закупочных данных и чужих сумм. Нужен Docker Desktop и Node. Временная база; настоящая не затрагивается.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-cabinet-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }
echo "▶ Файлы 0–60 и тестовые данные…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 57) print }'); do run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
run < tests/notify_setup.sql >/dev/null
for n in 57_notify_queue 58_deadlines 59_daily_work 60_client_cabinet_view; do
  run < "migration_${n}.sql" >/dev/null || { echo "❌ файл ${n}"; exit 1; }
done
echo "▶ Повторный запуск файла 60…"
run < migration_60_client_cabinet_view.sql >/dev/null || { echo "❌ повторный запуск файла 60 упал"; exit 1; }
echo "▶ Сценарии…"
ULA_PG_CONTAINER="$NAME" node tests/cabinet_test.mjs
echo "🎉 Кабинет клиента (файл 60) проверен"
