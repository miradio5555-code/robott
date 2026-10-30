-- =====================================================
-- ULA FACTORY — миграция 40: фото, скриншоты и файлы в чате поддержки
--
-- Байер (и админ в ответ) может прикрепить к сообщению до 6 файлов:
-- фото и скриншоты, видео, PDF, Word, Excel, текст. До 20 МБ каждый.
--   • Хранилище «support-files» — закрытое: байер видит и загружает только свою папку (папка = id байера),
--     админ — все папки. Ссылки на файлы сайт получает на время (подписанные ссылки).
--     Нельзя: svg, html и другие файлы, в которых можно спрятать код.
--   • support_messages.files — список файлов сообщения: путь, имя, тип, размер.
--     Сообщение может быть без текста, если есть файл.
--   • support_send и admin_support_reply принимают p_files. Каждый файл проверяется:
--     лежит в папке этой переписки и действительно загружен.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_39_support_live.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 40) then
      raise exception 'СТОП: файл 40 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Файлы сообщения; текст может быть пустым, если есть файл
alter table public.support_messages add column if not exists files jsonb not null default '[]'::jsonb;

do $$
declare c text;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.support_messages'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) like '%body%'
  loop
    execute format('alter table public.support_messages drop constraint %I', c);
  end loop;
end $$;
alter table public.support_messages add constraint support_messages_body_check
  check (char_length(body) <= 4000
         and jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 6
         and (char_length(btrim(body)) > 0 or jsonb_array_length(files) > 0));


-- 2. Закрытое хранилище файлов поддержки
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support-files', 'support-files', false, 20971520, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support-files: read"   on storage.objects;
drop policy if exists "support-files: insert" on storage.objects;
create policy "support-files: read" on storage.objects for select to authenticated
  using (bucket_id = 'support-files' and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));
create policy "support-files: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'support-files' and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));


-- 3. Проверка списка файлов: в папке этой переписки, действительно загружены, не больше 6
create or replace function public.support_clean_files(p_files jsonb, p_owner uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  f jsonb;
  v_path text;
  v_out jsonb := '[]'::jsonb;
begin
  if p_files is null or jsonb_typeof(p_files) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p_files) > 6 then raise exception 'too_many_files'; end if;
  for f in select * from jsonb_array_elements(p_files) loop
    v_path := f->>'path';
    if jsonb_typeof(f) <> 'object' or v_path is null
       or v_path !~ ('^' || p_owner::text || '/[A-Za-z0-9._-]{1,120}$') then
      raise exception 'bad_file';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'support-files' and o.name = v_path) then
      raise exception 'file_not_uploaded';
    end if;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'path', v_path,
      'name', left(coalesce(nullif(btrim(f->>'name'), ''), 'file'), 120),
      'type', left(coalesce(f->>'type', ''), 100),
      'size', least(greatest(coalesce((f->>'size')::bigint, 0), 0), 26214400)));
  end loop;
  return v_out;
end;
$$;
revoke all on function public.support_clean_files(jsonb, uuid) from public, anon, authenticated;


-- 4. Байер пишет в поддержку (можно с файлами). Копия из файла 9 + p_files.
drop function if exists public.support_send(text, jsonb);
create or replace function public.support_send(p_body text, p_meta jsonb default '{}'::jsonb, p_files jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_files jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_active) then
    raise exception 'no_access';
  end if;
  v_files := public.support_clean_files(p_files, auth.uid());
  if char_length(btrim(coalesce(p_body, ''))) = 0 and jsonb_array_length(v_files) = 0 then raise exception 'empty_message'; end if;
  -- защита от спама: не больше 30 сообщений в час
  if (select count(*) from public.support_messages
       where user_id = auth.uid() and not from_admin and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many_messages';
  end if;
  insert into public.support_messages (user_id, from_admin, body, meta, files)
  values (auth.uid(), false, left(btrim(coalesce(p_body, '')), 4000),
          case when jsonb_typeof(p_meta) = 'object' and octet_length(p_meta::text) <= 8000 then p_meta else '{}'::jsonb end,
          v_files)
  returning id into v_id;
  return v_id;
end;
$$;


-- 5. Админ отвечает байеру (можно с файлами). Копия из файла 9 + p_files.
drop function if exists public.admin_support_reply(uuid, text);
create or replace function public.admin_support_reply(p_user uuid, p_body text, p_files jsonb default '[]'::jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_files jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'user_not_found'; end if;
  v_files := public.support_clean_files(p_files, p_user);
  if char_length(btrim(coalesce(p_body, ''))) = 0 and jsonb_array_length(v_files) = 0 then raise exception 'empty_message'; end if;
  insert into public.support_messages (user_id, from_admin, body, files)
  values (p_user, true, left(btrim(coalesce(p_body, '')), 4000), v_files)
  returning id into v_id;
  -- ответили — значит, сообщения байера прочитаны
  update public.support_messages set read_at = now()
   where user_id = p_user and not from_admin and read_at is null;
  return v_id;
end;
$$;

revoke all on function public.support_send(text, jsonb, jsonb)       from public, anon;
revoke all on function public.admin_support_reply(uuid, text, jsonb) from public, anon;
grant execute on function public.support_send(text, jsonb, jsonb)       to authenticated;
grant execute on function public.admin_support_reply(uuid, text, jsonb) to authenticated;


-- Отметка: файл 40 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (40, 'migration_40_support_files.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
