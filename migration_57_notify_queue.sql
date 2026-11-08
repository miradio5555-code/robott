-- =====================================================
-- ULA FACTORY — миграция 57: очередь уведомлений клиентам о статусах заказов (Telegram)
--
-- ПРОБЛЕМА. Раньше сообщение клиенту отправлял БРАУЗЕР байера: после смены статуса сайт звал функцию
-- telegram-notify. Закрыл вкладку, пропал интернет, сбой функции — клиент не получил сообщение, и никто не знает.
--
-- КАК ТЕПЕРЬ.
--   • Смена статуса заказа и постановка уведомления в очередь — ОДНА транзакция (триггер orders_notify_enqueue).
--     Откатилась смена статуса — события нет. Браузер после сохранения не нужен.
--   • Событие создаётся только при РЕАЛЬНОЙ смене статуса (тот же статус повторно ничего не создаёт); каждый
--     настоящий переход (например «в пути» → «прибыл» → «в пути») — отдельное событие. Файл НЕ создаёт событий
--     для старой истории: очередь после установки пуста.
--   • Одна строка очереди = одно сообщение одному подписчику (чату Telegram) заказа. Получатели берутся из
--     order_tg_subs в момент смены статуса и проверяются ещё раз перед отправкой: ссылку заказа отключили или
--     заменили, клиент отключил уведомления или подписался заново — сообщение не уйдёт.
--   • Обработчик — Edge Function order-notify-worker (запускается по расписанию, сайт не нужен): забирает задачи
--     пачкой (FOR UPDATE SKIP LOCKED — два обработчика одну задачу не возьмут), отправляет, записывает результат.
--     Временная ошибка → повтор с задержкой (1, 2, 4… минут, не дольше часа), попыток не больше 6, потом «ошибка».
--     Постоянная ошибка → сразу «ошибка» без повторов. Всё с безопасным описанием причины и журналом действий.
--   • Если сервис принял сообщение, а ответ потерялся (таймаут), исход неизвестен: повтор делается ОДИН раз и не
--     раньше чем через 10 минут, после этого «ошибка: исход неизвестен». Абсолютной гарантии «без дублей» у
--     Telegram нет; это снижает риск, но не убирает его (см. DATABASE.md).
--   • Сообщения по порядку: следующее событие того же заказа и чата не уходит, пока предыдущее не завершено.
--   • Владелец кабинета видит состояние в Настройки → «Уведомления клиентам» и может повторить отправку после
--     ошибки (та же очередь, строка возвращается в «ожидает», действие записывается в журнал).
--
-- СОВМЕСТИМОСТЬ. Старая функция telegram-notify (action = order_status), которую зовут старые вкладки сайта,
-- после этого файла НИЧЕГО не отправляет, если очередь есть (новая версия функции): дублей нет.
-- Порядок выпуска — в DATABASE.md: 1) новая версия telegram-notify и order-notify-worker, 2) этот файл,
-- 3) расписание (supabase/notify_schedule.sql), 4) новый сайт.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: файл 56 запущен (иначе файл 56 потом откажется запускаться: он старше этого файла).
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run (одним запросом; при ошибке
-- откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 56) then
    raise exception 'СТОП: сначала запустите миграцию 56 (клиент по постоянному номеру). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 57) then
    raise exception 'СТОП: файл 57 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
  if to_regclass('public.order_tg_subs') is null then
    raise exception 'СТОП: нет таблицы order_tg_subs (файл 25). Ничего не изменено.';
  end if;
end $$;


