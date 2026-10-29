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
  if n < 33 then raise exception 'ПРОВАЛ: в schema_migrations отмечено только % файлов', n; end if;
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


-- ---------- 10. Партии: деление стоимости доставки ----------
-- Байер Б: свои курсы, партия и три заказа (веса 10, 30 и 20 кг; третий заказ — клиенту в рублях)
reset request.uid;
update public.workspaces set custom_rates = '{"USD_KGS": 88.5, "USD_RUB": 90}'::jsonb where owner_id = '00000000-0000-0000-0000-0000000000b1';
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'ship', gen_random_uuid()::text;
insert into public.shipments (id, workspace_id, name, cargo, delivery_currency, tariff, actual_weight)
  select v::uuid, public.my_workspace_id(), 'Карго 1', 'Тест-карго', 'USD', 3.5, 70 from t where k = 'ship';
insert into public.orders (client_name, product_ru, weight_kg, client_currency, shipment_id)
  select 'Кл1', 'Т1', 10, 'KGS', v::uuid from t where k = 'ship';
insert into public.orders (client_name, product_ru, weight_kg, client_currency, shipment_id)
  select 'Кл2', 'Т2', 30, 'KGS', v::uuid from t where k = 'ship';
insert into public.orders (client_name, product_ru, weight_kg, client_currency, shipment_id)
  select 'Кл3', 'Т3', 20, 'RUB', v::uuid from t where k = 'ship';
insert into public.orders (client_name, product_ru, weight_kg, client_currency)
  values ('Вне партии', 'Т4', 5, 'KGS');

do $$
declare r jsonb; sid uuid := (select v::uuid from t where k = 'ship'); tot numeric; n int;
begin
  -- вес партии 70 кг (по весам карго) × 3,5 $ = 245 $; веса заказов 10/30/20 → доли 1/6, 1/2, 1/3
  r := public.shipment_recalc(sid);
  if not (r->>'ok')::boolean then raise exception 'ПРОВАЛ: деление не выполнилось: %', r; end if;
  if (r->>'total')::numeric <> 245 then raise exception 'ПРОВАЛ: делим не 245 $, а %', r->>'total'; end if;
  select sum(delivery_cost) into tot from public.orders where shipment_id = sid;
  if tot <> 245.00 then raise exception 'ПРОВАЛ: сумма долей % не равна 245.00', tot; end if;
  if (select delivery_cost from public.orders where client_name = 'Кл1') <> 40.83 then raise exception 'ПРОВАЛ: доля заказа 1 не 40.83'; end if;
  if (select delivery_cost from public.orders where client_name = 'Кл2') <> 122.50 then raise exception 'ПРОВАЛ: доля заказа 2 не 122.50'; end if;
  if (select delivery_cost from public.orders where client_name = 'Кл3') <> 81.67 then raise exception 'ПРОВАЛ: доля заказа 3 не 81.67 (остаток)'; end if;
  -- валюта доставки, тариф, курсы из «Моих курсов»
  select count(*) into n from public.orders where shipment_id = sid and delivery_currency = 'USD' and delivery_tariff = 3.5;
  if n <> 3 then raise exception 'ПРОВАЛ: валюта или тариф доставки проставлены не у всех заказов (%)', n; end if;
  if (select delivery_rate from public.orders where client_name = 'Кл1') <> 88.5 then raise exception 'ПРОВАЛ: курс доставки USD→KGS не 88.5'; end if;
  if (select delivery_rate from public.orders where client_name = 'Кл3') <> 90 then raise exception 'ПРОВАЛ: курс доставки USD→RUB не 90'; end if;
  -- в рублях/сомах доставка и себестоимость пересчитались сами (колонки считает база)
  if (select delivery_som from public.orders where client_name = 'Кл1') <> round(40.83 * 88.5, 2) and
     abs((select delivery_som from public.orders where client_name = 'Кл1') - 40.83 * 88.5) > 0.01 then
    raise exception 'ПРОВАЛ: delivery_som заказа 1 не пересчитался';
  end if;
  -- заказ вне партии не тронут
  if (select delivery_cost from public.orders where client_name = 'Вне партии') <> 0 then raise exception 'ПРОВАЛ: заказ вне партии изменился'; end if;
  if (r->>'missing_rate')::int <> 0 then raise exception 'ПРОВАЛ: курсы есть, а missing_rate = %', r->>'missing_rate'; end if;

  -- вес по весам карго не указан → берём сумму весов (60 кг × 3,5 = 210 $)
  update public.shipments set actual_weight = null where id = sid;
  r := public.shipment_recalc(sid);
  if (r->>'total')::numeric <> 210 then raise exception 'ПРОВАЛ: без веса карго делим не 210, а %', r->>'total'; end if;

  -- сумма по счёту карго важнее тарифа
  update public.shipments set total_cost = 300 where id = sid;
  r := public.shipment_recalc(sid);
  select sum(delivery_cost) into tot from public.orders where shipment_id = sid;
  if tot <> 300.00 then raise exception 'ПРОВАЛ: при сумме по счёту 300 разделилось %', tot; end if;

  -- нет ни тарифа, ни суммы
  update public.shipments set total_cost = null, tariff = null where id = sid;
  r := public.shipment_recalc(sid);
  if (r->>'ok')::boolean or r->>'error' <> 'no_cost' then raise exception 'ПРОВАЛ: без тарифа и суммы должна быть ошибка no_cost: %', r; end if;
  update public.shipments set tariff = 3.5 where id = sid;

  -- заказ без веса не получает долю, остальные делят всё
  update public.orders set weight_kg = 0 where client_name = 'Кл3';
  r := public.shipment_recalc(sid);
  select sum(delivery_cost) into tot from public.orders where shipment_id = sid;
  if tot <> round(3.5 * 40, 2) then raise exception 'ПРОВАЛ: при нулевом весе заказа 3 разделилось % вместо 140', tot; end if;
  if (select delivery_cost from public.orders where client_name = 'Кл3') <> 0 then raise exception 'ПРОВАЛ: заказ без веса получил долю'; end if;
  update public.orders set weight_kg = 20 where client_name = 'Кл3';

  -- у всех нулевой вес
  update public.orders set weight_kg = 0 where shipment_id = sid;
  r := public.shipment_recalc(sid);
  if (r->>'ok')::boolean or r->>'error' <> 'no_weight' then raise exception 'ПРОВАЛ: при нулевых весах должна быть ошибка no_weight: %', r; end if;
  update public.orders set weight_kg = 10 where client_name = 'Кл1';
  update public.orders set weight_kg = 30 where client_name = 'Кл2';
  update public.orders set weight_kg = 20 where client_name = 'Кл3';

  -- нет курса для валюты клиента: оставляем прежний и предупреждаем
  update public.orders set client_currency = 'EUR', delivery_rate = 0 where client_name = 'Кл3';
  r := public.shipment_recalc(sid);
  if (r->>'missing_rate')::int <> 1 then raise exception 'ПРОВАЛ: нет курса USD→EUR, а missing_rate = %', r->>'missing_rate'; end if;
  update public.orders set client_currency = 'RUB' where client_name = 'Кл3';

  -- смена статуса всей партии
  update public.orders set status = 'cancelled' where client_name = 'Кл2';
  n := public.shipment_set_status(sid, 'in_transit');
  if n <> 2 then raise exception 'ПРОВАЛ: статус сменился у % заказов, а нужно у 2 (отменённый не трогаем)', n; end if;
  if (select status from public.orders where client_name = 'Кл2') <> 'cancelled' then raise exception 'ПРОВАЛ: отменённый заказ получил статус партии'; end if;
  update public.orders set status = 'new' where client_name = 'Кл2';
end $$;
reset role;

-- чужой байер В: партию не видит, не делит, статус не меняет, в чужую партию заказ не кладёт
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare sid uuid := (select v::uuid from t where k = 'ship'); n int;
begin
  select count(*) into n from public.shipments;
  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужие партии (%)', n; end if;
  begin perform public.shipment_recalc(sid); raise exception 'ПРОВАЛ: байер В разделил чужую партию';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.shipment_set_status(sid, 'delivered'); raise exception 'ПРОВАЛ: байер В сменил статус чужой партии';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  insert into public.orders (client_name, product_ru, weight_kg) values ('В-заказ', 'ТВ', 1);
  begin
    update public.orders set shipment_id = sid where client_name = 'В-заказ';
    raise exception 'ПРОВАЛ: байер В положил свой заказ в чужую партию';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin
    insert into public.shipments (workspace_id, name) select id, 'Подмена' from public.workspaces where name = 'Б-карго';
    -- кабинет Б байеру В не виден, вставка не должна пройти (или не вставит ничего)
  exception when others then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.shipments where name = 'Подмена') then raise exception 'ПРОВАЛ: байер В создал партию в чужом кабинете'; end if;
end $$;

-- админ: партию видит, но делить и менять не может
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare sid uuid := (select v::uuid from t where k = 'ship');
begin
  if (select count(*) from public.shipments) < 1 then raise exception 'ПРОВАЛ: админ не видит партии кабинета'; end if;
  begin perform public.shipment_recalc(sid); raise exception 'ПРОВАЛ: админ разделил чужую партию';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;

-- без входа нельзя
reset request.uid;
set role anon;
do $$ begin
  begin perform public.shipment_recalc(gen_random_uuid()); raise exception 'ПРОВАЛ: аноним вызвал shipment_recalc';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.shipments; raise exception 'ПРОВАЛ: аноним читает партии';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- удалили партию: заказы остались, просто без партии
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare sid uuid := (select v::uuid from t where k = 'ship'); n int;
begin
  delete from public.shipments where id = sid;
  select count(*) into n from public.orders where client_name in ('Кл1', 'Кл2', 'Кл3') and shipment_id is null;
  if n <> 3 then raise exception 'ПРОВАЛ: после удаления партии заказов без партии %, а нужно 3', n; end if;
end $$;
reset role;
\echo '✅ 10. Партии: доли делятся до копейки, курсы из «Моих курсов», чужие кабинеты закрыты, удаление партии не удаляет заказы'


-- ---------- 11. Заявки по ссылке ----------
reset request.uid;
insert into t select 'b_ws', id::text from public.workspaces where name = 'Б-карго';
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'req_token', public.request_link_rotate((select v::uuid from t where k = 'b_ws'));
reset role;

-- чужой байер и аноним ссылку менять не могут
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  begin perform public.request_link_rotate((select v::uuid from t where k = 'b_ws')); raise exception 'ПРОВАЛ: байер В заменил чужую ссылку для заявок';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.request_link_revoke((select v::uuid from t where k = 'b_ws')); raise exception 'ПРОВАЛ: байер В отключил чужую ссылку для заявок';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
reset request.uid;
set role anon;
do $$ begin
  begin perform public.request_link_rotate((select v::uuid from t where k = 'b_ws')); raise exception 'ПРОВАЛ: аноним заменил ссылку для заявок';
  exception when insufficient_privilege then null; end;
