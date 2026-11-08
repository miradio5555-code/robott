-- =====================================================
-- ULA FACTORY — миграция 58: сроки оплаты и доставки, задачи, напоминания клиентам, серверные задачи по расписанию
--
-- ЧТО ДОБАВЛЯЕТСЯ
--   1. Явные сроки заказа: orders.payment_due_at (срок оплаты) и orders.delivery_eta_from / delivery_eta_to (ожидаемый
--      интервал доставки). Время хранится в UTC (timestamptz), а вводится и показывается в часовом поясе кабинета
--      (workspaces.time_zone, по умолчанию Asia/Bishkek — владелец может изменить). У старых заказов сроков НЕТ, и
--      программа их не придумывает: заказ без срока никогда не считается просроченным (ни по дате создания, ни по
--      дате последнего платежа). Каждое изменение срока пишется в историю (order_deadline_history).
--   2. Задачи (order_tasks): «истёк срок оплаты», «приближается срок доставки», «срок доставки прошёл», «не хватает
--      данных для следующего этапа». У задачи есть причина, заказ и действие. Один случай — одна задача (уникальный
--      ключ заказ + вид + «цикл» срока): повторный и параллельный запуск дублей не создаёт; перенос срока открывает
--      новый цикл, оплата / отмена / смена статуса закрывает задачу сама.
--   3. Напоминания клиенту об оплате — ВЫКЛЮЧЕНЫ по умолчанию. Владелец включает их явно (ws_reminder_settings) и видит
--      правила: часы отправки, пауза после срока, интервал между напоминаниями, максимум на заказ и в сутки.
--      Напоминания идут через ту же очередь (order_notify_queue, kind = 'payment_reminder') и те же подписки Telegram.
--      Перед фактической отправкой условия проверяются заново (автоматизация включена, заказ не приостановлен и не
--      отменён, долг не погашен, срок не перенесён, подписка и ссылка действуют, часы отправки, суточный лимит).
--      Просрочка ДОСТАВКИ клиенту НЕ пишется: она создаёт только внутреннюю задачу, статус товара сама не меняется.
--      Приостановить напоминания по заказу можно кнопкой (orders.reminders_paused_at), например при споре о товаре.
--   4. Обработка сроков без браузера: функция deadlines_scan() (задачи + постановка напоминаний в очередь) и
--      fx_autoclose_job() (автозакрытие обмена через 24 часа). Они отдельно от доставки сообщений; запускаются
--      расписанием pg_cron (supabase/deadlines_schedule.sql — НЕ включено, пока не выполнено). Каждый запуск пишет
--      «пульс» в job_heartbeats; администратор видит, если расписание не включено или остановилось (jobs_status()).
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: файл 57 запущен. Как запустить: SQL Editor → вставить весь файл → Run (одним запросом;
-- при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 57) then
    raise exception 'СТОП: сначала запустите миграцию 57 (очередь уведомлений). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 58) then
    raise exception 'СТОП: файл 58 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Часовой пояс кабинета и сроки заказа
alter table public.workspaces add column if not exists time_zone text not null default 'Asia/Bishkek';

alter table public.orders add column if not exists payment_due_at     timestamptz;
alter table public.orders add column if not exists delivery_eta_from  timestamptz;
alter table public.orders add column if not exists delivery_eta_to    timestamptz;
alter table public.orders add column if not exists reminders_paused_at timestamptz;
alter table public.orders drop constraint if exists orders_eta_chk;
alter table public.orders add constraint orders_eta_chk
  check ((delivery_eta_from is null) = (delivery_eta_to is null) and (delivery_eta_from is null or delivery_eta_from <= delivery_eta_to));

-- История изменений сроков (и приостановки напоминаний)
create table if not exists public.order_deadline_history (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  order_id     uuid not null references public.orders(id) on delete cascade,
  field        text not null check (field in ('payment_due_at', 'delivery_eta_from', 'delivery_eta_to', 'reminders_paused_at')),
  old_value    timestamptz,
  new_value    timestamptz,
  changed_by   uuid default auth.uid(),
  changed_at   timestamptz not null default now()
);
create index if not exists order_deadline_history_order_idx on public.order_deadline_history (order_id, id desc);
alter table public.order_deadline_history enable row level security;
revoke all on public.order_deadline_history from anon, authenticated;
revoke all on sequence public.order_deadline_history_id_seq from anon, authenticated;

create or replace function public._orders_deadline_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_due_at is distinct from old.payment_due_at then
    insert into public.order_deadline_history (workspace_id, order_id, field, old_value, new_value) values (new.workspace_id, new.id, 'payment_due_at', old.payment_due_at, new.payment_due_at);
  end if;
  if new.delivery_eta_from is distinct from old.delivery_eta_from then
    insert into public.order_deadline_history (workspace_id, order_id, field, old_value, new_value) values (new.workspace_id, new.id, 'delivery_eta_from', old.delivery_eta_from, new.delivery_eta_from);
  end if;
  if new.delivery_eta_to is distinct from old.delivery_eta_to then
    insert into public.order_deadline_history (workspace_id, order_id, field, old_value, new_value) values (new.workspace_id, new.id, 'delivery_eta_to', old.delivery_eta_to, new.delivery_eta_to);
  end if;
  if new.reminders_paused_at is distinct from old.reminders_paused_at then
    insert into public.order_deadline_history (workspace_id, order_id, field, old_value, new_value) values (new.workspace_id, new.id, 'reminders_paused_at', old.reminders_paused_at, new.reminders_paused_at);
  end if;
  return new;
