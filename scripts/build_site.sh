#!/bin/bash
# =====================================================
# Папка с сайтом для выкладки на ulafactory.com (Cloudflare).
#
#   bash scripts/build_site.sh        собрать заново в dist/
#   npx wrangler@4 deploy             выложить dist/ и worker/index.js (новости) на ulafactory.com (настройки — wrangler.jsonc)
# _headers — сколько браузер хранит картинки и шрифты.
#
# В папку попадают только файлы, которые открывает браузер: страницы, скрипты, стили, картинки,
# шрифты и «Карта фабрик». Файлы базы (migration_*.sql, factory-map/setup.sql), функции Supabase,
# интеграции, тесты, документы и приложение iPhone на сайт не выкладываются.
# dist/ создаётся заново при каждой сборке и в git не хранится.
# =====================================================
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="$SRC/dist"

rm -rf "$DST"
mkdir -p "$DST"
cp "$SRC"/index.html "$SRC"/app.js "$SRC"/supabase.js "$SRC"/config.js "$SRC"/sw.js \
   "$SRC"/i18n*.js "$SRC"/style.css "$SRC"/manifest.webmanifest \
   "$SRC"/privacy.html "$SRC"/terms.html "$SRC"/_headers "$DST"/
cp -R "$SRC"/js "$SRC"/img "$SRC"/fonts "$SRC"/factory-map "$DST"/
rm -f "$DST"/factory-map/setup.sql
find "$DST" -name .DS_Store -delete

# Всё, что подключают страницы, должно быть в папке: ловит «добавили файл, а в список выше — забыли».
missing=0
check() {   # check <страница> <папка страницы внутри dist>
  local page="$1" base="$2" ref
  while IFS= read -r ref; do
    ref="${ref%%\?*}"; ref="${ref%%#*}"
    case "$ref" in ""|http:*|https:*|data:*|mailto:*|tel:*|./|factory-map/) continue ;; esac
    if [ ! -e "$base/$ref" ]; then echo "❌ $page подключает $ref, а в dist его нет (добавьте в scripts/build_site.sh)"; missing=1; fi
  done < <(grep -oE '(src|href)="[^"]+"' "$SRC/$page" | sed -E 's/^(src|href)="//; s/"$//' | sort -u)
}
check index.html "$DST"
check factory-map/index.html "$DST/factory-map"
[ "$missing" = 0 ] || exit 1

size=$(find "$DST" -type f -print0 | xargs -0 stat -f %z 2>/dev/null | awk '{s+=$1} END {printf "%.1f", s/1048576}')
count=$(find "$DST" -type f | wc -l | tr -d ' ')
echo "Готово: $count файлов, $size МБ → $DST"
