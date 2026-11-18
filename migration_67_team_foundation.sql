-- =====================================================
-- ULA FACTORY — миграция 67: команда кабинета (этап 1) — сотрудники, роли и права, отделы, структура, отключение
--
-- ЗАЧЕМ. До этого файла в кабинете были «владелец» и до 5 «помощников» с одинаковыми правами (файл 18). Теперь:
--   • РОЛИ кабинета (ws_roles): набор прав из короткого списка (team_perm_catalog). У каждого кабинета пять готовых
--     ролей (менеджер операций, закупки, контроль качества, логистика, помощник), владелец может добавить свои.
--     Менять роли и их права может только владелец (иначе человек с правом «команда» выдал бы себе любые права).
--   • ОТДЕЛЫ (ws_departments) с вложенностью и руководителем; у сотрудника — отдел, должность и руководитель
--     (кому подчиняется) — это и есть структура команды.
--   • ПРИГЛАШЕНИЕ сразу с ролью, отделом и должностью (team_invite_new). Старая функция team_invite_create работает.
--   • ОТКЛЮЧЕНИЕ сотрудника (team_deactivate): строка участника НЕ удаляется (история заказов, задач и действий
--     остаётся с его именем), но доступ к кабинету пропадает сразу — это проверяют is_member / is_owner / my_ws_ids /
--     my_workspace_id, на которых стоят все правила доступа. Можно включить обратно (team_reactivate).
--   • ЖУРНАЛ действий с командой (team_audit): кто кого пригласил, кому сменил роль, кого отключил.
--
-- ЧТО НЕ МЕНЯЕТСЯ. Заказы, клиенты, деньги, страницы клиента по ссылке. Права помощника на заказы — как в файле 18
-- (работает с заказами, не удаляет, не меняет настройки). Права из ролей относятся к команде и задачам (файл 68);
-- доступ сотрудника к отдельным заказам — следующий этап. Публичные функции (ссылка клиента, витрина, заявки)
-- новые таблицы не читают; посетителю без входа (anon) таблицы и функции закрыты.
-- Существующие помощники получают роль «Помощник» с правом создавать задачи — их доступ к заказам прежний.
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 66.
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё). Можно запускать повторно.
-- =====================================================
begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 66) then
    raise exception 'СТОП: сначала запустите файл 66. Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 67) then
    raise exception 'СТОП: файл 67 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Список прав (один источник: база проверяет по нему, сайт показывает его же)
--    team.manage    — приглашать, менять отдел/должность/роль сотрудника (кроме ролей с этим же правом), отключать
--    tasks.create   — ставить задачи другим (без него — только себе)
--    tasks.view_all — видеть все задачи кабинета
--    tasks.manage   — менять, переназначать и отменять любые задачи
--    tasks.review   — принимать и возвращать на доработку любые сданные задачи
create or replace function public.team_perm_catalog()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review']::text[];
$$;
revoke all on function public.team_perm_catalog() from public, anon;
grant execute on function public.team_perm_catalog() to authenticated;


