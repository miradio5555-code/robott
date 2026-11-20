-- =====================================================
-- ULA FACTORY — миграция 73: «Карта фабрик» для каждого байера — своя
--
-- КАК УСТРОЕНО
--   • factory_maps — одна строка на человека: вся его карта (фабрики, районы, задачи, новости, визиты, журнал)
--     в одном jsonb — так же, как карта администратора в factory_map_data (factory-map/setup.sql).
--   • Каждая запись идёт от последней версии (version + 1): старая вкладка или второй телефон не затрёт новые данные.
--   • Размер карты — до 5 МБ.
--
-- ЧЬИ ДАННЫЕ. Всё личное: строку видит и меняет только её владелец (user_id = auth.uid()). Другой байер, сотрудник
-- кабинета и администратор чужую карту не видят. Посетителю без входа (anon) закрыто всё. Публичные ссылки клиента,
-- витрина и заявки эту таблицу не читают. Удалить карту через сайт нельзя (нет права delete).
--
-- Карта администратора (factory_map_data, строка 'main') этим файлом НЕ меняется и остаётся как была.
-- Заказы, клиенты, платежи и балансы этот файл НЕ меняет. Удаление аккаунта удаляет и его карту (on delete cascade).
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, и ни один файл новее 73 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 73) then
    raise exception 'СТОП: файл 73 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;

create table if not exists public.factory_maps (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb not null,
  version    bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.factory_maps drop constraint if exists factory_maps_shape_chk;
alter table public.factory_maps add constraint factory_maps_shape_chk check (coalesce(
  jsonb_typeof(data) = 'object'
  and jsonb_typeof(data->'factories') = 'array'
  and jsonb_typeof(data->'areas') = 'array'
  and jsonb_typeof(data->'tasks') = 'array', false)
);
alter table public.factory_maps drop constraint if exists factory_maps_size_chk;
alter table public.factory_maps add constraint factory_maps_size_chk check (pg_column_size(data) <= 5242880);

-- Владельца не подменить, версия только +1, время правки ставит база.
create or replace function public.factory_maps_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    new.version := 1;
    new.created_at := now();
  else
    if new.user_id is distinct from old.user_id then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.version <> old.version + 1 then
      raise exception 'stale_version';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.factory_maps_guard() from public, anon, authenticated;

drop trigger if exists factory_maps_guard on public.factory_maps;
create trigger factory_maps_guard before insert or update on public.factory_maps
  for each row execute function public.factory_maps_guard();

alter table public.factory_maps enable row level security;
revoke all on table public.factory_maps from public, anon, authenticated;
grant select, insert, update on table public.factory_maps to authenticated;

drop policy if exists factory_maps_own on public.factory_maps;
create policy factory_maps_own on public.factory_maps
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

insert into public.schema_migrations (version, name) values (73, 'migration_73_factory_maps.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
