-- =====================================================
-- ULA FACTORY — миграция 28: обмен сом → юань
--
-- Два курса, каждый живёт сам по себе:
--   • Курс админа для байеров (platform_fx): админ каждый день ставит курс.
--     Байеры видят его в разделе «Обмен» и пишут админу заявку (через «Поддержку»).
--   • Курс байера для своих клиентов (workspaces.fx_*): байер включает обмен и ставит курс.
--     Клиент открывает ссылку обмена (?fx=…), витрину, страницу заказа или общую ссылку,
--     вводит, сколько юаней ему нужно, видит сумму в сомах и реквизиты, оставляет заявку,
--     оплачивает и загружает скриншот оплаты. Заявка со скриншотом приходит байеру (и в Telegram).
--
-- Курс ступенчатый по сумме в юанях: [{"from": 0, "rate": 12.6}, {"from": 1000, "rate": 12.5}, {"from": 10000, "rate": 12.4}]
--   «from» — от скольких юаней, «rate» — сколько сом за 1 ¥. Меньшая «from» — минимальная сумма.
--
--   • fx_tiers_ok / fx_rate_for — проверка ступеней и курс для суммы.
--   • ws_fx(ws) / ws_brand(ws)  — внутренние: что клиенту можно показать.
--   • submit_exchange(...)      — для клиента без входа: заявка по секретной ссылке, с лимитами против спама.
--   • fx_attach_proof(id, path) — для клиента: прикрепить загруженный скриншот оплаты.
--   • Хранилище «fx-proofs» — закрытое: клиент может только загрузить скриншот к своей свежей заявке,
--     смотреть — только байер этой заявки.
--   • admin_set_platform_fx(...) — только админ.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_27_logo.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 28) then
      raise exception 'СТОП: файл 28 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Ступени курса: проверка и курс для суммы
create or replace function public.fx_tiers_ok(p jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  e jsonb;
  n int := 0;
  seen numeric[] := '{}';
  f numeric;
  r numeric;
begin
  if p is null then return true; end if;
  if jsonb_typeof(p) <> 'array' then return false; end if;
  for e in select * from jsonb_array_elements(p) loop
    n := n + 1;
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e -> 'from') <> 'number' or jsonb_typeof(e -> 'rate') <> 'number' then
      return false;
    end if;
    f := (e ->> 'from')::numeric;
    r := (e ->> 'rate')::numeric;
    if f < 0 or f > 100000000 or r <= 0 or r >= 1000 or f = any(seen) then return false; end if;
    seen := seen || f;
  end loop;
  return n between 1 and 10;
end;
$$;

create or replace function public.fx_rate_for(p jsonb, p_cny numeric)
returns numeric
language sql
immutable
as $$
  select (e ->> 'rate')::numeric
    from jsonb_array_elements(coalesce(p, '[]'::jsonb)) e
   where (e ->> 'from')::numeric <= p_cny
   order by (e ->> 'from')::numeric desc
   limit 1;
$$;


-- 2. Курс байера для клиентов (меняет только владелец кабинета)
alter table public.workspaces add column if not exists fx_on boolean not null default false;
alter table public.workspaces add column if not exists fx_tiers jsonb;
alter table public.workspaces add column if not exists fx_note text;
alter table public.workspaces add column if not exists fx_updated_at timestamptz;
alter table public.workspaces drop constraint if exists workspaces_fx_tiers_check;
alter table public.workspaces add constraint workspaces_fx_tiers_check check (public.fx_tiers_ok(fx_tiers));
alter table public.workspaces drop constraint if exists workspaces_fx_note_check;
alter table public.workspaces add constraint workspaces_fx_note_check check (fx_note is null or char_length(fx_note) <= 500);
grant update (fx_on, fx_tiers, fx_note) on public.workspaces to authenticated;

-- дата курса ставится сама, когда курс меняется
create or replace function public._ws_fx_touch()
returns trigger
language plpgsql
as $$
begin
  if new.fx_tiers is distinct from old.fx_tiers then new.fx_updated_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists ws_fx_touch on public.workspaces;
create trigger ws_fx_touch before update on public.workspaces
  for each row execute function public._ws_fx_touch();


