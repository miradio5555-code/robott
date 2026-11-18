-- =====================================================
-- ULA FACTORY — миграция 70: операционный контроль (этап 4) — регламенты (SOP), инциденты, календарь, сводка
--
--   • Права: + ops.manage (регламенты и инциденты: вести, назначать, закрывать) и reports.view (аналитика команды,
--     файл 71). «Менеджер операций» получает оба.
--   • РЕГЛАМЕНТЫ (team_sops): черновик → опубликован → в архиве. Каждое изменение текста сохраняет прежнюю версию
--     (team_sop_versions) — ничего не меняется молча. Сотрудник отмечает «прочитал текущую версию» (team_sop_acks),
--     ведущий регламенты видит, кто не прочитал. Черновики и архив видит только ops.manage.
--   • ИНЦИДЕНТЫ (team_incidents): номер, важность, категория, связанный заказ, ответственный, статус
--     open → investigating → resolved → closed. «Решён» — только с причиной и решением; «закрыт» — только ops.manage.
--     Корректирующие действия — задачи команды (team_tasks.incident_id). Всё — в истории инцидента.
--     Видят: доступ ко всем заказам или ops.manage — все; иначе — свои (сообщил / ответственный) и по заказам,
--     где человек в команде.
--   • КАЛЕНДАРЬ: события команды (team_events) + сроки задач, этапы заказов, инциденты — только то, что человеку видно.
--   • СВОДКА (ops_dashboard): заказы по состоянию, задержки по причинам, просроченные этапы, задачи, инциденты,
--     загрузка каждого сотрудника, прочтение регламентов. Только с доступом ко всем заказам.
-- Заказы, клиенты и деньги этот файл не меняет. Клиенту ничего не показывается и не отправляется.
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 69. Одной транзакцией; повторный запуск безопасен.
-- =====================================================
begin;

do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 69) then
    raise exception 'СТОП: сначала запустите файл 69 (команда на заказах). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 70) then
    raise exception 'СТОП: файл 70 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Права
create or replace function public.team_perm_catalog()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review', 'orders.all', 'orders.assign',
               'ops.manage', 'reports.view']::text[];
$$;
alter table public.ws_roles drop constraint if exists ws_roles_perms_chk;
alter table public.ws_roles add constraint ws_roles_perms_chk
  check (permissions <@ array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review', 'orders.all', 'orders.assign',
                              'ops.manage', 'reports.view']::text[]);

create or replace function public._team_seed_roles(p_ws uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ws_roles (workspace_id, key, name, permissions, is_system) values
    (p_ws, 'manager',   'Менеджер операций', array['ops.manage', 'orders.all', 'orders.assign', 'reports.view', 'tasks.create', 'tasks.manage', 'tasks.review', 'tasks.view_all', 'team.manage'], true),
    (p_ws, 'sourcing',  'Закупки',           array['tasks.create'], true),
    (p_ws, 'qc',        'Контроль качества', array['tasks.create'], true),
    (p_ws, 'logistics', 'Логистика',         array['tasks.create'], true),
    (p_ws, 'assistant', 'Помощник',          array['orders.all', 'tasks.create'], true)
  on conflict (workspace_id, key) do nothing;
$$;
revoke all on function public._team_seed_roles(uuid) from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from public.schema_migrations where version = 70) then
    update public.ws_roles
       set permissions = (select array_agg(distinct x order by x) from unnest(permissions || array['ops.manage', 'reports.view']) x)
     where is_system and key = 'manager';
  end if;
end $$;