end $$;

-- аноним: форма и заявка
do $$
declare tok text := (select v from t where k = 'req_token'); r json; c jsonb; got text;
begin
  if (public.get_request_form(tok)->>'name') <> 'Б-карго' then raise exception 'ПРОВАЛ: форма не показала название кабинета'; end if;
  if public.get_request_form('00000000000000000000000000000000') is not null then raise exception 'ПРОВАЛ: чужой токен открыл форму'; end if;
  if public.get_request_form(null) is not null then raise exception 'ПРОВАЛ: пустой токен открыл форму'; end if;

  r := public.submit_request(tok, '  Азамат ', '+996 (555) 11-22-33', '@azamat_kg', 'Кроссовки Nike',
                             'https://detail.1688.com/offer/1.html', 10, 'Размеры 39-44', null);
  if not (r->>'ok')::boolean or r->>'order_number' is null or r->>'token' !~ '^[a-f0-9]{32}$' then
    raise exception 'ПРОВАЛ: хорошая заявка не создала заказ: %', r;
  end if;
  insert into t values ('req_order', r->>'token');

  -- клиент по полученной ссылке видит свой заказ
  if (public.get_client_order(r->>'token')->>'status') <> 'new' then raise exception 'ПРОВАЛ: заказ из заявки не открывается по ссылке клиента'; end if;

  -- мусор отклоняется с понятным кодом ошибки
  for c in select * from jsonb_array_elements('[
    {"n":"короткое имя","name":"А","phone":"+996555112233","prod":"Товар","err":"invalid_name"},
    {"n":"плохой телефон","name":"Иван","phone":"123","prod":"Товар","err":"invalid_phone"},
    {"n":"плохой telegram","name":"Иван","phone":"+996555112233","tg":"ab","prod":"Товар","err":"invalid_telegram"},
    {"n":"нет товара и ссылки","name":"Иван","phone":"+996555112233","prod":"","err":"invalid_product"},
    {"n":"ссылка javascript","name":"Иван","phone":"+996555112233","prod":"Товар","link":"javascript:alert(1)","err":"invalid_link"},
    {"n":"ссылка с пробелом","name":"Иван","phone":"+996555112233","prod":"Товар","link":"http://a b","err":"invalid_link"},
    {"n":"количество 0","name":"Иван","phone":"+996555112233","prod":"Товар","qty":0,"err":"invalid_quantity"},
    {"n":"количество минус","name":"Иван","phone":"+996555112233","prod":"Товар","qty":-5,"err":"invalid_quantity"},
    {"n":"количество огромное","name":"Иван","phone":"+996555112233","prod":"Товар","qty":100001,"err":"invalid_quantity"}
  ]'::jsonb) loop
    begin
      perform public.submit_request(tok, c->>'name', c->>'phone', c->>'tg', c->>'prod', c->>'link', coalesce((c->>'qty')::numeric, 1), null, null);
      raise exception 'ПРОВАЛ: заявка «%» прошла, а должна быть отклонена', c->>'n';
    exception when others then
      got := sqlerrm;
      if got like 'ПРОВАЛ%' then raise; end if;
      if got <> c->>'err' then raise exception 'ПРОВАЛ: заявка «%»: ждали %, получили %', c->>'n', c->>'err', got; end if;
    end;
  end loop;
  begin perform public.submit_request(tok, 'Иван', '+996555112233', null, repeat('x', 301), null, 1, null, null); raise exception 'ПРОВАЛ: товар на 301 символ прошёл';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.submit_request(tok, 'Иван', '+996555112233', null, 'Товар', null, 1, repeat('x', 1001), null); raise exception 'ПРОВАЛ: комментарий на 1001 символ прошёл';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.submit_request('zzz', 'Иван', '+996555112233', null, 'Товар', null, 1, null, null); raise exception 'ПРОВАЛ: неверный токен принят';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'link_not_found' then raise exception 'ПРОВАЛ: неверный токен: %', sqlerrm; end if; end;
end $$;
reset role;

-- созданный заказ записан правильно
do $$
declare o public.orders;
begin
  select * into o from public.orders where public_token = (select v from t where k = 'req_order');
  if o.source <> 'request' or o.status <> 'new' then raise exception 'ПРОВАЛ: заказ из заявки без пометки или не «Новый»'; end if;
  if o.workspace_id <> (select v::uuid from t where k = 'b_ws') then raise exception 'ПРОВАЛ: заказ попал не в тот кабинет'; end if;
  if o.client_name <> 'Азамат' or o.client_phone <> '+996555112233' then raise exception 'ПРОВАЛ: имя или телефон записаны неверно (%, %)', o.client_name, o.client_phone; end if;
  if o.product_ru <> 'Кроссовки Nike' or o.quantity <> 10 or o.supplier_link <> 'https://detail.1688.com/offer/1.html' then raise exception 'ПРОВАЛ: товар, количество или ссылка записаны неверно'; end if;
  if o.admin_comment not like '%azamat_kg%' or o.admin_comment not like '%Размеры 39-44%' then raise exception 'ПРОВАЛ: Telegram или комментарий клиента не попали в заметку'; end if;
  if (select source from public.orders where client_name = 'Клиент Б' limit 1) <> 'manual' then raise exception 'ПРОВАЛ: обычный заказ байера получил пометку заявки'; end if;
end $$;

-- видит заявку только хозяин кабинета (и админ для просмотра)
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$ begin if (select count(*) from public.orders where source = 'request') <> 1 then raise exception 'ПРОВАЛ: байер Б не видит свою заявку'; end if; end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin if (select count(*) from public.orders where source = 'request') <> 0 then raise exception 'ПРОВАЛ: байер В видит чужие заявки'; end if; end $$;
reset role;

-- ловушка для ботов: ответ «успешно», заказа нет
reset request.uid;
set role anon;
do $$
declare tok text := (select v from t where k = 'req_token'); r json;
begin
  r := public.submit_request(tok, 'Бот Ботов', '+996555000111', null, 'Спам', null, 1, null, 'http://spam.example');
  if not (r->>'ok')::boolean or r->>'token' is not null then raise exception 'ПРОВАЛ: ловушка для ботов ответила не так: %', r; end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.orders where client_name = 'Бот Ботов') then raise exception 'ПРОВАЛ: заявка бота создала заказ'; end if;
end $$;

-- замена ссылки: старая умирает, новая работает; отключение
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'req_token2', public.request_link_rotate((select v::uuid from t where k = 'b_ws'));
reset role;
reset request.uid;
set role anon;
do $$
declare t1 text := (select v from t where k = 'req_token'); t2 text := (select v from t where k = 'req_token2'); r json;
begin
  if public.get_request_form(t1) is not null then raise exception 'ПРОВАЛ: старая ссылка для заявок всё ещё работает'; end if;
  begin perform public.submit_request(t1, 'Иван', '+996555223344', null, 'Товар', null, 1, null, null); raise exception 'ПРОВАЛ: по старой ссылке приняли заявку';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  r := public.submit_request(t2, 'Мария', '+996555223344', null, 'Товар', null, 1, null, null);
  if not (r->>'ok')::boolean then raise exception 'ПРОВАЛ: новая ссылка не принимает заявки'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$ begin perform public.request_link_revoke((select v::uuid from t where k = 'b_ws')); end $$;
reset role;
reset request.uid;
set role anon;
do $$
declare t2 text := (select v from t where k = 'req_token2');
begin
  if public.get_request_form(t2) is not null then raise exception 'ПРОВАЛ: отключённая ссылка всё ещё открывает форму'; end if;
  begin perform public.submit_request(t2, 'Иван', '+996555334455', null, 'Товар', null, 1, null, null); raise exception 'ПРОВАЛ: по отключённой ссылке приняли заявку';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'req_token3', public.request_link_rotate((select v::uuid from t where k = 'b_ws'));
reset role;

-- лимиты: 5 в час с одного телефона, 20 в час на кабинет
reset request.uid;
set role anon;
do $$
declare tok text := (select v from t where k = 'req_token3'); i int; n int;
begin
  -- с одного телефона: уже была 1 заявка (Азамат) → ещё 4 проходят, 6-я нет
  for i in 1..4 loop
    perform public.submit_request(tok, 'Азамат ' || i, '+996555112233', null, 'Товар', null, 1, null, null);
  end loop;
  begin perform public.submit_request(tok, 'Азамат 6', '+996555112233', null, 'Товар', null, 1, null, null); raise exception 'ПРОВАЛ: 6-я заявка за час с одного телефона прошла';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'too_many_requests' then raise exception 'ПРОВАЛ: лимит телефона: %', sqlerrm; end if; end;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.orders where source = 'request' and created_at > now() - interval '1 hour';
  if n <> 6 then raise exception 'ПРОВАЛ: к этому моменту заявок за час должно быть 6, а их %', n; end if;
end $$;
set role anon;
do $$
declare tok text := (select v from t where k = 'req_token3'); i int;
begin
  -- на кабинет: до 20 в час (уже 6) → ещё 14 проходят, 21-я нет
  for i in 1..14 loop
    perform public.submit_request(tok, 'Тест ' || i, '+99670000' || lpad(i::text, 4, '0'), null, 'Товар', null, 1, null, null);
  end loop;
  begin perform public.submit_request(tok, 'Лишний', '+996709999999', null, 'Товар', null, 1, null, null); raise exception 'ПРОВАЛ: 21-я заявка за час на кабинет прошла';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'too_many_requests' then raise exception 'ПРОВАЛ: лимит кабинета: %', sqlerrm; end if; end;
  -- аноним по-прежнему не читает заказы
  begin perform count(*) from public.orders; raise exception 'ПРОВАЛ: аноним читает заказы';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo '✅ 11. Заявки по ссылке: заказ создаётся верно, мусор и боты отклоняются, лимиты работают, замена и отключение ссылки действуют, чужие кабинеты закрыты'


