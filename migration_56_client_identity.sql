-- =====================================================
-- ULA FACTORY — миграция 56: постоянный номер клиента вместо «последних 9 цифр телефона или имени»
--
-- ПРОБЛЕМА. Раньше «один и тот же клиент» определялся ключом client_key(): последние 9 цифр телефона,
-- а без телефона — имя. Но «+996 700 111 222» и «+7 700 111 222» (разные страны) или два «Айбека»
-- без телефона — разные люди. Из-за этого могли смешаться заказы, долги, предоплата (баланс клиента)
-- и общая ссылка клиента.
--
-- КАК ТЕПЕРЬ. Клиент — это строка в таблице clients (её id уже был в orders.client_id). Новой системы не
-- заводим, а делаем эту основой для всего:
--   • orders.client_id      — у КАЖДОГО заказа есть клиент (если карточки нет — создаётся «клиент без карточки»,
--                             в списке «Клиенты» он не показывается, пока клиент не заполнит адрес);
--   • client_wallet.client_id — предоплата принадлежит клиенту, а не ключу;
--   • client_cabinets.client_id — общая ссылка принадлежит клиенту.
--   Один и тот же человек в РАЗНЫХ кабинетах байеров — разные строки clients (у каждого байера свои клиенты).
--
-- КАК ЗАКАЗ ПОПАДАЕТ К КЛИЕНТУ (новые заказы, триггер orders_link_client):
--   • телефон с кодом страны («+996…», «00996…»; номер без «+» из 11+ цифр тоже считается международным)
--     совпал ПОЛНОСТЬЮ с ровно одним клиентом этого кабинета → заказ к нему;
--   • иначе создаётся новый клиент. Заявки по ссылке (source = request) никогда не присоединяются
--     к существующему клиенту сами: заявку подаёт посторонний человек и может вписать чужой номер.
--   Совпадение только последних 9 цифр, только имени, номер без кода страны — НЕ объединяют никого.
--   Такие пары показываются списком «Возможные совпадения» (Клиенты → «Совпадения»), объединяет владелец
--   кабинета вручную, по одной паре, с подтверждением (функция client_merge, всё записывается в client_merge_log).
--
-- ПЕРЕНОС СТАРЫХ ДАННЫХ (один раз, внутри этого файла; повторный запуск его пропускает):
--   1. Заказы без client_id: ровно один клиент этого кабинета с таким же полным номером → к нему;
--      иначе создаётся клиент. Без номера — отдельный клиент на каждый заказ (имя ничего не доказывает).
--   2. Предоплата (client_wallet) и общие ссылки (client_cabinets): старый ключ связывается с клиентом
--      ТОЛЬКО если под этим ключом оказался ровно один клиент. Иначе деньги остаются «неразобранными»
--      (client_id пусто, в балансы не входят, историю не трогаем), а ссылка отключается (client_id пусто:
--      страница клиента сообщит «ссылка не найдена»). Причина записана в client_link_review.
--      Деньги спорных ключей никуда автоматически не распределяются.
--   3. До и после переноса считаются суммы по кабинетам и валютам (client_migration_audit). Если хоть одна
--      сумма не совпала — весь файл откатывается («СТОП»), ничего не меняется.
--   Ссылки отдельных заказов (?order=…) не затрагиваются: они ищут заказ по своему токену.
--
-- ЧТО ИЗМЕНЯЕТСЯ В ФУНКЦИЯХ (имена те же, кроме wallet_add, у которого новые параметры):
--   wallet_add(p_client, p_currency, p_amount, p_kind, p_note, p_apply), wallet_order, wallet_undo, wallet_totals,
--   client_cabinet, get_client_cabinet, get_cabinet_order, get_client_order, client_order_json.
--   Новые: client_link_candidates, client_merge, client_link_dismiss, client_wallet_review, client_wallet_assign_rows, wallet_reconcile; save_client_info (форма адреса) тоже изменена.
--   Старые функции client_key() и столбцы ckey остаются (история), но новые записи их не используют.
--
-- ПРЕДВАРИТЕЛЬНЫЕ УСЛОВИЯ (проверяются в начале файла):
--   • файл 50 запущен (баланс клиента) — без него файл остановится; файл 51 для этого файла не нужен;
--   • после файла 56 нужно обновить сайт (js/wallet.js, js/debts.js и др. из этого же коммита): старый сайт
--     вызывает wallet_add по-старому и получит ошибку;
--   • до запуска на рабочей базе: диагностика (scripts/diagnose_supabase_readonly.sql) и настоящая
--     резервная копия с пробным восстановлением (BACKUP.md);
--   • запускать в Supabase → SQL Editor целиком одним запросом: файл сам открывает транзакцию (BEGIN … COMMIT),
--     при любой ошибке откатывается ВСЁ — структуры, данные, функции и отметка о запуске.
--
-- ССЫЛКА ОТДЕЛЬНОГО ЗАКАЗА (?order=…) и КАРТОЧКА КЛИЕНТА. Совпадение телефона не даёт ссылке заказа доступа к
--   чужой карточке (адрес, контакты). Поле orders.client_card_ok = «эта карточка создана по ссылке ЭТОГО заказа».
--   • при переносе оно ставится только заказам, у которых клиент уже был (его создала форма адреса по их же ссылке);
--   • автосвязь по номеру, заявки и объединение клиентов его НЕ ставят (объединение его сбрасывает);
--   • get_client_order показывает карточку и save_client_info меняет её только если поле = true; иначе форма
--     адреса создаёт для заказа НОВУЮ карточку (чужая не читается и не перезаписывается).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_51_business_overview.sql. Можно запускать повторно (перенос данных не повторяется).
-- =====================================================

begin;

-- ⛔ ЗАЩИТА
do $$
begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 50) then
    raise exception 'СТОП: сначала запустите миграцию 50 (баланс клиента). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 56) then
    raise exception 'СТОП: файл 56 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;


-- 1. Телефон: нормальный вид для точного сравнения (без «последних 9 цифр»)
--    '+996 700-111-222', '00996700111222', '996700111222' → '+996700111222' (международный)
--    '0700111222', '700111222'                              → без плюса: номер без кода страны (местный)
--    короче 9 или длиннее 15 цифр → пусто
create or replace function public.phone_norm(p text)
returns text
language sql
immutable
set search_path = public
as $$
  with s as (
    select btrim(coalesce(p, '')) as raw, regexp_replace(coalesce(p, ''), '\D', '', 'g') as d
  )
  select case
    when raw like '+%' and char_length(d) between 9 and 15 then '+' || d
    when d like '00%' and char_length(substr(d, 3)) between 9 and 15 then '+' || substr(d, 3)
    when char_length(d) not between 9 and 15 then null
    when d like '0%' then d
    when char_length(d) >= 11 then '+' || d
    else d
  end
  from s;
$$;

