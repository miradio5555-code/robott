-- =====================================================
-- ULA FACTORY — миграция 07: цена для клиента и прибыль байера
--
-- Что делает:
--   • в заказе появляется «Цена для клиента» (client_price) — сколько байер берёт с клиента;
--   • база сама считает (всё в валюте клиента):
--       cost_som    — себестоимость = товар + доставка (видит только байер)
--       total_som   — к оплате клиентом = цена для клиента (если не указана — себестоимость)
--       balance_som — осталось оплатить = к оплате − оплачено
--       profit_som  — прибыль = цена для клиента − себестоимость (видит только байер)
--   • клиент по ссылке видит ТОЛЬКО: к оплате, оплачено, осталось.
--     Цену у поставщика, доставку, курсы, себестоимость и прибыль клиент НЕ видит.
--
-- Старые заказы: цены для клиента нет → «к оплате» = себестоимость, как было раньше.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_06_open_signup.sql. Можно запускать повторно.
-- ВАЖНО: если когда-нибудь повторно запускаете 01, 04 или 05 — после них снова запустите 07.
-- =====================================================


-- 1. Цена для клиента (в валюте клиента). Пусто = ещё не указана.
alter table public.orders add column if not exists client_price numeric(14,2);

alter table public.orders drop constraint if exists orders_client_price_pos;
alter table public.orders add  constraint orders_client_price_pos
  check (client_price is null or client_price >= 0);


-- 2. Расчётные колонки (пересоздаются, данные в них считает сама база)
alter table public.orders drop column if exists balance_som;
alter table public.orders drop column if exists total_som;
alter table public.orders drop column if exists profit_som;
alter table public.orders drop column if exists cost_som;

-- себестоимость = товар в валюте клиента + доставка в валюте клиента
alter table public.orders add column cost_som numeric generated always as
  (quantity * unit_price_cny * exchange_rate + delivery_cost * delivery_rate) stored;

-- к оплате клиентом = цена для клиента (если не указана — себестоимость)
alter table public.orders add column total_som numeric generated always as
  (coalesce(client_price, quantity * unit_price_cny * exchange_rate + delivery_cost * delivery_rate)) stored;

-- осталось оплатить
alter table public.orders add column balance_som numeric generated always as
  (coalesce(client_price, quantity * unit_price_cny * exchange_rate + delivery_cost * delivery_rate) - paid_amount) stored;

-- прибыль (пусто, пока не указана цена для клиента)
alter table public.orders add column profit_som numeric generated always as
  (client_price - (quantity * unit_price_cny * exchange_rate + delivery_cost * delivery_rate)) stored;


-- 3. СТРАНИЦА КЛИЕНТА: только к оплате, оплачено, осталось.
create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
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
    'updated_at',      o.updated_at,
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