-- ---------- 12. Помощник в кабинете ----------
-- S = помощник (зарегистрировался сам, получил пустой кабинет), D = байер с данными
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a5', 's@test.kg', '{"full_name":"Помощник","phone":"+996555000333","workspace_name":"Пустой"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.kg', '{"full_name":"Байер Д","phone":"+996555000444","workspace_name":"Д-карго"}');

-- Д создаёт заказ (значит, вступить в чужую команду не сможет)
set request.uid = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
insert into public.orders (client_name, product_ru) values ('Клиент Д', 'Товар Д');
reset role;

-- Б (владелец) создаёт приглашения; посторонний не может
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'team_code', public.team_invite_create(public.my_workspace_id());
insert into t select 'tm_ws', public.my_workspace_id()::text;
insert into t select 'team_code_old', public.team_invite_create(public.my_workspace_id());
reset role;
update public.team_invites set expires_at = now() - interval '1 hour' where code = (select v from t where k = 'team_code_old');

set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  begin perform public.team_invite_create((select v::uuid from t where k = 'tm_ws')); raise exception 'ПРОВАЛ: чужой байер создал приглашение в чужую команду';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.team_list((select v::uuid from t where k = 'tm_ws')); raise exception 'ПРОВАЛ: чужой байер видит команду';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;

-- Д: у него есть заказы — вступить нельзя, и его данные остаются
set request.uid = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
do $$
declare n int;
begin
  begin perform public.team_join((select v from t where k = 'team_code')); raise exception 'ПРОВАЛ: байер с данными вступил в команду';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'has_own_data' then raise exception 'ПРОВАЛ: ожидали has_own_data, получили %', sqlerrm; end if; end;
  select count(*) into n from public.orders; if n <> 1 then raise exception 'ПРОВАЛ: у байера Д пропали данные'; end if;
end $$;
reset role;

-- Помощник: плохой и просроченный код — нет; верный — да, один раз
set request.uid = '00000000-0000-0000-0000-0000000000a5';
set role authenticated;
do $$
begin
  begin perform public.team_join('xyz'); raise exception 'ПРОВАЛ: мусорный код принят';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.team_join((select v from t where k = 'team_code_old')); raise exception 'ПРОВАЛ: просроченный код принят';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  perform public.team_join((select v from t where k = 'team_code'));
  begin perform public.team_join((select v from t where k = 'team_code')); raise exception 'ПРОВАЛ: код сработал дважды';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;

-- помощник работает в кабинете Б: видит, создаёт, правит; не удаляет и не настраивает
do $$
declare n int; v_ws uuid := (select v::uuid from t where k = 'tm_ws'); v_o uuid;
begin
  if public.my_workspace_id() <> v_ws then raise exception 'ПРОВАЛ: у помощника не тот кабинет'; end if;
  select count(*) into n from public.workspaces; if n <> 1 then raise exception 'ПРОВАЛ: у помощника лишние кабинеты (%)', n; end if;
  select count(*) into n from public.orders where client_name = 'Клиент Б'; if n <> 1 then raise exception 'ПРОВАЛ: помощник не видит заказы кабинета'; end if;

  insert into public.orders (client_name, product_ru) values ('Клиент помощника', 'Товар П') returning id into v_o;
  if (select workspace_id from public.orders where id = v_o) <> v_ws then raise exception 'ПРОВАЛ: заказ помощника попал не в тот кабинет'; end if;
  update public.orders set status = 'cancelled' where id = v_o;
  get diagnostics n = row_count; if n <> 1 then raise exception 'ПРОВАЛ: помощник не может менять заказ'; end if;

  delete from public.orders where id = v_o;
  get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: помощник удалил заказ'; end if;
  delete from public.suppliers;
  get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: помощник удалил поставщика'; end if;
  delete from public.clients;
  get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: помощник удалил клиента'; end if;

  update public.workspaces set name = 'Захвачен' where id = v_ws;
  get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: помощник изменил настройки кабинета'; end if;

  begin perform public.request_link_rotate(v_ws); raise exception 'ПРОВАЛ: помощник создал ссылку для заявок';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.team_invite_create(v_ws); raise exception 'ПРОВАЛ: помощник позвал ещё помощника';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.set_profit_goal(v_ws, 'KGS', 1); raise exception 'ПРОВАЛ: помощник поставил цель';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.team_list(v_ws); raise exception 'ПРОВАЛ: помощник видит команду';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.team_remove(v_ws, '00000000-0000-0000-0000-0000000000b1'); raise exception 'ПРОВАЛ: помощник убрал владельца';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;

-- владелец видит команду, может удалять, и убирает помощника
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare l jsonb; n int;
begin
  l := public.team_list((select v::uuid from t where k = 'tm_ws'));
  if jsonb_array_length(l -> 'members') <> 2 then raise exception 'ПРОВАЛ: в команде не 2 человека'; end if;
  delete from public.orders where client_name = 'Клиент помощника';
  get diagnostics n = row_count; if n <> 1 then raise exception 'ПРОВАЛ: владелец не смог удалить заказ'; end if;
  begin perform public.team_remove((select v::uuid from t where k = 'tm_ws'), '00000000-0000-0000-0000-0000000000b1'); raise exception 'ПРОВАЛ: убрали владельца';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  perform public.team_remove((select v::uuid from t where k = 'tm_ws'), '00000000-0000-0000-0000-0000000000a5');
end $$;
reset role;

-- после удаления помощник не видит кабинет Б, но может войти в свой новый
set request.uid = '00000000-0000-0000-0000-0000000000a5';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.orders; if n <> 0 then raise exception 'ПРОВАЛ: убранный помощник видит заказы'; end if;
  if public.my_workspace_id() is null then raise exception 'ПРОВАЛ: у убранного помощника нет своего кабинета'; end if;
  if public.is_member((select v::uuid from t where k = 'tm_ws')) then raise exception 'ПРОВАЛ: убранный помощник всё ещё участник'; end if;
  begin perform count(*) from public.team_invites; raise exception 'ПРОВАЛ: таблица приглашений открыта';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo '✅ 12. Помощник: работает с заказами, но не удаляет и не настраивает; приглашения одноразовые; чужие и посторонние закрыты'


-- ---------- 13. Цель по прибыли ----------
-- владелец Б ставит цель; помощник (в команде Б нет — она закрыта после проверки 12) и чужие — нет
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare ws uuid := public.my_workspace_id(); g jsonb;
begin
  g := public.set_profit_goal(ws, 'KGS', 100000);
  if (g ->> 'KGS')::numeric <> 100000 then raise exception 'ПРОВАЛ: цель не сохранилась'; end if;
  g := public.set_profit_goal(ws, 'USD', 2000.555);
  if (g ->> 'USD')::numeric <> 2000.56 or (g ->> 'KGS')::numeric <> 100000 then raise exception 'ПРОВАЛ: вторая валюта испортила первую'; end if;
  g := public.set_profit_goal(ws, 'USD', 0);
  if g ? 'USD' then raise exception 'ПРОВАЛ: цель не убралась'; end if;
  begin perform public.set_profit_goal(ws, 'kgs', 5); raise exception 'ПРОВАЛ: плохая валюта принята';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.set_profit_goal(ws, 'KGS', -5); raise exception 'ПРОВАЛ: отрицательная цель принята';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.set_profit_goal(ws, 'KGS', 1e15); raise exception 'ПРОВАЛ: огромная цель принята';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  -- напрямую поле менять нельзя
  begin update public.workspaces set profit_goals = '{"KGS": 1}' where id = ws; raise exception 'ПРОВАЛ: цель изменена напрямую';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;

set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  begin perform public.set_profit_goal((select id from public.workspaces where name = 'Б-карго' limit 1), 'KGS', 1);
    raise exception 'ПРОВАЛ: чужой байер поставил цель';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
\echo '✅ 13. Цель по прибыли: ставится и убирается владельцем, мусор отклоняется, чужие и прямое изменение закрыты'


-- ---------- 14. Telegram кабинета ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare ws uuid := public.my_workspace_id(); code text; st jsonb;
begin
  st := public.tg_status(ws);
  if (st ->> 'connected')::boolean then raise exception 'ПРОВАЛ: Telegram подключён сам по себе'; end if;
  code := public.tg_connect_start(ws);
  if code !~ '^[a-f0-9]{24}$' then raise exception 'ПРОВАЛ: код подключения неправильный'; end if;
  if public.tg_connect_start(ws) = code then raise exception 'ПРОВАЛ: код не обновился'; end if;
  begin perform count(*) from public.ws_telegram; raise exception 'ПРОВАЛ: таблица Telegram открыта сайту';
  exception when insufficient_privilege then null; end;
  perform public.tg_disconnect(ws);
end $$;
reset role;
-- чужой байер не управляет чужим подключением (id кабинета берём от имени служебной роли)
do $$
declare ws uuid := (select id from public.workspaces where name = 'Б-карго' limit 1);
begin
  perform set_config('request.uid', '00000000-0000-0000-0000-0000000000c1', false);
  set local role authenticated;
  begin perform public.tg_connect_start(ws); raise exception 'ПРОВАЛ: чужой байер создал код подключения';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.tg_status(ws); raise exception 'ПРОВАЛ: чужой байер смотрит Telegram чужого кабинета';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.tg_disconnect(ws); raise exception 'ПРОВАЛ: чужой байер отключил чужой Telegram';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
\echo '✅ 14. Telegram кабинета: код одноразовый, статус и отключение только у владельца, таблица закрыта'


-- ---------- 15. Двухфакторный вход администратора ----------
-- без включённой 2FA админ работает как раньше (проверка 2 это уже показала)
insert into auth.mfa_factors (user_id, status) values ('00000000-0000-0000-0000-00000000000a', 'verified');
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare n int; oid uuid := (select v::uuid from t where k = 'b_order');
begin
  -- пароль без кода: админом не считается
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from public.orders where id = oid;
  if n <> 0 then raise exception 'ПРОВАЛ: админ с включённой 2FA видит чужие заказы без кода'; end if;
  perform set_config('request.jwt.claims', '{"aal":"aal1"}', true);
  select count(*) into n from public.orders where id = oid;
  if n <> 0 then raise exception 'ПРОВАЛ: уровень aal1 открыл админские права при включённой 2FA'; end if;
  if public.is_admin() then raise exception 'ПРОВАЛ: is_admin() истинно без кода'; end if;
  -- код введён: права вернулись
  perform set_config('request.jwt.claims', '{"aal":"aal2"}', true);
  select count(*) into n from public.orders where id = oid;
  if n <> 1 then raise exception 'ПРОВАЛ: админ с кодом не видит заказы'; end if;
  if not public.is_admin() then raise exception 'ПРОВАЛ: is_admin() ложно после ввода кода'; end if;
end $$;
reset role;
-- у обычного байера 2FA на админство не влияет, а неподтверждённый «код» ничего не блокирует
update auth.mfa_factors set status = 'unverified' where user_id = '00000000-0000-0000-0000-00000000000a';
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
begin
  perform set_config('request.jwt.claims', '{"aal":"aal1"}', true);
  if not public.is_admin() then raise exception 'ПРОВАЛ: неподтверждённый код заблокировал админа'; end if;
end $$;
reset role;
delete from auth.mfa_factors;
\echo '✅ 15. 2FA администратора: без кода админские права не действуют, с кодом и без 2FA — работают'


-- ---------- 16. Витрина байера ----------
set request.uid = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
do $$
declare ws uuid := public.my_workspace_id(); tok text; pid uuid; hid uuid;
begin
  tok := public.request_link_rotate(ws);
  insert into public.shop_products (workspace_id, title, price, currency, description) values (ws, 'Кроссовки Nike', 3500, 'KGS', 'Размеры 39–44') returning id into pid;
  insert into public.shop_products (workspace_id, title, price, is_active) values (ws, 'Скрытый товар', 100, false) returning id into hid;
  insert into t values ('shop_tok', tok), ('shop_pid', pid::text), ('shop_hid', hid::text);
end $$;
reset role;

-- чужой байер не видит и не меняет чужие товары
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.shop_products; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер видит товары витрины'; end if;
  update public.shop_products set price = 1; get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер изменил товар'; end if;
end $$;
reset role;

-- клиент без входа: видит только показанные товары и без лишнего; заказ создаётся с ценой из базы
reset request.uid;
set role anon;
do $$
declare j json; r json; n int;
begin
  begin perform count(*) from public.shop_products; raise exception 'ПРОВАЛ: аноним читает таблицу товаров';
  exception when insufficient_privilege then null; end;
  j := public.get_shop((select v from t where k = 'shop_tok'));
  if json_array_length(j -> 'products') <> 1 then raise exception 'ПРОВАЛ: в витрине не 1 показанный товар'; end if;
  if (j -> 'products' -> 0 ->> 'title') <> 'Кроссовки Nike' then raise exception 'ПРОВАЛ: не тот товар в витрине'; end if;
  if (j -> 'products' -> 0)::jsonb ? 'workspace_id' then raise exception 'ПРОВАЛ: витрина показывает служебные поля'; end if;
  if public.get_shop('00000000000000000000000000000000') is not null then raise exception 'ПРОВАЛ: витрина открылась по чужой ссылке'; end if;
  -- скрытый товар заказать нельзя
  begin perform public.shop_order((select v from t where k = 'shop_tok'), (select v::uuid from t where k = 'shop_hid'), 1, 'Азамат', '+996555777001', null, null, null);
    raise exception 'ПРОВАЛ: заказали скрытый товар';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  r := public.shop_order((select v from t where k = 'shop_tok'), (select v::uuid from t where k = 'shop_pid'), 2, 'Азамат', '+996555777001', null, 'Размер 42', null);
  if not (r ->> 'ok')::boolean then raise exception 'ПРОВАЛ: заказ из витрины не создан'; end if;
  insert into t values ('shop_onum', r ->> 'order_number');
  -- корзина: скрытый товар в списке — отказ; обычный список — один заказ
  begin perform public.shop_order_multi((select v from t where k = 'shop_tok'),
      jsonb_build_array(jsonb_build_object('id', (select v from t where k = 'shop_pid'), 'qty', 1), jsonb_build_object('id', (select v from t where k = 'shop_hid'), 'qty', 1)),
      'Азамат', '+996555777001', null, null, null);
    raise exception 'ПРОВАЛ: корзина приняла скрытый товар';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  r := public.shop_order_multi((select v from t where k = 'shop_tok'),
      jsonb_build_array(jsonb_build_object('id', (select v from t where k = 'shop_pid'), 'qty', 2), jsonb_build_object('id', (select v from t where k = 'shop_pid'), 'qty', 1)),
      'Азамат', '+996555777001', null, null, null);
  if not (r ->> 'ok')::boolean then raise exception 'ПРОВАЛ: заказ из корзины не создан'; end if;
end $$;
reset role;
do $$
declare o record;
begin
  select * into o from public.orders where order_number = (select v from t where k = 'shop_onum') and source = 'request';
  if o.product_ru <> 'Кроссовки Nike' or o.quantity <> 2 then raise exception 'ПРОВАЛ: заказ из витрины с неверным товаром или количеством'; end if;
  if o.admin_comment not like '%3500 KGS%' or o.admin_comment not like '%Размер 42%' then raise exception 'ПРОВАЛ: цена или комментарий не попали в заказ: %', o.admin_comment; end if;
end $$;
-- ссылка отключена — витрина закрыта
set request.uid = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
select public.request_link_revoke(public.my_workspace_id());
reset role;
set role anon;
do $$
begin
  if public.get_shop((select v from t where k = 'shop_tok')) is not null then raise exception 'ПРОВАЛ: витрина работает после отключения ссылки'; end if;
end $$;
reset role;
\echo '✅ 16. Витрина: показывает только видимые товары, цена берётся из базы, чужие и отключённые ссылки закрыты'

-- ---------- 17. Трек-номер и расходы ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
begin
  update public.orders set tracking_number = 'YT1234567890' where id = (select v::uuid from t where k = 'b_order');
  insert into public.expenses (workspace_id, category, amount, currency, note) values (public.my_workspace_id(), 'rent', 15000, 'KGS', 'Склад');
  begin
    insert into public.expenses (workspace_id, amount) values (public.my_workspace_id(), -5);
    raise exception 'ПРОВАЛ: принят отрицательный расход';
  exception when check_violation then null; end;
end $$;
reset role;

-- клиент по ссылке видит трек-номер
do $$
declare tok text; j json;
begin
  select public_token into tok from public.orders where id = (select v::uuid from t where k = 'b_order');
  if tok is null then
    update public.orders set public_token = 'tok_track_0123456789abcdef0123' where id = (select v::uuid from t where k = 'b_order');
    tok := 'tok_track_0123456789abcdef0123';
  end if;
  insert into t values ('trk_tok', tok) on conflict (k) do update set v = excluded.v;
end $$;
set role anon;
do $$
declare j json;
begin
  j := public.get_client_order((select v from t where k = 'trk_tok'));
  if (j ->> 'tracking_number') is distinct from 'YT1234567890' then raise exception 'ПРОВАЛ: клиент не видит трек-номер'; end if;
  if (j::jsonb) ? 'admin_comment' or (j::jsonb) ? 'supplier' then raise exception 'ПРОВАЛ: страница клиента показывает внутренние поля'; end if;
  begin perform count(*) from public.expenses; raise exception 'ПРОВАЛ: аноним читает расходы';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- чужой байер расходы не видит и не меняет
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.expenses; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер видит расходы'; end if;
  update public.expenses set amount = 1; get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер изменил расход'; end if;
  begin
    insert into public.expenses (workspace_id, amount) select id, 1 from public.workspaces where name = 'Б-карго';
  exception when others then null; end;
end $$;
reset role;

-- помощник кабинета Б расходы не видит и не добавляет (снова добавляем его в команду Б)
insert into public.workspace_members (workspace_id, user_id, role)
values ((select v::uuid from t where k = 'tm_ws'), '00000000-0000-0000-0000-0000000000a5', 'staff') on conflict do nothing;
set request.uid = '00000000-0000-0000-0000-0000000000a5';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.expenses; if n <> 0 then raise exception 'ПРОВАЛ: помощник видит расходы'; end if;
  begin
    insert into public.expenses (workspace_id, amount) values ((select v::uuid from t where k = 'tm_ws'), 1);
    raise exception 'ПРОВАЛ: помощник добавил расход';
  exception when insufficient_privilege then null; end;
  select count(*) into n from public.orders where client_name = 'Клиент Б'; if n <> 1 then raise exception 'ПРОВАЛ: помощник не в команде Б — проверка расходов ничего не значит'; end if;
end $$;
reset role;
delete from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000a5' and workspace_id = (select v::uuid from t where k = 'tm_ws');

-- админ видит, но не меняет
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.expenses; if n <> 1 then raise exception 'ПРОВАЛ: админ не видит расходы (%)', n; end if;
  delete from public.expenses; get diagnostics n = row_count; if n <> 0 then raise exception 'ПРОВАЛ: админ удалил расход'; end if;
end $$;
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.expenses where workspace_id = (select v::uuid from t where k = 'tm_ws');
  if n <> 1 then raise exception 'ПРОВАЛ: расход Б пропал или чужой добавился (%)', n; end if;
end $$;
\echo '✅ 17. Трек-номер виден клиенту; расходы видит и меняет только владелец кабинета'

-- ---------- 18. Лимит распознавания фото ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare left_ int; n int;
begin
  left_ := public.ai_photo_take(5);
  if left_ <> 25 then raise exception 'ПРОВАЛ: после 5 фото осталось % вместо 25', left_; end if;
  begin perform public.ai_photo_take(6); raise exception 'ПРОВАЛ: за раз приняли больше 5 фото';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.ai_photo_take(0); raise exception 'ПРОВАЛ: приняли 0 фото';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  for i in 1..5 loop perform public.ai_photo_take(5); end loop;   -- ровно 30
  begin perform public.ai_photo_take(1); raise exception 'ПРОВАЛ: лимит 30 фото в день не сработал';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform count(*) from public.ai_photo_usage; raise exception 'ПРОВАЛ: байер видит таблицу лимитов';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- у другого байера свой лимит; аноним не может
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  if public.ai_photo_take(1) <> 29 then raise exception 'ПРОВАЛ: лимит одного байера списался у другого'; end if;
end $$;
reset role;
reset request.uid;
set role anon;
do $$
begin
  begin perform public.ai_photo_take(1); raise exception 'ПРОВАЛ: аноним получил фото';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
\echo '✅ 18. Фото тетради: лимит 30 в день на человека, не больше 5 за раз, аноним и таблица закрыты'

-- ---------- 19. Telegram клиента: подписки на заказ ----------
insert into public.order_tg_subs (order_id, chat_id, lang) values ((select v::uuid from t where k = 'b_order'), '111222333', 'ru');
insert into public.tg_updates (update_id, chat_id, text) values (1, '111222333', '/start oabc');
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.order_tg_subs; if n <> 1 then raise exception 'ПРОВАЛ: байер не видит подписку своего заказа (%)', n; end if;
  begin insert into public.order_tg_subs (order_id, chat_id) values ((select v::uuid from t where k = 'b_order'), '999'); raise exception 'ПРОВАЛ: байер сам добавил подписку';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.tg_updates; raise exception 'ПРОВАЛ: байер читает сообщения бота';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.order_tg_subs; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер видит подписки'; end if;
end $$;
reset role;
reset request.uid;
set role anon;
do $$
begin
  begin perform count(*) from public.order_tg_subs; raise exception 'ПРОВАЛ: аноним видит подписки';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- новая ссылка клиента — подписка удаляется
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
select public.rotate_client_link((select v::uuid from t where k = 'b_order')) is not null as rotated \gset
reset role;
do $$
declare n int;
begin
  select count(*) into n from public.order_tg_subs where order_id = (select v::uuid from t where k = 'b_order');
  if n <> 0 then raise exception 'ПРОВАЛ: после новой ссылки клиента подписка осталась'; end if;
end $$;
\echo '✅ 19. Telegram клиента: подписки видит только свой байер, менять может только функция, новая ссылка их сбрасывает'

-- ---------- 20. Одна ссылка на все заказы клиента ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
with x as (
  insert into public.orders (client_name, client_phone, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount)
  values ('Айбек', '+996 700 111 222', 'Куртка', 1, 100, 13, 2000, 500),
         ('Айбек Д.', '0700111222', 'Кроссовки', 1, 100, 13, 3000, 3000),
         ('Другой клиент', '+996 555 999 888', 'Чужой товар', 1, 100, 13, 1000, 0)
  returning id, product_ru, order_number)
, a as (insert into t select 'k_' || product_ru, order_number from x)
insert into t select 'kid_' || product_ru, id::text from x;
select public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'get') is null as none_yet \gset
select public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'create') as cab_token \gset
insert into t values ('cab_token', :'cab_token');
reset role;
do $$
begin
  if (select v from t where k = 'cab_token') !~ '^[a-f0-9]{32}$' then raise exception 'ПРОВАЛ: токен общей ссылки неверный'; end if;
