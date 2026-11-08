#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА РЕЗЕРВНОЙ КОПИИ на компьютере: bash tests/backup_selftest.sh
# Нужны Docker Desktop и Node. Всё делается во ВРЕМЕННЫХ базах и поддельном хранилище.
# Настоящий Supabase не трогается, настоящих секретов не нужно.
# Что проверяется: создание зашифрованного архива тем же скриптом, что и в GitHub, три исхода
# (создана / не настроено / ошибка), пробное восстановление в другую пустую базу и сверка данных и файлов.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ID="$$"
NET="ula-bk-net-$ID"; SRC="ula-bk-src-$ID"; DST="ula-bk-dst-$ID"
T="$(mktemp -d)"; MOCKS=""; MOCKD=""
cleanup() {
  [ -n "$MOCKS" ] && kill "$MOCKS" 2>/dev/null || true
  [ -n "$MOCKD" ] && kill "$MOCKD" 2>/dev/null || true
  docker rm -f "$SRC" "$DST" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$T"
}
trap cleanup EXIT
fail() { echo "❌ $*"; exit 1; }

docker network create "$NET" >/dev/null
for n in "$SRC" "$DST"; do
  docker run -d --name "$n" --network "$NET" -e POSTGRES_PASSWORD=test postgres:17 >/dev/null
done
for n in "$SRC" "$DST"; do
  for _ in $(seq 1 40); do docker exec "$n" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
done
sleep 2
q() { docker exec -i "$1" psql -U postgres -q -X -v ON_ERROR_STOP=1 "${@:2}"; }

echo "▶ Готовлю «рабочую» базу: все SQL-файлы проекта + пробные данные…"
q "$SRC" < tests/supabase_stub.sql >/dev/null
q "$SRC" < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | q "$SRC" >/dev/null
for f in $(ls migration_*.sql | sort); do q "$SRC" < "$f" >/dev/null 2>&1 || fail "Ошибка в $f"; done
echo "insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a','owner@example.test'), ('00000000-0000-0000-0000-0000000000b1','buyer@example.test') on conflict do nothing;" | q "$SRC" >/dev/null
q "$DST" < tests/supabase_stub.sql >/dev/null   # «новый проект»: роли, auth, storage, без наших таблиц
echo "delete from auth.users; delete from storage.buckets;" | q "$DST" >/dev/null   # в новом проекте пользователей и хранилищ ещё нет

echo "▶ Поддельное хранилище с файлами…"
mkdir -p "$T/files/order-photos/ws1/2026" "$T/files/shop"
printf 'photo-one' > "$T/files/order-photos/ws1/2026/a b.jpg"
printf 'photo-two' > "$T/files/order-photos/ws1/b.png"
printf 'shop-item' > "$T/files/shop/item.txt"
node tests/mock_storage_server.mjs "$T/files" 18911 & MOCKS=$!
node tests/mock_storage_server.mjs "$T/restored" 18912 & MOCKD=$!
sleep 1

export DB_URL="postgres://postgres:test@$SRC:5432/postgres"
export SUPABASE_URL="http://127.0.0.1:18911" SUPABASE_SERVICE_ROLE_KEY="test-service-key"
export BACKUP_PASSWORD="пароль-для-проверки-123" PG_DOCKER_ARGS="--network $NET"

