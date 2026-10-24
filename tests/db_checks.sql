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
  if n < 22 then raise exception 'ПРОВАЛ: в schema_migrations отмечено только % файлов', n; end if;
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
