#!/bin/bash
# =====================================================
# Копия сайта для приложения iPhone. ЕДИНСТВЕННЫЙ способ её получить — этот файл.
#
#   bash mobile/copy-web.sh           собрать копию заново в mobile/www
#   bash mobile/copy-web.sh --check   ничего не записывать: проверить, что mobile/www совпадает с сайтом
#                                     (и mobile/ios/App/App/public, если папка есть).
#                                     Код выхода: 0 — всё совпадает, 1 — mobile/www устарела, 3 — устарела только папка для Xcode
#   npm run ios:prepare               всё для сборки iPhone разом: копия, `npx cap copy ios`, проверка
#
# Цепочка: файлы сайта → mobile/www (этот файл) → mobile/ios/App/App/public (делает `npx cap copy ios`).
# Обе папки создаются заново при каждой сборке и в git не хранятся. Руками их не править.
# Приложение открывает сайт по адресу (capacitor.config.json → server.url), копия нужна для экрана
# «нет интернета» (offline.html) и как запасной вариант. Поэтому sw.js в копию не входит.
# =====================================================
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WWW="$(cd "$(dirname "$0")" && pwd)/www"
PUB="$(cd "$(dirname "$0")" && pwd)/ios/App/App/public"
MODE="${1:-sync}"

build() {   # build <папка>: собрать копию сайта в пустую папку
  local dst="$1"
  mkdir -p "$dst"
  cp "$SRC"/index.html "$SRC"/app.js "$SRC"/supabase.js "$SRC"/config.js \
     "$SRC"/i18n*.js "$SRC"/style.css "$SRC"/manifest.webmanifest \
     "$SRC"/privacy.html "$SRC"/terms.html "$SRC"/mobile/offline.html "$dst"/
  cp -R "$SRC"/js "$SRC"/img "$SRC"/fonts "$dst"/
  find "$dst" -name .DS_Store -delete
}

# Всё, что подключает index.html (скрипты, стили, картинки, шрифты), должно попасть в копию.
# Ловит случай «добавили новый файл в корень сайта, а в список выше — забыли».
complete() {   # complete <папка>
  local dst="$1" missing=0 ref
  while IFS= read -r ref; do
    ref="${ref%%\?*}"; ref="${ref%%#*}"
    # factory-map/ — отдельная страница «Карта фабрик» для администратора: открывается по адресу сайта, в копию не входит
    case "$ref" in ""|http:*|https:*|data:*|mailto:*|tel:*|sw.js|factory-map/) continue ;; esac
    if [ ! -e "$dst/$ref" ]; then echo "❌ index.html подключает $ref, а в копии для приложения его нет (добавьте в mobile/copy-web.sh)"; missing=1; fi
  done < <(grep -oE '(src|href)="[^"]+"' "$SRC/index.html" | sed -E 's/^(src|href)="//; s/"$//' | sort -u)
  return $missing
}

case "$MODE" in
  sync|"")
    rm -rf "$WWW"
    build "$WWW"
    complete "$WWW"
    echo "Готово: файлы сайта скопированы в $WWW"
    echo "Дальше для iPhone: cd mobile && npx cap copy ios"
    ;;
  --check)
    TMP="$(mktemp -d)"
    trap 'rm -rf "$TMP"' EXIT
    build "$TMP/www"
    complete "$TMP/www"
    if [ ! -d "$WWW" ]; then
      echo "❌ Копии для приложения нет (mobile/www). Запустите: bash mobile/copy-web.sh"
      exit 1
    fi
    if ! diff -rq -x .DS_Store "$TMP/www" "$WWW" >"$TMP/diff.txt" 2>&1; then
      echo "❌ mobile/www отличается от сайта. Запустите: bash mobile/copy-web.sh"
      sed -e "s#$TMP/www#сайт#g; s#$WWW#mobile/www#g; s/^/   /" "$TMP/diff.txt" | head -8
      exit 1
    fi
    echo "✅ mobile/www совпадает с сайтом"
    if [ -d "$PUB" ]; then
      # cordova.js и cordova_plugins.js добавляет Capacitor — это не файлы сайта
      if ! diff -rq -x .DS_Store -x cordova.js -x cordova_plugins.js "$TMP/www" "$PUB" >"$TMP/diff2.txt" 2>&1; then
        echo "❌ mobile/ios/App/App/public отличается от сайта. Запустите: cd mobile && npx cap copy ios"
        sed -e "s#$TMP/www#сайт#g; s#$PUB#public#g; s/^/   /" "$TMP/diff2.txt" | head -8
        exit 3   # код 3: копия сайта в порядке, устарела только папка для Xcode
      fi
      echo "✅ mobile/ios/App/App/public совпадает с сайтом"
    else
      echo "ℹ️  mobile/ios/App/App/public ещё нет — её создаст «npx cap copy ios» перед сборкой в Xcode"
    fi
    ;;
  *)
    echo "Неизвестный режим: $MODE. Используйте: bash mobile/copy-web.sh [--check]"
    exit 2
    ;;
esac
