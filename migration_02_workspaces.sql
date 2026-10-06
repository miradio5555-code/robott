-- =====================================================
-- ULA FACTORY — миграция 02: байеры и их рабочие пространства
--
-- Что делает:
--   • роли пользователей: admin (вы) и buyer (байер);
--   • у каждого байера своё «рабочее пространство» (кабинет);
--   • заказы, клиенты и фото привязываются к пространству;
--   • байер видит и меняет ТОЛЬКО своё. Проверяет сама база;
--   • админ может ПРОСМАТРИВАТЬ любой кабинет, но менять — только свой;
--   • приглашения для новых байеров;
--   • номера заказов выдаются автоматически: CN-000001, CN-000002…
--   • адрес склада хранится в базе и меняется в кабинете
--     (больше не нужно править config.js).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: supabase_schema.sql → migration_01_clients.sql → этот файл.
-- Можно запускать повторно.
-- =====================================================


-- 1. ПРОФИЛИ И РОЛИ ----------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'buyer' check (role in ('admin', 'buyer')),
  full_name  text check (full_name is null or char_length(full_name) <= 120),
  is_active  boolean not null default true,   -- false = заблокирован
  created_at timestamptz not null default now()
);

-- Все, кто был в таблице admins, становятся админами
insert into public.profiles (user_id, role)
select user_id, 'admin' from public.admins
on conflict (user_id) do update set role = 'admin';

-- «Текущий пользователь — активный админ?»
-- (та же функция, что и раньше, теперь смотрит в profiles)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where user_id = auth.uid() and role = 'admin' and is_active
  );
$$;


-- 2. РАБОЧИЕ ПРОСТРАНСТВА (кабинеты байеров) ---------
create table if not exists public.workspaces (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 120),
  owner_id           uuid references auth.users(id) on delete set null,
  order_prefix       text not null default 'CN' check (order_prefix ~ '^[A-Z]{1,5}$'),
  order_seq          integer not null default 0,     -- счётчик номеров заказов
  warehouse_address  text check (warehouse_address is null or char_length(warehouse_address) <= 500),
  warehouse_contacts text check (warehouse_contacts is null or char_length(warehouse_contacts) <= 500),
  created_at         timestamptz not null default now()
);

-- Кто работает в пространстве. Сейчас — только владелец,
-- позже здесь появятся сотрудники байера (role = 'staff').
create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'owner' check (role in ('owner', 'staff')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);


-- 3. ФУНКЦИИ ПРОВЕРКИ ПРАВ ---------------------------
-- Все правила доступа ниже опираются на эти функции.

-- «Я активный участник этого пространства?»
create or replace function public.is_member(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws
       and m.user_id = auth.uid()
       and p.is_active
  );
$$;

-- «Я владелец этого пространства?» (может менять настройки)
create or replace function public.is_owner(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws
       and m.user_id = auth.uid()
       and m.role = 'owner'
       and p.is_active
  );
$$;