end;
$$;
revoke all on function public._orders_deadline_history() from public, anon, authenticated;
drop trigger if exists orders_deadline_history on public.orders;
create trigger orders_deadline_history after update of payment_due_at, delivery_eta_from, delivery_eta_to, reminders_paused_at on public.orders
  for each row execute function public._orders_deadline_history();


-- 2. Правила напоминаний клиентам (по кабинету). Строки нет = автоматизация ВЫКЛЮЧЕНА.
create table if not exists public.ws_reminder_settings (
  workspace_id  uuid primary key references public.workspaces(id) on delete cascade,
  enabled       boolean  not null default false,
  send_from     smallint not null default 9  check (send_from between 0 and 23),     -- часы отправки (по времени кабинета), с … (включительно)
  send_to       smallint not null default 20 check (send_to between 1 and 24),       -- … до (не включая)
  grace_hours   int      not null default 24 check (grace_hours between 0 and 720),  -- пауза после срока оплаты перед первым напоминанием
  min_gap_hours int      not null default 72 check (min_gap_hours between 12 and 720), -- интервал между напоминаниями по заказу
  max_per_order smallint not null default 3  check (max_per_order between 1 and 10),
  max_per_day   int      not null default 50 check (max_per_day between 1 and 500),  -- всего по кабинету за сутки
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  check (send_from < send_to)
);
create table if not exists public.ws_reminder_log (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  at           timestamptz not null default now(),
  actor        uuid default auth.uid(),
  detail       text not null check (char_length(detail) <= 300)
);
alter table public.ws_reminder_settings enable row level security;
alter table public.ws_reminder_log      enable row level security;
revoke all on public.ws_reminder_settings, public.ws_reminder_log from anon, authenticated;
revoke all on sequence public.ws_reminder_log_id_seq from anon, authenticated;


-- 3. Задачи по заказам
create table if not exists public.order_tasks (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  order_id       uuid not null references public.orders(id) on delete cascade,
  kind           text not null check (kind in ('payment_overdue', 'delivery_soon', 'delivery_overdue', 'missing_data')),
  dedupe_key     text not null,
  details        jsonb not null default '{}'::jsonb,
  status         text not null default 'open' check (status in ('open', 'resolved')),
  snoozed_until  timestamptz,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_reason text,
  unique (order_id, kind, dedupe_key)
);
create index if not exists order_tasks_ws_idx on public.order_tasks (workspace_id, status);
alter table public.order_tasks enable row level security;
revoke all on public.order_tasks from anon, authenticated;


-- 4. Пульс серверных задач (видно администратору)
create table if not exists public.job_heartbeats (
  job        text primary key,
  last_run_at timestamptz,
  last_ok_at  timestamptz,
  last_error  text check (last_error is null or char_length(last_error) <= 200),
  runs        bigint not null default 0
);
alter table public.job_heartbeats enable row level security;
revoke all on public.job_heartbeats from anon, authenticated;

create or replace function public._job_beat(p_job text, p_ok boolean, p_detail text default null)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.job_heartbeats (job, last_run_at, last_ok_at, last_error, runs)
  values (p_job, now(), case when p_ok then now() end, case when not p_ok then left(coalesce(p_detail, 'error'), 200) end, 1)
  on conflict (job) do update
    set last_run_at = now(),
        last_ok_at  = case when p_ok then now() else public.job_heartbeats.last_ok_at end,
        last_error  = case when p_ok then null else left(coalesce(p_detail, 'error'), 200) end,
        runs        = public.job_heartbeats.runs + 1;
$$;
revoke all on function public._job_beat(text, boolean, text) from public, anon, authenticated;

-- пульс обработчика доставки (Edge Function зовёт после каждого прохода)
create or replace function public.job_beat(p_job text, p_ok boolean, p_detail text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_job not in ('order_notify_worker') then raise exception 'bad_job' using errcode = '22023'; end if;
  perform public._job_beat(p_job, p_ok, p_detail);
end;
$$;
revoke all on function public.job_beat(text, boolean, text) from public, anon, authenticated;
grant execute on function public.job_beat(text, boolean, text) to service_role;

-- Администратору: какие серверные задачи работают. Ожидаемый период × 3 без запуска = «остановилась».
create or replace function public.jobs_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'job', j.job, 'every_sec', j.every_sec, 'last_run_at', h.last_run_at, 'last_ok_at', h.last_ok_at, 'last_error', h.last_error,
             'state', case when h.job is null or h.last_run_at is null then 'never'
                           when h.last_run_at < now() - make_interval(secs => j.every_sec * 3) then 'stale'
                           when h.last_error is not null then 'error'
                           else 'ok' end) order by j.job)
      from (values ('deadlines_scan', 600), ('fx_autoclose', 300), ('order_notify_worker', 60)) as j(job, every_sec)
      left join public.job_heartbeats h on h.job = j.job), '[]'::jsonb);
