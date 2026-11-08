-- =====================================================
-- ULA FACTORY — миграция 64: путь заказа для клиента (10 этапов, срок «в пути», история с комментарием)
--
-- ЗАЧЕМ. Клиенту мало 8 статусов: он хочет видеть «выкупаем», «выкуплено», «готовим к отправке», «в местной доставке»…
-- Статусы заказа (orders.status) НЕ меняются: на них держатся отчёты, долги, очередь уведомлений (файл 57) и сроки (файл 58).
-- Этот файл добавляет к статусу необязательное УТОЧНЕНИЕ — этап для клиента:
--   • orders.track_stage — один из 10 этапов; null = этап выводится из статуса (так у всех старых заказов);
--   • orders.shipped_at — дата отправки из Китая; transit_days_min / transit_days_max — обычный срок пути в днях;
--     по ним считается «в пути N дней» и ориентировочная дата прибытия, трек-номер для этого не нужен;
--   • orders.ship_to — город / страна назначения, как её видит клиент (например «Бишкек, Кыргызстан»);
--   • order_status_history: событие 'stage' (этап и публичный комментарий байера в этот момент).
--     Пишет только триггер; комментарий берётся из orders.client_comment, который клиент и так видит.
-- Смена этапа сама по себе НИЧЕГО не отправляет: очередь уведомлений (файл 57) реагирует только на смену status.
--
-- Публичные ответы (get_client_order, client_order_json → get_cabinet_order) дополнительно отдают только:
--   track_stage, shipped_at, transit_days_min, transit_days_max, ship_to и события 'stage' (этап, комментарий, время).
-- Себестоимость, прибыль, поставщик, внутренний комментарий (admin_comment) и кто менял — не отдаются, как и раньше.
-- Остальная часть ответов скопирована из файла 61 без изменений.
--
-- СОВМЕСТИМОСТЬ. Старая версия сайта новые поля не читает; событие 'stage' она покажет как статус (new_status заполняется).
-- Новая версия сайта без этого файла выводит этап из статуса и прячет блок «Путь заказа» у байера.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 63.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё).
-- Можно запускать повторно. Существующие данные не меняются.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 63) then
    raise exception 'СТОП: сначала запустите файл 63. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 64) then
    raise exception 'СТОП: файл 64 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Поля заказа
alter table public.orders add column if not exists track_stage      text;
alter table public.orders add column if not exists shipped_at       date;
alter table public.orders add column if not exists transit_days_min smallint;
alter table public.orders add column if not exists transit_days_max smallint;
alter table public.orders add column if not exists ship_to          text;

alter table public.orders drop constraint if exists orders_track_stage_chk;
alter table public.orders add constraint orders_track_stage_chk check (track_stage is null or track_stage in (
  'accepted',      -- Заявка принята
  'buying',        -- Выкуп товара
  'bought',        -- Товар выкуплен
  'cn_warehouse',  -- На складе в Китае
  'packing',       -- Подготовка к отправке
  'shipped',       -- Отправлен из Китая
  'arrived_dest',  -- Прибыл в страну назначения
  'local',         -- Передан на доставку по городу
  'ready',         -- Готов к выдаче
  'received'       -- Получен клиентом
));
alter table public.orders drop constraint if exists orders_transit_days_chk;
alter table public.orders add constraint orders_transit_days_chk check (
  (transit_days_min is null or transit_days_min between 1 and 180)
  and (transit_days_max is null or transit_days_max between 1 and 180)
  and (transit_days_min is null or transit_days_max is null or transit_days_min <= transit_days_max));
alter table public.orders drop constraint if exists orders_ship_to_chk;
alter table public.orders add constraint orders_ship_to_chk check (ship_to is null or char_length(ship_to) between 1 and 120);
alter table public.orders drop constraint if exists orders_shipped_at_chk;
alter table public.orders add constraint orders_shipped_at_chk check (shipped_at is null or shipped_at >= date '2020-01-01');


-- 2. История: событие «этап» с публичным комментарием
alter table public.order_status_history add column if not exists stage text;
alter table public.order_status_history add column if not exists note  text;
alter table public.order_status_history drop constraint if exists order_status_history_event_type_check;
alter table public.order_status_history add constraint order_status_history_event_type_check
  check (event_type in ('status', 'payment', 'address', 'stage'));
alter table public.order_status_history drop constraint if exists order_status_history_note_check;
alter table public.order_status_history add constraint order_status_history_note_check
  check (note is null or char_length(note) <= 500);

-- Запись делает только триггер (браузер в историю не пишет — права как в файле 11).
-- Событие — когда байер сменил этап или публичный комментарий. Пустой комментарий без смены этапа события не создаёт.
create or replace function public._orders_stage_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text := nullif(btrim(coalesce(new.client_comment, '')), '');
  v_stage_changed boolean := new.track_stage is distinct from old.track_stage;
  v_note_changed boolean := new.client_comment is distinct from old.client_comment;
begin
  if not v_stage_changed and not (v_note_changed and v_note is not null) then
    return new;
  end if;
  insert into public.order_status_history(order_id, workspace_id, event_type, new_status, stage, note, changed_by)
  values (new.id, new.workspace_id, 'stage', new.status, new.track_stage,
          case when v_note_changed then left(v_note, 500) end, auth.uid());
  return new;
end;
$$;
revoke all on function public._orders_stage_history() from public, anon, authenticated;
drop trigger if exists orders_stage_history on public.orders;
create trigger orders_stage_history after update of track_stage, client_comment on public.orders
  for each row execute function public._orders_stage_history();


-- 3. Публичные ответы (файл 61 + поля пути заказа)
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
    'transit_days_min', o.transit_days_min,
    'transit_days_max', o.transit_days_max,
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
    'transit_days_min', o.transit_days_min,
    'transit_days_max', o.transit_days_max,
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


-- ✅ ОТМЕТКА: файл 64 запущен
insert into public.schema_migrations (version, name) values (64, 'migration_64_tracking_stages.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
