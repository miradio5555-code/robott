-- =====================================================
-- ULA FACTORY — миграция 23: трек-номер и расходы
--
--   • orders.tracking_number — трек-номер посылки. Байер вписывает его в заказ,
--     клиент видит его на своей странице заказа (по ссылке) и может скопировать;
--   • get_client_order(token) — теперь отдаёт и трек-номер (остальное как раньше);
--   • expenses — расходы кабинета (аренда, зарплата, реклама…), чтобы считать чистую прибыль.
--     Видит и меняет только владелец кабинета; помощник и чужие байеры — нет. Админ — только смотрит.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_22_shop.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 23) then
      raise exception 'СТОП: файл 23 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Трек-номер в заказе
alter table public.orders add column if not exists tracking_number text;
alter table public.orders drop constraint if exists orders_tracking_number_len;
alter table public.orders add constraint orders_tracking_number_len
  check (tracking_number is null or char_length(tracking_number) <= 100);


-- 2. Страница клиента: то же, что в файле 12, плюс трек-номер
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


-- 3. Расходы кабинета
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  spent_on     date not null default current_date,
  category     text not null default 'other'
               check (category in ('rent', 'salary', 'ads', 'transport', 'packing', 'phone', 'fees', 'other')),
  amount       numeric(14,2) not null check (amount > 0 and amount <= 999999999),
  currency     text not null default 'KGS' check (currency ~ '^[A-Z]{3}$'),
  note         text check (note is null or char_length(note) <= 300),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists expenses_ws_idx on public.expenses(workspace_id, spent_on desc);

alter table public.expenses enable row level security;
drop policy if exists "expenses: read"   on public.expenses;
drop policy if exists "expenses: add"    on public.expenses;
drop policy if exists "expenses: update" on public.expenses;
drop policy if exists "expenses: delete" on public.expenses;
create policy "expenses: read"   on public.expenses for select to authenticated
  using (public.is_owner(workspace_id) or public.is_admin());
create policy "expenses: add"    on public.expenses for insert to authenticated with check (public.is_owner(workspace_id));
create policy "expenses: update" on public.expenses for update to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));
create policy "expenses: delete" on public.expenses for delete to authenticated using (public.is_owner(workspace_id));
revoke all on public.expenses from anon;
grant select, insert, update, delete on public.expenses to authenticated;

-- ✅ ОТМЕТКА: файл 23 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (23, 'migration_23_tools.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
