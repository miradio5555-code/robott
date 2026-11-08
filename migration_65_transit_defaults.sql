-- =====================================================
-- ULA FACTORY — миграция 65: обычный срок доставки кабинета (Настройки → «Срок доставки для клиентов»)
--
-- ЗАЧЕМ. В файле 64 срок «в пути от … до … дней» вписывается в каждом заказе; не вписан — клиент видит «10–20 дней».
-- Теперь владелец задаёт свой обычный срок один раз в Настройках, и клиенты всех заказов без своего срока видят его.
--   • workspaces.default_transit_min / default_transit_max (1–180, от ≤ до; пусто = как раньше, 10–20).
--   • Менять может только владелец кабинета (те же правила, что у остальных настроек кабинета).
--   • get_client_order и client_order_json отдают срок заказа, если у заказа заданы оба поля, иначе — срок кабинета.
--     Остальное в ответах — без изменений (как в файле 64). Данные заказов не меняются.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 64.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 64) then
    raise exception 'СТОП: сначала запустите файл 64. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 65) then
    raise exception 'СТОП: файл 65 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Обычный срок кабинета
alter table public.workspaces add column if not exists default_transit_min smallint;
alter table public.workspaces add column if not exists default_transit_max smallint;
alter table public.workspaces drop constraint if exists workspaces_default_transit_chk;
alter table public.workspaces add constraint workspaces_default_transit_chk check (
  (default_transit_min is null or default_transit_min between 1 and 180)
  and (default_transit_max is null or default_transit_max between 1 and 180)
  and (default_transit_min is null or default_transit_max is null or default_transit_min <= default_transit_max));
-- право менять только эти два столбца; кто может менять строку кабинета, решают прежние правила (владелец)
grant update (default_transit_min, default_transit_max) on public.workspaces to authenticated;


-- 2. Публичные ответы (как в файле 64; срок — свой у заказа или обычный срок кабинета)
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
    'track_stage',      o.track_stage,
    'shipped_at',       o.shipped_at,
    -- свой срок заказа (оба поля) или обычный срок кабинета из Настроек (файл 65)
    'transit_days_min', case when o.transit_days_min is not null and o.transit_days_max is not null then o.transit_days_min else w.default_transit_min end,
    'transit_days_max', case when o.transit_days_min is not null and o.transit_days_max is not null then o.transit_days_max else w.default_transit_max end,
    'ship_to',          o.ship_to,
    'tg_on',           exists (select 1 from public.order_tg_subs s where s.order_id = o.id),
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object(
        'event_type', h.event_type,
        'status', h.new_status,
        'paid_total', h.paid_total,
        'stage', h.stage,
        'note', h.note,
        'created_at', h.created_at
      ) order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id and h.event_type in ('status', 'payment', 'stage')
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
    'track_stage',      o.track_stage,
    'shipped_at',       o.shipped_at,
    -- свой срок заказа (оба поля) или обычный срок кабинета из Настроек (файл 65)
    'transit_days_min', case when o.transit_days_min is not null and o.transit_days_max is not null then o.transit_days_min else w.default_transit_min end,
    'transit_days_max', case when o.transit_days_min is not null and o.transit_days_max is not null then o.transit_days_max else w.default_transit_max end,
    'ship_to',          o.ship_to,
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object(
        'event_type', h.event_type,
        'status', h.new_status,
        'paid_total', h.paid_total,
        'stage', h.stage,
        'note', h.note,
        'created_at', h.created_at
      ) order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id and h.event_type in ('status', 'payment', 'stage')
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


-- ✅ ОТМЕТКА: файл 65 запущен
insert into public.schema_migrations (version, name) values (65, 'migration_65_transit_defaults.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
