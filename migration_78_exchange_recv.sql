-- =====================================================
-- ULA FACTORY — миграция 78: реквизиты клиента в заявке на обмен (куда отправить юани)
--
-- ЗАЧЕМ. Раньше в заявке были только имя, телефон и сумма. Обменник не знал, куда отправить юани:
-- приходилось спрашивать в чате или по телефону, а клиент мог написать «Alipay» без номера.
-- Теперь клиент сразу указывает, куда получить юани: Alipay, WeChat или карта китайского банка,
-- номер или аккаунт, имя получателя и (по желанию) QR-код. Обменник видит это в карточке заявки.
--
-- КАК УСТРОЕНО.
--   • Новые поля заявки: recv_method ('alipay' | 'wechat' | 'bank'), recv_account, recv_name,
--     recv_qr (путь к QR в закрытом хранилище «fx-proofs», имя «<заявка>/q-<случайное>.jpg»),
--     recv_at (когда реквизиты указаны или изменены последний раз).
--   • submit_exchange — три новых необязательных параметра: способ, номер, имя. Старые вызовы работают как раньше.
--   • fx_set_recv(заявка, способ, номер, имя, QR, убрать QR) — указать или изменить реквизиты.
--     Клиент — по секретному номеру заявки (без входа). Можно, пока юани ещё не отправлены
--     (статус «новая», «оплачена» или «подтверждена»), нет открытого спора и заявке не больше 7 дней.
--     Нужен способ и номер ИЛИ QR-код. Не больше 20 изменений на заявку.
--     Если реквизиты меняются позже чем через 2 минуты после заявки, в чат заявки от имени клиента пишется
--     сообщение «🔄 Новые реквизиты: …» — обменник видит его как непрочитанное и не отправит юани по старым.
--   • QR-код клиента: загрузить «q-…» можно только в свою заявку, пока реквизиты можно менять, не больше 5 файлов.
--     Видит его только обменник этой заявки (и администратор) — как чек оплаты.
--   • Чек оплаты: лимит «3 файла» по-прежнему считает только чеки — QR («q-…») не мешает.
--   • get_exchange_status — клиент видит свои реквизиты и может ли он их менять (путь к QR — нет, только отметку).
--   • admin_fx_disputes — в споре администратор видит, какие реквизиты указал клиент.
--
-- Заказы, клиенты, платежи, балансы и аккаунты этот файл НЕ меняет. Суммы и статусы заявок не меняются.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, файл 77 запущен, ни один файл новее 78 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 78) then
    raise exception 'СТОП: файл 78 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
  if not exists (select 1 from public.schema_migrations where version = 77) then
    raise exception 'СТОП: сначала запустите миграцию 77 (push о сообщениях в чате обмена). Ничего не изменено.';
  end if;
end $$;


-- 1. Реквизиты клиента в заявке
alter table public.exchange_requests add column if not exists recv_method  text;
alter table public.exchange_requests add column if not exists recv_account text;
alter table public.exchange_requests add column if not exists recv_name    text;
alter table public.exchange_requests add column if not exists recv_qr      text;
alter table public.exchange_requests add column if not exists recv_at      timestamptz;

alter table public.exchange_requests drop constraint if exists exchange_requests_recv_method_check;
alter table public.exchange_requests add constraint exchange_requests_recv_method_check
  check (recv_method is null or recv_method in ('alipay', 'wechat', 'bank'));
alter table public.exchange_requests drop constraint if exists exchange_requests_recv_account_check;
alter table public.exchange_requests add constraint exchange_requests_recv_account_check
  check (recv_account is null or char_length(recv_account) between 3 and 120);
alter table public.exchange_requests drop constraint if exists exchange_requests_recv_name_check;
alter table public.exchange_requests add constraint exchange_requests_recv_name_check
  check (recv_name is null or char_length(recv_name) between 1 and 120);
alter table public.exchange_requests drop constraint if exists exchange_requests_recv_qr_check;
alter table public.exchange_requests add constraint exchange_requests_recv_qr_check
  check (recv_qr is null or char_length(recv_qr) <= 200);


-- 2. Можно ли менять реквизиты: юани ещё не отправлены, спор не открыт, заявке не больше 7 дней
create or replace function public.fx_recv_editable(p_status text, p_dispute text, p_created timestamptz)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_status in ('new', 'paid', 'confirmed'), false)
     and coalesce(p_dispute, '') <> 'open'
     and coalesce(p_created > now() - interval '7 days', false);
$$;
revoke all on function public.fx_recv_editable(text, text, timestamptz) from public, anon, authenticated;


-- 3. QR-код клиента: закрытое «fx-proofs», имя «<заявка>/q-<случайное>.jpg», не больше 5 файлов
create or replace function public.fx_recv_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/q-[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and public.fx_recv_editable(r.status, r.dispute, r.created_at))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-proofs' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)
             and split_part(o.name, '/', 2) like 'q-%') < 5;
