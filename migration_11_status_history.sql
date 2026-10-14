-- ULA Factory — история изменений статуса заказа.
-- Запускается один раз в Supabase → SQL Editor → Run.

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_idx
  on public.order_status_history(order_id, created_at desc);

alter table public.order_status_history enable row level security;

drop policy if exists "status history: read workspace" on public.order_status_history;
create policy "status history: read workspace"
  on public.order_status_history for select to authenticated
  using (public.can_read_ws(workspace_id));

-- Для старых заказов сохраняем текущий статус как первую запись истории.
insert into public.order_status_history(order_id, workspace_id, old_status, new_status, created_at)
select o.id, o.workspace_id, null, o.status, coalesce(o.updated_at, o.created_at)
from public.orders o
where not exists (
  select 1 from public.order_status_history h where h.order_id = o.id
);

-- Историю создаёт только триггер, клиент и браузер не могут подделать событие.
revoke all on public.order_status_history from anon, authenticated;
grant select on public.order_status_history to authenticated;

create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, workspace_id, old_status, new_status, changed_by)
    values (new.id, new.workspace_id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history(order_id, workspace_id, old_status, new_status, changed_by)
    values (new.id, new.workspace_id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_status_history on public.orders;
create trigger orders_status_history
  after insert or update of status on public.orders
  for each row execute function public.record_order_status_change();

-- Клиентская ссылка получает только публичные события своего заказа.
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
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object('status', h.new_status, 'created_at', h.created_at)
                      order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id
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