-- 1. Очередь: одна строка = одно сообщение одному подписчику
create table if not exists public.order_notify_queue (
  id              uuid primary key default gen_random_uuid(),
  seq             bigint generated always as identity,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  order_id        uuid not null references public.orders(id) on delete cascade,
  chat_id         text not null check (char_length(chat_id) <= 40),
  lang            text not null default 'ru' check (lang in ('ru', 'en', 'zh')),
  event_id        uuid not null,                       -- одно изменение статуса (общее для всех его получателей)
  from_status     text,
  to_status       text not null,
  status          text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts        int  not null default 0,
  max_attempts    int  not null default 6,
  ambiguous       int  not null default 0,             -- сколько раз исход отправки был неизвестен
  next_attempt_at timestamptz not null default now(),
  locked_by       text,
  locked_until    timestamptz,
  send_started_at timestamptz,                         -- обработчик начал отправку (после этого исход при сбое неизвестен)
  last_error      text check (last_error is null or char_length(last_error) <= 200),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (event_id, chat_id)
);
create index if not exists order_notify_queue_due_idx on public.order_notify_queue (next_attempt_at) where status in ('pending', 'processing');
create index if not exists order_notify_queue_ws_idx on public.order_notify_queue (workspace_id, created_at desc);
create index if not exists order_notify_queue_chain_idx on public.order_notify_queue (order_id, chat_id, seq);

-- Журнал действий по каждой строке (создано, взято, повтор, отправлено, ошибка, повторено вручную…)
create table if not exists public.order_notify_log (
  id       bigserial primary key,
  queue_id uuid not null references public.order_notify_queue(id) on delete cascade,
  at       timestamptz not null default now(),
  action   text not null,
  detail   text check (detail is null or char_length(detail) <= 200),
  actor    uuid
);
create index if not exists order_notify_log_queue_idx on public.order_notify_log (queue_id, id);

alter table public.order_notify_queue enable row level security;
alter table public.order_notify_log   enable row level security;
revoke all on public.order_notify_queue, public.order_notify_log from anon, authenticated;
revoke all on sequence public.order_notify_log_id_seq from anon, authenticated;


-- 2. Постановка в очередь — в той же транзакции, что и смена статуса
create or replace function public._orders_notify_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ev uuid := gen_random_uuid();
begin
  -- у статуса «new» текста нет (клиент о нём уже знает); для остальных есть готовое сообщение
  if new.status not in ('awaiting_payment', 'purchasing', 'china_warehouse', 'in_transit', 'arrived', 'delivered', 'cancelled') then
    return new;
  end if;
  with ins as (
    insert into public.order_notify_queue (workspace_id, order_id, chat_id, lang, event_id, from_status, to_status)
    select new.workspace_id, new.id, s.chat_id, s.lang, v_ev, old.status, new.status
      from public.order_tg_subs s
     where s.order_id = new.id
    returning id
  )
  insert into public.order_notify_log (queue_id, action, detail, actor)
  select id, 'created', left(coalesce(old.status, '') || ' → ' || new.status, 200), auth.uid() from ins;
  return new;
end;
$$;
revoke all on function public._orders_notify_enqueue() from public, anon, authenticated;
drop trigger if exists orders_notify_enqueue on public.orders;
create trigger orders_notify_enqueue after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function public._orders_notify_enqueue();


