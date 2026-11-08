-- =====================================================
-- ULA FACTORY — миграция 59: ежедневная работа байера и сотрудника
--
-- ЧТО ДОБАВЛЯЕТСЯ
--   1. Простой режим хранится в ПРОФИЛЕ пользователя (profiles.ui_simple + ui_simple_explicit), а не только в браузере:
--      выбор действует на всех устройствах. «Явный» выбор (человек сам нажал) никогда не перезаписывается автоматическим
--      решением по числу заказов. Автоматическое решение записывается только в пустой профиль.
--      Функции: my_ui_prefs() и my_ui_prefs_set(p_simple, p_explicit) — каждый видит и меняет только СВОЙ профиль.
--   2. Подключаемые модули кабинета «Магазин» и «Обмен» (workspaces.module_shop / module_exchange, по умолчанию включены —
--      ничего не меняется). Выключает ТОЛЬКО владелец (ws_daily_set_modules). Выключение скрывает обычные входы на сайте
--      и больше ничего: данные не удаляются, финансовые правила и серверные функции обмена/магазина не меняются, действующие
--      заказы, сделки и споры завершаются как раньше (ws_daily_get отдаёт их число, чтобы сайт показал вход, пока они есть).
--   3. Часовой пояс кабинета: владелец явно ПОДТВЕРЖДАЕТ его (workspaces.time_zone_confirmed_at) или меняет.
--      Правило смены пояса: уже согласованные МОМЕНТЫ (срок оплаты, интервал доставки) — абсолютное время (timestamptz),
--      они НЕ сдвигаются и не пишутся в историю сроков, задачи не пересоздаются. Меняется только то, как момент показан
--      (местное время нового пояса) и в какой час кабинета попадают часы отправки напоминаний. Перед сменой владелец видит,
--      у скольких активных заказов день срока в новом поясе покажется другим (ws_timezone_preview). Каждая смена пишется в
--      журнал ws_timezone_log.
--   4. Защита выбора клиента: заказ нельзя привязать к клиенту ДРУГОГО кабинета (раньше триггер верил любому client_id).
--      Теперь, если указан client_id, он обязан принадлежать кабинету заказа, иначе ошибка bad_client.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: файл 58 запущен. Как запустить: SQL Editor → вставить весь файл → Run (одним запросом;
-- при ошибке откатывается всё). Можно запускать повторно. Сайт без файла 59 работает как раньше (режим — в браузере).
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 58) then
    raise exception 'СТОП: сначала запустите миграцию 58 (сроки и напоминания). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 59) then
    raise exception 'СТОП: файл 59 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Простой режим — в профиле
alter table public.profiles add column if not exists ui_simple boolean;
alter table public.profiles add column if not exists ui_simple_explicit boolean not null default false;

create or replace function public.my_ui_prefs()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('simple', p.ui_simple, 'explicit', p.ui_simple_explicit)
    from public.profiles p where p.user_id = auth.uid();
$$;
revoke all on function public.my_ui_prefs() from public, anon, authenticated;
grant execute on function public.my_ui_prefs() to authenticated;

create or replace function public.my_ui_prefs_set(p_simple boolean, p_explicit boolean default true)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_simple is null then raise exception 'bad_value' using errcode = '22023'; end if;
  select * into r from public.profiles where user_id = auth.uid() for update;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_explicit then
    update public.profiles set ui_simple = p_simple, ui_simple_explicit = true where user_id = auth.uid();
  elsif r.ui_simple is null then
    -- автоматическое решение: только в пустой профиль, явный выбор и прежнее решение не трогает
    update public.profiles set ui_simple = p_simple, ui_simple_explicit = false where user_id = auth.uid();
  end if;
  return public.my_ui_prefs();
end;
$$;
revoke all on function public.my_ui_prefs_set(boolean, boolean) from public, anon, authenticated;
grant execute on function public.my_ui_prefs_set(boolean, boolean) to authenticated;