create or replace function public._ops_manage(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.team_in(p_ws) and public.team_has_perm(p_ws, 'ops.manage');
$$;
revoke all on function public._ops_manage(uuid) from public, anon, authenticated;


-- 2. Таблицы
create table if not exists public.team_sops (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  category     text check (category is null or char_length(category) between 1 and 60),
  duty         text check (duty is null or duty in ('lead', 'sourcing', 'qc', 'logistics', 'support')),
  body         text not null check (char_length(body) between 1 and 20000),
  status       text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  version      integer not null default 1,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index if not exists team_sops_ws_idx on public.team_sops (workspace_id, status);

create table if not exists public.team_sop_versions (
  id         bigserial primary key,
  sop_id     uuid not null references public.team_sops(id) on delete cascade,
  version    integer not null,
  title      text not null,
  body       text not null,
  edited_by  uuid references auth.users(id) on delete set null,
  edited_at  timestamptz not null default now(),
  unique (sop_id, version)
);

create table if not exists public.team_sop_acks (
  sop_id   uuid not null references public.team_sops(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  version  integer not null,
  acked_at timestamptz not null default now(),
  primary key (sop_id, user_id)
);

create table if not exists public.team_incidents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  number       integer not null,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  description  text check (description is null or char_length(description) <= 4000),
  severity     text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  category     text not null default 'other' check (category in ('supplier', 'quality', 'logistics', 'customs', 'client', 'finance', 'safety', 'other')),
  status       text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'closed')),
  order_id     uuid references public.orders(id) on delete set null,
  owner_id     uuid references auth.users(id) on delete set null,
  reported_by  uuid references auth.users(id) on delete set null,
  root_cause   text check (root_cause is null or char_length(root_cause) <= 2000),
  resolution   text check (resolution is null or char_length(resolution) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  closed_at    timestamptz,
  unique (workspace_id, number)
);
create index if not exists team_incidents_ws_idx on public.team_incidents (workspace_id, status);

create table if not exists public.team_incident_events (
  id          bigserial primary key,
  incident_id uuid not null references public.team_incidents(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('created', 'status', 'owner', 'severity', 'comment', 'action')),
  from_value  text,
  to_value    text,
  note        text check (note is null or char_length(note) <= 2000),
  created_at  timestamptz not null default now()
);
create index if not exists team_incident_events_idx on public.team_incident_events (incident_id, id);

create table if not exists public.team_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  note         text check (note is null or char_length(note) <= 1000),
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists team_events_ws_idx on public.team_events (workspace_id, starts_at);

alter table public.team_tasks add column if not exists incident_id uuid references public.team_incidents(id) on delete set null;
alter table public.team_notifications drop constraint if exists team_notifications_kind_check;
alter table public.team_notifications add constraint team_notifications_kind_check
  check (kind in ('assigned', 'unassigned', 'reviewer', 'submitted', 'approved', 'rejected', 'blocked', 'done', 'cancelled', 'reopened',
                  'comment', 'updated', 'handover', 'order_assigned', 'order_unassigned', 'order_delay', 'order_resolved',
                  'incident_new', 'incident_owner', 'incident_status', 'sop_published'));
alter table public.team_notifications add column if not exists incident_id uuid references public.team_incidents(id) on delete cascade;
alter table public.team_notifications add column if not exists sop_id uuid references public.team_sops(id) on delete cascade;

alter table public.team_sops            enable row level security;
alter table public.team_sop_versions    enable row level security;
alter table public.team_sop_acks        enable row level security;
alter table public.team_incidents       enable row level security;
alter table public.team_incident_events enable row level security;
alter table public.team_events          enable row level security;
revoke all on public.team_sops, public.team_sop_versions, public.team_sop_acks, public.team_incidents, public.team_incident_events, public.team_events
  from anon, authenticated;
revoke all on sequence public.team_sop_versions_id_seq, public.team_incident_events_id_seq from anon, authenticated;

-- кто ведёт операции: владелец + действующие с ops.manage (для уведомлений)
create or replace function public._ops_managers(p_ws uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.user_id), '{}') from public.workspace_members m
    left join public.ws_roles r on r.workspace_id = m.workspace_id and r.key = m.role_key
   where m.workspace_id = p_ws and m.deactivated_at is null
     and (m.role = 'owner' or 'ops.manage' = any (coalesce(r.permissions, '{}')));
$$;
revoke all on function public._ops_managers(uuid) from public, anon, authenticated;

create or replace function public._ops_notify(p_ws uuid, p_users uuid[], p_kind text, p_title text, p_note text, p_incident uuid, p_sop uuid, p_order uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.team_notifications (workspace_id, user_id, kind, actor_id, title, note, incident_id, sop_id, order_id)
  select p_ws, u, p_kind, auth.uid(), left(p_title, 200), left(p_note, 300), p_incident, p_sop, p_order
    from (select distinct u from unnest(p_users) u) x
   where u is not null and u is distinct from auth.uid() and public._team_active(p_ws, u);
$$;
revoke all on function public._ops_notify(uuid, uuid[], text, text, text, uuid, uuid, uuid) from public, anon, authenticated;


-- 3. Регламенты
create or replace function public.sop_list(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_man boolean := public._ops_manage(p_ws);
  v_n   int;
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*) into v_n from public.workspace_members where workspace_id = p_ws and deactivated_at is null;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'title', s.title, 'category', s.category, 'duty', s.duty, 'status', s.status, 'version', s.version, 'updated_at', s.updated_at,
      'my_ack', (select a.version from public.team_sop_acks a where a.sop_id = s.id and a.user_id = v_me),
      'acked', case when v_man then (select count(*) from public.team_sop_acks a join public.workspace_members m on m.user_id = a.user_id and m.workspace_id = p_ws and m.deactivated_at is null
                                      where a.sop_id = s.id and a.version = s.version) end,
      'members', case when v_man then v_n end)
    order by (s.status = 'published') desc, s.category nulls last, lower(s.title))
    from public.team_sops s where s.workspace_id = p_ws and (s.status = 'published' or v_man)), '[]'::jsonb);
