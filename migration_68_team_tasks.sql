-- =====================================================
-- ULA FACTORY — миграция 68: задачи команды (этап 2) — постановка, исполнитель и проверяющий, статусы, чек-лист,
-- комментарии, история, уведомления внутри сайта; передача незавершённой работы при отключении сотрудника
--
-- КАК УСТРОЕНО
--   • team_tasks — задача кабинета: номер (З-1, З-2 … внутри кабинета), название, описание, срок, важность, отдел,
--     исполнитель, проверяющий, кто поставил. Задачи не удаляются (только «Отменена»): история работы не теряется.
--   • Статусы: todo (новая) → in_progress (в работе) ⇄ blocked (есть препятствие, нужна причина)
--       → submitted (сдана на проверку, если есть проверяющий) → done (принята) / обратно in_progress (с причиной).
--     Без проверяющего исполнитель закрывает задачу сам. Сдать или закрыть можно только с отмеченным чек-листом.
--     Отменить, вернуть отменённую и переоткрыть принятую может тот, кто управляет задачей.
--   • Кто что видит: исполнитель, проверяющий, автор, руководитель отдела задачи, прямой руководитель исполнителя,
--     а с правом tasks.view_all / tasks.manage — все задачи кабинета (владелец — всегда).
--   • Кто что меняет: «управляет задачей» — владелец, право tasks.manage или автор задачи; ставить задачи другим —
--     право tasks.create; принимать сданную — назначенный проверяющий или право tasks.review, но никогда не сам
--     исполнитель (себя не принимают).
--   • team_task_items — чек-лист; team_task_comments — внутренние комментарии; team_task_events — история.
--   • team_notifications — уведомления внутри сайта (колокольчик в разделе «Команда»): назначили, сдали, приняли,
--     вернули, прокомментировали, отменили. Наружу (Telegram, WhatsApp, клиенту) ничего не отправляется.
--   • При отключении сотрудника (team_deactivate из файла 67) его незавершённые задачи переходят выбранному
--     человеку или остаются «без исполнителя», проверка — тоже; всё пишется в историю задач.
--
-- БЕЗОПАСНОСТЬ. Таблицы закрыты целиком (сайт работает только через функции ниже, каждая проверяет вход, участие
-- в кабинете и права). Посетителю без входа (anon) закрыто всё. Публичные страницы (ссылка клиента, витрина,
-- заявки) эти таблицы не читают. Заказы, клиенты и деньги этот файл не меняет.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 67.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 67) then
    raise exception 'СТОП: сначала запустите файл 67 (команда кабинета). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 68) then
    raise exception 'СТОП: файл 68 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Таблицы
create table if not exists public.team_tasks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  number        integer not null,
  title         text not null check (char_length(btrim(title)) between 1 and 200),
  description   text check (description is null or char_length(description) <= 4000),
  status        text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'submitted', 'done', 'cancelled')),
  priority      text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at        timestamptz,
  department_id uuid references public.ws_departments(id) on delete set null,
  assignee_id   uuid references auth.users(id) on delete set null,
  reviewer_id   uuid references auth.users(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  started_at    timestamptz,
  submitted_at  timestamptz,
  completed_at  timestamptz,
  completed_by  uuid references auth.users(id) on delete set null,
  unique (workspace_id, number),
  check (reviewer_id is null or assignee_id is null or reviewer_id <> assignee_id)
);
create index if not exists team_tasks_ws_status_idx on public.team_tasks (workspace_id, status);
create index if not exists team_tasks_assignee_idx  on public.team_tasks (assignee_id) where status not in ('done', 'cancelled');
create index if not exists team_tasks_reviewer_idx  on public.team_tasks (reviewer_id) where status = 'submitted';

create table if not exists public.team_task_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.team_tasks(id) on delete cascade,
  position   integer not null default 0,
  text       text not null check (char_length(btrim(text)) between 1 and 300),
  done       boolean not null default false,
  done_by    uuid references auth.users(id) on delete set null,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists team_task_items_task_idx on public.team_task_items (task_id, position);

