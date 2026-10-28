-- =====================================================
-- ULA FACTORY — миграция 31: обмен как P2P — подтверждают обе стороны, споры решает платформа
--
-- Как идёт сделка:
--   new → (клиент загрузил скриншот) paid → (байер: «Оплата получена», время) confirmed
--       → (байер: «Юани отправлены» + ОБЯЗАТЕЛЬНО скриншот перевода) sent
--       → (клиент: «Юани получил ✅» и оценка 1–5) done.
--   Если клиент молчит 24 часа после «Юани отправлены» и спора нет — сделка закрывается сама.
--   Байер больше не ставит «выполнено» сам и не может отменить заявку, которую клиент уже оплатил.
--
-- Спор (апелляция):
--   • клиент — если байер не подтвердил оплату за 2 часа, вышло обещанное время, юани не пришли
--     (в течение 24 часов после «отправлены») или байер отменил оплаченную заявку (7 дней);
--   • байер — если деньги не пришли или скриншот поддельный (пока заявка оплачена/подтверждена).
--   Пока спор открыт, байер не меняет статус. Стороны пишут сообщения и прикладывают фото.
--   Администратор решает: прав клиент или прав байер, пишет решение. Если виноват клиент —
--   его номер можно занести в чёрный список: все байеры увидят предупреждение на его новых заявках.
--   Споры, решённые не в пользу байера, считаются (видно администратору, позже — в рейтинге).
--
--   • exchange_events        — история сделки и переписка спора.
--   • fx_blacklist           — чёрный список телефонов клиентов (видит только база и админ).
--   • хранилище «fx-sent»    — скриншоты байера (перевод юаней, фото в споре): открыты по ссылке
--                              со случайным именем, списка файлов нет.
--   • fx_mark_sent, fx_client_received, fx_dispute_open, fx_dispute_post, fx_autoclose_ws,
--     admin_fx_disputes, admin_fx_resolve; get_exchange_status — дополнен.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_30_exchange_kyc.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 31) then
      raise exception 'СТОП: файл 31 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Новые поля заявки
alter table public.exchange_requests drop constraint if exists exchange_requests_status_check;
alter table public.exchange_requests add constraint exchange_requests_status_check
  check (status in ('new', 'paid', 'confirmed', 'sent', 'done', 'cancelled'));
alter table public.exchange_requests add column if not exists sent_at        timestamptz;
alter table public.exchange_requests add column if not exists sent_proof     text;
alter table public.exchange_requests add column if not exists received_at    timestamptz;
alter table public.exchange_requests add column if not exists rating         smallint;
alter table public.exchange_requests add column if not exists dispute        text;
alter table public.exchange_requests add column if not exists dispute_by     text;
alter table public.exchange_requests add column if not exists dispute_at     timestamptz;
alter table public.exchange_requests add column if not exists dispute_result text;
alter table public.exchange_requests add column if not exists dispute_note   text;
alter table public.exchange_requests add column if not exists resolved_at    timestamptz;
alter table public.exchange_requests add column if not exists client_flag    boolean not null default false;
alter table public.exchange_requests drop constraint if exists exchange_requests_p2p_check;
alter table public.exchange_requests add constraint exchange_requests_p2p_check check (
  (rating is null or rating between 1 and 5)
  and (sent_proof is null or char_length(sent_proof) <= 200)
  and (dispute is null or dispute in ('open', 'resolved'))
  and (dispute_by is null or dispute_by in ('client', 'buyer'))
  and (dispute_result is null or dispute_result in ('client', 'buyer'))
  and (dispute_note is null or char_length(dispute_note) <= 500));

-- оплаченную заявку или заявку со спором удалить нельзя (чтобы не прятать сделку)
drop policy if exists "exchange: delete" on public.exchange_requests;
create policy "exchange: delete" on public.exchange_requests for delete to authenticated
  using (public.is_owner(workspace_id) and paid_at is null and dispute is null and status in ('new', 'cancelled'));

-- Байер напрямую может только: подтвердить оплату (время ожидания), изменить время, отменить НЕоплаченную.
-- «Отправлены» — только со скриншотом (fx_mark_sent), «выполнено» — только клиент или 24 часа.
create or replace function public._fx_req_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if old.dispute = 'open' then raise exception 'dispute_open' using errcode = 'P0001'; end if;
    if new.status is distinct from old.status and not (
         (old.status in ('new', 'paid') and new.status = 'confirmed')
      or (old.status = 'new' and new.status = 'cancelled')) then
      raise exception 'bad_status' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists fx_req_guard on public.exchange_requests;