create or replace function public._client_stub_name(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select case when char_length(btrim(coalesce(p, ''))) < 2 then 'Без имени' else left(btrim(p), 120) end;
$$;


-- 2. Клиент без карточки: имя и телефон есть, города и адреса нет
alter table public.clients alter column city  drop not null;
alter table public.clients alter column phone drop not null;
alter table public.clients drop constraint if exists clients_one_place;
alter table public.clients add constraint clients_one_place check (not (address is not null and pickup_point is not null));
alter table public.clients add column if not exists match_phone text;      -- по нему ищем совпадения; публичная форма заказа его не меняет
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'clients' and column_name = 'has_card') then
    alter table public.clients add column has_card boolean generated always as (city is not null) stored;
  end if;
end $$;
create index if not exists clients_match_idx on public.clients (workspace_id, match_phone) where match_phone is not null;
-- «карточка этого заказа»: показывается на странице заказа и меняется формой адреса только если true (см. заголовок)
alter table public.orders add column if not exists client_card_ok boolean not null default false;

create or replace function public._clients_match_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.match_phone is null then new.match_phone := public.phone_norm(new.phone); end if;
  return new;
end;
$$;
revoke all on function public._clients_match_phone() from public, anon, authenticated;
drop trigger if exists clients_match_phone on public.clients;
create trigger clients_match_phone before insert on public.clients
  for each row execute function public._clients_match_phone();

-- Байер исправил телефон клиента → ключ поиска совпадений следует за ним. Публичная форма (не участник кабинета)
-- ключ не меняет: иначе посторонний мог бы «подвесить» чужую карточку на любой номер.
create or replace function public._clients_match_phone_upd()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.phone is distinct from old.phone and public.is_member(new.workspace_id) then
    new.match_phone := public.phone_norm(new.phone);
  end if;
  return new;
end;
$$;
revoke all on function public._clients_match_phone_upd() from public, anon, authenticated;
drop trigger if exists clients_match_phone_upd on public.clients;
create trigger clients_match_phone_upd before update of phone on public.clients
  for each row execute function public._clients_match_phone_upd();


