-- =====================================================
-- ULA FACTORY — миграция 69: команда на заказах (этап 3) — кто ведёт заказ, кто за что отвечает, этапы по шаблону,
-- задержки с корректирующими действиями; сотрудник видит только свои заказы и только нужные ему поля
--
-- ДОСТУП К ЗАКАЗАМ (главное изменение)
--   • Новое право orders.all — «все заказы кабинета». Без него сотрудник НЕ участник кабинета для is_member /
--     my_ws_ids / my_workspace_id: все прежние правила доступа (заказы, клиенты, фото, деньги, обмен, отчёты,
--     функции сайта) его не пускают. Свои заказы он видит только через функции этого файла и только поля своей
--     обязанности. Команда и задачи (team_in) доступны ему как раньше.
--   • Готовая роль «Помощник» получает orders.all — все прежние помощники работают как раньше. «Менеджер операций»
--     получает orders.all и orders.assign. «Закупки», «Контроль качества», «Логистика» — только свои заказы.
--     (Права ролей владелец меняет сам: раздел «Команда» → «Роли».)
--   • orders.assign — назначать людей на заказы, вести шаблоны, видеть сводку задержек.
--
-- КОМАНДА ЗАКАЗА (order_team): обязанности lead (ведущий — один на заказ, это «владелец» заказа), sourcing, qc,
--   logistics, support. Что видит участник с ограниченным доступом:
--     все — номер, статус, этап, товар, количество, сроки, город доставки (ship_to), этапы, задержки, команда;
--     lead — + имя и телефон клиента; sourcing — + поставщик, ссылка, WeChat, цена закупки (юань);
--     logistics — + трек-номер, вес, город и адрес/пункт выдачи клиента.
--   Никогда: цена для клиента, оплачено, курс, доставка в деньгах, прибыль, заметки байера.
--   Что меняет: свои этапы; sourcing — поставщик/ссылка/WeChat; logistics — трек-номер. Статус заказа, цены и вес
--   (от веса зависит сумма клиенту) меняют только люди с доступом ко всем заказам — обычной формой заказа.
--
-- ЭТАПЫ И ШАБЛОНЫ: workflow_templates (в каждом кабинете готовый «Закупка в Китае», 7 шагов) → order_milestones
--   (название, обязанность, срок, статус pending/in_progress/done/delayed/skipped).
-- ЗАДЕРЖКИ: order_report_delay — этап «задержан», новый срок (и сдвиг следующих этапов), запись в order_delays,
--   состояние заказа «задержка» (order_ops), уведомления ведущему, отвечающим за этап, владельцу и тем, кто назначает.
--   Корректирующие действия — задачи команды, привязанные к заказу и задержке (order_delay_action).
--   Всё — во внутренней истории заказа (order_ops_events). Клиенту ничего не показывается и не отправляется.
-- УХОД СОТРУДНИКА: обязанности на открытых заказах переходят тому же человеку, что и задачи (или снимаются).
--
-- Заказы, клиенты и деньги этот файл не меняет. ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 68.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 68) then
    raise exception 'СТОП: сначала запустите файл 68 (задачи команды). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 69) then
    raise exception 'СТОП: файл 69 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Права: + orders.all, orders.assign
create or replace function public.team_perm_catalog()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review', 'orders.all', 'orders.assign']::text[];
$$;
alter table public.ws_roles drop constraint if exists ws_roles_perms_chk;
alter table public.ws_roles add constraint ws_roles_perms_chk
  check (permissions <@ array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review', 'orders.all', 'orders.assign']::text[]);

create or replace function public._team_seed_roles(p_ws uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ws_roles (workspace_id, key, name, permissions, is_system) values
    (p_ws, 'manager',   'Менеджер операций', array['orders.all', 'orders.assign', 'tasks.create', 'tasks.manage', 'tasks.review', 'tasks.view_all', 'team.manage'], true),
    (p_ws, 'sourcing',  'Закупки',           array['tasks.create'], true),
    (p_ws, 'qc',        'Контроль качества', array['tasks.create'], true),
    (p_ws, 'logistics', 'Логистика',         array['tasks.create'], true),
    (p_ws, 'assistant', 'Помощник',          array['orders.all', 'tasks.create'], true)
  on conflict (workspace_id, key) do nothing;
$$;
revoke all on function public._team_seed_roles(uuid) from public, anon, authenticated;

-- уже созданные готовые роли — только при первом запуске (повторный запуск не вернёт права, снятые владельцем)
do $$
begin
  if not exists (select 1 from public.schema_migrations where version = 69) then
    update public.ws_roles
       set permissions = (select array_agg(distinct x order by x) from unnest(permissions || array['orders.all', 'orders.assign']) x)
     where is_system and key = 'manager';
    update public.ws_roles
       set permissions = (select array_agg(distinct x order by x) from unnest(permissions || array['orders.all']) x)
     where is_system and key = 'assistant';
  end if;
end $$;


-- 2. Доступ ко всему кабинету (заказы, клиенты, деньги): владелец и роли с orders.all
create or replace function public._ws_full(p_ws uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id and p.is_active
      left join public.ws_roles r on r.workspace_id = m.workspace_id and r.key = m.role_key
     where m.workspace_id = p_ws and m.user_id = p_user and m.deactivated_at is null
       and (m.role = 'owner' or 'orders.all' = any (coalesce(r.permissions, '{}'::text[]))));
$$;
revoke all on function public._ws_full(uuid, uuid) from public, anon, authenticated;

create or replace function public.is_member(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public._ws_full(p_ws, auth.uid()) or public.admin_editing(p_ws);
$$;
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

create or replace function public.my_ws_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.workspace_id), '{}')
    from public.workspace_members m
   where m.user_id = auth.uid() and public._ws_full(m.workspace_id, auth.uid());
$$;
revoke all on function public.my_ws_ids() from public, anon;
grant execute on function public.my_ws_ids() to authenticated;

create or replace function public.my_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.workspace_id
    from public.workspace_members m
   where m.user_id = auth.uid() and public._ws_full(m.workspace_id, auth.uid())
   order by m.created_at
   limit 1;
$$;

-- Мои кабинеты в команде (для входа): id, название и есть ли доступ ко всем заказам
create or replace function public.my_team_workspaces()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'order_prefix', w.order_prefix,
           'full', public._ws_full(w.id, auth.uid()), 'role', m.role) order by m.created_at), '[]'::jsonb)
    from public.workspace_members m
    join public.workspaces w on w.id = m.workspace_id
    join public.profiles p on p.user_id = m.user_id and p.is_active
   where m.user_id = auth.uid() and m.deactivated_at is null;
