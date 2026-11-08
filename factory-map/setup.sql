-- =====================================================
-- ULA FACTORY — база для «Карты фабрик» (отдельный раздел администратора).
--
-- ЗАЧЕМ. Сайт лежит в открытом репозитории, поэтому фабрики, телефоны и визиты
-- хранятся только здесь, а не в файлах сайта. Читать и менять их может только
-- администратор: public.is_admin() проверяет роль и, если включён, вход с кодом.
--
-- Файл намеренно НЕ входит в нумерацию migration_NN и не пишет в schema_migrations:
-- карта не зависит от порядка миграций заказов и не мешает ещё не запущенным файлам.
-- Заказы, клиенты и другие таблицы не меняются.
--
-- Как запустить: Supabase → SQL Editor → вставить весь файл → Run.
-- Можно запускать повторно. Существующие данные карты не меняются.
-- =====================================================
begin;

do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'СТОП: в базе нет public.is_admin(). Ничего не изменено.';
  end if;
end $$;

create table if not exists public.factory_map_data (
  name       text primary key check (name ~ '^[a-z0-9_-]{1,32}$'),
  data       jsonb not null check (
               jsonb_typeof(data->'factories') = 'array'
               and jsonb_typeof(data->'areas') = 'array'
               and jsonb_typeof(data->'tasks') = 'array'
             ),
  version    bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Каждая запись должна идти от последней версии: старая вкладка не затрёт новые данные.
create or replace function public.factory_map_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.name <> old.name then
    raise exception 'Имя базы карты менять нельзя';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'Устаревшая версия карты';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke all on function public.factory_map_touch() from public, anon, authenticated;

drop trigger if exists factory_map_touch on public.factory_map_data;
create trigger factory_map_touch before update on public.factory_map_data
  for each row execute function public.factory_map_touch();

alter table public.factory_map_data enable row level security;

revoke all on table public.factory_map_data from public, anon, authenticated;
grant select, insert, update on table public.factory_map_data to authenticated;

drop policy if exists factory_map_admin on public.factory_map_data;
create policy factory_map_admin on public.factory_map_data
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;