-- 3. Служебные таблицы (читаются только через функции ниже)
create table if not exists public.client_link_review (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          text not null check (kind in ('wallet', 'cabinet')),
  legacy_key    text not null,
  reason        text not null check (reason in ('ambiguous', 'no_client', 'not_subset')),
  candidate_ids uuid[] not null default '{}',
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid,
  resolution    text
);
create table if not exists public.client_link_dismissed (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  a_id         uuid not null,
  b_id         uuid not null,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  primary key (a_id, b_id),
  check (a_id < b_id)
);
create table if not exists public.client_merge_log (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kept_id      uuid not null,
  dropped_id   uuid not null,
  dropped      jsonb not null,
  order_ids    uuid[] not null default '{}',
  wallet_ids   uuid[] not null default '{}',
  merged_by    uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create table if not exists public.client_migration_audit (
  id           bigserial primary key,
  run_id       uuid not null,
  stage        text not null check (stage in ('before', 'after')),
  workspace_id uuid not null,
  currency     text not null,
  metric       text not null,
  value        numeric not null,
  created_at   timestamptz not null default now()
);
create table if not exists public.client_wallet_assign_log (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  wallet_id    uuid not null,
  legacy_key   text,
  currency     text not null,
  amount       numeric not null,
  to_client    uuid not null,
  assigned_by  uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create unique index if not exists client_wallet_assign_log_once on public.client_wallet_assign_log (wallet_id);
alter table public.client_wallet_assign_log enable row level security;
revoke all on public.client_wallet_assign_log from anon, authenticated;
alter table public.client_link_review     enable row level security;
alter table public.client_link_dismissed  enable row level security;
alter table public.client_merge_log       enable row level security;
alter table public.client_migration_audit enable row level security;
revoke all on public.client_link_review, public.client_link_dismissed, public.client_merge_log, public.client_migration_audit from anon, authenticated;


-- 4. Предоплата и ссылки принадлежат клиенту
alter table public.client_wallet add column if not exists client_id uuid references public.clients(id) on delete restrict;
alter table public.client_wallet alter column ckey drop not null;
alter table public.client_wallet drop constraint if exists client_wallet_who;
alter table public.client_wallet add constraint client_wallet_who check (client_id is not null or ckey is not null);
create index if not exists client_wallet_client_id_idx on public.client_wallet (workspace_id, client_id, created_at desc);

do $$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.client_cabinets'::regclass and contype = 'p'
                and conname = 'client_cabinets_pkey'
                and (select count(*) from pg_attribute a where a.attrelid = conrelid and a.attnum = any (conkey)) = 2) then
    alter table public.client_cabinets drop constraint client_cabinets_pkey;
  end if;
end $$;
alter table public.client_cabinets add column if not exists id uuid not null default gen_random_uuid();
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.client_cabinets'::regclass and contype = 'p') then
    alter table public.client_cabinets add primary key (id);
  end if;
end $$;
alter table public.client_cabinets alter column ckey drop not null;
alter table public.client_cabinets add column if not exists client_id uuid references public.clients(id) on delete cascade;
create unique index if not exists client_cabinets_client_uidx on public.client_cabinets (client_id) where client_id is not null;
create index if not exists client_cabinets_legacy_idx on public.client_cabinets (workspace_id, ckey) where ckey is not null;


-- 5. ПЕРЕНОС СТАРЫХ ДАННЫХ (один раз)
do $mig$
declare
  v_run   uuid := gen_random_uuid();
  o       record;
  r       record;
  v_pn    text;
  v_n     int;
  v_id    uuid;
  v_cands uuid[];
  v_bad   text;
begin
  if exists (select 1 from public.schema_migrations where version = 56)
     or exists (select 1 from public.client_migration_audit where stage = 'after') then
    raise notice 'Перенос клиентов уже выполнен — повторно не запускаю.';
    return;
  end if;

  -- «до»: суммы по кабинетам и валютам
  insert into public.client_migration_audit (run_id, stage, workspace_id, currency, metric, value)
  select v_run, 'before', workspace_id, currency, 'wallet_total', sum(amount) from public.client_wallet group by workspace_id, currency
  union all
  select v_run, 'before', workspace_id, currency, 'wallet_rows', count(*) from public.client_wallet group by workspace_id, currency
  union all
  select v_run, 'before', workspace_id, coalesce(client_currency, 'KGS'), 'orders_paid', sum(paid_amount) from public.orders group by workspace_id, coalesce(client_currency, 'KGS')
  union all
  select v_run, 'before', workspace_id, coalesce(client_currency, 'KGS'), 'orders_balance', sum(coalesce(balance_som, 0)) from public.orders group by workspace_id, coalesce(client_currency, 'KGS')
  union all
  select v_run, 'before', workspace_id, coalesce(client_currency, 'KGS'), 'orders_count', count(*) from public.orders group by workspace_id, coalesce(client_currency, 'KGS');

  -- старый ключ каждого заказа и каждой карточки (до любых изменений)
  drop table if exists _ula_ok;
  drop table if exists _ula_ck;
  create temp table _ula_ok on commit drop as
    select ord.id as order_id, ord.workspace_id,
           public.client_key(coalesce(c.phone, ord.client_phone), coalesce(c.name, ord.client_name)) as ckey
      from public.orders ord left join public.clients c on c.id = ord.client_id;
  create temp table _ula_ck on commit drop as
    select c.id, c.workspace_id, public.client_key(c.phone, c.name) as ckey from public.clients c;

  -- не менять updated_at, не писать историю «адрес обновлён» при переносе
  alter table public.orders  disable trigger user;
  alter table public.clients disable trigger user;

  update public.clients set match_phone = public.phone_norm(phone) where match_phone is null and phone is not null;
  -- клиент у заказа уже был → его создала форма адреса по ссылке этого заказа: доступ прежний, не шире
  update public.orders set client_card_ok = true where client_id is not null;

  -- 5.1 заказы без клиента
  for o in select id, workspace_id, client_name, client_phone from public.orders where client_id is null order by created_at, id loop
    v_pn := public.phone_norm(o.client_phone);
    v_id := null; v_n := 0;
    if v_pn is not null then
      select count(*), (array_agg(id))[1] into v_n, v_id
        from public.clients where workspace_id = o.workspace_id and match_phone = v_pn;
      if v_n <> 1 then v_id := null; end if;
    end if;
    if v_id is null then
      insert into public.clients (workspace_id, name, phone, match_phone)
      values (o.workspace_id, public._client_stub_name(o.client_name), v_pn, v_pn)
      returning id into v_id;
    end if;
    update public.orders set client_id = v_id where id = o.id;
  end loop;

  -- 5.2 предоплата: ключ → клиент только если клиент ровно один
  for r in select workspace_id, ckey from public.client_wallet where client_id is null and ckey is not null group by workspace_id, ckey loop
    select coalesce(array_agg(distinct x), '{}') into v_cands from (
      select ord.client_id as x from _ula_ok k join public.orders ord on ord.id = k.order_id
       where k.workspace_id = r.workspace_id and k.ckey = r.ckey
      union
      select id from _ula_ck where workspace_id = r.workspace_id and ckey = r.ckey
    ) s;
    if cardinality(v_cands) = 1 then
      update public.client_wallet set client_id = v_cands[1]
       where workspace_id = r.workspace_id and ckey = r.ckey and client_id is null;
    else
      insert into public.client_link_review (workspace_id, kind, legacy_key, reason, candidate_ids)
      values (r.workspace_id, 'wallet', r.ckey, case when cardinality(v_cands) = 0 then 'no_client' else 'ambiguous' end, v_cands);
    end if;
  end loop;

  -- 5.3 общие ссылки: ключ → клиент только если клиент один и ссылка не откроет чужих заказов
  for r in select id, workspace_id, ckey from public.client_cabinets where client_id is null and ckey is not null loop
    select coalesce(array_agg(distinct x), '{}') into v_cands from (
      select ord.client_id as x from _ula_ok k join public.orders ord on ord.id = k.order_id
       where k.workspace_id = r.workspace_id and k.ckey = r.ckey
      union
      select id from _ula_ck where workspace_id = r.workspace_id and ckey = r.ckey
    ) s;
    if cardinality(v_cands) = 1
       and not exists (select 1 from public.orders ord join _ula_ok k on k.order_id = ord.id
                        where ord.client_id = v_cands[1] and k.ckey <> r.ckey)
       and not exists (select 1 from public.client_cabinets z where z.client_id = v_cands[1]) then
      update public.client_cabinets set client_id = v_cands[1] where id = r.id;
    else
      insert into public.client_link_review (workspace_id, kind, legacy_key, reason, candidate_ids)
      values (r.workspace_id, 'cabinet', r.ckey,
              case when cardinality(v_cands) = 0 then 'no_client' when cardinality(v_cands) > 1 then 'ambiguous' else 'not_subset' end, v_cands);
    end if;
  end loop;

  alter table public.orders  enable trigger user;
  alter table public.clients enable trigger user;

  -- «после»
  insert into public.client_migration_audit (run_id, stage, workspace_id, currency, metric, value)
  select v_run, 'after', workspace_id, currency, 'wallet_total', sum(amount) from public.client_wallet group by workspace_id, currency
  union all
  select v_run, 'after', workspace_id, currency, 'wallet_rows', count(*) from public.client_wallet group by workspace_id, currency
  union all
  select v_run, 'after', workspace_id, coalesce(client_currency, 'KGS'), 'orders_paid', sum(paid_amount) from public.orders group by workspace_id, coalesce(client_currency, 'KGS')
  union all
  select v_run, 'after', workspace_id, coalesce(client_currency, 'KGS'), 'orders_balance', sum(coalesce(balance_som, 0)) from public.orders group by workspace_id, coalesce(client_currency, 'KGS')
  union all
  select v_run, 'after', workspace_id, coalesce(client_currency, 'KGS'), 'orders_count', count(*) from public.orders group by workspace_id, coalesce(client_currency, 'KGS')
  union all
  select v_run, 'after', workspace_id, currency, 'wallet_assigned', coalesce(sum(amount) filter (where client_id is not null), 0) from public.client_wallet group by workspace_id, currency
  union all
  select v_run, 'after', workspace_id, currency, 'wallet_unassigned', coalesce(sum(amount) filter (where client_id is null), 0) from public.client_wallet group by workspace_id, currency;

  -- проверки: любая разница — откат всего файла
  select string_agg(b.workspace_id::text || '/' || b.currency || '/' || b.metric, ', ') into v_bad
    from public.client_migration_audit b
    left join public.client_migration_audit a
      on a.run_id = b.run_id and a.stage = 'after' and a.workspace_id = b.workspace_id and a.currency = b.currency and a.metric = b.metric
   where b.run_id = v_run and b.stage = 'before' and a.value is distinct from b.value;
  if v_bad is not null then raise exception 'СТОП: суммы до и после переноса не совпали (%). Ничего не изменено.', v_bad; end if;

  select string_agg(w.workspace_id::text || '/' || w.currency, ', ') into v_bad
    from (select a1.workspace_id, a1.currency
            from public.client_migration_audit a1
            join public.client_migration_audit a2 on a2.run_id = a1.run_id and a2.workspace_id = a1.workspace_id and a2.currency = a1.currency and a2.metric = 'wallet_unassigned'
            join public.client_migration_audit a3 on a3.run_id = a1.run_id and a3.workspace_id = a1.workspace_id and a3.currency = a1.currency and a3.metric = 'wallet_total'
           where a1.run_id = v_run and a1.metric = 'wallet_assigned' and a1.value + a2.value <> a3.value) w;
  if v_bad is not null then raise exception 'СТОП: распределённые и неразобранные суммы не сходятся (%). Ничего не изменено.', v_bad; end if;

  if exists (select 1 from public.orders where client_id is null) then
    raise exception 'СТОП: остались заказы без клиента. Ничего не изменено.';
  end if;
  raise notice 'Перенос клиентов выполнен. Неразобранных связей: %', (select count(*) from public.client_link_review where resolved_at is null);
end
$mig$;


-- 6. Новые заказы: к какому клиенту относится (см. заголовок файла)
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
drop trigger if exists orders_link_client on public.orders;
create trigger orders_link_client before insert or update of client_name, client_phone, client_id on public.orders
  for each row execute function public._orders_link_client();


-- 7. Предоплата по клиенту
drop function if exists public._wallet_sum(uuid, text, text);
drop function if exists public._wallet_lock(uuid, text);
drop function if exists public.wallet_totals(uuid);

create or replace function public._wallet_sum(p_ws uuid, p_client uuid, p_cur text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0) from public.client_wallet
   where workspace_id = p_ws and client_id = p_client and currency = p_cur;
$$;
revoke all on function public._wallet_sum(uuid, uuid, text) from public, anon, authenticated;

create or replace function public._wallet_lock(p_ws uuid, p_client uuid)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended(p_ws::text || '|' || p_client::text, 50));
$$;
revoke all on function public._wallet_lock(uuid, uuid) from public, anon, authenticated;

