-- ULA Factory — управление ссылкой клиента.
-- Байер может создать новую ссылку или отключить текущую.
-- Новая ссылка сразу делает старую недействительной.
-- Запустить в Supabase SQL Editor после migration_13_suppliers.sql.

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
--    (иначе он перезапишет новые функции). Ничего не будет изменено.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 14) then
      raise exception 'СТОП: файл 14 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;

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

-- ✅ ОТМЕТКА: файл 14 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (14, 'migration_14_client_links.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

