#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 66 (игра: серия дней «Всё сделано» в профиле) на временной базе.
#
#   bash tests/game_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Настоящую базу не трогает: поднимает пустой Postgres в Docker, применяет файлы 0–66 и проверяет,
# что серию видит и меняет только сам человек, мусорные и будущие даты отбрасываются, лучший результат
# нельзя «накрутить», повторный запуск файла ничего не теряет, а файл 65 поверх 66 останавливается.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-gametest-$$"
IMAGE="${PG_IMAGE:-postgres:16-alpine}"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 1
q() { docker exec -i "$NAME" psql -U postgres -q -v ON_ERROR_STOP=1 "$@"; }

q < tests/supabase_stub.sql >/dev/null
q < supabase_schema.sql >/dev/null 2>&1
echo "insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a') on conflict do nothing;" | q >/dev/null
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 66) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done

q 2>&1 <<'SQL' | sed -e 's/^NOTICE:  //'
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'g1@test'), ('00000000-0000-0000-0000-0000000000c2', 'g2@test') on conflict do nothing;
insert into public.profiles (user_id) values ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000c2') on conflict do nothing;

set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
do $$
declare r json;
begin
  r := public.my_game_get();
  assert (r->>'best')::int = 0 and json_array_length(r->'days') = 0, 'новый профиль: серия пустая';
  raise notice '   ✓ новый профиль: серия пустая';

  -- сегодня и вчера принимаются; мусор, несуществующая дата и далёкое будущее отбрасываются
  r := public.my_game_set(array[to_char(current_date, 'YYYY-MM-DD'), to_char(current_date - 1, 'YYYY-MM-DD'), 'junk', '2026-02-31', '2099-01-01', to_char(current_date - 400, 'YYYY-MM-DD')], 2);
  assert json_array_length(r->'days') = 2, 'остались только настоящие недавние даты: ' || r::text;
  assert (r->>'best')::int = 2, 'лучший результат записан';
  raise notice '   ✓ мусор, несуществующие, будущие и слишком старые даты отброшены';

  -- второе устройство присылает другой день: даты объединяются, «999 дней подряд» не проходит
  r := public.my_game_set(array[to_char(current_date - 2, 'YYYY-MM-DD')], 999);
  assert json_array_length(r->'days') = 3, 'даты двух устройств объединены: ' || r::text;
  assert (r->>'best')::int = 3, 'лучший результат не больше числа сохранённых дней: ' || r::text;
  raise notice '   ✓ даты с двух устройств объединяются; рекорд нельзя накрутить';

  -- меньший рекорд не затирает больший
  r := public.my_game_set(array[]::text[], 1);
  assert (r->>'best')::int = 3 and json_array_length(r->'days') = 3, 'рекорд и дни не уменьшаются';
  raise notice '   ✓ рекорд и сохранённые дни не уменьшаются';

  begin perform public.my_game_set(null, 1); assert false, 'null должен отклоняться';
  exception when sqlstate '22023' then null; end;
  raise notice '   ✓ пустой запрос отклоняется';
end $$;

-- другой человек видит только свою (пустую) серию
set request.uid = '00000000-0000-0000-0000-0000000000c2';
do $$
declare r json;
begin
  r := public.my_game_get();
  assert json_array_length(r->'days') = 0 and (r->>'best')::int = 0, 'чужая серия не видна: ' || r::text;
  raise notice '   ✓ другой человек чужую серию не видит';
end $$;

-- без входа: записать нельзя
reset request.uid;
do $$
begin
  begin perform public.my_game_set(array['2026-01-01'], 1); assert false, 'без входа запись должна отклоняться';
  exception when sqlstate '42501' then null; end;
  raise notice '   ✓ без входа серия не записывается';
end $$;
reset role;
set role anon;
do $$
begin
  begin perform public.my_game_get(); assert false, 'анонимной роли функция недоступна';
  exception when insufficient_privilege then null; end;
  begin perform public.my_game_set(array['2026-01-01'], 1); assert false, 'анонимной роли функция недоступна';
  exception when insufficient_privilege then null; end;
  raise notice '   ✓ анонимной роли обе функции закрыты';
end $$;
reset role;

-- ограничение таблицы: не больше 120 дат
do $$
begin
  begin
    update public.profiles set game_days = (select array_agg(current_date - g) from generate_series(1, 121) g) where user_id = '00000000-0000-0000-0000-0000000000c2';
    assert false, 'больше 120 дат должно отклоняться';
  exception when check_violation then null; end;
  raise notice '   ✓ в профиле не больше 120 дат';
end $$;
SQL

# повторный запуск файла 66 ничего не теряет
q < migration_66_game.sql >/dev/null 2>&1 || { echo "❌ Файл 66 нельзя запустить повторно"; exit 1; }
n=$(echo "select cardinality(game_days) from public.profiles where user_id = '00000000-0000-0000-0000-0000000000c1';" | q -t -A)
[ "$n" = "3" ] || { echo "❌ После повторного запуска файла 66 серия изменилась ($n вместо 3)"; exit 1; }
echo "   ✓ повторный запуск файла 66 сохраняет серию"

# файл 65 поверх 66 останавливается
out=$(q < migration_65_transit_defaults.sql 2>&1 || true)
grep -q "СТОП" <<<"$out" || { echo "❌ Файл 65 запустился поверх 66 без остановки"; exit 1; }
echo "   ✓ файл 65 поверх 66 останавливается"

echo "🎉 Игра (файл 66) проверена"
