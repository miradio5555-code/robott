#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА СЕРВЕРНЫХ ФУНКЦИЙ (supabase/functions) — всех, а не только общей.
#
#   bash tests/check_functions.sh
#
# Для каждой функции: файл index.ts на месте, в коде нет вшитых ключей и токенов, а если установлен Deno —
# полная проверка типов и импортов (`deno check`), как при выкладке в Supabase.
# Deno нет — честно пишет, что проверка типов НЕ выполнена (и завершается ошибкой, если задано ULA_REQUIRE_DENO=1,
# так сделано на GitHub). Ничего никуда не отправляет и функции не выкладывает.
# =====================================================
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0; checked=0; typed=0
DENO="$(command -v deno || true)"
# В корне проекта лежит package.json с короткими командами. Deno не должен принимать проект за Node-проект
# и искать пакеты в node_modules — функции Supabase берут зависимости по адресам jsr: и npm:.
export DENO_NO_PACKAGE_JSON=1

node --check supabase/functions/_shared/order_notify.js || { echo "❌ _shared/order_notify.js: ошибка синтаксиса"; fail=1; }

for dir in supabase/functions/*/; do
  name="$(basename "$dir")"
  [ "$name" = "_shared" ] && continue
  f="$dir/index.ts"
  checked=$((checked + 1))
  if [ ! -f "$f" ]; then echo "❌ $name: нет файла index.ts"; fail=1; continue; fi
  # вшитые секреты: ключи Supabase (JWT), токены Telegram-бота, ключи Google
  if grep -nE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|[0-9]{8,10}:[A-Za-z0-9_-]{35}|AIza[0-9A-Za-z_-]{35}' "$f" >/dev/null; then
    echo "❌ $name: в коде похоже на вшитый ключ или токен — секреты берутся только из Deno.env"; fail=1
  fi
  if ! grep -q 'Deno.serve' "$f"; then echo "❌ $name: нет Deno.serve — функция не запустится"; fail=1; fi
  if [ -n "$DENO" ]; then
    if out="$("$DENO" check --quiet "$f" 2>&1)"; then typed=$((typed + 1)); echo "   ✓ $name"
    else echo "❌ $name: deno check"; echo "$out" | sed -e 's/^/     /' | head -15; fail=1; fi
  else
    echo "   • $name: файл и секреты проверены, типы — нет (Deno не установлен)"
  fi
done

if [ "$fail" != 0 ]; then echo "❌ Серверные функции: есть ошибки"; exit 1; fi
if [ -z "$DENO" ]; then
  echo "⚠️  Серверные функции: $checked шт., проверка типов НЕ выполнена — установите Deno (https://deno.com) и повторите"
  [ "${ULA_REQUIRE_DENO:-0}" = "1" ] && exit 1
  exit 0
fi
echo "✅ Серверные функции: $checked шт., типы и импорты проверены ($typed из $checked)"