-- «Мне можно ЧИТАТЬ это пространство?» — участник или админ
create or replace function public.can_read_ws(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member(p_ws) or public.is_admin();
$$;

-- Моё пространство по умолчанию (первое, где я участник)
create or replace function public.my_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.workspace_id
    from public.workspace_members m
   where m.user_id = auth.uid()
   order by m.created_at
   limit 1;
$$;


-- 4. ПЕРЕНОС СУЩЕСТВУЮЩИХ ДАННЫХ ---------------------
-- Все текущие заказы и клиенты становятся кабинетом владельца (первого админа).
-- Адрес склада переносится из config.js.
alter table public.orders  add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;
alter table public.clients add column if not exists workspace_id uuid references public.workspaces(id) on delete restrict;

do $$
declare
  v_owner uuid;
  v_ws    uuid;
begin
  select user_id into v_owner from public.admins order by created_at limit 1;

  if v_owner is not null then
    select id into v_ws from public.workspaces where owner_id = v_owner order by created_at limit 1;
  end if;

  -- создаём главный кабинет, только если есть что переносить или есть админ без кабинета
  if v_ws is null and (
       v_owner is not null
       or exists (select 1 from public.orders  where workspace_id is null)
       or exists (select 1 from public.clients where workspace_id is null)) then
    insert into public.workspaces (name, owner_id, order_prefix, warehouse_address, warehouse_contacts)
    values (
      'ULA Factory', v_owner, 'CN',
      '浙江省金华市金东区孝顺镇广顺南街与集贤路红绿灯路口左拐P栋一楼B区',
      E'天驰 18680378056\n天仁 13249858824'
    )
    returning id into v_ws;
  end if;

  if v_ws is not null then
    -- все админы — участники главного кабинета (первый — владелец)
    insert into public.workspace_members (workspace_id, user_id, role)
    select v_ws, a.user_id, case when a.user_id = v_owner then 'owner' else 'staff' end
      from public.admins a
    on conflict do nothing;

    update public.orders  set workspace_id = v_ws where workspace_id is null;
    update public.clients set workspace_id = v_ws where workspace_id is null;
  end if;
end;
$$;

alter table public.orders  alter column workspace_id set not null;
alter table public.clients alter column workspace_id set not null;

create index if not exists orders_ws_idx  on public.orders(workspace_id);
create index if not exists clients_ws_idx on public.clients(workspace_id);


-- 5. НОМЕРА ЗАКАЗОВ ----------------------------------
-- Номер уникален внутри кабинета (у двух байеров может быть по CN-000001).
alter table public.orders drop constraint if exists orders_order_number_key;
create unique index if not exists orders_ws_number_uidx on public.orders(workspace_id, order_number);

-- Перед созданием заказа: подставить кабинет и выдать следующий номер.
-- Счётчик меняется под блокировкой строки — два заказа не получат один номер.
create or replace function public.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_seq    integer;
begin
  if new.workspace_id is null then
    new.workspace_id := public.my_workspace_id();
  end if;

  if new.order_number is null or btrim(new.order_number) = '' then
    update public.workspaces
       set order_seq = order_seq + 1
     where id = new.workspace_id
    returning order_prefix, order_seq into v_prefix, v_seq;

    if v_seq is null then
      raise exception 'workspace_not_found' using errcode = '23503';
    end if;
    new.order_number := v_prefix || '-' || lpad(v_seq::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists orders_before_insert on public.orders;
create trigger orders_before_insert
  before insert on public.orders
  for each row execute function public.orders_before_insert();


-- 6. ПРИГЛАШЕНИЯ ДЛЯ БАЙЕРОВ -------------------------
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique default replace(gen_random_uuid()::text, '-', ''),
  note       text check (note is null or char_length(note) <= 200),  -- для кого (заметка админа)
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by    uuid references auth.users(id) on delete set null,
  used_at    timestamptz
);

-- Внутренняя функция: принять приглашение для пользователя.
-- Создаёт профиль байера и его кабинет. Возвращает id кабинета или null.
create or replace function public._claim_invite(
  p_user uuid, p_code text, p_full_name text, p_ws_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite_id uuid;
  v_ws        uuid;
  v_name      text := nullif(left(btrim(coalesce(p_full_name, '')), 120), '');
  v_ws_name   text := nullif(left(btrim(coalesce(p_ws_name, '')), 120), '');
begin
  if p_user is null or p_code is null or p_code !~ '^[a-f0-9]{32}$' then
    return null;
  end if;

  -- у пользователя уже есть профиль — второй раз не принимаем
  if exists (select 1 from public.profiles where user_id = p_user) then
    return null;
  end if;

  select id into v_invite_id
    from public.invites
   where code = p_code and used_at is null and expires_at > now()
   for update;
  if v_invite_id is null then
    return null;
  end if;

  insert into public.profiles (user_id, role, full_name) values (p_user, 'buyer', v_name);

  insert into public.workspaces (name, owner_id)
  values (coalesce(v_ws_name, v_name, 'Мой кабинет'), p_user)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, p_user, 'owner');

  update public.invites set used_by = p_user, used_at = now() where id = v_invite_id;
  return v_ws;
end;
$$;
revoke all on function public._claim_invite(uuid, text, text, text) from public, anon, authenticated;

-- При регистрации нового пользователя: если он пришёл по приглашению,
-- сразу создать ему кабинет. Ошибка здесь НЕ мешает регистрации.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'invite_code' then
    begin
      perform public._claim_invite(
        new.id,
        new.raw_user_meta_data ->> 'invite_code',
        new.raw_user_meta_data ->> 'full_name',
        new.raw_user_meta_data ->> 'workspace_name');
    exception when others then
      raise warning 'invite claim failed for %: %', new.id, sqlerrm;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_claim on auth.users;
create trigger on_auth_user_created_claim
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Для уже вошедшего пользователя без кабинета (запасной путь)
create or replace function public.claim_invite(p_code text, p_full_name text, p_ws_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  v_ws := public._claim_invite(auth.uid(), p_code, p_full_name, p_ws_name);
  if v_ws is null then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;
  return v_ws;
end;
$$;
revoke all on function public.claim_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_invite(text, text, text) to authenticated;

-- Страница регистрации: «это приглашение ещё действует?»
create or replace function public.check_invite(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_code ~ '^[a-f0-9]{32}$' and exists (
    select 1 from public.invites
     where code = p_code and used_at is null and expires_at > now()
  );
$$;
revoke all on function public.check_invite(text) from public, anon, authenticated;
grant execute on function public.check_invite(text) to anon, authenticated;


-- 7. ФУНКЦИИ АДМИНА ----------------------------------
-- Создать приглашение. Возвращает код.
create or replace function public.admin_create_invite(p_note text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.invites (note, created_by)
  values (nullif(left(btrim(coalesce(p_note, '')), 200), ''), auth.uid())
  returning code into v_code;
  return v_code;
end;
$$;
revoke all on function public.admin_create_invite(text) from public, anon, authenticated;
grant execute on function public.admin_create_invite(text) to authenticated;

-- Список всех кабинетов со статистикой (только админ)
create or replace function public.admin_list_workspaces()
returns table (
  id uuid, name text, owner_id uuid, owner_email text, owner_name text,
  owner_active boolean, owner_role text, orders_count bigint, clients_count bigint, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select w.id, w.name, w.owner_id, u.email::text, p.full_name,
           coalesce(p.is_active, false), p.role,
           (select count(*) from public.orders  o where o.workspace_id = w.id),
           (select count(*) from public.clients c where c.workspace_id = w.id),
           w.created_at
      from public.workspaces w
      left join auth.users u     on u.id = w.owner_id
      left join public.profiles p on p.user_id = w.owner_id
     order by w.created_at;
end;
$$;
revoke all on function public.admin_list_workspaces() from public, anon, authenticated;
grant execute on function public.admin_list_workspaces() to authenticated;

-- Заблокировать / разблокировать байера (себя заблокировать нельзя)
create or replace function public.admin_set_user_active(p_user uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot_block_self' using errcode = 'P0001';
  end if;
  update public.profiles set is_active = coalesce(p_active, false) where user_id = p_user;
end;
$$;
revoke all on function public.admin_set_user_active(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;


-- 8. КЛИЕНТСКАЯ ФОРМА: новый клиент попадает в кабинет заказа ----
-- Та же функция из миграции 01, добавлено только workspace_id.
create or replace function public.save_client_info(
  p_token        text,
  p_name         text,
  p_phone        text,
  p_telegram     text,
  p_city         text,
  p_address      text,
  p_pickup_point text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_ws        uuid;
  v_status    text;
  v_client_id uuid;

  v_name   text := btrim(coalesce(p_name, ''));
  v_city   text := btrim(coalesce(p_city, ''));
  v_addr   text := nullif(btrim(coalesce(p_address, '')), '');
  v_pickup text := nullif(btrim(coalesce(p_pickup_point, '')), '');
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_tg     text := nullif(
    regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
begin
  if v_phone like '00%' then
    v_phone := '+' || substr(v_phone, 3);
  end if;

  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select id, workspace_id, status, client_id
    into v_order_id, v_ws, v_status, v_client_id
    from public.orders
   where public_token = p_token
   for update;

  if v_order_id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_status in ('delivered', 'cancelled') then
    raise exception 'order_locked' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 2 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then
    raise exception 'invalid_telegram' using errcode = '22023';
  end if;
  if char_length(v_city) not between 2 and 80 then
    raise exception 'invalid_city' using errcode = '22023';
  end if;
  if (v_addr is null) = (v_pickup is null) then
    raise exception 'invalid_place' using errcode = '22023';
  end if;
  if v_addr is not null and char_length(v_addr) not between 5 and 300 then
    raise exception 'invalid_place' using errcode = '22023';
  end if;
  if v_pickup is not null and char_length(v_pickup) not between 2 and 200 then
    raise exception 'invalid_place' using errcode = '22023';
  end if;

  if v_client_id is null then
    insert into public.clients (workspace_id, name, phone, telegram, city, address, pickup_point)
    values (v_ws, v_name, v_phone, v_tg, v_city, v_addr, v_pickup)
    returning id into v_client_id;

    update public.orders set client_id = v_client_id where id = v_order_id;
  else
    update public.clients
       set name = v_name, phone = v_phone, telegram = v_tg,
           city = v_city, address = v_addr, pickup_point = v_pickup
     where id = v_client_id;
  end if;

  return json_build_object(
    'name', v_name, 'phone', v_phone, 'telegram', v_tg,
    'city', v_city, 'address', v_addr, 'pickup_point', v_pickup);
end;
$$;

revoke all on function public.save_client_info(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.save_client_info(text, text, text, text, text, text, text)
  to anon, authenticated;


-- 9. ПРАВИЛА ДОСТУПА (Row Level Security) ------------
-- Главное правило: читать — участник кабинета или админ;
-- создавать, менять, удалять — только участник кабинета.

alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invites           enable row level security;

-- посетитель без входа не трогает ничего из этого напрямую
revoke all on public.profiles, public.workspaces, public.workspace_members, public.invites from anon;

-- ПРОФИЛИ: видишь свой, админ видит всех. Менять можно только своё имя.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "profiles: update own name" on public.profiles;
create policy "profiles: update own name" on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- КАБИНЕТЫ: читать — участник или админ; менять настройки — только владелец.
-- Счётчик номеров (order_seq) и владельца менять вручную нельзя.
revoke insert, update, delete on public.workspaces from authenticated;
grant update (name, order_prefix, warehouse_address, warehouse_contacts) on public.workspaces to authenticated;

drop policy if exists "workspaces: read" on public.workspaces;
create policy "workspaces: read" on public.workspaces for select to authenticated
  using (public.can_read_ws(id));

drop policy if exists "workspaces: owner updates" on public.workspaces;
create policy "workspaces: owner updates" on public.workspaces for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

-- УЧАСТНИКИ: только чтение (добавляются через функции)
revoke insert, update, delete on public.workspace_members from authenticated;

drop policy if exists "members: read" on public.workspace_members;
create policy "members: read" on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.can_read_ws(workspace_id));

-- ПРИГЛАШЕНИЯ: видит и удаляет только админ (создаёт — через функцию)
revoke insert, update on public.invites from authenticated;

drop policy if exists "invites: admin read" on public.invites;
create policy "invites: admin read" on public.invites for select to authenticated
  using (public.is_admin());

drop policy if exists "invites: admin delete" on public.invites;
create policy "invites: admin delete" on public.invites for delete to authenticated
  using (public.is_admin());

-- ЗАКАЗЫ
drop policy if exists "orders: admin full access" on public.orders;
drop policy if exists "orders: read"   on public.orders;
drop policy if exists "orders: insert" on public.orders;
drop policy if exists "orders: update" on public.orders;
drop policy if exists "orders: delete" on public.orders;

create policy "orders: read"   on public.orders for select to authenticated
  using (public.can_read_ws(workspace_id));
create policy "orders: insert" on public.orders for insert to authenticated
  with check (public.is_member(workspace_id));
create policy "orders: update" on public.orders for update to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "orders: delete" on public.orders for delete to authenticated
  using (public.is_member(workspace_id));

-- КЛИЕНТЫ
drop policy if exists "clients: admin full access" on public.clients;
drop policy if exists "clients: read"   on public.clients;
drop policy if exists "clients: insert" on public.clients;
drop policy if exists "clients: update" on public.clients;
drop policy if exists "clients: delete" on public.clients;

create policy "clients: read"   on public.clients for select to authenticated
  using (public.can_read_ws(workspace_id));
create policy "clients: insert" on public.clients for insert to authenticated
  with check (public.is_member(workspace_id));
create policy "clients: update" on public.clients for update to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "clients: delete" on public.clients for delete to authenticated
  using (public.is_member(workspace_id));

-- ФОТО ЗАКАЗОВ (права — как у заказа, к которому относится фото)
drop policy if exists "photos: admin full access" on public.order_photos;
drop policy if exists "photos: read"   on public.order_photos;
drop policy if exists "photos: insert" on public.order_photos;
drop policy if exists "photos: delete" on public.order_photos;

create policy "photos: read" on public.order_photos for select to authenticated
  using (exists (select 1 from public.orders o
                  where o.id = order_id and public.can_read_ws(o.workspace_id)));
create policy "photos: insert" on public.order_photos for insert to authenticated
  with check (exists (select 1 from public.orders o
                       where o.id = order_id and public.is_member(o.workspace_id)));
create policy "photos: delete" on public.order_photos for delete to authenticated
  using (exists (select 1 from public.orders o
                  where o.id = order_id and public.is_member(o.workspace_id)));

-- ФАЙЛЫ ФОТО в хранилище. Путь файла: <id заказа>/<случайное имя>.jpg
-- Загружать и удалять можно только в папку СВОЕГО заказа.
drop policy if exists "order-photos: admin read"   on storage.objects;
drop policy if exists "order-photos: admin insert" on storage.objects;
drop policy if exists "order-photos: admin update" on storage.objects;
drop policy if exists "order-photos: admin delete" on storage.objects;
drop policy if exists "order-photos: read"   on storage.objects;
drop policy if exists "order-photos: insert" on storage.objects;
drop policy if exists "order-photos: update" on storage.objects;
drop policy if exists "order-photos: delete" on storage.objects;

create policy "order-photos: read" on storage.objects for select to authenticated
  using (bucket_id = 'order-photos' and exists (
    select 1 from public.orders o
     where o.id::text = split_part(name, '/', 1) and public.can_read_ws(o.workspace_id)));

create policy "order-photos: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'order-photos' and exists (
    select 1 from public.orders o
     where o.id::text = split_part(name, '/', 1) and public.is_member(o.workspace_id)));

create policy "order-photos: update" on storage.objects for update to authenticated
  using (bucket_id = 'order-photos' and exists (
    select 1 from public.orders o
     where o.id::text = split_part(name, '/', 1) and public.is_member(o.workspace_id)))
  with check (bucket_id = 'order-photos' and exists (
    select 1 from public.orders o
     where o.id::text = split_part(name, '/', 1) and public.is_member(o.workspace_id)));

create policy "order-photos: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'order-photos' and exists (
    select 1 from public.orders o
     where o.id::text = split_part(name, '/', 1) and public.is_member(o.workspace_id)));

-- ГОТОВО ✅