create table if not exists public.team_task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.team_tasks(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists team_task_comments_task_idx on public.team_task_comments (task_id, created_at);

create table if not exists public.team_task_events (
  id         bigserial primary key,
  task_id    uuid not null references public.team_tasks(id) on delete cascade,
  actor_id   uuid references auth.users(id) on delete set null,
  kind       text not null check (kind in ('created', 'status', 'assigned', 'reviewer', 'edited', 'review', 'item', 'handover')),
  from_value text,
  to_value   text,
  note       text check (note is null or char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists team_task_events_task_idx on public.team_task_events (task_id, id);

create table if not exists public.team_notifications (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('assigned', 'unassigned', 'reviewer', 'submitted', 'approved', 'rejected', 'blocked', 'done', 'cancelled', 'reopened', 'comment', 'updated', 'handover')),
  task_id      uuid references public.team_tasks(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  title        text check (title is null or char_length(title) <= 200),
  note         text check (note is null or char_length(note) <= 300),
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);
create index if not exists team_notifications_user_idx on public.team_notifications (user_id, workspace_id, id desc);
create index if not exists team_notifications_unread_idx on public.team_notifications (user_id, workspace_id) where read_at is null;

alter table public.team_tasks         enable row level security;
alter table public.team_task_items    enable row level security;
alter table public.team_task_comments enable row level security;
alter table public.team_task_events   enable row level security;
alter table public.team_notifications enable row level security;
revoke all on public.team_tasks, public.team_task_items, public.team_task_comments, public.team_task_events, public.team_notifications
  from anon, authenticated;
revoke all on sequence public.team_task_events_id_seq, public.team_notifications_id_seq from anon, authenticated;


-- 2. Проверки прав (внутренние)
create or replace function public._task_can_view(t public.team_tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- coalesce: пустой исполнитель / проверяющий / автор даёт NULL, а NULL в «if not …» не запрещает — поэтому явно false
  select coalesce(auth.uid() is not null and public.team_in(t.workspace_id) and (
       auth.uid() in (t.assignee_id, t.reviewer_id, t.created_by)
    or public.team_has_perm(t.workspace_id, 'tasks.view_all')
    or public.team_has_perm(t.workspace_id, 'tasks.manage')
    or (t.status = 'submitted' and public.team_has_perm(t.workspace_id, 'tasks.review'))
    or exists (select 1 from public.ws_departments d where d.id = t.department_id and d.head_user_id = auth.uid())
    or exists (select 1 from public.workspace_members m
                where m.workspace_id = t.workspace_id and m.user_id = t.assignee_id and m.manager_id = auth.uid())), false);
$$;

create or replace function public._task_can_edit(t public.team_tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and public.team_in(t.workspace_id) and (
       public.team_has_perm(t.workspace_id, 'tasks.manage')
    or t.created_by = auth.uid()), false);
$$;

create or replace function public._task_can_review(t public.team_tasks)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.uid() is not null and public.team_in(t.workspace_id)
     and auth.uid() is distinct from t.assignee_id
     and (t.reviewer_id = auth.uid() or public.team_has_perm(t.workspace_id, 'tasks.review')), false);
$$;
revoke all on function public._task_can_view(public.team_tasks)   from public, anon, authenticated;
revoke all on function public._task_can_edit(public.team_tasks)   from public, anon, authenticated;
revoke all on function public._task_can_review(public.team_tasks) from public, anon, authenticated;

-- задача под блокировкой строки; нет задачи или нет права её видеть — одинаковый ответ «не найдена»
create or replace function public._task_lock(p_id uuid)
returns public.team_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.team_tasks;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.team_tasks where id = p_id for update;
  if not found or not public._task_can_view(t) then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  return t;
end;
$$;
revoke all on function public._task_lock(uuid) from public, anon, authenticated;

create or replace function public._task_event(p_task uuid, p_kind text, p_from text, p_to text, p_note text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.team_task_events (task_id, actor_id, kind, from_value, to_value, note)
  values (p_task, auth.uid(), p_kind, p_from, p_to, left(p_note, 1000));
$$;
revoke all on function public._task_event(uuid, text, text, text, text) from public, anon, authenticated;

-- уведомить людей о задаче: только действующих участников кабинета, без повторов и не самого себя
create or replace function public._task_notify(t public.team_tasks, p_users uuid[], p_kind text, p_note text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.team_notifications (workspace_id, user_id, kind, task_id, actor_id, title, note)
  select t.workspace_id, u, p_kind, t.id, auth.uid(), left(t.title, 200), left(p_note, 300)
    from (select distinct u from unnest(p_users) u) x
   where u is not null and u is distinct from auth.uid() and public._team_active(t.workspace_id, u);
$$;
revoke all on function public._task_notify(public.team_tasks, uuid[], text, text) from public, anon, authenticated;

-- чек-лист отмечен целиком (пустой чек-лист — тоже «отмечен»)
create or replace function public._task_items_done(p_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.team_task_items where task_id = p_task and not done);
$$;
revoke all on function public._task_items_done(uuid) from public, anon, authenticated;


-- 3. Поставить задачу
create or replace function public.task_create(
  p_ws uuid, p_title text, p_description text, p_assignee uuid, p_reviewer uuid,
  p_due timestamptz, p_priority text, p_department uuid, p_items text[] default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me    uuid := auth.uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_desc  text := nullif(btrim(coalesce(p_description, '')), '');
  v_prio  text := coalesce(nullif(p_priority, ''), 'normal');
  v_num   int;
  v_id    uuid;
  v_item  text;
  v_pos   int := 0;
  t       public.team_tasks;
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_title) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
  if v_desc is not null and char_length(v_desc) > 4000 then raise exception 'bad_description' using errcode = '22023'; end if;
  if v_prio not in ('low', 'normal', 'high', 'urgent') then raise exception 'bad_priority' using errcode = '22023'; end if;
  -- без права tasks.create — только задача себе
  if not public.team_has_perm(p_ws, 'tasks.create') and p_assignee is distinct from v_me then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_assignee is not null and not public._team_active(p_ws, p_assignee) then raise exception 'bad_assignee' using errcode = 'P0001'; end if;
  if p_reviewer is not null and (p_reviewer = p_assignee or not public._team_active(p_ws, p_reviewer)) then
    raise exception 'bad_reviewer' using errcode = 'P0001';
  end if;
  if p_department is not null and not exists (select 1 from public.ws_departments where id = p_department and workspace_id = p_ws) then
    raise exception 'bad_department' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_items), 0) > 50 then raise exception 'too_many_items' using errcode = '22023'; end if;

  -- номер внутри кабинета: два одновременных создания не получат один номер
  perform pg_advisory_xact_lock(hashtext('team_tasks:' || p_ws::text));
  select coalesce(max(number), 0) + 1 into v_num from public.team_tasks where workspace_id = p_ws;

  insert into public.team_tasks (workspace_id, number, title, description, priority, due_at, department_id, assignee_id, reviewer_id, created_by)
  values (p_ws, v_num, v_title, v_desc, v_prio, p_due, p_department, p_assignee, p_reviewer, v_me)
  returning * into t;
  v_id := t.id;

  foreach v_item in array coalesce(p_items, '{}'::text[]) loop
    v_item := btrim(coalesce(v_item, ''));
    continue when v_item = '';
    if char_length(v_item) > 300 then raise exception 'bad_item' using errcode = '22023'; end if;
    v_pos := v_pos + 1;
    insert into public.team_task_items (task_id, position, text) values (v_id, v_pos, v_item);
  end loop;

  perform public._task_event(v_id, 'created', null, 'todo', null);
  perform public._task_notify(t, array[p_assignee], 'assigned');
  perform public._task_notify(t, array[p_reviewer], 'reviewer');
  return v_id;
end;
$$;
revoke all on function public.task_create(uuid, text, text, uuid, uuid, timestamptz, text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.task_create(uuid, text, text, uuid, uuid, timestamptz, text, uuid, text[]) to authenticated;


-- 4. Изменить задачу (название, описание, срок, важность, отдел) — тот, кто управляет задачей; только открытую
create or replace function public.task_update(p_id uuid, p_title text, p_description text, p_due timestamptz, p_priority text, p_department uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t       public.team_tasks := public._task_lock(p_id);
  v_title text := btrim(coalesce(p_title, ''));
  v_desc  text := nullif(btrim(coalesce(p_description, '')), '');
  v_prio  text := coalesce(nullif(p_priority, ''), 'normal');
  v_what  text[] := '{}';
begin
  if not public._task_can_edit(t) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status in ('done', 'cancelled') then raise exception 'task_closed' using errcode = 'P0001'; end if;
  if char_length(v_title) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
  if v_desc is not null and char_length(v_desc) > 4000 then raise exception 'bad_description' using errcode = '22023'; end if;
  if v_prio not in ('low', 'normal', 'high', 'urgent') then raise exception 'bad_priority' using errcode = '22023'; end if;
  if p_department is not null and not exists (select 1 from public.ws_departments where id = p_department and workspace_id = t.workspace_id) then
    raise exception 'bad_department' using errcode = 'P0001';
  end if;

  if v_title is distinct from t.title then v_what := v_what || 'title'; end if;
  if v_desc is distinct from t.description then v_what := v_what || 'description'; end if;
  if p_due is distinct from t.due_at then v_what := v_what || 'due_at'; end if;
  if v_prio is distinct from t.priority then v_what := v_what || 'priority'; end if;
  if p_department is distinct from t.department_id then v_what := v_what || 'department'; end if;
  if cardinality(v_what) = 0 then return; end if;

  update public.team_tasks
     set title = v_title, description = v_desc, due_at = p_due, priority = v_prio, department_id = p_department, updated_at = now()
   where id = t.id
  returning * into t;
  perform public._task_event(t.id, 'edited', null, array_to_string(v_what, ','),
    case when 'due_at' = any (v_what) then coalesce(to_char(p_due at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI"Z"'), '—') end);
  perform public._task_notify(t, array[t.assignee_id], 'updated', array_to_string(v_what, ','));
end;
$$;
revoke all on function public.task_update(uuid, text, text, timestamptz, text, uuid) from public, anon, authenticated;
grant execute on function public.task_update(uuid, text, text, timestamptz, text, uuid) to authenticated;


-- 5. Назначить исполнителя и проверяющего
--    Смена исполнителя: «в работе» и «препятствие» становятся «новой» у нового человека; сданная остаётся сданной.
create or replace function public.task_assign(p_id uuid, p_assignee uuid, p_reviewer uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.team_tasks := public._task_lock(p_id);
  v_old  public.team_tasks;
  v_me   uuid := auth.uid();
begin
  if not public._task_can_edit(t) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status in ('done', 'cancelled') then raise exception 'task_closed' using errcode = 'P0001'; end if;
  if p_assignee is distinct from t.assignee_id and p_assignee is distinct from v_me
     and not public.team_has_perm(t.workspace_id, 'tasks.create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_assignee is not null and p_assignee is distinct from t.assignee_id and not public._team_active(t.workspace_id, p_assignee) then
    raise exception 'bad_assignee' using errcode = 'P0001';
  end if;
  if p_reviewer is not null and (p_reviewer = p_assignee
       or (p_reviewer is distinct from t.reviewer_id and not public._team_active(t.workspace_id, p_reviewer))) then
    raise exception 'bad_reviewer' using errcode = 'P0001';
  end if;
  if t.status = 'submitted' and p_reviewer is null then raise exception 'reviewer_required' using errcode = 'P0001'; end if;

  v_old := t;
  update public.team_tasks
     set assignee_id = p_assignee, reviewer_id = p_reviewer, updated_at = now(),
         status = case when p_assignee is distinct from v_old.assignee_id and status in ('in_progress', 'blocked') then 'todo' else status end
   where id = t.id
  returning * into t;

  if p_assignee is distinct from v_old.assignee_id then
    perform public._task_event(t.id, 'assigned', v_old.assignee_id::text, p_assignee::text);
    if t.status is distinct from v_old.status then perform public._task_event(t.id, 'status', v_old.status, t.status); end if;
    perform public._task_notify(t, array[p_assignee], 'assigned');
    perform public._task_notify(t, array[v_old.assignee_id], 'unassigned');
  end if;
  if p_reviewer is distinct from v_old.reviewer_id then
    perform public._task_event(t.id, 'reviewer', v_old.reviewer_id::text, p_reviewer::text);
    perform public._task_notify(t, array[p_reviewer], case when t.status = 'submitted' then 'submitted' else 'reviewer' end);
  end if;
end;
$$;
revoke all on function public.task_assign(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.task_assign(uuid, uuid, uuid) to authenticated;


-- 6. Сменить статус (работа исполнителя; отмена и возврат — тот, кто управляет задачей).
--    Принять / вернуть сданную — task_review.
create or replace function public.task_set_status(p_id uuid, p_status text, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t       public.team_tasks := public._task_lock(p_id);
  v_old   text := t.status;
  v_me    uuid := auth.uid();
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_work  boolean := coalesce(t.assignee_id = v_me, false);
  v_edit  boolean := public._task_can_edit(t);
  v_ok    boolean := false;
begin
  if p_status is null or p_status = v_old then return v_old; end if;
  if v_note is not null and char_length(v_note) > 1000 then raise exception 'bad_note' using errcode = '22023'; end if;

  if p_status = 'in_progress' and v_old in ('todo', 'blocked', 'submitted') then
    v_ok := v_work or (v_edit and v_old <> 'submitted');
  elsif p_status = 'todo' and v_old = 'in_progress' then
    v_ok := v_work or v_edit;
  elsif p_status = 'blocked' and v_old in ('todo', 'in_progress') then
    if v_note is null then raise exception 'note_required' using errcode = 'P0001'; end if;
    v_ok := v_work or v_edit;
  elsif p_status = 'submitted' and v_old in ('todo', 'in_progress') then
    if t.reviewer_id is null then raise exception 'no_reviewer' using errcode = 'P0001'; end if;
    if not public._task_items_done(t.id) then raise exception 'checklist_incomplete' using errcode = 'P0001'; end if;
    v_ok := v_work;
  elsif p_status = 'done' and v_old in ('todo', 'in_progress') then
    -- закрыть без проверки можно только задачу без проверяющего
    if t.reviewer_id is not null then raise exception 'review_required' using errcode = 'P0001'; end if;
    if not public._task_items_done(t.id) then raise exception 'checklist_incomplete' using errcode = 'P0001'; end if;
    v_ok := v_work or v_edit;
  elsif p_status = 'cancelled' and v_old in ('todo', 'in_progress', 'blocked', 'submitted') then
    v_ok := v_edit;
  elsif p_status = 'todo' and v_old = 'cancelled' then
    v_ok := v_edit;
  elsif p_status = 'in_progress' and v_old = 'done' then
    if v_note is null then raise exception 'note_required' using errcode = 'P0001'; end if;
    v_ok := v_edit;
  else
    raise exception 'bad_transition' using errcode = 'P0001';
  end if;
  if not v_ok then raise exception 'forbidden' using errcode = '42501'; end if;

  update public.team_tasks
     set status = p_status, updated_at = now(),
         started_at   = case when p_status = 'in_progress' and started_at is null then now() else started_at end,
         submitted_at = case when p_status = 'submitted' then now() else submitted_at end,
         completed_at = case when p_status = 'done' then now() when p_status in ('todo', 'in_progress') then null else completed_at end,
         completed_by = case when p_status = 'done' then v_me when p_status in ('todo', 'in_progress') then null else completed_by end
   where id = t.id
  returning * into t;
  perform public._task_event(t.id, 'status', v_old, p_status, v_note);

  if p_status = 'submitted' then
    perform public._task_notify(t, array[t.reviewer_id], 'submitted');
  elsif p_status = 'blocked' then
    perform public._task_notify(t, array[t.created_by, t.reviewer_id], 'blocked', v_note);
  elsif p_status = 'done' then
    perform public._task_notify(t, array[t.created_by, t.assignee_id], 'done');
  elsif p_status = 'cancelled' then
    perform public._task_notify(t, array[t.assignee_id, t.reviewer_id], 'cancelled', v_note);
  elsif v_old in ('cancelled', 'done') then
    perform public._task_notify(t, array[t.assignee_id], 'reopened', v_note);
  end if;
  return p_status;
end;
$$;
revoke all on function public.task_set_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.task_set_status(uuid, text, text) to authenticated;


-- 7. Проверка сданной задачи: принять или вернуть на доработку (с причиной — она же уходит в комментарии)
create or replace function public.task_review(p_id uuid, p_approve boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.team_tasks := public._task_lock(p_id);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_to   text;
begin
  if t.status <> 'submitted' then raise exception 'not_submitted' using errcode = 'P0001'; end if;
  if not public._task_can_review(t) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_approve is null then raise exception 'bad_decision' using errcode = '22023'; end if;
  if not p_approve and (v_note is null or char_length(v_note) < 2) then raise exception 'note_required' using errcode = 'P0001'; end if;
  if v_note is not null and char_length(v_note) > 1000 then raise exception 'bad_note' using errcode = '22023'; end if;

  v_to := case when p_approve then 'done' else 'in_progress' end;
  update public.team_tasks
     set status = v_to, updated_at = now(),
         completed_at = case when p_approve then now() end,
         completed_by = case when p_approve then auth.uid() end
   where id = t.id
  returning * into t;
  perform public._task_event(t.id, 'review', 'submitted', v_to, v_note);
  if v_note is not null then
    insert into public.team_task_comments (task_id, author_id, body) values (t.id, auth.uid(), v_note);
  end if;
  perform public._task_notify(t, array[t.assignee_id], case when p_approve then 'approved' else 'rejected' end, v_note);
  if p_approve then perform public._task_notify(t, array[t.created_by], 'done'); end if;
  return v_to;
end;
$$;
revoke all on function public.task_review(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.task_review(uuid, boolean, text) to authenticated;


-- 8. Чек-лист. Добавить и удалить — тот, кто управляет задачей (и исполнитель — добавить);
--    отметить — исполнитель или управляющий. Пока задача сдана, принята или отменена — чек-лист не меняется.
create or replace function public.task_item_add(p_task uuid, p_text text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.team_tasks := public._task_lock(p_task);
  v_text text := btrim(coalesce(p_text, ''));
  v_id   uuid;
begin
  if not (public._task_can_edit(t) or coalesce(t.assignee_id = auth.uid(), false)) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status not in ('todo', 'in_progress', 'blocked') then raise exception 'task_locked' using errcode = 'P0001'; end if;
  if char_length(v_text) not between 1 and 300 then raise exception 'bad_item' using errcode = '22023'; end if;
  if (select count(*) from public.team_task_items where task_id = t.id) >= 50 then raise exception 'too_many_items' using errcode = '22023'; end if;
  insert into public.team_task_items (task_id, position, text)
  values (t.id, coalesce((select max(position) from public.team_task_items where task_id = t.id), 0) + 1, v_text)
  returning id into v_id;
  update public.team_tasks set updated_at = now() where id = t.id;
  perform public._task_event(t.id, 'item', null, 'added', v_text);
  return v_id;
end;
$$;

create or replace function public.task_item_toggle(p_item uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid;
  v_text text;
  t      public.team_tasks;
begin
  select task_id, text into v_task, v_text from public.team_task_items where id = p_item;
  if v_task is null then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  t := public._task_lock(v_task);
  if not (coalesce(t.assignee_id = auth.uid(), false) or public._task_can_edit(t)) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status not in ('todo', 'in_progress', 'blocked') then raise exception 'task_locked' using errcode = 'P0001'; end if;
  update public.team_task_items
     set done = coalesce(p_done, false),
         done_by = case when coalesce(p_done, false) then auth.uid() end,
         done_at = case when coalesce(p_done, false) then now() end
   where id = p_item and done is distinct from coalesce(p_done, false);
  if found then
    update public.team_tasks set updated_at = now() where id = t.id;
    perform public._task_event(t.id, 'item', null, case when p_done then 'checked' else 'unchecked' end, v_text);
  end if;
end;
$$;

create or replace function public.task_item_delete(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid;
  v_text text;
  t      public.team_tasks;
begin
  select task_id, text into v_task, v_text from public.team_task_items where id = p_item;
  if v_task is null then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  t := public._task_lock(v_task);
  if not public._task_can_edit(t) then raise exception 'forbidden' using errcode = '42501'; end if;
  if t.status not in ('todo', 'in_progress', 'blocked') then raise exception 'task_locked' using errcode = 'P0001'; end if;
  delete from public.team_task_items where id = p_item;
  update public.team_tasks set updated_at = now() where id = t.id;
  perform public._task_event(t.id, 'item', null, 'removed', v_text);
end;
$$;
revoke all on function public.task_item_add(uuid, text)        from public, anon, authenticated;
revoke all on function public.task_item_toggle(uuid, boolean)  from public, anon, authenticated;
revoke all on function public.task_item_delete(uuid)           from public, anon, authenticated;
grant execute on function public.task_item_add(uuid, text)       to authenticated;
grant execute on function public.task_item_toggle(uuid, boolean) to authenticated;
grant execute on function public.task_item_delete(uuid)          to authenticated;


-- 9. Комментарии (внутренние: клиент их не видит никогда). Писать может любой, кто видит задачу.
create or replace function public.task_comment_add(p_task uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.team_tasks := public._task_lock(p_task);
  v_body text := btrim(coalesce(p_body, ''));
  v_id   uuid;
begin
  if char_length(v_body) not between 1 and 4000 then raise exception 'bad_comment' using errcode = '22023'; end if;
  insert into public.team_task_comments (task_id, author_id, body) values (t.id, auth.uid(), v_body) returning id into v_id;
  update public.team_tasks set updated_at = now() where id = t.id;
  perform public._task_notify(t, array[t.assignee_id, t.reviewer_id, t.created_by], 'comment', left(v_body, 300));
  return v_id;
end;
$$;
revoke all on function public.task_comment_add(uuid, text) from public, anon, authenticated;
grant execute on function public.task_comment_add(uuid, text) to authenticated;


-- 10. Списки и карточка задачи
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
    'items_total', (select count(*) from public.team_task_items i where i.task_id = t.id),
    'items_done',  (select count(*) from public.team_task_items i where i.task_id = t.id and i.done),
    'comments',    (select count(*) from public.team_task_comments c where c.task_id = t.id));
$$;
revoke all on function public._task_json(public.team_tasks) from public, anon, authenticated;

-- p_scope: mine (мне), review (ждут моей проверки), created (поставил я), all (все, что мне видно).
-- Открытые — все; принятые и отменённые — за последние 30 дней. Не больше 300.
create or replace function public.task_list(p_ws uuid, p_scope text default 'mine')
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
  if p_scope not in ('mine', 'review', 'created', 'all') then raise exception 'bad_scope' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(public._task_json(t) order by
             (t.status in ('done', 'cancelled')), t.due_at nulls last,
             case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end, t.number desc)
      from (select * from public.team_tasks t
             where t.workspace_id = p_ws
               and (t.status not in ('done', 'cancelled') or t.updated_at > now() - interval '30 days')
               and case p_scope
                     when 'mine'    then t.assignee_id = v_me
                     when 'created' then t.created_by = v_me
                     when 'review'  then t.status = 'submitted' and public._task_can_review(t)
                     else true end
               and public._task_can_view(t)
             order by (t.status in ('done', 'cancelled')), t.updated_at desc
             limit 300) t), '[]'::jsonb);
end;
$$;
revoke all on function public.task_list(uuid, text) from public, anon, authenticated;
grant execute on function public.task_list(uuid, text) to authenticated;

create or replace function public.task_get(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  t      public.team_tasks;
  v_me   uuid := auth.uid();
  v_edit boolean;
begin
  if v_me is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into t from public.team_tasks where id = p_id;
  if not found or not public._task_can_view(t) then raise exception 'task_not_found' using errcode = 'P0002'; end if;
  v_edit := public._task_can_edit(t);
  return public._task_json(t) || jsonb_build_object(
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'text', i.text, 'done', i.done, 'done_by', i.done_by, 'done_at', i.done_at)
                                         order by i.position, i.created_at)
                         from public.team_task_items i where i.task_id = t.id), '[]'::jsonb),
    'comment_list', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'author_id', c.author_id, 'author', p.full_name,
                                                                  'body', c.body, 'at', c.created_at) order by c.created_at)
                                from public.team_task_comments c left join public.profiles p on p.user_id = c.author_id
                               where c.task_id = t.id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(x order by (x->>'id')::bigint) from (
                          select jsonb_build_object('id', e.id, 'kind', e.kind, 'from', e.from_value, 'to', e.to_value, 'note', e.note,
                                                    'actor_id', e.actor_id, 'actor', p.full_name, 'at', e.created_at) x
                            from public.team_task_events e left join public.profiles p on p.user_id = e.actor_id
                           where e.task_id = t.id order by e.id desc limit 100) s), '[]'::jsonb),
    'can', jsonb_build_object(
      'edit',   v_edit,
      'work',   coalesce(t.assignee_id = v_me, false),
      'review', t.status = 'submitted' and public._task_can_review(t),
      'assign_others', public.team_has_perm(t.workspace_id, 'tasks.create')));
end;
$$;
revoke all on function public.task_get(uuid) from public, anon, authenticated;
grant execute on function public.task_get(uuid) to authenticated;

-- Цифры для значков: мои открытые, мои просроченные, ждут моей проверки, непрочитанные уведомления
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
    'unread',  (select count(*) from public.team_notifications where workspace_id = p_ws and user_id = v_me and read_at is null));
end;
$$;
revoke all on function public.task_counts(uuid) from public, anon, authenticated;
grant execute on function public.task_counts(uuid) to authenticated;


-- 11. Уведомления (только свои)
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
      select jsonb_build_object('id', n.id, 'kind', n.kind, 'task_id', n.task_id, 'task_number', t.number, 'title', n.title,
                                'note', n.note, 'actor', p.full_name, 'at', n.created_at, 'read', n.read_at is not null) x
        from public.team_notifications n
        left join public.team_tasks t on t.id = n.task_id
        left join public.profiles p on p.user_id = n.actor_id
       where n.workspace_id = p_ws and n.user_id = v_me
       order by n.id desc
       limit least(greatest(coalesce(p_limit, 30), 1), 100)) s), '[]'::jsonb);
end;
$$;
revoke all on function public.team_notif_list(uuid, int) from public, anon, authenticated;
grant execute on function public.team_notif_list(uuid, int) to authenticated;

-- p_ids = null — отметить прочитанными все свои
create or replace function public.team_notif_read(p_ws uuid, p_ids bigint[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if auth.uid() is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.team_notifications set read_at = now()
   where workspace_id = p_ws and user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.team_notif_read(uuid, bigint[]) from public, anon, authenticated;
grant execute on function public.team_notif_read(uuid, bigint[]) to authenticated;


-- 12. Передача незавершённой работы (вызывает team_deactivate из файла 67; можно и отдельно — team_reassign_open)
--     Задачи, где человек исполнитель, → новому исполнителю (или «без исполнителя»), «в работе» → «новая».
--     Где он проверяющий → новому проверяющему (если это не сам исполнитель задачи), иначе проверяющего нет:
--     сданная задача без проверяющего возвращается «в работу», чтобы её не закрыли без проверки.
create or replace function public._team_handover(p_ws uuid, p_from uuid, p_to uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  t    public.team_tasks;
  v_n  int := 0;
  v_st text;
  v_rv uuid;
begin
  for t in
    select * from public.team_tasks
     where workspace_id = p_ws and status not in ('done', 'cancelled') and (assignee_id = p_from or reviewer_id = p_from)
     order by number
     for update
  loop
    v_st := t.status;
    if t.assignee_id = p_from then
      v_rv := case when t.reviewer_id = p_to then null else t.reviewer_id end;
      update public.team_tasks
         set assignee_id = p_to, reviewer_id = v_rv, updated_at = now(),
             status = case when status in ('in_progress', 'blocked') then 'todo' else status end
       where id = t.id returning * into t;
      perform public._task_event(t.id, 'handover', p_from::text, p_to::text, 'assignee');
      perform public._task_notify(t, array[p_to], 'handover');
    end if;
    if t.reviewer_id = p_from then
      v_rv := case when p_to is distinct from t.assignee_id then p_to end;
      update public.team_tasks
         set reviewer_id = v_rv, updated_at = now(),
             status = case when status = 'submitted' and v_rv is null then 'in_progress' else status end
       where id = t.id returning * into t;
      perform public._task_event(t.id, 'handover', p_from::text, v_rv::text, 'reviewer');
      perform public._task_notify(t, array[v_rv], case when t.status = 'submitted' then 'submitted' else 'reviewer' end);
    end if;
    if t.status is distinct from v_st then perform public._task_event(t.id, 'status', v_st, t.status, 'handover'); end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public._team_handover(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.team_reassign_open(p_ws uuid, p_from uuid, p_to uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_from = p_to then raise exception 'bad_reassign' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.workspace_members where workspace_id = p_ws and user_id = p_from) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if p_to is not null and not public._team_active(p_ws, p_to) then raise exception 'bad_reassign' using errcode = 'P0001'; end if;
  v_n := public._team_handover(p_ws, p_from, p_to);
  perform public._team_log(p_ws, 'member.reassign', p_from, jsonb_build_object('to', p_to, 'moved', v_n));
  return v_n;
end;
$$;
revoke all on function public.team_reassign_open(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_reassign_open(uuid, uuid, uuid) to authenticated;


-- ✅ ОТМЕТКА: файл 68 запущен
insert into public.schema_migrations (version, name) values (68, 'migration_68_team_tasks.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
