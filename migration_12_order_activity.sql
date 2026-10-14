-- ULA Factory — расширенная история изменений заказа.
-- После migration_11_status_history.sql. Можно запускать повторно.
-- Сохраняем статусы, сумму оплат и только факт изменения адреса.

alter table public.order_status_history
  add column if not exists event_type text not null default 'status';
alter table public.order_status_history
  alter column new_status drop not null;
alter table public.order_status_history
  add column if not exists paid_total numeric(14,2);

alter table public.order_status_history
  drop constraint if exists order_status_history_event_type_check;
alter table public.order_status_history
  add constraint order_status_history_event_type_check
  check (event_type in ('status', 'payment', 'address'));

alter table public.order_status_history
  drop constraint if exists order_status_history_paid_total_check;
alter table public.order_status_history
  add constraint order_status_history_paid_total_check
  check (paid_total is null or paid_total >= 0);

-- Записываем статус, новую общую сумму оплат и привязку адреса к заказу.
create or replace function public.record_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, workspace_id, event_type, new_status, changed_by)
    values (new.id, new.workspace_id, 'status', new.status, auth.uid());

    if new.paid_amount > 0 then
      insert into public.order_status_history(order_id, workspace_id, event_type, paid_total, changed_by)
      values (new.id, new.workspace_id, 'payment', new.paid_amount, auth.uid());
    end if;

    if new.client_id is not null and exists (
      select 1 from public.clients c
       where c.id = new.client_id
         and (c.city is not null or c.address is not null or c.pickup_point is not null)
    ) then
      insert into public.order_status_history(order_id, workspace_id, event_type, changed_by)
      values (new.id, new.workspace_id, 'address', auth.uid());
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_history(order_id, workspace_id, event_type, old_status, new_status, changed_by)
    values (new.id, new.workspace_id, 'status', old.status, new.status, auth.uid());
  end if;

  if new.paid_amount is distinct from old.paid_amount then
    insert into public.order_status_history(order_id, workspace_id, event_type, paid_total, changed_by)
    values (new.id, new.workspace_id, 'payment', new.paid_amount, auth.uid());
  end if;

  if new.client_id is distinct from old.client_id and new.client_id is not null and exists (
    select 1 from public.clients c
     where c.id = new.client_id
       and (c.city is not null or c.address is not null or c.pickup_point is not null)
  ) then
    insert into public.order_status_history(order_id, workspace_id, event_type, changed_by)
    values (new.id, new.workspace_id, 'address', auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists orders_status_history on public.orders;
create trigger orders_status_history
  after insert or update of status, paid_amount, client_id on public.orders
  for each row execute function public.record_order_status_change();

-- При изменении города или адреса пишем только факт обновления — сам адрес не копируется в историю.
create or replace function public.record_client_address_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.city is distinct from old.city
     or new.address is distinct from old.address
     or new.pickup_point is distinct from old.pickup_point then
    insert into public.order_status_history(order_id, workspace_id, event_type, changed_by)
    select o.id, o.workspace_id, 'address', auth.uid()
      from public.orders o
     where o.client_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_address_history on public.clients;
create trigger clients_address_history
  after update of city, address, pickup_point on public.clients
  for each row execute function public.record_client_address_change();

-- По ссылке клиент видит только статусы и суммы оплат по своему заказу.
-- Адреса, внутренние заметки, закупку, доставку и прибыль функция не возвращает.
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
