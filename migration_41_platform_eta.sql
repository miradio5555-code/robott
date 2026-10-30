-- =====================================================
-- ULA FACTORY — миграция 41: срок «сколько ждать юани» в курсе ULA для байеров
--
-- Админ в разделе «Обмен валюты» выбирает срок (например «до 2 часов»).
-- Байер на вкладке «Обмен в ULA» видит: «Обычно юани приходят в течение … после оплаты».
--   • platform_fx.eta — срок в минутах (пусто = не показывать).
--   • admin_set_platform_fx(p_tiers, p_note, p_eta) — только админ. Старый вызов без p_eta работает как раньше.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: ПОСЛЕ migration_40_support_files.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 41) then
      raise exception 'СТОП: файл 41 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
    if not exists (select 1 from public.schema_migrations where version = 40) then
      raise exception 'СТОП: сначала запустите migration_40_support_files.sql, потом этот файл. Ничего не изменено.';
    end if;
  end if;
end $$;


-- 1. Срок в минутах
alter table public.platform_fx add column if not exists eta int;
alter table public.platform_fx drop constraint if exists platform_fx_eta_check;
alter table public.platform_fx add constraint platform_fx_eta_check check (eta is null or (eta between 1 and 10080));


-- 2. Админ сохраняет курс вместе со сроком (копия из файла 28 + p_eta)
drop function if exists public.admin_set_platform_fx(jsonb, text);
create or replace function public.admin_set_platform_fx(p_tiers jsonb, p_note text, p_eta int default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.platform_fx
     set tiers = p_tiers,
         note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         eta = case when p_eta between 1 and 10080 then p_eta else null end,
         updated_at = now()
   where id = 1;
end;
$$;
revoke all on function public.admin_set_platform_fx(jsonb, text, int) from public, anon, authenticated;
grant execute on function public.admin_set_platform_fx(jsonb, text, int) to authenticated;


-- Отметка: файл 41 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (41, 'migration_41_platform_eta.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
