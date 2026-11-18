-- =====================================================
-- ULA FACTORY — миграция 71: аналитика команды (этап 5) — показатели сотрудников, загрузка, качество, отчёты
--
-- team_analytics(кабинет, с, по) — одна функция, только чтение, период не больше 366 дней:
--   • people — по каждому действующему сотруднику: выполнено задач, в срок (%), среднее время выполнения (ч),
--     сдано на проверку и сколько вернули (% возвратов), проверил сам, этапов заказов выполнено и в срок, задержек
--     сообщил, инцидентов решил; сейчас: открытых и просроченных задач, заказов в работе.
--   • totals — по команде: задачи (поставлено/выполнено/в срок/время/возвраты), этапы (в срок), задержки по причинам
--     (сдвиг срока в днях, время до закрытия), инциденты по категориям и важности (время до решения), качество
--     (этапы ОТК, задержки и инциденты по качеству), этапы, на которых чаще всего задержки, понедельная динамика.
-- Кто видит: владелец и право reports.view — всех и итоги команды; остальные — только свою строку (без итогов).
-- Ничего не меняет. ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущен файл 70. Повторный запуск безопасен.
-- =====================================================
begin;

do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 70) then
    raise exception 'СТОП: сначала запустите файл 70 (операционный контроль). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 71) then
    raise exception 'СТОП: файл 71 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;

