-- =====================================================
-- ULA FACTORY — миграция 34: история курса ULA и рассылка новостей в Telegram
--
--   • Каждый раз, когда админ меняет курс ULA, старый и новый курс сохраняются в историю
--     (platform_fx_history). По ней на главной рисуется график за 7 / 30 дней
--     и показывается, как изменился курс (старый — зачёркнут).
--   • Новости: функция admin_post_news теперь возвращает номер новости, а у новости есть отметка
--     «отправлено в Telegram» (tg_sent_at) — чтобы одна новость не ушла байерам дважды.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_33_news.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 34) then
      raise exception 'СТОП: файл 34 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. История курса ULA
create table if not exists public.platform_fx_history (
  id         bigint generated always as identity primary key,
  tiers      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists platform_fx_history_at_idx on public.platform_fx_history(created_at desc);
alter table public.platform_fx_history enable row level security;
drop policy if exists "platform_fx_history: read" on public.platform_fx_history;
create policy "platform_fx_history: read" on public.platform_fx_history for select to authenticated using (true);
revoke all on public.platform_fx_history from anon, authenticated;
grant select on public.platform_fx_history to authenticated;

-- курс поменялся → записать в историю (если поменялись только заметка или дата — не записывать)
create or replace function public.platform_fx_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tiers is not null and new.tiers is distinct from old.tiers then
    insert into public.platform_fx_history (tiers) values (new.tiers);
  end if;
  return new;
end;
$$;
revoke all on function public.platform_fx_log() from public, anon, authenticated;
drop trigger if exists platform_fx_log on public.platform_fx;
create trigger platform_fx_log after update of tiers on public.platform_fx
  for each row execute function public.platform_fx_log();

-- первая точка истории — текущий курс
insert into public.platform_fx_history (tiers, created_at)
select tiers, updated_at from public.platform_fx
 where id = 1 and tiers is not null and not exists (select 1 from public.platform_fx_history);


-- 2. Новости: номер новости и отметка «отправлено в Telegram»
alter table public.platform_news add column if not exists tg_sent_at timestamptz;

drop function if exists public.admin_post_news(text);
create function public.admin_post_news(p_body text)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_body text := left(btrim(coalesce(p_body, '')), 1000); v_id bigint;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_body = '' then raise exception 'empty_news' using errcode = '22023'; end if;
  insert into public.platform_news (body) values (v_body) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_post_news(text) from public, anon, authenticated;
grant execute on function public.admin_post_news(text) to authenticated;


-- ✅ ОТМЕТКА: файл 34 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (34, 'migration_34_fx_history.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
