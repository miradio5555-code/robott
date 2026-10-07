-- =====================================================
-- ULA FACTORY — миграция 04: валюты и WeChat поставщика
--
-- Что делает:
--   • в заказе: WeChat поставщика;
--   • в заказе: валюта закупки (у поставщика) и валюта для клиента.
--     Байер выбирает их сам — система работает в любой стране;
--   • курс в заказе = сколько единиц валюты клиента за 1 единицу валюты закупки;
--   • в настройках кабинета: валюты по умолчанию для новых заказов;
--   • страница клиента показывает суммы в валюте клиента.
--
-- Колонки goods_som / total_som / balance_som оставлены со старыми именами,
-- чтобы ничего не сломать. Теперь они означают «в валюте клиента».
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_03_buyer_phone.sql. Можно запускать повторно.
-- ВАЖНО: если когда-нибудь повторно запускаете 01 — после него снова запустите 04.
-- =====================================================


-- 1. ЗАКАЗ: WeChat поставщика и валюты
alter table public.orders add column if not exists supplier_wechat   text;
alter table public.orders add column if not exists purchase_currency text not null default 'CNY';
alter table public.orders add column if not exists client_currency   text not null default 'KGS';

alter table public.orders drop constraint if exists orders_supplier_wechat_len;
alter table public.orders add  constraint orders_supplier_wechat_len
  check (supplier_wechat is null or char_length(supplier_wechat) <= 100);

-- код валюты — три латинские заглавные буквы (CNY, USD, KGS, RUB, KZT…)
alter table public.orders drop constraint if exists orders_purchase_currency_fmt;
alter table public.orders add  constraint orders_purchase_currency_fmt check (purchase_currency ~ '^[A-Z]{3}$');
alter table public.orders drop constraint if exists orders_client_currency_fmt;
alter table public.orders add  constraint orders_client_currency_fmt   check (client_currency   ~ '^[A-Z]{3}$');


-- 2. КАБИНЕТ: валюты по умолчанию для новых заказов
alter table public.workspaces add column if not exists default_purchase_currency text not null default 'CNY';
alter table public.workspaces add column if not exists default_client_currency   text not null default 'KGS';

alter table public.workspaces drop constraint if exists workspaces_def_purchase_fmt;
alter table public.workspaces add  constraint workspaces_def_purchase_fmt check (default_purchase_currency ~ '^[A-Z]{3}$');
alter table public.workspaces drop constraint if exists workspaces_def_client_fmt;
alter table public.workspaces add  constraint workspaces_def_client_fmt   check (default_client_currency   ~ '^[A-Z]{3}$');

-- владелец кабинета может менять и эти настройки
grant update (name, order_prefix, warehouse_address, warehouse_contacts,
              default_purchase_currency, default_client_currency)
  on public.workspaces to authenticated;


-- 3. СТРАНИЦА КЛИЕНТА: добавлена валюта клиента.
--    Валюту закупки, цену у поставщика, курс и WeChat поставщика клиент НЕ видит.
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
    'delivery_cost',   o.delivery_cost,
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