end;
$$;
revoke all on function public.sop_list(uuid) from public, anon, authenticated;
grant execute on function public.sop_list(uuid) to authenticated;

create or replace function public.sop_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s     public.team_sops;
  v_man boolean;
begin
  select * into s from public.team_sops where id = p_id;
  if not found or not public.team_in(s.workspace_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_man := public._ops_manage(s.workspace_id);
  if s.status <> 'published' and not v_man then raise exception 'not_found' using errcode = 'P0002'; end if;
  return to_jsonb(s) - 'created_by' - 'updated_by' || jsonb_build_object(
    'can_edit', v_man,
    'my_ack', (select a.version from public.team_sop_acks a where a.sop_id = s.id and a.user_id = auth.uid()),
    'updated_by_name', (select full_name from public.profiles where user_id = s.updated_by),
    'versions', case when v_man then coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'title', v.title, 'body', v.body,
                    'edited_at', v.edited_at, 'by', p.full_name) order by v.version desc)
                    from public.team_sop_versions v left join public.profiles p on p.user_id = v.edited_by where v.sop_id = s.id), '[]'::jsonb) else '[]'::jsonb end,
    'acks', case when v_man then coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.full_name,
                    'version', a.version, 'at', a.acked_at) order by p.full_name)
                    from public.workspace_members m join public.profiles p on p.user_id = m.user_id
                    left join public.team_sop_acks a on a.sop_id = s.id and a.user_id = m.user_id
                   where m.workspace_id = s.workspace_id and m.deactivated_at is null), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;
revoke all on function public.sop_get(uuid) from public, anon, authenticated;
grant execute on function public.sop_get(uuid) to authenticated;

