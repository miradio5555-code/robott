-- =====================================================
-- ULA FACTORY — миграция 61: цена для клиента и адрес доставки конкретного заказа
--
-- ЗАЧЕМ (два найденных недостатка файлов 07/56/60)
--   1. Когда «цена для клиента» не назначена, orders.total_som подставляет СЕБЕСТОИМОСТЬ
--      (количество × цена в юанях × курс + доставка × курс доставки), а balance_som = эта себестоимость − оплачено.
--      Публичные ответы (общая ссылка, ссылка заказа) отдавали эти два поля как есть: клиент мог видеть
--      закупочную стоимость (с внутренним курсом внутри) как «сумму заказа» и «долг».
--   2. Форма адреса по ссылке отдельного заказа могла создать НОВУЮ карточку клиента и перепривязать заказ
--      (orders.client_id), убрав его из общего кабинета.
--
-- ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ
--   Цена (внутреннее и публичное разделены на сервере):
--     • внутренние столбцы total_som / balance_som / profit_som НЕ меняются — байер и отчёты считают как раньше;
--     • публичные функции (get_client_cabinet, get_cabinet_order → client_order_json, get_client_order) теперь отдают
--       price_set (true/false); total_som и balance_som — ТОЛЬКО когда цена назначена, иначе null (не 0 и не себестоимость);
--       paid_amount (реальные платежи) отдаётся всегда; «долг» по валютам считается только по заказам с назначенной ценой.
--     • Назначение, изменение и снятие цены сразу меняют публичный ответ; история платежей и статусов не трогается.
--   Адрес (отдельная таблица на заказ, второй системы клиентов или баланса нет):
--     • public.order_delivery — одна запись на заказ: данные получателя и место доставки, state = 'proposed' (предложение клиента,
--       ждёт проверки байера) или 'confirmed' (байер принял). Клиентов, заказы, предоплату и ключи совпадений эта таблица не меняет.
--     • save_client_info (ссылка заказа) и save_cabinet_client_info (общая ссылка) только пишут предложение В ЭТОТ заказ;
--       клиента, client_id, client_card_ok, предоплату и чужие карточки они больше не трогают. Принятый байером адрес
--       клиент по ссылке уже не перезаписывает (delivery_confirmed).
--     • Байер (участник кабинета): order_delivery_get — читает; order_delivery_review(заказ, 'confirm' | 'reject') — принимает или отклоняет.
--     • get_client_order / client_order_json возвращают delivery (только этого заказа) с state; client — как раньше.
--     • Объединение клиентов заказ не теряет: запись привязана к заказу, а не к клиенту.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: файл 60 запущен. Как запустить: SQL Editor → вставить весь файл → Run (одним запросом; при ошибке
-- откатывается всё). Можно запускать повторно. Сайт без файла 61 работает как раньше, но тогда публичные ответы по-прежнему
-- содержат себестоимость — файл 61 обязателен до выпуска для клиентов.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 60) then
    raise exception 'СТОП: сначала запустите миграцию 60 (кабинет клиента). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 61) then
    raise exception 'СТОП: файл 61 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Адрес доставки конкретного заказа
create table if not exists public.order_delivery (
  order_id     uuid primary key references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 120),
  phone        text not null check (phone ~ '^\+?[0-9]{9,15}$'),
  telegram     text check (telegram is null or telegram ~ '^[A-Za-z0-9_]{5,32}$'),
  city         text not null check (char_length(city) between 2 and 80),
  address      text check (address is null or char_length(address) between 5 and 300),
  pickup_point text check (pickup_point is null or char_length(pickup_point) between 2 and 200),
  state        text not null default 'proposed' check (state in ('proposed', 'confirmed')),
  source       text not null check (source in ('order_link', 'cabinet')),
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid,
  check ((address is null) <> (pickup_point is null))
);
create index if not exists order_delivery_ws_idx on public.order_delivery (workspace_id, state);
alter table public.order_delivery enable row level security;   -- политик нет: доступ только через функции ниже
revoke all on public.order_delivery from public, anon, authenticated;

