-- =====================================================
-- ULA FACTORY — миграция 30: проверка личности обменника (паспорт и лицо)
--
-- Чтобы клиенты могли доверять обменникам, а при обмане человека можно было найти:
--   • байер один раз загружает фото паспорта (лицевая сторона, по желанию — обратная)
--     и селфи с паспортом в руке, пишет ФИО и номер паспорта, даёт согласие;
--   • администратор смотрит фото и решает: «Проверен» или «Отклонено» (с причиной);
--   • включить обмен для клиентов можно ТОЛЬКО после проверки;
--     если администратор снимает проверку — обмен выключается сам.
--   • Данные хранятся и после удаления кабинета (по согласию — для разбора жалоб).
--     Фото — в закрытом хранилище «kyc»: видит только сам байер и администратор,
--     удалить может только администратор.
--
--   • fx_kyc                  — заявки на проверку (одна на пользователя).
--   • kyc_submit(...)          — байер отправляет документы.
--   • admin_kyc_list()         — администратор: список с названием кабинета.
--   • admin_kyc_decide(...)    — администратор: проверен / отклонено / снять проверку.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_29_exchange_status.sql. Можно запускать повторно.
-- ВНИМАНИЕ: после запуска обмен у кабинетов без проверки выключится.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 30) then
      raise exception 'СТОП: файл 30 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Заявки на проверку (одна на пользователя; без связи с удалением аккаунта — данные остаются)
create table if not exists public.fx_kyc (
  user_id      uuid primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  full_name    text not null check (char_length(full_name) between 5 and 120),
  doc_number   text not null check (doc_number ~ '^[A-Z0-9]{5,20}$'),
  front_path   text not null check (char_length(front_path) <= 200),
  back_path    text check (back_path is null or char_length(back_path) <= 200),
  selfie_path  text not null check (char_length(selfie_path) <= 200),
  email        text,
  phone        text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  reason       text check (reason is null or char_length(reason) <= 300),
  consent_at   timestamptz not null,
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid
);
create index if not exists fx_kyc_status_idx on public.fx_kyc(status, submitted_at desc);
alter table public.fx_kyc enable row level security;
drop policy if exists "fx_kyc: read" on public.fx_kyc;
create policy "fx_kyc: read" on public.fx_kyc for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.fx_kyc from anon, authenticated;
grant select on public.fx_kyc to authenticated;

-- кабинет проверен = его владелец прошёл проверку
create or replace function public.kyc_ok(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workspaces w join public.fx_kyc k on k.user_id = w.owner_id
                  where w.id = p_ws and k.status = 'approved');
$$;
revoke all on function public.kyc_ok(uuid) from public, anon, authenticated;


-- 2. Фото документов: закрытое хранилище «kyc»
--    Путь: <id пользователя>/<имя>.jpg. Загружает только сам пользователь в свою папку
--    (пока не проверен, не больше 12 файлов). Видит — он сам и администратор. Удаляет — только администратор.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc', 'kyc', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.kyc_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$'
     and split_part(p_name, '/', 1) = auth.uid()::text
     and not exists (select 1 from public.fx_kyc k where k.user_id = auth.uid() and k.status = 'approved')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'kyc' and split_part(o.name, '/', 1) = auth.uid()::text) < 12;
$$;
revoke all on function public.kyc_upload_ok(text) from public, anon, authenticated;
grant execute on function public.kyc_upload_ok(text) to authenticated;

drop policy if exists "kyc: insert" on storage.objects;
drop policy if exists "kyc: read"   on storage.objects;
drop policy if exists "kyc: delete" on storage.objects;
create policy "kyc: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc' and public.kyc_upload_ok(name));
create policy "kyc: read" on storage.objects for select to authenticated
  using (bucket_id = 'kyc' and (split_part(name, '/', 1) = auth.uid()::text or public.is_admin()));
create policy "kyc: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'kyc' and public.is_admin());