-- 3. Курс админа для байеров (одна строка)
create table if not exists public.platform_fx (
  id         int primary key default 1 check (id = 1),
  tiers      jsonb check (public.fx_tiers_ok(tiers)),
  note       text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);
insert into public.platform_fx (id) values (1) on conflict (id) do nothing;
alter table public.platform_fx enable row level security;
drop policy if exists "platform_fx: read" on public.platform_fx;
create policy "platform_fx: read" on public.platform_fx for select to authenticated using (true);
revoke all on public.platform_fx from anon, authenticated;
grant select on public.platform_fx to authenticated;

create or replace function public.admin_set_platform_fx(p_tiers jsonb, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.platform_fx
     set tiers = p_tiers, note = nullif(left(btrim(coalesce(p_note, '')), 500), ''), updated_at = now()
   where id = 1;
end;
$$;
revoke all on function public.admin_set_platform_fx(jsonb, text) from public, anon, authenticated;
grant execute on function public.admin_set_platform_fx(jsonb, text) to authenticated;


-- 4. Заявки клиентов на обмен
--    new — ждёт оплаты, paid — клиент загрузил скриншот, done — выполнено, cancelled — отменено
create table if not exists public.exchange_requests (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  client_name      text not null check (char_length(client_name) between 2 and 120),
  client_phone     text not null check (client_phone ~ '^\+?[0-9]{9,15}$'),
  cny              numeric(14,2) not null check (cny > 0),
  som              numeric(14,2) not null check (som > 0),
  rate             numeric(10,4) not null check (rate > 0),
  comment          text check (comment is null or char_length(comment) <= 500),
  source           text not null check (source in ('shop', 'order', 'cab')),
  status           text not null default 'new' check (status in ('new', 'paid', 'done', 'cancelled')),
  proof_path       text check (proof_path is null or char_length(proof_path) <= 200),
  notified_at      timestamptz,
  paid_notified_at timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists exchange_requests_ws_idx on public.exchange_requests(workspace_id, created_at desc);
alter table public.exchange_requests enable row level security;
drop policy if exists "exchange: read"   on public.exchange_requests;
drop policy if exists "exchange: update" on public.exchange_requests;
drop policy if exists "exchange: delete" on public.exchange_requests;
create policy "exchange: read" on public.exchange_requests for select to authenticated
  using (public.is_member(workspace_id) or public.is_admin());
create policy "exchange: update" on public.exchange_requests for update to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "exchange: delete" on public.exchange_requests for delete to authenticated
  using (public.is_owner(workspace_id));
revoke all on public.exchange_requests from anon, authenticated;
grant select, delete on public.exchange_requests to authenticated;
grant update (status) on public.exchange_requests to authenticated;


-- 5. Что показать клиенту (внутренние, наружу не отдаются)
create or replace function public.ws_fx(p_ws uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when w.fx_on and w.fx_tiers is not null then
    json_build_object('tiers', w.fx_tiers, 'note', w.fx_note, 'updated_at', w.fx_updated_at)
  end
  from public.workspaces w where w.id = p_ws;
$$;
revoke all on function public.ws_fx(uuid) from public, anon, authenticated;

create or replace function public.ws_brand(p_ws uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('name', w.name, 'logo', w.logo_path, 'fx', public.ws_fx(w.id))
  from public.workspaces w where w.id = p_ws;
$$;
revoke all on function public.ws_brand(uuid) from public, anon, authenticated;


-- 6. Клиент оставляет заявку на обмен (без входа, по секретной ссылке)
create or replace function public.submit_exchange(
  p_kind    text,    -- 'shop' (ссылка обмена / витрина), 'order' (ссылка заказа), 'cab' (общая ссылка)
  p_token   text,
  p_name    text,
  p_phone   text,
  p_cny     numeric, -- сколько юаней нужно клиенту
  p_comment text,
  p_website text default null     -- ловушка для ботов
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws      uuid;
  ws        record;
  v_name    text := btrim(coalesce(p_name, ''));
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_cny     numeric := round(coalesce(p_cny, 0), 2);
  v_rate    numeric;
  v_som     numeric;
  v_id      uuid;
begin
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    return json_build_object('ok', true, 'id', null);
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  if p_kind = 'shop' then
    select id into v_ws from public.workspaces where request_token = p_token;
  elsif p_kind = 'order' then
    select workspace_id into v_ws from public.orders where public_token = p_token;
  elsif p_kind = 'cab' then
    select workspace_id into v_ws from public.client_cabinets where token = p_token;
  end if;
  if v_ws is null then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  -- строка кабинета блокируется, чтобы лимиты считались честно
  select id, fx_on, fx_tiers, fx_note into ws from public.workspaces where id = v_ws for update;
  if not ws.fx_on or ws.fx_tiers is null then
    raise exception 'fx_off' using errcode = 'P0001';
  end if;

  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_comment is not null and char_length(v_comment) > 500 then raise exception 'invalid_comment' using errcode = '22023'; end if;
  if v_cny <= 0 or v_cny > 10000000 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  v_rate := public.fx_rate_for(ws.fx_tiers, v_cny);
  if v_rate is null then raise exception 'below_min' using errcode = '22023'; end if;

  if (select count(*) from public.exchange_requests
       where workspace_id = v_ws and client_phone = v_phone and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.exchange_requests
          where workspace_id = v_ws and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.exchange_requests
          where workspace_id = v_ws and created_at > now() - interval '1 day') >= 100
  then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  v_som := round(v_cny * v_rate, 2);
  insert into public.exchange_requests (workspace_id, client_name, client_phone, cny, som, rate, comment, source)
  values (v_ws, v_name, v_phone, v_cny, v_som, v_rate, v_comment, p_kind)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'cny', v_cny, 'som', v_som, 'rate', v_rate, 'note', ws.fx_note);
end;
$$;
revoke all on function public.submit_exchange(text, text, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.submit_exchange(text, text, text, text, numeric, text, text) to anon, authenticated;


-- 7. Скриншот оплаты: закрытое хранилище «fx-proofs»
--    Путь файла: <номер заявки>/<имя>.jpg. Загрузить можно только к своей заявке, пока она ждёт оплаты
--    (не старше суток, без скриншота, не больше 3 файлов). Смотреть — только байер этой заявки.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fx-proofs', 'fx-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.fx_proof_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and r.status = 'new' and r.proof_path is null
                    and r.created_at > now() - interval '1 day')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-proofs' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)) < 3;
$$;
revoke all on function public.fx_proof_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_proof_upload_ok(text) to anon, authenticated;

create or replace function public.fx_proof_can_read(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and (public.is_member(r.workspace_id) or public.is_admin()));
$$;
revoke all on function public.fx_proof_can_read(text) from public, anon, authenticated;
grant execute on function public.fx_proof_can_read(text) to authenticated;

drop policy if exists "fx-proofs: insert" on storage.objects;
drop policy if exists "fx-proofs: read"   on storage.objects;
drop policy if exists "fx-proofs: delete" on storage.objects;
create policy "fx-proofs: insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fx-proofs' and public.fx_proof_upload_ok(name));
create policy "fx-proofs: read" on storage.objects for select to authenticated
  using (bucket_id = 'fx-proofs' and public.fx_proof_can_read(name));
create policy "fx-proofs: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fx-proofs' and public.fx_proof_can_read(name));

-- клиент прикрепляет загруженный файл к заявке → «оплачено»
create or replace function public.fx_attach_proof(p_id uuid, p_path text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_id is null or p_path is null or split_part(p_path, '/', 1) <> p_id::text then
    raise exception 'bad_path' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'fx-proofs' and name = p_path) then
    raise exception 'file_not_found' using errcode = 'P0002';
  end if;
  update public.exchange_requests
     set proof_path = p_path, status = 'paid', paid_at = now()
   where id = p_id and status = 'new' and proof_path is null and created_at > now() - interval '1 day';
  if not found then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  return true;
end;
$$;
revoke all on function public.fx_attach_proof(uuid, text) from public, anon, authenticated;
grant execute on function public.fx_attach_proof(uuid, text) to anon, authenticated;


-- 8. Для клиента: курс байера в ответах страниц (название и логотип — как в файле 27)
create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', public.ws_brand(o.workspace_id),
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
    'brand', public.ws_brand(o.workspace_id),
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
      'brand', public.ws_brand(v_ws),
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
    'fx', public.ws_fx(w.id),
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

-- ✅ ОТМЕТКА: файл 28 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (28, 'migration_28_exchange.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
