#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 63: bash tests/restore_45_46_test.sh
# База как рабочая (файлы 45 и 46 пропущены), затем 56→62 и 63. Видимость данных до и после должна совпасть.
# Нужен Docker Desktop. Временная база; настоящая база не затрагивается.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-restore4546-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }
ask() { run -At -c "$1" | grep -v '^SET$'; }
fail() { echo "❌ $1"; exit 1; }
A=00000000-0000-0000-0000-0000000000a1; B=00000000-0000-0000-0000-0000000000b1; D=00000000-0000-0000-0000-0000000000d1

echo "▶ База как рабочая: без файлов 45 и 46…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 57 && $2+0 != 45 && $2+0 != 46) print }'); do
  run < "$f" >/dev/null 2>&1 || fail "ошибка в $f"
done
run < tests/notify_setup.sql >/dev/null
run >/dev/null <<SQL
insert into auth.users (id, email, raw_user_meta_data) values ('$A', 'a@test.kg', '{"full_name":"Админ","phone":"+996555000444","workspace_name":"А-карго"}');
insert into public.admins (user_id) values ('$A');
update public.profiles set role = 'admin' where user_id = '$A';
SQL
for n in 57_notify_queue 58_deadlines 59_daily_work 60_client_cabinet_view 61_price_and_delivery 62_whatsapp_quote_price; do
  run < "migration_${n}.sql" >/dev/null || fail "файл ${n}"
done
[ "$(ask "select count(*) from public.schema_migrations where version in (45,46)")" = "0" ] || fail "отметки 45 и 46 должны отсутствовать"
[ "$(ask "select to_regprocedure('public.my_ws_ids()') is null")" = "t" ] || fail "my_ws_ids не должна существовать до файла 63"
WSA=$(ask "select id from public.workspaces where owner_id = '$A'")
WSB=$(ask "select id from public.workspaces where owner_id = '$B'")
[ "$(ask "select public.kyc_ok('$WSA')")" = "f" ] || fail "до файла 63 кабинет админа не должен считаться проверенным"

TABLES="orders clients order_status_history shipments shop_products suppliers workspaces workspace_members order_photos order_tg_subs exchange_requests exchange_events profiles support_messages"
snapshot() {
  for who in "$A" "$B" "$D" ""; do
    for t in $TABLES; do
      role=authenticated; [ -n "$who" ] || role=anon
      printf '%s %s ' "${who:-anon}" "$t"
      ask "set request.uid = '$who'; set role $role; select count(*) from public.$t;" 2>&1 || echo "нет доступа"
    done
  done
}
run -c "update public.profiles set is_active = false where user_id = '$D'" >/dev/null
BEFORE=$(snapshot)
grep -q "^$B orders 2$" <<<"$BEFORE" || fail "байер должен видеть 2 своих заказа"
grep -q "^$D orders 0$" <<<"$BEFORE" || fail "отключённый сотрудник не должен видеть заказы"
grep -q "^$A orders 3$" <<<"$BEFORE" || fail "админ должен видеть все 3 заказа"
grep -q "^anon orders " <<<"$BEFORE" || fail "нет данных об анониме"

echo "▶ Файл 63 и его повторный запуск…"
run < migration_63_restore_45_46.sql >/dev/null || fail "файл 63 не запустился"
AFTER=$(snapshot)
[ "$BEFORE" = "$AFTER" ] || { diff <(echo "$BEFORE") <(echo "$AFTER") || true; fail "видимость данных изменилась"; }
echo "   ✓ видимость 14 таблиц для админа, байера, отключённого сотрудника и анонима не изменилась"
APPLIED=$(ask "select string_agg(applied_at::text, ',' order by version) from public.schema_migrations where version in (45,46)")
run < migration_63_restore_45_46.sql >/dev/null || fail "повторный запуск файла 63 упал"
[ "$APPLIED" = "$(ask "select string_agg(applied_at::text, ',' order by version) from public.schema_migrations where version in (45,46)")" ] || fail "повторный запуск изменил отметки 45 и 46"
echo "   ✓ повторный запуск безопасен"

[ "$(ask "select public.kyc_ok('$WSA')")" = "t" ] || fail "кабинет админа должен считаться проверенным"
[ "$(ask "select public.kyc_ok('$WSB')")" = "f" ] || fail "обычный кабинет без проверки не должен стать проверенным"
echo "   ✓ kyc_ok: админ проверен, обычный байер нет"
[ "$(ask "select count(*) from pg_policies where schemaname = 'public' and qual like '%my_ws_ids%'")" = "12" ] || fail "быстрых правил должно быть 12"
[ "$(ask "select count(*) from public.schema_migrations where version in (45,46,63)")" = "3" ] || fail "нет отметок 45, 46, 63"
echo "   ✓ быстрые правила и отметки 45, 46, 63 на месте"
ask "set role anon; select public.my_ws_ids();" >/dev/null 2>&1 && fail "аноним не должен вызывать my_ws_ids"
echo "   ✓ аноним не может вызвать my_ws_ids"
OUT=$(run < migration_45_admin_exchange.sql 2>&1 || true); grep -q "СТОП" <<<"$OUT" || fail "старый файл 45 должен останавливаться"
echo "   ✓ старый файл 45 по-прежнему останавливается"
echo "🎉 Файл 63 проверен"