-- 3. Байер отправляет документы на проверку
create or replace function public.kyc_submit(
  p_name    text,
  p_doc     text,
  p_front   text,
  p_back    text,
  p_selfie  text,
  p_consent boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_ws   uuid;
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_doc  text := upper(regexp_replace(coalesce(p_doc, ''), '[\s-]', '', 'g'));
  v_back text := nullif(btrim(coalesce(p_back, '')), '');
  f      text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select id into v_ws from public.workspaces where owner_id = v_uid order by created_at limit 1;
  if v_ws is null then raise exception 'no_access' using errcode = '42501'; end if;
  if coalesce(p_consent, false) is not true then raise exception 'kyc_consent' using errcode = '22023'; end if;
  if char_length(v_name) not between 5 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_doc !~ '^[A-Z0-9]{5,20}$' then raise exception 'invalid_doc' using errcode = '22023'; end if;
  if exists (select 1 from public.fx_kyc where user_id = v_uid and status = 'approved') then
    raise exception 'kyc_done' using errcode = 'P0001';
  end if;
  -- файлы: только свои и уже загруженные
  foreach f in array array[p_front, p_selfie, coalesce(v_back, p_front)] loop
    if f is null or split_part(f, '/', 1) <> v_uid::text
       or not exists (select 1 from storage.objects where bucket_id = 'kyc' and name = f) then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;
  end loop;

  insert into public.fx_kyc (user_id, workspace_id, full_name, doc_number, front_path, back_path, selfie_path,
                             email, phone, status, reason, consent_at, submitted_at, reviewed_at, reviewed_by)
  values (v_uid, v_ws, v_name, v_doc, p_front, v_back, p_selfie,
          (select email::text from auth.users where id = v_uid),
          (select phone from public.profiles where user_id = v_uid),
          'pending', null, now(), now(), null, null)
  on conflict (user_id) do update set
    workspace_id = excluded.workspace_id, full_name = excluded.full_name, doc_number = excluded.doc_number,
    front_path = excluded.front_path, back_path = excluded.back_path, selfie_path = excluded.selfie_path,
    email = excluded.email, phone = excluded.phone, status = 'pending', reason = null,
    consent_at = excluded.consent_at, submitted_at = now(), reviewed_at = null, reviewed_by = null;
  return 'pending';
end;
$$;
revoke all on function public.kyc_submit(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.kyc_submit(text, text, text, text, text, boolean) to authenticated;


-- 4. Администратор: список и решение
create or replace function public.admin_kyc_list()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'user_id', k.user_id, 'workspace_id', k.workspace_id, 'ws_name', w.name,
      'full_name', k.full_name, 'doc_number', k.doc_number,
      'front_path', k.front_path, 'back_path', k.back_path, 'selfie_path', k.selfie_path,
      'email', k.email, 'phone', k.phone, 'status', k.status, 'reason', k.reason,
      'submitted_at', k.submitted_at, 'reviewed_at', k.reviewed_at)
      order by (k.status = 'pending') desc, k.submitted_at desc)
    from public.fx_kyc k left join public.workspaces w on w.id = k.workspace_id), '[]'::json);
end;
$$;
revoke all on function public.admin_kyc_list() from public, anon, authenticated;
grant execute on function public.admin_kyc_list() to authenticated;

-- p_ok = true — «Проверен»; false — «Отклонено» (если ещё не проверен) или «Проверка снята» (если был проверен)
create or replace function public.admin_kyc_decide(p_user uuid, p_ok boolean, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old    text;
  v_new    text;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 300), '');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select status into v_old from public.fx_kyc where user_id = p_user for update;
  if v_old is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_ok then
    if v_old <> 'pending' then raise exception 'bad_status' using errcode = 'P0001'; end if;
    v_new := 'approved';
  else
    if v_reason is null then raise exception 'reason_required' using errcode = '22023'; end if;
    v_new := case when v_old = 'approved' then 'revoked' else 'rejected' end;
  end if;
  update public.fx_kyc
     set status = v_new, reason = case when p_ok then null else v_reason end,
         reviewed_at = now(), reviewed_by = auth.uid()
   where user_id = p_user;
  -- проверку сняли — обмен у его кабинетов выключается
  if v_new in ('revoked', 'rejected') then
    update public.workspaces set fx_on = false where owner_id = p_user and fx_on;
  end if;
  return v_new;
end;
$$;
revoke all on function public.admin_kyc_decide(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_kyc_decide(uuid, boolean, text) to authenticated;


-- 5. Включить обмен можно только после проверки
create or replace function public._ws_fx_kyc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fx_on and not coalesce(old.fx_on, false) and not public.kyc_ok(new.id) then
    raise exception 'kyc_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public._ws_fx_kyc() from public, anon, authenticated;
drop trigger if exists ws_fx_kyc on public.workspaces;
create trigger ws_fx_kyc before update of fx_on on public.workspaces
  for each row execute function public._ws_fx_kyc();

-- у кого обмен уже включён без проверки — выключаем (курс и реквизиты остаются)
update public.workspaces set fx_on = false where fx_on and not public.kyc_ok(id);


-- ✅ ОТМЕТКА: файл 30 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (30, 'migration_30_exchange_kyc.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