-- 2. Роли кабинета
create table if not exists public.ws_roles (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  key          text not null check (key ~ '^[a-z][a-z0-9_]{1,31}$'),
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  permissions  text[] not null default '{}',
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, key)
);
alter table public.ws_roles drop constraint if exists ws_roles_perms_chk;
alter table public.ws_roles add constraint ws_roles_perms_chk
  check (permissions <@ array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review']::text[]);
alter table public.ws_roles enable row level security;
revoke all on public.ws_roles from anon, authenticated;

-- готовые роли: создаются в каждом кабинете (повторный вызов ничего не меняет и не трогает правки владельца)
create or replace function public._team_seed_roles(p_ws uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ws_roles (workspace_id, key, name, permissions, is_system) values
    (p_ws, 'manager',   'Менеджер операций', array['team.manage', 'tasks.create', 'tasks.view_all', 'tasks.manage', 'tasks.review'], true),
    (p_ws, 'sourcing',  'Закупки',           array['tasks.create'], true),
    (p_ws, 'qc',        'Контроль качества', array['tasks.create'], true),
    (p_ws, 'logistics', 'Логистика',         array['tasks.create'], true),
    (p_ws, 'assistant', 'Помощник',          array['tasks.create'], true)
  on conflict (workspace_id, key) do nothing;
$$;
revoke all on function public._team_seed_roles(uuid) from public, anon, authenticated;

create or replace function public._workspaces_seed_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._team_seed_roles(new.id);
  return new;
end;
$$;
revoke all on function public._workspaces_seed_roles() from public, anon, authenticated;
drop trigger if exists workspaces_seed_roles on public.workspaces;
create trigger workspaces_seed_roles after insert on public.workspaces
  for each row execute function public._workspaces_seed_roles();

select public._team_seed_roles(id) from public.workspaces;


-- 3. Отделы (структура). Отдел может входить в другой отдел; у отдела может быть руководитель.
create table if not exists public.ws_departments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  parent_id    uuid references public.ws_departments(id) on delete set null,
  head_user_id uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists ws_departments_name_uidx on public.ws_departments (workspace_id, lower(btrim(name)));
create index if not exists ws_departments_ws_idx on public.ws_departments (workspace_id);
alter table public.ws_departments enable row level security;
revoke all on public.ws_departments from anon, authenticated;


-- 4. Участник кабинета: роль, отдел, должность, руководитель, отключение
alter table public.workspace_members add column if not exists role_key          text;
alter table public.workspace_members add column if not exists department_id     uuid references public.ws_departments(id) on delete set null;
alter table public.workspace_members add column if not exists title             text;
alter table public.workspace_members add column if not exists manager_id        uuid references auth.users(id) on delete set null;
alter table public.workspace_members add column if not exists deactivated_at    timestamptz;
alter table public.workspace_members add column if not exists deactivated_by    uuid references auth.users(id) on delete set null;
alter table public.workspace_members add column if not exists deactivation_note text;

alter table public.workspace_members drop constraint if exists workspace_members_title_chk;
alter table public.workspace_members add constraint workspace_members_title_chk
  check (title is null or char_length(title) between 1 and 80);
alter table public.workspace_members drop constraint if exists workspace_members_note_chk;
alter table public.workspace_members add constraint workspace_members_note_chk
  check (deactivation_note is null or char_length(deactivation_note) <= 300);
-- владельца отключить нельзя (кабинет остался бы без хозяина)
alter table public.workspace_members drop constraint if exists workspace_members_owner_active_chk;
alter table public.workspace_members add constraint workspace_members_owner_active_chk
  check (role <> 'owner' or deactivated_at is null);

-- существующие помощники получают роль «Помощник» (их права на заказы не меняются)
update public.workspace_members set role_key = 'assistant' where role = 'staff' and role_key is null;
-- и любой помощник, добавленный старым путём без роли, тоже (готовые роли кабинета создаются, если их ещё нет)
create or replace function public._members_default_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'staff' and new.role_key is null then
    perform public._team_seed_roles(new.workspace_id);
    new.role_key := 'assistant';
  end if;
  return new;
end;
$$;
revoke all on function public._members_default_role() from public, anon, authenticated;
drop trigger if exists workspace_members_default_role on public.workspace_members;
create trigger workspace_members_default_role before insert or update of role, role_key on public.workspace_members
  for each row execute function public._members_default_role();
alter table public.workspace_members drop constraint if exists workspace_members_role_key_chk;
alter table public.workspace_members add constraint workspace_members_role_key_chk
  check (role = 'owner' or role_key is not null);
alter table public.workspace_members drop constraint if exists workspace_members_role_fk;
alter table public.workspace_members add constraint workspace_members_role_fk
  foreign key (workspace_id, role_key) references public.ws_roles (workspace_id, key);

-- приглашение: сразу с ролью, отделом, должностью и именем (для кого)
alter table public.team_invites add column if not exists role_key      text;
alter table public.team_invites add column if not exists department_id uuid references public.ws_departments(id) on delete set null;
alter table public.team_invites add column if not exists title         text;
alter table public.team_invites add column if not exists invitee_name  text;
alter table public.team_invites drop constraint if exists team_invites_text_chk;
alter table public.team_invites add constraint team_invites_text_chk
  check ((title is null or char_length(title) between 1 and 80) and (invitee_name is null or char_length(invitee_name) between 1 and 120));
alter table public.team_invites drop constraint if exists team_invites_role_fk;
alter table public.team_invites add constraint team_invites_role_fk
  foreign key (workspace_id, role_key) references public.ws_roles (workspace_id, key);


-- 5. Журнал действий с командой (только чтение через team_overview; записывают функции)
create table if not exists public.team_audit (
  id           bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  action       text not null check (action ~ '^[a-z_.]{2,40}$'),
  target_user  uuid references auth.users(id) on delete set null,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists team_audit_ws_idx on public.team_audit (workspace_id, id desc);
alter table public.team_audit enable row level security;
revoke all on public.team_audit from anon, authenticated;
revoke all on sequence public.team_audit_id_seq from anon, authenticated;

create or replace function public._team_log(p_ws uuid, p_action text, p_target uuid, p_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.team_audit (workspace_id, actor_id, action, target_user, detail)
  values (p_ws, auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
$$;
revoke all on function public._team_log(uuid, text, uuid, jsonb) from public, anon, authenticated;


-- 6. Доступ: отключённый участник больше не участник. Остальное — как в файлах 46 и 48.
create or replace function public.is_member(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws
       and m.user_id = auth.uid()
       and m.deactivated_at is null
       and p.is_active
  ) or public.admin_editing(p_ws);
$$;

create or replace function public.is_owner(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws
       and m.user_id = auth.uid()
       and m.role = 'owner'
       and m.deactivated_at is null
       and p.is_active
  ) or public.admin_editing(p_ws);
$$;
revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
revoke all on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

create or replace function public.my_ws_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.workspace_id), '{}')
    from public.workspace_members m
    join public.profiles p on p.user_id = m.user_id
   where m.user_id = auth.uid()
     and m.deactivated_at is null
     and p.is_active;
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
   where m.user_id = auth.uid()
     and m.deactivated_at is null
   order by m.created_at
   limit 1;
$$;

-- «Я действующий участник команды этого кабинета?» — для раздела «Команда» и задач.
-- Отличие от is_member: is_member даёт доступ к заказам, клиентам и деньгам кабинета (файл 69 сужает его до ролей
-- с правом «все заказы»), а team_in — только к команде и задачам. Админ в режиме правки — тоже участник.
create or replace function public.team_in(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws and m.user_id = auth.uid() and m.deactivated_at is null and p.is_active
  ) or public.admin_editing(p_ws);
$$;
revoke all on function public.team_in(uuid) from public, anon;
grant execute on function public.team_in(uuid) to authenticated;

-- «Этот человек — действующий участник кабинета?» (для выбора исполнителя, руководителя и т.п.)
create or replace function public._team_active(p_ws uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1
      from public.workspace_members m
      join public.profiles p on p.user_id = m.user_id
     where m.workspace_id = p_ws and m.user_id = p_user and m.deactivated_at is null and p.is_active);
$$;
revoke all on function public._team_active(uuid, uuid) from public, anon, authenticated;

-- Права человека в кабинете: владелец (и админ в режиме правки) — все; сотрудник — права своей роли; иначе — нет.
create or replace function public._team_perms(p_ws uuid, p_user uuid)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user = auth.uid() and public.is_owner(p_ws) then public.team_perm_catalog()
    else coalesce((
      select case when m.role = 'owner' then public.team_perm_catalog() else r.permissions end
        from public.workspace_members m
        join public.profiles p on p.user_id = m.user_id and p.is_active
        left join public.ws_roles r on r.workspace_id = m.workspace_id and r.key = m.role_key
       where m.workspace_id = p_ws and m.user_id = p_user and m.deactivated_at is null), '{}'::text[])
  end;
$$;
revoke all on function public._team_perms(uuid, uuid) from public, anon, authenticated;

create or replace function public.team_has_perm(p_ws uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and p_perm = any (public._team_perms(p_ws, auth.uid()));
$$;
revoke all on function public.team_has_perm(uuid, text) from public, anon;
grant execute on function public.team_has_perm(uuid, text) to authenticated;


-- 7. Всё о команде одним запросом (раздел «Команда»).
--    Любой действующий участник: я и мои права, сотрудники (имя, должность, отдел, роль, руководитель), отделы, роли.
--    Телефон и почта сотрудников, отключённые сотрудники, приглашения и журнал — только с правом team.manage.
create or replace function public.team_overview(p_ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me     uuid := auth.uid();
  v_manage boolean;
  v_owner  boolean;
  v_row    public.workspace_members;
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  v_manage := public.team_has_perm(p_ws, 'team.manage');
  v_owner  := public.is_owner(p_ws);
  select * into v_row from public.workspace_members where workspace_id = p_ws and user_id = v_me;

  return jsonb_build_object(
    'me', jsonb_build_object(
      'user_id', v_me,
      'is_owner', v_owner,
      'role', coalesce(v_row.role, 'owner'),
      'role_key', v_row.role_key,
      'department_id', v_row.department_id,
      'title', v_row.title,
      'manager_id', v_row.manager_id,
      'permissions', to_jsonb(public._team_perms(p_ws, v_me))),
    'catalog', to_jsonb(public.team_perm_catalog()),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', m.user_id, 'role', m.role, 'role_key', m.role_key,
               'full_name', p.full_name, 'title', m.title,
               'department_id', m.department_id, 'manager_id', m.manager_id,
               'joined_at', m.created_at,
               'active', m.deactivated_at is null and coalesce(p.is_active, false),
               'deactivated_at', case when v_manage then m.deactivated_at end,
               'deactivation_note', case when v_manage then m.deactivation_note end,
               'phone', case when v_manage then p.phone end,
               'email', case when v_manage then u.email::text end)
             order by (m.role = 'owner') desc, (m.deactivated_at is null) desc, lower(coalesce(p.full_name, '')), m.created_at)
        from public.workspace_members m
        left join public.profiles p on p.user_id = m.user_id
        left join auth.users u on u.id = m.user_id
       where m.workspace_id = p_ws
         and (v_manage or m.deactivated_at is null)), '[]'::jsonb),
    'departments', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'parent_id', d.parent_id, 'head_user_id', d.head_user_id)
             order by lower(d.name))
        from public.ws_departments d where d.workspace_id = p_ws), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('key', r.key, 'name', r.name, 'permissions', to_jsonb(r.permissions), 'is_system', r.is_system,
               'members', (select count(*) from public.workspace_members m where m.workspace_id = p_ws and m.role_key = r.key and m.deactivated_at is null))
             order by r.is_system desc, r.created_at, r.key)
        from public.ws_roles r where r.workspace_id = p_ws), '[]'::jsonb),
    'invites', case when v_manage then coalesce((
      select jsonb_agg(jsonb_build_object('code', i.code, 'expires_at', i.expires_at, 'role_key', i.role_key,
               'department_id', i.department_id, 'title', i.title, 'invitee_name', i.invitee_name) order by i.created_at desc)
        from public.team_invites i
       where i.workspace_id = p_ws and i.used_at is null and i.expires_at > now()), '[]'::jsonb) else '[]'::jsonb end,
    'audit', case when v_manage then coalesce((
      select jsonb_agg(x order by x->>'id' desc) from (
        select jsonb_build_object('id', lpad(a.id::text, 20, '0'), 'action', a.action, 'actor_id', a.actor_id, 'target_user', a.target_user,
                 'detail', a.detail, 'at', a.created_at) as x
          from public.team_audit a where a.workspace_id = p_ws order by a.id desc limit 50) s), '[]'::jsonb) else '[]'::jsonb end,
    'limit', 5);
