-- ULA Factory — личный справочник поставщиков.
-- Запустить в Supabase SQL Editor после migration_12_order_activity.sql.
-- Каждый поставщик принадлежит кабинету; RLS закрывает его от других байеров.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  contact_person text check (contact_person is null or char_length(contact_person) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  wechat text check (wechat is null or char_length(wechat) <= 100),
  supplier_link text check (supplier_link is null or char_length(supplier_link) <= 2048),
  city text check (city is null or char_length(city) <= 100),
  category text check (category is null or char_length(category) <= 100),
  address text check (address is null or char_length(address) <= 500),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.suppliers
  add column if not exists supplier_link text
  check (supplier_link is null or char_length(supplier_link) <= 2048);

create index if not exists suppliers_workspace_name_idx
  on public.suppliers(workspace_id, name);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers: read own workspace" on public.suppliers;
drop policy if exists "suppliers: add to own workspace" on public.suppliers;
drop policy if exists "suppliers: update own workspace" on public.suppliers;
drop policy if exists "suppliers: delete own workspace" on public.suppliers;

create policy "suppliers: read own workspace"
  on public.suppliers for select to authenticated
  using (public.can_read_ws(workspace_id));

create policy "suppliers: add to own workspace"
  on public.suppliers for insert to authenticated
  with check (public.is_member(workspace_id));

create policy "suppliers: update own workspace"
  on public.suppliers for update to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

create policy "suppliers: delete own workspace"
  on public.suppliers for delete to authenticated
  using (public.is_member(workspace_id));

revoke all on public.suppliers from anon;
grant select, insert, update, delete on public.suppliers to authenticated;
