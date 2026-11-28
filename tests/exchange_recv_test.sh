#!/usr/bin/env bash
# =====================================================
# ПРОВЕРКА ФАЙЛА 78 (реквизиты клиента в заявке на обмен) на временной базе.
#
#   bash tests/exchange_recv_test.sh        (входит в bash tests/run_db_tests.sh)
#
# Клиент указывает в заявке, куда получить юани (Alipay / WeChat / карта), и может изменить это
# по секретному номеру заявки, пока юани не отправлены и нет открытого спора. Нужен номер или QR.
# QR — только своё «q-…» в закрытом хранилище, не больше 5; QR не мешает загрузить чек.
# Обменник видит реквизиты и QR своей заявки, менять их не может; чужой байер не видит.
# Старые вызовы submit_exchange (без реквизитов) работают. Повторный запуск файла ничего не ломает.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ula-fxrecvtest-$$"
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
for f in $(ls migration_*.sql | sort | awk -F_ '{ if ($2+0 <= 77) print }'); do q < "$f" >/dev/null 2>&1 || { echo "❌ Ошибка в $f"; exit 1; }; done
echo "▶ Файл 78 и повторный запуск…"
q < migration_78_exchange_recv.sql >/dev/null || { echo "❌ файл 78 не запустился"; exit 1; }
q < migration_78_exchange_recv.sql >/dev/null || { echo "❌ повторный запуск файла 78 упал"; exit 1; }

q >/dev/null <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'owner@test'), ('00000000-0000-0000-0000-0000000000c1', 'other@test')
on conflict do nothing;
insert into public.profiles (user_id, role, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'buyer', 'Обменник'), ('00000000-0000-0000-0000-0000000000c1', 'buyer', 'Чужой')
on conflict (user_id) do update set role = excluded.role, full_name = excluded.full_name, is_active = true;
delete from public.workspaces w where w.owner_id::text like '00000000-0000-0000-0000-0000000000b%'
                                   or w.owner_id::text like '00000000-0000-0000-0000-0000000000c%';
insert into public.workspaces (id, name, owner_id, request_token, fx_on, fx_tiers) values
  ('00000000-0000-0000-0000-00000000aa01', 'ULA обмен', '00000000-0000-0000-0000-0000000000b1',
   'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', true, '[{"from": 1000, "rate": 13.4}, {"from": 10000, "rate": 13.2}]'::jsonb),
  ('00000000-0000-0000-0000-00000000cc01', 'Чужой кабинет', '00000000-0000-0000-0000-0000000000c1', null, false, null);