echo "▶ Проверка 1: без секретов — «не настроено» (код 78), архива нет…"
set +e; env -u BACKUP_PASSWORD bash scripts/make_backup.sh "$T/out0" >"$T/log0" 2>&1; code=$?; set -e
[ "$code" = 78 ] || fail "ожидался код 78, получен $code"
grep -q "НЕ НАСТРОЕНО" "$T/log0" || fail "нет сообщения «не настроено»"
ls "$T"/out0/*.gpg >/dev/null 2>&1 && fail "архив появился без секретов"
echo "   ✓ код 78, архива нет"

echo "▶ Проверка 2: сломана строка базы — «ошибка», архива нет, пароль не в журнале…"
set +e; DB_URL="postgres://postgres:wrong-pass-XYZ@$SRC:5432/postgres" bash scripts/make_backup.sh "$T/out1" >"$T/log1" 2>&1; code=$?; set -e
[ "$code" != 0 ] && [ "$code" != 78 ] || fail "ожидалась ошибка, получен код $code"
ls "$T"/out1/*.gpg >/dev/null 2>&1 && fail "архив появился при ошибке"
grep -q "wrong-pass-XYZ" "$T/log1" && fail "пароль базы попал в журнал"
echo "   ✓ код $code, архива нет, пароль не напечатан"

echo "▶ Проверка 3: настоящая копия…"
bash scripts/make_backup.sh "$T/out" >"$T/log" 2>&1 || { cat "$T/log"; fail "копия не создалась"; }
tail -3 "$T/log"
ARC="$(ls "$T"/out/ula-*.tar.gz.gpg)"
grep -qE "пароль-для-проверки|test-service-key|:test@" "$T/log" && fail "секрет попал в журнал"
echo "   ✓ архив создан, секретов в журнале нет"

echo "▶ Проверка 4: архив зашифрован (не открывается с чужим паролем)…"
mkdir -p "$T/x" && cp "$ARC" "$T/x/a.gpg"
if printf 'чужой-пароль\n' | docker run --rm -i -v "$T/x:/x" postgres:17 gpg --batch --pinentry-mode loopback --passphrase-fd 0 -d -o /x/bad.tgz /x/a.gpg >/dev/null 2>&1; then fail "архив открылся чужим паролем"; fi
echo "   ✓ чужим паролем не открывается"

echo "▶ Проверка 5: пробное восстановление в ДРУГУЮ пустую базу…"
printf '%s\n' "$BACKUP_PASSWORD" | docker run --rm -i -v "$T/x:/x" postgres:17 gpg --batch --pinentry-mode loopback --passphrase-fd 0 -d -o /x/a.tgz /x/a.gpg
mkdir -p "$T/r" && tar -xzf "$T/x/a.tgz" -C "$T/r"
R="docker run --rm -i --network $NET -v $T/r:/r postgres:17"
D="postgres://postgres:test@$DST:5432/postgres"
q "$DST" < "$T/r/storage-buckets.sql" >/dev/null
# 1) пользователи и вход (auth); служебную таблицу версий auth новый проект уже ведёт сам
$R sh -ec 'pg_restore -l /r/database.dump | grep -v "TABLE DATA auth schema_migrations" > /tmp/list; PGOPTIONS="-c session_replication_role=replica" pg_restore -d "'"$D"'" --no-owner --no-privileges -a -n auth -L /tmp/list /r/database.dump'
$R env PGOPTIONS='-c session_replication_role=replica' pg_restore -d "$D" --no-owner --no-privileges --clean --if-exists -n public /r/database.dump
q "$DST" < "$T/r/storage-policies.sql" >/dev/null
SUPABASE_URL="http://127.0.0.1:18912" node scripts/restore_supabase_storage.mjs "$T/r/storage"

counts() { q "$1" -At -c "select 'auth.users', count(*) from auth.users union all select 'storage.buckets', count(*) from storage.buckets union all select 'policies', count(*) from pg_policies where schemaname in ('public','storage') union all select 'fn', count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' union all select t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t), false, true, '')))[1]::text::bigint from (select table_name::text t from information_schema.tables where table_schema='public' and table_type='BASE TABLE') s order by 1"; }
counts "$SRC" > "$T/c_src"; counts "$DST" > "$T/c_dst"
diff "$T/c_src" "$T/c_dst" >/dev/null || { diff "$T/c_src" "$T/c_dst" || true; fail "после восстановления данные не совпали"; }
grep -q '^auth.users|2$' "$T/c_dst" || fail "пользователи не восстановились"
echo "   ✓ пользователи, таблицы, функции и правила доступа совпадают ($(wc -l < "$T/c_dst" | tr -d ' ') показателей)"
diff -r "$T/files" "$T/restored" >/dev/null || fail "файлы после восстановления отличаются"
echo "   ✓ все файлы Storage на месте и совпадают"

echo ""
echo "🎉 Проверка копии на временных базах пройдена (настоящий Supabase не использовался)"