end $$;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
begin
  if public.client_cabinet((select v::uuid from t where k = 'kid_Кроссовки'), 'get') <> (select v from t where k = 'cab_token') then
    raise exception 'ПРОВАЛ: у одного клиента (по телефону) разные общие ссылки'; end if;
  if public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'create') <> (select v from t where k = 'cab_token') then
    raise exception 'ПРОВАЛ: повторное создание поменяло токен'; end if;
  if public.client_cabinet((select v::uuid from t where k = 'kid_Чужой товар'), 'get') is not null then
    raise exception 'ПРОВАЛ: у другого клиента появилась ссылка'; end if;
end $$;
reset role;
set role anon;
do $$
declare j json; tok text := (select v from t where k = 'cab_token');
begin
  j := public.get_client_cabinet(tok);
  if json_array_length(j->'orders') <> 2 then raise exception 'ПРОВАЛ: в общей ссылке % заказов вместо 2', json_array_length(j->'orders'); end if;
  if (j->'orders'->0->>'product_ru') = 'Чужой товар' or (j->'orders'->1->>'product_ru') = 'Чужой товар' then
    raise exception 'ПРОВАЛ: в общей ссылке заказ другого клиента'; end if;
  if (j->'debt'->0->>'amount')::numeric <> 1500 then raise exception 'ПРОВАЛ: общий долг неверный: %', j->'debt'; end if;
  if public.get_cabinet_order(tok, (select v from t where k = 'k_Куртка')) is null then raise exception 'ПРОВАЛ: заказ клиента не открывается'; end if;
  if public.get_cabinet_order(tok, (select v from t where k = 'k_Чужой товар')) is not null then raise exception 'ПРОВАЛ: по общей ссылке открылся чужой заказ'; end if;
  if public.get_cabinet_order(tok, 'нет-такого') is not null then raise exception 'ПРОВАЛ: несуществующий заказ'; end if;
  if public.get_client_cabinet('00000000000000000000000000000000') is not null then raise exception 'ПРОВАЛ: чужой токен открылся'; end if;
  if public.get_client_cabinet('abc') is not null then raise exception 'ПРОВАЛ: мусорный токен открылся'; end if;
  begin perform public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'get'); raise exception 'ПРОВАЛ: аноним управляет ссылкой';
  exception when insufficient_privilege then null; end;
  begin perform count(*) from public.client_cabinets; raise exception 'ПРОВАЛ: аноним читает таблицу ссылок';
  exception when insufficient_privilege then null; end;
  begin perform public.client_order_json((select v::uuid from t where k = 'kid_Куртка')); raise exception 'ПРОВАЛ: аноним вызвал внутреннюю функцию';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  begin perform public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'create'); raise exception 'ПРОВАЛ: чужой байер создал ссылку';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'revoke'); raise exception 'ПРОВАЛ: чужой байер отключил ссылку';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform count(*) from public.client_cabinets; raise exception 'ПРОВАЛ: байер читает таблицу ссылок напрямую';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
