-- =====================================================
-- ULA FACTORY — миграция 77: push-уведомление обменнику о новом сообщении клиента в чате заявки
--
-- ЗАЧЕМ. Клиент написал в чат заявки на обмен (файл 76) — у владельца кабинета на телефоне и компьютере
-- всплывает уведомление «💬 Азамат: Что с моей заявкой?», даже если сайт закрыт.
-- Отправляет серверная функция push-notify (action "exchange_msg"). Чтобы одно и то же сообщение
-- нельзя было прислать дважды (и засыпать обменника уведомлениями повторными вызовами),
-- у сообщения появляется отметка push_at — функция «забирает» сообщение одним действием.
--
-- Заказы, клиенты, платежи, балансы и аккаунты этот файл НЕ меняет. Сообщения не меняются.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, и ни один файл новее 77 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 77) then
    raise exception 'СТОП: файл 77 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
  if not exists (select 1 from public.schema_migrations where version = 76) then
    raise exception 'СТОП: сначала запустите миграцию 76 (чат по заявке на обмен). Ничего не изменено.';
  end if;
end $$;

-- когда о сообщении отправлено push-уведомление (null — ещё не отправлено)
alter table public.exchange_events add column if not exists push_at timestamptz;

-- старые сообщения считаем уже отправленными — после запуска файла уведомления придут только о новых
update public.exchange_events set push_at = coalesce(push_at, created_at) where push_at is null;

insert into public.schema_migrations (version, name) values (77, 'migration_77_exchange_chat_push.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
