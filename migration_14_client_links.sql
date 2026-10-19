-- ULA Factory — управление ссылкой клиента.
-- Байер может создать новую ссылку или отключить текущую.
-- Новая ссылка сразу делает старую недействительной.
-- Запустить в Supabase SQL Editor после migration_13_suppliers.sql.

-- Отключённая ссылка хранится как NULL.
alter table public.orders alter column public_token drop not null;

-- Выпускает новый случайный токен только для заказа из кабинета вошедшего байера.
create or replace function public.rotate_client_link(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_token text;
begin
  select workspace_id into v_workspace_id
    from public.orders
   where id = p_order_id
   for update;

  if v_workspace_id is null then
    raise exception 'order_not_found';
  end if;
  if not public.is_member(v_workspace_id) then
    raise exception 'forbidden';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.orders set public_token = v_token where id = p_order_id;
  return v_token;
end;
$$;

-- Отключает ссылку. По старому токену заказ больше не находится.
create or replace function public.revoke_client_link(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id
    from public.orders
   where id = p_order_id
   for update;

  if v_workspace_id is null then
    raise exception 'order_not_found';
  end if;
  if not public.is_member(v_workspace_id) then
    raise exception 'forbidden';
  end if;

  update public.orders set public_token = null where id = p_order_id;
  return true;
end;
$$;

revoke all on function public.rotate_client_link(uuid) from public, anon, authenticated;
revoke all on function public.revoke_client_link(uuid) from public, anon, authenticated;
grant execute on function public.rotate_client_link(uuid) to authenticated;
grant execute on function public.revoke_client_link(uuid) to authenticated;
