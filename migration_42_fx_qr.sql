-- =====================================================
-- ULA FACTORY — миграция 42: QR-код для оплаты в реквизитах обмена
--
-- Админ (курс ULA для байеров) и байер (обмен для своих клиентов) загружают QR-код вместе с реквизитами.
-- Плательщик видит QR над текстом реквизитов, нажатие увеличивает.
--   • Хранилище «fx-qr» — открытое по прямой ссылке (имя файла случайное, списка нет).
--     Загружать можно только в свою папку (папка = id пользователя). Картинки до 1 МБ.
--   • Путь файла хранится в конце текста реквизитов — менять таблицы не нужно.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_41_platform_eta.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 42) then
      raise exception 'СТОП: файл 42 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
    if not exists (select 1 from public.schema_migrations where version = 41) then
      raise exception 'СТОП: сначала запустите migration_41_platform_eta.sql, потом этот файл. Ничего не изменено.';
    end if;
  end if;
end $$;


-- 1. Хранилище QR-кодов
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fx-qr', 'fx-qr', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fx-qr: insert" on storage.objects;
drop policy if exists "fx-qr: delete" on storage.objects;
create policy "fx-qr: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fx-qr' and split_part(name, '/', 1) = auth.uid()::text);
create policy "fx-qr: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'fx-qr' and split_part(name, '/', 1) = auth.uid()::text);


-- Отметка: файл 42 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (42, 'migration_42_fx_qr.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
