#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛОВ 76–77 (чат по заявке на обмен и push о сообщениях) на временной базе.
#
#   bash tests/exchange_chat_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Клиент пишет в чат по секретному номеру заявки (без входа), обменник отвечает из кабинета.
# Чужой байер и администратор (без спора) писать не могут. Пустое, слишком длинное, слишком частое — нет.
# Фото клиента — только своё «c-…» в закрытом хранилище, не больше 15; фото в чате не мешают загрузить чек.
# «Прочитано» и счётчик непрочитанных. Через 3 дня после завершения чат закрывается.
# Клиент в статусе видит сообщения, но не путь к своим закрытым фото. Повторный запуск файла ничего не ломает.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-fxchattest-$$"
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
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 75) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
echo "▶ Файл 76 и повторный запуск…"
q < migration_76_exchange_chat.sql >/dev/null || { echo "❌ файл 76 не запустился"; exit 1; }
q < migration_76_exchange_chat.sql >/dev/null || { echo "❌ повторный запуск файла 76 упал"; exit 1; }
echo "▶ Файл 77 (push о сообщениях) и повторный запуск…"
q < migration_77_exchange_chat_push.sql >/dev/null || { echo "❌ файл 77 не запустился"; exit 1; }
q < migration_77_exchange_chat_push.sql >/dev/null || { echo "❌ повторный запуск файла 77 упал"; exit 1; }

q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner@test'), ('00000000-0000-0000-0000-0000000000c1', 'other@test')
on conflict do nothing;
insert into public.profiles (user_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'buyer', 'Обменник'), ('00000000-0000-0000-0000-0000000000c1', 'buyer', 'Чужой')
on conflict (user_id) do update set role = excluded.role, full_name = excluded.full_name, is_active = true;
delete from public.workspaces w where w.owner_id::text like '00000000-0000-0000-0000-0000000000b%'
                                   or w.owner_id::text like '00000000-0000-0000-0000-0000000000c%';
insert into public.workspaces (id, name, owner_id) values
  ('00000000-0000-0000-0000-00000000aa01', 'ULA обмен', '00000000-0000-0000-0000-0000000000b1'),
  ('00000000-0000-0000-0000-00000000cc01', 'Чужой кабинет', '00000000-0000-0000-0000-0000000000c1');
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000c1', 'owner')
on conflict do nothing;
insert into public.exchange_requests (id, workspace_id, client_name, client_phone, cny, som, rate, source) values
  ('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000aa01', 'Азамат', '+996555111222', 1000, 13400, 13.4, 'shop'),
  ('00000000-0000-0000-0000-0000000f0002', '00000000-0000-0000-0000-00000000aa01', 'Старый', '+996555111333', 1000, 13400, 13.4, 'shop');
-- вторая заявка выполнена 5 дней назад — чат закрыт
update public.exchange_requests set status = 'done' where id = '00000000-0000-0000-0000-0000000f0002';
update public.exchange_requests set status_at = now() - interval '5 days' where id = '00000000-0000-0000-0000-0000000f0002';
create schema t;
grant usage on schema t to authenticated, anon;
create function t.err(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'ОЖИДАЛАСЬ ОШИБКА «%», а запрос прошёл: %', p_pattern, p_sql;
exception when others then
  if sqlerrm like 'ОЖИДАЛАСЬ%' or sqlerrm !~* p_pattern then raise exception 'ожидалось «%», получено «%» в %', p_pattern, sqlerrm, p_sql; end if;
end $$;
grant execute on function t.err(text, text) to authenticated, anon;
SQL

q 2>&1 <<'SQL' | sed -e 's/^NOTICE:  //'
\set ON_ERROR_STOP 1
-- ===== клиент (без входа) =====
set role anon;
do $$
declare rid uuid := '00000000-0000-0000-0000-0000000f0001'; id1 bigint; s json;
begin
  id1 := public.fx_chat_post(rid, '  Здравствуйте, что с моей заявкой?  ', null);
  assert id1 > 0, 'номер сообщения';
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', ''   '', null)', 'empty');
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', repeat(''а'', 1001), null)', 'too_long');
  perform t.err('select public.fx_chat_post(gen_random_uuid(), ''привет'', null)', 'request_not_found');
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0002'', ''привет'', null)', 'chat_closed');
  s := public.get_exchange_status(rid);
  assert (s->>'chat_open')::boolean, 'чат открыт';
  assert json_array_length(s->'events') = 1, 'одно сообщение';
  assert s->'events'->0->>'body' = 'Здравствуйте, что с моей заявкой?', 'текст без пробелов по краям';
  assert s->'events'->0->>'author' = 'client' and (s->'events'->0->>'id')::bigint = id1, 'автор и номер';
  assert (s->>'buyer_seen')::bigint = 0, 'обменник ещё не прочитал';
  raise notice '   ✓ клиент пишет по номеру заявки; пустое, длинное, чужое и закрытый чат — нет';