-- Оплатить заказ с баланса его клиента ('pay') или вернуть оплату на баланс ('return')
create or replace function public.wallet_order(p_order uuid, p_dir text, p_amount numeric default null)
returns numeric
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  o        record;
  v_ws     uuid;
  v_client uuid;
  v_x      numeric;
begin
  if p_dir not in ('pay', 'return') then raise exception 'bad_action' using errcode = '22023'; end if;
  if p_amount is not null and p_amount <= 0 then raise exception 'bad_amount' using errcode = '22023'; end if;

  select ord.workspace_id, ord.client_id into v_ws, v_client from public.orders ord where ord.id = p_order;
  if v_ws is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_client is null then raise exception 'client_not_linked' using errcode = '22023'; end if;

  perform public._wallet_lock(v_ws, v_client);
  select ord.*, c.name as cname into o
    from public.orders ord join public.clients c on c.id = ord.client_id
   where ord.id = p_order
     for update of ord;

  if p_dir = 'pay' then
    if o.status = 'cancelled' then raise exception 'order_cancelled' using errcode = '22023'; end if;
    v_x := least(greatest(o.balance_som, 0), public._wallet_sum(v_ws, v_client, o.client_currency), coalesce(p_amount, 1e15));
    if v_x <= 0 then raise exception 'no_funds' using errcode = '22023'; end if;
    update public.orders set paid_amount = paid_amount + v_x where id = p_order;
    insert into public.client_wallet (workspace_id, client_id, client_name, currency, amount, kind, order_id, order_number)
    values (o.workspace_id, v_client, left(coalesce(o.cname, ''), 120), o.client_currency, -v_x, 'order', p_order, o.order_number);
  else
    v_x := least(o.paid_amount, coalesce(p_amount, o.paid_amount));
    if v_x <= 0 then raise exception 'nothing_paid' using errcode = '22023'; end if;
    update public.orders set paid_amount = paid_amount - v_x where id = p_order;
    insert into public.client_wallet (workspace_id, client_id, client_name, currency, amount, kind, order_id, order_number)
    values (o.workspace_id, v_client, left(coalesce(o.cname, ''), 120), o.client_currency, v_x, 'return', p_order, o.order_number);
  end if;
  return v_x;
end;
$$;
revoke all on function public.wallet_order(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.wallet_order(uuid, text, numeric) to authenticated;

-- Старый сайт (открытая вкладка, установленное приложение) вызывает wallet_add по-старому (ключом, а не клиентом).
-- Угадывать, чьи это деньги, нельзя: вызов отклоняется понятной ошибкой, ничего не сохраняется.
create or replace function public.wallet_add(p_ws uuid, p_key text, p_name text, p_currency text, p_amount numeric,
                                             p_kind text, p_note text default null, p_apply boolean default false)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  raise exception 'app_update_required: Обновите страницу или приложение — версия устарела, операция не выполнена' using errcode = '22023';
end;
$$;
revoke all on function public.wallet_add(uuid, text, text, text, numeric, text, text, boolean) from public, anon, authenticated;
grant execute on function public.wallet_add(uuid, text, text, text, numeric, text, text, boolean) to authenticated;

-- Пополнить (deposit), вернуть клиенту (withdraw) или исправить (fix) баланс конкретного клиента.
-- p_apply — после пополнения сразу оплатить долги ЭТОГО клиента в этой валюте, начиная со старых заказов.
create or replace function public.wallet_add(p_client uuid, p_currency text, p_amount numeric,
                                             p_kind text, p_note text default null, p_apply boolean default false)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws   uuid;
  v_name text;
  v_amt  numeric;
  v_left numeric;
  v_x    numeric;
  v_paid numeric := 0;
  v_n    int := 0;
  r      record;
begin
  select c.workspace_id, c.name into v_ws, v_name from public.clients c where c.id = p_client;
  if v_ws is null then raise exception 'bad_client' using errcode = '22023'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_currency, '') !~ '^[A-Z]{3}$' then raise exception 'bad_currency' using errcode = '22023'; end if;
  if p_kind not in ('deposit', 'withdraw', 'fix') then raise exception 'bad_action' using errcode = '22023'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1e11 or (p_kind <> 'fix' and p_amount < 0) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  p_note := nullif(left(btrim(coalesce(p_note, '')), 200), '');

  perform public._wallet_lock(v_ws, p_client);
  v_amt := case p_kind when 'withdraw' then -p_amount else p_amount end;
  if p_kind = 'withdraw' and public._wallet_sum(v_ws, p_client, p_currency) < p_amount then
    raise exception 'no_funds' using errcode = '22023';
  end if;

  insert into public.client_wallet (workspace_id, client_id, client_name, currency, amount, kind, note)
  values (v_ws, p_client, left(coalesce(v_name, ''), 120), p_currency, round(v_amt, 2), p_kind, p_note);

  if p_apply and p_kind = 'deposit' then
    v_left := public._wallet_sum(v_ws, p_client, p_currency);
    for r in
      select ord.id, ord.balance_som, ord.order_number
        from public.orders ord
       where ord.workspace_id = v_ws
         and ord.client_id = p_client
         and ord.client_currency = p_currency
         and ord.status <> 'cancelled'
         and ord.client_price is not null
         and ord.balance_som > 0
       order by ord.order_date, ord.created_at
       for update of ord
    loop
      exit when v_left <= 0;
      v_x := least(r.balance_som, v_left);
      update public.orders set paid_amount = paid_amount + v_x where id = r.id;
      insert into public.client_wallet (workspace_id, client_id, client_name, currency, amount, kind, order_id, order_number)
      values (v_ws, p_client, left(coalesce(v_name, ''), 120), p_currency, -v_x, 'order', r.id, r.order_number);
      v_left := v_left - v_x; v_paid := v_paid + v_x; v_n := v_n + 1;
    end loop;
  end if;

  return json_build_object('balance', public._wallet_sum(v_ws, p_client, p_currency), 'paid', v_paid, 'orders', v_n);
