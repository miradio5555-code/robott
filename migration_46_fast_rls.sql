-- =====================================================
-- ULA FACTORY — миграция 46: быстрые правила доступа (кабинет открывается в разы быстрее)
--
-- Раньше правила чтения вызывали can_read_ws()/is_member()/is_admin() для КАЖДОЙ строки:
-- 1000 заказов с фото и историей = десятки тысяч проверок (≈0,6 с у байера, ≈1,3 с у админа
-- на каждую 1000 заказов). Теперь список «мои кабинеты» и «я админ?» считаются один раз на запрос.
-- Кто что видит — не меняется: участник (с активным профилем) — свои кабинеты, админ — всё.
--
--   • my_ws_ids() — кабинеты, где я участник с активным профилем (как is_member, но списком);
--   • правила чтения переписаны: (select is_admin()) or workspace_id = any((select my_ws_ids())).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_45_admin_exchange.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 46) then
      raise exception 'СТОП: файл 46 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Мои кабинеты одним списком
create or replace function public.my_ws_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.workspace_id), '{}')
    from public.workspace_members m
    join public.profiles p on p.user_id = m.user_id
   where m.user_id = auth.uid()
     and p.is_active;
$$;
revoke all on function public.my_ws_ids() from public, anon;
grant execute on function public.my_ws_ids() to authenticated;


-- 2. Правила чтения: проверка один раз на запрос, а не на каждую строку
drop policy if exists "orders: read" on public.orders;
create policy "orders: read" on public.orders for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "clients: read" on public.clients;
create policy "clients: read" on public.clients for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "status history: read workspace" on public.order_status_history;
create policy "status history: read workspace" on public.order_status_history for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "shipments: read own workspace" on public.shipments;
create policy "shipments: read own workspace" on public.shipments for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "shop: read own" on public.shop_products;
create policy "shop: read own" on public.shop_products for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "suppliers: read own workspace" on public.suppliers;
create policy "suppliers: read own workspace" on public.suppliers for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "workspaces: read" on public.workspaces;
create policy "workspaces: read" on public.workspaces for select to authenticated
  using ((select public.is_admin()) or id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "members: read" on public.workspace_members;
create policy "members: read" on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "photos: read" on public.order_photos;
create policy "photos: read" on public.order_photos for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.orders o
          where o.id = order_photos.order_id and o.workspace_id = any ((select public.my_ws_ids())::uuid[])));

drop policy if exists "tg subs: read own" on public.order_tg_subs;
create policy "tg subs: read own" on public.order_tg_subs for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.orders o
          where o.id = order_tg_subs.order_id and o.workspace_id = any ((select public.my_ws_ids())::uuid[])));

drop policy if exists "exchange: read" on public.exchange_requests;
create policy "exchange: read" on public.exchange_requests for select to authenticated
  using ((select public.is_admin()) or workspace_id = any ((select public.my_ws_ids())::uuid[]));

drop policy if exists "exchange_events: read" on public.exchange_events;
create policy "exchange_events: read" on public.exchange_events for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.exchange_requests r
          where r.id = exchange_events.request_id and r.workspace_id = any ((select public.my_ws_ids())::uuid[])));

drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "support: read" on public.support_messages;
create policy "support: read" on public.support_messages for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));


-- ✅ ОТМЕТКА: файл 46 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (46, 'migration_46_fast_rls.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