select public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'revoke') is null as revoked \gset
reset role;
set role anon;
do $$
begin
  if public.get_client_cabinet((select v from t where k = 'cab_token')) is not null then raise exception 'ПРОВАЛ: отключённая ссылка работает'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
begin
  if public.client_cabinet((select v::uuid from t where k = 'kid_Куртка'), 'create') = (select v from t where k = 'cab_token') then
    raise exception 'ПРОВАЛ: после отключения выдан тот же токен'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 20. Общая ссылка клиента: только его заказы (по телефону), чужие закрыты, отключается, таблица и внутренняя функция недоступны'

-- ===== 21. Логотип байера =====
reset role;
insert into t select 'b_ws_id', id::text from public.workspaces where name = 'Б-карго';
insert into t select 'cur_tok', public_token from public.orders where id = (select v::uuid from t where k = 'b_order');
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare ws text := (select v from t where k = 'b_ws_id');
begin
  update public.workspaces set logo_path = ws || '/logo_1.png' where id = ws::uuid;
  if (select logo_path from public.workspaces where id = ws::uuid) is distinct from ws || '/logo_1.png' then
    raise exception 'ПРОВАЛ: владелец не смог задать логотип'; end if;
  begin update public.workspaces set logo_path = '../evil.svg' where id = ws::uuid; raise exception 'ПРОВАЛ: принят странный путь логотипа';
  exception when check_violation then null; end;
  insert into storage.objects (bucket_id, name) values ('logos', ws || '/logo_1.png');
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare ws text := (select v from t where k = 'b_ws_id');
begin
  update public.workspaces set logo_path = ws || '/hack.png' where id = ws::uuid;
  begin insert into storage.objects (bucket_id, name) values ('logos', ws || '/hack.png'); raise exception 'ПРОВАЛ: чужой байер загрузил логотип в чужой кабинет';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$
declare ws text := (select v from t where k = 'b_ws_id');
begin
  if (public.get_client_order((select v from t where k = 'cur_tok'))->'brand'->>'logo') is distinct from ws || '/logo_1.png' then
    raise exception 'ПРОВАЛ: клиент не видит логотип (или чужой байер его подменил)'; end if;
  if (public.get_client_order((select v from t where k = 'cur_tok'))->'brand'->>'name') <> 'Б-карго' then
    raise exception 'ПРОВАЛ: нет названия кабинета у клиента'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 21. Логотип: владелец задаёт, чужой не может, путь проверяется, клиент видит название и логотип'

-- ===== 22. Обмен сом → юань =====
reset role;
-- байер Б прошёл проверку личности (файл 30) — иначе обмен не включить
insert into public.fx_kyc (user_id, workspace_id, full_name, doc_number, front_path, selfie_path, status, consent_at)
select '00000000-0000-0000-0000-0000000000b1', v::uuid, 'Байер Б Тестов', 'AN1234567', 'x/f.jpg', 'x/s.jpg', 'approved', now()
  from t where k = 'b_ws_id';
insert into t select 'cur_tok2', public_token from public.orders where id = (select v::uuid from t where k = 'b_order');
set role anon;
do $$
begin
  -- обмен выключен — заявку не принять, клиент курса не видит
  begin perform public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Азамат', '+996555111222', 2000, null);
    raise exception 'ПРОВАЛ: заявка при выключенном обмене';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  if (public.get_client_order((select v from t where k = 'cur_tok2'))->'brand'->'fx')::text <> 'null' then
    raise exception 'ПРОВАЛ: курс виден при выключенном обмене'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare ws uuid := (select v::uuid from t where k = 'b_ws_id');
begin
  update public.workspaces set fx_on = true, fx_note = 'Мбанк 0555 000 111',
    fx_tiers = '[{"from": 1000, "rate": 12.6}, {"from": 10000, "rate": 12.4}]' where id = ws;
  if (select fx_updated_at from public.workspaces where id = ws) is null then raise exception 'ПРОВАЛ: дата курса не поставилась'; end if;
  begin update public.workspaces set fx_tiers = '[{"from": 0, "rate": -1}]' where id = ws; raise exception 'ПРОВАЛ: принят отрицательный курс';
  exception when check_violation then null; end;
  begin update public.workspaces set fx_tiers = '[{"from": 5, "rate": 12}, {"from": 5, "rate": 11}]' where id = ws; raise exception 'ПРОВАЛ: приняты одинаковые ступени';
  exception when check_violation then null; end;
  begin update public.workspaces set fx_tiers = '{"rate": 12}' where id = ws; raise exception 'ПРОВАЛ: принят курс не списком';
  exception when check_violation then null; end;
  begin perform public.admin_set_platform_fx('[{"from": 0, "rate": 12}]', null); raise exception 'ПРОВАЛ: байер поменял курс админа';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.workspaces set fx_tiers = '[{"from": 0, "rate": 1}]' where id = (select v::uuid from t where k = 'b_ws_id');  -- чужой: строка не меняется
reset role;
set role anon;
do $$
declare r json;
begin
  if (public.get_client_order((select v from t where k = 'cur_tok2'))->'brand'->'fx'->'tiers'->1->>'rate')::numeric <> 12.4 then
    raise exception 'ПРОВАЛ: клиент не видит ступени курса (или чужой байер их поменял)'; end if;
  begin perform public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Азамат', '+996555111222', 500, null);
    raise exception 'ПРОВАЛ: принята сумма меньше минимальной';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Азамат', '+996 555 111 222', 2000, 'вечером');
  if (r->>'som')::numeric <> 25200 or (r->>'rate')::numeric <> 12.6 then raise exception 'ПРОВАЛ: неверная сумма для 2000 ¥ (%)', r; end if;
  if r->>'note' <> 'Мбанк 0555 000 111' then raise exception 'ПРОВАЛ: клиент не получил реквизиты'; end if;
  insert into t values ('fx_req', r->>'id');
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Азамат', '+996555111222', 10000, null);
  if (r->>'som')::numeric <> 124000 then raise exception 'ПРОВАЛ: не сработала ступень от 10 000 ¥ (%)', r; end if;
  begin perform public.submit_exchange('order', '00000000000000000000000000000000', 'Азамат', '+996555111222', 2000, null);
    raise exception 'ПРОВАЛ: заявка по чужой ссылке';
  exception when others then if sqlerrm <> 'link_not_found' then raise; end if; end;
end $$;
do $$
declare i int;
begin
  for i in 1..3 loop
    perform public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Азамат', '+996555111222', 3000, null);
  end loop;
  begin perform public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Азамат', '+996555111222', 3000, null);
    raise exception 'ПРОВАЛ: нет лимита заявок с одного телефона';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform count(*) from public.exchange_requests; raise exception 'ПРОВАЛ: аноним читает заявки';
  exception when insufficient_privilege then null; end;
  begin perform public.ws_brand((select v::uuid from t where k = 'b_ws_id')); raise exception 'ПРОВАЛ: аноним вызвал внутреннюю функцию';
  exception when insufficient_privilege then null; end;