-- 2. Модули кабинета и подтверждение часового пояса
alter table public.workspaces add column if not exists module_shop     boolean not null default true;
alter table public.workspaces add column if not exists module_exchange boolean not null default true;
alter table public.workspaces add column if not exists time_zone_confirmed_at timestamptz;
alter table public.workspaces add column if not exists time_zone_confirmed_by uuid;

create table if not exists public.ws_timezone_log (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  old_zone     text not null,
  new_zone     text not null,
  changed_by   uuid,
  affected     int  not null default 0,   -- сколько активных заказов со сроками (их моменты не изменились)
  at           timestamptz not null default now()
);
alter table public.ws_timezone_log enable row level security;
revoke all on public.ws_timezone_log from anon, authenticated;

-- Что нужно сайту для ежедневной работы: модули, действующие обязательства, часовой пояс
create or replace function public.ws_daily_get(p_ws uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w public.workspaces%rowtype;
begin
  if not (public.is_member(p_ws) or public.is_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into w from public.workspaces where id = p_ws;
  if not found then raise exception 'forbidden' using errcode = '42501'; end if;
  return json_build_object(
    'shop', w.module_shop,
    'exchange', w.module_exchange,
    -- заявки клиентов (магазин и ссылка) ещё в работе: заказы остаются в разделе «Заказы», но вход в магазин не прячем от них
    'shop_open', (select count(*) from public.orders o where o.workspace_id = p_ws and o.source = 'request' and o.status not in ('delivered', 'cancelled')),
    -- сделки обмена, которые ещё не закрыты, и открытые споры
    'exchange_open', (select count(*) from public.exchange_requests r
                       where r.workspace_id = p_ws and (r.status in ('new', 'paid', 'confirmed', 'sent') or r.dispute = 'open')),
    'time_zone', w.time_zone,
    'time_zone_confirmed_at', w.time_zone_confirmed_at);
end;
$$;
revoke all on function public.ws_daily_get(uuid) from public, anon, authenticated;
grant execute on function public.ws_daily_get(uuid) to authenticated;

create or replace function public.ws_daily_set_modules(p_ws uuid, p_shop boolean, p_exchange boolean)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_shop is null or p_exchange is null then raise exception 'bad_value' using errcode = '22023'; end if;
  update public.workspaces set module_shop = p_shop, module_exchange = p_exchange where id = p_ws;
  return public.ws_daily_get(p_ws);
end;
$$;
revoke all on function public.ws_daily_set_modules(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.ws_daily_set_modules(uuid, boolean, boolean) to authenticated;


-- 3. Смена часового пояса: моменты не двигаются; владелец видит последствия заранее и подтверждает пояс
create or replace function public.ws_timezone_preview(p_ws uuid, p_tz text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_old text;
  v_with int;
  v_shift int;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'bad_timezone' using errcode = '22023'; end if;
  select time_zone into v_old from public.workspaces where id = p_ws;
  select count(*) into v_with from public.orders o
   where o.workspace_id = p_ws and o.status not in ('delivered', 'cancelled')
     and (o.payment_due_at is not null or o.delivery_eta_to is not null);
  select count(*) into v_shift from public.orders o
   where o.workspace_id = p_ws and o.status not in ('delivered', 'cancelled')
     and ((o.payment_due_at is not null and (o.payment_due_at at time zone v_old)::date <> (o.payment_due_at at time zone p_tz)::date)
       or (o.delivery_eta_from is not null and (o.delivery_eta_from at time zone v_old)::date <> (o.delivery_eta_from at time zone p_tz)::date)
       or (o.delivery_eta_to is not null and (o.delivery_eta_to at time zone v_old)::date <> (o.delivery_eta_to at time zone p_tz)::date));
  return json_build_object('old', v_old, 'new', p_tz, 'orders_with_deadlines', v_with, 'date_changes', v_shift);
end;
$$;
revoke all on function public.ws_timezone_preview(uuid, text) from public, anon, authenticated;
grant execute on function public.ws_timezone_preview(uuid, text) to authenticated;

-- заменяет функцию из файла 58: то же имя и параметры; теперь пояс ещё считается подтверждённым и смена попадает в журнал
create or replace function public.ws_set_timezone(p_ws uuid, p_tz text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_old text;
  v_with int;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_tz is null or not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'bad_timezone' using errcode = '22023'; end if;
  select time_zone into v_old from public.workspaces where id = p_ws for update;
  if v_old is distinct from p_tz then
    select count(*) into v_with from public.orders o
     where o.workspace_id = p_ws and o.status not in ('delivered', 'cancelled')
       and (o.payment_due_at is not null or o.delivery_eta_to is not null);
    insert into public.ws_timezone_log (workspace_id, old_zone, new_zone, changed_by, affected) values (p_ws, v_old, p_tz, auth.uid(), v_with);
  end if;
  -- сроки заказов (timestamptz) намеренно НЕ трогаем
  update public.workspaces set time_zone = p_tz, time_zone_confirmed_at = now(), time_zone_confirmed_by = auth.uid() where id = p_ws;
  return p_tz;
end;
$$;
revoke all on function public.ws_set_timezone(uuid, text) from public, anon, authenticated;
grant execute on function public.ws_set_timezone(uuid, text) to authenticated;

-- «Да, этот пояс верный» — без смены пояса
create or replace function public.ws_confirm_timezone(p_ws uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v timestamptz;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.workspaces set time_zone_confirmed_at = now(), time_zone_confirmed_by = auth.uid() where id = p_ws returning time_zone_confirmed_at into v;
  return v;
end;
$$;
revoke all on function public.ws_confirm_timezone(uuid) from public, anon, authenticated;
grant execute on function public.ws_confirm_timezone(uuid) to authenticated;


-- 4. Клиент заказа обязан быть из того же кабинета (файл 56 верил любому client_id). Остальное — как в файле 56.
create or replace function public._orders_link_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pn text;
  v_n  int := 0;
  v_id uuid;
begin
  if new.client_id is not null then
    -- проверка при создании и при смене клиента; прежние данные не мешают обычным правкам заказа
    if (tg_op = 'INSERT' or new.client_id is distinct from old.client_id)
       and not exists (select 1 from public.clients c where c.id = new.client_id and c.workspace_id = new.workspace_id) then
      raise exception 'bad_client' using errcode = '22023';
    end if;
    -- заказ хранит «как записал байер»; клиента из-за этого не переопределяем.
    -- Только клиент без карточки, у которого один этот заказ, обновляется вместе с заказом.
    if tg_op = 'UPDATE' and (new.client_name is distinct from old.client_name or new.client_phone is distinct from old.client_phone) then
      update public.clients c
         set name = public._client_stub_name(new.client_name),
             phone = public.phone_norm(new.client_phone),
             match_phone = public.phone_norm(new.client_phone)
       where c.id = new.client_id and not c.has_card
         and not exists (select 1 from public.orders x where x.client_id = c.id and x.id <> new.id);
    end if;
    return new;
  end if;

  v_pn := public.phone_norm(new.client_phone);
  if v_pn is not null and new.source is distinct from 'request' then
    perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text || '|' || v_pn, 52));
    select count(*), (array_agg(id))[1] into v_n, v_id
      from public.clients where workspace_id = new.workspace_id and match_phone = v_pn;
    if v_n <> 1 then v_id := null; end if;
  end if;
  if v_id is null then
    insert into public.clients (workspace_id, name, phone, match_phone)
    values (new.workspace_id, public._client_stub_name(new.client_name), v_pn, v_pn)
    returning id into v_id;
  end if;
  new.client_id := v_id;
  return new;
end;
$$;
revoke all on function public._orders_link_client() from public, anon, authenticated;


-- ✅ ОТМЕТКА: файл 59 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (59, 'migration_59_daily_work.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
