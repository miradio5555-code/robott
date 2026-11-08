-- =====================================================
-- ТЕСТ ПЕРЕНОСА КЛИЕНТОВ, часть 1: «старая» база (после файла 51, до файла 56) с трудными данными.
-- Запускается скриптом tests/client_identity_test.sh во временной базе. В настоящую базу НЕ запускать.
-- =====================================================
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.kg', '{"full_name":"Байер Б","phone":"+996555000111","workspace_name":"Б-карго"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.kg', '{"full_name":"Байер В","phone":"+996555000222","workspace_name":"В-карго"}')
  on conflict do nothing;
select id as w1 from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000b1' \gset
select id as w2 from public.workspaces where owner_id = '00000000-0000-0000-0000-0000000000c1' \gset

create temp table t (k text primary key, v text);
create temp table ord (k text primary key, id uuid, tok text);
grant all on t, ord to anon, authenticated;

-- заказ: имя, телефон, цена для клиента, оплачено
create function pg_temp.mk(p_k text, p_ws uuid, p_name text, p_phone text, p_price numeric, p_paid numeric, p_cur text default 'KGS')
returns void language plpgsql as $$
declare v_id uuid; v_tok text;
begin
  insert into public.orders (workspace_id, client_name, client_phone, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, client_currency)
  values (p_ws, p_name, p_phone, 'Товар ' || p_k, 1, 10, 12, p_price, p_paid, p_cur)
  returning id, public_token into v_id, v_tok;
  insert into ord values (p_k, v_id, v_tok);
end $$;

-- A. один «ключ» на двух разных людей: разные страны, одинаковые последние 9 цифр
select pg_temp.mk('o1', :'w1', 'Айбек', '+996700111222', 5000, 2000);
select pg_temp.mk('o2', :'w1', 'Aibek RU', '+7700111222', 3000, 0);
-- B. один человек: одинаковый полный номер, имена записаны по-разному
select pg_temp.mk('o3', :'w1', 'Нурлан', '+996 555 000 111', 1000, 400);
select pg_temp.mk('o4', :'w1', 'Нурлан К.', '+996555000111', 2000, 0);
-- C. два «Азиза» без телефона
select pg_temp.mk('o5', :'w1', 'Азиз', null, 800, 0);
select pg_temp.mk('o6', :'w1', 'Азиз', null, 900, 100);
-- D. единственный клиент без телефона
select pg_temp.mk('o7', :'w1', 'Одинокий', null, 700, 0);
-- E. номер без кода страны и с кодом, одинаковые последние 9 цифр
select pg_temp.mk('o8', :'w1', 'Местный', '0700555666', 100, 0);
select pg_temp.mk('o9', :'w1', 'Местный', '+996700555666', 100, 0);
-- F. клиент с карточкой (адрес) и заказ без карточки с тем же полным номером
select pg_temp.mk('o10', :'w1', 'Карточка', '+996777888999', 1500, 500);
select pg_temp.mk('o11', :'w1', 'Карточка К', '+996 777 888 999', 2500, 0);
insert into public.clients (id, workspace_id, name, phone, city, pickup_point)
  values ('11111111-1111-1111-1111-111111111111', :'w1', 'Карточка Клиент', '+996777888999', 'Бишкек', 'Пункт 1');
update public.orders set client_id = '11111111-1111-1111-1111-111111111111' where id = (select id from ord where k = 'o10');
-- G. тот же человек (тот же номер) у ДРУГОГО байера
select pg_temp.mk('o12', :'w2', 'Айбек', '+996700111222', 1200, 200);
-- H. неполные данные
select pg_temp.mk('o13', :'w1', 'x', null, null, 0);
select pg_temp.mk('o14', :'w1', 'Мусорный телефон', 'abc', 100, 0);
-- I. валюты: юани у того же клиента B
select pg_temp.mk('o15', :'w1', 'Нурлан', '+996555000111', 300, 100, 'CNY');

-- предоплата по старым ключам: пополнения, оплата заказа, возврат
create function pg_temp.w(p_ws uuid, p_phone text, p_name text, p_cur text, p_amt numeric, p_kind text, p_order text default null)
returns void language plpgsql as $$
begin
  insert into public.client_wallet (workspace_id, ckey, client_name, currency, amount, kind, order_id, order_number)
  select p_ws, public.client_key(p_phone, p_name), p_name, p_cur, p_amt, p_kind, o.id, o.order_number
    from (select 1) z left join public.orders o on o.id = (select id from ord where k = p_order);
end $$;
select pg_temp.w(:'w1', '+996700111222', 'Айбек', 'KGS', 5000, 'deposit');
select pg_temp.w(:'w1', '+996700111222', 'Айбек', 'KGS', -2000, 'order', 'o1');
select pg_temp.w(:'w1', '+996700111222', 'Айбек', 'KGS', 500, 'return', 'o1');
select pg_temp.w(:'w1', '+996555000111', 'Нурлан', 'KGS', 3000, 'deposit');
select pg_temp.w(:'w1', '+996555000111', 'Нурлан', 'KGS', -400, 'order', 'o3');
select pg_temp.w(:'w1', '+996555000111', 'Нурлан', 'CNY', 50, 'deposit');
select pg_temp.w(:'w1', null, 'Азиз', 'KGS', 1000, 'deposit');
select pg_temp.w(:'w1', null, 'Одинокий', 'KGS', 700, 'deposit');
select pg_temp.w(:'w1', '0700555666', 'Местный', 'KGS', 100, 'deposit');
select pg_temp.w(:'w1', '+996777888999', 'Карточка Клиент', 'KGS', 900, 'deposit');
select pg_temp.w(:'w1', '+996777888999', 'Карточка Клиент', 'KGS', -500, 'order', 'o10');
select pg_temp.w(:'w1', '+996 111 000 999', 'Призрак', 'KGS', 77, 'deposit');          -- деньги без единого клиента
select pg_temp.w(:'w2', '+996700111222', 'Айбек', 'KGS', 200, 'deposit');

-- общие ссылки по старым ключам
insert into public.client_cabinets (workspace_id, ckey, token) values
  (:'w1', public.client_key('+996700111222', 'Айбек'),  'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'),   -- A: два человека
  (:'w1', public.client_key('+996555000111', 'Нурлан'), 'a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2'),   -- B: один человек
  (:'w1', public.client_key(null, 'Азиз'),              'a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3'),   -- C: два Азиза
  (:'w1', public.client_key('+996777888999', 'К'),      'a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4'),   -- F: карточка
  (:'w2', public.client_key('+996700111222', 'Айбек'),  'a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5');   -- G: другой кабинет

-- снимок «до»
create table public._snap_orders as
  select o.id, k.k, o.workspace_id, o.client_currency, o.paid_amount, o.balance_som, o.order_number, o.public_token
    from public.orders o join ord k on k.id = o.id;
create table public._snap_wallet as select * from public.client_wallet;
create table public._snap_cab as
  select token, workspace_id,
         array(select x->>'order_number' from json_array_elements(public.get_client_cabinet(token)->'orders') x order by 1) as nums
    from public.client_cabinets;
create table public._snap_order_pages as
  select k.k, md5(public.get_client_order(o.public_token)::text) as h
    from public.orders o join ord k on k.id = o.id;