create or replace function public._ta_person(p_ws uuid, p_user uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with done as (
    select t.* from public.team_tasks t
     where t.workspace_id = p_ws and t.assignee_id = p_user and t.status = 'done' and t.completed_at >= p_from and t.completed_at < p_to
  ), ev as (
    select e.*, t.assignee_id from public.team_task_events e join public.team_tasks t on t.id = e.task_id
     where t.workspace_id = p_ws and e.created_at >= p_from and e.created_at < p_to
  ), ms as (
    select m.* from public.order_milestones m
     where m.workspace_id = p_ws and m.done_by = p_user and m.status = 'done' and m.done_at >= p_from and m.done_at < p_to
  )
  select jsonb_build_object(
    'user_id', p_user,
    'name', (select full_name from public.profiles where user_id = p_user),
    'role_key', (select role_key from public.workspace_members where workspace_id = p_ws and user_id = p_user),
    'tasks_done', (select count(*) from done),
    'tasks_with_due', (select count(*) from done where due_at is not null),
    'tasks_on_time', (select count(*) from done where due_at is not null and completed_at <= due_at),
    'avg_cycle_h', (select round(avg(extract(epoch from completed_at - coalesce(started_at, created_at)) / 3600)::numeric, 1) from done),
    'submitted', (select count(*) from ev where kind = 'status' and to_value = 'submitted' and actor_id = p_user),
    'returned', (select count(*) from ev where kind = 'review' and to_value = 'in_progress' and assignee_id = p_user),
    'reviewed', (select count(*) from ev where kind = 'review' and actor_id = p_user),
    'milestones_done', (select count(*) from ms),
    'milestones_on_time', (select count(*) from ms where due_at is null or done_at <= due_at),
    'delays_reported', (select count(*) from public.order_delays d where d.workspace_id = p_ws and d.reported_by = p_user and d.created_at >= p_from and d.created_at < p_to),
    'incidents_resolved', (select count(*) from public.team_incidents i where i.workspace_id = p_ws and i.owner_id = p_user and i.resolved_at >= p_from and i.resolved_at < p_to),
    'open_now', (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.assignee_id = p_user and t.status in ('todo', 'in_progress', 'blocked')),
    'overdue_now', (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.assignee_id = p_user and t.status in ('todo', 'in_progress', 'blocked') and t.due_at < now()),
    'orders_now', (select count(distinct t.order_id) from public.order_team t join public.orders o on o.id = t.order_id
                    where t.workspace_id = p_ws and t.user_id = p_user and o.status not in ('delivered', 'cancelled')));
$$;
revoke all on function public._ta_person(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public._ta_totals(p_ws uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tasks', (select jsonb_build_object(
        'created', count(*) filter (where created_at >= p_from and created_at < p_to),
        'done', count(*) filter (where status = 'done' and completed_at >= p_from and completed_at < p_to),
        'with_due', count(*) filter (where status = 'done' and completed_at >= p_from and completed_at < p_to and due_at is not null),
        'on_time', count(*) filter (where status = 'done' and completed_at >= p_from and completed_at < p_to and due_at is not null and completed_at <= due_at),
        'avg_cycle_h', round((avg(extract(epoch from completed_at - coalesce(started_at, created_at)) / 3600)
                         filter (where status = 'done' and completed_at >= p_from and completed_at < p_to))::numeric, 1),
        'open_now', count(*) filter (where status in ('todo', 'in_progress', 'blocked', 'submitted')),
        'overdue_now', count(*) filter (where status in ('todo', 'in_progress', 'blocked') and due_at < now()))
      from public.team_tasks where workspace_id = p_ws),
    'reviews', (select jsonb_build_object(
        'submitted', count(*) filter (where e.kind = 'status' and e.to_value = 'submitted'),
        'returned', count(*) filter (where e.kind = 'review' and e.to_value = 'in_progress'),
        'approved', count(*) filter (where e.kind = 'review' and e.to_value = 'done'))
      from public.team_task_events e join public.team_tasks t on t.id = e.task_id
     where t.workspace_id = p_ws and e.created_at >= p_from and e.created_at < p_to),
    'milestones', (select jsonb_build_object(
        'done', count(*),
        'on_time', count(*) filter (where due_at is null or done_at <= due_at),
        'qc_done', count(*) filter (where duty = 'qc'))
      from public.order_milestones where workspace_id = p_ws and status = 'done' and done_at >= p_from and done_at < p_to),
    'delays', (select jsonb_build_object('count', coalesce(sum(n), 0), 'by_category', coalesce(jsonb_object_agg(category, jsonb_build_object(
                 'count', n, 'avg_shift_d', shift_d, 'avg_resolve_h', resolve_h)) filter (where category is not null), '{}'::jsonb))
      from (select category, count(*) n,
                   round((avg(extract(epoch from new_due - old_due) / 86400) filter (where new_due is not null and old_due is not null))::numeric, 1) shift_d,
                   round((avg(extract(epoch from resolved_at - created_at) / 3600) filter (where resolved_at is not null))::numeric, 1) resolve_h
              from public.order_delays where workspace_id = p_ws and created_at >= p_from and created_at < p_to group by category) x),
    'incidents', (select jsonb_build_object(
        'count', count(*),
        'by_category', coalesce((select jsonb_object_agg(category, n) from (select category, count(*) n from public.team_incidents
                                   where workspace_id = p_ws and created_at >= p_from and created_at < p_to group by category) c), '{}'::jsonb),
        'by_severity', coalesce((select jsonb_object_agg(severity, n) from (select severity, count(*) n from public.team_incidents
                                   where workspace_id = p_ws and created_at >= p_from and created_at < p_to group by severity) s), '{}'::jsonb),
        'avg_resolve_h', round((avg(extract(epoch from resolved_at - created_at) / 3600) filter (where resolved_at is not null))::numeric, 1),
        'open_now', (select count(*) from public.team_incidents where workspace_id = p_ws and status in ('open', 'investigating')))
      from public.team_incidents where workspace_id = p_ws and created_at >= p_from and created_at < p_to),
    'quality', jsonb_build_object(
        'qc_milestones_done', (select count(*) from public.order_milestones where workspace_id = p_ws and duty = 'qc' and status = 'done' and done_at >= p_from and done_at < p_to),
        'qc_milestones_delayed', (select count(distinct d.milestone_id) from public.order_delays d join public.order_milestones m on m.id = d.milestone_id
                                   where d.workspace_id = p_ws and m.duty = 'qc' and d.created_at >= p_from and d.created_at < p_to),
        'quality_delays', (select count(*) from public.order_delays where workspace_id = p_ws and category = 'quality' and created_at >= p_from and created_at < p_to),
        'quality_incidents', (select count(*) from public.team_incidents where workspace_id = p_ws and category = 'quality' and created_at >= p_from and created_at < p_to)),
    'steps', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'delays', n) order by n desc, title) from (
        select m.title, count(*) n from public.order_delays d join public.order_milestones m on m.id = d.milestone_id
         where d.workspace_id = p_ws and d.created_at >= p_from and d.created_at < p_to group by m.title order by count(*) desc, m.title limit 10) s), '[]'::jsonb),
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('week', w, 'tasks_created', c, 'tasks_done', d, 'delays', dl, 'incidents', inc) order by w) from (
        select g::date w,
               (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.created_at >= g and t.created_at < g + interval '7 days') c,
               (select count(*) from public.team_tasks t where t.workspace_id = p_ws and t.status = 'done' and t.completed_at >= g and t.completed_at < g + interval '7 days') d,
               (select count(*) from public.order_delays x where x.workspace_id = p_ws and x.created_at >= g and x.created_at < g + interval '7 days') dl,
               (select count(*) from public.team_incidents x where x.workspace_id = p_ws and x.created_at >= g and x.created_at < g + interval '7 days') inc
          from generate_series(date_trunc('week', p_from), p_to - interval '1 second', interval '7 days') g) s), '[]'::jsonb));
$$;
revoke all on function public._ta_totals(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.team_analytics(p_ws uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me  uuid := auth.uid();
  v_all boolean;
begin
  if v_me is null or not public.team_in(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '366 days' then raise exception 'bad_dates' using errcode = '22023'; end if;
  v_all := public.team_has_perm(p_ws, 'reports.view');
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'all', v_all,
    'people', coalesce((select jsonb_agg(public._ta_person(p_ws, m.user_id, p_from, p_to) order by p.full_name)
                          from public.workspace_members m join public.profiles p on p.user_id = m.user_id
                         where m.workspace_id = p_ws and m.deactivated_at is null and (v_all or m.user_id = v_me)), '[]'::jsonb),
    'totals', case when v_all then public._ta_totals(p_ws, p_from, p_to) end);
end;
$$;
revoke all on function public.team_analytics(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.team_analytics(uuid, timestamptz, timestamptz) to authenticated;

insert into public.schema_migrations (version, name) values (71, 'migration_71_team_analytics.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
