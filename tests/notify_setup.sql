-- Подготовка для теста очереди уведомлений (до файла 57): «старые» заказы, подписки и история статусов.
\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.kg', '{"full_name":"Байер Б","phone":"+996555000111","workspace_name":"Б-карго"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test.kg', '{"full_name":"Байер В","phone":"+996555000222","workspace_name":"В-карго"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test.kg', '{"full_name":"Помощник","phone":"+996555000333","workspace_name":"Д-карго"}');
-- помощник (staff) кабинета Б
insert into public.workspace_members (workspace_id, user_id, role)
  select workspace_id, '00000000-0000-0000-0000-0000000000d1', 'staff' from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b1' and role = 'owner';

create table public._t (k text primary key, v text);
grant all on public._t to authenticated, anon, service_role;

set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
with x as (
  insert into public.orders (client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, supplier, admin_comment, tracking_number, status)
  values ('Клиент Б', 'Кроссовки', 2, 111.11, 13, 3000, 1000, 'СЕКРЕТНЫЙ-ПОСТАВЩИК', 'ВНУТРЕННЯЯ-ЗАМЕТКА', 'TRK-777', 'new') returning id)
insert into public._t select 'o1', id::text from x;
with x as (
  insert into public.orders (client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, status)
  values ('Клиент Б2', 'Футболка', 1, 10, 13, 500, 0, 'in_transit') returning id)
insert into public._t select 'o3', id::text from x;
reset role;

set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
with x as (
  insert into public.orders (client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, admin_comment, status)
  values ('Чужой клиент', 'Чужой товар', 1, 10, 13, 500, 0, 'ЗАМЕТКА-ЧУЖОГО-КАБИНЕТА', 'new') returning id)
insert into public._t select 'o2', id::text from x;
reset role;

-- подписки клиентов в Telegram (создаёт функция telegram-notify): два чата на заказе 1, один на заказе 3, один у чужого кабинета
insert into public.order_tg_subs (order_id, chat_id, lang, last_status) values
  ((select v::uuid from public._t where k = 'o1'), '1001', 'ru', 'new'),
  ((select v::uuid from public._t where k = 'o1'), '1002', 'en', 'new'),
  ((select v::uuid from public._t where k = 'o3'), '1003', 'zh', 'in_transit'),
  ((select v::uuid from public._t where k = 'o2'), '2001', 'ru', 'new');
-- «старая история»: статусы меняются ДО установки очереди — событий для них быть не должно
update public.orders set status = 'arrived' where id = (select v::uuid from public._t where k = 'o3');
update public.orders set status = 'delivered' where id = (select v::uuid from public._t where k = 'o3');
