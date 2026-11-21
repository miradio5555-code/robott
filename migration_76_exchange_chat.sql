-- =====================================================
-- ULA FACTORY — миграция 76: чат по заявке на обмен (клиент ↔ обменник)
--
-- ЗАЧЕМ. Раньше клиент и обменник могли переписываться только во время спора. Теперь у каждой заявки
-- есть чат: клиент сразу после отправки заявки пишет «что с моей заявкой?», присылает ещё один чек
-- или фото, а обменник отвечает из кабинета. Клиенту не нужно входить — чат открывается по секретной
-- ссылке заявки (?xr=…), как и сама страница статуса.
--
-- КАК УСТРОЕНО.
--   • Сообщения — те же записи exchange_events (kind = 'msg'), что и переписка спора: если откроется спор,
--     администратор видит всю историю. Новой таблицы нет.
--   • fx_chat_post(id, текст, файл) — написать в чат. Клиент — по секретному номеру заявки, обменник —
--     участник кабинета, администратор — только пока открыт спор. Возвращает номер сообщения.
--     Чат открыт: пока заявка в работе или спор открыт, и ещё 3 дня после завершения/отмены (не старше 60 дней).
--     Защита от спама: клиент — не больше 8 сообщений в минуту и 100 на заявку; текст до 1000 символов.
--   • Фото клиента — в закрытое хранилище «fx-proofs» (имя «c-…», до 15 на заявку); их видит только обменник.
--     Фото обменника — в открытое «fx-sent» со случайным именем (как скриншот перевода).
--   • «Прочитано»: chat_buyer_seen / chat_client_seen — номер последнего прочитанного сообщения.
--     fx_chat_seen(id) отмечает прочитанным; fx_chat_unread(кабинет) — сколько непрочитанных у обменника.
--   • get_exchange_status — дополнен: номера сообщений, открыт ли чат, что прочитал обменник.
--   • fx_proof_upload_ok — фото из чата и спора больше не мешают загрузить сам чек (лимит 3 считает только чеки),
--     а имена «c-…» / «d-…» проходят только по правилам чата и спора.
--
-- Заказы, клиенты, платежи, балансы и аккаунты этот файл НЕ меняет. Суммы и статусы заявок не меняются.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: в базе есть schema_migrations, и ни один файл новее 76 ещё не запущен.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null then
    raise exception 'СТОП: в базе нет schema_migrations — сначала запустите предыдущие файлы. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 76) then
    raise exception 'СТОП: файл 76 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
  if to_regclass('public.exchange_events') is null then
    raise exception 'СТОП: сначала запустите миграцию 31 (сделки обмена и споры). Ничего не изменено.';
  end if;
end $$;


-- 1. Что прочитано: номер последнего прочитанного сообщения у обменника и у клиента
alter table public.exchange_requests add column if not exists chat_buyer_seen  bigint not null default 0;
alter table public.exchange_requests add column if not exists chat_client_seen bigint not null default 0;


-- 2. Открыт ли чат заявки
create or replace function public.fx_chat_open(p_status text, p_dispute text, p_created timestamptz, p_status_at timestamptz)
returns boolean
language sql
stable
set search_path = public
as $$
  -- coalesce: пустой спор (null) не должен превращать ответ в null — иначе «закрыт» не сработает
  select coalesce(p_created > now() - interval '60 days'
     and (p_status not in ('done', 'cancelled')
          or coalesce(p_dispute, '') = 'open'
          or coalesce(p_status_at, p_created) > now() - interval '3 days'), false);
$$;
revoke all on function public.fx_chat_open(text, text, timestamptz, timestamptz) from public, anon, authenticated;


-- 3. Фото в чате
-- клиент: закрытое «fx-proofs», имя «<заявка>/c-<случайное>.jpg», пока чат открыт, до 15 фото
create or replace function public.fx_chat_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/c-[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and public.fx_chat_open(r.status, r.dispute, r.created_at, r.status_at))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-proofs' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)
             and split_part(o.name, '/', 2) like 'c-%') < 15;
$$;
revoke all on function public.fx_chat_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_chat_upload_ok(text) to anon, authenticated;

drop policy if exists "fx-proofs: chat" on storage.objects;
create policy "fx-proofs: chat" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fx-proofs' and public.fx_chat_upload_ok(name));

-- чек оплаты: лимит «3 файла» считает только чеки — фото из чата («c-…») и спора («d-…») не мешают
create or replace function public.fx_proof_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$'
     and split_part(p_name, '/', 2) !~ '^[cd]-'   -- «c-…» и «d-…» — фото чата и спора, у них свои правила
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and r.status = 'new' and r.proof_path is null
                    and r.created_at > now() - interval '1 day')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-proofs' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)
             and split_part(o.name, '/', 2) !~ '^[cd]-') < 3;
$$;
revoke all on function public.fx_proof_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_proof_upload_ok(text) to anon, authenticated;

-- обменник: открытое «fx-sent» — ещё и пока открыт чат (раньше — только до «отправлены» и в споре), до 30 фото
create or replace function public.fx_sent_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-]{16,64}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1)
                    and public.is_member(r.workspace_id)
                    and (r.status in ('new', 'paid', 'confirmed') or r.dispute = 'open'
                         or public.fx_chat_open(r.status, r.dispute, r.created_at, r.status_at)))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-sent' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)) < 30;
