#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ОЧЕРЕДИ УВЕДОМЛЕНИЙ (файл 57): bash tests/notify_queue_test.sh
# Нужен Docker Desktop и Node. Всё во временной базе и с поддельным Telegram: настоящие сообщения не отправляются.
#   1) файлы 0–56, «старые» заказы и подписки, файл 57;  2) проверки базы;  3) сценарии обработчика с поддельным сервисом
#   доставки (tests/notify_worker_test.mjs);  4) старая функция telegram-notify (если установлен Deno).
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-notify-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }

echo "▶ Файлы 0–56…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | run >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 57) print }'); do
  run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }
done
echo "▶ Старые заказы и подписки, затем файл 57…"
run < tests/notify_setup.sql >/dev/null
run < migration_57_notify_queue.sql >/dev/null || { echo "❌ файл 57 не запустился"; exit 1; }
# ULA_NOTIFY_WITH_54=1 — те же проверки поверх файла 58 (он заменил функции очереди: старые сценарии должны проходить без изменений)
if [ "${ULA_NOTIFY_WITH_54:-}" = "1" ]; then run < migration_58_deadlines.sql >/dev/null || { echo "❌ файл 58 не запустился"; exit 1; }; echo "   (поверх файла 58)"; fi
echo "▶ Проверки базы…"
run -P pager=off -o /dev/null < tests/notify_queue_checks.sql 2>&1 | grep -v NOTICE
if [ "${ULA_NOTIFY_WITH_54:-}" != "1" ]; then
echo "▶ Повторный запуск файла 57 ничего не ломает…"
run < migration_57_notify_queue.sql >/dev/null || { echo "❌ повторный запуск упал"; exit 1; }
fi
run -At -c "select count(*) from public.order_notify_queue" | grep -q . || exit 1

echo "▶ Сценарии обработчика с поддельным Telegram…"
ULA_PG_CONTAINER="$NAME" node tests/notify_worker_test.mjs

if command -v deno >/dev/null 2>&1; then
  echo "▶ Старая функция telegram-notify (Deno, поддельные база и Telegram)…"
  deno run --quiet --allow-read --allow-env --import-map=tests/notify_importmap.json tests/notify_legacy_test.ts
  echo "▶ Защита order-notify-worker (секрет, 503/401)…"
  deno run --quiet --allow-read --allow-env --import-map=tests/notify_importmap.json tests/notify_worker_auth_test.ts
  if grep -rlq "NOTIFY_WORKER_SECRET\|x-worker-secret" index.html app.js js sw.js; then echo "❌ секрет или имя заголовка в клиентском коде"; exit 1; fi
  echo "   ✓ в клиентском коде секрета и заголовка нет"
else
  echo "⚠ Deno не установлен: проверка старой функции telegram-notify пропущена (в GitHub Actions она выполняется)."
fi
echo "🎉 Очередь уведомлений проверена"