$$;
revoke all on function public.my_team_workspaces() from public, anon, authenticated;
grant execute on function public.my_team_workspaces() to authenticated;


-- 3. Таблицы
create table if not exists public.order_team (
  order_id     uuid not null references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  duty         text not null check (duty in ('lead', 'sourcing', 'qc', 'logistics', 'support')),
  assigned_by  uuid references auth.users(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  primary key (order_id, user_id, duty)
);
create unique index if not exists order_team_lead_uidx on public.order_team (order_id) where duty = 'lead';
create index if not exists order_team_user_idx on public.order_team (user_id, workspace_id);

create table if not exists public.workflow_templates (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  steps        jsonb not null check (jsonb_typeof(steps) = 'array'),
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists workflow_templates_name_uidx on public.workflow_templates (workspace_id, lower(btrim(name)));

create table if not exists public.order_milestones (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  position     integer not null default 0,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  duty         text check (duty is null or duty in ('lead', 'sourcing', 'qc', 'logistics', 'support')),
  due_at       timestamptz,
  status       text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'delayed', 'skipped')),
  done_at      timestamptz,
  done_by      uuid references auth.users(id) on delete set null,
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists order_milestones_order_idx on public.order_milestones (order_id, position);
create index if not exists order_milestones_due_idx on public.order_milestones (workspace_id, due_at) where status in ('pending', 'in_progress', 'delayed');

create table if not exists public.order_ops (
  order_id     uuid primary key references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  state        text not null default 'on_track' check (state in ('on_track', 'at_risk', 'delayed')),
  updated_at   timestamptz not null default now()
);

create table if not exists public.order_delays (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  milestone_id uuid references public.order_milestones(id) on delete set null,
  category     text not null check (category in ('supplier', 'quality', 'logistics', 'customs', 'client', 'other')),
  reason       text not null check (char_length(btrim(reason)) between 2 and 1000),
  old_due      timestamptz,
  new_due      timestamptz,
  status       text not null default 'open' check (status in ('open', 'resolved')),
  reported_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references auth.users(id) on delete set null,
  resolution   text check (resolution is null or char_length(resolution) <= 1000)
);
create index if not exists order_delays_order_idx on public.order_delays (order_id, created_at);
create index if not exists order_delays_open_idx on public.order_delays (workspace_id) where status = 'open';

create table if not exists public.order_ops_events (
  id           bigserial primary key,
  order_id     uuid not null references public.orders(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  kind         text not null check (kind ~ '^[a-z_.]{2,40}$'),
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists order_ops_events_order_idx on public.order_ops_events (order_id, id);

-- задачи и уведомления: привязка к заказу и задержке
alter table public.team_tasks add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.team_tasks add column if not exists delay_id uuid references public.order_delays(id) on delete set null;
create index if not exists team_tasks_order_idx on public.team_tasks (order_id) where order_id is not null;
alter table public.team_notifications add column if not exists order_id uuid references public.orders(id) on delete cascade;
alter table public.team_notifications drop constraint if exists team_notifications_kind_check;
alter table public.team_notifications add constraint team_notifications_kind_check
  check (kind in ('assigned', 'unassigned', 'reviewer', 'submitted', 'approved', 'rejected', 'blocked', 'done', 'cancelled', 'reopened',
                  'comment', 'updated', 'handover', 'order_assigned', 'order_unassigned', 'order_delay', 'order_resolved'));

alter table public.order_team         enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.order_milestones   enable row level security;
alter table public.order_ops          enable row level security;
alter table public.order_delays       enable row level security;
alter table public.order_ops_events   enable row level security;
revoke all on public.order_team, public.workflow_templates, public.order_milestones, public.order_ops, public.order_delays, public.order_ops_events
  from anon, authenticated;
revoke all on sequence public.order_ops_events_id_seq from anon, authenticated;


-- 4. Готовый шаблон «Закупка в Китае» (в каждом кабинете; новые кабинеты — триггером)
create or replace function public._wf_seed(p_ws uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.workflow_templates (workspace_id, name, steps, is_system)
  select p_ws, 'Закупка в Китае', '[
      {"title": "Подтвердить заказ с поставщиком", "duty": "sourcing", "days": 2},
      {"title": "Оплатить поставщику", "duty": "sourcing", "days": 3},
      {"title": "Товар готов на фабрике", "duty": "sourcing", "days": 10},
      {"title": "Контроль качества", "duty": "qc", "days": 12},
      {"title": "Упаковка и маркировка", "duty": "qc", "days": 13},
      {"title": "Отправка карго", "duty": "logistics", "days": 14},
      {"title": "Прибытие в пункт назначения", "duty": "logistics", "days": 30}
    ]'::jsonb, true
   where not exists (select 1 from public.workflow_templates where workspace_id = p_ws and is_system);
$$;
revoke all on function public._wf_seed(uuid) from public, anon, authenticated;

create or replace function public._workspaces_seed_wf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._wf_seed(new.id);
  return new;
end;
$$;
revoke all on function public._workspaces_seed_wf() from public, anon, authenticated;
drop trigger if exists workspaces_seed_wf on public.workspaces;
create trigger workspaces_seed_wf after insert on public.workspaces
  for each row execute function public._workspaces_seed_wf();
select public._wf_seed(id) from public.workspaces;

-- шаги шаблона: 1–30 шагов, у каждого название 1–120, обязанность из списка или нет, срок 0–365 дней от начала
create or replace function public._wf_steps_ok(p_steps jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_steps) = 'array' and jsonb_array_length(p_steps) between 1 and 30
     and not exists (
       select 1 from jsonb_array_elements(p_steps) s
        where jsonb_typeof(s) <> 'object'
           or char_length(btrim(coalesce(s->>'title', ''))) not between 1 and 120
           or (s->>'duty' is not null and s->>'duty' not in ('lead', 'sourcing', 'qc', 'logistics', 'support'))
           or coalesce(s->>'days', '') !~ '^[0-9]{1,3}$' or (s->>'days')::int > 365);
$$;
revoke all on function public._wf_steps_ok(jsonb) from public, anon, authenticated;


-- 5. Кто что может с заказом
create or replace function public._order_duties(p_order uuid, p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(t.duty order by t.duty), '{}'::text[])
    from public.order_team t
   where t.order_id = p_order and t.user_id = p_user and public._team_active(t.workspace_id, p_user);
$$;
revoke all on function public._order_duties(uuid, uuid) from public, anon, authenticated;

create or replace function public._order_can_assign(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member(p_ws) and public.team_has_perm(p_ws, 'orders.assign');
$$;
revoke all on function public._order_can_assign(uuid) from public, anon, authenticated;

-- заказ под замком и мой доступ к нему: 'full' (все заказы кабинета) | 'team' (я в команде заказа); иначе «не найден»
create or replace function public._order_lock(p_order uuid, out o public.orders, out access text, out duties text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  duties := public._order_duties(o.id, auth.uid());
  if public.is_member(o.workspace_id) then access := 'full';
  elsif public.team_in(o.workspace_id) and cardinality(duties) > 0 then access := 'team';
  else raise exception 'order_not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public._order_lock(uuid) from public, anon, authenticated;

-- ведущий или назначающий: шаблон, этапы, корректирующие действия, закрытие задержки
create or replace function public._order_can_lead(p_ws uuid, p_duties text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select 'lead' = any (p_duties) or public._order_can_assign(p_ws);
$$;
revoke all on function public._order_can_lead(uuid, text[]) from public, anon, authenticated;

-- поля заказа, которые можно показать: все — общие; остальное — по обязанности (full — как ведущий + все обязанности)
create or replace function public._order_scoped(o public.orders, p_full boolean, p_duties text[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
      'id', o.id, 'workspace_id', o.workspace_id, 'order_number', o.order_number, 'status', o.status, 'track_stage', o.track_stage,
      'order_date', o.order_date, 'product_ru', o.product_ru, 'product_zh', o.product_zh, 'quantity', o.quantity,
      'delivery_eta_from', o.delivery_eta_from, 'delivery_eta_to', o.delivery_eta_to, 'ship_to', o.ship_to, 'created_at', o.created_at)
    || case when p_full or 'lead' = any (p_duties)
         then jsonb_build_object('client_name', o.client_name, 'client_phone', o.client_phone) else '{}'::jsonb end
    || case when p_full or 'sourcing' = any (p_duties)
         then jsonb_build_object('supplier', o.supplier, 'supplier_link', o.supplier_link, 'supplier_wechat', o.supplier_wechat,
                                 'unit_price_cny', o.unit_price_cny, 'purchase_currency', o.purchase_currency) else '{}'::jsonb end
    || case when p_full or 'logistics' = any (p_duties)
         then jsonb_build_object('tracking_number', o.tracking_number, 'weight_kg', o.weight_kg,
                                 'client_city', c.city, 'client_address', c.address, 'pickup_point', c.pickup_point) else '{}'::jsonb end
    from (select 1) x left join public.clients c on c.id = o.client_id;
$$;
revoke all on function public._order_scoped(public.orders, boolean, text[]) from public, anon, authenticated;

create or replace function public._order_event(o public.orders, p_kind text, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.order_ops_events (order_id, workspace_id, actor_id, kind, detail)
  values (o.id, o.workspace_id, auth.uid(), p_kind, coalesce(p_detail, '{}'::jsonb));
$$;
revoke all on function public._order_event(public.orders, text, jsonb) from public, anon, authenticated;

create or replace function public._order_notify(o public.orders, p_users uuid[], p_kind text, p_note text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.team_notifications (workspace_id, user_id, kind, order_id, actor_id, title, note)
  select o.workspace_id, u, p_kind, o.id, auth.uid(), left(o.order_number || ' · ' || coalesce(o.product_ru, ''), 200), left(p_note, 300)
    from (select distinct u from unnest(p_users) u) x
   where u is not null and u is distinct from auth.uid() and public._team_active(o.workspace_id, u);
$$;
revoke all on function public._order_notify(public.orders, uuid[], text, text) from public, anon, authenticated;

-- кому сообщать о проблеме заказа: ведущий + владелец + все, кто назначает людей на заказы
create or replace function public._order_watchers(o public.orders)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct u), '{}') from (
    select t.user_id u from public.order_team t where t.order_id = o.id and t.duty = 'lead'
    union all
    select m.user_id from public.workspace_members m
      left join public.ws_roles r on r.workspace_id = m.workspace_id and r.key = m.role_key
     where m.workspace_id = o.workspace_id and m.deactivated_at is null
       and (m.role = 'owner' or ('orders.assign' = any (coalesce(r.permissions, '{}')) and 'orders.all' = any (coalesce(r.permissions, '{}'))))) s;
$$;
revoke all on function public._order_watchers(public.orders) from public, anon, authenticated;

-- состояние заказа: есть открытая задержка → delayed; есть просроченный этап → at_risk; иначе on_track
create or replace function public._order_ops_refresh(p_order uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_st text;
begin
  select workspace_id into v_ws from public.orders where id = p_order;
  v_st := case
    when exists (select 1 from public.order_delays where order_id = p_order and status = 'open') then 'delayed'
    when exists (select 1 from public.order_milestones where order_id = p_order and status in ('pending', 'in_progress', 'delayed') and due_at < now()) then 'at_risk'
    else 'on_track' end;
  insert into public.order_ops (order_id, workspace_id, state, updated_at) values (p_order, v_ws, v_st, now())
  on conflict (order_id) do update set state = excluded.state, updated_at = now()
   where public.order_ops.state is distinct from excluded.state;
  return v_st;
end;
$$;
revoke all on function public._order_ops_refresh(uuid) from public, anon, authenticated;


-- 6. Карточка заказа для команды
create or replace function public.order_ops_get(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  o      public.orders;
  v_full boolean;
  v_lead boolean;
begin
  select * into r from public._order_lock(p_order);
  o := r.o;
  v_full := r.access = 'full';
  v_lead := public._order_can_lead(o.workspace_id, r.duties);
  perform public._order_ops_refresh(o.id);
  return jsonb_build_object(
    'order', public._order_scoped(o, v_full, r.duties),
    'access', r.access,
    'my_duties', to_jsonb(r.duties),
    'state', (select state from public.order_ops where order_id = o.id),
    'can', jsonb_build_object(
      'assign', public._order_can_assign(o.workspace_id),
      'lead', v_lead,
      'fields', to_jsonb(array_remove(array[
         case when 'sourcing' = any (r.duties) or v_full then 'supplier' end,
         case when 'sourcing' = any (r.duties) or v_full then 'supplier_link' end,
         case when 'sourcing' = any (r.duties) or v_full then 'supplier_wechat' end,
         case when 'logistics' = any (r.duties) or v_full then 'tracking_number' end], null))),
    'team', coalesce((select jsonb_agg(jsonb_build_object('user_id', t.user_id, 'duty', t.duty, 'name', p.full_name,
                                                         'active', public._team_active(t.workspace_id, t.user_id)) order by t.duty, p.full_name)
                        from public.order_team t left join public.profiles p on p.user_id = t.user_id where t.order_id = o.id), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'position', m.position, 'title', m.title, 'duty', m.duty,
                                                               'due_at', m.due_at, 'status', m.status, 'done_at', m.done_at, 'note', m.note,
                                                               'can', v_lead or (m.duty is not null and m.duty = any (r.duties)))
                                             order by m.position, m.created_at)
                              from public.order_milestones m where m.order_id = o.id), '[]'::jsonb),
    'delays', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'milestone_id', d.milestone_id, 'category', d.category, 'reason', d.reason,
                                                           'old_due', d.old_due, 'new_due', d.new_due, 'status', d.status, 'created_at', d.created_at,
                                                           'reported_by', p.full_name, 'reporter_id', d.reported_by, 'resolved_at', d.resolved_at, 'resolution', d.resolution,
                                                           'actions', coalesce((select jsonb_agg(jsonb_build_object('id', tt.id, 'number', tt.number, 'title', tt.title,
                                                                                    'status', tt.status, 'assignee_id', tt.assignee_id, 'due_at', tt.due_at) order by tt.number)
                                                                                  from public.team_tasks tt where tt.delay_id = d.id), '[]'::jsonb))
                                         order by d.created_at desc)
                          from public.order_delays d left join public.profiles p on p.user_id = d.reported_by where d.order_id = o.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(x order by (x->>'id')::bigint) from (
                          select jsonb_build_object('id', e.id, 'kind', e.kind, 'detail', e.detail, 'actor', p.full_name, 'at', e.created_at) x
                            from public.order_ops_events e left join public.profiles p on p.user_id = e.actor_id
                           where e.order_id = o.id order by e.id desc limit 60) s), '[]'::jsonb),
    'templates', case when v_lead then coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name) order by w.is_system desc, w.name)
                                                   from public.workflow_templates w where w.workspace_id = o.workspace_id), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;
