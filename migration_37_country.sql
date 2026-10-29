-- =====================================================
-- ULA FACTORY — миграция 37: страна байера
--
-- При регистрации байер выбирает страну.
--   • workspaces.country — код страны из 2 латинских букв (KG, KZ, UZ…); меняет владелец кабинета.
--   • Новый кабинет сам берёт страну из анкеты регистрации.
--   • Список кабинетов у админа — со страной (чтобы сортировать по странам).
--   • Курс обмена ULA сайт показывает только байерам из Кыргызстана.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_36_avatar.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 37) then
      raise exception 'СТОП: файл 37 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Колонка и право менять её владельцу кабинета (политика «owner updates» уже есть)
alter table public.workspaces add column if not exists country text
  check (country is null or country ~ '^[A-Z]{2}$');
grant update (country) on public.workspaces to authenticated;


-- 2. Новый кабинет: страна из анкеты регистрации владельца
create or replace function public.ws_country_from_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v text;
begin
  if new.country is null and new.owner_id is not null then
    select upper(u.raw_user_meta_data ->> 'country') into v from auth.users u where u.id = new.owner_id;
    if v ~ '^[A-Z]{2}$' then
      new.country := v;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.ws_country_from_signup() from public, anon, authenticated;

drop trigger if exists ws_country_signup on public.workspaces;
create trigger ws_country_signup before insert on public.workspaces
  for each row execute function public.ws_country_from_signup();


-- 3. Список кабинетов для админа — со страной
drop function if exists public.admin_list_workspaces();

create or replace function public.admin_list_workspaces()
returns table (
  id uuid, name text, owner_id uuid, owner_email text, owner_name text, owner_phone text,
  owner_active boolean, owner_role text, orders_count bigint, clients_count bigint, created_at timestamptz,
  country text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select w.id, w.name, w.owner_id, u.email::text, p.full_name, p.phone,
           coalesce(p.is_active, false), p.role,
           (select count(*) from public.orders  o where o.workspace_id = w.id),
           (select count(*) from public.clients c where c.workspace_id = w.id),
           w.created_at, w.country
      from public.workspaces w
      left join auth.users u     on u.id = w.owner_id
      left join public.profiles p on p.user_id = w.owner_id
     order by w.created_at;
end;
$$;
revoke all on function public.admin_list_workspaces() from public, anon, authenticated;
grant execute on function public.admin_list_workspaces() to authenticated;


-- Отметка: файл 37 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (37, 'migration_37_country.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