end;
$$;
revoke all on function public.wallet_add(uuid, text, numeric, text, text, boolean) from public, anon, authenticated;
grant execute on function public.wallet_add(uuid, text, numeric, text, text, boolean) to authenticated;

-- Отменить строку выписки (только владелец кабинета). Неразобранные строки (без клиента) отменять нельзя.
create or replace function public.wallet_undo(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  w record;
begin
  select * into w from public.client_wallet where id = p_id;
  if w.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.is_owner(w.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if w.client_id is null then raise exception 'needs_review' using errcode = '22023'; end if;
  perform public._wallet_lock(w.workspace_id, w.client_id);
  if w.amount > 0 and public._wallet_sum(w.workspace_id, w.client_id, w.currency) < w.amount then
    raise exception 'no_funds' using errcode = '22023';
  end if;
  if w.order_id is not null and w.kind in ('order', 'return') then
    update public.orders set paid_amount = greatest(0, paid_amount + w.amount) where id = w.order_id;
  end if;
  delete from public.client_wallet where id = p_id;
end;
$$;
revoke all on function public.wallet_undo(uuid) from public, anon, authenticated;
grant execute on function public.wallet_undo(uuid) to authenticated;

-- Балансы клиентов кабинета (только ненулевые; неразобранные деньги сюда не входят)
create or replace function public.wallet_totals(p_ws uuid)
returns table (client_id uuid, client_name text, currency text, amount numeric, last_at timestamptz, ckey text)
language sql
stable
security definer
set search_path = public
as $$
  -- ckey нужен только старому сайту (он читает это поле): 'client:<id>' не совпадёт ни с одним старым ключом,
  -- поэтому старая вкладка не припишет баланс чужому человеку
  select w.client_id, (array_agg(c.name))[1], w.currency, sum(w.amount), max(w.created_at), 'client:' || w.client_id::text
    from public.client_wallet w join public.clients c on c.id = w.client_id
   where w.workspace_id = p_ws and public.is_member(p_ws)
   group by w.client_id, w.currency
  having sum(w.amount) <> 0;
$$;
revoke all on function public.wallet_totals(uuid) from public, anon, authenticated;
grant execute on function public.wallet_totals(uuid) to authenticated;

-- Заказ удалён — списанное за него возвращается на баланс того же клиента (или в неразобранные, если строка была там)
create or replace function public._wallet_order_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_wallet (workspace_id, client_id, ckey, client_name, currency, amount, kind, order_number, note)
  select w.workspace_id, w.client_id, w.ckey, (array_agg(w.client_name))[1], w.currency, -sum(w.amount), 'return', old.order_number, 'deleted'
    from public.client_wallet w
   where w.order_id = old.id and w.kind in ('order', 'return')
   group by w.workspace_id, w.client_id, w.ckey, w.currency
  having sum(w.amount) < 0;
  return old;
end;
$$;
revoke all on function public._wallet_order_deleted() from public, anon, authenticated;


-- 8. Разбор спорных данных (только владелец кабинета; каждое действие — одно подтверждённое решение)

-- Неразобранные деньги старой предоплаты: каждая операция отдельной строкой (ключ был общим для нескольких людей
-- или клиента не нашлось). Эти деньги не входят ни в чей баланс, но входят в сверку (wallet_reconcile).
create or replace function public.client_wallet_review(p_ws uuid)
returns table (id uuid, legacy_key text, client_name text, currency text, amount numeric, kind text, note text,
               order_number text, created_at timestamptz, candidates jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.ckey, w.client_name, w.currency, w.amount, w.kind, w.note, w.order_number, w.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone,
                    'orders', (select count(*) from public.orders o where o.client_id = c.id)))
             from public.clients c
            where c.workspace_id = p_ws
              and c.id = any (coalesce((select r.candidate_ids from public.client_link_review r
                                         where r.workspace_id = p_ws and r.kind = 'wallet' and r.legacy_key = w.ckey
                                         order by r.created_at desc limit 1), '{}'))
         ), '[]'::jsonb)
    from public.client_wallet w
   where w.workspace_id = p_ws and w.client_id is null and w.ckey is not null and public.is_member(p_ws)
   order by w.ckey, w.created_at, w.id
   limit 1000;
$$;
revoke all on function public.client_wallet_review(uuid) from public, anon, authenticated;
grant execute on function public.client_wallet_review(uuid) to authenticated;

-- Сверка предоплат кабинета по валютам: всего = распределено клиентам + неразобрано. Видна всем участникам кабинета.
create or replace function public.wallet_reconcile(p_ws uuid)
returns table (currency text, total numeric, assigned numeric, unassigned numeric, unassigned_rows int)
language sql
stable
security definer
set search_path = public
as $$
  select w.currency, sum(w.amount),
         coalesce(sum(w.amount) filter (where w.client_id is not null), 0),
         coalesce(sum(w.amount) filter (where w.client_id is null), 0),
         (count(*) filter (where w.client_id is null))::int
    from public.client_wallet w
   where w.workspace_id = p_ws and public.is_member(p_ws)
   group by w.currency
   order by w.currency;
$$;
revoke all on function public.wallet_reconcile(uuid) from public, anon, authenticated;
grant execute on function public.wallet_reconcile(uuid) to authenticated;

-- Распределить неразобранные операции ПО ОДНОЙ (только владелец). p_rows: [{"id": <операция>, "client": <клиент>}
-- или {"id": …, "new_name": "Имя"}]. Всё в одной транзакции: каждая операция получает ровно одного клиента,
-- повторно распределить уже распределённую нельзя, операция, оплатившая заказ, достаётся только клиенту этого
-- заказа, итоги по валютам до и после сверяются, каждое решение записывается в client_wallet_assign_log.
create or replace function public.client_wallet_assign_rows(p_ws uuid, p_rows jsonb)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  it       jsonb;
  w        public.client_wallet;
  v_cl     uuid;
  v_name   text;
  v_new    jsonb := '{}'::jsonb;
  v_ids    uuid[] := '{}';
  v_n      int := 0;
  v_ord    uuid;
  v_before jsonb;
  v_after  jsonb;
  r        record;
