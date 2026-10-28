-- =====================================================
-- ULA FACTORY — миграция 27: логотип байера
--
-- Байер загружает свой логотип в ⚙️ Настройках. Клиенты видят его вместо «ULA Factory»
-- наверху страницы заказа, общей ссылки и витрины — компания выглядит солиднее.
--
--   • workspaces.logo_path — путь к файлу логотипа (меняет только владелец кабинета).
--   • Хранилище «logos» — публичное чтение, загрузка и удаление только владельцем в папку своего кабинета.
--     Только png / jpeg / webp до 1 МБ (svg запрещён: в нём можно спрятать код).
--   • get_client_order, get_cabinet_order, get_client_cabinet, get_shop — теперь отдают название и логотип кабинета.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_26_client_cabinet.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 27) then
      raise exception 'СТОП: файл 27 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Колонка и право менять её владельцу
alter table public.workspaces add column if not exists logo_path text
  check (logo_path is null or logo_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$');
grant update (logo_path) on public.workspaces to authenticated;


-- 2. Хранилище логотипов
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos: read"   on storage.objects;
drop policy if exists "logos: insert" on storage.objects;
drop policy if exists "logos: update" on storage.objects;
drop policy if exists "logos: delete" on storage.objects;
create policy "logos: read" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.can_read_ws(split_part(name, '/', 1)::uuid));
create policy "logos: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_owner(split_part(name, '/', 1)::uuid));
create policy "logos: update" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_owner(split_part(name, '/', 1)::uuid))
  with check (bucket_id = 'logos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_owner(split_part(name, '/', 1)::uuid));
create policy "logos: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_owner(split_part(name, '/', 1)::uuid));


-- 3. Для клиента: название и логотип кабинета в ответах
create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', (select json_build_object('name', w.name, 'logo', w.logo_path) from public.workspaces w where w.id = o.workspace_id),
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
      from public.clients c where c.id = o.client_id)
  )
  from public.orders o
  where o.public_token = p_token
  limit 1;
$$;
revoke all on function public.get_client_order(text) from public, anon, authenticated;
grant execute on function public.get_client_order(text) to anon, authenticated;

create or replace function public.client_order_json(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', (select json_build_object('name', w.name, 'logo', w.logo_path) from public.workspaces w where w.id = o.workspace_id),
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
      from public.clients c where c.id = o.client_id)
  )
  from public.orders o
  where o.id = p_id;
$$;
revoke all on function public.client_order_json(uuid) from public, anon, authenticated;

create or replace function public.get_client_cabinet(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_key text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select workspace_id, ckey into v_ws, v_key from public.client_cabinets where token = p_token;
  if v_ws is null then
    return null;
  end if;

  return (
    with mine as (
      select o.*, c.name as cname
        from public.orders o
        left join public.clients c on c.id = o.client_id
       where o.workspace_id = v_ws
         and public.client_key(coalesce(c.phone, o.client_phone), coalesce(c.name, o.client_name)) = v_key
    ), lim as (
      select * from mine order by order_date desc, created_at desc limit 300
    )
    select json_build_object(
      'brand', (select json_build_object('name', w.name, 'logo', w.logo_path) from public.workspaces w where w.id = v_ws),
      'name', (select coalesce(cname, client_name) from mine order by created_at desc limit 1),
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
          'photo', (select p.storage_path from public.order_photos p where p.order_id = l.id order by p.created_at limit 1)
        ) order by l.order_date desc, l.created_at desc)
        from lim l), '[]'::json),
      'debt', coalesce((
        select json_agg(json_build_object('currency', cur, 'amount', amt) order by cur)
        from (select coalesce(client_currency, 'KGS') as cur, sum(balance_som) as amt
                from mine
               where status <> 'cancelled' and balance_som > 0
               group by 1) d), '[]'::json)
    )
  );
end;
$$;
revoke all on function public.get_client_cabinet(text) from public, anon, authenticated;
grant execute on function public.get_client_cabinet(text) to anon, authenticated;

create or replace function public.get_shop(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', w.name,
    'logo', w.logo_path,
    'products', coalesce((
      select json_agg(json_build_object(
               'id', p.id, 'title', p.title, 'description', p.description,
               'price', p.price, 'currency', p.currency, 'photo', p.photo_path)
             order by p.sort, p.created_at desc)
        from public.shop_products p
       where p.workspace_id = w.id and p.is_active), '[]'::json))
    from public.workspaces w
   where p_token ~ '^[a-f0-9]{32}$' and w.request_token = p_token
   limit 1;
$$;
revoke all on function public.get_shop(text) from public, anon, authenticated;
grant execute on function public.get_shop(text) to anon, authenticated;

-- ✅ ОТМЕТКА: файл 27 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (27, 'migration_27_logo.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
