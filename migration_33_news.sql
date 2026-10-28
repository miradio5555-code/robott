-- =====================================================
-- ULA FACTORY — миграция 33: новости платформы для байеров
--
--   • Админ публикует короткую новость — все байеры видят её на главной странице («Заказы»).
--   • Читать новости могут все вошедшие (байеры, помощники), аноним — нет.
--   • Публиковать и удалять — только админ (через функции, напрямую в таблицу писать нельзя).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_32_security.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 33) then
      raise exception 'СТОП: файл 33 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


create table if not exists public.platform_news (
  id         bigint generated always as identity primary key,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.platform_news enable row level security;
drop policy if exists "platform_news: read" on public.platform_news;
create policy "platform_news: read" on public.platform_news for select to authenticated using (true);
revoke all on public.platform_news from anon, authenticated;
grant select on public.platform_news to authenticated;


create or replace function public.admin_post_news(p_body text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_body text := left(btrim(coalesce(p_body, '')), 1000);
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_body = '' then raise exception 'empty_news' using errcode = '22023'; end if;
  insert into public.platform_news (body) values (v_body);
end;
$$;
revoke all on function public.admin_post_news(text) from public, anon, authenticated;
grant execute on function public.admin_post_news(text) to authenticated;


create or replace function public.admin_delete_news(p_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.platform_news where id = p_id;
end;
$$;
revoke all on function public.admin_delete_news(bigint) from public, anon, authenticated;
grant execute on function public.admin_delete_news(bigint) to authenticated;


-- ✅ ОТМЕТКА: файл 33 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (33, 'migration_33_news.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
