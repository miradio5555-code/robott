-- Бизнес-обзор администратора. Запускать после migration_50_client_balance.sql.
-- Данные рассчитываются отдельно для одного кабинета и каждой валюты.
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 50) then
    raise exception 'СТОП: сначала запустите миграцию 50';
  end if;
  if exists (select 1 from public.schema_migrations where version > 51) then
    raise exception 'СТОП: файл 51 старше уже запущенных в базе';
  end if;
end $$;

create or replace function public.admin_business_overview(p_workspace uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_name text;
  v_result jsonb;
begin
  -- Проверка на сервере также учитывает активность администратора и 2FA.
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_workspace is null or p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  select name into v_name from public.workspaces where id = p_workspace;
  if not found then raise exception 'workspace_not_found' using errcode = 'P0002'; end if;

  with period_orders as (
    select * from public.orders
     where workspace_id = p_workspace and order_date between p_from and p_to
       and status <> 'cancelled'
  ), period_expenses as (
    select * from public.expenses
     where workspace_id = p_workspace and spent_on between p_from and p_to
  ), currencies as (
    select client_currency as code from period_orders
    union
    select currency from period_expenses
  ), totals as (
    select c.code,
      (select count(*) from period_orders o where o.client_currency = c.code) as orders_count,
      (select count(*) from period_orders o where o.client_currency = c.code and o.client_price is null) as missing_price,
      (select count(*) from period_orders o where o.client_currency = c.code and
        (o.client_price is null or o.unit_price_cny <= 0 or o.exchange_rate <= 0 or
         (o.delivery_cost > 0 and o.delivery_rate <= 0))) as missing_cost,
      (select count(*) from period_expenses e where e.currency = c.code) as expenses_count,
      (select round(sum(o.client_price), 2)::text from period_orders o where o.client_currency = c.code) as order_value,
      (select round(avg(o.client_price), 2)::text from period_orders o where o.client_currency = c.code) as average_value,
      (select round(sum(o.profit_som), 2)::text from period_orders o where o.client_currency = c.code) as order_profit,
      (select round(avg(o.profit_som), 2)::text from period_orders o where o.client_currency = c.code) as average_profit,
      (select round(sum(e.amount), 2)::text from period_expenses e where e.currency = c.code) as expenses
    from currencies c
  )
  select jsonb_build_object(
    'workspace_name', v_name,
    'from', p_from, 'to', p_to,
    'active', (select count(*) from period_orders where status <> 'delivered'),
    'completed', (select count(*) from period_orders where status = 'delivered'),
    'currencies', coalesce((select jsonb_agg(jsonb_build_object(
      'code', code, 'orders_count', orders_count, 'missing_price', missing_price,
      'missing_cost', missing_cost, 'expenses_count', expenses_count,
      'order_value', case when orders_count > 0 and missing_price = 0 then order_value end,
      'average_value', case when orders_count > 0 and missing_price = 0 then average_value end,
      'order_profit', case when orders_count > 0 and missing_cost = 0 then order_profit end,
      'average_profit', case when orders_count > 0 and missing_cost = 0 then average_profit end,
      'expenses', case when expenses_count > 0 then expenses end
    ) order by code) from totals), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_business_overview(uuid, date, date) from public, anon, authenticated;
grant execute on function public.admin_business_overview(uuid, date, date) to authenticated;

insert into public.schema_migrations (version, name) values (51, 'migration_51_business_overview.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();