-- общая запись предложения (внутренняя; клиентам не выдаётся)
create or replace function public._order_delivery_put(
  p_order uuid, p_name text, p_phone text, p_telegram text, p_city text, p_address text, p_pickup_point text, p_source text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_status text;
  v_state  text;
  v_name   text := btrim(coalesce(p_name, ''));
  v_city   text := btrim(coalesce(p_city, ''));
  v_addr   text := nullif(btrim(coalesce(p_address, '')), '');
  v_pickup text := nullif(btrim(coalesce(p_pickup_point, '')), '');
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_tg     text := nullif(regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
begin
  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;
  select o.workspace_id, o.status into v_ws, v_status from public.orders o where o.id = p_order for update;
  if v_ws is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_status in ('delivered', 'cancelled') then raise exception 'order_locked' using errcode = 'P0001'; end if;

  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then raise exception 'invalid_telegram' using errcode = '22023'; end if;
  if char_length(v_city) not between 2 and 80 then raise exception 'invalid_city' using errcode = '22023'; end if;
  if (v_addr is null) = (v_pickup is null) then raise exception 'invalid_place' using errcode = '22023'; end if;
  if v_addr is not null and char_length(v_addr) not between 5 and 300 then raise exception 'invalid_place' using errcode = '22023'; end if;
  if v_pickup is not null and char_length(v_pickup) not between 2 and 200 then raise exception 'invalid_place' using errcode = '22023'; end if;

  select d.state into v_state from public.order_delivery d where d.order_id = p_order for update;
  if v_state = 'confirmed' then raise exception 'delivery_confirmed' using errcode = 'P0001'; end if;

  insert into public.order_delivery (order_id, workspace_id, name, phone, telegram, city, address, pickup_point, state, source)
  values (p_order, v_ws, v_name, v_phone, v_tg, v_city, v_addr, v_pickup, 'proposed', p_source)
  on conflict (order_id) do update
    set name = excluded.name, phone = excluded.phone, telegram = excluded.telegram, city = excluded.city,
        address = excluded.address, pickup_point = excluded.pickup_point, state = 'proposed', source = excluded.source,
        submitted_at = now(), reviewed_at = null, reviewed_by = null;

  return json_build_object('name', v_name, 'phone', v_phone, 'telegram', v_tg, 'city', v_city,
                           'address', v_addr, 'pickup_point', v_pickup, 'state', 'proposed');
end;
$$;
revoke all on function public._order_delivery_put(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

-- ссылка отдельного заказа: предложение в ЭТОТ заказ; клиент и заказ не перепривязываются
create or replace function public.save_client_info(
  p_token text, p_name text, p_phone text, p_telegram text, p_city text, p_address text, p_pickup_point text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  select o.id into v_id from public.orders o where o.public_token = p_token;
  if v_id is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  return public._order_delivery_put(v_id, p_name, p_phone, p_telegram, p_city, p_address, p_pickup_point, 'order_link');
end;
$$;
revoke all on function public.save_client_info(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_client_info(text, text, text, text, text, text, text) to anon, authenticated;

-- общая ссылка: то же, но только для заказа СВОЕГО клиента (отключённая ссылка не принимает ничего)
create or replace function public.save_cabinet_client_info(
  p_token text, p_order_number text, p_name text, p_phone text, p_telegram text, p_city text, p_address text, p_pickup_point text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client uuid;
  v_id     uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  select workspace_id, client_id into v_ws, v_client from public.client_cabinets where token = p_token;
  if v_ws is null or v_client is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  select o.id into v_id from public.orders o
   where o.workspace_id = v_ws and o.client_id = v_client and o.order_number = p_order_number limit 1;
  if v_id is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  return public._order_delivery_put(v_id, p_name, p_phone, p_telegram, p_city, p_address, p_pickup_point, 'cabinet');
end;
$$;
revoke all on function public.save_cabinet_client_info(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_cabinet_client_info(text, text, text, text, text, text, text, text) to anon, authenticated;

-- байер: прочитать и принять / отклонить
create or replace function public.order_delivery_get(p_order uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.orders where id = p_order;
  if v_ws is null or not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select json_build_object('name', d.name, 'phone', d.phone, 'telegram', d.telegram, 'city', d.city,
                                   'address', d.address, 'pickup_point', d.pickup_point, 'state', d.state,
                                   'source', d.source, 'submitted_at', d.submitted_at)
            from public.order_delivery d where d.order_id = p_order);
end;
$$;
revoke all on function public.order_delivery_get(uuid) from public, anon, authenticated;
grant execute on function public.order_delivery_get(uuid) to authenticated;

create or replace function public.order_delivery_review(p_order uuid, p_action text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_n  int;
begin
  select workspace_id into v_ws from public.orders where id = p_order;
  if v_ws is null or not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action = 'confirm' then
    update public.order_delivery set state = 'confirmed', reviewed_at = now(), reviewed_by = auth.uid() where order_id = p_order;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'no_delivery' using errcode = 'P0002'; end if;
    return json_build_object('state', 'confirmed');
  elsif p_action = 'reject' then
    delete from public.order_delivery where order_id = p_order;
    get diagnostics v_n = row_count;
    if v_n = 0 then raise exception 'no_delivery' using errcode = 'P0002'; end if;
    return json_build_object('state', null);
  end if;
  raise exception 'invalid_action' using errcode = '22023';
end;
$$;
revoke all on function public.order_delivery_review(uuid, text) from public, anon, authenticated;
grant execute on function public.order_delivery_review(uuid, text) to authenticated;


-- 2. Общая ссылка: список заказов (сумма и долг — только при назначенной цене)
create or replace function public.get_client_cabinet(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client uuid;
  v_tz     text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select workspace_id, client_id into v_ws, v_client from public.client_cabinets where token = p_token;
  if v_ws is null or v_client is null then
    return null;
  end if;
  select time_zone into v_tz from public.workspaces where id = v_ws;

  return (
    with mine as (
      select o.*
        from public.orders o
       where o.workspace_id = v_ws and o.client_id = v_client
    ), lim as (
      select * from mine order by order_date desc, created_at desc limit 300
    )
    select json_build_object(
      'brand', public.ws_brand(v_ws),
      'contact', public._cabinet_contact(v_ws),
      'name', (select c.name from public.clients c where c.id = v_client),
      'card', (select c.city is not null from public.clients c where c.id = v_client),
      'orders', coalesce((
        select json_agg(json_build_object(
          'order_number',    l.order_number,
          'order_date',      l.order_date,
          'product_ru',      l.product_ru,
          'quantity',        l.quantity,
          'status',          l.status,
          'tracking_number', l.tracking_number,
          'client_currency', l.client_currency,
          'price_set',       l.client_price is not null,
          'total_som',       case when l.client_price is not null then l.total_som end,
          'paid_amount',     l.paid_amount,
          'balance_som',     case when l.client_price is not null then l.balance_som end,
          'delivery_state',  (select d.state from public.order_delivery d where d.order_id = l.id),
          'delivery_eta_from', to_char(l.delivery_eta_from at time zone v_tz, 'YYYY-MM-DD'),
          'delivery_eta_to',   to_char(l.delivery_eta_to   at time zone v_tz, 'YYYY-MM-DD'),
          'tg_on',           exists (select 1 from public.order_tg_subs s where s.order_id = l.id),
          'photo', (select p.storage_path from public.order_photos p where p.order_id = l.id order by p.created_at limit 1)
        ) order by l.order_date desc, l.created_at desc)
        from lim l), '[]'::json),
      'debt', coalesce((
        select json_agg(json_build_object('currency', cur, 'amount', amt) order by cur)
        from (select coalesce(client_currency, 'KGS') as cur, sum(balance_som) as amt
                from mine
               where status <> 'cancelled' and client_price is not null and balance_som > 0
               group by 1) d), '[]'::json),
      'wallet', coalesce((
        select json_agg(json_build_object('currency', currency, 'amount', amt) order by currency)
        from (select currency, sum(amount) as amt from public.client_wallet
               where workspace_id = v_ws and client_id = v_client group by currency having sum(amount) <> 0) b), '[]'::json),
      'wallet_ops', coalesce((
        select json_agg(json_build_object('kind', kind, 'amount', amount, 'currency', currency,
                                          'order_number', order_number, 'created_at', created_at) order by created_at desc)
        from (select * from public.client_wallet
               where workspace_id = v_ws and client_id = v_client order by created_at desc limit 50) z), '[]'::json)
    )
  );
end;
$$;
revoke all on function public.get_client_cabinet(text) from public, anon, authenticated;
grant execute on function public.get_client_cabinet(text) to anon, authenticated;


-- 3. Заказ внутри общей ссылки
create or replace function public.client_order_json(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', public.ws_brand(o.workspace_id),
    'contact', public._cabinet_contact(o.workspace_id),
    'order_number',    o.order_number,
    'order_date',      o.order_date,
    'product_ru',      o.product_ru,
    'product_zh',      o.product_zh,
    'quantity',        o.quantity,
    'weight_kg',       o.weight_kg,
    'status',          o.status,
    'client_currency', o.client_currency,
    'price_set',       o.client_price is not null,
    'total_som',       case when o.client_price is not null then o.total_som end,
    'paid_amount',     o.paid_amount,
    'balance_som',     case when o.client_price is not null then o.balance_som end,
    'delivery_info',   o.delivery_info,
    'client_comment',  o.client_comment,
    'tracking_number', o.tracking_number,
    'delivery_eta_from', to_char(o.delivery_eta_from at time zone w.time_zone, 'YYYY-MM-DD'),
    'delivery_eta_to',   to_char(o.delivery_eta_to   at time zone w.time_zone, 'YYYY-MM-DD'),
    'tg_on',           exists (select 1 from public.order_tg_subs s where s.order_id = o.id),
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object(
        'event_type', h.event_type,
        'status', h.new_status,
        'paid_total', h.paid_total,
        'created_at', h.created_at
      ) order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id and h.event_type in ('status', 'payment')
    ), '[]'::json),
    'photos', coalesce(
      (select json_agg(p.storage_path order by p.created_at)
         from public.order_photos p where p.order_id = o.id),
      '[]'::json),
    'delivery', (
      select json_build_object('name', d.name, 'phone', d.phone, 'telegram', d.telegram, 'city', d.city,
                               'address', d.address, 'pickup_point', d.pickup_point, 'state', d.state)
        from public.order_delivery d where d.order_id = o.id),
    'client', (
      select json_build_object(
        'name', c.name, 'phone', c.phone, 'telegram', c.telegram,
        'city', c.city, 'address', c.address, 'pickup_point', c.pickup_point)
      from public.clients c where c.id = o.client_id and c.city is not null)
  )
  from public.orders o
  join public.workspaces w on w.id = o.workspace_id
  where o.id = p_id;
$$;
revoke all on function public.client_order_json(uuid) from public, anon, authenticated;


-- 4. Ссылка отдельного заказа. Карточку клиента — только если client_card_ok (как в файле 56); адрес этого заказа — всегда свой.
create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', public.ws_brand(o.workspace_id),
    'contact', public._cabinet_contact(o.workspace_id),
    'order_number',    o.order_number,
    'order_date',      o.order_date,
    'product_ru',      o.product_ru,
    'product_zh',      o.product_zh,
    'quantity',        o.quantity,
    'weight_kg',       o.weight_kg,
    'status',          o.status,
    'client_currency', o.client_currency,
    'price_set',       o.client_price is not null,
    'total_som',       case when o.client_price is not null then o.total_som end,
    'paid_amount',     o.paid_amount,
    'balance_som',     case when o.client_price is not null then o.balance_som end,
    'delivery_info',   o.delivery_info,
    'client_comment',  o.client_comment,
    'tracking_number', o.tracking_number,
    'delivery_eta_from', to_char(o.delivery_eta_from at time zone w.time_zone, 'YYYY-MM-DD'),
    'delivery_eta_to',   to_char(o.delivery_eta_to   at time zone w.time_zone, 'YYYY-MM-DD'),
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object(
        'event_type', h.event_type,
        'status', h.new_status,
        'paid_total', h.paid_total,
        'created_at', h.created_at
      ) order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id and h.event_type in ('status', 'payment')
    ), '[]'::json),
    'photos', coalesce(
      (select json_agg(p.storage_path order by p.created_at)
         from public.order_photos p where p.order_id = o.id),
      '[]'::json),
    'delivery', (
      select json_build_object('name', d.name, 'phone', d.phone, 'telegram', d.telegram, 'city', d.city,
                               'address', d.address, 'pickup_point', d.pickup_point, 'state', d.state)
        from public.order_delivery d where d.order_id = o.id),
    'client', (
      select json_build_object(
        'name', c.name, 'phone', c.phone, 'telegram', c.telegram,
        'city', c.city, 'address', c.address, 'pickup_point', c.pickup_point)
      from public.clients c where c.id = o.client_id and c.city is not null and o.client_card_ok)
  )
  from public.orders o
  join public.workspaces w on w.id = o.workspace_id
  where o.public_token = p_token
  limit 1;
$$;
revoke all on function public.get_client_order(text) from public, anon, authenticated;
grant execute on function public.get_client_order(text) to anon, authenticated;


-- ✅ ОТМЕТКА: файл 61 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (61, 'migration_61_price_and_delivery.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