begin
  if not public.is_owner(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'bad_rows' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(x.currency, x.s), '{}') into v_before
    from (select currency, sum(amount) s from public.client_wallet where workspace_id = p_ws group by currency) x;

  -- клиентов блокируем в одном порядке (без взаимных блокировок)
  for r in select distinct (e->>'client')::uuid as c from jsonb_array_elements(p_rows) e where e->>'client' is not null order by 1 loop
    perform public._wallet_lock(p_ws, r.c);
  end loop;

  for it in select * from jsonb_array_elements(p_rows) loop
    if (it->>'id') is null or (it->>'id') !~ '^[0-9a-f-]{36}$' then raise exception 'bad_rows' using errcode = '22023'; end if;
    if (it->>'id')::uuid = any (v_ids) then raise exception 'bad_rows' using errcode = '22023'; end if;
    v_ids := v_ids || (it->>'id')::uuid;

    select * into w from public.client_wallet where id = (it->>'id')::uuid and workspace_id = p_ws for update;
    if w.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    if w.client_id is not null or w.ckey is null then raise exception 'already_assigned' using errcode = '22023'; end if;

    v_cl := nullif(it->>'client', '')::uuid;
    if v_cl is not null then
      if not exists (select 1 from public.clients where id = v_cl and workspace_id = p_ws) then
        raise exception 'bad_client' using errcode = '22023';
      end if;
    else
      v_name := left(btrim(coalesce(it->>'new_name', '')), 120);
      if char_length(v_name) < 2 then raise exception 'bad_client' using errcode = '22023'; end if;
      if v_new ? v_name then
        v_cl := (v_new->>v_name)::uuid;
      else
        insert into public.clients (workspace_id, name) values (p_ws, v_name) returning id into v_cl;
        v_new := v_new || jsonb_build_object(v_name, v_cl);
      end if;
    end if;

    -- деньги, которыми оплачен заказ, принадлежат клиенту этого заказа
    if w.order_id is not null then
      select client_id into v_ord from public.orders where id = w.order_id;
      if v_ord is not null and v_ord <> v_cl then raise exception 'order_client_mismatch' using errcode = '22023'; end if;
    end if;

    update public.client_wallet set client_id = v_cl where id = w.id and client_id is null;
    insert into public.client_wallet_assign_log (workspace_id, wallet_id, legacy_key, currency, amount, to_client)
    values (p_ws, w.id, w.ckey, w.currency, w.amount, v_cl);
    v_n := v_n + 1;
  end loop;

  -- баланс ни одного затронутого клиента не уходит в минус
  if exists (select 1 from public.client_wallet cw
              where cw.workspace_id = p_ws and cw.client_id in (select to_client from public.client_wallet_assign_log where wallet_id = any (v_ids))
              group by cw.client_id, cw.currency having sum(cw.amount) < 0) then
    raise exception 'negative_balance' using errcode = '22023';
  end if;

  -- сверка: итоги по валютам не изменились
  select coalesce(jsonb_object_agg(x.currency, x.s), '{}') into v_after
    from (select currency, sum(amount) s from public.client_wallet where workspace_id = p_ws group by currency) x;
  if v_before is distinct from v_after then raise exception 'reconcile_failed' using errcode = '22023'; end if;

  update public.client_link_review lr
     set resolved_at = now(), resolved_by = auth.uid(), resolution = 'assigned_rows'
   where lr.workspace_id = p_ws and lr.kind = 'wallet' and lr.resolved_at is null
     and not exists (select 1 from public.client_wallet cw where cw.workspace_id = p_ws and cw.ckey = lr.legacy_key and cw.client_id is null);
  return json_build_object('assigned', v_n);