create trigger fx_req_guard before update on public.exchange_requests
  for each row execute function public._fx_req_guard();


-- 2. История сделки и переписка спора
create table if not exists public.exchange_events (
  id          bigserial primary key,
  request_id  uuid not null references public.exchange_requests(id) on delete cascade,
  kind        text not null check (kind in ('sent', 'received', 'auto_done', 'dispute', 'msg', 'resolved')),
  author      text not null check (author in ('client', 'buyer', 'admin', 'system')),
  body        text check (body is null or char_length(body) <= 1000),
  file_path   text check (file_path is null or char_length(file_path) <= 200),
  file_pub    boolean not null default false,   -- true: файл в открытом «fx-sent», false: в закрытом «fx-proofs»
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists exchange_events_req_idx on public.exchange_events(request_id, id);
alter table public.exchange_events enable row level security;
drop policy if exists "exchange_events: read" on public.exchange_events;
create policy "exchange_events: read" on public.exchange_events for select to authenticated
  using (exists (select 1 from public.exchange_requests r where r.id = request_id
                  and (public.is_member(r.workspace_id) or public.is_admin())));
revoke all on public.exchange_events from anon, authenticated;
grant select on public.exchange_events to authenticated;
revoke all on sequence public.exchange_events_id_seq from anon, authenticated;


-- 3. Чёрный список телефонов клиентов
create table if not exists public.fx_blacklist (
  phone      text primary key,
  reason     text check (reason is null or char_length(reason) <= 500),
  request_id uuid,
  created_at timestamptz not null default now()
);
alter table public.fx_blacklist enable row level security;
drop policy if exists "fx_blacklist: admin" on public.fx_blacklist;
create policy "fx_blacklist: admin" on public.fx_blacklist for select to authenticated using (public.is_admin());
revoke all on public.fx_blacklist from anon, authenticated;
grant select on public.fx_blacklist to authenticated;

-- новая заявка с номера из чёрного списка помечается — байер видит предупреждение
create or replace function public._fx_req_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.client_flag := exists (select 1 from public.fx_blacklist b where b.phone = new.client_phone);
  return new;
end;
$$;
revoke all on function public._fx_req_flag() from public, anon, authenticated;
drop trigger if exists fx_req_flag on public.exchange_requests;
create trigger fx_req_flag before insert on public.exchange_requests
  for each row execute function public._fx_req_flag();


-- 4. Скриншоты байера: открытое хранилище «fx-sent» (случайное имя файла, списка нет)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fx-sent', 'fx-sent', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

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
                    and (r.status in ('new', 'paid', 'confirmed') or r.dispute = 'open'))
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-sent' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)) < 10;
$$;
revoke all on function public.fx_sent_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_sent_upload_ok(text) to authenticated;

-- фото клиента в споре — в закрытое «fx-proofs» (имя «d-…»), пока спор открыт
create or replace function public.fx_dispute_upload_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_name ~ '^[0-9a-f-]{36}/d-[A-Za-z0-9_-]{8,64}\.(jpg|jpeg|png|webp)$'
     and exists (select 1 from public.exchange_requests r
                  where r.id::text = split_part(p_name, '/', 1) and r.dispute = 'open')
     and (select count(*) from storage.objects o
           where o.bucket_id = 'fx-proofs' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1)
             and split_part(o.name, '/', 2) like 'd-%') < 10;
$$;
revoke all on function public.fx_dispute_upload_ok(text) from public, anon, authenticated;
grant execute on function public.fx_dispute_upload_ok(text) to anon, authenticated;

drop policy if exists "fx-sent: insert"     on storage.objects;
drop policy if exists "fx-proofs: dispute"  on storage.objects;
create policy "fx-sent: insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'fx-sent' and public.fx_sent_upload_ok(name));
create policy "fx-proofs: dispute" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fx-proofs' and public.fx_dispute_upload_ok(name));