insert into public.workspace_members (workspace_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000c1', 'owner')
on conflict do nothing;
create schema t;
grant usage on schema t to authenticated, anon;
create table t.v (k text primary key, v text);
grant all on t.v to authenticated, anon;
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
-- ===== клиент (без входа): заявка с реквизитами =====
set role anon;
do $$
declare r json; s json; tok text := 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
begin
  r := public.submit_exchange('shop', tok, 'Азамат', '+996555111222', 2000, null, null, 'alipay', '  azamat@mail.com ', ' Azamat K ');
  insert into t.v values ('r1', r->>'id');
  s := public.get_exchange_status((r->>'id')::uuid);
  assert s->>'recv_method' = 'alipay' and s->>'recv_account' = 'azamat@mail.com' and s->>'recv_name' = 'Azamat K', 'реквизиты сохранены без пробелов';
  assert not (s->>'has_recv_qr')::boolean and (s->>'recv_edit')::boolean, 'QR нет, менять можно';
  -- старый вызов без реквизитов
  r := public.submit_exchange('shop', tok, 'Бакыт', '+996555111333', 1500, 'вечером');
  insert into t.v values ('r2', r->>'id');
  s := public.get_exchange_status((r->>'id')::uuid);
  assert s->>'recv_method' is null and (s->>'recv_edit')::boolean, 'старый вызов: реквизитов нет, указать можно';
  perform t.err('select public.submit_exchange(''shop'', ''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'', ''Азамат'', ''+996555111222'', 2000, null, null, ''paypal'', ''x@y.z'', null)', 'invalid_recv_method');
  perform t.err('select public.submit_exchange(''shop'', ''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'', ''Азамат'', ''+996555111222'', 2000, null, null, ''wechat'', ''ab'', null)', 'invalid_recv_account');
  perform t.err('select public.submit_exchange(''shop'', ''aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'', ''Азамат'', ''+996555111222'', 2000, null, null, null, ''12345'', null)', 'invalid_recv_account');
  raise notice '   ✓ заявка с реквизитами; старый вызов без них работает; неправильные — нет';
end $$;

-- изменить реквизиты, QR
do $$
declare rid uuid := (select v::uuid from t.v where k = 'r2'); s json; j json;
begin
  perform t.err(format('select public.fx_set_recv(%L, ''wechat'', null, null)', rid), 'recv_empty');
  perform t.err(format('select public.fx_set_recv(%L, ''cash'', ''12345'', null)', rid), 'invalid_recv_method');
  perform t.err(format('select public.fx_set_recv(%L, ''bank'', ''12'', null)', rid), 'invalid_recv_account');
  perform t.err(format('select public.fx_set_recv(%L, ''alipay'', ''12345'', null)', gen_random_uuid()), 'request_not_found');
  -- QR: только своё «q-…»
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/q-abcdefgh12.jpg');
  perform t.err(format('insert into storage.objects (bucket_id, name) values (''fx-proofs'', %L)', rid || '/q-abc.svg'), 'row-level security|policy');
  perform t.err(format('select public.fx_set_recv(%L, ''wechat'', null, null, %L)', rid, rid || '/q-nonexist123.jpg'), 'file_not_found');
  perform t.err(format('select public.fx_set_recv(%L, ''wechat'', null, null, %L)', rid, (select v from t.v where k = 'r1') || '/q-abcdefgh12.jpg'), 'bad_path');
  j := public.fx_set_recv(rid, 'WeChat', null, 'Бакыт', rid || '/q-abcdefgh12.jpg');
  assert (j->>'has_recv_qr')::boolean, 'QR прикреплён';
  -- без нового QR — QR остаётся
  perform public.fx_set_recv(rid, 'wechat', 'bakyt_wx', null);
  s := public.get_exchange_status(rid);
  assert s->>'recv_method' = 'wechat' and s->>'recv_account' = 'bakyt_wx' and s->>'recv_name' is null and (s->>'has_recv_qr')::boolean, 'номер изменён, QR остался';
  assert s::text not like '%q-abcdefgh12%', 'клиенту не отдаётся путь к закрытому QR';
  -- убрать QR, когда номера нет, нельзя
  perform t.err(format('select public.fx_set_recv(%L, ''wechat'', null, null, null, true)', rid), 'recv_empty');
  perform public.fx_set_recv(rid, 'wechat', 'bakyt_wx', null, null, true);
  assert not (public.get_exchange_status(rid)->>'has_recv_qr')::boolean, 'QR убран';
  -- QR не мешает загрузить чек
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/q-abcdefgh13.jpg'), ('fx-proofs', rid || '/q-abcdefgh14.jpg');
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/pay1.jpg');
  raise notice '   ✓ клиент меняет реквизиты и QR; без номера и QR, чужой QR, несуществующий файл — нет';
end $$;
-- больше 5 QR — нет
do $$
declare rid text := (select v from t.v where k = 'r2');
begin
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/q-abcdefgh15.jpg'), ('fx-proofs', rid || '/q-abcdefgh16.jpg');
  perform t.err(format('insert into storage.objects (bucket_id, name) values (''fx-proofs'', %L)', rid || '/q-abcdefgh17.jpg'), 'row-level security|policy');
  raise notice '   ✓ больше 5 QR — нет';
end $$;
do $$
begin
  perform t.err('select recv_account from public.exchange_requests', 'permission denied');
  perform t.err('select public.fx_recv_editable(''new'', null, now())', 'permission denied');
  raise notice '   ✓ гостю закрыты таблица и служебная функция';
end $$;
reset role;

-- изменение позже 2 минут после заявки — сообщение обменнику в чат
update public.exchange_requests set created_at = now() - interval '10 minutes' where id = (select v::uuid from t.v where k = 'r1');
set role anon;
do $$
declare rid uuid := (select v::uuid from t.v where k = 'r1'); s json;
begin
  if (select count(*) from json_array_elements(public.get_exchange_status(rid)->'events')) <> 0 then raise exception 'ПРОВАЛ: сообщение при заявке'; end if;
  perform public.fx_set_recv(rid, 'alipay', '+8613800000000', 'Azamat K');
  s := public.get_exchange_status(rid);
  assert s->'events'->0->>'body' = '🔄 Новые реквизиты: Alipay · +8613800000000 · Azamat K', 'сообщение: ' || coalesce(s->'events'->0->>'body', 'нет');
  assert s->'events'->0->>'author' = 'client', 'от имени клиента';
  raise notice '   ✓ позднее изменение реквизитов — сообщение обменнику в чате';
end $$;
reset role;

-- ===== обменник видит, но не меняет; чужой байер не видит =====
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t.v where k = 'r1');
begin
  if (select recv_account from public.exchange_requests where id = rid) <> '+8613800000000' then raise exception 'ПРОВАЛ: обменник не видит реквизиты'; end if;
  perform t.err(format('update public.exchange_requests set recv_account = ''hacker'' where id = %L', rid), 'permission denied');
  if (select count(*) from storage.objects where bucket_id = 'fx-proofs' and name like '%/q-%') = 0 then raise exception 'ПРОВАЛ: обменник не видит QR'; end if;
  if public.fx_chat_unread('00000000-0000-0000-0000-00000000aa01') < 1 then raise exception 'ПРОВАЛ: обменник не видит непрочитанное о новых реквизитах'; end if;
  raise notice '   ✓ обменник видит реквизиты и QR, изменить их не может';
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  if (select count(*) from public.exchange_requests) <> 0 then raise exception 'ПРОВАЛ: чужой байер видит заявки'; end if;
  if (select count(*) from storage.objects where bucket_id = 'fx-proofs') <> 0 then raise exception 'ПРОВАЛ: чужой байер видит QR'; end if;
  raise notice '   ✓ чужой байер не видит ни реквизиты, ни QR';
