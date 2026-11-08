-- ============================================================================
-- ULA FACTORY — миграция 63: изменения файлов 45 и 46 для баз, где они были пропущены
--
-- ЗАЧЕМ. В рабочей базе нет отметок 45 и 46, и их изменения не применены (проверено запросом 2026-11-06).
-- Запустить сами файлы 45 и 46 нельзя: они останавливаются, потому что в базе есть отметки новее.
-- Этот файл делает то же самое:
--   • kyc_ok: кабинет администратора платформы считается проверенным (файл 45);
--   • my_ws_ids и быстрые правила чтения (файл 46). Кто что видит — не меняется.
-- Отметки 45 и 46 ставятся здесь же, потому что их изменения теперь есть; уже стоящие отметки не трогаются.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 62.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё).
-- Можно запускать повторно. Таблицы и данные не меняются.
-- ============================================================================
begin;

do $$ begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 62) then
    raise exception 'СТОП: сначала запустите файл 62. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 63) then
    raise exception 'СТОП: файл 63 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;

-- Из файла 45
create or replace function public.kyc_ok(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workspaces w join public.fx_kyc k on k.user_id = w.owner_id
                  where w.id = p_ws and k.status = 'approved')
      or exists (select 1 from public.workspaces w join public.admins a on a.user_id = w.owner_id
                  where w.id = p_ws);
$$;
revoke all on function public.kyc_ok(uuid) from public, anon, authenticated;

-- Из файла 46
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


-- ✅ ОТМЕТКИ: изменения файлов 45 и 46 применены этим файлом; файл 63 запущен
insert into public.schema_migrations (version, name) values
  (45, 'migration_45_admin_exchange.sql'),
  (46, 'migration_46_fast_rls.sql')
  on conflict (version) do nothing;
insert into public.schema_migrations (version, name) values (63, 'migration_63_restore_45_46.sql')
  on conflict (version) do update set applied_at = now();

commit;
