#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ОЦЕНКИ ПЕРЕНОСА: bash tests/preview_56_test.sh
# Во временной базе (Docker): оценка до файла 56 должна совпасть с тем, что файл 56 потом реально сделает;
# оценка ничего не меняет; без файла 50 и после файла 56 она честно говорит «СТОП».
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-prev-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
TMP="$(mktemp -d)"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -q -X -v ON_ERROR_STOP=1 "$@"; }
q() { docker exec -i "$NAME" psql -U postgres -At -X -v ON_ERROR_STOP=1 -c "$1"; }
prev() { run -At -F '|' < scripts/preview_migration_56_readonly.sql; }

echo "▶ База без файла 50: оценка должна остановиться с понятным сообщением…"
run < tests/supabase_stub.sql >/dev/null
run < supabase_schema.sql >/dev/null 2>&1
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 < 50) print }'); do run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
out="$(prev)"
echo "$out" | grep -q "Файл 50.*СТОП" || { echo "❌ нет сообщения про файл 50:"; echo "$out"; exit 1; }
echo "$out" | grep -q "подсчёты не делались" || { echo "❌ подсчёты шли без условий"; exit 1; }
echo "   ✓ без файла 50: СТОП, подсчётов нет"

echo "▶ Файлы 50–51 и старые данные…"
for f in migration_50_client_balance.sql migration_51_business_overview.sql; do run < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
run -o /dev/null < tests/client_identity_legacy.sql
before="$(q "select md5(string_agg(t::text, '' order by t::text)) from (select * from public.orders union all select null) t" 2>/dev/null || true)"
out="$(prev)"; echo "$out" > "$TMP/prev.txt"
grep -qi "СТОП" "$TMP/prev.txt" && { echo "❌ условия не выполнены:"; cat "$TMP/prev.txt"; exit 1; }
# ничего не изменилось и в выводе нет личных данных
for bad in "Нурлан" "Айбек" "Азиз" "+996" "a1a1a1a1" "Призрак"; do grep -q -- "$bad" "$TMP/prev.txt" && { echo "❌ в оценке есть личные данные: $bad"; exit 1; }; done
echo "   ✓ оценка не содержит имён, телефонов и токенов"

get() { grep -F "$1" "$TMP/prev.txt" | grep -F "$2" | head -1 | awk -F'|' '{print $6}'; }   # $1 — раздел/показатель, $2 — уточнение
P_AMB="$(grep '2 Предоплата' "$TMP/prev.txt" | grep 'СПОРНЫХ' | awk -F'|' '{s+=$6} END {print s+0}')"
P_NONE="$(grep '2 Предоплата' "$TMP/prev.txt" | grep 'без единого клиента' | awk -F'|' '{s+=$6} END {print s+0}')"
P_OK="$(grep '2 Предоплата' "$TMP/prev.txt" | grep 'однозначных' | awk -F'|' '{s+=$6} END {print s+0}')"
C_OFF="$(grep 'БУДУТ ОТКЛЮЧЕНЫ' "$TMP/prev.txt" | awk -F'|' '{s+=$6} END {print s+0}')"
C_ON="$(grep 'продолжат работать' "$TMP/prev.txt" | awk -F'|' '{s+=$6} END {print s+0}')"
MONEY="$(grep '4 Деньги СПОРНЫЕ' "$TMP/prev.txt" | awk -F'|' '{printf "%s:%s ", $3"/"$4, $6}' | sort)"
echo "   оценка: однозначных групп $P_OK, спорных $P_AMB, без клиента $P_NONE; ссылок работает $C_ON, отключится $C_OFF"

echo "▶ Настоящий файл 56 — сравнение с оценкой…"
run -o /dev/null < migration_56_client_identity.sql 2>/dev/null
R_AMB="$(q "select count(*) from public.client_link_review where kind = 'wallet' and reason = 'ambiguous'")"
R_NONE="$(q "select count(*) from public.client_link_review where kind = 'wallet' and reason = 'no_client'")"
R_OK="$(q "select count(distinct (workspace_id, ckey)) from public.client_wallet where client_id is not null and ckey is not null")"
R_OFF="$(q "select count(*) from public.client_cabinets where client_id is null")"
R_ON="$(q "select count(*) from public.client_cabinets where client_id is not null")"
[ "$P_AMB" = "$R_AMB" ] && [ "$P_NONE" = "$R_NONE" ] && [ "$P_OK" = "$R_OK" ] || { echo "❌ группы предоплаты: оценка $P_OK/$P_AMB/$P_NONE, факт $R_OK/$R_AMB/$R_NONE"; exit 1; }
[ "$C_OFF" = "$R_OFF" ] && [ "$C_ON" = "$R_ON" ] || { echo "❌ ссылки: оценка $C_ON/$C_OFF, факт $R_ON/$R_OFF"; exit 1; }
# суммы спорных денег по кабинетам и валютам
FACT="$(q "select string_agg(r, ' ' order by r) from (select 'Кабинет ' || dense_rank() over (order by workspace_id) || '/' || currency || ':' || round(sum(amount), 2) r from public.client_wallet where client_id is null group by workspace_id, currency) z" | tr -s ' ')"
echo "   факт спорных сумм: $FACT"
echo "   оценка спорных сумм: $MONEY"
# сверка по числам: каждая «валюта:сумма» из факта есть в оценке
for pair in $(echo "$FACT" | tr ' ' '\n' | sed 's/^[^/]*\///'); do echo "$MONEY" | grep -q -- "${pair#*:}" || { echo "❌ сумма $pair не найдена в оценке"; exit 1; }; done
echo "   ✓ оценка совпала с фактом: группы, отключённые ссылки, суммы спорных денег"

echo "▶ После файла 56 оценка должна сказать «СТОП: уже запущен»…"
prev | grep -q "Файл 56 ещё не запущен|СТОП" || { echo "❌ оценка не заметила, что файл 56 уже запущен"; exit 1; }
echo "🎉 Оценка переноса проверена"