-- 5. Кто вызывает: байер этой заявки, администратор или клиент (по секретному номеру заявки)
create or replace function public.fx_who(p_ws uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is not null and public.is_member(p_ws) then 'buyer'
              when auth.uid() is not null and public.is_admin() then 'admin'
              else 'client' end;
$$;
revoke all on function public.fx_who(uuid) from public, anon, authenticated;

-- можно ли открыть спор
create or replace function public.fx_can_dispute(p_id uuid, p_who text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- после спора, решённого в пользу клиента, клиент может снова спорить, если юани опять не пришли
  select exists (select 1 from public.exchange_requests r where r.id = p_id and (
    (r.dispute is null and p_who = 'buyer' and r.status in ('paid', 'confirmed'))
    or (r.dispute is null and p_who = 'client' and (
         (r.status = 'paid' and r.paid_at < now() - interval '2 hours')
      or (r.status = 'confirmed' and coalesce(r.eta_until, r.status_at + interval '2 hours') < now())
      or (r.status = 'cancelled' and r.paid_at is not null and r.status_at > now() - interval '7 days')))
    or (p_who = 'client' and r.status = 'sent' and r.sent_at > now() - interval '24 hours'
        and (r.dispute is null or (r.dispute = 'resolved' and r.dispute_result = 'client')))));
$$;
revoke all on function public.fx_can_dispute(uuid, text) from public, anon, authenticated;

-- закрыть «отправлены» без ответа клиента 24 часа (без спора)
create or replace function public.fx_autoclose(p_id uuid, p_ws uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare n int;
begin
  with x as (
    update public.exchange_requests set status = 'done', received_at = now()
     where status = 'sent' and dispute is distinct from 'open' and sent_at < now() - interval '24 hours'
       and (p_id is null or id = p_id) and (p_ws is null or workspace_id = p_ws)
    returning id)
  insert into public.exchange_events (request_id, kind, author, notified_at)
  select id, 'auto_done', 'system', now() from x;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.fx_autoclose(uuid, uuid) from public, anon, authenticated;

create or replace function public.fx_autoclose_ws(p_ws uuid)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return public.fx_autoclose(null, p_ws);
end;
$$;
revoke all on function public.fx_autoclose_ws(uuid) from public, anon, authenticated;
grant execute on function public.fx_autoclose_ws(uuid) to authenticated;


-- 6. Байер: «Юани отправлены» — только со скриншотом перевода
create or replace function public.fx_mark_sent(p_id uuid, p_path text, p_note text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare r record;
begin
  select * into r from public.exchange_requests where id = p_id for update;
  if r.id is null or not public.is_member(r.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if r.dispute = 'open' then raise exception 'dispute_open' using errcode = 'P0001'; end if;
  if r.status not in ('new', 'paid', 'confirmed') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_id::text
     or not exists (select 1 from storage.objects where bucket_id = 'fx-sent' and name = p_path) then
    raise exception 'file_not_found' using errcode = 'P0002';
  end if;
  update public.exchange_requests
     set status = 'sent', sent_at = now(), sent_proof = p_path,
         buyer_note = coalesce(nullif(left(btrim(coalesce(p_note, '')), 300), ''), buyer_note)
   where id = p_id;
  insert into public.exchange_events (request_id, kind, author, file_path, file_pub, notified_at)
  values (p_id, 'sent', 'buyer', p_path, true, now());
  return true;
end;
$$;
revoke all on function public.fx_mark_sent(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fx_mark_sent(uuid, text, text) to authenticated;


-- 7. Клиент: «Юани получил ✅» и оценка
create or replace function public.fx_client_received(p_id uuid, p_rating int default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare r record;
begin
  select * into r from public.exchange_requests where id = p_id for update;
  if r.id is null or r.status <> 'sent' then raise exception 'bad_status' using errcode = 'P0001'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then raise exception 'bad_rating' using errcode = '22023'; end if;
  update public.exchange_requests
     set status = 'done', received_at = now(), rating = p_rating,
         -- клиент сам подтвердил получение — его спор закрыт в пользу байера
         dispute = case when dispute = 'open' then 'resolved' else dispute end,
         dispute_result = case when dispute = 'open' then 'buyer' else dispute_result end,
         dispute_note = case when dispute = 'open' then 'Клиент подтвердил получение юаней' else dispute_note end,
         resolved_at = case when dispute = 'open' then now() else resolved_at end
   where id = p_id;
  insert into public.exchange_events (request_id, kind, author, body)
  values (p_id, 'received', 'client', case when p_rating is not null then '★ ' || p_rating end);
  return true;
end;
$$;
revoke all on function public.fx_client_received(uuid, int) from public, anon, authenticated;
grant execute on function public.fx_client_received(uuid, int) to anon, authenticated;


-- 8. Спор: открыть и писать сообщения
create or replace function public.fx_dispute_open(p_id uuid, p_reason text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r     record;
  v_who text;
  v_txt text := btrim(coalesce(p_reason, ''));
begin
  select * into r from public.exchange_requests where id = p_id for update;
  if r.id is null then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  v_who := public.fx_who(r.workspace_id);
  if v_who = 'admin' then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_txt) not between 5 and 1000 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if not public.fx_can_dispute(p_id, v_who) then raise exception 'cannot_dispute' using errcode = 'P0001'; end if;
  update public.exchange_requests
     set dispute = 'open', dispute_by = v_who, dispute_at = now(), dispute_result = null, dispute_note = null, resolved_at = null
   where id = p_id;
  insert into public.exchange_events (request_id, kind, author, body) values (p_id, 'dispute', v_who, v_txt);
  return v_who;
end;
$$;
revoke all on function public.fx_dispute_open(uuid, text) from public, anon, authenticated;
grant execute on function public.fx_dispute_open(uuid, text) to anon, authenticated;

create or replace function public.fx_dispute_post(p_id uuid, p_body text, p_file text default null)
returns boolean
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
begin
  select * into r from public.exchange_requests where id = p_id for update;
  if r.id is null then raise exception 'request_not_found' using errcode = 'P0002'; end if;
  if r.dispute is distinct from 'open' then raise exception 'no_dispute' using errcode = 'P0001'; end if;
  v_who := public.fx_who(r.workspace_id);
  if v_txt is null and p_file is null then raise exception 'empty' using errcode = '22023'; end if;
  if v_txt is not null and char_length(v_txt) > 1000 then raise exception 'too_long' using errcode = '22023'; end if;
  if (select count(*) from public.exchange_events e where e.request_id = p_id and e.author = v_who and e.kind = 'msg') >= 40 then
    raise exception 'too_many_messages' using errcode = 'P0001';
  end if;
  if p_file is not null then
    if split_part(p_file, '/', 1) <> p_id::text then raise exception 'file_not_found' using errcode = 'P0002'; end if;
    if v_who = 'client' then
      if split_part(p_file, '/', 2) not like 'd-%'
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
  values (p_id, 'msg', v_who, v_txt, p_file, v_pub);
  return true;
end;
$$;
revoke all on function public.fx_dispute_post(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fx_dispute_post(uuid, text, text) to anon, authenticated;


-- 9. Администратор: список споров и решение
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

-- p_result: 'client' — прав клиент (байер виноват): заявка возвращается в «оплата подтверждена» — байер должен отправить;
--           'buyer'  — прав байер: если юани отправлены — сделка закрыта, иначе заявка отменена;
-- p_blacklist — занести телефон клиента в чёрный список (только если прав байер)
create or replace function public.admin_fx_resolve(p_id uuid, p_result text, p_note text, p_blacklist boolean default false)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r      record;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_result not in ('client', 'buyer') then raise exception 'bad_result' using errcode = '22023'; end if;
  if v_note is null then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into r from public.exchange_requests where id = p_id for update;
  if r.id is null or r.dispute is distinct from 'open' then raise exception 'no_dispute' using errcode = 'P0001'; end if;
  update public.exchange_requests
     set dispute = 'resolved', dispute_result = p_result, dispute_note = v_note, resolved_at = now(),
         status = case
           when p_result = 'client' then 'confirmed'
           when r.status = 'sent' then 'done'
           else 'cancelled' end,
         eta_until = case when p_result = 'client' then null else eta_until end,
         received_at = case when p_result = 'buyer' and r.status = 'sent' then now() else received_at end
   where id = p_id;
  insert into public.exchange_events (request_id, kind, author, body)
  values (p_id, 'resolved', 'admin', case p_result when 'client' then '✔ Прав клиент. ' else '✔ Прав продавец. ' end || v_note);
  if p_result = 'buyer' and coalesce(p_blacklist, false) then
    insert into public.fx_blacklist (phone, reason, request_id) values (r.client_phone, v_note, p_id)
    on conflict (phone) do update set reason = excluded.reason, request_id = excluded.request_id, created_at = now();
  end if;
  return p_result;
end;
$$;
revoke all on function public.admin_fx_resolve(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_fx_resolve(uuid, text, text, boolean) to authenticated;


-- 10. Для клиента: статус своей заявки — теперь с отправкой, подтверждением и спором
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
      'events', coalesce((select json_agg(json_build_object('kind', e.kind, 'author', e.author, 'body', e.body,
                    -- клиенту — только открытые файлы байера
                    'file', case when e.file_pub then e.file_path end, 'at', e.created_at) order by e.id)
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

-- ✅ ОТМЕТКА: файл 31 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (31, 'migration_31_exchange_disputes.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