end $$;
-- скриншот оплаты: только к своей свежей заявке
do $$
declare id text := (select v from t where k = 'fx_req');  -- номер заявки
begin
  begin insert into storage.objects (bucket_id, name) values ('fx-proofs', gen_random_uuid()::text || '/p.jpg');
    raise exception 'ПРОВАЛ: загрузка к несуществующей заявке';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('fx-proofs', id || '/../x.svg');
    raise exception 'ПРОВАЛ: принято странное имя файла';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('fx-proofs', id || '/pay1.jpg');
  if not public.fx_attach_proof(id::uuid, id || '/pay1.jpg') then raise exception 'ПРОВАЛ: скриншот не прикрепился'; end if;
  begin perform public.fx_attach_proof(id::uuid, id || '/pay1.jpg'); raise exception 'ПРОВАЛ: скриншот прикреплён дважды';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin insert into storage.objects (bucket_id, name) values ('fx-proofs', id || '/pay2.jpg');
    raise exception 'ПРОВАЛ: загрузка к уже оплаченной заявке';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.exchange_requests; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер видит заявки на обмен'; end if;
  select count(*) into n from storage.objects where bucket_id = 'fx-proofs'; if n <> 0 then raise exception 'ПРОВАЛ: чужой байер видит скриншоты'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.exchange_requests; if n <> 5 then raise exception 'ПРОВАЛ: байер видит % заявок вместо 5', n; end if;
  if (select status from public.exchange_requests where comment = 'вечером') <> 'paid' then raise exception 'ПРОВАЛ: заявка со скриншотом не стала «оплачено»'; end if;
  select count(*) into n from storage.objects where bucket_id = 'fx-proofs'; if n <> 1 then raise exception 'ПРОВАЛ: байер не видит скриншот'; end if;
  update public.exchange_requests set status = 'confirmed' where comment = 'вечером';
  begin update public.exchange_requests set som = 1 where comment = 'вечером'; raise exception 'ПРОВАЛ: байер меняет сумму заявки';
  exception when insufficient_privilege then null; end;
  if (select tiers from public.platform_fx) is not null then raise exception 'ПРОВАЛ: курс админа не пустой'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select public.admin_set_platform_fx('[{"from": 0, "rate": 12.3}, {"from": 5000, "rate": 12.2}]', 'Наличные');
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  if public.fx_rate_for((select tiers from public.platform_fx), 6000) <> 12.2 then raise exception 'ПРОВАЛ: байер не видит курс админа'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 22. Обмен: ступени курса, минимум, лимиты; скриншот только к своей заявке, видит только свой байер; курс админа ставит только админ'

-- ===== 23. Статус заявки на обмен для клиента =====
reset role;
delete from public.exchange_requests where client_phone <> '+996555111222';
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
update public.workspaces set fx_eta = 30 where id = (select v::uuid from t where k = 'b_ws_id');
reset role;
set role anon;
do $$
declare r json; s json; rid uuid;
begin
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Бакыт', '+996777000111', 1500, null);
  rid := (r->>'id')::uuid;
  insert into t values ('fx_req2', rid::text);
  s := public.get_exchange_status(rid);
  if s->>'status' <> 'new' or s->>'note' <> 'Мбанк 0555 000 111' or (s->>'eta')::int <> 30 or not (s->>'can_upload')::boolean then
    raise exception 'ПРОВАЛ: клиент видит неверный статус новой заявки (%)', s; end if;
  if s->>'status_at' is null then raise exception 'ПРОВАЛ: нет времени статуса'; end if;
  if public.get_exchange_status(gen_random_uuid()) is not null then raise exception 'ПРОВАЛ: статус чужой/несуществующей заявки'; end if;
  if s::text like '%client_phone%' or s::text like '%Бакыт%' then raise exception 'ПРОВАЛ: в статусе лишние личные данные'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
update public.exchange_requests set status = 'done' where id = (select v::uuid from t where k = 'fx_req2');  -- чужой: не видит, не меняет
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'fx_req2');
begin
  if (select status from public.exchange_requests where exchange_requests.id = rid) <> 'new' then raise exception 'ПРОВАЛ: чужой байер поменял статус'; end if;
  update public.exchange_requests set status = 'confirmed', eta_until = now() + interval '30 days', buyer_note = 'Отправлю на Alipay'
   where exchange_requests.id = rid;
  if (select eta_until from public.exchange_requests where exchange_requests.id = rid) > now() + interval '7 days 1 minute' then
    raise exception 'ПРОВАЛ: время ожидания больше 7 дней'; end if;
  begin update public.exchange_requests set status = 'lost' where exchange_requests.id = rid; raise exception 'ПРОВАЛ: принят неизвестный статус';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
set role anon;
do $$
declare s json := public.get_exchange_status((select v::uuid from t where k = 'fx_req2'));
begin
  if s->>'status' <> 'confirmed' or s->>'buyer_note' <> 'Отправлю на Alipay' or s->>'eta_until' is null then
    raise exception 'ПРОВАЛ: клиент не видит подтверждение и время (%)', s; end if;
  if s->>'note' is not null or (s->>'can_upload')::boolean then raise exception 'ПРОВАЛ: после подтверждения видны реквизиты/загрузка'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 23. Статус обмена: клиент видит статус, время ожидания и сообщение только своей заявки; менять может только свой байер'

-- ===== 24. Проверка личности обменника =====
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare me text := '00000000-0000-0000-0000-0000000000c1';
begin
  -- без проверки обмен не включить
  begin update public.workspaces set fx_on = true where owner_id = me::uuid; raise exception 'ПРОВАЛ: обмен включён без проверки';
  exception when others then if sqlerrm <> 'kyc_required' then raise; end if; end;
  -- в чужую папку не загрузить, странное имя — нет
  begin insert into storage.objects (bucket_id, name) values ('kyc', '00000000-0000-0000-0000-0000000000b1/f.jpg');
    raise exception 'ПРОВАЛ: загрузка в чужую папку';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('kyc', me || '/../x.svg');
    raise exception 'ПРОВАЛ: принято странное имя';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('kyc', me || '/front1.jpg'), ('kyc', me || '/selfie1.jpg');
  begin perform public.kyc_submit('Байер Втор', 'ID1234567', me || '/front1.jpg', null, me || '/selfie1.jpg', false);
    raise exception 'ПРОВАЛ: принято без согласия';
  exception when others then if sqlerrm <> 'kyc_consent' then raise; end if; end;
  begin perform public.kyc_submit('Байер Втор', '№!', me || '/front1.jpg', null, me || '/selfie1.jpg', true);
    raise exception 'ПРОВАЛ: принят странный номер паспорта';
  exception when others then if sqlerrm <> 'invalid_doc' then raise; end if; end;
  begin perform public.kyc_submit('Байер Втор', 'ID1234567', 'x/f.jpg', null, me || '/selfie1.jpg', true);
    raise exception 'ПРОВАЛ: принят чужой файл';
  exception when others then if sqlerrm <> 'file_not_found' then raise; end if; end;
  if public.kyc_submit(' Байер   Втор ', 'id 123-4567', me || '/front1.jpg', null, me || '/selfie1.jpg', true) <> 'pending' then
    raise exception 'ПРОВАЛ: документы не отправились'; end if;
  if (select doc_number from public.fx_kyc where user_id = me::uuid) <> 'ID1234567'
     or (select full_name from public.fx_kyc where user_id = me::uuid) <> 'Байер Втор' then
    raise exception 'ПРОВАЛ: номер/ФИО записаны неверно'; end if;
  if (select email from public.fx_kyc where user_id = me::uuid) <> 'c@test.kg' then raise exception 'ПРОВАЛ: не сохранилась почта'; end if;
  -- пока проверка идёт, обмен не включить; самому себе статус не поставить
  begin update public.workspaces set fx_on = true where owner_id = me::uuid; raise exception 'ПРОВАЛ: обмен включён до проверки';
  exception when others then if sqlerrm <> 'kyc_required' then raise; end if; end;
  begin update public.fx_kyc set status = 'approved' where user_id = me::uuid; raise exception 'ПРОВАЛ: байер сам себя проверил';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_kyc_decide(me::uuid, true, null); raise exception 'ПРОВАЛ: байер вызвал решение администратора';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_kyc_list(); raise exception 'ПРОВАЛ: байер видит список проверок';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.fx_kyc) <> 1 then raise exception 'ПРОВАЛ: байер видит чужие проверки'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
begin
  if exists (select 1 from public.fx_kyc where user_id <> auth.uid()) then raise exception 'ПРОВАЛ: чужой байер видит паспорт'; end if;
  if exists (select 1 from storage.objects where bucket_id = 'kyc') then raise exception 'ПРОВАЛ: чужой байер видит фото паспорта'; end if;
end $$;
reset role;
set role anon;
do $$
begin
  begin perform count(*) from public.fx_kyc; raise exception 'ПРОВАЛ: аноним читает проверки';
  exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('kyc', '00000000-0000-0000-0000-0000000000c1/a.jpg');
    raise exception 'ПРОВАЛ: аноним загрузил в kyc';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare u uuid := '00000000-0000-0000-0000-0000000000c1'; l json;
begin
  l := public.admin_kyc_list();
  if l->0->>'status' <> 'pending' or l->0->>'ws_name' <> 'В-карго' then raise exception 'ПРОВАЛ: админ не видит заявку на проверку (%)', l; end if;
  if (select count(*) from storage.objects where bucket_id = 'kyc') <> 2 then raise exception 'ПРОВАЛ: админ не видит фото'; end if;
  begin perform public.admin_kyc_decide(u, false, ''); raise exception 'ПРОВАЛ: отказ без причины';
  exception when others then if sqlerrm <> 'reason_required' then raise; end if; end;
  if public.admin_kyc_decide(u, true, null) <> 'approved' then raise exception 'ПРОВАЛ: не одобрилось'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare me text := '00000000-0000-0000-0000-0000000000c1';
begin
  update public.workspaces set fx_on = true where owner_id = me::uuid;
  if not (select fx_on from public.workspaces where owner_id = me::uuid) then raise exception 'ПРОВАЛ: после проверки обмен не включился'; end if;
  begin insert into storage.objects (bucket_id, name) values ('kyc', me || '/front2.jpg');
    raise exception 'ПРОВАЛ: после проверки можно подменить фото';
  exception when insufficient_privilege then null; end;
  begin perform public.kyc_submit('Другой Человек', 'ID7654321', me || '/front1.jpg', null, me || '/selfie1.jpg', true);
    raise exception 'ПРОВАЛ: после проверки можно подменить данные';
  exception when others then if sqlerrm <> 'kyc_done' then raise; end if; end;
  delete from storage.objects where bucket_id = 'kyc';
