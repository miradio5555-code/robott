-- =====================================================
-- ULA FACTORY — миграция 44: фото в заявке по ссылке
--
-- Клиент из Instagram/WhatsApp открывает «ссылку для заявок», прикладывает до 5 фото товара,
-- пишет описание — и у байера сразу создаётся заказ уже с этими фото.
--
--   • request_photo_dir(token)          — папка для фото только что созданной заявки (id заказа);
--   • request_photo_upload_ok(name)     — можно ли клиенту без входа загрузить этот файл в order-photos;
--   • request_attach_photos(token, [])  — прикрепить загруженные фото к заказу (не больше 5);
--   • order_push                        — отметка «push о заявке уже отправлен» (чтобы не слали дважды).
--
-- Защита: загрузка без входа — только в заказ-заявку, созданную меньше 30 минут назад,
-- только картинки, не больше 10 файлов (5 фото + 5 маленьких копий). Прикрепить может только тот,
-- у кого ссылка слежения за этим заказом (её получает клиент после отправки).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_43_push.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 44) then
      raise exception 'СТОП: файл 44 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Папка для фото: id свежей заявки по ссылке слежения
create or replace function public.request_photo_dir(p_otoken text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select o.id from public.orders o
   where p_otoken is not null and char_length(p_otoken) between 16 and 128
     and o.public_token = p_otoken and o.source = 'request'
     and o.created_at > now() - interval '30 minutes'
   limit 1;
$$;
revoke all on function public.request_photo_dir(text) from public, anon, authenticated;
grant execute on function public.request_photo_dir(text) to anon, authenticated;


-- 2. Загрузка без входа в order-photos: путь <id заказа>/<имя>.jpg|webp|png
create or replace function public.request_photo_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.orders o
                  where o.id::text = split_part(p_name, '/', 1)
                    and o.source = 'request'
                    and o.created_at > now() - interval '30 minutes')
     and (select count(*) from storage.objects s
           where s.bucket_id = 'order-photos' and split_part(s.name, '/', 1) = split_part(p_name, '/', 1)) < 10;
$$;
revoke all on function public.request_photo_upload_ok(text) from public, anon, authenticated;
grant execute on function public.request_photo_upload_ok(text) to anon, authenticated;

drop policy if exists "order-photos: request insert" on storage.objects;
create policy "order-photos: request insert" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'order-photos' and public.request_photo_upload_ok(name));


-- 3. Прикрепить загруженные фото к заказу
create or replace function public.request_attach_photos(p_otoken text, p_paths text[])
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := public.request_photo_dir(p_otoken);
  v_path text;
  v_n int := 0;
begin
  if v_id is null then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if p_paths is null or array_length(p_paths, 1) is null then return 0; end if;
  foreach v_path in array p_paths[1:5] loop
    continue when v_path is null or split_part(v_path, '/', 1) <> v_id::text;
    continue when not exists (select 1 from storage.objects s where s.bucket_id = 'order-photos' and s.name = v_path);
    continue when exists (select 1 from public.order_photos p where p.order_id = v_id and p.storage_path = v_path);
    exit when (select count(*) from public.order_photos p where p.order_id = v_id) >= 5;
    insert into public.order_photos (order_id, storage_path) values (v_id, v_path);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.request_attach_photos(text, text[]) from public, anon, authenticated;
grant execute on function public.request_attach_photos(text, text[]) to anon, authenticated;


-- 4. Push «новая заявка» — один раз на заказ (пишет только функция push-notify)
create table if not exists public.order_push (
  order_id uuid primary key references public.orders(id) on delete cascade,
  at       timestamptz not null default now()
);
alter table public.order_push enable row level security;
revoke all on public.order_push from anon, authenticated;


-- ✅ ОТМЕТКА: файл 44 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (44, 'migration_44_request_photos.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