end;
$$;
revoke all on function public.jobs_status() from public, anon, authenticated;
grant execute on function public.jobs_status() to authenticated;


-- 5. Время: ближайшее «окно» отправки (часы по времени кабинета)
create or replace function public._next_send_window(p_tz text, p_from int, p_to int, p_at timestamptz)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  l  timestamp := p_at at time zone p_tz;
  h  int := extract(hour from l)::int;
begin
  if h >= p_from and h < p_to then return p_at; end if;
  if h < p_from then return (date_trunc('day', l) + make_interval(hours => p_from)) at time zone p_tz; end if;
  return (date_trunc('day', l) + interval '1 day' + make_interval(hours => p_from)) at time zone p_tz;
end;
$$;
revoke all on function public._next_send_window(text, int, int, timestamptz) from public, anon, authenticated;


-- 6. Для сайта: сроки, приостановка, правила, история, задачи (проверка прав внутри)
create or replace function public.ws_set_timezone(p_ws uuid, p_tz text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'bad_timezone' using errcode = '22023'; end if;
  update public.workspaces set time_zone = p_tz where id = p_ws;
  return p_tz;
end;
$$;
revoke all on function public.ws_set_timezone(uuid, text) from public, anon, authenticated;
grant execute on function public.ws_set_timezone(uuid, text) to authenticated;

-- Срок оплаты вводится как «местное время кабинета» (без пояса), интервал доставки — как даты (с начала первого
-- до конца последнего дня). Пустое значение очищает срок. Пояс берётся из настроек кабинета.
create or replace function public.order_set_deadlines(p_order uuid, p_payment_due timestamp default null,
                                                      p_eta_from date default null, p_eta_to date default null)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws uuid; v_tz text;
  v_pay timestamptz; v_from timestamptz; v_to timestamptz;
begin
  select o.workspace_id, w.time_zone into v_ws, v_tz from public.orders o join public.workspaces w on w.id = o.workspace_id where o.id = p_order for update of o;
  if v_ws is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if (p_eta_from is null) <> (p_eta_to is null) then raise exception 'eta_incomplete' using errcode = '22023'; end if;
  if p_eta_from is not null and p_eta_from > p_eta_to then raise exception 'eta_order' using errcode = '22023'; end if;
  v_pay  := case when p_payment_due is null then null else p_payment_due at time zone v_tz end;
  v_from := case when p_eta_from is null then null else p_eta_from::timestamp at time zone v_tz end;
  v_to   := case when p_eta_to is null then null else ((p_eta_to + 1)::timestamp at time zone v_tz) - interval '1 second' end;
  update public.orders set payment_due_at = v_pay, delivery_eta_from = v_from, delivery_eta_to = v_to where id = p_order;
  return json_build_object('payment_due_at', v_pay, 'delivery_eta_from', v_from, 'delivery_eta_to', v_to, 'time_zone', v_tz);
end;
$$;
revoke all on function public.order_set_deadlines(uuid, timestamp, date, date) from public, anon, authenticated;
grant execute on function public.order_set_deadlines(uuid, timestamp, date, date) to authenticated;

create or replace function public.order_reminders_pause(p_order uuid, p_paused boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.orders where id = p_order for update;
  if v_ws is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.orders set reminders_paused_at = case when p_paused then coalesce(reminders_paused_at, now()) else null end where id = p_order;
end;
$$;
revoke all on function public.order_reminders_pause(uuid, boolean) from public, anon, authenticated;
grant execute on function public.order_reminders_pause(uuid, boolean) to authenticated;

create or replace function public.order_deadline_history(p_order uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.orders where id = p_order;
  if v_ws is null or not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('field', h.field, 'old', h.old_value, 'new', h.new_value, 'at', h.changed_at) order by h.id desc)
                     from (select * from public.order_deadline_history where order_id = p_order order by id desc limit 30) h), '[]'::jsonb);
end;
$$;
revoke all on function public.order_deadline_history(uuid) from public, anon, authenticated;
grant execute on function public.order_deadline_history(uuid) to authenticated;

