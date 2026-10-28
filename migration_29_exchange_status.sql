-- =====================================================
-- ULA FACTORY — миграция 29: статус заявки на обмен для клиента
--
-- Чтобы клиент не беспокоился, он видит, что происходит с его заявкой и сколько ждать:
--   new        — ждёт оплаты (клиент видит реквизиты и кнопку «Загрузить скриншот»);
--   paid       — скриншот получен, продавец проверяет оплату;
--   confirmed  — оплата подтверждена, юани отправляются — «ожидайте до 14:30» (время ставит байер);
--   done       — юани отправлены;
--   cancelled  — отменено.
--
--   • exchange_requests: новый статус confirmed, eta_until (до какого времени ждать),
--     buyer_note (сообщение клиенту), status_at (когда сменился статус — ставится сам).
--   • workspaces.fx_eta — «обычно отправляем юани в течение N минут»: клиент видит до оплаты.
--   • get_exchange_status(id) — для клиента без входа: статус своей заявки по секретному номеру.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_28_exchange.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 29) then
      raise exception 'СТОП: файл 29 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Заявки: статус «оплата подтверждена», время ожидания, сообщение клиенту
alter table public.exchange_requests drop constraint if exists exchange_requests_status_check;
alter table public.exchange_requests add constraint exchange_requests_status_check
  check (status in ('new', 'paid', 'confirmed', 'done', 'cancelled'));
alter table public.exchange_requests add column if not exists eta_until timestamptz;
alter table public.exchange_requests add column if not exists buyer_note text;
alter table public.exchange_requests add column if not exists status_at timestamptz;
alter table public.exchange_requests drop constraint if exists exchange_requests_buyer_note_check;
alter table public.exchange_requests add constraint exchange_requests_buyer_note_check
  check (buyer_note is null or char_length(buyer_note) <= 300);
grant update (status, eta_until, buyer_note) on public.exchange_requests to authenticated;

-- время смены статуса ставится само; время ожидания — не дальше 7 дней
create or replace function public._fx_req_touch()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then new.status_at := now(); end if;
  if new.eta_until is not null and new.eta_until > now() + interval '7 days' then
    new.eta_until := now() + interval '7 days';
  end if;
  return new;
end;
$$;
drop trigger if exists fx_req_touch on public.exchange_requests;
create trigger fx_req_touch before insert or update on public.exchange_requests
  for each row execute function public._fx_req_touch();
update public.exchange_requests set status_at = coalesce(paid_at, created_at) where status_at is null;


-- 2. Обычное время отправки юаней (минуты) — клиент видит до оплаты
alter table public.workspaces add column if not exists fx_eta int;
alter table public.workspaces drop constraint if exists workspaces_fx_eta_check;
alter table public.workspaces add constraint workspaces_fx_eta_check check (fx_eta is null or fx_eta between 1 and 10080);
grant update (fx_eta) on public.workspaces to authenticated;

create or replace function public.ws_fx(p_ws uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select case when w.fx_on and w.fx_tiers is not null then
    json_build_object('tiers', w.fx_tiers, 'note', w.fx_note, 'updated_at', w.fx_updated_at, 'eta', w.fx_eta)
  end
  from public.workspaces w where w.id = p_ws;
$$;
revoke all on function public.ws_fx(uuid) from public, anon, authenticated;


-- 3. Для клиента: статус своей заявки (по секретному номеру, который он получил при отправке)
create or replace function public.get_exchange_status(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
    -- реквизиты нужны, только пока заявка ждёт оплаты
    'note',       case when r.status = 'new' then w.fx_note end,
    'eta',        w.fx_eta,
    'can_upload', r.status = 'new' and r.proof_path is null and r.created_at > now() - interval '1 day',
    'brand',      json_build_object('name', w.name, 'logo', w.logo_path)
  )
  from public.exchange_requests r
  join public.workspaces w on w.id = r.workspace_id
  where r.id = p_id
    and r.created_at > now() - interval '60 days';
$$;
revoke all on function public.get_exchange_status(uuid) from public, anon, authenticated;
grant execute on function public.get_exchange_status(uuid) to anon, authenticated;

-- ✅ ОТМЕТКА: файл 29 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (29, 'migration_29_exchange_status.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