end;
$$;
revoke all on function public.team_overview(uuid) from public, anon, authenticated;
grant execute on function public.team_overview(uuid) to authenticated;


-- 8. Приглашения
--    Сколько помощников может быть (как в файле 18): 5 действующих. Отключённые не считаются.
create or replace function public._team_staff_count(p_ws uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.workspace_members
   where workspace_id = p_ws and role = 'staff' and deactivated_at is null;
$$;
revoke all on function public._team_staff_count(uuid) from public, anon, authenticated;

-- Можно ли МНЕ выдать эту роль: роли с правом team.manage выдаёт только владелец.
create or replace function public._team_can_grant(p_ws uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ws_roles r where r.workspace_id = p_ws and r.key = p_role)
     and (public.is_owner(p_ws)
          or (public.team_has_perm(p_ws, 'team.manage')
              and not ('team.manage' = any (coalesce((select r.permissions from public.ws_roles r where r.workspace_id = p_ws and r.key = p_role), '{}'::text[])))));
$$;
revoke all on function public._team_can_grant(uuid, text) from public, anon, authenticated;

create or replace function public.team_invite_new(p_ws uuid, p_role_key text, p_department uuid, p_title text, p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text;
  v_role  text := coalesce(nullif(btrim(coalesce(p_role_key, '')), ''), 'assistant');
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 80), '');
  v_name  text := nullif(left(btrim(coalesce(p_name, '')), 120), '');
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not public._team_can_grant(p_ws, v_role) then raise exception 'role_not_allowed' using errcode = 'P0001'; end if;
  if p_department is not null and not exists (select 1 from public.ws_departments where id = p_department and workspace_id = p_ws) then
    raise exception 'bad_department' using errcode = 'P0001';
  end if;
  if public._team_staff_count(p_ws) >= 5 then raise exception 'team_full' using errcode = 'P0001'; end if;
  if (select count(*) from public.team_invites
       where workspace_id = p_ws and used_at is null and expires_at > now()) >= 5 then
    raise exception 'too_many_invites' using errcode = 'P0001';
  end if;
  insert into public.team_invites (workspace_id, created_by, role_key, department_id, title, invitee_name)
  values (p_ws, auth.uid(), v_role, p_department, v_title, v_name)
  returning code into v_code;
  perform public._team_log(p_ws, 'invite.create', null,
    jsonb_build_object('role_key', v_role, 'department_id', p_department, 'title', v_title, 'name', v_name));
  return v_code;
