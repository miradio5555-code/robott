#!/usr/bin/env bash
# =====================================================
# ЕДИНАЯ ПРОВЕРКА ПЕРЕД ВЫПУСКОМ ULA Factory.
#
#   npm run release:check        (то же: bash scripts/release_check.sh)
#
# По порядку: быстрые проверки сайта → база на временном Postgres (если запущен Docker) →
# экраны в Chrome (если он установлен) → копия сайта для приложения iPhone.
# Ничего не публикует, не отправляет на GitHub и рабочую Supabase не трогает.
#
# Итог в конце:
#   «ГОТОВО»        — всё выполнено и прошло;
#   «НЕ ГОТОВО»     — что-то упало (код выхода 1);
#   «НЕ ПРОВЕРЕНО»  — шаг нельзя было выполнить (нет Docker или Chrome): он НЕ считается пройденным (код выхода 2).
# =====================================================
set -uo pipefail
cd "$(dirname "$0")/.."

declare -a NAMES=() STATES=() NOTES=()
add() { NAMES+=("$1"); STATES+=("$2"); NOTES+=("${3:-}"); }
step() { echo ""; echo "━━━ $1 ━━━"; }

step "0. Что проверяем"
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
version="$(sed -n 's/.*APP_VERSION = "\([^"]*\)".*/\1/p' app.js | head -1)"
last_mig="$(ls migration_*.sql | sort | tail -1)"
last_num="$(echo "$last_mig" | sed -E 's/^migration_0*([0-9]+)_.*/\1/')"
echo "Ветка: $branch · версия сайта: $version · последний файл базы: $last_mig"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "⚠️  Есть незаписанные изменения (git status) — проверяется то, что лежит в папке, а не последний коммит"
fi

step "1. Быстрые проверки (npm run check)"
if node tests/check_all.mjs; then add "Сайт, словари, анализ, память, функции, WhatsApp" "OK"; else add "Сайт, словари, анализ, память, функции, WhatsApp" "FAIL" "npm run check"; fi

step "2. База на временном Postgres (Docker)"
if docker info >/dev/null 2>&1; then
  if bash tests/run_db_tests.sh; then add "База: файлы 0–${last_num} и правила доступа" "OK"
  else add "База: все файлы и правила доступа" "FAIL" "bash tests/run_db_tests.sh"; fi
else
  echo "Docker не запущен — SQL-файлы на настоящем Postgres НЕ проверены."
  echo "Запустите Docker Desktop, дождитесь «Engine running» и повторите."
  add "База: все файлы и правила доступа" "SKIP" "нет Docker — миграции не проверены"
fi

step "3. Экраны сайта в Chrome (поддельная база, рабочая не нужна)"
node tests/browser/smoke.mjs
rc=$?
if [ $rc = 0 ]; then add "Экраны: телефон, планшет, компьютер" "OK"
elif [ $rc = 3 ]; then add "Экраны: телефон, планшет, компьютер" "SKIP" "Chrome не найден — задайте CHROME_BIN"
else add "Экраны: телефон, планшет, компьютер" "FAIL" "npm run smoke"; fi

step "4. Копия сайта для приложения iPhone"
if bash mobile/copy-web.sh; then
  bash mobile/copy-web.sh --check
  rc=$?
  if [ $rc = 0 ]; then add "Мобильная копия совпадает с сайтом" "OK"
  elif [ $rc = 3 ]; then add "Мобильная копия совпадает с сайтом" "OK" "папка для Xcode устарела: перед сборкой iPhone — npm run ios:prepare"
  else add "Мобильная копия совпадает с сайтом" "FAIL" "bash mobile/copy-web.sh"; fi
else
  add "Мобильная копия совпадает с сайтом" "FAIL" "bash mobile/copy-web.sh"
fi

echo ""
echo "════════════════ ИТОГ ════════════════"
fail=0; skip=0
for i in "${!NAMES[@]}"; do
  case "${STATES[$i]}" in
    OK)   mark="✅ пройдено    " ;;
    FAIL) mark="❌ НЕ ПРОШЛО   "; fail=1 ;;
    SKIP) mark="⚠️  НЕ ПРОВЕРЕНО"; skip=1 ;;
  esac
  echo "$mark  ${NAMES[$i]}${NOTES[$i]:+  —  ${NOTES[$i]}}"
done
echo ""
if [ $fail = 1 ]; then echo "❌ НЕ ГОТОВО к выпуску: исправьте шаги с пометкой «НЕ ПРОШЛО»."; exit 1; fi
if [ $skip = 1 ]; then echo "⚠️  НЕ ПРОВЕРЕНО полностью: шаги с пометкой «НЕ ПРОВЕРЕНО» не выполнялись и пройденными не считаются."; exit 2; fi
echo "✅ ГОТОВО: проверки на этом компьютере пройдены (версия $version, файлы базы до ${last_mig})."
echo "   Дальше — по RELEASE_CHECKLIST.md: копия рабочей базы, диагностика, и только потом публикация."