create or replace function public.reminder_settings_get(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.ws_reminder_settings;
  v_tz text;
begin
  if not public.is_member(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into s from public.ws_reminder_settings where workspace_id = p_ws;
  select time_zone into v_tz from public.workspaces where id = p_ws;
  return jsonb_build_object('enabled', coalesce(s.enabled, false), 'send_from', coalesce(s.send_from, 9), 'send_to', coalesce(s.send_to, 20),
    'grace_hours', coalesce(s.grace_hours, 24), 'min_gap_hours', coalesce(s.min_gap_hours, 72), 'max_per_order', coalesce(s.max_per_order, 3),
    'max_per_day', coalesce(s.max_per_day, 50), 'time_zone', v_tz, 'updated_at', s.updated_at);
end;
$$;
revoke all on function public.reminder_settings_get(uuid) from public, anon, authenticated;
grant execute on function public.reminder_settings_get(uuid) to authenticated;

create or replace function public.reminder_settings_set(p_ws uuid, p_enabled boolean, p_from int, p_to int, p_grace int, p_gap int, p_max int, p_day int)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_from < 0 or p_to > 24 or p_from >= p_to or p_grace not between 0 and 720
     or p_gap not between 12 and 720 or p_max not between 1 and 10 or p_day not between 1 and 500 then
    raise exception 'bad_settings' using errcode = '22023';
  end if;
  insert into public.ws_reminder_settings (workspace_id, enabled, send_from, send_to, grace_hours, min_gap_hours, max_per_order, max_per_day, updated_by, updated_at)
  values (p_ws, coalesce(p_enabled, false), p_from, p_to, p_grace, p_gap, p_max, p_day, auth.uid(), now())
  on conflict (workspace_id) do update set enabled = excluded.enabled, send_from = excluded.send_from, send_to = excluded.send_to,
    grace_hours = excluded.grace_hours, min_gap_hours = excluded.min_gap_hours, max_per_order = excluded.max_per_order,
    max_per_day = excluded.max_per_day, updated_by = auth.uid(), updated_at = now();
  insert into public.ws_reminder_log (workspace_id, detail)
  values (p_ws, left(case when p_enabled then 'ВКЛЮЧЕНО' else 'выключено' end || format(': часы %s–%s, пауза %s ч, интервал %s ч, на заказ %s, в сутки %s', p_from, p_to, p_grace, p_gap, p_max, p_day), 300));
end;
$$;
revoke all on function public.reminder_settings_set(uuid, boolean, int, int, int, int, int, int) from public, anon, authenticated;
grant execute on function public.reminder_settings_set(uuid, boolean, int, int, int, int, int, int) to authenticated;

create or replace function public.tasks_list(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'order_id', t.order_id, 'order_number', o.order_number, 'kind', t.kind,
             'details', t.details, 'created_at', t.created_at, 'snoozed_until', t.snoozed_until) order by t.created_at desc)
      from public.order_tasks t join public.orders o on o.id = t.order_id
     where t.workspace_id = p_ws and t.status = 'open' and (t.snoozed_until is null or t.snoozed_until <= now())), '[]'::jsonb);
end;
$$;
revoke all on function public.tasks_list(uuid) from public, anon, authenticated;
grant execute on function public.tasks_list(uuid) to authenticated;

create or replace function public.task_snooze(p_id uuid, p_days int)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select workspace_id into v_ws from public.order_tasks where id = p_id;
  if v_ws is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_days not between 1 and 30 then raise exception 'bad_days' using errcode = '22023'; end if;
  update public.order_tasks set snoozed_until = now() + make_interval(days => p_days) where id = p_id and status = 'open';
end;
$$;
revoke all on function public.task_snooze(uuid, int) from public, anon, authenticated;
grant execute on function public.task_snooze(uuid, int) to authenticated;


-- 7. Синхронизация задач (внутренняя): закрывает то, что потеряло силу, открывает новое. Только из-за явных сроков и этапов.
create or replace function public._tasks_sync(p_now timestamptz, p_order uuid default null)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int := 0;
  k int;
