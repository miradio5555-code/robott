-- =====================================================
-- ULA FACTORY — миграция 01: клиенты и адрес доставки
--
-- Как запустить: Supabase → SQL Editor → New query →
-- вставить весь этот файл → Run.
-- Можно запускать повторно, старые данные не пострадают.
-- Сначала должен быть выполнен supabase_schema.sql.
-- =====================================================


-- 1. ТАБЛИЦА КЛИЕНТОВ --------------------------------
-- Храним только то, что нужно для доставки. Ничего лишнего.
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,   -- ФИО
  phone        text not null,   -- телефон, только цифры и + в начале
  telegram     text,            -- логин Telegram без @ (необязательно)
  city         text not null,   -- город
  address      text,            -- адрес доставки (если доставка по адресу)
  pickup_point text,            -- пункт выдачи (если самовывоз)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Проверки прямо в базе: даже если обойти сайт, мусор не сохранится
  constraint clients_name_len   check (char_length(name) between 2 and 120),
  constraint clients_phone_fmt  check (phone ~ '^\+?[0-9]{9,15}$'),
  constraint clients_tg_fmt     check (telegram is null or telegram ~ '^[A-Za-z0-9_]{5,32}$'),
  constraint clients_city_len   check (char_length(city) between 2 and 80),
  constraint clients_addr_len   check (address is null or char_length(address) between 5 and 300),
  constraint clients_pickup_len check (pickup_point is null or char_length(pickup_point) between 2 and 200),
  -- ровно одно из двух: либо адрес, либо пункт выдачи
  constraint clients_one_place  check ((address is null) <> (pickup_point is null))
);

create index if not exists clients_phone_idx   on public.clients(phone);
create index if not exists clients_created_idx on public.clients(created_at desc);

-- updated_at обновляется сам (функция уже есть в основной схеме)
drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();


-- 2. СВЯЗЬ ЗАКАЗА С КЛИЕНТОМ -------------------------
-- Если клиента удалить, заказ останется, просто без привязки.
alter table public.orders
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists orders_client_idx on public.orders(client_id);


-- 3. ЗАЩИТА (Row Level Security) ---------------------
-- Посетитель без входа (anon) НЕ может читать или менять
-- таблицу клиентов напрямую. Совсем. Только через функции ниже,
-- и только по секретному токену своего заказа.
alter table public.clients enable row level security;

revoke all on public.clients from anon;

-- Админ видит и меняет всех клиентов
drop policy if exists "clients: admin full access" on public.clients;
create policy "clients: admin full access"
  on public.clients for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 4. СТРАНИЦА КЛИЕНТА: ПОКАЗ ЗАКАЗА ------------------
-- То же, что было, плюс данные клиента, привязанного
-- ИМЕННО к этому заказу. Чужих клиентов функция не отдаёт.
create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'order_number',   o.order_number,
    'order_date',     o.order_date,
    'product_ru',     o.product_ru,
    'product_zh',     o.product_zh,
    'quantity',       o.quantity,
    'weight_kg',      o.weight_kg,
    'status',         o.status,
    'delivery_cost',  o.delivery_cost,
    'total_som',      o.total_som,
    'paid_amount',    o.paid_amount,
    'balance_som',    o.balance_som,
    'delivery_info',  o.delivery_info,
    'client_comment', o.client_comment,
    'updated_at',     o.updated_at,
    'photos', coalesce(
      (select json_agg(p.storage_path order by p.created_at)
         from public.order_photos p
        where p.order_id = o.id),
      '[]'::json),
    'client', (
      select json_build_object(
        'name',         c.name,
        'phone',        c.phone,
        'telegram',     c.telegram,
        'city',         c.city,
        'address',      c.address,
        'pickup_point', c.pickup_point)
      from public.clients c
      where c.id = o.client_id)
  )
  from public.orders o
  where o.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_client_order(text) from public, anon, authenticated;
grant execute on function public.get_client_order(text) to anon, authenticated;


-- 5. СТРАНИЦА КЛИЕНТА: СОХРАНЕНИЕ ДАННЫХ -------------
-- Клиент присылает токен своего заказа и свои данные.
-- Функция:
--   • находит заказ ТОЛЬКО по токену (без токена ничего не сделать);
--   • если у заказа ещё нет клиента — создаёт нового и привязывает;
--   • если клиент уже есть — меняет ТОЛЬКО его.
-- Поиска по телефону нет специально: иначе можно было бы
-- ввести чужой номер и получить чужие данные.
-- Завершённые и отменённые заказы менять нельзя.
create or replace function public.save_client_info(
  p_token        text,
  p_name         text,
  p_phone        text,
  p_telegram     text,
  p_city         text,
  p_address      text,
  p_pickup_point text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_status    text;
  v_client_id uuid;

  -- убираем лишние пробелы
  v_name   text := btrim(coalesce(p_name, ''));
  v_city   text := btrim(coalesce(p_city, ''));
  v_addr   text := nullif(btrim(coalesce(p_address, '')), '');
  v_pickup text := nullif(btrim(coalesce(p_pickup_point, '')), '');
  -- телефон: убираем пробелы, скобки, точки и дефисы
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  -- Telegram: убираем https://t.me/ и @ в начале
  v_tg     text := nullif(
    regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
begin
  -- 00996... → +996...
  if v_phone like '00%' then
    v_phone := '+' || substr(v_phone, 3);
  end if;

  -- токен должен выглядеть как настоящий (32 символа 0-9, a-f)
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  -- находим заказ и блокируем строку на время сохранения
  select id, status, client_id
    into v_order_id, v_status, v_client_id
    from public.orders
   where public_token = p_token
   for update;

  if v_order_id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_status in ('delivered', 'cancelled') then
    raise exception 'order_locked' using errcode = 'P0001';
  end if;

  -- проверки (такие же, как на сайте)
  if char_length(v_name) not between 2 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then
    raise exception 'invalid_telegram' using errcode = '22023';
  end if;
  if char_length(v_city) not between 2 and 80 then
    raise exception 'invalid_city' using errcode = '22023';
  end if;
  if (v_addr is null) = (v_pickup is null) then
    raise exception 'invalid_place' using errcode = '22023';
  end if;
  if v_addr is not null and char_length(v_addr) not between 5 and 300 then
    raise exception 'invalid_place' using errcode = '22023';
  end if;
  if v_pickup is not null and char_length(v_pickup) not between 2 and 200 then
    raise exception 'invalid_place' using errcode = '22023';
  end if;

  if v_client_id is null then
    -- у заказа ещё нет клиента: создаём и привязываем
    insert into public.clients (name, phone, telegram, city, address, pickup_point)
    values (v_name, v_phone, v_tg, v_city, v_addr, v_pickup)
    returning id into v_client_id;

    update public.orders set client_id = v_client_id where id = v_order_id;
  else
    -- клиент уже привязан: обновляем только его
    update public.clients
       set name = v_name, phone = v_phone, telegram = v_tg,
           city = v_city, address = v_addr, pickup_point = v_pickup
     where id = v_client_id;
  end if;

  return json_build_object(
    'name', v_name, 'phone', v_phone, 'telegram', v_tg,
    'city', v_city, 'address', v_addr, 'pickup_point', v_pickup);
end;
$$;

revoke all on function public.save_client_info(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_client_info(text, text, text, text, text, text, text)
  to anon, authenticated;

-- ГОТОВО ✅
