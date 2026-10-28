-- =====================================================
-- ULA FACTORY — миграция 36: личное фото в профиле
--
-- Байер (и помощник) ставит своё фото в разделе «Профиль».
--   • profiles.avatar_path — путь к файлу фото (меняет только сам человек).
--   • Хранилище «avatars» — публичное чтение, загрузка и удаление только в свою папку (папка = id пользователя).
--     Только png / jpeg / webp до 1 МБ (svg запрещён: в нём можно спрятать код).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_35_shop_cart.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 36) then
      raise exception 'СТОП: файл 36 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Колонка и право менять её себе
alter table public.profiles add column if not exists avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$');
grant update (avatar_path) on public.profiles to authenticated;


-- 2. Хранилище фото
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: read"   on storage.objects;
drop policy if exists "avatars: insert" on storage.objects;
drop policy if exists "avatars: update" on storage.objects;
drop policy if exists "avatars: delete" on storage.objects;
create policy "avatars: read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars: update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);


-- Отметка: файл 36 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (36, 'migration_36_avatar.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