end $$;
reset role;
do $$
begin
  if (select count(*) from storage.objects where bucket_id = 'kyc') <> 2 then raise exception 'ПРОВАЛ: байер удалил фото паспорта'; end if;
end $$;
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
begin
  if public.admin_kyc_decide('00000000-0000-0000-0000-0000000000c1', false, 'Жалобы клиентов') <> 'revoked' then
    raise exception 'ПРОВАЛ: проверка не снялась'; end if;
end $$;
reset role;
do $$
begin
  if (select fx_on from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000c1') then
    raise exception 'ПРОВАЛ: после снятия проверки обмен остался включён'; end if;
end $$;
reset request.uid;
\echo '✅ 24. Проверка личности: без неё обмен не включить; паспорт видят только сам байер и админ; после проверки данные не подменить; снятие выключает обмен'

-- ===== 25. Обмен как P2P: подтверждение двух сторон и споры =====
reset role;
set role anon;
do $$
declare r json; rid uuid;
begin
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Самат', '+996700111222', 2000, null);
  rid := (r->>'id')::uuid; insert into t values ('p1', rid::text);
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/pay.jpg');
  perform public.fx_attach_proof(rid, rid || '/pay.jpg');
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Эрлан', '+996700333444', 3000, null);
  rid := (r->>'id')::uuid; insert into t values ('p2', rid::text);
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/pay.jpg');
  perform public.fx_attach_proof(rid, rid || '/pay.jpg');
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Нурлан', '+996700555666', 1500, null);
  insert into t values ('p3', r->>'id');
  -- рано: клиент ещё не может спорить, «получил» — только после отправки
  begin perform public.fx_client_received((select v::uuid from t where k = 'p1'), 5); raise exception 'ПРОВАЛ: «получил» до отправки';
  exception when others then if sqlerrm <> 'bad_status' then raise; end if; end;
  begin perform public.fx_dispute_open((select v::uuid from t where k = 'p1'), 'Где мои юани?'); raise exception 'ПРОВАЛ: спор сразу после оплаты';
  exception when others then if sqlerrm <> 'cannot_dispute' then raise; end if; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'p1'); n int;
begin
  begin update public.exchange_requests set status = 'done' where id = rid; raise exception 'ПРОВАЛ: байер сам поставил «выполнено»';
  exception when others then if sqlerrm <> 'bad_status' then raise; end if; end;
  begin update public.exchange_requests set status = 'cancelled' where id = rid; raise exception 'ПРОВАЛ: байер отменил оплаченную заявку';
  exception when others then if sqlerrm <> 'bad_status' then raise; end if; end;
  update public.exchange_requests set status = 'confirmed', eta_until = now() + interval '30 minutes' where id = rid;
  begin perform public.fx_mark_sent(rid, rid || '/nofile1234567890.jpg'); raise exception 'ПРОВАЛ: «отправлены» без скриншота';
  exception when others then if sqlerrm <> 'file_not_found' then raise; end if; end;
  begin insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/short.jpg'); raise exception 'ПРОВАЛ: угадываемое имя файла';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/sentAbcdefgh123456.jpg');
  perform public.fx_mark_sent(rid, rid || '/sentAbcdefgh123456.jpg', 'Отправил на Alipay');
  if (select status from public.exchange_requests where id = rid) <> 'sent' then raise exception 'ПРОВАЛ: не стало «отправлены»'; end if;
  delete from public.exchange_requests where id = rid;
  select count(*) into n from public.exchange_requests where id = rid;
  if n <> 1 then raise exception 'ПРОВАЛ: байер удалил оплаченную заявку'; end if;
  -- заявка 3 не оплачена: отменить можно, а удалить — тоже
  update public.exchange_requests set status = 'cancelled' where id = (select v::uuid from t where k = 'p3');
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'p1');
begin
  begin insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/sentZzzzzzzz123456.jpg'); raise exception 'ПРОВАЛ: чужой байер загрузил в чужую заявку';
  exception when insufficient_privilege then null; end;
  begin perform public.fx_mark_sent(rid, rid || '/sentAbcdefgh123456.jpg'); raise exception 'ПРОВАЛ: чужой байер отметил отправку';
  exception when insufficient_privilege then null; end;
  begin perform public.fx_autoclose_ws((select v::uuid from t where k = 'b_ws_id')); raise exception 'ПРОВАЛ: чужой закрывает сделки';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$
declare rid uuid := (select v::uuid from t where k = 'p1'); s json;
begin
  s := public.get_exchange_status(rid);
  if s->>'status' <> 'sent' or s->>'sent_proof' is null or not (s->>'can_dispute')::boolean or s->>'close_at' is null then
    raise exception 'ПРОВАЛ: клиент не видит отправку (%)', s; end if;
  begin perform public.fx_dispute_open(rid, 'нет'); raise exception 'ПРОВАЛ: спор без причины';
  exception when others then if sqlerrm <> 'invalid_reason' then raise; end if; end;
  if public.fx_dispute_open(rid, 'Юани не пришли на Alipay') <> 'client' then raise exception 'ПРОВАЛ: спор не открылся'; end if;
  begin perform public.fx_dispute_open(rid, 'Ещё раз открыть'); raise exception 'ПРОВАЛ: второй спор';
  exception when others then if sqlerrm <> 'cannot_dispute' then raise; end if; end;
  begin insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/pay2.jpg'); raise exception 'ПРОВАЛ: загрузка не-спорного файла';
  exception when insufficient_privilege then null; end;
  insert into storage.objects (bucket_id, name) values ('fx-proofs', rid || '/d-alipay01.jpg');
  perform public.fx_dispute_post(rid, 'Вот мой Alipay — пусто', rid || '/d-alipay01.jpg');
  begin perform public.fx_dispute_post(rid, null, rid || '/pay.jpg'); raise exception 'ПРОВАЛ: клиент приложил не свой файл спора';
  exception when others then if sqlerrm <> 'file_not_found' then raise; end if; end;
  s := public.get_exchange_status(rid);
  if s->>'dispute' <> 'open' or json_array_length(s->'events') <> 2 then raise exception 'ПРОВАЛ: клиент не видит спор (%)', s; end if;
  if (s->'events'->1->>'file') is not null then raise exception 'ПРОВАЛ: клиенту отдан путь закрытого файла'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'p1'); rid2 uuid := (select v::uuid from t where k = 'p2');
begin
  begin update public.exchange_requests set buyer_note = 'тихо поменял' where id = rid; raise exception 'ПРОВАЛ: байер меняет заявку во время спора';
  exception when others then if sqlerrm <> 'dispute_open' then raise; end if; end;
  insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/chatAbcdefgh123456.jpg');
  perform public.fx_dispute_post(rid, 'Вот выписка Alipay', rid || '/chatAbcdefgh123456.jpg');
  if (select count(*) from public.exchange_events where request_id = rid) < 4 then raise exception 'ПРОВАЛ: байер не видит переписку'; end if;
  if (select count(*) from storage.objects where bucket_id = 'fx-proofs' and name = rid || '/d-alipay01.jpg') <> 1 then
    raise exception 'ПРОВАЛ: байер не видит фото клиента в споре'; end if;
  -- байер открывает спор по оплаченной заявке 2: деньги не пришли
  if public.fx_dispute_open(rid2, 'Деньги не пришли, скриншот поддельный') <> 'buyer' then raise exception 'ПРОВАЛ: байер не открыл спор'; end if;
  begin perform public.admin_fx_resolve(rid, 'buyer', 'сам себе', false); raise exception 'ПРОВАЛ: байер решает спор';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$
begin
  if exists (select 1 from public.exchange_events) then raise exception 'ПРОВАЛ: чужой байер видит переписку'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'p1'); rid2 uuid := (select v::uuid from t where k = 'p2'); l json;
begin
  l := public.admin_fx_disputes();
  if json_array_length(l) <> 2 or l->0->>'dispute' <> 'open' or json_array_length(l->0->'events') < 1 then
    raise exception 'ПРОВАЛ: админ не видит споры (%)', l; end if;
  perform public.fx_dispute_post(rid, 'Пришлите выписку за сегодня', null);
  begin perform public.admin_fx_resolve(rid, 'buyer', ' ', true); raise exception 'ПРОВАЛ: решение без причины';
  exception when others then if sqlerrm <> 'reason_required' then raise; end if; end;
  perform public.admin_fx_resolve(rid, 'buyer', 'Выписка подтверждает перевод', true);
  perform public.admin_fx_resolve(rid2, 'client', 'Оплата видна в банке — отправьте юани', false);
  begin perform public.admin_fx_resolve(rid2, 'buyer', 'передумал', false); raise exception 'ПРОВАЛ: решение дважды';
  exception when others then if sqlerrm <> 'no_dispute' then raise; end if; end;
  l := public.admin_fx_disputes();
  if (l->0->>'strikes')::int <> 1 then raise exception 'ПРОВАЛ: не посчитан спор против байера (%)', l->0->'strikes'; end if;
end $$;
reset role;
do $$
begin
  if (select status from public.exchange_requests where id = (select v::uuid from t where k = 'p1')) <> 'done' then raise exception 'ПРОВАЛ: после решения «прав байер» сделка не закрыта'; end if;
  if (select status from public.exchange_requests where id = (select v::uuid from t where k = 'p2')) <> 'confirmed' then raise exception 'ПРОВАЛ: после «прав клиент» байер не обязан отправить'; end if;
  if not exists (select 1 from public.fx_blacklist where phone = '+996700111222') then raise exception 'ПРОВАЛ: номер не в чёрном списке'; end if;
end $$;
set role anon;
do $$
declare r json; rid uuid;
begin
  begin perform count(*) from public.fx_blacklist; raise exception 'ПРОВАЛ: аноним видит чёрный список';
  exception when insufficient_privilege then null; end;
  r := public.submit_exchange('order', (select v from t where k = 'cur_tok2'), 'Самат', '+996700111222', 1200, null);
  insert into t values ('p4', r->>'id');
  if public.get_exchange_status((select v::uuid from t where k = 'p2'))->>'dispute_result' <> 'client' then
    raise exception 'ПРОВАЛ: клиент не видит решение'; end if;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'p2');
begin
  if not (select client_flag from public.exchange_requests where id = (select v::uuid from t where k = 'p4')) then
    raise exception 'ПРОВАЛ: байер не видит пометку чёрного списка'; end if;
  insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/sentQwertyui123456.jpg');
  perform public.fx_mark_sent(rid, rid || '/sentQwertyui123456.jpg');