$$;
revoke all on function public.fx_sent_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_sent_upload_ok(text) to authenticated;


-- 4. Написать в чат. Возвращает номер сообщения.
create or replace function public.fx_chat_post(p_id uuid, p_body text, p_file text default null)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r     record;
  v_who text;
  v_txt text := nullif(btrim(coalesce(p_body, '')), '');
  v_pub boolean := false;
  v_id  bigint;
begin
  select * into r from public.exchange_requests where id = p_id for update;
  if r.id is null then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  v_who := public.fx_who(r.workspace_id);
  -- администратор платформы пишет в чужую сделку только как судья спора
  if v_who = 'admin' and r.dispute is distinct from 'open' then raise exception 'chat_closed' using errcode = 'P0001'; end if;
  if not public.fx_chat_open(r.status, r.dispute, r.created_at, r.status_at) then
    raise exception 'chat_closed' using errcode = 'P0001';
  end if;
  if v_txt is null and p_file is null then raise exception 'empty' using errcode = '22023'; end if;
  if v_txt is not null and char_length(v_txt) > 1000 then raise exception 'too_long' using errcode = '22023'; end if;
  if v_who = 'client' then
    if (select count(*) from public.exchange_events e
         where e.request_id = p_id and e.author = 'client' and e.kind = 'msg' and e.created_at > now() - interval '1 minute') >= 8 then
      raise exception 'too_fast' using errcode = 'P0001';
    end if;
    if (select count(*) from public.exchange_events e where e.request_id = p_id and e.author = 'client' and e.kind = 'msg') >= 100 then
      raise exception 'too_many_messages' using errcode = 'P0001';
    end if;
  elsif (select count(*) from public.exchange_events e where e.request_id = p_id and e.author = v_who and e.kind = 'msg') >= 300 then
    raise exception 'too_many_messages' using errcode = 'P0001';
  end if;
  if p_file is not null then
    if split_part(p_file, '/', 1) <> p_id::text then raise exception 'file_not_found' using errcode = 'P0002'; end if;
    if v_who = 'client' then
      if split_part(p_file, '/', 2) !~ '^[cd]-'
         or not exists (select 1 from storage.objects where bucket_id = 'fx-proofs' and name = p_file) then
        raise exception 'file_not_found' using errcode = 'P0002';
      end if;
    elsif v_who = 'buyer' then
      if not exists (select 1 from storage.objects where bucket_id = 'fx-sent' and name = p_file) then
        raise exception 'file_not_found' using errcode = 'P0002';
      end if;
      v_pub := true;
    else
      raise exception 'file_not_found' using errcode = 'P0002';
    end if;
  end if;
  insert into public.exchange_events (request_id, kind, author, body, file_path, file_pub)
  values (p_id, 'msg', v_who, v_txt, p_file, v_pub)
  returning id into v_id;
  -- своё сообщение прочитано
  if v_who = 'buyer' then
    update public.exchange_requests set chat_buyer_seen = greatest(chat_buyer_seen, v_id) where id = p_id;
  elsif v_who = 'client' then
    update public.exchange_requests set chat_client_seen = greatest(chat_client_seen, v_id) where id = p_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.fx_chat_post(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fx_chat_post(uuid, text, text) to anon, authenticated;


-- 5. Отметить чат прочитанным (обменник — участник кабинета, клиент — по секретному номеру заявки)
create or replace function public.fx_chat_seen(p_id uuid)
returns bigint
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_who text;
  v_max bigint;
begin
  select workspace_id into v_ws from public.exchange_requests where id = p_id;
  if v_ws is null then return null; end if;
  v_who := public.fx_who(v_ws);
  select coalesce(max(id), 0) into v_max from public.exchange_events
   where request_id = p_id and kind in ('msg', 'dispute', 'resolved');
  if v_who = 'buyer' then
    update public.exchange_requests set chat_buyer_seen = v_max where id = p_id and chat_buyer_seen < v_max;
  elsif v_who = 'client' then
    update public.exchange_requests set chat_client_seen = v_max where id = p_id and chat_client_seen < v_max;
  end if;
  return v_max;
end;
$$;
revoke all on function public.fx_chat_seen(uuid) from public, anon, authenticated;
grant execute on function public.fx_chat_seen(uuid) to anon, authenticated;

-- 6. Сколько непрочитанных сообщений клиентов в кабинете (для значка в меню)
create or replace function public.fx_chat_unread(p_ws uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when not public.is_member(p_ws) then 0 else (
    select count(*)::int
      from public.exchange_requests r
      join public.exchange_events e on e.request_id = r.id
     where r.workspace_id = p_ws
       and r.created_at > now() - interval '60 days'
       and e.kind = 'msg' and e.author <> 'buyer'
       and e.id > r.chat_buyer_seen) end;
$$;
revoke all on function public.fx_chat_unread(uuid) from public, anon, authenticated;
grant execute on function public.fx_chat_unread(uuid) to authenticated;


-- 7. Для клиента: статус заявки — теперь с чатом
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


insert into public.schema_migrations (version, name) values (76, 'migration_76_exchange_chat.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
