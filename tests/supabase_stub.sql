-- =====================================================
-- ТЕСТЫ: маленькая «копия» Supabase для проверки SQL-файлов на компьютере.
-- Только то, что нужно нашим файлам: роли, auth.users, auth.uid(), storage.
-- В настоящую базу этот файл НЕ запускать.
-- =====================================================

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant anon, authenticated, service_role to postgres;

grant usage on schema public to anon, authenticated, service_role;
-- как в Supabase: новые таблицы и функции сразу доступны ролям API,
-- а закрывают их правила RLS и revoke в наших файлах
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- auth: пользователи и «кто сейчас вошёл»
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);
-- в тестах «вошедший пользователь» задаётся так: set request.uid = '<uuid>';
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.uid', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- storage: корзины и файлы
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated;

-- первый администратор (как в настоящей базе)
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000000a', 'admin@test.kg', '{"full_name":"Админ"}');
