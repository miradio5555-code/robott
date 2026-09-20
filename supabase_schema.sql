-- =====================================================
-- CARGO CHINA — схема базы данных для Supabase
-- Можно запускать повторно, ошибок не будет.
-- =====================================================


-- 1. АДМИНИСТРАТОРЫ ----------------------------------
-- Только пользователи из этой таблицы имеют доступ к админке.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Функция: "текущий пользователь — админ?"
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins: read own row" on public.admins;
create policy "admins: read own row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());


-- 2. ЗАКАЗЫ ------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  -- секретный токен для клиентской ссылки (?order=токен)
  public_token text not null unique
    default replace(gen_random_uuid()::text, '-', ''),

  order_number   text not null unique,
  order_date     date not null default current_date,

  client_name    text not null,
  client_phone   text,
  client_wechat  text,

  product_ru     text not null,
  product_zh     text,

  supplier       text,
  supplier_link  text,

  quantity       numeric(12,2) not null default 1     check (quantity >= 0),
  unit_price_cny numeric(12,2) not null default 0     check (unit_price_cny >= 0),
  exchange_rate  numeric(10,4) not null default 0     check (exchange_rate >= 0),
  weight_kg      numeric(10,2) not null default 0     check (weight_kg >= 0),
  delivery_cost  numeric(12,2) not null default 0     check (delivery_cost >= 0),
  paid_amount    numeric(12,2) not null default 0     check (paid_amount >= 0),

  status text not null default 'new'
    check (status in (
      'new',              -- Новый
      'awaiting_payment', -- Ожидает оплаты
      'purchasing',       -- Закупается
      'china_warehouse',  -- На складе Китая
      'in_transit',       -- В пути
      'arrived',          -- Прибыл
      'delivered',        -- Выдан клиенту
      'cancelled'         -- Отменён
    )),

  delivery_info  text,   -- информация о доставке (виден клиенту)
  admin_comment  text,   -- внутренний комментарий (клиент НЕ видит)
  client_comment text,   -- комментарий для клиента (клиент видит)

  -- Автоматические расчёты (считает сама база)
  goods_cny   numeric generated always as
    (quantity * unit_price_cny) stored,
  goods_som   numeric generated always as
    (quantity * unit_price_cny * exchange_rate) stored,
  total_som   numeric generated always as
    (quantity * unit_price_cny * exchange_rate + delivery_cost) stored,
  balance_som numeric generated always as
    (quantity * unit_price_cny * exchange_rate + delivery_cost - paid_amount) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_date_idx   on public.orders(order_date desc);

-- Автообновление updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();


-- 3. ФОТОГРАФИИ ЗАКАЗОВ ------------------------------
create table if not exists public.order_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_photos_order_idx on public.order_photos(order_id);


-- 4. ЗАЩИТА ДАННЫХ (Row Level Security) --------------
alter table public.orders       enable row level security;
alter table public.order_photos enable row level security;

-- Анонимные посетители не имеют прямого доступа к таблицам
revoke all on public.orders       from anon;
revoke all on public.order_photos from anon;
revoke all on public.admins       from anon;

drop policy if exists "orders: admin full access" on public.orders;
create policy "orders: admin full access"
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "photos: admin full access" on public.order_photos;
create policy "photos: admin full access"
  on public.order_photos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- 5. КЛИЕНТСКАЯ ССЫЛКА -------------------------------
-- Возвращает ТОЛЬКО безопасные поля ОДНОГО заказа по токену.
-- Поставщик, ссылка 1688, цена в ¥, курс, телефон, WeChat
-- и внутренний комментарий клиенту не отдаются.
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
      '[]'::json)
  )
  from public.orders o
  where o.public_token = p_token
  limit 1;
$$;

revoke all on function public.get_client_order(text) from public, anon, authenticated;
grant execute on function public.get_client_order(text) to anon, authenticated;


-- 6. ХРАНИЛИЩЕ ФОТО (Storage) ------------------------
-- Бакет публичный для чтения по прямой ссылке (имена файлов случайные),
-- а загружать и удалять может только админ.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-photos', 'order-photos', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "order-photos: admin read"   on storage.objects;
drop policy if exists "order-photos: admin insert" on storage.objects;
drop policy if exists "order-photos: admin update" on storage.objects;
drop policy if exists "order-photos: admin delete" on storage.objects;

create policy "order-photos: admin read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'order-photos' and public.is_admin());

create policy "order-photos: admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'order-photos' and public.is_admin());

create policy "order-photos: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'order-photos' and public.is_admin())
  with check (bucket_id = 'order-photos' and public.is_admin());

create policy "order-photos: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'order-photos' and public.is_admin());

-- ГОТОВО ✅
