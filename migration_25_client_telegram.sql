-- =====================================================
-- ULA FACTORY — миграция 25: клиент получает статусы заказа в Telegram
--
-- Клиент на своей странице заказа нажимает «Получать уведомления в Telegram» → открывается бот →
-- «Start». Дальше, когда байер меняет статус, бот сам пишет клиенту («заказ в пути», «прибыл»…).
--
--   • order_tg_subs  — кто из клиентов подписан на какой заказ (чат Telegram). Байер видит только
--                      факт подписки своих заказов; добавляет и удаляет подписки только функция telegram-notify.
--   • tg_updates     — входящие сообщения боту (нажатия Start). Функция складывает их сюда, чтобы ни одно
--                      подключение не потерялось, даже когда их много. Сайту недоступна.
--   • Новая или отключённая ссылка клиента (rotate/revoke) — подписки заказа удаляются:
--     уведомления получает только тот, у кого действующая ссылка.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_24_photo_ai.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 25) then
      raise exception 'СТОП: файл 25 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Подписки клиентов на заказы
create table if not exists public.order_tg_subs (
  order_id    uuid not null references public.orders(id) on delete cascade,
  chat_id     text not null check (char_length(chat_id) <= 40),
  lang        text not null default 'ru' check (lang in ('ru', 'en', 'zh')),
  last_status text,
  created_at  timestamptz not null default now(),
  primary key (order_id, chat_id)
);
alter table public.order_tg_subs enable row level security;
drop policy if exists "tg subs: read own" on public.order_tg_subs;
create policy "tg subs: read own" on public.order_tg_subs for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.can_read_ws(o.workspace_id)));
revoke all on public.order_tg_subs from anon, authenticated;
grant select on public.order_tg_subs to authenticated;


-- 2. Входящие сообщения боту (только для функции)
create table if not exists public.tg_updates (
  update_id  bigint primary key,
  chat_id    text not null,
  chat_name  text,
  lang       text,
  text       text,
  created_at timestamptz not null default now()
);
create index if not exists tg_updates_text_idx on public.tg_updates(text);
alter table public.tg_updates enable row level security;
revoke all on public.tg_updates from anon, authenticated;


-- 3. Ссылку клиента заменили или отключили — подписки этого заказа больше не действуют
create or replace function public.orders_drop_tg_subs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_token is distinct from old.public_token then
    delete from public.order_tg_subs where order_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_drop_tg_subs on public.orders;
create trigger orders_drop_tg_subs
  after update of public_token on public.orders
  for each row execute function public.orders_drop_tg_subs();

-- ✅ ОТМЕТКА: файл 25 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (25, 'migration_25_client_telegram.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