end $$;
reset role;
-- клиент молчит 24 часа — сделка закрывается сама
update public.exchange_requests set sent_at = now() - interval '25 hours' where id = (select v::uuid from t where k = 'p2');
set role anon;
do $$
declare rid uuid := (select v::uuid from t where k = 'p2');
begin
  if public.get_exchange_status(rid)->>'status' <> 'done' then raise exception 'ПРОВАЛ: сделка не закрылась через 24 часа'; end if;
end $$;
reset role;
-- клиент подтверждает получение с оценкой
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
do $$
declare rid uuid := (select v::uuid from t where k = 'p4');
begin
  insert into storage.objects (bucket_id, name) values ('fx-sent', rid || '/sentPoiuytre123456.jpg');
  perform public.fx_mark_sent(rid, rid || '/sentPoiuytre123456.jpg');
end $$;
reset role;
set role anon;
do $$
declare rid uuid := (select v::uuid from t where k = 'p4');
begin
  begin perform public.fx_client_received(rid, 9); raise exception 'ПРОВАЛ: оценка 9';
  exception when others then if sqlerrm <> 'bad_rating' then raise; end if; end;
  perform public.fx_client_received(rid, 5);
  if public.get_exchange_status(rid)->>'status' <> 'done' or (public.get_exchange_status(rid)->>'rating')::int <> 5 then
    raise exception 'ПРОВАЛ: «получил» не закрыл сделку'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 25. Обмен P2P: «отправлены» только со скриншотом, «получил» — клиент (или 24 часа); оплаченную не отменить и не удалить; спор: обе стороны, переписка, решение админа, чёрный список'

-- ===== 26. Анонимам — без прямого доступа к таблицам =====
reset role;
do $$
declare n int;
begin
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r'
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert')
          or has_table_privilege('anon', c.oid, 'update') or has_table_privilege('anon', c.oid, 'delete'));
  if n <> 0 then raise exception 'ПРОВАЛ: у анонима есть прямой доступ к % таблицам', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if n <> 0 then raise exception 'ПРОВАЛ: % таблиц без правил строк (RLS)', n; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%');
  if n <> 0 then raise exception 'ПРОВАЛ: % функций с правами владельца без search_path', n; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prokind = 'f'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%');
  if n <> 0 then raise exception 'ПРОВАЛ: % функций без search_path', n; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and (p.prorettype = 'trigger'::regtype or p.proname in ('is_admin', 'is_member', 'is_owner', 'can_read_ws', 'my_workspace_id'));
  if n <> 0 then raise exception 'ПРОВАЛ: аноним может вызвать % служебных функций', n; end if;
end $$;
\echo '✅ 26. Безопасность: у анонима нет прямого доступа к таблицам, у всех таблиц есть RLS, у всех функций задан search_path, служебные функции анониму недоступны'

-- ===== 27. Новости платформы: пишет только админ, читают все вошедшие =====
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
select public.admin_post_news('Тест: новый курс с завтрашнего дня');
do $$
begin
  begin perform public.admin_post_news('   '); raise exception 'ПРОВАЛ: пустая новость принята';
  exception when others then if sqlerrm <> 'empty_news' then raise; end if; end;
end $$;
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
do $$
begin
  if (select count(*) from public.platform_news) <> 1 then raise exception 'ПРОВАЛ: байер не видит новость'; end if;
  begin perform public.admin_post_news('взлом'); raise exception 'ПРОВАЛ: байер опубликовал новость';
  exception when others then if sqlerrm <> 'forbidden' then raise; end if; end;
  begin perform public.admin_delete_news(1); raise exception 'ПРОВАЛ: байер удалил новость';
  exception when others then if sqlerrm <> 'forbidden' then raise; end if; end;
  begin insert into public.platform_news (body) values ('напрямую'); raise exception 'ПРОВАЛ: байер записал в таблицу напрямую';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$
begin
  begin perform count(*) from public.platform_news; raise exception 'ПРОВАЛ: аноним читает новости';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
select public.admin_delete_news((select max(id) from public.platform_news));
do $$ begin if (select count(*) from public.platform_news) <> 0 then raise exception 'ПРОВАЛ: админ не удалил новость'; end if; end $$;
reset role;
reset request.uid;
\echo '✅ 27. Новости: публикует и удаляет только админ, читают вошедшие, аноним и прямая запись закрыты'

-- ===== 28. История курса ULA: пишется сама при смене курса =====
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
select public.admin_set_platform_fx('[{"from":1000,"rate":12.5}]'::jsonb, 'тест');
create temp table h0 as select count(*) as cnt from public.platform_fx_history;
select public.admin_set_platform_fx('[{"from":1000,"rate":12.5}]'::jsonb, 'только заметка');
select public.admin_set_platform_fx('[{"from":1000,"rate":12.4}]'::jsonb, null);
do $$
declare n bigint;
begin
  if (select count(*) from public.platform_fx_history) <> (select cnt from h0) + 1 then
    raise exception 'ПРОВАЛ: история курса записалась неверно'; end if;
  n := public.admin_post_news('Курс обновлён');
  if n is null then raise exception 'ПРОВАЛ: admin_post_news не вернула номер'; end if;
end $$;
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
do $$
begin
  if (select count(*) from public.platform_fx_history) < 2 then raise exception 'ПРОВАЛ: байер не видит историю курса'; end if;
  begin insert into public.platform_fx_history (tiers) values ('[]'); raise exception 'ПРОВАЛ: байер записал в историю';
  exception when insufficient_privilege then null; end;
  begin update public.platform_news set tg_sent_at = now(); raise exception 'ПРОВАЛ: байер изменил новость';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$
begin
  begin perform count(*) from public.platform_fx_history; raise exception 'ПРОВАЛ: аноним читает историю';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
reset request.uid;
\echo '✅ 28. История курса: пишется только при смене ступеней, читают вошедшие, записать вручную нельзя'

-- ===== 29. Страна байера =====
reset role;
reset request.uid;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'e@test.kz', '{"full_name":"Байер Е","phone":"+77010000555","workspace_name":"Е-карго","country":"kz"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'e2@test.kg', '{"full_name":"Байер Ж","phone":"+996555000666","country":"<script>"}');
do $$
begin
  if (select country from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000e1') is distinct from 'KZ' then
    raise exception 'ПРОВАЛ: страна из регистрации не сохранилась'; end if;
  if (select country from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000e2') is not null then
    raise exception 'ПРОВАЛ: мусор вместо страны сохранился'; end if;
end $$;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
update public.workspaces set country = 'KG' where owner_id = '00000000-0000-0000-0000-0000000000b1';
do $$
begin
  if (select country from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000b1') is distinct from 'KG' then
    raise exception 'ПРОВАЛ: владелец не смог указать страну'; end if;
  begin update public.workspaces set country = 'kg1' where owner_id = '00000000-0000-0000-0000-0000000000b1';
    raise exception 'ПРОВАЛ: сохранилась неверная страна';
  exception when check_violation then null; end;
  update public.workspaces set country = 'CN' where owner_id = '00000000-0000-0000-0000-0000000000e1';
  if (select country from public.workspaces w where w.owner_id = '00000000-0000-0000-0000-0000000000e1') is not null
     and exists (select 1 from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000e1' and country = 'CN') then
    raise exception 'ПРОВАЛ: байер поменял страну чужого кабинета'; end if;
  begin perform * from public.admin_list_workspaces(); raise exception 'ПРОВАЛ: байер получил список кабинетов';
  exception when others then if sqlerrm <> 'forbidden' then raise; end if; end;
end $$;
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  if (select country from public.admin_list_workspaces() where owner_id = '00000000-0000-0000-0000-0000000000e1') is distinct from 'KZ' then
    raise exception 'ПРОВАЛ: админ не видит страну в списке'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 29. Страна: берётся из регистрации, мусор отбрасывается, менять может только владелец, в списке у админа есть'

-- ===== 30. Ошибки у пользователей =====
reset role;
reset request.uid;
set role anon;
do $$
begin
  if not public.report_client_error('TypeError: x is undefined', 'https://site/app.js?v=1', 10, 5, 'stack', '/robott/?order=SECRET', '20261118u', 'Chrome', 'ru') then
    raise exception 'ПРОВАЛ: новая ошибка клиента без входа не записалась'; end if;
  if public.report_client_error('TypeError: x is undefined', 'https://site/app.js?v=2', 10, 5) then
    raise exception 'ПРОВАЛ: одинаковая ошибка посчиталась новой'; end if;
  if public.report_client_error('') then raise exception 'ПРОВАЛ: пустая ошибка записалась'; end if;
  begin perform 1 from public.client_errors; raise exception 'ПРОВАЛ: аноним читает ошибки';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_clear_errors(); raise exception 'ПРОВАЛ: аноним очистил ошибки';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
do $$
begin
  perform public.report_client_error('TypeError: x is undefined', 'https://site/app.js', 10, 5);
  if exists (select 1 from public.client_errors) then raise exception 'ПРОВАЛ: байер видит ошибки'; end if;
  begin insert into public.client_errors (fp, message) values ('x', 'y'); raise exception 'ПРОВАЛ: байер пишет в таблицу напрямую';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_clear_errors(); raise exception 'ПРОВАЛ: байер очистил ошибки';
  exception when others then if sqlerrm <> 'forbidden' then raise; end if; end;
  for i in 1..40 loop perform public.report_client_error('flood ' || i); end loop;
end $$;
reset role;
set role authenticated;
set request.uid = '00000000-0000-0000-0000-00000000000a';
do $$
declare r public.client_errors%rowtype;
begin
  select * into r from public.client_errors where message = 'TypeError: x is undefined';
  if r.hits <> 3 or r.anon_hits <> 2 or cardinality(r.user_ids) <> 1 then raise exception 'ПРОВАЛ: неверный счёт ошибок %', r.hits; end if;
  if r.page like '%SECRET%' or r.source like '%?%' then raise exception 'ПРОВАЛ: секретная часть адреса сохранилась'; end if;
  if (select count(*) from public.client_errors) > 30 then raise exception 'ПРОВАЛ: нет защиты от потока ошибок'; end if;
  perform public.admin_clear_errors(r.id);
  if exists (select 1 from public.client_errors where id = r.id) then raise exception 'ПРОВАЛ: админ не удалил ошибку'; end if;
  perform public.admin_clear_errors();
  if exists (select 1 from public.client_errors) then raise exception 'ПРОВАЛ: админ не очистил ошибки'; end if;
end $$;
reset role;
reset request.uid;
\echo '✅ 30. Ошибки: пишут все (одинаковые складываются, поток ограничен, без секретов в адресе), читает и очищает только админ'
