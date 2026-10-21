-- =====================================================
-- ТЕСТЫ: проверка главных правил безопасности базы.
-- Запускается скриптом tests/run_db_tests.sh (в настоящую базу НЕ запускать).
-- Если правило нарушено — тест падает с сообщением «ПРОВАЛ: …».
-- =====================================================
\set ON_ERROR_STOP on
\set QUIET on

-- Пользователи для тестов
--   A = админ (создан в supabase_stub.sql)
--   B, C = два байера, зарегистрировались сами (свободная регистрация)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.kg', '{"full_name":"Байер Б","phone":"+996555000111","workspace_name":"Б-карго"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.kg', '{"full_name":"Байер В","phone":"+996555000222","workspace_name":"В-карго"}');

create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;

-- ---------- Байер Б создаёт заказ, поставщика, сообщение в поддержку ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
with x as (
  insert into public.orders (client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, supplier, admin_comment)
  values ('Клиент Б', 'Товар Б', 2, 100, 13, 3000, 1000, 'Секретный поставщик', 'внутренняя заметка')
  returning id)
insert into t select 'b_order', id::text from x;
insert into t select 'b_token', public_token from public.orders where id = (select v::uuid from t where k = 'b_order');
insert into public.suppliers (workspace_id, name) select public.my_workspace_id(), 'Поставщик Б';
select public.support_send('Помогите', '{}'::jsonb) \gset
reset role;

-- ---------- 1. Изоляция байеров ----------
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.orders;            if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужие заказы (%)', n; end if;
  select count(*) into n from public.suppliers;         if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужих поставщиков'; end if;
  select count(*) into n from public.support_messages;  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужую переписку'; end if;
  select count(*) into n from public.workspaces where name = 'Б-карго';
  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужой кабинет'; end if;

  update public.orders set paid_amount = 0 where id = (select v::uuid from t where k = 'b_order');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ПРОВАЛ: байер В изменил чужой заказ'; end if;

  begin
    insert into public.orders (workspace_id, client_name, product_ru)
    select id, 'x', 'x' from public.workspaces where name = 'Б-карго';
    -- сюда попадаем, только если select ничего не нашёл (кабинет не виден) — это нормально
  exception when others then null; -- вставка в чужой кабинет запрещена — хорошо
  end;
  select count(*) into n from public.orders;
  if n <> 0 then raise exception 'ПРОВАЛ: байер В смог добавить заказ'; end if;

  begin
    perform public.revoke_client_link((select v::uuid from t where k = 'b_order'));
    raise exception 'ПРОВАЛ: байер В отключил чужую ссылку';
  exception when others then
    if sqlerrm like 'ПРОВАЛ%' then raise; end if;
  end;
end $$;
\echo '✅ 1. Байеры не видят и не меняют чужие заказы, поставщиков, переписку'
reset role;

-- ---------- 2. Админ видит кабинеты, но только смотрит ----------
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.orders where id = (select v::uuid from t where k = 'b_order');
  if n <> 1 then raise exception 'ПРОВАЛ: админ не видит заказ байера'; end if;
  update public.orders set paid_amount = 0 where id = (select v::uuid from t where k = 'b_order');
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ПРОВАЛ: админ изменил заказ чужого кабинета'; end if;
end $$;
\echo '✅ 2. Админ видит чужой кабинет, но изменить не может'
reset role;

-- ---------- 3. Аноним без ссылки ничего не видит ----------
reset request.uid;
set role anon;
do $$
declare n int;
begin
  begin
    select count(*) into n from public.orders;
    if n <> 0 then raise exception 'ПРОВАЛ: аноним видит заказы'; end if;
  exception when insufficient_privilege then null; end;
  begin
    select count(*) into n from public.clients;
    if n <> 0 then raise exception 'ПРОВАЛ: аноним видит клиентов'; end if;
  exception when insufficient_privilege then null; end;
  begin
    perform public.support_send('спам', '{}'::jsonb);
    raise exception 'ПРОВАЛ: аноним пишет в поддержку';
  exception when insufficient_privilege then null; end;
end $$;
\echo '✅ 3. Без входа таблицы закрыты'

-- ---------- 4. Клиент по ссылке видит только свой заказ и без финансов байера ----------
do $$
declare j json; fld text;
  forbidden text[] := array['cost_som','profit_som','unit_price_cny','exchange_rate','delivery_cost','delivery_rate',
                            'goods_som','goods_cny','supplier','supplier_link','supplier_wechat','admin_comment',
                            'client_price','public_token','workspace_id','id'];
begin
  j := public.get_client_order((select v from t where k = 'b_token'));
  if j is null then raise exception 'ПРОВАЛ: клиент не открыл свой заказ по ссылке'; end if;
  foreach fld in array forbidden loop
    if (j::jsonb) ? fld then raise exception 'ПРОВАЛ: клиент видит скрытое поле %', fld; end if;
  end loop;
  if (j->>'total_som')::numeric <> 3000 then raise exception 'ПРОВАЛ: клиент видит не ту сумму к оплате'; end if;

  if public.get_client_order('00000000000000000000000000000000') is not null then
    raise exception 'ПРОВАЛ: чужой токен открыл заказ';
  end if;
  if public.get_client_order(null) is not null then raise exception 'ПРОВАЛ: пустой токен открыл заказ'; end if;

  -- клиент сохраняет свои данные доставки
  perform public.save_client_info((select v from t where k = 'b_token'), 'Иван Иванов', '+996555123456', null, 'Бишкек', 'ул. Тест 1', null);
end $$;
\echo '✅ 4. Клиент по ссылке видит свой заказ без цен поставщика, себестоимости и прибыли'
reset role;

-- ---------- 5. Отключение и замена ссылки ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
select public.revoke_client_link((select v::uuid from t where k = 'b_order')) \gset
reset role; set role anon;
do $$ begin
  if public.get_client_order((select v from t where k = 'b_token')) is not null then
    raise exception 'ПРОВАЛ: отключённая ссылка всё ещё открывает заказ';
  end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'b_token2', public.rotate_client_link((select v::uuid from t where k = 'b_order'));
reset role; set role anon;
do $$ begin
  if public.get_client_order((select v from t where k = 'b_token2')) is null then
    raise exception 'ПРОВАЛ: новая ссылка не открывает заказ';
  end if;
  if public.get_client_order((select v from t where k = 'b_token')) is not null then
    raise exception 'ПРОВАЛ: старая ссылка снова работает';
  end if;
end $$;
\echo '✅ 5. Отключённая и старая ссылки не работают, новая работает'
reset role;

-- ---------- 6. Фото чужого заказа недоступны ----------
insert into storage.objects (bucket_id, name) values ('order-photos', (select v from t where k = 'b_order') || '/photo.jpg');
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from storage.objects;
  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит фото чужого заказа'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from storage.objects;
  if n <> 1 then raise exception 'ПРОВАЛ: байер Б не видит фото своего заказа'; end if;
end $$;
\echo '✅ 6. Файлы фото видит только свой кабинет'
reset role;

-- ---------- 7. Учёт SQL-файлов ----------
do $$
declare n int;
begin
  select count(*) into n from public.schema_migrations;
  if n < 16 then raise exception 'ПРОВАЛ: в schema_migrations отмечено только % файлов', n; end if;
end $$;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$ begin
  begin
    perform 1 from public.schema_migrations;
    raise exception 'ПРОВАЛ: байер видит таблицу schema_migrations';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo '✅ 7. Все SQL-файлы отмечены, таблица учёта закрыта от сайта'