$$;
revoke all on function public.fx_recv_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_recv_upload_ok(text) to anon, authenticated;

drop policy if exists "fx-proofs: recv" on storage.objects;
create policy "fx-proofs: recv" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fx-proofs' and public.fx_recv_upload_ok(name));

-- чек оплаты: лимит «3 файла» считает только чеки — фото чата («c-…»), спора («d-…») и QR («q-…») не мешают
create or replace function public.fx_proof_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$'
     and split_part(p_name, '/', 2) !~ '^[cdq]-'   -- «c-…», «d-…», «q-…» — фото чата, спора и QR, у них свои правила
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and r.status = 'new' and r.proof_path is null
                    and r.created_at > now() - interval '1 day')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-proofs' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)
             and split_part(o.name, '/', 2) !~ '^[cdq]-') < 3;
$$;
revoke all on function public.fx_proof_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_proof_upload_ok(text) to anon, authenticated;


-- 4. Указать или изменить реквизиты (клиент — по секретному номеру заявки)
--    p_qr — новый QR (путь «<заявка>/q-…»); p_drop_qr = true — убрать QR; иначе QR остаётся прежним.
create or replace function public.fx_set_recv(
  p_id      uuid,
  p_method  text,
  p_account text,
  p_name    text,
  p_qr      text default null,
  p_drop_qr boolean default false
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r         record;
  v_method  text := nullif(lower(btrim(coalesce(p_method, ''))), '');
  v_account text := nullif(btrim(coalesce(p_account, '')), '');
  v_name    text := nullif(btrim(coalesce(p_name, '')), '');
  v_qr      text := nullif(btrim(coalesce(p_qr, '')), '');
begin
  select id, status, dispute, created_at, recv_qr into r from public.exchange_requests where id = p_id for update;
  if r.id is null then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if not public.fx_recv_editable(r.status, r.dispute, r.created_at) then
    raise exception 'recv_locked' using errcode = 'P0001';
  end if;
  if v_method is null or v_method not in ('alipay', 'wechat', 'bank') then
    raise exception 'invalid_recv_method' using errcode = '22023';
  end if;
  if v_account is not null and char_length(v_account) not between 3 and 120 then
    raise exception 'invalid_recv_account' using errcode = '22023';
  end if;
  if v_name is not null and char_length(v_name) > 120 then
    raise exception 'invalid_recv_name' using errcode = '22023';
  end if;
  if v_qr is not null then
    if v_qr !~ ('^' || p_id::text || '/q-[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$') then
      raise exception 'bad_path' using errcode = '22023';
    end if;
    if not exists (select 1 from storage.objects where bucket_id = 'fx-proofs' and name = v_qr) then
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;
  elsif not coalesce(p_drop_qr, false) then
    v_qr := r.recv_qr;
  end if;
  if v_account is null and v_qr is null then
    raise exception 'recv_empty' using errcode = '22023';
  end if;
  if (select count(*) from public.exchange_events e
       where e.request_id = p_id and e.kind = 'msg' and e.author = 'client' and e.body like '🔄 %') >= 20 then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  update public.exchange_requests
     set recv_method = v_method, recv_account = v_account, recv_name = v_name, recv_qr = v_qr, recv_at = now()
   where id = p_id;

  -- изменили позже, чем сразу после заявки, — сообщить обменнику в чате заявки
  if r.created_at < now() - interval '2 minutes' then
    insert into public.exchange_events (request_id, kind, author, body)
    values (p_id, 'msg', 'client', left('🔄 Новые реквизиты: '
      || case v_method when 'alipay' then 'Alipay' when 'wechat' then 'WeChat' else 'Карта банка Китая' end
      || coalesce(' · ' || v_account, '') || coalesce(' · ' || v_name, '')
      || case when v_qr is not null then ' · QR' else '' end, 1000));
  end if;
  return json_build_object('ok', true, 'recv_method', v_method, 'recv_account', v_account, 'recv_name', v_name,
                           'has_recv_qr', v_qr is not null);
end;
$$;
revoke all on function public.fx_set_recv(uuid, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.fx_set_recv(uuid, text, text, text, text, boolean) to anon, authenticated;


-- 5. Заявка: три новых необязательных параметра — способ получения, номер/аккаунт, имя получателя
--    (функция взята из файла 28; старый вариант без реквизитов удаляется, старые вызовы попадают в новый)
drop function if exists public.submit_exchange(text, text, text, text, numeric, text, text);
create or replace function public.submit_exchange(
  p_kind    text,    -- 'shop' (ссылка обмена / витрина), 'order' (ссылка заказа), 'cab' (общая ссылка)
  p_token   text,
  p_name    text,
  p_phone   text,
  p_cny     numeric, -- сколько юаней нужно клиенту
  p_comment text,
  p_website text default null,     -- ловушка для ботов
  p_recv_method  text default null, -- куда получить юани: 'alipay' | 'wechat' | 'bank'
  p_recv_account text default null, -- номер / аккаунт
  p_recv_name    text default null  -- имя получателя
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws      uuid;
  ws        record;
  v_name    text := btrim(coalesce(p_name, ''));
  v_phone   text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_cny     numeric := round(coalesce(p_cny, 0), 2);
  v_method  text := nullif(lower(btrim(coalesce(p_recv_method, ''))), '');
  v_account text := nullif(btrim(coalesce(p_recv_account, '')), '');
  v_rname   text := nullif(btrim(coalesce(p_recv_name, '')), '');
  v_rate    numeric;
  v_som     numeric;
  v_id      uuid;
begin
  if nullif(btrim(coalesce(p_website, '')), '') is not null then
    return json_build_object('ok', true, 'id', null);
  end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  if p_kind = 'shop' then
    select id into v_ws from public.workspaces where request_token = p_token;
  elsif p_kind = 'order' then
    select workspace_id into v_ws from public.orders where public_token = p_token;
  elsif p_kind = 'cab' then
    select workspace_id into v_ws from public.client_cabinets where token = p_token;
  end if;
  if v_ws is null then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;

  -- строка кабинета блокируется, чтобы лимиты считались честно
  select id, fx_on, fx_tiers, fx_note into ws from public.workspaces where id = v_ws for update;
  if not ws.fx_on or ws.fx_tiers is null then
    raise exception 'fx_off' using errcode = 'P0001';
  end if;

  if v_phone like '00%' then v_phone := '+' || substr(v_phone, 3); end if;
  if char_length(v_name) not between 2 and 120 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'invalid_phone' using errcode = '22023'; end if;
  if v_comment is not null and char_length(v_comment) > 500 then raise exception 'invalid_comment' using errcode = '22023'; end if;
  if v_cny <= 0 or v_cny > 10000000 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  -- реквизиты необязательны (QR клиент может прислать следом), но если указаны — должны быть правильными
  if v_method is not null and v_method not in ('alipay', 'wechat', 'bank') then
    raise exception 'invalid_recv_method' using errcode = '22023';
  end if;
  if v_account is not null and (v_method is null or char_length(v_account) not between 3 and 120) then
    raise exception 'invalid_recv_account' using errcode = '22023';
  end if;
  if v_rname is not null and char_length(v_rname) > 120 then
    raise exception 'invalid_recv_name' using errcode = '22023';
  end if;
  v_rate := public.fx_rate_for(ws.fx_tiers, v_cny);
  if v_rate is null then raise exception 'below_min' using errcode = '22023'; end if;

  if (select count(*) from public.exchange_requests
       where workspace_id = v_ws and client_phone = v_phone and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.exchange_requests
          where workspace_id = v_ws and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.exchange_requests
          where workspace_id = v_ws and created_at > now() - interval '1 day') >= 100
  then
    raise exception 'too_many_requests' using errcode = 'P0001';
  end if;

  v_som := round(v_cny * v_rate, 2);
  insert into public.exchange_requests (workspace_id, client_name, client_phone, cny, som, rate, comment, source,
                                        recv_method, recv_account, recv_name, recv_at)
  values (v_ws, v_name, v_phone, v_cny, v_som, v_rate, v_comment, p_kind,
          v_method, v_account, case when v_method is not null then v_rname end,
          case when v_method is not null then now() end)
  returning id into v_id;

  return json_build_object('ok', true, 'id', v_id, 'cny', v_cny, 'som', v_som, 'rate', v_rate, 'note', ws.fx_note);
end;
$$;
revoke all on function public.submit_exchange(text, text, text, text, numeric, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_exchange(text, text, text, text, numeric, text, text, text, text, text) to anon, authenticated;


-- 6. Для клиента: статус заявки — теперь с реквизитами (функция взята из файла 76, добавлены поля recv_*)
drop function if exists public.get_exchange_status(uuid);
create or replace function public.get_exchange_status(p_id uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  perform public.fx_autoclose(p_id, null);
  return (
    select json_build_object(
      'status',     r.status,
      'cny',        r.cny,
      'som',        r.som,
      'rate',       r.rate,
      'created_at', r.created_at,
      'paid_at',    r.paid_at,
      'status_at',  r.status_at,
      'eta_until',  r.eta_until,
      'buyer_note', r.buyer_note,
      'has_proof',  r.proof_path is not null,
      'note',       case when r.status = 'new' then w.fx_note end,
      'eta',        w.fx_eta,
      'can_upload', r.status = 'new' and r.proof_path is null and r.created_at > now() - interval '1 day',
      'brand',      json_build_object('name', w.name, 'logo', w.logo_path),
      'sent_at',    r.sent_at,
      'sent_proof', r.sent_proof,
      'close_at',   case when r.status = 'sent' then r.sent_at + interval '24 hours' end,
      'received_at', r.received_at,
      'rating',     r.rating,
      'dispute',    r.dispute,
      'dispute_by', r.dispute_by,
      'dispute_result', r.dispute_result,
      'dispute_note', r.dispute_note,
      'can_dispute', public.fx_can_dispute(r.id, 'client'),
      -- когда клиент сможет открыть спор (если пока нельзя)
      'dispute_from', case
        when r.dispute is not null then null
        when r.status = 'paid' then r.paid_at + interval '2 hours'
        when r.status = 'confirmed' then coalesce(r.eta_until, r.status_at + interval '2 hours') end,
      -- куда получить юани: клиенту — сами реквизиты и отметка о QR (путь к закрытому файлу — нет)
      'recv_method',  r.recv_method,
      'recv_account', r.recv_account,
      'recv_name',    r.recv_name,
      'has_recv_qr',  r.recv_qr is not null,
      'recv_edit',    public.fx_recv_editable(r.status, r.dispute, r.created_at),
      -- чат
      'chat_open',  public.fx_chat_open(r.status, r.dispute, r.created_at, r.status_at),
      'buyer_seen', r.chat_buyer_seen,
      'events', coalesce((select json_agg(json_build_object('id', e.id, 'kind', e.kind, 'author', e.author, 'body', e.body,
                    -- клиенту — только открытые файлы обменника; про свои фото — только отметка, что фото было
                    'file', case when e.file_pub then e.file_path end,
                    'photo', e.file_path is not null,
                    'at', e.created_at) order by e.id)
                    from public.exchange_events e where e.request_id = r.id and e.kind in ('dispute', 'msg', 'resolved')), '[]'::json)
    )
    from public.exchange_requests r
    join public.workspaces w on w.id = r.workspace_id
    where r.id = p_id
      and r.created_at > now() - interval '60 days');
end;
$$;
revoke all on function public.get_exchange_status(uuid) from public, anon, authenticated;
grant execute on function public.get_exchange_status(uuid) to anon, authenticated;


-- 7. Споры для администратора — с реквизитами клиента (функция взята из файла 31, добавлены поля recv_*)
create or replace function public.admin_fx_disputes()
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
      'id', r.id, 'ws_name', w.name, 'ws_id', r.workspace_id,
      'buyer_name', coalesce(k.full_name, p.full_name), 'buyer_phone', p.phone, 'buyer_kyc', k.status,
      'client_name', r.client_name, 'client_phone', r.client_phone, 'client_flag', r.client_flag,
      'cny', r.cny, 'som', r.som, 'rate', r.rate, 'status', r.status,
      'created_at', r.created_at, 'paid_at', r.paid_at, 'sent_at', r.sent_at, 'eta_until', r.eta_until,
      'proof_path', r.proof_path, 'sent_proof', r.sent_proof, 'buyer_note', r.buyer_note,
      'recv_method', r.recv_method, 'recv_account', r.recv_account, 'recv_name', r.recv_name,
      'recv_qr', r.recv_qr, 'recv_at', r.recv_at,
      'dispute', r.dispute, 'dispute_by', r.dispute_by, 'dispute_at', r.dispute_at,
      'dispute_result', r.dispute_result, 'dispute_note', r.dispute_note, 'resolved_at', r.resolved_at,
      -- сколько споров решено против байера (по истории — повторный спор их не стирает)
      'strikes', (select count(*) from public.exchange_events e join public.exchange_requests x on x.id = e.request_id
                   where x.workspace_id = r.workspace_id and e.kind = 'resolved' and e.body like '✔ Прав клиент%'),
      'blacklisted', exists (select 1 from public.fx_blacklist b where b.phone = r.client_phone),
      'events', coalesce((select json_agg(json_build_object('kind', e.kind, 'author', e.author, 'body', e.body,
                   'file', e.file_path, 'pub', e.file_pub, 'at', e.created_at) order by e.id)
                   from public.exchange_events e where e.request_id = r.id), '[]'::json))
      order by (r.dispute = 'open') desc, r.dispute_at desc)
    from public.exchange_requests r
    join public.workspaces w on w.id = r.workspace_id
    left join public.profiles p on p.user_id = w.owner_id
    left join public.fx_kyc k on k.user_id = w.owner_id
    where r.dispute is not null and (r.dispute = 'open' or r.dispute_at > now() - interval '90 days')), '[]'::json);
end;
$$;
revoke all on function public.admin_fx_disputes() from public, anon, authenticated;
grant execute on function public.admin_fx_disputes() to authenticated;


insert into public.schema_migrations (version, name) values (78, 'migration_78_exchange_recv.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
