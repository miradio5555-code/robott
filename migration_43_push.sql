-- =====================================================
-- ULA FACTORY — миграция 43: push-уведомления (приходят, даже когда сайт закрыт)
--
--   • push_subs — подписки телефонов/браузеров (чей телефон, куда слать). Каждый видит и меняет только свои.
--   • push_keys — ключи отправителя. Закрыта для всех, читает только серверная функция push-notify.
--     Секретный ключ в этот файл НЕ входит: он вставляется отдельным запросом (см. DATABASE.md).
--   • exchange_requests.push_at / push_paid_at — отметки «уже отправили push», чтобы не слать дважды.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_42_fx_qr.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 43) then
      raise exception 'СТОП: файл 43 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
    if not exists (select 1 from public.schema_migrations where version = 42) then
      raise exception 'СТОП: сначала запустите migration_42_fx_qr.sql, потом этот файл. Ничего не изменено.';
    end if;
  end if;
end $$;

create table if not exists public.push_subs (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subs (user_id);
alter table public.push_subs enable row level security;
revoke all on public.push_subs from anon;
grant select, insert, update, delete on public.push_subs to authenticated;

drop policy if exists "push_subs: own" on public.push_subs;
create policy "push_subs: own" on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.push_keys (
  id      int primary key default 1 check (id = 1),
  pub     text not null,
  priv    text not null default ''
);
alter table public.push_keys enable row level security;
revoke all on public.push_keys from anon, authenticated;
insert into public.push_keys (id, pub) values (1, 'BFtbxkb4A7JGXn5Whq3BO-XwjIcCsHDNo6Gcp0eT1uhsdk8-YUiGtJJvGLGs4FJS_xbrx9g17rMIJmHuCnjjZlU')
on conflict (id) do update set pub = excluded.pub;

alter table public.exchange_requests add column if not exists push_at timestamptz;
alter table public.exchange_requests add column if not exists push_paid_at timestamptz;

-- Отметка: файл 43 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (43, 'migration_43_push.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
