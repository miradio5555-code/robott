#!/usr/bin/env bash
# Создаёт зашифрованную копию: база, файлы Storage, настройки хранилищ.
# Запускается из GitHub Actions (.github/workflows/backup.yml) и из tests/backup_selftest.sh.
#
#   scripts/make_backup.sh ПАПКА_ДЛЯ_АРХИВА
#
# Нужны переменные: DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BACKUP_PASSWORD.
# Необязательно: PG_IMAGE (по умолчанию postgres:17), PG_DOCKER_ARGS (например, "--network имя").
# Пароли и ключи никуда не печатаются.
#
# Коды выхода: 0 — копия создана и проверена; 78 — копирование не настроено (нет секретов);
#              любой другой — ошибка, копии нет.
set -euo pipefail

OUT_DIR="${1:?Укажите папку для архива}"
IMAGE="${PG_IMAGE:-postgres:17}"
HERE="$(cd "$(dirname "$0")" && pwd)"

missing=()
[ -n "${DB_URL:-}" ] || missing+=(SUPABASE_DB_URL)
[ -n "${SUPABASE_URL:-}" ] || missing+=(SUPABASE_URL)
[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] || missing+=(SUPABASE_SERVICE_ROLE_KEY)
[ -n "${BACKUP_PASSWORD:-}" ] || missing+=(BACKUP_PASSWORD)
if [ "${#missing[@]}" -gt 0 ]; then
  echo "КОПИРОВАНИЕ НЕ НАСТРОЕНО. Не заданы секреты: ${missing[*]}. Копия не создана." >&2
  exit 78
fi

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
WORK="$(mktemp -d)"
DAY="$(date -u +%F)"
ARCHIVE="$OUT_DIR/ula-${DAY}.tar.gz.gpg"
trap 'rm -rf "$WORK"' EXIT

read -r -a PG_ARGS <<< "${PG_DOCKER_ARGS:-}"
pg() { # pg КОМАНДА…: выполняет команду в контейнере Postgres; рабочая папка видна по тому же пути
  docker run --rm -i "${PG_ARGS[@]}" -u "$(id -u):$(id -g)" -e DB_URL -e HOME=/tmp \
    -v "$WORK:$WORK" -w "$WORK" "$IMAGE" "$@"
}
gpg_run() { # gpg есть в контейнере Postgres, поэтому отдельно ставить не нужно
  if command -v gpg >/dev/null 2>&1; then gpg "$@"; else pg gpg "$@"; fi
}

echo "1/5 Выгружаю базу (схемы public и auth)…"
pg pg_dump "$DB_URL" -Fc --no-owner --no-privileges -n public -n auth -f "$WORK/database.dump"
test -s "$WORK/database.dump"

echo "2/5 Сохраняю настройки хранилищ и их правила доступа…"
pg psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -c "
  select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %L, %L) on conflict (id) do update set name = excluded.name, public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;',
         id, name, public, file_size_limit, allowed_mime_types)
  from storage.buckets order by id" > "$WORK/storage-buckets.sql"
pg psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -c "
  select format('create policy %I on %I.%I as %s for %s to %s%s%s;',
         policyname, schemaname, tablename, lower(permissive), lower(cmd),
         array_to_string(roles, ', '),
         case when qual is not null then ' using (' || qual || ')' else '' end,
         case when with_check is not null then ' with check (' || with_check || ')' else '' end)
  from pg_policies where schemaname = 'storage' order by tablename, policyname" > "$WORK/storage-policies.sql"
# если хранилищ нет, файл пустой — это допустимо; но запрос обязан был выполниться без ошибки

echo "3/5 Скачиваю файлы из хранилищ…"
SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  node "$HERE/backup_supabase_storage.mjs" "$WORK/storage"
test -s "$WORK/storage/manifest.json"

echo "4/5 Упаковываю и шифрую (AES-256)…"
tar -C "$WORK" -czf "$WORK/ula.tar.gz" database.dump storage-buckets.sql storage-policies.sql storage
printf '%s\n' "$BACKUP_PASSWORD" | gpg_run --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
  --output "$WORK/ula.tar.gz.gpg" "$WORK/ula.tar.gz"
rm -f "$WORK/ula.tar.gz"

echo "5/5 Проверяю готовый архив: расшифровка, состав, содержимое дампа…"
VERIFY="$WORK/verify"
mkdir -p "$VERIFY"
printf '%s\n' "$BACKUP_PASSWORD" | gpg_run --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
  --decrypt --output "$VERIFY/ula.tar.gz" "$WORK/ula.tar.gz.gpg"
tar -tzf "$VERIFY/ula.tar.gz" > "$VERIFY/list.txt"
for need in database.dump storage-buckets.sql storage-policies.sql storage/manifest.json; do
  grep -qx "$need" "$VERIFY/list.txt" || { echo "В архиве нет $need. Копия не годится." >&2; exit 1; }
done
tar -xzf "$VERIFY/ula.tar.gz" -C "$VERIFY" database.dump storage/manifest.json
pg pg_restore --list "$VERIFY/database.dump" > "$VERIFY/toc.txt"
grep -q "TABLE DATA public " "$VERIFY/toc.txt" || { echo "В дампе нет данных схемы public. Копия не годится." >&2; exit 1; }
grep -q "TABLE DATA auth users " "$VERIFY/toc.txt" || { echo "В дампе нет пользователей (auth.users). Копия не годится." >&2; exit 1; }
node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (!Array.isArray(m.objects) || m.objects.length !== m.file_count) { console.error("manifest.json не сходится с числом файлов."); process.exit(1); }
  console.log("В копии: " + m.bucket_count + " хранилищ, " + m.file_count + " файлов.");
' "$VERIFY/storage/manifest.json"
# сверяем: число файлов на диске равно числу в манифесте
on_disk="$(tar -tzf "$VERIFY/ula.tar.gz" | grep -E '^storage/.+[^/]$' | grep -vc '^storage/manifest.json$' || true)"
in_manifest="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).file_count)' "$VERIFY/storage/manifest.json")"
[ "$on_disk" = "$in_manifest" ] || { echo "Файлов в архиве $on_disk, в манифесте $in_manifest. Копия не годится." >&2; exit 1; }

mv "$WORK/ula.tar.gz.gpg" "$ARCHIVE"
echo "Копия создана и проверена: $(basename "$ARCHIVE") ($(du -h "$ARCHIVE" | cut -f1))."