revoke all on function public.order_ops_get(uuid) from public, anon, authenticated;
grant execute on function public.order_ops_get(uuid) to authenticated;

-- Список заказов: mine — где я в команде; attention — открытые задержки и просроченные этапы (только с доступом ко всем заказам)
create or replace function public.order_ops_list(p_ws uuid, p_scope text default 'mine')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_full boolean := public.is_member(p_ws);
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_scope not in ('mine', 'attention') then raise exception 'bad_scope' using errcode = '22023'; end if;
  if p_scope = 'attention' and not v_full then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(public._order_scoped(o, v_full, public._order_duties(o.id, v_me)) || jsonb_build_object(
             'my_duties', to_jsonb(public._order_duties(o.id, v_me)),
             'state', coalesce((select s.state from public.order_ops s where s.order_id = o.id), 'on_track'),
             'open_delays', (select count(*) from public.order_delays d where d.order_id = o.id and d.status = 'open'),
             'next', (select jsonb_build_object('title', m.title, 'due_at', m.due_at, 'status', m.status, 'duty', m.duty)
                        from public.order_milestones m where m.order_id = o.id and m.status in ('pending', 'in_progress', 'delayed')
                       order by m.position limit 1),
             'lead', (select p.full_name from public.order_team t join public.profiles p on p.user_id = t.user_id
                       where t.order_id = o.id and t.duty = 'lead'))
           order by o.created_at desc)
      from public.orders o
     where o.id in (
            select o.id from public.orders o
             where o.workspace_id = p_ws
               and case when p_scope = 'mine'
                     then exists (select 1 from public.order_team t where t.order_id = o.id and t.user_id = v_me)
                     else exists (select 1 from public.order_delays d where d.order_id = o.id and d.status = 'open')
                       or exists (select 1 from public.order_milestones m where m.order_id = o.id
                                   and m.status in ('pending', 'in_progress', 'delayed') and m.due_at < now()) end
               and (o.status not in ('delivered', 'cancelled') or o.updated_at > now() - interval '30 days')
             order by o.created_at desc limit 200)), '[]'::jsonb);