end;
$$;
revoke all on function public.client_wallet_assign_rows(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.client_wallet_assign_rows(uuid, jsonb) to authenticated;

-- Возможные совпадения клиентов: ничего не объединяет, только предлагает.
--   same_phone — полностью одинаковый номер; same_last9 — одинаковы только последние 9 цифр (код страны разный
--   или отсутствует); same_name — одинаковое имя.
create or replace function public.client_link_candidates(p_ws uuid)
returns table (a_id uuid, a_name text, a_phone text, a_orders int, b_id uuid, b_name text, b_phone text, b_orders int, reason text)
language sql
stable
security definer
set search_path = public
as $$
  with c as (
    select cl.id, cl.name, cl.phone, cl.match_phone,
           case when cl.match_phone is not null then right(regexp_replace(cl.match_phone, '\D', '', 'g'), 9) end as l9,
           lower(btrim(cl.name)) as nm,
           (select count(*)::int from public.orders o where o.client_id = cl.id) as oc
      from public.clients cl
     where cl.workspace_id = p_ws and public.is_member(p_ws)
  ), pairs as (
    select a.id as x, b.id as y, 1 as rk from c a join c b on a.id < b.id and a.match_phone = b.match_phone
    union all
    select a.id, b.id, 2 from c a join c b on a.id < b.id and a.l9 = b.l9
    union all
    select a.id, b.id, 3 from c a join c b on a.id < b.id and a.nm = b.nm and a.nm not in ('', 'без имени')
  ), best as (
    select x, y, min(rk) as rk from pairs group by x, y
  )
  select a.id, a.name, a.phone, a.oc, b.id, b.name, b.phone, b.oc,
         case best.rk when 1 then 'same_phone' when 2 then 'same_last9' else 'same_name' end
    from best join c a on a.id = best.x join c b on b.id = best.y
   where not exists (select 1 from public.client_link_dismissed d where d.a_id = best.x and d.b_id = best.y)
   order by best.rk, a.nm, a.id
   limit 200;
$$;
revoke all on function public.client_link_candidates(uuid) from public, anon, authenticated;
grant execute on function public.client_link_candidates(uuid) to authenticated;

-- «Это разные люди»: пара больше не предлагается
create or replace function public.client_link_dismiss(p_a uuid, p_b uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  select a.workspace_id into v_ws from public.clients a join public.clients b on b.workspace_id = a.workspace_id
   where a.id = p_a and b.id = p_b and p_a <> p_b;
  if v_ws is null then raise exception 'client_not_found' using errcode = 'P0002'; end if;
  if not public.is_owner(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.client_link_dismissed (workspace_id, a_id, b_id) values (v_ws, least(p_a, p_b), greatest(p_a, p_b))
  on conflict do nothing;
end;
$$;
revoke all on function public.client_link_dismiss(uuid, uuid) from public, anon, authenticated;
grant execute on function public.client_link_dismiss(uuid, uuid) to authenticated;

-- «Это один человек»: заказы и деньги второго клиента переходят к первому. Строки выписки не удаляются.
-- Общие ссылки обоих отключаются (выпустите новую): иначе старая ссылка вдруг показала бы заказы другого человека.
create or replace function public.client_merge(p_keep uuid, p_drop uuid)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  k        public.clients;
  d        public.clients;
  v_keep   uuid := p_keep;
  v_drop   uuid := p_drop;
  v_orders uuid[];
  v_wallet uuid[];
  v_links  int;
begin
  if p_keep is null or p_drop is null or p_keep = p_drop then raise exception 'bad_client' using errcode = '22023'; end if;
  select * into k from public.clients where id = p_keep;
  select * into d from public.clients where id = p_drop;
  if k.id is null or d.id is null or k.workspace_id <> d.workspace_id then raise exception 'client_not_found' using errcode = 'P0002'; end if;
  if not public.is_owner(k.workspace_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  -- остаётся карточка с адресом
  if not k.has_card and d.has_card then
    v_keep := p_drop; v_drop := p_keep; k := d; select * into d from public.clients where id = v_drop;
  end if;

  perform public._wallet_lock(k.workspace_id, least(v_keep, v_drop));
  perform public._wallet_lock(k.workspace_id, greatest(v_keep, v_drop));

  select coalesce(array_agg(id), '{}') into v_orders from public.orders where client_id = v_drop;
  select coalesce(array_agg(id), '{}') into v_wallet from public.client_wallet where client_id = v_drop;
  update public.orders set client_id = v_keep, client_card_ok = false where client_id = v_drop;   -- ссылка заказа не получает чужую карточку
  update public.client_wallet set client_id = v_keep where client_id = v_drop;
  delete from public.client_cabinets where client_id in (v_keep, v_drop);
  get diagnostics v_links = row_count;
  update public.clients
     set phone = coalesce(phone, d.phone), telegram = coalesce(telegram, d.telegram), match_phone = coalesce(match_phone, d.match_phone)
   where id = v_keep;

  insert into public.client_merge_log (workspace_id, kept_id, dropped_id, dropped, order_ids, wallet_ids)
  values (k.workspace_id, v_keep, v_drop,
          jsonb_build_object('name', d.name, 'phone', d.phone, 'match_phone', d.match_phone, 'telegram', d.telegram,
                             'city', d.city, 'address', d.address, 'pickup_point', d.pickup_point),
          v_orders, v_wallet);
  delete from public.client_link_dismissed where a_id = v_drop or b_id = v_drop;
  delete from public.clients where id = v_drop;
  return json_build_object('kept', v_keep, 'orders', cardinality(v_orders), 'wallet_rows', cardinality(v_wallet), 'links_revoked', v_links);
end;
$$;
revoke all on function public.client_merge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.client_merge(uuid, uuid) to authenticated;


-- 9. Общая ссылка клиента: по клиенту
create or replace function public.client_cabinet(p_order_id uuid, p_action text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client uuid;
  v_token  text;
begin
  if p_action not in ('get', 'create', 'revoke') then
    raise exception 'bad_action' using errcode = '22023';
  end if;

  select o.workspace_id, o.client_id into v_ws, v_client from public.orders o where o.id = p_order_id;
  if v_ws is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not public.is_member(v_ws) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_client is null then
    raise exception 'client_not_linked' using errcode = '22023';
  end if;

  if p_action = 'revoke' then
    delete from public.client_cabinets where client_id = v_client;
    return null;
  end if;

  select token into v_token from public.client_cabinets where client_id = v_client;
  if v_token is null and p_action = 'create' then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into public.client_cabinets (workspace_id, client_id, token) values (v_ws, v_client, v_token);
  end if;
  return v_token;
end;
$$;
revoke all on function public.client_cabinet(uuid, text) from public, anon, authenticated;
grant execute on function public.client_cabinet(uuid, text) to authenticated;

create or replace function public.get_client_cabinet(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select workspace_id, client_id into v_ws, v_client from public.client_cabinets where token = p_token;
  if v_ws is null or v_client is null then   -- ссылка отключена: клиент ещё не подтверждён
    return null;
  end if;

  return (
    with mine as (
      select o.*
        from public.orders o
       where o.workspace_id = v_ws and o.client_id = v_client
    ), lim as (
      select * from mine order by order_date desc, created_at desc limit 300
    )
    select json_build_object(
      'brand', public.ws_brand(v_ws),
      'name', (select c.name from public.clients c where c.id = v_client),
      'orders', coalesce((
        select json_agg(json_build_object(
          'order_number',    l.order_number,
          'order_date',      l.order_date,
          'product_ru',      l.product_ru,
          'quantity',        l.quantity,
          'status',          l.status,
          'tracking_number', l.tracking_number,
          'client_currency', l.client_currency,
          'total_som',       l.total_som,
          'paid_amount',     l.paid_amount,
          'balance_som',     l.balance_som,
          'photo', (select p.storage_path from public.order_photos p where p.order_id = l.id order by p.created_at limit 1)
        ) order by l.order_date desc, l.created_at desc)
        from lim l), '[]'::json),
      'debt', coalesce((
        select json_agg(json_build_object('currency', cur, 'amount', amt) order by cur)
        from (select coalesce(client_currency, 'KGS') as cur, sum(balance_som) as amt
                from mine
               where status <> 'cancelled' and balance_som > 0
               group by 1) d), '[]'::json),
      'wallet', coalesce((
        select json_agg(json_build_object('currency', currency, 'amount', amt) order by currency)
        from (select currency, sum(amount) as amt from public.client_wallet
               where workspace_id = v_ws and client_id = v_client group by currency having sum(amount) <> 0) b), '[]'::json),
      'wallet_ops', coalesce((
        select json_agg(json_build_object('kind', kind, 'amount', amount, 'currency', currency,
                                          'order_number', order_number, 'created_at', created_at) order by created_at desc)
        from (select * from public.client_wallet
               where workspace_id = v_ws and client_id = v_client order by created_at desc limit 50) z), '[]'::json)
    )
  );
end;
$$;
revoke all on function public.get_client_cabinet(text) from public, anon, authenticated;
grant execute on function public.get_client_cabinet(text) to anon, authenticated;

create or replace function public.get_cabinet_order(p_token text, p_order_number text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws     uuid;
  v_client uuid;
  v_id     uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select workspace_id, client_id into v_ws, v_client from public.client_cabinets where token = p_token;
  if v_ws is null or v_client is null then
    return null;
  end if;

  select o.id into v_id
    from public.orders o
   where o.workspace_id = v_ws and o.client_id = v_client and o.order_number = p_order_number
   limit 1;
  if v_id is null then
    return null;
  end if;
  return public.client_order_json(v_id);
end;
$$;
revoke all on function public.get_cabinet_order(text, text) from public, anon, authenticated;
grant execute on function public.get_cabinet_order(text, text) to anon, authenticated;


-- 10. Страница заказа клиента: «карточка» есть только если заполнен город (клиент без карточки — не карточка)
-- Форма адреса на странице заказа (публичная). Карточку, созданную по ссылке ЭТОГО заказа, она обновляет, как раньше.
-- Чужую карточку (автосвязь по номеру, объединение) она не читает и не перезаписывает: для заказа создаётся новая
-- карточка, а владелец позже сам решает, объединять ли (Клиенты → «Совпадения»).
create or replace function public.save_client_info(
  p_token        text,
  p_name         text,
  p_phone        text,
  p_telegram     text,
  p_city         text,
  p_address      text,
  p_pickup_point text
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_ws        uuid;
  v_status    text;
  v_client_id uuid;
  v_own       boolean;
  v_ophone    text;
  v_new       uuid;

  v_name   text := btrim(coalesce(p_name, ''));
  v_city   text := btrim(coalesce(p_city, ''));
  v_addr   text := nullif(btrim(coalesce(p_address, '')), '');
  v_pickup text := nullif(btrim(coalesce(p_pickup_point, '')), '');
  v_phone  text := regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g');
  v_tg     text := nullif(
    regexp_replace(btrim(coalesce(p_telegram, '')), '^(https?://)?(t\.me/)?@?', '', 'i'), '');
begin
  if v_phone like '00%' then
    v_phone := '+' || substr(v_phone, 3);
  end if;

  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select id, workspace_id, status, client_id, client_card_ok, client_phone
    into v_order_id, v_ws, v_status, v_client_id, v_own, v_ophone
    from public.orders
   where public_token = p_token
   for update;

  if v_order_id is null then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_status in ('delivered', 'cancelled') then
    raise exception 'order_locked' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 2 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if v_tg is not null and v_tg !~ '^[A-Za-z0-9_]{5,32}$' then
    raise exception 'invalid_telegram' using errcode = '22023';
  end if;
  if char_length(v_city) not between 2 and 80 then
    raise exception 'invalid_city' using errcode = '22023';
  end if;
  if (v_addr is null) = (v_pickup is null) then
    raise exception 'invalid_place' using errcode = '22023';
  end if;
  if v_addr is not null and char_length(v_addr) not between 5 and 300 then
    raise exception 'invalid_place' using errcode = '22023';
  end if;
  if v_pickup is not null and char_length(v_pickup) not between 2 and 200 then
    raise exception 'invalid_place' using errcode = '22023';
  end if;

  if v_client_id is not null and v_own then
    -- карточка создана по ссылке этого заказа
    update public.clients
       set name = v_name, phone = v_phone, telegram = v_tg,
           city = v_city, address = v_addr, pickup_point = v_pickup
     where id = v_client_id;
  elsif v_client_id is not null
        and not exists (select 1 from public.clients where id = v_client_id and has_card)
        and not exists (select 1 from public.orders where client_id = v_client_id and id <> v_order_id) then
    -- «пустой» клиент только этого заказа: заполняем его
    update public.clients
       set name = v_name, phone = v_phone, telegram = v_tg,
           city = v_city, address = v_addr, pickup_point = v_pickup
     where id = v_client_id;
    update public.orders set client_card_ok = true where id = v_order_id;
  else
    -- чужая или общая карточка (или клиента нет): ссылка заказа её не трогает, заказ получает свою новую карточку
    insert into public.clients (workspace_id, name, phone, telegram, city, address, pickup_point)
    values (v_ws, v_name, v_phone, v_tg, v_city, v_addr, v_pickup)
    returning id into v_new;
    -- ключ поиска совпадений берём из того, что записал байер (или заявитель в заявке), а не из этой формы
    update public.clients set match_phone = public.phone_norm(v_ophone) where id = v_new;
    update public.orders set client_id = v_new, client_card_ok = true where id = v_order_id;
    -- прежний «пустой» клиент без заказов, денег и ссылок больше не нужен
    if v_client_id is not null then
      delete from public.clients c
       where c.id = v_client_id and not c.has_card
         and not exists (select 1 from public.orders where client_id = c.id)
         and not exists (select 1 from public.client_wallet where client_id = c.id)
         and not exists (select 1 from public.client_cabinets where client_id = c.id);
    end if;
  end if;

  return json_build_object(
    'name', v_name, 'phone', v_phone, 'telegram', v_tg,
    'city', v_city, 'address', v_addr, 'pickup_point', v_pickup);
end;
$$;
revoke all on function public.save_client_info(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_client_info(text, text, text, text, text, text, text) to anon, authenticated;


create or replace function public.get_client_order(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', public.ws_brand(o.workspace_id),
    'order_number',    o.order_number,
    'order_date',      o.order_date,
    'product_ru',      o.product_ru,
    'product_zh',      o.product_zh,
    'quantity',        o.quantity,
    'weight_kg',       o.weight_kg,
    'status',          o.status,
    'client_currency', o.client_currency,
    'total_som',       o.total_som,
    'paid_amount',     o.paid_amount,
    'balance_som',     o.balance_som,
    'delivery_info',   o.delivery_info,
    'client_comment',  o.client_comment,
    'tracking_number', o.tracking_number,
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object(
        'event_type', h.event_type,
        'status', h.new_status,
        'paid_total', h.paid_total,
        'created_at', h.created_at
      ) order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id and h.event_type in ('status', 'payment')
    ), '[]'::json),
    'photos', coalesce(
      (select json_agg(p.storage_path order by p.created_at)
         from public.order_photos p where p.order_id = o.id),
      '[]'::json),
    'client', (
      select json_build_object(
        'name', c.name, 'phone', c.phone, 'telegram', c.telegram,
        'city', c.city, 'address', c.address, 'pickup_point', c.pickup_point)
      from public.clients c where c.id = o.client_id and c.city is not null and o.client_card_ok)
  )
  from public.orders o
  where o.public_token = p_token
  limit 1;
$$;
revoke all on function public.get_client_order(text) from public, anon, authenticated;
grant execute on function public.get_client_order(text) to anon, authenticated;

create or replace function public.client_order_json(p_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'brand', public.ws_brand(o.workspace_id),
    'order_number',    o.order_number,
    'order_date',      o.order_date,
    'product_ru',      o.product_ru,
    'product_zh',      o.product_zh,
    'quantity',        o.quantity,
    'weight_kg',       o.weight_kg,
    'status',          o.status,
    'client_currency', o.client_currency,
    'total_som',       o.total_som,
    'paid_amount',     o.paid_amount,
    'balance_som',     o.balance_som,
    'delivery_info',   o.delivery_info,
    'client_comment',  o.client_comment,
    'tracking_number', o.tracking_number,
    'updated_at',      o.updated_at,
    'status_history', coalesce((
      select json_agg(json_build_object(
        'event_type', h.event_type,
        'status', h.new_status,
        'paid_total', h.paid_total,
        'created_at', h.created_at
      ) order by h.created_at desc)
      from public.order_status_history h
      where h.order_id = o.id and h.event_type in ('status', 'payment')
    ), '[]'::json),
    'photos', coalesce(
      (select json_agg(p.storage_path order by p.created_at)
         from public.order_photos p where p.order_id = o.id),
      '[]'::json),
    'client', (
      select json_build_object(
        'name', c.name, 'phone', c.phone, 'telegram', c.telegram,
        'city', c.city, 'address', c.address, 'pickup_point', c.pickup_point)
      from public.clients c where c.id = o.client_id and c.city is not null)
  )
  from public.orders o
  where o.id = p_id;
$$;
revoke all on function public.client_order_json(uuid) from public, anon, authenticated;


-- ✅ ОТМЕТКА: файл 56 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (56, 'migration_56_client_identity.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

commit;