end;
$$;
revoke all on function public.team_invite_new(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.team_invite_new(uuid, text, uuid, text, text) to authenticated;

-- старая функция (открытая вкладка со старым сайтом): то же, роль «Помощник»
create or replace function public.team_invite_create(p_ws uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.team_invite_new(p_ws, 'assistant', null, null, null);
end;
$$;

create or replace function public.team_invite_revoke(p_ws uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.team_invites where workspace_id = p_ws and code = p_code and used_at is null;
  if found then perform public._team_log(p_ws, 'invite.revoke', null, '{}'::jsonb); end if;
end;
$$;

-- Принять приглашение. Как в файле 18, плюс: роль/отдел/должность из приглашения; отключённого сотрудника
-- того же кабинета приглашение включает обратно (история сохраняется); отключённые участия в ДРУГИХ кабинетах
-- не мешают (это прошлая работа, не свой кабинет).
create or replace function public.team_join(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.team_invites;
  v_me  uuid := auth.uid();
  v_old public.workspace_members;
  r     record;
begin
  if v_me is null then raise exception 'forbidden'; end if;
  if p_code is null or p_code !~ '^[a-f0-9]{32}$' then
    raise exception 'invalid_invite' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where user_id = v_me and is_active) then
    raise exception 'forbidden';
  end if;
  if public.is_admin() then raise exception 'admin_cannot_join' using errcode = 'P0001'; end if;

  select * into v_inv from public.team_invites
   where code = p_code and used_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invalid_invite' using errcode = 'P0001'; end if;

  select * into v_old from public.workspace_members where workspace_id = v_inv.workspace_id and user_id = v_me;
  if found and v_old.deactivated_at is null then
    raise exception 'already_member' using errcode = 'P0001';
  end if;
  if public._team_staff_count(v_inv.workspace_id) >= 5 then
    raise exception 'team_full' using errcode = 'P0001';
  end if;

  -- свои действующие кабинеты: можно оставить только пустые (их удаляем); с заказами или клиентами — нельзя
  for r in
    select m.workspace_id from public.workspace_members m
     where m.user_id = v_me and m.deactivated_at is null and m.workspace_id <> v_inv.workspace_id
  loop
    if exists (select 1 from public.orders  where workspace_id = r.workspace_id)
       or exists (select 1 from public.clients where workspace_id = r.workspace_id) then
      raise exception 'has_own_data' using errcode = 'P0001';
    end if;
  end loop;
  for r in
    select m.workspace_id from public.workspace_members m
     where m.user_id = v_me and m.role = 'owner' and m.workspace_id <> v_inv.workspace_id
  loop
    delete from public.workspaces where id = r.workspace_id;
  end loop;

  if v_old.user_id is not null then
    update public.workspace_members
       set deactivated_at = null, deactivated_by = null, deactivation_note = null,
           role_key = coalesce(v_inv.role_key, 'assistant'),
           department_id = coalesce(v_inv.department_id, department_id),
           title = coalesce(v_inv.title, title)
     where workspace_id = v_inv.workspace_id and user_id = v_me;
  else
    insert into public.workspace_members (workspace_id, user_id, role, role_key, department_id, title)
    values (v_inv.workspace_id, v_me, 'staff', coalesce(v_inv.role_key, 'assistant'), v_inv.department_id, v_inv.title);
  end if;

  update public.team_invites set used_by = v_me, used_at = now() where id = v_inv.id;
  insert into public.team_audit (workspace_id, actor_id, action, target_user, detail)
  values (v_inv.workspace_id, v_me, case when v_old.user_id is not null then 'member.rejoin' else 'member.join' end, v_me,
          jsonb_build_object('role_key', coalesce(v_inv.role_key, 'assistant')));
  return v_inv.workspace_id;
end;
$$;


-- 9. Сотрудник: роль, отдел, должность, руководитель
--    Владелец меняет всех (у себя — отдел, должность, руководителя). Человек с team.manage — сотрудников,
--    но не себя и не тех, у кого тоже есть team.manage, и не выдаёт роли с team.manage.
create or replace function public.team_member_update(p_ws uuid, p_user uuid, p_role_key text, p_department uuid, p_title text, p_manager uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m     public.workspace_members;
  v_title text := nullif(left(btrim(coalesce(p_title, '')), 80), '');
  v_owner boolean := public.is_owner(p_ws);
  v_cur   uuid;
  v_n     int := 0;
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_m from public.workspace_members where workspace_id = p_ws and user_id = p_user for update;
  if not found or v_m.deactivated_at is not null then raise exception 'not_member' using errcode = 'P0001'; end if;

  if not v_owner then
    if p_user = auth.uid() or v_m.role = 'owner' or 'team.manage' = any (public._team_perms(p_ws, p_user)) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if v_m.role = 'staff' then
    if p_role_key is null or not exists (select 1 from public.ws_roles where workspace_id = p_ws and key = p_role_key) then
      raise exception 'bad_role' using errcode = 'P0001';
    end if;
    if p_role_key is distinct from v_m.role_key and not public._team_can_grant(p_ws, p_role_key) then
      raise exception 'role_not_allowed' using errcode = 'P0001';
    end if;
  end if;
  if p_department is not null and not exists (select 1 from public.ws_departments where id = p_department and workspace_id = p_ws) then
    raise exception 'bad_department' using errcode = 'P0001';
  end if;
  if p_manager is not null then
    if p_manager = p_user or not public._team_active(p_ws, p_manager) then raise exception 'bad_manager' using errcode = 'P0001'; end if;
    -- без кругов: руководитель не может подчиняться (через цепочку) этому же человеку
    v_cur := p_manager;
    while v_cur is not null and v_n < 100 loop
      if v_cur = p_user then raise exception 'manager_cycle' using errcode = 'P0001'; end if;
      select manager_id into v_cur from public.workspace_members where workspace_id = p_ws and user_id = v_cur;
      v_n := v_n + 1;
    end loop;
  end if;

  update public.workspace_members
     set role_key = case when role = 'staff' then p_role_key else null end,
         department_id = p_department, title = v_title, manager_id = p_manager
   where workspace_id = p_ws and user_id = p_user;

  perform public._team_log(p_ws, 'member.update', p_user, jsonb_build_object(
    'role_key', jsonb_build_array(v_m.role_key, case when v_m.role = 'staff' then p_role_key end),
    'department_id', jsonb_build_array(v_m.department_id, p_department),
    'title', jsonb_build_array(v_m.title, v_title),
    'manager_id', jsonb_build_array(v_m.manager_id, p_manager)));
end;
$$;
revoke all on function public.team_member_update(uuid, uuid, text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.team_member_update(uuid, uuid, text, uuid, text, uuid) to authenticated;


-- 10. Отключение и включение сотрудника
-- Что делать с незавершённой работой человека — отдельная функция (файл 68 добавляет переназначение задач).
create or replace function public._team_handover(p_ws uuid, p_from uuid, p_to uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select 0;
$$;
revoke all on function public._team_handover(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.team_deactivate(p_ws uuid, p_user uuid, p_reassign_to uuid default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m    public.workspace_members;
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
  v_n    int;
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot_deactivate_self' using errcode = 'P0001'; end if;
  select * into v_m from public.workspace_members where workspace_id = p_ws and user_id = p_user for update;
  if not found or v_m.role <> 'staff' then raise exception 'not_staff' using errcode = 'P0001'; end if;
  if v_m.deactivated_at is not null then raise exception 'already_inactive' using errcode = 'P0001'; end if;
  if not public.is_owner(p_ws) and 'team.manage' = any (public._team_perms(p_ws, p_user)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reassign_to is not null and (p_reassign_to = p_user or not public._team_active(p_ws, p_reassign_to)) then
    raise exception 'bad_reassign' using errcode = 'P0001';
  end if;

  update public.workspace_members
     set deactivated_at = now(), deactivated_by = auth.uid(), deactivation_note = v_note
   where workspace_id = p_ws and user_id = p_user;
  -- в структуре на него больше никто не ссылается
  update public.ws_departments set head_user_id = null where workspace_id = p_ws and head_user_id = p_user;
  update public.workspace_members set manager_id = v_m.manager_id where workspace_id = p_ws and manager_id = p_user;

  v_n := public._team_handover(p_ws, p_user, p_reassign_to);
  perform public._team_log(p_ws, 'member.deactivate', p_user,
    jsonb_build_object('reassign_to', p_reassign_to, 'moved', v_n, 'note', v_note));
  return jsonb_build_object('moved', v_n);
end;
$$;
revoke all on function public.team_deactivate(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.team_deactivate(uuid, uuid, uuid, text) to authenticated;

create or replace function public.team_reactivate(p_ws uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.workspace_members;
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_m from public.workspace_members where workspace_id = p_ws and user_id = p_user for update;
  if not found or v_m.deactivated_at is null then raise exception 'not_inactive' using errcode = 'P0001'; end if;
  if not public.is_owner(p_ws) and 'team.manage' = any (coalesce((select r.permissions from public.ws_roles r where r.workspace_id = p_ws and r.key = v_m.role_key), '{}'::text[])) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- человек за это время мог начать работать в другом кабинете
  if exists (select 1 from public.workspace_members where user_id = p_user and workspace_id <> p_ws and deactivated_at is null) then
    raise exception 'works_elsewhere' using errcode = 'P0001';
  end if;
  if public._team_staff_count(p_ws) >= 5 then raise exception 'team_full' using errcode = 'P0001'; end if;
  update public.workspace_members set deactivated_at = null, deactivated_by = null, deactivation_note = null
   where workspace_id = p_ws and user_id = p_user;
  perform public._team_log(p_ws, 'member.reactivate', p_user, '{}'::jsonb);
end;
$$;
revoke all on function public.team_reactivate(uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_reactivate(uuid, uuid) to authenticated;


-- 11. Отделы
create or replace function public.team_department_save(p_ws uuid, p_id uuid, p_name text, p_parent uuid, p_head uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id   uuid := p_id;
  v_cur  uuid;
  v_n    int := 0;
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'bad_name' using errcode = '22023'; end if;
  if v_id is not null and not exists (select 1 from public.ws_departments where id = v_id and workspace_id = p_ws) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_parent is not null then
    if not exists (select 1 from public.ws_departments where id = p_parent and workspace_id = p_ws) then
      raise exception 'bad_department' using errcode = 'P0001';
    end if;
    v_cur := p_parent;
    while v_cur is not null and v_n < 100 loop
      if v_cur = v_id then raise exception 'department_cycle' using errcode = 'P0001'; end if;
      select parent_id into v_cur from public.ws_departments where id = v_cur;
      v_n := v_n + 1;
    end loop;
  end if;
  if p_head is not null and not public._team_active(p_ws, p_head) then raise exception 'bad_head' using errcode = 'P0001'; end if;

  begin
    if v_id is null then
      insert into public.ws_departments (workspace_id, name, parent_id, head_user_id)
      values (p_ws, v_name, p_parent, p_head) returning id into v_id;
      perform public._team_log(p_ws, 'department.create', p_head, jsonb_build_object('id', v_id, 'name', v_name));
    else
      update public.ws_departments set name = v_name, parent_id = p_parent, head_user_id = p_head where id = v_id;
      perform public._team_log(p_ws, 'department.update', p_head, jsonb_build_object('id', v_id, 'name', v_name));
    end if;
  exception when unique_violation then
    raise exception 'duplicate_name' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;
revoke all on function public.team_department_save(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_department_save(uuid, uuid, text, uuid, uuid) to authenticated;

-- Удалить отдел: сотрудники остаются (без отдела), вложенные отделы поднимаются на уровень выше.
create or replace function public.team_department_delete(p_ws uuid, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.ws_departments;
begin
  if not public.team_has_perm(p_ws, 'team.manage') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_d from public.ws_departments where id = p_id and workspace_id = p_ws for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update public.ws_departments set parent_id = v_d.parent_id where parent_id = p_id;
  delete from public.ws_departments where id = p_id;
  perform public._team_log(p_ws, 'department.delete', null, jsonb_build_object('id', p_id, 'name', v_d.name));
end;
$$;
revoke all on function public.team_department_delete(uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_department_delete(uuid, uuid) to authenticated;


-- 12. Роли (только владелец). Ключ новой роли придумывает база.
create or replace function public.team_role_save(p_ws uuid, p_key text, p_name text, p_permissions text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text := btrim(coalesce(p_name, ''));
  v_perms text[];
  v_key   text := p_key;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'bad_name' using errcode = '22023'; end if;
  if p_permissions is null or not (p_permissions <@ public.team_perm_catalog()) then raise exception 'bad_permissions' using errcode = '22023'; end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v_perms from unnest(p_permissions) x;

  if v_key is null then
    v_key := 'r_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    insert into public.ws_roles (workspace_id, key, name, permissions) values (p_ws, v_key, v_name, v_perms);
    perform public._team_log(p_ws, 'role.create', null, jsonb_build_object('key', v_key, 'name', v_name, 'permissions', to_jsonb(v_perms)));
  else
    update public.ws_roles set name = v_name, permissions = v_perms where workspace_id = p_ws and key = v_key;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
    perform public._team_log(p_ws, 'role.update', null, jsonb_build_object('key', v_key, 'name', v_name, 'permissions', to_jsonb(v_perms)));
  end if;
  return v_key;
end;
$$;
revoke all on function public.team_role_save(uuid, text, text, text[]) from public, anon, authenticated;
grant execute on function public.team_role_save(uuid, text, text, text[]) to authenticated;

create or replace function public.team_role_delete(p_ws uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.ws_roles;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into v_r from public.ws_roles where workspace_id = p_ws and key = p_key for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v_r.is_system then raise exception 'system_role' using errcode = 'P0001'; end if;
  -- роль у сотрудника (в том числе отключённого) или в ожидающем приглашении — удалять нельзя
  if exists (select 1 from public.workspace_members where workspace_id = p_ws and role_key = p_key)
     or exists (select 1 from public.team_invites where workspace_id = p_ws and role_key = p_key and used_at is null) then
    raise exception 'role_in_use' using errcode = 'P0001';
  end if;
  delete from public.ws_roles where workspace_id = p_ws and key = p_key;
  perform public._team_log(p_ws, 'role.delete', null, jsonb_build_object('key', p_key, 'name', v_r.name));
end;
$$;
revoke all on function public.team_role_delete(uuid, text) from public, anon, authenticated;
grant execute on function public.team_role_delete(uuid, text) to authenticated;


-- ✅ ОТМЕТКА: файл 67 запущен
insert into public.schema_migrations (version, name) values (67, 'migration_67_team_foundation.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