end;
$$;
revoke all on function public.order_ops_list(uuid, text) from public, anon, authenticated;
grant execute on function public.order_ops_list(uuid, text) to authenticated;


-- 7. Назначить / снять человека с обязанности на заказе (orders.assign). Ведущий — один: новый заменяет прежнего.
create or replace function public.order_team_set(p_order uuid, p_user uuid, p_duty text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r   record;
  o   public.orders;
  v_old uuid;
begin
  select * into r from public._order_lock(p_order);
  o := r.o;
  if not public._order_can_assign(o.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_duty is null or p_duty not in ('lead', 'sourcing', 'qc', 'logistics', 'support') then raise exception 'bad_duty' using errcode = '22023'; end if;
  if coalesce(p_on, false) then
    if not public._team_active(o.workspace_id, p_user) then raise exception 'bad_assignee' using errcode = 'P0001'; end if;
    if p_duty = 'lead' then
      select user_id into v_old from public.order_team where order_id = o.id and duty = 'lead';
      if v_old = p_user then return; end if;
      delete from public.order_team where order_id = o.id and duty = 'lead';
      if v_old is not null then perform public._order_notify(o, array[v_old], 'order_unassigned', 'lead'); end if;
    end if;
    insert into public.order_team (order_id, workspace_id, user_id, duty, assigned_by)
    values (o.id, o.workspace_id, p_user, p_duty, auth.uid()) on conflict do nothing;
    if found then
      perform public._order_event(o, 'team.add', jsonb_build_object('user_id', p_user, 'duty', p_duty, 'replaced', v_old));
      perform public._order_notify(o, array[p_user], 'order_assigned', p_duty);
    end if;
  else
    delete from public.order_team where order_id = o.id and user_id = p_user and duty = p_duty;
    if found then
      perform public._order_event(o, 'team.remove', jsonb_build_object('user_id', p_user, 'duty', p_duty));
      perform public._order_notify(o, array[p_user], 'order_unassigned', p_duty);
    end if;
  end if;
end;
$$;
revoke all on function public.order_team_set(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.order_team_set(uuid, uuid, text, boolean) to authenticated;


-- 8. Шаблоны этапов
create or replace function public.workflow_templates_list(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'name', w.name, 'steps', w.steps, 'is_system', w.is_system)
                                    order by w.is_system desc, lower(w.name))
                     from public.workflow_templates w where w.workspace_id = p_ws), '[]'::jsonb);
