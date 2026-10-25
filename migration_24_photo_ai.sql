-- =====================================================
-- ULA FACTORY — миграция 24: лимит распознавания фото тетради
--
-- Байер фотографирует страницы тетради с заказами, ИИ (Google Gemini) превращает их в строки,
-- байер проверяет и загружает. Бесплатный тариф Gemini ограничен, поэтому у каждого человека
-- есть дневной лимит фото: 30 в день.
--
--   • ai_photo_usage            — сколько фото человек отправил сегодня (сайту напрямую недоступна);
--   • ai_photo_take(p_count)    — «забронировать» фото перед отправкой в ИИ: проверяет, что человек
--                                 работает в кабинете и не превысил лимит; возвращает, сколько осталось.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_23_tools.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 24) then
      raise exception 'СТОП: файл 24 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Счётчик фото по дням
create table if not exists public.ai_photo_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  n       int  not null default 0 check (n >= 0),
  primary key (user_id, day)
);
alter table public.ai_photo_usage enable row level security;
revoke all on public.ai_photo_usage from anon, authenticated;


-- 2. Забронировать фото (вызывает функция photo-orders от имени байера)
create or replace function public.ai_photo_take(p_count int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit constant int := 30;
  v_n int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 5 then raise exception 'bad_count' using errcode = '22023'; end if;
  -- только тот, кто работает в кабинете (владелец или помощник)
  if public.my_workspace_id() is null then raise exception 'no_workspace' using errcode = '42501'; end if;

  insert into public.ai_photo_usage (user_id, day, n) values (auth.uid(), current_date, 0)
  on conflict (user_id, day) do nothing;

  update public.ai_photo_usage set n = n + p_count
   where user_id = auth.uid() and day = current_date and n + p_count <= v_limit
  returning n into v_n;
  if v_n is null then raise exception 'quota_exceeded' using errcode = 'P0001'; end if;

  -- старые дни больше не нужны
  delete from public.ai_photo_usage where user_id = auth.uid() and day < current_date - 7;
  return v_limit - v_n;
end;
$$;
revoke all on function public.ai_photo_take(int) from public, anon, authenticated;
grant execute on function public.ai_photo_take(int) to authenticated;

-- ✅ ОТМЕТКА: файл 24 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (24, 'migration_24_photo_ai.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