end $$;
reset role;
reset request.uid;

-- ===== после отправки юаней и в споре менять нельзя =====
update public.exchange_requests set status = 'sent', sent_at = now() where id = (select v::uuid from t.v where k = 'r1');
update public.exchange_requests set status = 'paid', dispute = 'open', dispute_by = 'client', dispute_at = now() where id = (select v::uuid from t.v where k = 'r2');
set role anon;
do $$
declare r1 uuid := (select v::uuid from t.v where k = 'r1'); r2 uuid := (select v::uuid from t.v where k = 'r2');
begin
  perform t.err(format('select public.fx_set_recv(%L, ''alipay'', ''99999'', null)', r1), 'recv_locked');
  perform t.err(format('select public.fx_set_recv(%L, ''alipay'', ''99999'', null)', r2), 'recv_locked');
  perform t.err(format('insert into storage.objects (bucket_id, name) values (''fx-proofs'', %L)', r1 || '/q-latefile123.jpg'), 'row-level security|policy');
  assert not (public.get_exchange_status(r1)->>'recv_edit')::boolean, 'после отправки — менять нельзя';
  raise notice '   ✓ после «юани отправлены» и в открытом споре реквизиты не меняются';
end $$;
reset role;

-- ===== администратор видит реквизиты в споре =====
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare d json := public.admin_fx_disputes();
begin
  if d->0->>'recv_method' <> 'wechat' or d->0->>'recv_account' <> 'bakyt_wx' then raise exception 'ПРОВАЛ: администратор не видит реквизиты в споре: %', d; end if;
  raise notice '   ✓ администратор видит реквизиты клиента в споре';
end $$;
reset role;
reset request.uid;
SQL
echo "✅ Файл 78 проверен"