end;
$$;
revoke all on function public.workflow_templates_list(uuid) from public, anon, authenticated;
grant execute on function public.workflow_templates_list(uuid) to authenticated;

create or replace function public.workflow_template_save(p_ws uuid, p_id uuid, p_name text, p_steps jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id   uuid := p_id;
  v_steps jsonb;
begin
  if not public._order_can_assign(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'bad_name' using errcode = '22023'; end if;
  if p_steps is null or not public._wf_steps_ok(p_steps) then raise exception 'bad_steps' using errcode = '22023'; end if;
  -- хранить только нужные поля шага
  select jsonb_agg(jsonb_build_object('title', btrim(s->>'title'), 'duty', s->>'duty', 'days', (s->>'days')::int) order by n)
    into v_steps from jsonb_array_elements(p_steps) with ordinality e(s, n);
  begin
    if v_id is null then
      insert into public.workflow_templates (workspace_id, name, steps) values (p_ws, v_name, v_steps) returning id into v_id;
    else
      update public.workflow_templates set name = v_name, steps = v_steps, updated_at = now() where id = v_id and workspace_id = p_ws;
      if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    end if;
  exception when unique_violation then
    raise exception 'duplicate_name' using errcode = 'P0001';
  end;
  perform public._team_log(p_ws, 'template.save', null, jsonb_build_object('id', v_id, 'name', v_name));
  return v_id;
end;
$$;
revoke all on function public.workflow_template_save(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.workflow_template_save(uuid, uuid, text, jsonb) to authenticated;

create or replace function public.workflow_template_delete(p_ws uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if not public._order_can_assign(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.workflow_templates where id = p_id and workspace_id = p_ws and not is_system returning name into v_name;
  if v_name is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform public._team_log(p_ws, 'template.delete', null, jsonb_build_object('name', v_name));
end;
$$;
revoke all on function public.workflow_template_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.workflow_template_delete(uuid, uuid) to authenticated;

-- Этапы заказа по шаблону. Уже есть этапы — только с p_replace: незавершённые убираются, выполненные остаются.
create or replace function public.order_apply_template(p_order uuid, p_template uuid, p_replace boolean default false)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  o     public.orders;
  v_w   public.workflow_templates;
  v_pos int;
  v_n   int := 0;
  s     jsonb;
begin
  select * into r from public._order_lock(p_order);
  o := r.o;
  if not public._order_can_lead(o.workspace_id, r.duties) then raise exception 'forbidden' using errcode = '42501'; end if;
  if o.status in ('delivered', 'cancelled') then raise exception 'order_closed' using errcode = 'P0001'; end if;
  select * into v_w from public.workflow_templates where id = p_template and workspace_id = o.workspace_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.order_milestones where order_id = o.id) then
    if not coalesce(p_replace, false) then raise exception 'milestones_exist' using errcode = 'P0001'; end if;
    delete from public.order_milestones where order_id = o.id and status not in ('done');
  end if;
  select coalesce(max(position), 0) into v_pos from public.order_milestones where order_id = o.id;
  for s in select * from jsonb_array_elements(v_w.steps) loop
    v_pos := v_pos + 1;
    insert into public.order_milestones (order_id, workspace_id, position, title, duty, due_at)
    values (o.id, o.workspace_id, v_pos, s->>'title', s->>'duty', now() + make_interval(days => (s->>'days')::int));
    v_n := v_n + 1;
  end loop;
  perform public._order_event(o, 'template.apply', jsonb_build_object('name', v_w.name, 'steps', v_n));
  perform public._order_ops_refresh(o.id);
  return v_n;
end;
$$;
revoke all on function public.order_apply_template(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.order_apply_template(uuid, uuid, boolean) to authenticated;


-- 9. Этапы: добавить/изменить/удалить — ведущий или назначающий; отметить статус — ещё и отвечающий за этап
create or replace function public.order_milestone_save(p_order uuid, p_id uuid, p_title text, p_duty text, p_due timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  o       public.orders;
  v_title text := btrim(coalesce(p_title, ''));
  v_id    uuid := p_id;
begin
  select * into r from public._order_lock(p_order);
  o := r.o;
  if not public._order_can_lead(o.workspace_id, r.duties) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_title) not between 1 and 120 then raise exception 'bad_title' using errcode = '22023'; end if;
  if p_duty is not null and p_duty not in ('lead', 'sourcing', 'qc', 'logistics', 'support') then raise exception 'bad_duty' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.order_milestones (order_id, workspace_id, position, title, duty, due_at)
    values (o.id, o.workspace_id, coalesce((select max(position) from public.order_milestones where order_id = o.id), 0) + 1, v_title, p_duty, p_due)
    returning id into v_id;
    perform public._order_event(o, 'milestone.add', jsonb_build_object('title', v_title, 'due_at', p_due));
  else
    update public.order_milestones set title = v_title, duty = p_duty, due_at = p_due, updated_at = now()
     where id = v_id and order_id = o.id;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public._order_event(o, 'milestone.edit', jsonb_build_object('title', v_title, 'due_at', p_due));
  end if;
  perform public._order_ops_refresh(o.id);
  return v_id;
end;
$$;
revoke all on function public.order_milestone_save(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.order_milestone_save(uuid, uuid, text, text, timestamptz) to authenticated;

create or replace function public.order_milestone_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  m public.order_milestones;
begin
  select * into m from public.order_milestones where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into r from public._order_lock(m.order_id);
  if not public._order_can_lead((r.o).workspace_id, r.duties) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.order_milestones where id = p_id;
  perform public._order_event(r.o, 'milestone.delete', jsonb_build_object('title', m.title));
  perform public._order_ops_refresh(m.order_id);
end;
$$;
revoke all on function public.order_milestone_delete(uuid) from public, anon, authenticated;
grant execute on function public.order_milestone_delete(uuid) to authenticated;

create or replace function public.order_milestone_set(p_id uuid, p_status text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  m      public.order_milestones;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
  v_lead boolean;
begin
  select * into m from public.order_milestones where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into r from public._order_lock(m.order_id);
  v_lead := public._order_can_lead((r.o).workspace_id, r.duties);
  if not (v_lead or (m.duty is not null and m.duty = any (r.duties))) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('pending', 'in_progress', 'done', 'skipped') then raise exception 'bad_status' using errcode = '22023'; end if;
  if p_status = 'skipped' and not v_lead then raise exception 'forbidden' using errcode = '42501'; end if;
  -- задержанный этап «в работу» или «выполнен» — только после закрытия задержки
  if m.status = 'delayed' and exists (select 1 from public.order_delays where milestone_id = m.id and status = 'open') and p_status <> 'done' then
    raise exception 'delay_open' using errcode = 'P0001';
  end if;
  update public.order_milestones
     set status = p_status, note = coalesce(v_note, note), updated_at = now(),
         done_at = case when p_status = 'done' then now() end,
         done_by = case when p_status = 'done' then auth.uid() end
   where id = m.id;
  perform public._order_event(r.o, 'milestone.status', jsonb_build_object('title', m.title, 'from', m.status, 'to', p_status, 'note', v_note));
  perform public._order_ops_refresh(m.order_id);
  return p_status;
end;
$$;
revoke all on function public.order_milestone_set(uuid, text, text) from public, anon, authenticated;
grant execute on function public.order_milestone_set(uuid, text, text) to authenticated;


-- 10. Поля заказа, которые меняет сотрудник по своей обязанности (sourcing: поставщик; logistics: трек-номер).
--     Цены, вес, статус и данные клиента здесь не меняются.
create or replace function public.order_ops_fields(p_order uuid, p_fields jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  o     public.orders;
  v_src boolean;
  v_log boolean;
  k     text;
  v_chg jsonb := '{}'::jsonb;
  v     text;
begin
  select * into r from public._order_lock(p_order);
  o := r.o;
  if o.status in ('delivered', 'cancelled') then raise exception 'order_closed' using errcode = 'P0001'; end if;
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then raise exception 'bad_fields' using errcode = '22023'; end if;
  v_src := r.access = 'full' or 'sourcing' = any (r.duties);
  v_log := r.access = 'full' or 'logistics' = any (r.duties);
  for k in select jsonb_object_keys(p_fields) loop
    if k in ('supplier', 'supplier_link', 'supplier_wechat') and not v_src then raise exception 'forbidden' using errcode = '42501'; end if;
    if k = 'tracking_number' and not v_log then raise exception 'forbidden' using errcode = '42501'; end if;
    if k not in ('supplier', 'supplier_link', 'supplier_wechat', 'tracking_number') then raise exception 'bad_fields' using errcode = '22023'; end if;
    v := nullif(btrim(coalesce(p_fields->>k, '')), '');
    if v is not null and char_length(v) > (case when k = 'supplier_link' then 1000 else 200 end) then raise exception 'bad_fields' using errcode = '22023'; end if;
  end loop;
  if p_fields ? 'supplier' then v := nullif(btrim(coalesce(p_fields->>'supplier', '')), '');
    if v is distinct from o.supplier then v_chg := v_chg || jsonb_build_object('supplier', jsonb_build_array(o.supplier, v)); update public.orders set supplier = v where id = o.id; end if; end if;
  if p_fields ? 'supplier_link' then v := nullif(btrim(coalesce(p_fields->>'supplier_link', '')), '');
    if v is distinct from o.supplier_link then v_chg := v_chg || jsonb_build_object('supplier_link', jsonb_build_array(o.supplier_link, v)); update public.orders set supplier_link = v where id = o.id; end if; end if;
  if p_fields ? 'supplier_wechat' then v := nullif(btrim(coalesce(p_fields->>'supplier_wechat', '')), '');
    if v is distinct from o.supplier_wechat then v_chg := v_chg || jsonb_build_object('supplier_wechat', jsonb_build_array(o.supplier_wechat, v)); update public.orders set supplier_wechat = v where id = o.id; end if; end if;
  if p_fields ? 'tracking_number' then v := nullif(btrim(coalesce(p_fields->>'tracking_number', '')), '');
    if v is distinct from o.tracking_number then v_chg := v_chg || jsonb_build_object('tracking_number', jsonb_build_array(o.tracking_number, v)); update public.orders set tracking_number = v where id = o.id; end if; end if;
  if v_chg <> '{}'::jsonb then perform public._order_event(o, 'fields', v_chg); end if;
end;
$$;
revoke all on function public.order_ops_fields(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.order_ops_fields(uuid, jsonb) to authenticated;


-- 11. Задержки
--     Сообщить может любой, кто видит заказ. Этап (если указан) → «задержан» с новым сроком; p_shift — сдвинуть на ту же
--     разницу следующие незавершённые этапы. Состояние заказа → «задержка». Уведомления: ведущий, отвечающие за этап,
--     владелец и назначающие.
create or replace function public.order_report_delay(p_order uuid, p_milestone uuid, p_category text, p_reason text,
                                                     p_new_due timestamptz default null, p_shift boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r        record;
  o        public.orders;
  m        public.order_milestones;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_id     uuid;
  v_delta  interval;
  v_users  uuid[];
begin
  select * into r from public._order_lock(p_order);
  o := r.o;
  if o.status in ('delivered', 'cancelled') then raise exception 'order_closed' using errcode = 'P0001'; end if;
  if p_category is null or p_category not in ('supplier', 'quality', 'logistics', 'customs', 'client', 'other') then raise exception 'bad_category' using errcode = '22023'; end if;
  if char_length(v_reason) not between 2 and 1000 then raise exception 'note_required' using errcode = 'P0001'; end if;
  if p_milestone is not null then
    select * into m from public.order_milestones where id = p_milestone and order_id = o.id for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if m.status in ('done', 'skipped') then raise exception 'milestone_closed' using errcode = 'P0001'; end if;
  end if;

  insert into public.order_delays (order_id, workspace_id, milestone_id, category, reason, old_due, new_due, reported_by)
  values (o.id, o.workspace_id, p_milestone, p_category, v_reason, m.due_at, p_new_due, auth.uid())
  returning id into v_id;

  if p_milestone is not null then
    update public.order_milestones set status = 'delayed', due_at = coalesce(p_new_due, due_at), updated_at = now() where id = m.id;
    if coalesce(p_shift, false) and p_new_due is not null and m.due_at is not null then
      v_delta := p_new_due - m.due_at;
      update public.order_milestones set due_at = due_at + v_delta, updated_at = now()
       where order_id = o.id and position > m.position and status in ('pending', 'in_progress') and due_at is not null;
    end if;
  end if;

  perform public._order_event(o, 'delay.report', jsonb_build_object('delay_id', v_id, 'category', p_category, 'reason', v_reason,
    'milestone', m.title, 'old_due', m.due_at, 'new_due', p_new_due, 'shift', coalesce(p_shift, false)));
  perform public._order_ops_refresh(o.id);
  select array_agg(distinct u) into v_users from (
    select unnest(public._order_watchers(o)) u
    union all select t.user_id from public.order_team t where t.order_id = o.id and m.duty is not null and t.duty = m.duty) s;
  perform public._order_notify(o, v_users, 'order_delay', v_reason);
  return v_id;
end;
$$;
revoke all on function public.order_report_delay(uuid, uuid, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.order_report_delay(uuid, uuid, text, text, timestamptz, boolean) to authenticated;

-- Корректирующее действие = задача команды, привязанная к заказу и задержке (права — как у task_create)
create or replace function public.order_delay_action(p_delay uuid, p_title text, p_assignee uuid, p_due timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d    public.order_delays;
  r    record;
  v_id uuid;
begin
  select * into d from public.order_delays where id = p_delay;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into r from public._order_lock(d.order_id);
  if not public._order_can_lead((r.o).workspace_id, r.duties) then raise exception 'forbidden' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'delay_closed' using errcode = 'P0001'; end if;
  v_id := public.task_create((r.o).workspace_id, p_title, d.reason, p_assignee, null, p_due, 'high', null, null);
  update public.team_tasks set order_id = d.order_id, delay_id = d.id where id = v_id;
  perform public._order_event(r.o, 'delay.action', jsonb_build_object('delay_id', d.id, 'task_id', v_id, 'title', btrim(p_title), 'assignee', p_assignee));
  return v_id;
end;
$$;
revoke all on function public.order_delay_action(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.order_delay_action(uuid, text, uuid, timestamptz) to authenticated;

-- Закрыть задержку (ведущий, назначающий или тот, кто сообщил): этап снова «в работе», состояние пересчитывается
create or replace function public.order_delay_resolve(p_delay uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d      public.order_delays;
  r      record;
  v_note text := btrim(coalesce(p_note, ''));
begin
  select * into d from public.order_delays where id = p_delay;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into r from public._order_lock(d.order_id);
  if not (public._order_can_lead((r.o).workspace_id, r.duties) or coalesce(d.reported_by = auth.uid(), false)) then raise exception 'forbidden' using errcode = '42501'; end if;
  if d.status <> 'open' then raise exception 'delay_closed' using errcode = 'P0001'; end if;
  if char_length(v_note) not between 2 and 1000 then raise exception 'note_required' using errcode = 'P0001'; end if;
  update public.order_delays set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), resolution = v_note where id = d.id;
  if d.milestone_id is not null and not exists (select 1 from public.order_delays where milestone_id = d.milestone_id and status = 'open') then
    update public.order_milestones set status = 'in_progress', updated_at = now() where id = d.milestone_id and status = 'delayed';
  end if;
  perform public._order_event(r.o, 'delay.resolve', jsonb_build_object('delay_id', d.id, 'note', v_note));
  perform public._order_ops_refresh(d.order_id);
  perform public._order_notify(r.o, public._order_watchers(r.o) || d.reported_by, 'order_resolved', v_note);
end;
$$;
revoke all on function public.order_delay_resolve(uuid, text) from public, anon, authenticated;
grant execute on function public.order_delay_resolve(uuid, text) to authenticated;


-- 12. Уход сотрудника: к задачам (файл 68) добавляются обязанности на открытых заказах
do $$
begin
  if to_regprocedure('public._team_handover_tasks(uuid, uuid, uuid)') is null then
    alter function public._team_handover(uuid, uuid, uuid) rename to _team_handover_tasks;
  end if;
end $$;
revoke all on function public._team_handover_tasks(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public._team_handover(p_ws uuid, p_from uuid, p_to uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  t   record;
  o   public.orders;
begin
  v_n := public._team_handover_tasks(p_ws, p_from, p_to);
  for t in
    select ot.* from public.order_team ot join public.orders x on x.id = ot.order_id
     where ot.workspace_id = p_ws and ot.user_id = p_from and x.status not in ('delivered', 'cancelled')
  loop
    select * into o from public.orders where id = t.order_id;
    delete from public.order_team where order_id = t.order_id and user_id = p_from and duty = t.duty;
    if p_to is not null then
      if t.duty = 'lead' then delete from public.order_team where order_id = t.order_id and duty = 'lead'; end if;
      insert into public.order_team (order_id, workspace_id, user_id, duty, assigned_by)
      values (t.order_id, p_ws, p_to, t.duty, auth.uid()) on conflict do nothing;
      perform public._order_notify(o, array[p_to], 'order_assigned', t.duty);
    end if;
    perform public._order_event(o, 'team.handover', jsonb_build_object('from', p_from, 'to', p_to, 'duty', t.duty));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public._team_handover(uuid, uuid, uuid) from public, anon, authenticated;


-- 13. Уведомления и задачи: номер заказа рядом (файл 68 + привязка к заказу)
create or replace function public.team_notif_list(p_ws uuid, p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by (x->>'id')::bigint desc) from (
      select jsonb_build_object('id', n.id, 'kind', n.kind, 'task_id', n.task_id, 'task_number', t.number, 'order_id', n.order_id,
                                'title', n.title, 'note', n.note, 'actor', p.full_name, 'at', n.created_at, 'read', n.read_at is not null) x
        from public.team_notifications n
        left join public.team_tasks t on t.id = n.task_id
        left join public.profiles p on p.user_id = n.actor_id
       where n.workspace_id = p_ws and n.user_id = v_me
       order by n.id desc
       limit least(greatest(coalesce(p_limit, 30), 1), 100)) s), '[]'::jsonb);
end;
$$;

create or replace function public._task_json(t public.team_tasks)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id, 'number', t.number, 'title', t.title, 'description', t.description, 'status', t.status, 'priority', t.priority,
    'due_at', t.due_at, 'department_id', t.department_id, 'assignee_id', t.assignee_id, 'reviewer_id', t.reviewer_id,
    'created_by', t.created_by, 'created_at', t.created_at, 'updated_at', t.updated_at, 'started_at', t.started_at,
    'submitted_at', t.submitted_at, 'completed_at', t.completed_at, 'completed_by', t.completed_by,
    'order_id', t.order_id, 'delay_id', t.delay_id,
    'order_number', (select o.order_number from public.orders o where o.id = t.order_id),
    'items_total', (select count(*) from public.team_task_items i where i.task_id = t.id),
    'items_done',  (select count(*) from public.team_task_items i where i.task_id = t.id and i.done),
    'comments',    (select count(*) from public.team_task_comments c where c.task_id = t.id));
$$;
revoke all on function public._task_json(public.team_tasks) from public, anon, authenticated;

-- счётчики: + мои заказы с задержкой или просроченным этапом
create or replace function public.task_counts(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mine',    (select count(*) from public.team_tasks where workspace_id = p_ws and assignee_id = v_me and status in ('todo', 'in_progress', 'blocked')),
    'overdue', (select count(*) from public.team_tasks where workspace_id = p_ws and assignee_id = v_me and status in ('todo', 'in_progress', 'blocked') and due_at < now()),
    'review',  (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.status = 'submitted' and public._task_can_review(t)),
    'unread',  (select count(*) from public.team_notifications where workspace_id = p_ws and user_id = v_me and read_at is null),
    'orders',  (select count(distinct t.order_id) from public.order_team t join public.orders o on o.id = t.order_id
                 where t.workspace_id = p_ws and t.user_id = v_me and o.status not in ('delivered', 'cancelled')),
    'alerts',  case when public.is_member(p_ws) then
                 (select count(*) from public.order_delays d join public.orders o on o.id = d.order_id
                   where d.workspace_id = p_ws and d.status = 'open' and o.status not in ('delivered', 'cancelled')) else 0 end,
    'full',    public.is_member(p_ws));
end;
$$;


-- ✅ ОТМЕТКА: файл 69 запущен
insert into public.schema_migrations (version, name) values (69, 'migration_69_order_team.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