-- Сохранить: новый текст или название → прежняя версия в историю, номер версии +1 (отметки «прочитал» остаются у старой версии)
create or replace function public.sop_save(p_ws uuid, p_id uuid, p_title text, p_category text, p_duty text, p_body text, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s       public.team_sops;
  v_title text := btrim(coalesce(p_title, ''));
  v_cat   text := nullif(left(btrim(coalesce(p_category, '')), 60), '');
  v_body  text := coalesce(p_body, '');
  v_st    text := coalesce(p_status, 'draft');
  v_id    uuid := p_id;
begin
  if not public._ops_manage(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_title) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
  if char_length(btrim(v_body)) = 0 or char_length(v_body) > 20000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if v_st not in ('draft', 'published', 'archived') then raise exception 'bad_status' using errcode = '22023'; end if;
  if p_duty is not null and p_duty not in ('lead', 'sourcing', 'qc', 'logistics', 'support') then raise exception 'bad_duty' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.team_sops (workspace_id, title, category, duty, body, status, created_by, updated_by)
    values (p_ws, v_title, v_cat, p_duty, v_body, v_st, auth.uid(), auth.uid()) returning * into s;
    v_id := s.id;
  else
    select * into s from public.team_sops where id = v_id and workspace_id = p_ws for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if v_title is distinct from s.title or v_body is distinct from s.body then
      insert into public.team_sop_versions (sop_id, version, title, body, edited_by, edited_at)
      values (s.id, s.version, s.title, s.body, s.updated_by, s.updated_at) on conflict do nothing;
      update public.team_sops set version = version + 1 where id = s.id;
    end if;
    update public.team_sops set title = v_title, category = v_cat, duty = p_duty, body = v_body, status = v_st, updated_by = auth.uid(), updated_at = now()
     where id = s.id;
  end if;
  perform public._team_log(p_ws, 'sop.save', null, jsonb_build_object('id', v_id, 'name', v_title, 'status', v_st));
  if v_st = 'published' and (s.status is distinct from 'published' or v_title is distinct from s.title or v_body is distinct from s.body) then
    perform public._ops_notify(p_ws, (select array_agg(m.user_id) from public.workspace_members m where m.workspace_id = p_ws and m.deactivated_at is null),
                               'sop_published', v_title, null, null, v_id, null);
  end if;
  return v_id;
end;
$$;
revoke all on function public.sop_save(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sop_save(uuid, uuid, text, text, text, text, text) to authenticated;

create or replace function public.sop_ack(p_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.team_sops;
begin
  select * into s from public.team_sops where id = p_id;
  if not found or not public.team_in(s.workspace_id) or s.status <> 'published' then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into public.team_sop_acks (sop_id, user_id, version) values (s.id, auth.uid(), s.version)
  on conflict (sop_id, user_id) do update set version = excluded.version, acked_at = now();
  return s.version;
end;
$$;
revoke all on function public.sop_ack(uuid) from public, anon, authenticated;
grant execute on function public.sop_ack(uuid) to authenticated;


-- 4. Инциденты
create or replace function public._incident_can_view(i public.team_incidents)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- coalesce: пустой ответственный даёт NULL, а NULL в «if not …» не запрещает — поэтому явно false
  select coalesce(auth.uid() is not null and public.team_in(i.workspace_id) and (
       public.is_member(i.workspace_id) or public._ops_manage(i.workspace_id)
    or auth.uid() in (i.reported_by, i.owner_id)
    or (i.order_id is not null and exists (select 1 from public.order_team t where t.order_id = i.order_id and t.user_id = auth.uid()))), false);
$$;
revoke all on function public._incident_can_view(public.team_incidents) from public, anon, authenticated;

create or replace function public._incident_lock(p_id uuid)
returns public.team_incidents
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.team_incidents;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into i from public.team_incidents where id = p_id for update;
  if not found or not public._incident_can_view(i) then raise exception 'not_found' using errcode = 'P0002'; end if;
  return i;
end;
$$;
revoke all on function public._incident_lock(uuid) from public, anon, authenticated;

create or replace function public._incident_event(p_id uuid, p_kind text, p_from text, p_to text, p_note text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.team_incident_events (incident_id, actor_id, kind, from_value, to_value, note) values (p_id, auth.uid(), p_kind, p_from, p_to, left(p_note, 2000));
$$;
revoke all on function public._incident_event(uuid, text, text, text, text) from public, anon, authenticated;

-- Сообщить об инциденте: любой в команде. Заказ — только тот, что человеку виден. Уведомления — ведущим операции и ответственному.
create or replace function public.incident_create(p_ws uuid, p_title text, p_description text, p_severity text, p_category text, p_order uuid, p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_desc  text := nullif(btrim(coalesce(p_description, '')), '');
  v_num   int;
  i       public.team_incidents;
begin
  if auth.uid() is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_title) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
  if v_desc is not null and char_length(v_desc) > 4000 then raise exception 'bad_description' using errcode = '22023'; end if;
  if coalesce(p_severity, '') not in ('low', 'medium', 'high', 'critical') then raise exception 'bad_severity' using errcode = '22023'; end if;
  if coalesce(p_category, '') not in ('supplier', 'quality', 'logistics', 'customs', 'client', 'finance', 'safety', 'other') then raise exception 'bad_category' using errcode = '22023'; end if;
  if p_order is not null and not exists (select 1 from public.orders o where o.id = p_order and o.workspace_id = p_ws
       and (public.is_member(p_ws) or exists (select 1 from public.order_team t where t.order_id = o.id and t.user_id = auth.uid()))) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if p_owner is not null and not public._team_active(p_ws, p_owner) then raise exception 'bad_assignee' using errcode = 'P0001'; end if;
  if p_owner is not null and p_owner <> auth.uid() and not public._ops_manage(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtext('team_incidents:' || p_ws::text));
  select coalesce(max(number), 0) + 1 into v_num from public.team_incidents where workspace_id = p_ws;
  insert into public.team_incidents (workspace_id, number, title, description, severity, category, order_id, owner_id, reported_by)
  values (p_ws, v_num, v_title, v_desc, p_severity, p_category, p_order, p_owner, auth.uid()) returning * into i;
  perform public._incident_event(i.id, 'created', null, 'open', null);
  perform public._ops_notify(p_ws, public._ops_managers(p_ws) || p_owner, 'incident_new', v_title, p_severity, i.id, null, p_order);
  if p_order is not null then
    perform public._order_event(o, 'incident', jsonb_build_object('incident_id', i.id, 'number', v_num, 'title', v_title))
       from public.orders o where o.id = p_order;
  end if;
  return i.id;
end;
$$;
revoke all on function public.incident_create(uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.incident_create(uuid, text, text, text, text, uuid, uuid) to authenticated;

create or replace function public._incident_json(i public.team_incidents)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', i.id, 'number', i.number, 'title', i.title, 'description', i.description, 'severity', i.severity,
    'category', i.category, 'status', i.status, 'order_id', i.order_id,
    'order_number', (select o.order_number from public.orders o where o.id = i.order_id),
    'owner_id', i.owner_id, 'reported_by', i.reported_by, 'root_cause', i.root_cause, 'resolution', i.resolution,
    'created_at', i.created_at, 'updated_at', i.updated_at, 'resolved_at', i.resolved_at, 'closed_at', i.closed_at,
    'actions_open', (select count(*) from public.team_tasks t where t.incident_id = i.id and t.status not in ('done', 'cancelled')));
$$;
revoke all on function public._incident_json(public.team_incidents) from public, anon, authenticated;

create or replace function public.incident_list(p_ws uuid, p_scope text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_scope not in ('open', 'all') then raise exception 'bad_scope' using errcode = '22023'; end if;
  return coalesce((select jsonb_agg(public._incident_json(i) order by (i.status in ('resolved', 'closed')),
                                     case i.severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, i.number desc)
                     from public.team_incidents i
                    where i.workspace_id = p_ws and public._incident_can_view(i)
                      and (p_scope = 'all' and i.created_at > now() - interval '180 days' or i.status in ('open', 'investigating'))), '[]'::jsonb);
end;
$$;
revoke all on function public.incident_list(uuid, text) from public, anon, authenticated;
grant execute on function public.incident_list(uuid, text) to authenticated;

create or replace function public.incident_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  i   public.team_incidents;
  v_m boolean;
begin
  select * into i from public.team_incidents where id = p_id;
  if not found or not public._incident_can_view(i) then raise exception 'not_found' using errcode = 'P0002'; end if;
  v_m := public._ops_manage(i.workspace_id);
  return public._incident_json(i) || jsonb_build_object(
    'can', jsonb_build_object('manage', v_m, 'work', v_m or coalesce(i.owner_id = auth.uid(), false), 'close', v_m),
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'from', e.from_value, 'to', e.to_value, 'note', e.note,
                                         'actor', p.full_name, 'at', e.created_at) order by e.id)
                          from public.team_incident_events e left join public.profiles p on p.user_id = e.actor_id where e.incident_id = i.id), '[]'::jsonb),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'number', t.number, 'title', t.title, 'status', t.status, 'assignee_id', t.assignee_id) order by t.number)
                           from public.team_tasks t where t.incident_id = i.id), '[]'::jsonb));
