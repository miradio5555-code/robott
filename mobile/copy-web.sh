#!/bin/bash
# Копирует файлы сайта в папку www, которую берёт приложение iPhone.
# Запускать после каждого изменения сайта: bash mobile/copy-web.sh
set -e
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="$(cd "$(dirname "$0")" && pwd)/www"
rm -rf "$DST" && mkdir -p "$DST"
cp "$SRC"/index.html "$SRC"/app.js "$SRC"/supabase.js "$SRC"/config.js \
   "$SRC"/i18n*.js "$SRC"/style.css "$SRC"/manifest.webmanifest \
   "$SRC"/privacy.html "$SRC"/terms.html "$DST"/
cp -R "$SRC"/js "$SRC"/img "$SRC"/fonts "$DST"/
echo "Готово: файлы сайта скопированы в $DST"
