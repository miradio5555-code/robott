-- =====================================================
-- ULA FACTORY — миграция 05: международная доставка
--
-- Что делает:
--   • валюта закупки у поставщика — только USD или CNY;
--   • доставка считается в своей валюте (обычно USD):
--       сумма доставки = вес × тариф за кг (можно вписать вручную),
--       затем переводится в валюту клиента по курсу доставки;
--   • итог для клиента = товар (в валюте клиента) + доставка (в валюте клиента);
--   • в настройках кабинета: валюта доставки и тариф за кг по умолчанию.
--
-- Старые заказы НЕ меняют свои итоги: их доставка уже была в валюте клиента,
-- поэтому для них валюта доставки = валюта клиента, курс = 1.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_04_currency.sql. Можно запускать повторно.
-- ВАЖНО: если когда-нибудь повторно запускаете 01 или 04 — после них снова запустите 05.
-- =====================================================


-- 1. ВАЛЮТА ЗАКУПКИ: только доллар или юань
update public.workspaces set default_purchase_currency = 'CNY'
 where default_purchase_currency not in ('CNY', 'USD');

alter table public.orders drop constraint if exists orders_purchase_currency_fmt;
alter table public.orders drop constraint if exists orders_purchase_currency_allowed;
alter table public.orders add  constraint orders_purchase_currency_allowed
  check (purchase_currency in ('CNY', 'USD'));

alter table public.workspaces drop constraint if exists workspaces_def_purchase_fmt;
alter table public.workspaces drop constraint if exists workspaces_def_purchase_allowed;
alter table public.workspaces add  constraint workspaces_def_purchase_allowed
  check (default_purchase_currency in ('CNY', 'USD'));


-- 2. ДОСТАВКА В ЗАКАЗЕ
-- delivery_cost   — сумма доставки в валюте доставки (было: в валюте клиента)
-- delivery_currency — валюта доставки (USD, CNY или валюта клиента)
-- delivery_tariff — тариф за 1 кг в валюте доставки (для подсказки и расчёта)
-- delivery_rate   — сколько единиц валюты клиента за 1 единицу валюты доставки
alter table public.orders add column if not exists delivery_currency text;
alter table public.orders add column if not exists delivery_tariff   numeric(12,2) not null default 0;
alter table public.orders add column if not exists delivery_rate     numeric(12,4) not null default 1;

-- старые заказы: доставка была в валюте клиента → курс 1, итоги не меняются
update public.orders
   set delivery_currency = client_currency, delivery_rate = 1
 where delivery_currency is null;

alter table public.orders alter column delivery_currency set default 'USD';
alter table public.orders alter column delivery_currency set not null;

alter table public.orders drop constraint if exists orders_delivery_currency_fmt;
alter table public.orders add  constraint orders_delivery_currency_fmt check (delivery_currency ~ '^[A-Z]{3}$');
alter table public.orders drop constraint if exists orders_delivery_tariff_pos;
alter table public.orders add  constraint orders_delivery_tariff_pos  check (delivery_tariff >= 0);
alter table public.orders drop constraint if exists orders_delivery_rate_pos;
alter table public.orders add  constraint orders_delivery_rate_pos    check (delivery_rate >= 0);


-- 3. ИТОГИ ПЕРЕСЧИТЫВАЮТСЯ С УЧЁТОМ КУРСА ДОСТАВКИ
-- Расчётные колонки пересоздаются (данные в них считает сама база).
alter table public.orders drop column if exists balance_som;
alter table public.orders drop column if exists total_som;
alter table public.orders drop column if exists delivery_som;

-- доставка в валюте клиента
alter table public.orders add column delivery_som numeric generated always as
  (delivery_cost * delivery_rate) stored;
-- итого = товар в валюте клиента + доставка в валюте клиента
alter table public.orders add column total_som numeric generated always as
  (quantity * unit_price_cny * exchange_rate + delivery_cost * delivery_rate) stored;
-- остаток = итого − оплачено
alter table public.orders add column balance_som numeric generated always as
  (quantity * unit_price_cny * exchange_rate + delivery_cost * delivery_rate - paid_amount) stored;


-- 4. НАСТРОЙКИ КАБИНЕТА: доставка по умолчанию
alter table public.workspaces add column if not exists default_delivery_currency text not null default 'USD';
alter table public.workspaces add column if not exists default_delivery_tariff   numeric(12,2) not null default 0;

alter table public.workspaces drop constraint if exists workspaces_def_delivery_fmt;
alter table public.workspaces add  constraint workspaces_def_delivery_fmt check (default_delivery_currency ~ '^[A-Z]{3}$');
alter table public.workspaces drop constraint if exists workspaces_def_tariff_pos;
alter table public.workspaces add  constraint workspaces_def_tariff_pos  check (default_delivery_tariff >= 0);

grant update (name, order_prefix, warehouse_address, warehouse_contacts,
              default_purchase_currency, default_client_currency,
              default_delivery_currency, default_delivery_tariff)
  on public.workspaces to authenticated;


-- 5. СТРАНИЦА КЛИЕНТА: доставка в своей валюте и в валюте клиента.
--    Тариф за кг, цену у поставщика, курс товара и WeChat поставщика клиент НЕ видит.
create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'order_number',      o.order_number,
    'order_date',        o.order_date,
    'product_ru',        o.product_ru,
    'product_zh',        o.product_zh,
    'quantity',          o.quantity,
    'weight_kg',         o.weight_kg,
    'status',            o.status,
    'client_currency',   o.client_currency,
    'delivery_currency', o.delivery_currency,
    'delivery_cost',     o.delivery_cost,
    'delivery_som',      o.delivery_som,
    'total_som',         o.total_som,
    'paid_amount',       o.paid_amount,
    'balance_som',       o.balance_som,
    'delivery_info',     o.delivery_info,
    'client_comment',    o.client_comment,
    'updated_at',        o.updated_at,
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

-- ГОТОВО ✅
