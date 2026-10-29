-- =====================================================
-- ULA FACTORY — миграция 38: ошибки у пользователей
--
-- Если у байера или клиента на телефоне что-то сломалось (ошибка в программе сайта),
-- сайт сам тихо сообщает об этом. Админ видит список в разделе «Байеры» и получает сообщение в Telegram.
--   • client_errors — одна строка на одну ошибку: сколько раз случилась, у скольких людей, когда последний раз.
--   • report_client_error(...) — записать ошибку (могут все, и клиенты без входа).
--     Одинаковые ошибки складываются в одну строку. Новых ошибок — не больше 30 в час,
--     всего строк — не больше 500, старше 30 дней удаляются сами.
--   • Читает и очищает только админ. Адреса страниц приходят без секретных частей (?order=…).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_37_country.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 38) then
      raise exception 'СТОП: файл 38 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Таблица ошибок
create table if not exists public.client_errors (
  id          bigint generated always as identity primary key,
  fp          text not null unique,               -- «отпечаток»: текст + файл + строка
  message     text not null,
  source      text,
  line        int,
  col         int,
  stack       text,
  page        text,
  app_version text,
  browser     text,
  lang        text,
  hits        int not null default 1,
  user_ids    uuid[] not null default '{}',       -- кто сталкивался (до 50 человек)
  anon_hits   int not null default 0,             -- сколько раз у клиентов без входа
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  notified_at timestamptz                          -- когда сообщили админу в Telegram
);
create index if not exists client_errors_last_seen on public.client_errors (last_seen);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select on public.client_errors to authenticated;

drop policy if exists "client_errors: admin reads" on public.client_errors;
create policy "client_errors: admin reads" on public.client_errors for select to authenticated
  using (public.is_admin());


-- 2. Записать ошибку. Ответ true — такой ошибки ещё не было (или вернулась в новой версии сайта)
create or replace function public.report_client_error(
  p_message text, p_source text default null, p_line int default null, p_col int default null,
  p_stack text default null, p_page text default null, p_version text default null,
  p_browser text default null, p_lang text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_msg text := left(btrim(coalesce(p_message, '')), 300);
  v_src text := nullif(left(regexp_replace(coalesce(p_source, ''), '[?#].*$', ''), 200), '');
  v_ver text := nullif(left(regexp_replace(coalesce(p_version, ''), '[^0-9A-Za-z]', '', 'g'), 20), '');
  v_fp  text;
  v_uid uuid := auth.uid();
  r     public.client_errors%rowtype;
begin
  if v_msg = '' then return false; end if;
  v_fp := md5(v_msg || '|' || coalesce(v_src, '') || '|' || coalesce(p_line, 0)::text);

  select * into r from public.client_errors where fp = v_fp for update;
  if found then
    update public.client_errors set
      hits        = least(hits + 1, 1000000000),
      anon_hits   = anon_hits + case when v_uid is null then 1 else 0 end,
      user_ids    = case when v_uid is null or v_uid = any(user_ids) or cardinality(user_ids) >= 50
                         then user_ids else user_ids || v_uid end,
      last_seen   = now(),
      page        = coalesce(nullif(left(regexp_replace(coalesce(p_page, ''), '[?#].*$', ''), 100), ''), page),
      browser     = coalesce(nullif(left(coalesce(p_browser, ''), 160), ''), browser),
      app_version = greatest(app_version, v_ver),
      -- ошибку уже исправляли, а она снова есть в более новой версии сайта — сообщить ещё раз
      notified_at = case when coalesce(v_ver > coalesce(r.app_version, ''), false) then null else notified_at end
    where id = r.id;
    return coalesce(v_ver > coalesce(r.app_version, ''), false) and r.notified_at is not null;
  end if;

  -- защита от потока: новых ошибок не больше 30 в час
  if (select count(*) from public.client_errors where first_seen > now() - interval '1 hour') >= 30 then
    return false;
  end if;

  delete from public.client_errors where last_seen < now() - interval '30 days';
  delete from public.client_errors where id in (
    select id from public.client_errors order by last_seen desc offset 499);

  insert into public.client_errors (fp, message, source, line, col, stack, page, app_version, browser, lang, user_ids, anon_hits)
  values (v_fp, v_msg, v_src,
          case when p_line between 0 and 10000000 then p_line end,
          case when p_col between 0 and 10000000 then p_col end,
          nullif(left(coalesce(p_stack, ''), 1500), ''),
          nullif(left(regexp_replace(coalesce(p_page, ''), '[?#].*$', ''), 100), ''),
          v_ver,
          nullif(left(coalesce(p_browser, ''), 160), ''),
          nullif(left(coalesce(p_lang, ''), 5), ''),
          case when v_uid is null then '{}'::uuid[] else array[v_uid] end,
          case when v_uid is null then 1 else 0 end)
  on conflict (fp) do nothing;
  return found;
end;
$$;
revoke all on function public.report_client_error(text, text, int, int, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.report_client_error(text, text, int, int, text, text, text, text, text) to anon, authenticated;


-- 3. Админ: удалить одну ошибку (исправлена) или все (p_id = null)
create or replace function public.admin_clear_errors(p_id bigint default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.client_errors where p_id is null or id = p_id;
end;
$$;
revoke all on function public.admin_clear_errors(bigint) from public, anon, authenticated;
grant execute on function public.admin_clear_errors(bigint) to authenticated;


-- Отметка: файл 38 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (38, 'migration_38_client_errors.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