end $$;
-- фото клиента: только «c-…» своей заявки, в закрытое хранилище
do $$
declare rid text := '00000000-0000-0000-0000-0000000f0001';
begin
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/c-abcdefgh12.jpg');
  perform t.err('insert into storage.objects (bucket_id, name) values (''fx-proofs'', ''00000000-0000-0000-0000-0000000f0002/c-abcdefgh12.jpg'')', 'row-level security|policy');
  perform t.err('insert into storage.objects (bucket_id, name) values (''fx-proofs'', ''00000000-0000-0000-0000-0000000f0001/c-abc.svg'')', 'row-level security|policy');
  perform public.fx_chat_post(rid::uuid, 'Вот второй чек', rid || '/c-abcdefgh12.jpg');
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', null, ''00000000-0000-0000-0000-0000000f0001/c-nonexist123.jpg'')', 'file_not_found');
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', null, ''00000000-0000-0000-0000-0000000f0002/c-abcdefgh12.jpg'')', 'file_not_found');
  raise notice '   ✓ фото клиента: только своё «c-…» в своей заявке';
end $$;
do $$
declare rid uuid := '00000000-0000-0000-0000-0000000f0001'; s json;
begin
  s := public.get_exchange_status(rid);
  assert (s->'events'->1->>'photo')::boolean and s->'events'->1->>'file' is null, 'клиент видит отметку о фото, но не путь к закрытому файлу';
  -- чек оплаты всё ещё можно загрузить (фото чата не считаются)
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/c-abcdefgh13.jpg'), ('fx-proofs', rid || '/c-abcdefgh14.jpg');
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/pay1.jpg');
  raise notice '   ✓ фото из чата не мешают загрузить чек';
end $$;
-- слишком часто: 8 сообщений в минуту
do $$
declare rid uuid := '00000000-0000-0000-0000-0000000f0001'; i int;
begin
  for i in 1..6 loop perform public.fx_chat_post(rid, 'сообщение ' || i, null); end loop;
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', ''ещё'', null)', 'too_fast');
  raise notice '   ✓ больше 8 сообщений в минуту — нет';
end $$;
-- прямой доступ к таблицам закрыт
do $$
begin
  perform t.err('select count(*) from public.exchange_events', 'permission denied');
  perform t.err('select public.fx_chat_unread(''00000000-0000-0000-0000-00000000aa01'')', 'permission denied');
  perform t.err('select public.fx_chat_open(''new'', null, now(), now())', 'permission denied');
  raise notice '   ✓ гостю закрыты таблицы, счётчик кабинета и служебная функция';
end $$;
reset role;
-- сообщения «минуту назад» — чтобы дальше не мешал лимит частоты
update public.exchange_events set created_at = created_at - interval '2 minutes';

-- ===== чужой байер =====
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  -- чужой байер для этой заявки — «клиент» без права видеть фото: может только то же, что клиент; закрытые фото не видит
  if (select count(*) from storage.objects where bucket_id = 'fx-proofs') <> 0 then raise exception 'ПРОВАЛ: чужой байер видит фото клиента'; end if;
  if (select count(*) from public.exchange_events) <> 0 then raise exception 'ПРОВАЛ: чужой байер видит переписку'; end if;
  if public.fx_chat_unread('00000000-0000-0000-0000-00000000aa01') <> 0 then raise exception 'ПРОВАЛ: чужой байер видит счётчик'; end if;
  perform t.err('insert into storage.objects (bucket_id, name) values (''fx-sent'', ''00000000-0000-0000-0000-0000000f0001/abcdefghijklmnop.jpg'')', 'row-level security|policy');
  raise notice '   ✓ чужой байер не видит переписку, фото и счётчик, не загружает фото обменника';
end $$;
reset role;

