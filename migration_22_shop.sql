-- =====================================================
-- ULA FACTORY — миграция 22: витрина байера
--
-- Байер добавляет товары (фото, название, цена). У витрины публичная ссылка (?shop=…):
-- клиент без регистрации смотрит товары, выбирает и оставляет заявку — у байера появляется заказ.
-- Ссылка витрины = ссылка для заявок (request_token): заменили или отключили одну — изменилась и другая.
--
--   • shop_products         — товары витрины (чужие байеры не видят, сайт без входа — тоже);
--   • бакет shop-photos     — фото товаров, папка = id кабинета;
--   • get_shop(token)       — для клиента: название кабинета и показанные товары (без закупочных данных);
--   • shop_order(...)       — заявка из витрины: берёт название и цену товара из базы, создаёт заказ.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_21_admin_2fa.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 22) then
      raise exception 'СТОП: файл 22 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Товары витрины
create table if not exists public.shop_products (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  description  text check (description is null or char_length(description) <= 1500),
  price        numeric(14,2) check (price is null or (price >= 0 and price <= 99999999)),
  currency     text not null default 'KGS' check (currency ~ '^[A-Z]{3}$'),
  photo_path   text check (photo_path is null or char_length(photo_path) <= 300),
  is_active    boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists shop_products_ws_idx on public.shop_products(workspace_id, is_active, sort, created_at desc);

alter table public.shop_products enable row level security;
drop policy if exists "shop: read own"   on public.shop_products;
drop policy if exists "shop: add own"    on public.shop_products;
drop policy if exists "shop: update own" on public.shop_products;
drop policy if exists "shop: delete own" on public.shop_products;
create policy "shop: read own"   on public.shop_products for select to authenticated using (public.can_read_ws(workspace_id));
create policy "shop: add own"    on public.shop_products for insert to authenticated with check (public.is_member(workspace_id));
create policy "shop: update own" on public.shop_products for update to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "shop: delete own" on public.shop_products for delete to authenticated using (public.is_owner(workspace_id));
revoke all on public.shop_products from anon;
grant select, insert, update, delete on public.shop_products to authenticated;


-- 2. Фото товаров: публичное чтение по прямой ссылке, загрузка — только в папку своего кабинета
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-photos', 'shop-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop-photos: read"   on storage.objects;
drop policy if exists "shop-photos: insert" on storage.objects;
drop policy if exists "shop-photos: update" on storage.objects;
drop policy if exists "shop-photos: delete" on storage.objects;
create policy "shop-photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'shop-photos' and public.can_read_ws(nullif(split_part(name, '/', 1), '')::uuid));
create policy "shop-photos: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-photos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$'
              and public.is_member(split_part(name, '/', 1)::uuid));
create policy "shop-photos: update" on storage.objects for update to authenticated
  using (bucket_id = 'shop-photos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_member(split_part(name, '/', 1)::uuid))
  with check (bucket_id = 'shop-photos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_member(split_part(name, '/', 1)::uuid));
create policy "shop-photos: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shop-photos' and split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' and public.is_member(split_part(name, '/', 1)::uuid));


-- 3. Для клиента: витрина по ссылке (только показанные товары и название кабинета)
create or replace function public.get_shop(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', w.name,
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


-- 4. Заявка из витрины: название и цену берём из базы (клиент не может подменить цену),
--    дальше — те же проверки и лимиты, что у обычной заявки (submit_request).
create or replace function public.shop_order(
  p_token text, p_product uuid, p_qty numeric,
  p_name text, p_phone text, p_telegram text, p_comment text, p_website text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  pr   record;
  v_c  text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;
  select p.title, p.price, p.currency into pr
    from public.shop_products p
    join public.workspaces w on w.id = p.workspace_id
   where p.id = p_product and p.is_active and w.request_token = p_token;
  if pr.title is null then raise exception 'product_not_found' using errcode = 'P0002'; end if;

  v_c := 'Из витрины'
    || case when pr.price is not null then ': цена ' || trim(to_char(pr.price, 'FM999999990.##')) || ' ' || pr.currency || ' за шт.' else '' end
    || case when nullif(btrim(coalesce(p_comment, '')), '') is not null then E'\n' || btrim(p_comment) else '' end;

  return public.submit_request(p_token, p_name, p_phone, p_telegram, pr.title, null, p_qty, left(v_c, 1000), p_website);
end;
$$;
revoke all on function public.shop_order(text, uuid, numeric, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.shop_order(text, uuid, numeric, text, text, text, text, text) to anon, authenticated;

-- ✅ ОТМЕТКА: файл 22 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (22, 'migration_22_shop.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