end;
$$;
revoke all on function public.incident_get(uuid) from public, anon, authenticated;
grant execute on function public.incident_get(uuid) to authenticated;

-- Статус: расследование/решён — ответственный или ops.manage; «решён» — с причиной и решением; закрыть/вернуть — ops.manage
create or replace function public.incident_set_status(p_id uuid, p_status text, p_note text default null, p_root_cause text default null, p_resolution text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  i      public.team_incidents := public._incident_lock(p_id);
  v_m    boolean := public._ops_manage(i.workspace_id);
  v_work boolean := v_m or coalesce(i.owner_id = auth.uid(), false);
  v_rc   text := nullif(btrim(coalesce(p_root_cause, '')), '');
  v_res  text := nullif(btrim(coalesce(p_resolution, '')), '');
  v_old  text := i.status;
begin
  if p_status = v_old then return v_old; end if;
  if p_status = 'investigating' and v_old in ('open', 'resolved') then
    if not v_work then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif p_status = 'resolved' and v_old in ('open', 'investigating') then
    if not v_work then raise exception 'forbidden' using errcode = '42501'; end if;
    if coalesce(v_rc, i.root_cause) is null or coalesce(v_res, i.resolution) is null then raise exception 'resolution_required' using errcode = 'P0001'; end if;
    if exists (select 1 from public.team_tasks t where t.incident_id = i.id and t.status not in ('done', 'cancelled')) then
      raise exception 'actions_open' using errcode = 'P0001';
    end if;
  elsif p_status = 'closed' and v_old = 'resolved' then
    if not v_m then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif p_status = 'investigating' and v_old = 'closed' then
    if not v_m then raise exception 'forbidden' using errcode = '42501'; end if;
  else
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;
  if v_rc is not null and char_length(v_rc) > 2000 or v_res is not null and char_length(v_res) > 2000 then raise exception 'bad_note' using errcode = '22023'; end if;
  update public.team_incidents
     set status = p_status, updated_at = now(),
         root_cause = coalesce(v_rc, root_cause), resolution = coalesce(v_res, resolution),
         resolved_at = case when p_status = 'resolved' then now() when p_status = 'investigating' then null else resolved_at end,
         closed_at = case when p_status = 'closed' then now() when p_status = 'investigating' then null else closed_at end
   where id = i.id;
  perform public._incident_event(i.id, 'status', v_old, p_status, coalesce(nullif(btrim(coalesce(p_note, '')), ''), v_res));
  perform public._ops_notify(i.workspace_id, public._ops_managers(i.workspace_id) || i.owner_id || i.reported_by, 'incident_status', i.title, p_status, i.id, null, i.order_id);
  return p_status;
end;
$$;
revoke all on function public.incident_set_status(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.incident_set_status(uuid, text, text, text, text) to authenticated;

create or replace function public.incident_update(p_id uuid, p_owner uuid, p_severity text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.team_incidents := public._incident_lock(p_id);
begin
  if not public._ops_manage(i.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if i.status = 'closed' then raise exception 'incident_closed' using errcode = 'P0001'; end if;
  if p_owner is not null and not public._team_active(i.workspace_id, p_owner) then raise exception 'bad_assignee' using errcode = 'P0001'; end if;
  if coalesce(p_severity, '') not in ('low', 'medium', 'high', 'critical') then raise exception 'bad_severity' using errcode = '22023'; end if;
  if p_owner is distinct from i.owner_id then
    update public.team_incidents set owner_id = p_owner, updated_at = now() where id = i.id;
    perform public._incident_event(i.id, 'owner', i.owner_id::text, p_owner::text, null);
    perform public._ops_notify(i.workspace_id, array[p_owner], 'incident_owner', i.title, null, i.id, null, i.order_id);
  end if;
  if p_severity is distinct from i.severity then
    update public.team_incidents set severity = p_severity, updated_at = now() where id = i.id;
    perform public._incident_event(i.id, 'severity', i.severity, p_severity, null);
  end if;
end;
$$;
revoke all on function public.incident_update(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.incident_update(uuid, uuid, text) to authenticated;

create or replace function public.incident_comment(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i      public.team_incidents := public._incident_lock(p_id);
  v_note text := btrim(coalesce(p_note, ''));
begin
  if char_length(v_note) not between 1 and 2000 then raise exception 'bad_comment' using errcode = '22023'; end if;
  perform public._incident_event(i.id, 'comment', null, null, v_note);
  update public.team_incidents set updated_at = now() where id = i.id;
end;
$$;
revoke all on function public.incident_comment(uuid, text) from public, anon, authenticated;
grant execute on function public.incident_comment(uuid, text) to authenticated;

-- Корректирующее действие — задача команды, привязанная к инциденту (и его заказу)
create or replace function public.incident_action(p_id uuid, p_title text, p_assignee uuid, p_due timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  i    public.team_incidents := public._incident_lock(p_id);
  v_id uuid;
begin
  if not (public._ops_manage(i.workspace_id) or coalesce(i.owner_id = auth.uid(), false)) then raise exception 'forbidden' using errcode = '42501'; end if;
  if i.status in ('resolved', 'closed') then raise exception 'incident_closed' using errcode = 'P0001'; end if;
  v_id := public.task_create(i.workspace_id, p_title, i.title, p_assignee, null, p_due, case when i.severity in ('high', 'critical') then 'urgent' else 'high' end, null, null);
  update public.team_tasks set incident_id = i.id, order_id = coalesce(order_id, i.order_id) where id = v_id;
  perform public._incident_event(i.id, 'action', null, v_id::text, btrim(p_title));
  return v_id;
end;
$$;
revoke all on function public.incident_action(uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.incident_action(uuid, text, uuid, timestamptz) to authenticated;


-- 5. События календаря: создать может любой в команде; менять и удалять — автор или ops.manage
create or replace function public.event_save(p_ws uuid, p_id uuid, p_title text, p_starts timestamptz, p_ends timestamptz, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_id    uuid := p_id;
  e       public.team_events;
begin
  if auth.uid() is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_title) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
  if p_starts is null or (p_ends is not null and p_ends < p_starts) then raise exception 'bad_dates' using errcode = '22023'; end if;
  if v_id is null then
    insert into public.team_events (workspace_id, title, starts_at, ends_at, note, created_by)
    values (p_ws, v_title, p_starts, p_ends, nullif(left(btrim(coalesce(p_note, '')), 1000), ''), auth.uid()) returning id into v_id;
  else
    select * into e from public.team_events where id = v_id and workspace_id = p_ws for update;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    if e.created_by is distinct from auth.uid() and not public._ops_manage(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
    update public.team_events set title = v_title, starts_at = p_starts, ends_at = p_ends, note = nullif(left(btrim(coalesce(p_note, '')), 1000), '') where id = v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.event_save(uuid, uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.event_save(uuid, uuid, text, timestamptz, timestamptz, text) to authenticated;

create or replace function public.event_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.team_events;
begin
  select * into e from public.team_events where id = p_id;
  if not found or not public.team_in(e.workspace_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if e.created_by is distinct from auth.uid() and not public._ops_manage(e.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.team_events where id = p_id;
end;
$$;
revoke all on function public.event_delete(uuid) from public, anon, authenticated;
grant execute on function public.event_delete(uuid) to authenticated;

-- Календарь за период (не больше 92 дней): события, сроки задач, этапы заказов, инциденты — только видимое
create or replace function public.ops_calendar(p_ws uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_full boolean := public.is_member(p_ws);
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > interval '92 days' then raise exception 'bad_dates' using errcode = '22023'; end if;
  return coalesce((select jsonb_agg(x order by x->>'at') from (
      select jsonb_build_object('kind', 'event', 'id', e.id, 'title', e.title, 'at', e.starts_at, 'end', e.ends_at, 'note', e.note,
                                'mine', e.created_by = v_me) x
        from public.team_events e where e.workspace_id = p_ws and e.starts_at < p_to and coalesce(e.ends_at, e.starts_at) >= p_from
      union all
      select jsonb_build_object('kind', 'task', 'id', t.id, 'title', t.title, 'at', t.due_at, 'status', t.status, 'number', t.number,
                                'mine', t.assignee_id = v_me)
        from public.team_tasks t where t.workspace_id = p_ws and t.due_at >= p_from and t.due_at < p_to and t.status not in ('cancelled')
         and public._task_can_view(t)
      union all
      select jsonb_build_object('kind', 'milestone', 'id', m.id, 'order_id', m.order_id, 'title', m.title, 'at', m.due_at, 'status', m.status,
                                'order_number', o.order_number, 'mine', exists (select 1 from public.order_team ot where ot.order_id = m.order_id and ot.user_id = v_me and ot.duty = m.duty))
        from public.order_milestones m join public.orders o on o.id = m.order_id
       where m.workspace_id = p_ws and m.due_at >= p_from and m.due_at < p_to and m.status <> 'skipped'
         and (v_full or exists (select 1 from public.order_team ot where ot.order_id = m.order_id and ot.user_id = v_me))
      union all
      select jsonb_build_object('kind', 'incident', 'id', i.id, 'title', i.title, 'at', i.created_at, 'status', i.status, 'number', i.number,
                                'severity', i.severity, 'mine', i.owner_id = v_me)
        from public.team_incidents i where i.workspace_id = p_ws and i.created_at >= p_from and i.created_at < p_to and public._incident_can_view(i)
    ) s), '[]'::jsonb);
end;
$$;
revoke all on function public.ops_calendar(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ops_calendar(uuid, timestamptz, timestamptz) to authenticated;


-- 6. Операционная сводка (только с доступом ко всем заказам)
create or replace function public.ops_dashboard(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_member(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'orders', (select jsonb_build_object(
        'open', count(*),
        'with_team', count(*) filter (where exists (select 1 from public.order_team t where t.order_id = o.id)),
        'no_lead', count(*) filter (where not exists (select 1 from public.order_team t where t.order_id = o.id and t.duty = 'lead')),
        'on_track', count(*) filter (where coalesce(s.state, 'on_track') = 'on_track'),
        'at_risk', count(*) filter (where s.state = 'at_risk'),
        'delayed', count(*) filter (where s.state = 'delayed'))
      from public.orders o left join public.order_ops s on s.order_id = o.id
     where o.workspace_id = p_ws and o.status not in ('delivered', 'cancelled')),
    'milestones', (select jsonb_build_object(
        'overdue', count(*) filter (where m.due_at < now()),
        'due_7d', count(*) filter (where m.due_at >= now() and m.due_at < now() + interval '7 days'))
      from public.order_milestones m join public.orders o on o.id = m.order_id
     where m.workspace_id = p_ws and m.status in ('pending', 'in_progress', 'delayed') and o.status not in ('delivered', 'cancelled')),
    'delays', (select jsonb_build_object('open', count(*), 'by_category', coalesce(jsonb_object_agg(category, n) filter (where category is not null), '{}'::jsonb))
      from (select d.category, count(*) n from public.order_delays d where d.workspace_id = p_ws and d.status = 'open' group by d.category) x),
    'tasks', (select jsonb_build_object(
        'open', count(*) filter (where status in ('todo', 'in_progress', 'blocked', 'submitted')),
        'overdue', count(*) filter (where status in ('todo', 'in_progress', 'blocked') and due_at < now()),
        'blocked', count(*) filter (where status = 'blocked'),
        'submitted', count(*) filter (where status = 'submitted'),
        'unassigned', count(*) filter (where status in ('todo', 'in_progress', 'blocked') and assignee_id is null),
        'done_7d', count(*) filter (where status = 'done' and completed_at > now() - interval '7 days'))
      from public.team_tasks where workspace_id = p_ws),
    'incidents', (select jsonb_build_object('open', count(*), 'by_severity', coalesce(jsonb_object_agg(severity, n) filter (where severity is not null), '{}'::jsonb))
      from (select i.severity, count(*) n from public.team_incidents i where i.workspace_id = p_ws and i.status in ('open', 'investigating') group by i.severity) x),
    'workload', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', p.full_name, 'role_key', m.role_key,
        'open', (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.assignee_id = m.user_id and t.status in ('todo', 'in_progress', 'blocked')),
        'overdue', (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.assignee_id = m.user_id and t.status in ('todo', 'in_progress', 'blocked') and t.due_at < now()),
        'review', (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.reviewer_id = m.user_id and t.status = 'submitted'),
        'orders', (select count(distinct t.order_id) from public.order_team t join public.orders o on o.id = t.order_id
                    where t.workspace_id = p_ws and t.user_id = m.user_id and o.status not in ('delivered', 'cancelled')),
        'incidents', (select count(*) from public.team_incidents i where i.workspace_id = p_ws and i.owner_id = m.user_id and i.status in ('open', 'investigating')))
        order by p.full_name)
      from public.workspace_members m join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws and m.deactivated_at is null), '[]'::jsonb),
    'sops', (select jsonb_build_object('published', count(*),
        'unread', coalesce(sum((select count(*) from public.workspace_members m
                                 where m.workspace_id = p_ws and m.deactivated_at is null
                                   and not exists (select 1 from public.team_sop_acks a where a.sop_id = s.id and a.user_id = m.user_id and a.version = s.version))), 0))
      from public.team_sops s where s.workspace_id = p_ws and s.status = 'published'));
end;
$$;
revoke all on function public.ops_dashboard(uuid) from public, anon, authenticated;
grant execute on function public.ops_dashboard(uuid) to authenticated;


-- 7. Уведомления: инцидент и регламент рядом (файл 69 + привязки файла 70)
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
                                'incident_id', n.incident_id, 'incident_number', i.number, 'sop_id', n.sop_id,
                                'title', n.title, 'note', n.note, 'actor', p.full_name, 'at', n.created_at, 'read', n.read_at is not null) x
        from public.team_notifications n
        left join public.team_tasks t on t.id = n.task_id
        left join public.team_incidents i on i.id = n.incident_id
        left join public.profiles p on p.user_id = n.actor_id
       where n.workspace_id = p_ws and n.user_id = v_me
       order by n.id desc
       limit least(greatest(coalesce(p_limit, 30), 1), 100)) s), '[]'::jsonb);
end;
$$;

-- счётчики: + открытые инциденты (видимые), непрочитанные регламенты
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
    'full',    public.is_member(p_ws),
    'incidents', (select count(*) from public.team_incidents i where i.workspace_id = p_ws and i.status in ('open', 'investigating') and public._incident_can_view(i)),
    'sops_unread', (select count(*) from public.team_sops s where s.workspace_id = p_ws and s.status = 'published'
                      and not exists (select 1 from public.team_sop_acks a where a.sop_id = s.id and a.user_id = v_me and a.version = s.version)),
    'ops', true);
end;
$$;

-- задача: + ссылка на инцидент
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
    'order_id', t.order_id, 'delay_id', t.delay_id, 'incident_id', t.incident_id,
    'order_number', (select o.order_number from public.orders o where o.id = t.order_id),
    'incident_number', (select i.number from public.team_incidents i where i.id = t.incident_id),
    'items_total', (select count(*) from public.team_task_items i where i.task_id = t.id),
    'items_done',  (select count(*) from public.team_task_items i where i.task_id = t.id and i.done),
    'comments',    (select count(*) from public.team_task_comments c where c.task_id = t.id));
$$;
revoke all on function public._task_json(public.team_tasks) from public, anon, authenticated;


insert into public.schema_migrations (version, name) values (70, 'migration_70_ops_control.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
