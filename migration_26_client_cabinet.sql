-- =====================================================
-- ULA FACTORY — миграция 26: одна ссылка на все заказы клиента
--
-- Раньше у каждого заказа была своя ссылка (?order=…). Теперь байер может создать клиенту
-- ОБЩУЮ ссылку (?c=…): клиент видит все свои заказы, статусы и общий долг, а по нажатию на заказ —
-- ту же подробную страницу, что и раньше (фото, трек-номер, оплата).
--
--   • client_cabinets — «клиент → секретный токен». Клиент определяется так же, как в разделе «Долги»:
--                       по последним 9 цифрам телефона («+996 700…», «0700…» — один клиент), иначе по имени. Таблица закрыта для сайта,
--                       пользуются ею только функции ниже.
--   • client_cabinet(order_id, action) — для байера: 'get' показать ссылку, 'create' создать, 'revoke' отключить.
--                       Создать клиенту можно только из заказа своего кабинета.
--   • get_client_cabinet(token)        — для клиента: список его заказов и долг по валютам.
--   • get_cabinet_order(token, number) — для клиента: подробности заказа (как get_client_order),
--                       но только если заказ принадлежит этому клиенту этого кабинета.
--   Ссылки на отдельные заказы работают как раньше.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_25_client_telegram.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 26) then
      raise exception 'СТОП: файл 26 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Ключ клиента (как в разделе «Долги»: телефон от 9 цифр, иначе имя)
create or replace function public.client_key(p_phone text, p_name text)
returns text
language sql
immutable
as $$
  select case
    when char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9
      then 'p' || right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    else 'n' || lower(btrim(coalesce(p_name, '')))
  end;
$$;


-- 2. Общие ссылки клиентов
create table if not exists public.client_cabinets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ckey         text not null check (char_length(ckey) between 2 and 200),
  token        text not null unique check (token ~ '^[a-f0-9]{32}$'),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, ckey)
);
alter table public.client_cabinets enable row level security;
revoke all on public.client_cabinets from anon, authenticated;


-- 3. Подробности заказа для клиента (внутренняя; наружу не отдаётся)
create or replace function public.client_order_json(p_id uuid)
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


-- 4. Байер: показать / создать / отключить общую ссылку клиента этого заказа
create or replace function public.client_cabinet(p_order_id uuid, p_action text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws    uuid;
  v_key   text;
  v_token text;
begin
  if p_action not in ('get', 'create', 'revoke') then
    raise exception 'bad_action' using errcode = '22023';
  end if;

  select o.workspace_id, public.client_key(coalesce(c.phone, o.client_phone), coalesce(c.name, o.client_name))
    into v_ws, v_key
    from public.orders o
    left join public.clients c on c.id = o.client_id
   where o.id = p_order_id;

  if v_ws is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not public.is_member(v_ws) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_action = 'revoke' then
    delete from public.client_cabinets where workspace_id = v_ws and ckey = v_key;
    return null;
  end if;

  select token into v_token from public.client_cabinets where workspace_id = v_ws and ckey = v_key;
  if v_token is null and p_action = 'create' then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into public.client_cabinets (workspace_id, ckey, token) values (v_ws, v_key, v_token);
  end if;
  return v_token;
end;
$$;
revoke all on function public.client_cabinet(uuid, text) from public, anon, authenticated;
grant execute on function public.client_cabinet(uuid, text) to authenticated;


-- 5. Клиент: все его заказы и долг по валютам
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


-- 6. Клиент: подробности одного заказа из своего списка
create or replace function public.get_cabinet_order(p_token text, p_order_number text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_key text;
  v_id  uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select workspace_id, ckey into v_ws, v_key from public.client_cabinets where token = p_token;
  if v_ws is null then
    return null;
  end if;

  select o.id into v_id
    from public.orders o
    left join public.clients c on c.id = o.client_id
   where o.workspace_id = v_ws
     and o.order_number = p_order_number
     and public.client_key(coalesce(c.phone, o.client_phone), coalesce(c.name, o.client_name)) = v_key
   limit 1;
  if v_id is null then
    return null;
  end if;
  return public.client_order_json(v_id);
end;
$$;
revoke all on function public.get_cabinet_order(text, text) from public, anon, authenticated;
grant execute on function public.get_cabinet_order(text, text) to anon, authenticated;

-- ✅ ОТМЕТКА: файл 26 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (26, 'migration_26_client_cabinet.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