-- ===== обменник =====
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := '00000000-0000-0000-0000-0000000f0001'; n int; id2 bigint;
begin
  n := public.fx_chat_unread('00000000-0000-0000-0000-00000000aa01');
  if n <> 8 then raise exception 'ПРОВАЛ: непрочитанных % вместо 8', n; end if;
  if (select count(*) from public.exchange_events where request_id = rid and kind = 'msg') <> 8 then raise exception 'ПРОВАЛ: обменник не видит переписку'; end if;
  insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/abcdefghijklmnop.jpg');
  id2 := public.fx_chat_post(rid, 'Оплату вижу, отправляю', rid || '/abcdefghijklmnop.jpg');
  -- ответ обменника = всё выше прочитано? нет: прочитано только то, что он открыл. Своё сообщение — прочитано.
  if (select chat_buyer_seen from public.exchange_requests where id = rid) <> id2 then raise exception 'ПРОВАЛ: своё сообщение не отмечено прочитанным'; end if;
  if public.fx_chat_unread('00000000-0000-0000-0000-00000000aa01') <> 0 then raise exception 'ПРОВАЛ: после ответа остались непрочитанные'; end if;
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', null, ''00000000-0000-0000-0000-0000000f0001/c-abcdefgh12.jpg'')', 'file_not_found');
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0002'', ''поздно'', null)', 'chat_closed');
  raise notice '   ✓ обменник видит переписку и счётчик, отвечает с фото; закрытый чат — нет';
end $$;
reset role;

-- ===== клиент видит ответ и «прочитано» =====
set role anon;
reset request.uid;
do $$
declare rid uuid := '00000000-0000-0000-0000-0000000f0001'; s json; last json; m bigint;
begin
  s := public.get_exchange_status(rid);
  last := s->'events'->(json_array_length(s->'events') - 1);
  assert last->>'author' = 'buyer' and last->>'body' = 'Оплату вижу, отправляю', 'ответ обменника виден';
  assert last->>'file' = rid || '/abcdefghijklmnop.jpg', 'клиент видит открытое фото обменника';
  assert (s->>'buyer_seen')::bigint = (last->>'id')::bigint, 'клиент видит, что обменник прочитал';
  m := public.fx_chat_seen(rid);
  assert m = (last->>'id')::bigint, 'отметка «прочитано» клиентом';
  raise notice '   ✓ клиент видит ответ, фото обменника и «прочитано»';
end $$;
reset role;
do $$
begin
  if (select chat_client_seen from public.exchange_requests where id = '00000000-0000-0000-0000-0000000f0001')
     <> (select max(id) from public.exchange_events where request_id = '00000000-0000-0000-0000-0000000f0001') then
    raise exception 'ПРОВАЛ: клиент не отметил прочитанным';
  end if;
end $$;

-- ===== администратор: только в споре =====
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
begin
  perform t.err('select public.fx_chat_post(''00000000-0000-0000-0000-0000000f0001'', ''я админ'', null)', 'chat_closed');
end $$;
reset role;
update public.exchange_requests set dispute = 'open', dispute_by = 'client', dispute_at = now() where id = '00000000-0000-0000-0000-0000000f0001';
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
begin
  if public.fx_chat_post('00000000-0000-0000-0000-0000000f0001', 'Разбираюсь', null) is null then raise exception 'ПРОВАЛ: админ не пишет в споре'; end if;
  raise notice '   ✓ администратор пишет только в споре';
end $$;
reset role;
reset request.uid;

-- ===== старые фото и лимит 15 =====
do $$
declare rid text := '00000000-0000-0000-0000-0000000f0001'; i int;
begin
  for i in 1..12 loop insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/c-zzzzzzzz' || lpad(i::text, 2, '0') || '.jpg'); end loop;
end $$;
set role anon;
do $$
begin
  perform t.err('insert into storage.objects (bucket_id, name) values (''fx-proofs'', ''00000000-0000-0000-0000-0000000f0001/c-toomany0001.jpg'')', 'row-level security|policy');
  raise notice '   ✓ больше 15 фото в чат — нет';
end $$;
reset role;
-- ===== файл 77: push о сообщении клиента забирается один раз (так делает push-notify) =====
do $$
declare n1 int; n2 int;
begin
  with x as (update public.exchange_events set push_at = now()
              where request_id = '00000000-0000-0000-0000-0000000f0001' and kind = 'msg' and author = 'client' and push_at is null
              returning 1) select count(*) into n1 from x;
  with x as (update public.exchange_events set push_at = now()
              where request_id = '00000000-0000-0000-0000-0000000f0001' and kind = 'msg' and author = 'client' and push_at is null
              returning 1) select count(*) into n2 from x;
  if n1 <> 8 or n2 <> 0 then raise exception 'ПРОВАЛ: push забирает % и затем % сообщений (нужно 8 и 0)', n1, n2; end if;
  raise notice '   ✓ push о сообщениях клиента отправляется один раз';
end $$;
set role anon;
do $$ begin perform t.err('select push_at from public.exchange_events', 'permission denied'); end $$;
reset role;
SQL
echo "✅ Файлы 76–77 проверены"
