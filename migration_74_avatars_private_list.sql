-- =====================================================
-- ULA FACTORY — миграция 74: список фото профилей больше не виден всем
--
-- ЧТО БЫЛО. Правило "avatars: read" (файл 36) разрешало любому вошедшему пользователю читать все записи
-- хранилища avatars — то есть получить СПИСОК фото профилей всех людей (имена папок = id пользователей).
-- Supabase Security Advisor: «Public Bucket Allows Listing — storage.avatars».
--
-- ЧТО СТАЛО. Через это правило каждый видит только свою папку (свои фото) — этого хватает, чтобы заменить
-- и удалить своё фото. Сами фото по-прежнему показываются всем по прямой ссылке (хранилище публичное,
-- getPublicUrl) — в профиле, в чате поддержки и т.д. ничего не меняется.
--
-- Заказы, клиенты, платежи, балансы и аккаунты этот файл НЕ меняет. Файлы фото не удаляются.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, и ни один файл новее 74 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 74) then
    raise exception 'СТОП: файл 74 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;

-- Имя правила прежнее — его сверяет scripts/diagnose_supabase_readonly.sql.
drop policy if exists "avatars: read" on storage.objects;
create policy "avatars: read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

insert into public.schema_migrations (version, name) values (74, 'migration_74_avatars_private_list.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
