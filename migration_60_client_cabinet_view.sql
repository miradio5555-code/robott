-- =====================================================
-- ULA FACTORY — миграция 60: единый кабинет клиента (общая ссылка)
--
-- ЧТО ДОБАВЛЯЕТСЯ (новой параллельной системы нет — меняются только существующие функции ответа и одна новая форма)
--   1. Способ связи с байером: workspaces.client_contact_phone / client_contact_tg. Пусто, пока владелец сам не укажет
--      (личный телефон из профиля клиентам НЕ отдаётся). Меняет только владелец: ws_set_client_contact; читает участник: ws_client_contact_get.
--   2. get_client_cabinet, client_order_json (заказ внутри общей ссылки) и get_client_order (ссылка отдельного заказа) теперь
--      дополнительно отдают: ожидаемую доставку (delivery_eta_from/to — ДАТЫ в поясе кабинета; пусто = срок не назван),
--      контакт байера и, для общей ссылки, признак «Telegram подписан на этот заказ» (tg_on — только да/нет, без чата).
--      Всё остальное — как в файле 56: закупочных цен, прибыли, внутренних заметок и служебных данных в ответе нет.
--      Неразобранная предоплата (client_id пустой) по-прежнему не попадает никому.
--   3. save_cabinet_client_info(токен, номер заказа, …): клиент по ОБЩЕЙ ссылке может указать адрес, только если у ЕГО клиента
--      ещё нет карточки (город пуст). Существующую карточку, чужого клиента, завершённый заказ он не меняет; ключ поиска
--      совпадений и client_card_ok не трогаются (защита файла 56 сохраняется). Ссылка заказа ведёт себя как раньше.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: файл 59 запущен. Как запустить: SQL Editor → вставить весь файл → Run (одним запросом; при ошибке
-- откатывается всё). Можно запускать повторно. Сайт без файла 60 работает: показывает кабинет без срока доставки, контакта и формы адреса.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 59) then
    raise exception 'СТОП: сначала запустите миграцию 59 (ежедневная работа). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 60) then
    raise exception 'СТОП: файл 60 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Контакт байера для клиентов (только то, что владелец указал сам)
alter table public.workspaces add column if not exists client_contact_phone text;
alter table public.workspaces add column if not exists client_contact_tg    text;
alter table public.workspaces drop constraint if exists workspaces_contact_phone_fmt;
alter table public.workspaces add  constraint workspaces_contact_phone_fmt
  check (client_contact_phone is null or client_contact_phone ~ '^\+?[0-9]{9,15}$');
alter table public.workspaces drop constraint if exists workspaces_contact_tg_fmt;
alter table public.workspaces add  constraint workspaces_contact_tg_fmt
  check (client_contact_tg is null or client_contact_tg ~ '^[A-Za-z0-9_]{5,32}$');

create or replace function public.ws_client_contact_get(p_ws uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select json_build_object('phone', w.client_contact_phone, 'telegram', w.client_contact_tg) from public.workspaces w where w.id = p_ws);
end;
$$;
revoke all on function public.ws_client_contact_get(uuid) from public, anon, authenticated;
grant execute on function public.ws_client_contact_get(uuid) to authenticated;

create or replace function public.ws_set_client_contact(p_ws uuid, p_phone text, p_telegram text)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g'), '');
  v_tg    text := nullif(regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then raise exception 'invalid_telegram' using errcode = '22023'; end if;
  update public.workspaces set client_contact_phone = v_phone, client_contact_tg = v_tg where id = p_ws;
  return json_build_object('phone', v_phone, 'telegram', v_tg);
end;
$$;
revoke all on function public.ws_set_client_contact(uuid, text, text) from public, anon, authenticated;
grant execute on function public.ws_set_client_contact(uuid, text, text) to authenticated;

-- то, что видит клиент: пусто, если владелец ничего не указал
create or replace function public._cabinet_contact(p_ws uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when w.client_contact_phone is null and w.client_contact_tg is null then null
              else json_build_object('phone', w.client_contact_phone, 'telegram', w.client_contact_tg) end
    from public.workspaces w where w.id = p_ws;
$$;
revoke all on function public._cabinet_contact(uuid) from public, anon, authenticated;


-- 2. Общая ссылка: список заказов
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
  if v_ws is null or v_client is null then   -- ссылка отключена: клиент ещё не подтверждён
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
          'total_som',       l.total_som,
          'paid_amount',     l.paid_amount,
          'balance_som',     l.balance_som,
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
               where status <> 'cancelled' and balance_som > 0
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


-- 3. Заказ внутри общей ссылки (тело — как в файле 56 + срок, контакт, подписка; карточка клиента — его собственная)
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
    'total_som',       o.total_som,
    'paid_amount',     o.paid_amount,
    'balance_som',     o.balance_som,
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


-- 4. Ссылка отдельного заказа: то же + срок и контакт. Карточка — только если client_card_ok (как в файле 56).
--    Ответ НЕ содержит общей ссылки и признаков её наличия.
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
    'total_som',       o.total_som,
    'paid_amount',     o.paid_amount,
    'balance_som',     o.balance_som,
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


-- 5. Адрес по общей ссылке: только заполнить ПУСТУЮ карточку своего клиента
create or replace function public.save_cabinet_client_info(
  p_token        text,
  p_order_number text,
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
  v_ws     uuid;
  v_client uuid;
  v_status text;
  v_has    boolean;
  v_name   text := btrim(coalesce(p_name, ''));
  v_city   text := btrim(coalesce(p_city, ''));
  v_addr   text := nullif(btrim(coalesce(p_address, '')), '');
  v_pickup text := nullif(btrim(coalesce(p_pickup_point, '')), '');
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_tg     text := nullif(regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
begin
  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  select workspace_id, client_id into v_ws, v_client from public.client_cabinets where token = p_token;
  if v_ws is null or v_client is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  select o.status into v_status from public.orders o
   where o.workspace_id = v_ws and o.client_id = v_client and o.order_number = p_order_number
   limit 1;
  if v_status is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_status in ('delivered', 'cancelled') then
    raise exception 'order_locked' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then raise exception 'invalid_telegram' using errcode = '22023'; end if;
  if char_length(v_city) not between 2 and 80 then raise exception 'invalid_city' using errcode = '22023'; end if;
  if (v_addr is null) = (v_pickup is null) then raise exception 'invalid_place' using errcode = '22023'; end if;
  if v_addr is not null and char_length(v_addr) not between 5 and 300 then raise exception 'invalid_place' using errcode = '22023'; end if;
  if v_pickup is not null and char_length(v_pickup) not between 2 and 200 then raise exception 'invalid_place' using errcode = '22023'; end if;

  select (c.city is not null) into v_has from public.clients c
   where c.id = v_client and c.workspace_id = v_ws for update;
  if v_has is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if v_has then raise exception 'card_exists' using errcode = 'P0001'; end if;

  update public.clients
     set name = v_name, phone = v_phone, telegram = v_tg, city = v_city, address = v_addr, pickup_point = v_pickup
   where id = v_client;

  return json_build_object('name', v_name, 'phone', v_phone, 'telegram', v_tg,
                           'city', v_city, 'address', v_addr, 'pickup_point', v_pickup);
end;
$$;
revoke all on function public.save_cabinet_client_info(text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_cabinet_client_info(text, text, text, text, text, text, text, text) to anon, authenticated;


-- ✅ ОТМЕТКА: файл 60 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (60, 'migration_60_client_cabinet_view.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