begin
  -- 7.1 закрыть задачи, у которых условие исчезло
  with chk as (
    select t.id,
      case
        when t.kind = 'payment_overdue' then
          case when o.status = 'cancelled' then 'cancelled'
               when o.client_price is null or o.balance_som <= 0 then 'paid'
               when o.payment_due_at is null or t.dedupe_key <> 'due:' || extract(epoch from o.payment_due_at)::bigint then 'deadline_changed'
               when p_now <= o.payment_due_at then 'not_due' end
        when t.kind = 'delivery_soon' then
          case when o.delivery_eta_to is null or t.dedupe_key <> 'soon:' || extract(epoch from o.delivery_eta_to)::bigint then 'deadline_changed'
               when o.status not in ('new', 'awaiting_payment', 'purchasing', 'china_warehouse', 'in_transit') then 'stage_passed'
               when p_now > o.delivery_eta_to then 'superseded' end
        when t.kind = 'delivery_overdue' then
          case when o.delivery_eta_to is null or t.dedupe_key <> 'late:' || extract(epoch from o.delivery_eta_to)::bigint then 'deadline_changed'
               when o.status not in ('new', 'awaiting_payment', 'purchasing', 'china_warehouse', 'in_transit') then 'stage_passed'
               when p_now <= o.delivery_eta_to then 'not_late' end
        else
          case when t.dedupe_key <> split_part(t.dedupe_key, ':', 1) || ':' || o.status then 'stage_changed'
               when split_part(t.dedupe_key, ':', 1) = 'no_price'    and o.client_price is not null then 'fixed'
               when split_part(t.dedupe_key, ':', 1) = 'no_weight'   and coalesce(o.weight_kg, 0) > 0 then 'fixed'
               when split_part(t.dedupe_key, ':', 1) = 'no_tracking' and nullif(btrim(coalesce(o.tracking_number, '')), '') is not null then 'fixed' end
      end as why
    from public.order_tasks t join public.orders o on o.id = t.order_id
   where t.status = 'open' and (p_order is null or t.order_id = p_order)
  )
  update public.order_tasks t set status = 'resolved', resolved_at = p_now, resolved_reason = chk.why
    from chk where chk.id = t.id and chk.why is not null;
  get diagnostics k = row_count; n := n + k;

  -- 7.2 открыть: срок оплаты истёк (только если срок задан, цена есть и долг остался)
  insert into public.order_tasks (workspace_id, order_id, kind, dedupe_key, details, created_at)
  select o.workspace_id, o.id, 'payment_overdue', 'due:' || extract(epoch from o.payment_due_at)::bigint,
         jsonb_build_object('due_at', o.payment_due_at, 'balance', o.balance_som, 'currency', coalesce(o.client_currency, 'KGS')), p_now
    from public.orders o
   where (p_order is null or o.id = p_order)
     and o.payment_due_at is not null and p_now > o.payment_due_at
     and o.status <> 'cancelled' and o.client_price is not null and o.balance_som > 0
  on conflict (order_id, kind, dedupe_key) do update
    set status = 'open', resolved_at = null, resolved_reason = null, details = excluded.details
    where public.order_tasks.status = 'resolved' and public.order_tasks.resolved_reason <> 'superseded';
  get diagnostics k = row_count; n := n + k;

  -- 7.3 срок доставки: за 2 суток «приближается», после конца интервала «прошёл» (клиенту ничего не пишется)
  insert into public.order_tasks (workspace_id, order_id, kind, dedupe_key, details, created_at)
  select o.workspace_id, o.id, 'delivery_soon', 'soon:' || extract(epoch from o.delivery_eta_to)::bigint,
         jsonb_build_object('eta_from', o.delivery_eta_from, 'eta_to', o.delivery_eta_to, 'status', o.status), p_now
    from public.orders o
   where (p_order is null or o.id = p_order)
     and o.delivery_eta_to is not null and p_now <= o.delivery_eta_to and p_now >= o.delivery_eta_to - interval '2 days'
     and o.status in ('new', 'awaiting_payment', 'purchasing', 'china_warehouse', 'in_transit')
  on conflict (order_id, kind, dedupe_key) do update
    set status = 'open', resolved_at = null, resolved_reason = null, details = excluded.details
    where public.order_tasks.status = 'resolved' and public.order_tasks.resolved_reason not in ('superseded', 'stage_passed');
  get diagnostics k = row_count; n := n + k;

  insert into public.order_tasks (workspace_id, order_id, kind, dedupe_key, details, created_at)
  select o.workspace_id, o.id, 'delivery_overdue', 'late:' || extract(epoch from o.delivery_eta_to)::bigint,
         jsonb_build_object('eta_from', o.delivery_eta_from, 'eta_to', o.delivery_eta_to, 'status', o.status), p_now
    from public.orders o
   where (p_order is null or o.id = p_order)
     and o.delivery_eta_to is not null and p_now > o.delivery_eta_to
     and o.status in ('new', 'awaiting_payment', 'purchasing', 'china_warehouse', 'in_transit')
  on conflict (order_id, kind, dedupe_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  -- 7.4 не хватает данных для следующего этапа
  insert into public.order_tasks (workspace_id, order_id, kind, dedupe_key, details, created_at)
  select o.workspace_id, o.id, 'missing_data', m.code || ':' || o.status, jsonb_build_object('missing', m.code, 'status', o.status), p_now
    from public.orders o
    join lateral (values
      (case when o.status = 'awaiting_payment' and o.client_price is null then 'no_price' end),
      (case when o.status = 'china_warehouse' and coalesce(o.weight_kg, 0) <= 0 then 'no_weight' end),
      (case when o.status = 'in_transit' and nullif(btrim(coalesce(o.tracking_number, '')), '') is null then 'no_tracking' end)) m(code) on m.code is not null
   where (p_order is null or o.id = p_order)
  on conflict (order_id, kind, dedupe_key) do update
    set status = 'open', resolved_at = null, resolved_reason = null, details = excluded.details
    where public.order_tasks.status = 'resolved';
  get diagnostics k = row_count; n := n + k;
  return n;
end;
$$;
revoke all on function public._tasks_sync(timestamptz, uuid) from public, anon, authenticated;

-- Любое изменение оплаты, цены, статуса или сроков сразу пересчитывает задачи этого заказа (оплатили — задача закрылась)
create or replace function public._orders_tasks_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._tasks_sync(now(), new.id);
  return null;
end;
$$;
revoke all on function public._orders_tasks_sync() from public, anon, authenticated;
drop trigger if exists orders_tasks_sync on public.orders;
create trigger orders_tasks_sync after update of paid_amount, client_price, status, payment_due_at, delivery_eta_from, delivery_eta_to, tracking_number, weight_kg on public.orders
  for each row execute function public._orders_tasks_sync();


-- 8. Очередь: напоминания — тот же механизм доставки (файл 57)
alter table public.order_notify_queue add column if not exists kind text not null default 'status';
alter table public.order_notify_queue drop constraint if exists order_notify_queue_kind_chk;
alter table public.order_notify_queue add constraint order_notify_queue_kind_chk check (kind in ('status', 'payment_reminder'));
alter table public.order_notify_queue add column if not exists due_at timestamptz;          -- срок оплаты, на который поставлено напоминание
alter table public.order_notify_queue add column if not exists reminder_no int;
create unique index if not exists order_notify_queue_reminder_uidx on public.order_notify_queue (order_id, chat_id, due_at, reminder_no)
  where kind = 'payment_reminder' and status in ('pending', 'processing', 'sent');

drop function if exists public._notify_check(uuid);
drop function if exists public.notify_claim(text, int, int);
drop function if exists public.notify_begin_send(uuid, text);

-- Проверка получателя и условий (внутренняя). Возвращает причину отказа, 'outside_hours' (отложить) или null.
create or replace function public._notify_check(p_id uuid, p_now timestamptz default now())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q public.order_notify_queue;
  o public.orders;
  s public.ws_reminder_settings;
  v_sub timestamptz;
  v_tz text;
  v_h int;
begin
  select * into q from public.order_notify_queue where id = p_id;
  if q.id is null then return 'not_found'; end if;
  select s2.created_at into v_sub from public.order_tg_subs s2 where s2.order_id = q.order_id and s2.chat_id = q.chat_id;
  if v_sub is null then return 'subscription_removed'; end if;
  if v_sub > q.created_at then return 'subscription_changed'; end if;
  select * into o from public.orders where id = q.order_id;
  if o.public_token is null then return 'link_revoked'; end if;
  if q.kind = 'payment_reminder' then
    select * into s from public.ws_reminder_settings where workspace_id = q.workspace_id;
    if s.workspace_id is null or not s.enabled then return 'automation_off'; end if;
    if o.reminders_paused_at is not null then return 'paused'; end if;
    if o.status = 'cancelled' then return 'cancelled'; end if;
    if o.payment_due_at is distinct from q.due_at then return 'deadline_changed'; end if;
    if o.client_price is null or o.balance_som <= 0 then return 'paid'; end if;
    select time_zone into v_tz from public.workspaces where id = q.workspace_id;
    v_h := extract(hour from (p_now at time zone v_tz))::int;
    if v_h < s.send_from or v_h >= s.send_to then return 'outside_hours'; end if;
    if (select count(*) from public.order_notify_queue x where x.workspace_id = q.workspace_id and x.kind = 'payment_reminder'
           and x.status = 'sent' and x.sent_at > p_now - interval '24 hours') >= s.max_per_day then return 'daily_limit'; end if;
  end if;
  return null;
end;
$$;
revoke all on function public._notify_check(uuid, timestamptz) from public, anon, authenticated;

-- Задачи для обработчика (только service_role); p_now нужен тестам, обработчик его не передаёт
create or replace function public.notify_claim(p_worker text, p_limit int default 20, p_lease int default 120, p_now timestamptz default null)
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
  v_now   timestamptz := coalesce(p_now, now());
  v_tz    text;
  v_from  int;
  v_to    int;
begin
  if coalesce(btrim(p_worker), '') = '' or char_length(p_worker) > 80 then raise exception 'bad_worker' using errcode = '22023'; end if;
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  p_lease := least(greatest(coalesce(p_lease, 120), 30), 900);

  for r in select id, send_started_at, attempts, max_attempts from public.order_notify_queue
            where status = 'processing' and locked_until < v_now order by seq for update skip locked loop
    if r.send_started_at is not null then
      perform public._notify_unknown(r.id, 'обработчик пропал во время отправки');
    elsif r.attempts >= r.max_attempts then
      update public.order_notify_queue set status = 'failed', last_error = 'max_attempts', locked_by = null, locked_until = null, updated_at = v_now where id = r.id;
      perform public._notify_log(r.id, 'failed', 'max_attempts');
    else
      update public.order_notify_queue set status = 'pending', locked_by = null, locked_until = null, updated_at = v_now where id = r.id;
      perform public._notify_log(r.id, 'retry', 'обработчик пропал до отправки: задача возвращена');
    end if;
  end loop;

  for r in
    select q.id, q.workspace_id from public.order_notify_queue q
     where q.status = 'pending' and q.next_attempt_at <= v_now
       and not exists (select 1 from public.order_notify_queue e   -- предыдущее событие того же вида по этому заказу и чату ещё не завершено
                        where e.order_id = q.order_id and e.chat_id = q.chat_id and e.kind = q.kind and e.seq < q.seq and e.status in ('pending', 'processing'))
     order by q.seq
     limit p_limit
     for update of q skip locked
  loop
    v_why := public._notify_check(r.id, v_now);
    if v_why = 'outside_hours' then   -- не пропуск: переносим на ближайшие часы отправки, попытка не тратится
      select w.time_zone, s.send_from, s.send_to into v_tz, v_from, v_to from public.workspaces w join public.ws_reminder_settings s on s.workspace_id = w.id where w.id = r.workspace_id;
      update public.order_notify_queue set next_attempt_at = public._next_send_window(v_tz, v_from, v_to, v_now), updated_at = v_now where id = r.id;
      perform public._notify_log(r.id, 'deferred', 'вне часов отправки');
      continue;
    elsif v_why is not null then
      update public.order_notify_queue set status = 'skipped', last_error = v_why, updated_at = v_now where id = r.id;
      perform public._notify_log(r.id, 'skipped', v_why);
      continue;
    end if;
    update public.order_notify_queue set status = 'processing', attempts = attempts + 1, locked_by = p_worker,
           locked_until = v_now + make_interval(secs => p_lease), send_started_at = null, updated_at = v_now where id = r.id;
    perform public._notify_log(r.id, 'claimed', p_worker);
    -- только поля, которые клиент и так видит на своей странице заказа
    select v_out || jsonb_build_array(jsonb_build_object(
             'id', q.id, 'kind', q.kind, 'attempt', q.attempts, 'max_attempts', q.max_attempts, 'chat_id', q.chat_id, 'lang', q.lang,
             'to_status', q.to_status, 'order_number', o.order_number, 'product_ru', o.product_ru, 'product_zh', o.product_zh,
             'tracking_number', o.tracking_number, 'public_token', o.public_token, 'brand', w.name,
             'amount', case when q.kind = 'payment_reminder' then round(o.balance_som, 2)::text end,
             'currency', case when q.kind = 'payment_reminder' then coalesce(o.client_currency, 'KGS') end,
             'due_date', case when q.kind = 'payment_reminder' then to_char(q.due_at at time zone w.time_zone, 'DD.MM.YYYY') end))
      into v_out
      from public.order_notify_queue q
      join public.orders o on o.id = q.order_id
      join public.workspaces w on w.id = q.workspace_id
     where q.id = r.id;
  end loop;
  return v_out;
end;
$$;
revoke all on function public.notify_claim(text, int, int, timestamptz) from public, anon, authenticated;
grant execute on function public.notify_claim(text, int, int, timestamptz) to service_role;

create or replace function public.notify_begin_send(p_id uuid, p_worker text, p_now timestamptz default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.order_notify_queue;
  v_why text;
  v_now timestamptz := coalesce(p_now, now());
  v_tz text; v_from int; v_to int;
begin
  select * into q from public.order_notify_queue where id = p_id for update;
  if q.id is null or q.status <> 'processing' or q.locked_by is distinct from p_worker or q.locked_until < v_now then return false; end if;
  v_why := public._notify_check(p_id, v_now);
  if v_why = 'outside_hours' then
    select w.time_zone, s.send_from, s.send_to into v_tz, v_from, v_to from public.workspaces w join public.ws_reminder_settings s on s.workspace_id = w.id where w.id = q.workspace_id;
    update public.order_notify_queue set status = 'pending', attempts = greatest(attempts - 1, 0), locked_by = null, locked_until = null,
           next_attempt_at = public._next_send_window(v_tz, v_from, v_to, v_now), updated_at = v_now where id = p_id;
    perform public._notify_log(p_id, 'deferred', 'вне часов отправки');
    return false;
  elsif v_why is not null then
    update public.order_notify_queue set status = 'skipped', last_error = v_why, locked_by = null, locked_until = null, updated_at = v_now where id = p_id;
    perform public._notify_log(p_id, 'skipped', v_why);
    return false;
  end if;
  update public.order_notify_queue set send_started_at = v_now, updated_at = v_now where id = p_id;
  return true;
end;
$$;
revoke all on function public.notify_begin_send(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.notify_begin_send(uuid, text, timestamptz) to service_role;

-- «sent» для напоминания не трогает отметку last_status (она нужна только статусным сообщениям)
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
    if q.kind = 'status' then
      update public.order_tg_subs set last_status = q.to_status where order_id = q.order_id and chat_id = q.chat_id;
    end if;
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
    delete from public.order_tg_subs where order_id = q.order_id and chat_id = q.chat_id;
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

-- список для владельца: добавлен вид сообщения
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
                 'id', q.id, 'kind', q.kind, 'order_number', o.order_number, 'to_status', q.to_status, 'status', q.status,
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


-- 9. Проход по срокам (серверный, без браузера): задачи + постановка напоминаний. Доставку делает order-notify-worker.
create or replace function public._reminders_enqueue(p_now timestamptz, p_limit int)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r      record;
  v_n    int := 0;
  v_day  jsonb := '{}'::jsonb;
  v_cnt  int;
  v_id   uuid;
begin
  for r in
    select o.id as order_id, o.workspace_id as ws, o.payment_due_at as due, s.chat_id, s.lang, st.min_gap_hours, st.max_per_order, st.max_per_day,
           st.send_from, st.send_to, w.time_zone as tz, o.status,
           (select count(*) from public.order_notify_queue q where q.order_id = o.id and q.chat_id = s.chat_id and q.kind = 'payment_reminder'
               and q.due_at = o.payment_due_at and q.status in ('pending', 'processing', 'sent')) as n_prev,
           (select max(q.created_at) from public.order_notify_queue q where q.order_id = o.id and q.chat_id = s.chat_id and q.kind = 'payment_reminder'
               and q.due_at = o.payment_due_at and q.status in ('pending', 'processing', 'sent')) as last_at,
           exists (select 1 from public.order_notify_queue q where q.order_id = o.id and q.chat_id = s.chat_id and q.kind = 'payment_reminder'
               and q.status in ('pending', 'processing')) as busy
      from public.orders o
      join public.ws_reminder_settings st on st.workspace_id = o.workspace_id and st.enabled
      join public.workspaces w on w.id = o.workspace_id
      join public.order_tg_subs s on s.order_id = o.id
     where o.reminders_paused_at is null and o.status <> 'cancelled' and o.public_token is not null
       and o.payment_due_at is not null and o.client_price is not null and o.balance_som > 0
       and p_now >= o.payment_due_at + make_interval(hours => st.grace_hours)
     order by o.payment_due_at, o.id, s.chat_id
     limit p_limit
  loop
    continue when r.busy or r.n_prev >= r.max_per_order;
    continue when r.last_at is not null and r.last_at > p_now - make_interval(hours => r.min_gap_hours);
    if not v_day ? r.ws::text then
      select count(*) into v_cnt from public.order_notify_queue q
       where q.workspace_id = r.ws and q.kind = 'payment_reminder' and q.created_at > p_now - interval '24 hours' and q.status in ('pending', 'processing', 'sent');
      v_day := v_day || jsonb_build_object(r.ws::text, v_cnt);
    end if;
    continue when (v_day ->> r.ws::text)::int >= r.max_per_day;
    insert into public.order_notify_queue (workspace_id, order_id, chat_id, lang, event_id, from_status, to_status, kind, due_at, reminder_no, next_attempt_at, created_at, updated_at)
    values (r.ws, r.order_id, r.chat_id, r.lang, gen_random_uuid(), r.status, r.status, 'payment_reminder', r.due, r.n_prev + 1,
            public._next_send_window(r.tz, r.send_from, r.send_to, p_now), p_now, p_now)
    on conflict do nothing
    returning id into v_id;
    if v_id is not null then
      perform public._notify_log(v_id, 'created', 'напоминание № ' || (r.n_prev + 1));
      v_day := v_day || jsonb_build_object(r.ws::text, (v_day ->> r.ws::text)::int + 1);
      v_n := v_n + 1;
    end if;
    v_id := null;
  end loop;
  return v_n;
end;
$$;
revoke all on function public._reminders_enqueue(timestamptz, int) from public, anon, authenticated;

create or replace function public.deadlines_scan(p_now timestamptz default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_tasks int; v_rem int;
begin
  -- два запуска одновременно: второй сразу уходит (первый всё сделает)
  if not pg_try_advisory_xact_lock(hashtextextended('ula_deadlines_scan', 54)) then
    return jsonb_build_object('skipped', true);
  end if;
  begin
    v_tasks := public._tasks_sync(v_now, null);
    v_rem   := public._reminders_enqueue(v_now, 5000);
    perform public._job_beat('deadlines_scan', true);
    return jsonb_build_object('tasks_changed', v_tasks, 'reminders_queued', v_rem);
  exception when others then
    perform public._job_beat('deadlines_scan', false, 'sqlstate ' || sqlstate);   -- сообщение ошибки в пульс не пишем
    return jsonb_build_object('error', sqlstate);
  end;
end;
$$;
revoke all on function public.deadlines_scan(timestamptz) from public, anon, authenticated;
grant execute on function public.deadlines_scan(timestamptz) to service_role;


-- 10. Автозакрытие обмена: независимый серверный запуск. Правила прежние (fx_autoclose, файл 31):
--     «юани отправлены» без ответа клиента 24 часа и без открытого спора → «выполнено».
--     Строки, которые сейчас меняют спор или подтверждение клиента (блокировка), пропускаются и закроются на следующем
--     проходе, если условия ещё верны: спор, подтверждение и автозакрытие не дают противоречивого результата.
create or replace function public.fx_autoclose_all(p_limit int default 500, p_now timestamptz default null)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int;
  v_now timestamptz := coalesce(p_now, now());
begin
  with cand as (
    select id from public.exchange_requests
     where status = 'sent' and dispute is distinct from 'open' and sent_at < v_now - interval '24 hours'
     order by sent_at limit least(greatest(coalesce(p_limit, 500), 1), 2000)
       for update skip locked),
  x as (
    update public.exchange_requests r set status = 'done', received_at = v_now
      from cand
     where r.id = cand.id and r.status = 'sent' and r.dispute is distinct from 'open' and r.sent_at < v_now - interval '24 hours'
    returning r.id)
  insert into public.exchange_events (request_id, kind, author, notified_at)
  select id, 'auto_done', 'system', v_now from x;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.fx_autoclose_all(int, timestamptz) from public, anon, authenticated;
grant execute on function public.fx_autoclose_all(int, timestamptz) to service_role;

create or replace function public.fx_autoclose_job(p_now timestamptz default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int;
begin
  begin
    n := public.fx_autoclose_all(500, p_now);
    perform public._job_beat('fx_autoclose', true);
    return jsonb_build_object('closed', n);
  exception when others then
    perform public._job_beat('fx_autoclose', false, 'sqlstate ' || sqlstate);
    return jsonb_build_object('error', sqlstate);
  end;
end;
$$;
revoke all on function public.fx_autoclose_job(timestamptz) from public, anon, authenticated;
grant execute on function public.fx_autoclose_job(timestamptz) to service_role;


-- ✅ ОТМЕТКА: файл 58 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (58, 'migration_58_deadlines.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
