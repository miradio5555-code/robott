-- =====================================================
-- ULA FACTORY — миграция 17: заявки по ссылке
--
-- У байера появляется «ссылка для заявок». Клиент открывает её без регистрации,
-- вписывает ссылку на товар, количество, имя и телефон — и в кабинете байера
-- сразу создаётся новый заказ (статус «Новый», пометка «заявка»).
-- Клиент получает номер заказа и ссылку, по которой следит за ним.
--
--   • workspaces.request_token  — секретная часть ссылки (пусто = ссылка отключена);
--   • orders.source             — откуда заказ: 'manual' (создал байер) или 'request' (заявка клиента);
--   • request_link_rotate(ws)   — создать новую ссылку (старая сразу перестаёт работать);
--   • request_link_revoke(ws)   — отключить ссылку;
--   • get_request_form(token)   — для страницы заявки: название кабинета (если ссылка действует);
--   • submit_request(...)       — принять заявку и создать заказ.
--
-- Защита от спама и ботов (форма открыта всем):
--   • данные проверяются так же строго, как в адресе доставки;
--   • не больше 5 заявок в час с одного телефона, 20 в час и 100 в сутки на кабинет;
--   • скрытое поле-ловушка: заполнили бот — заявка тихо игнорируется;
--   • ссылку можно в любой момент заменить или отключить.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_16_shipments.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
--    (иначе он перезапишет новые функции). Ничего не будет изменено.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 17) then
      raise exception 'СТОП: файл 17 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Откуда заказ
alter table public.orders add column if not exists source text not null default 'manual';
alter table public.orders drop constraint if exists orders_source_chk;
alter table public.orders add  constraint orders_source_chk check (source in ('manual', 'request'));

create index if not exists orders_request_idx on public.orders (workspace_id, created_at) where source = 'request';


-- 2. Секрет ссылки для заявок (пусто = отключена)
alter table public.workspaces add column if not exists request_token text;
alter table public.workspaces drop constraint if exists workspaces_request_token_fmt;
alter table public.workspaces add  constraint workspaces_request_token_fmt
  check (request_token is null or request_token ~ '^[a-f0-9]{32}$');
create unique index if not exists workspaces_request_token_key on public.workspaces (request_token) where request_token is not null;


-- 3. Байер: новая ссылка / отключить (менять токен напрямую с сайта нельзя)
create or replace function public.request_link_rotate(p_ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not public.is_member(p_ws) then raise exception 'forbidden'; end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  update public.workspaces set request_token = v_token where id = p_ws;
  return v_token;
end;
$$;

create or replace function public.request_link_revoke(p_ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_ws) then raise exception 'forbidden'; end if;
  update public.workspaces set request_token = null where id = p_ws;
end;
$$;

revoke all on function public.request_link_rotate(uuid) from public, anon;
revoke all on function public.request_link_revoke(uuid) from public, anon;
grant execute on function public.request_link_rotate(uuid) to authenticated;
grant execute on function public.request_link_revoke(uuid) to authenticated;


-- 4. Страница заявки: кому пишет клиент (только название кабинета, больше ничего)
create or replace function public.get_request_form(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('name', w.name)
    from public.workspaces w
   where p_token ~ '^[a-f0-9]{32}$' and w.request_token = p_token
   limit 1;
$$;

revoke all on function public.get_request_form(text) from public, anon, authenticated;
grant execute on function public.get_request_form(text) to anon, authenticated;


-- 5. Принять заявку и создать заказ
create or replace function public.submit_request(
  p_token    text,
  p_name     text,
  p_phone    text,
  p_telegram text,
  p_product  text,
  p_link     text,
  p_qty      numeric,
  p_comment  text,
  p_website  text default null     -- ловушка для ботов: людям это поле не видно
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ws        record;
  v_name    text := btrim(coalesce(p_name, ''));
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_tg      text := nullif(regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
  v_product text := btrim(coalesce(p_product, ''));
  v_link    text := nullif(btrim(coalesce(p_link, '')), '');
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_qty     numeric := coalesce(p_qty, 1);
  v_note    text;
  v_num     text;
  v_otoken  text;
begin
  -- боты заполняют скрытое поле: делаем вид, что всё хорошо, но ничего не создаём
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    return json_build_object('ok', true, 'order_number', '—', 'token', null);
  end if;

  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  -- кабинет по ссылке; строка блокируется, чтобы лимиты считались честно
  select id, default_purchase_currency, default_client_currency, default_delivery_currency, default_delivery_tariff
    into ws
    from public.workspaces
   where request_token = p_token
   for update;
  if ws.id is null then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;

  -- проверки (такие же, как на сайте)
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then raise exception 'invalid_telegram' using errcode = '22023'; end if;
  if char_length(v_product) > 300 then raise exception 'invalid_product' using errcode = '22023'; end if;
  if v_link is not null and (char_length(v_link) > 2048 or v_link !~* '^https?://[^[:space:]]+$') then
    raise exception 'invalid_link' using errcode = '22023';
  end if;
  if v_product = '' and v_link is null then raise exception 'invalid_product' using errcode = '22023'; end if;
  if v_qty <= 0 or v_qty > 100000 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
  if v_comment is not null and char_length(v_comment) > 1000 then raise exception 'invalid_comment' using errcode = '22023'; end if;

  -- не чаще лимитов
  if (select count(*) from public.orders
       where workspace_id = ws.id and source = 'request' and client_phone = v_phone
         and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.orders
          where workspace_id = ws.id and source = 'request' and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.orders
          where workspace_id = ws.id and source = 'request' and created_at > now() - interval '1 day') >= 100
  then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  -- заметка для байера (клиент её не видит)
  v_note := 'Заявка от клиента'
    || case when v_tg is not null then E'\nTelegram: @' || v_tg else '' end
    || case when v_comment is not null then E'\nКомментарий: ' || v_comment else '' end;

  insert into public.orders (
    workspace_id, source, client_name, client_phone, product_ru, supplier_link, quantity, status,
    purchase_currency, client_currency, delivery_currency, delivery_tariff, admin_comment)
  values (
    ws.id, 'request', v_name, v_phone,
    coalesce(nullif(v_product, ''), 'Товар по ссылке'), v_link, v_qty, 'new',
    ws.default_purchase_currency, ws.default_client_currency, ws.default_delivery_currency,
    least(coalesce(ws.default_delivery_tariff, 0), 99999999.99), v_note)
  returning order_number, public_token into v_num, v_otoken;

  return json_build_object('ok', true, 'order_number', v_num, 'token', v_otoken);
end;
$$;

revoke all on function public.submit_request(text, text, text, text, text, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.submit_request(text, text, text, text, text, text, numeric, text, text) to anon, authenticated;

-- ✅ ОТМЕТКА: файл 17 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (17, 'migration_17_requests.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