-- 3. Проверка получателя (внутренняя): подписка есть, не менялась после события, ссылка заказа действует.
--    Возвращает причину отказа или null.
create or replace function public._notify_check(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.order_notify_queue;
  v_sub timestamptz;
  v_tok text;
begin
  select * into q from public.order_notify_queue where id = p_id;
  if q.id is null then return 'not_found'; end if;
  select s.created_at into v_sub from public.order_tg_subs s where s.order_id = q.order_id and s.chat_id = q.chat_id;
  if v_sub is null then return 'subscription_removed'; end if;
  if v_sub > q.created_at then return 'subscription_changed'; end if;
  select o.public_token into v_tok from public.orders o where o.id = q.order_id;
  if v_tok is null then return 'link_revoked'; end if;
  return null;
end;
$$;
revoke all on function public._notify_check(uuid) from public, anon, authenticated;

create or replace function public._notify_log(p_id uuid, p_action text, p_detail text default null, p_actor uuid default null)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.order_notify_log (queue_id, action, detail, actor) values (p_id, p_action, left(p_detail, 200), p_actor);
$$;
revoke all on function public._notify_log(uuid, text, text, uuid) from public, anon, authenticated;

-- «исход неизвестен»: один отложенный повтор, потом ошибка (внутренняя)
create or replace function public._notify_unknown(p_id uuid, p_why text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.order_notify_queue;
begin
  select * into q from public.order_notify_queue where id = p_id for update;
  if q.ambiguous >= 1 or q.attempts >= q.max_attempts then
    update public.order_notify_queue set status = 'failed', last_error = 'delivery_unknown', locked_by = null, locked_until = null,
           send_started_at = null, ambiguous = ambiguous + 1, updated_at = now() where id = p_id;
    perform public._notify_log(p_id, 'failed', 'delivery_unknown: ' || p_why);
  else
    update public.order_notify_queue set status = 'pending', last_error = 'delivery_unknown_retry', locked_by = null, locked_until = null,
           send_started_at = null, ambiguous = ambiguous + 1, next_attempt_at = now() + interval '10 minutes', updated_at = now() where id = p_id;
    perform public._notify_log(p_id, 'retry', 'исход неизвестен (' || p_why || '): повтор через 10 минут, возможен дубль');
  end if;
end;
$$;
revoke all on function public._notify_unknown(uuid, text) from public, anon, authenticated;


-- 4. Для обработчика (только service_role): взять пачку задач
create or replace function public.notify_claim(p_worker text, p_limit int default 20, p_lease int default 120)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r       record;
  v_why   text;
  v_out   jsonb := '[]'::jsonb;
  v_n     int := 0;
begin
  if coalesce(btrim(p_worker), '') = '' or char_length(p_worker) > 80 then raise exception 'bad_worker' using errcode = '22023'; end if;
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  p_lease := least(greatest(coalesce(p_lease, 120), 30), 900);

  -- задачи, у которых обработчик пропал (аренда истекла)
  for r in select id, send_started_at, attempts, max_attempts from public.order_notify_queue
            where status = 'processing' and locked_until < now() order by seq for update skip locked loop
    if r.send_started_at is not null then
      perform public._notify_unknown(r.id, 'обработчик пропал во время отправки');
    elsif r.attempts >= r.max_attempts then
      update public.order_notify_queue set status = 'failed', last_error = 'max_attempts', locked_by = null, locked_until = null, updated_at = now() where id = r.id;
      perform public._notify_log(r.id, 'failed', 'max_attempts');
    else
      update public.order_notify_queue set status = 'pending', locked_by = null, locked_until = null, updated_at = now() where id = r.id;
      perform public._notify_log(r.id, 'retry', 'обработчик пропал до отправки: задача возвращена');
    end if;
  end loop;

  for r in
    select q.id from public.order_notify_queue q
     where q.status = 'pending' and q.next_attempt_at <= now()
       and not exists (select 1 from public.order_notify_queue e   -- предыдущее событие этого заказа и чата ещё не завершено
                        where e.order_id = q.order_id and e.chat_id = q.chat_id and e.seq < q.seq and e.status in ('pending', 'processing'))
     order by q.seq
     limit p_limit
     for update of q skip locked
  loop
    v_why := public._notify_check(r.id);
    if v_why is not null then
      update public.order_notify_queue set status = 'skipped', last_error = v_why, updated_at = now() where id = r.id;
      perform public._notify_log(r.id, 'skipped', v_why);
      continue;
    end if;
    update public.order_notify_queue set status = 'processing', attempts = attempts + 1, locked_by = p_worker,
           locked_until = now() + make_interval(secs => p_lease), send_started_at = null, updated_at = now() where id = r.id;
    perform public._notify_log(r.id, 'claimed', p_worker);
    v_n := v_n + 1;
    -- в сообщение попадают только поля, которые клиент и так видит на своей странице заказа
    select v_out || jsonb_build_array(jsonb_build_object(
             'id', q.id, 'attempt', q.attempts, 'max_attempts', q.max_attempts, 'chat_id', q.chat_id, 'lang', q.lang,
             'to_status', q.to_status, 'order_number', o.order_number, 'product_ru', o.product_ru, 'product_zh', o.product_zh,
             'tracking_number', o.tracking_number, 'public_token', o.public_token, 'brand', w.name))
      into v_out
      from public.order_notify_queue q
      join public.orders o on o.id = q.order_id
      join public.workspaces w on w.id = q.workspace_id
     where q.id = r.id;
  end loop;
  return v_out;
end;
$$;
revoke all on function public.notify_claim(text, int, int) from public, anon, authenticated;
grant execute on function public.notify_claim(text, int, int) to service_role;

-- Перед самой отправкой: ещё раз проверить получателя и пометить «отправка началась»
create or replace function public.notify_begin_send(p_id uuid, p_worker text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.order_notify_queue;
  v_why text;
begin
  select * into q from public.order_notify_queue where id = p_id for update;
  if q.id is null or q.status <> 'processing' or q.locked_by is distinct from p_worker or q.locked_until < now() then return false; end if;
  v_why := public._notify_check(p_id);
  if v_why is not null then
    update public.order_notify_queue set status = 'skipped', last_error = v_why, locked_by = null, locked_until = null, updated_at = now() where id = p_id;
    perform public._notify_log(p_id, 'skipped', v_why);
    return false;
  end if;
  update public.order_notify_queue set send_started_at = now(), updated_at = now() where id = p_id;
  return true;
end;
$$;
revoke all on function public.notify_begin_send(uuid, text) from public, anon, authenticated;
grant execute on function public.notify_begin_send(uuid, text) to service_role;

-- Результат отправки. outcome: sent | retry (точно не доставлено, можно повторить) | unknown (исход неизвестен) |
-- permanent (повторять бессмысленно) | blocked (клиент заблокировал бота). Возвращает false, если задачу уже забрал другой.
create or replace function public.notify_finish(p_id uuid, p_worker text, p_outcome text, p_error text default null,
                                                p_retry_after int default null, p_message_id text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q     public.order_notify_queue;
  v_err text := nullif(left(regexp_replace(coalesce(p_error, ''), '[^A-Za-z0-9 _.:,()/-]', '', 'g'), 200), '');
  v_wait int;
begin
  if p_outcome not in ('sent', 'retry', 'unknown', 'permanent', 'blocked') then raise exception 'bad_outcome' using errcode = '22023'; end if;
  select * into q from public.order_notify_queue where id = p_id for update;
  if q.id is null or q.status <> 'processing' or q.locked_by is distinct from p_worker then return false; end if;

  if p_outcome = 'sent' then
    update public.order_notify_queue set status = 'sent', sent_at = now(), last_error = null, locked_by = null, locked_until = null, updated_at = now() where id = p_id;
    -- та же отметка, по которой старая функция понимала «этот статус клиент уже получил»
    update public.order_tg_subs set last_status = q.to_status where order_id = q.order_id and chat_id = q.chat_id;
    perform public._notify_log(p_id, 'sent', 'попытка ' || q.attempts || coalesce(', сообщение ' || left(p_message_id, 40), ''));
  elsif p_outcome = 'retry' then
    if q.attempts >= q.max_attempts then
      update public.order_notify_queue set status = 'failed', last_error = coalesce(v_err, 'max_attempts'), locked_by = null, locked_until = null, send_started_at = null, updated_at = now() where id = p_id;
      perform public._notify_log(p_id, 'failed', 'попытки закончились: ' || coalesce(v_err, ''));
    else
      v_wait := greatest(least(60 * (2 ^ (q.attempts - 1))::int, 3600), least(coalesce(p_retry_after, 0), 3600));
      update public.order_notify_queue set status = 'pending', last_error = v_err, locked_by = null, locked_until = null, send_started_at = null,
             next_attempt_at = now() + make_interval(secs => v_wait), updated_at = now() where id = p_id;
      perform public._notify_log(p_id, 'retry', 'попытка ' || q.attempts || ': ' || coalesce(v_err, '') || '; повтор через ' || v_wait || ' с');
    end if;
  elsif p_outcome = 'unknown' then
    perform public._notify_unknown(p_id, coalesce(v_err, 'нет ответа'));
  elsif p_outcome = 'blocked' then
    delete from public.order_tg_subs where order_id = q.order_id and chat_id = q.chat_id;   -- клиент заблокировал бота: подписку не держим
    update public.order_notify_queue set status = 'skipped', last_error = 'client_blocked_bot', locked_by = null, locked_until = null, send_started_at = null, updated_at = now() where id = p_id;
    perform public._notify_log(p_id, 'skipped', 'клиент заблокировал бота, подписка снята');
  else
    update public.order_notify_queue set status = 'failed', last_error = coalesce(v_err, 'permanent'), locked_by = null, locked_until = null, send_started_at = null, updated_at = now() where id = p_id;
    perform public._notify_log(p_id, 'failed', coalesce(v_err, 'permanent'));
  end if;
  return true;
end;
$$;
revoke all on function public.notify_finish(uuid, text, text, text, int, text) from public, anon, authenticated;
grant execute on function public.notify_finish(uuid, text, text, text, int, text) to service_role;


-- 5. Для владельца кабинета: состояние и повторная отправка
create or replace function public.notify_queue_list(p_ws uuid, p_limit int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  return jsonb_build_object(
    'counts', (select jsonb_build_object(
                 'pending',    count(*) filter (where status in ('pending', 'processing')),
                 'failed',     count(*) filter (where status = 'failed'),
                 'sent_7d',    count(*) filter (where status = 'sent' and sent_at > now() - interval '7 days'),
                 'skipped_7d', count(*) filter (where status = 'skipped' and updated_at > now() - interval '7 days'))
                 from public.order_notify_queue where workspace_id = p_ws),
    'items', coalesce((
      select jsonb_agg(x order by (x->>'created_at') desc) from (
        select jsonb_build_object(
                 'id', q.id, 'order_number', o.order_number, 'to_status', q.to_status, 'status', q.status,
                 'attempts', q.attempts, 'max_attempts', q.max_attempts, 'last_error', q.last_error,
                 'created_at', q.created_at, 'sent_at', q.sent_at, 'next_attempt_at', q.next_attempt_at,
                 'history', coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'detail', l.detail) order by l.id desc)
                                        from (select * from public.order_notify_log where queue_id = q.id order by id desc limit 6) l), '[]'::jsonb)) as x
          from public.order_notify_queue q join public.orders o on o.id = q.order_id
         where q.workspace_id = p_ws
         order by q.created_at desc, q.seq desc
         limit p_limit) s), '[]'::jsonb));
end;
$$;
revoke all on function public.notify_queue_list(uuid, int) from public, anon, authenticated;
grant execute on function public.notify_queue_list(uuid, int) to authenticated;

create or replace function public.notify_retry(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.order_notify_queue;
begin
  select * into q from public.order_notify_queue where id = p_id for update;
  if q.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.is_owner(q.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if q.status <> 'failed' then raise exception 'not_failed' using errcode = '22023'; end if;   -- повторять можно только ошибку, и только один раз за раз
  update public.order_notify_queue set status = 'pending', attempts = 0, ambiguous = 0, next_attempt_at = now(), last_error = null,
         locked_by = null, locked_until = null, send_started_at = null, updated_at = now() where id = p_id;
  perform public._notify_log(p_id, 'requeued', 'повтор вручную', auth.uid());
end;
$$;
revoke all on function public.notify_retry(uuid) from public, anon, authenticated;
grant execute on function public.notify_retry(uuid) to authenticated;


-- Признак для сайта: очередь установлена (тогда сайт сам ничего не отправляет; без файла 57 он работает по-старому)
create or replace function public.notify_queue_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select true $$;
revoke all on function public.notify_queue_enabled() from public, anon, authenticated;
grant execute on function public.notify_queue_enabled() to authenticated;


-- ✅ ОТМЕТКА: файл 57 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (57, 'migration_57_notify_queue.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
