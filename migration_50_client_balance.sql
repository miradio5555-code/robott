-- =====================================================
-- ULA FACTORY — миграция 50: баланс клиента (предоплата)
--
-- Клиент может заплатить заранее: деньги лежат на его счету у байера и списываются на заказы.
-- Один счёт на клиента в каждой валюте (сом, юань, доллар…). Клиент определяется так же,
-- как в «Долгах» и в общей ссылке: по последним 9 цифрам телефона, иначе по имени (client_key).
--
--   • client_wallet — выписка: каждое движение отдельной строкой. Баланс = сумма строк.
--       deposit  +  клиент внёс деньги
--       withdraw −  байер вернул клиенту деньги
--       order    −  оплачен заказ с баланса (paid_amount заказа растёт на ту же сумму)
--       return   +  оплата заказа вернулась на баланс (paid_amount уменьшается); и при удалении заказа
--       fix      ±  исправление
--   • wallet_add(...)        — пополнить / вернуть клиенту / исправить; пополнение может сразу закрыть долги
--   • wallet_order(...)      — оплатить заказ с баланса или вернуть его оплату на баланс
--   • wallet_undo(id)        — владелец отменяет ошибочную строку (оплата заказа откатывается)
--   • wallet_totals(кабинет) — балансы всех клиентов кабинета
--   • get_client_cabinet     — клиент видит свой баланс и выписку
-- Читать выписку может команда кабинета; менять — только через функции (суммы заказов не разойдутся).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_49_live_orders.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 50) then
      raise exception 'СТОП: файл 50 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


create table if not exists public.client_wallet (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ckey         text not null check (char_length(ckey) between 2 and 200),
  client_name  text not null default '' check (char_length(client_name) <= 120),
  currency     text not null check (currency ~ '^[A-Z]{3}$'),
  amount       numeric(14,2) not null check (amount <> 0),
  kind         text not null check (kind in ('deposit', 'withdraw', 'order', 'return', 'fix')),
  order_id     uuid references public.orders(id) on delete set null,
  order_number text,
  note         text check (note is null or char_length(note) <= 200),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now()
);
create index if not exists client_wallet_client_idx on public.client_wallet (workspace_id, ckey, created_at desc);
create index if not exists client_wallet_order_idx on public.client_wallet (order_id) where order_id is not null;

alter table public.client_wallet enable row level security;
drop policy if exists "wallet: read" on public.client_wallet;
create policy "wallet: read" on public.client_wallet for select to authenticated
  using ((select public.is_member(workspace_id)));
revoke insert, update, delete on public.client_wallet from anon, authenticated;
revoke all on public.client_wallet from anon;
grant select on public.client_wallet to authenticated;


-- баланс клиента в валюте (внутренняя)
create or replace function public._wallet_sum(p_ws uuid, p_key text, p_cur text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0) from public.client_wallet
   where workspace_id = p_ws and ckey = p_key and currency = p_cur;
$$;
revoke all on function public._wallet_sum(uuid, text, text) from public, anon, authenticated;

-- одна операция со счётом за раз (двойное нажатие не спишет дважды)
create or replace function public._wallet_lock(p_ws uuid, p_key text)
returns void
language sql
volatile
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtextextended(p_ws::text || '|' || p_key, 50));
$$;
revoke all on function public._wallet_lock(uuid, text) from public, anon, authenticated;


-- Оплатить заказ с баланса (p_dir = 'pay') или вернуть его оплату на баланс ('return').
-- p_amount пусто — вся доступная сумма. Возвращает списанную/возвращённую сумму.
create or replace function public.wallet_order(p_order uuid, p_dir text, p_amount numeric default null)
returns numeric
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  o     record;
  v_ws  uuid;
  v_key text;
  v_x   numeric;
begin
  if p_dir not in ('pay', 'return') then raise exception 'bad_action' using errcode = '22023'; end if;
  if p_amount is not null and p_amount <= 0 then raise exception 'bad_amount' using errcode = '22023'; end if;

  select ord.workspace_id, public.client_key(coalesce(c.phone, ord.client_phone), coalesce(c.name, ord.client_name))
    into v_ws, v_key
    from public.orders ord left join public.clients c on c.id = ord.client_id
   where ord.id = p_order;
  if v_ws is null then raise exception 'order_not_found' using errcode = 'P0002'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden' using errcode = '42501'; end if;

  perform public._wallet_lock(v_ws, v_key);
  select ord.*, coalesce(c.name, ord.client_name) as cname into o
    from public.orders ord left join public.clients c on c.id = ord.client_id
   where ord.id = p_order
     for update of ord;

  if p_dir = 'pay' then
    if o.status = 'cancelled' then raise exception 'order_cancelled' using errcode = '22023'; end if;
    v_x := least(greatest(o.balance_som, 0), public._wallet_sum(v_ws, v_key, o.client_currency), coalesce(p_amount, 1e15));
    if v_x <= 0 then raise exception 'no_funds' using errcode = '22023'; end if;
    update public.orders set paid_amount = paid_amount + v_x where id = p_order;
    insert into public.client_wallet (workspace_id, ckey, client_name, currency, amount, kind, order_id, order_number)
    values (o.workspace_id, v_key, left(coalesce(o.cname, ''), 120), o.client_currency, -v_x, 'order', p_order, o.order_number);
  else
    v_x := least(o.paid_amount, coalesce(p_amount, o.paid_amount));
    if v_x <= 0 then raise exception 'nothing_paid' using errcode = '22023'; end if;
    update public.orders set paid_amount = paid_amount - v_x where id = p_order;
    insert into public.client_wallet (workspace_id, ckey, client_name, currency, amount, kind, order_id, order_number)
    values (o.workspace_id, v_key, left(coalesce(o.cname, ''), 120), o.client_currency, v_x, 'return', p_order, o.order_number);
  end if;
  return v_x;
end;
$$;
revoke all on function public.wallet_order(uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.wallet_order(uuid, text, numeric) to authenticated;


-- Пополнить (deposit), вернуть клиенту (withdraw) или исправить (fix, сумма со знаком).
-- p_apply — после пополнения сразу оплатить долги клиента в этой валюте, начиная со старых заказов
-- (только заказы с ценой для клиента, как в «Долгах»).
-- Возвращает { balance, paid, orders }: баланс после, сколько ушло на заказы и на сколько заказов.
create or replace function public.wallet_add(p_ws uuid, p_key text, p_name text, p_currency text, p_amount numeric,
                                             p_kind text, p_note text default null, p_apply boolean default false)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_amt  numeric;
  v_left numeric;
  v_x    numeric;
  v_paid numeric := 0;
  v_n    int := 0;
  r      record;
begin
  if not public.is_member(p_ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(p_key, '') !~ '^(p[0-9]{9}|n.+)$' or char_length(p_key) > 200 then raise exception 'bad_client' using errcode = '22023'; end if;
  if coalesce(p_currency, '') !~ '^[A-Z]{3}$' then raise exception 'bad_currency' using errcode = '22023'; end if;
  if p_kind not in ('deposit', 'withdraw', 'fix') then raise exception 'bad_action' using errcode = '22023'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 1e11 or (p_kind <> 'fix' and p_amount < 0) then
    raise exception 'bad_amount' using errcode = '22023';
  end if;
  p_note := nullif(left(btrim(coalesce(p_note, '')), 200), '');

  perform public._wallet_lock(p_ws, p_key);
  v_amt := case p_kind when 'withdraw' then -p_amount else p_amount end;
  if p_kind = 'withdraw' and public._wallet_sum(p_ws, p_key, p_currency) < p_amount then
    raise exception 'no_funds' using errcode = '22023';
  end if;

  insert into public.client_wallet (workspace_id, ckey, client_name, currency, amount, kind, note)
  values (p_ws, p_key, left(coalesce(btrim(p_name), ''), 120), p_currency, round(v_amt, 2), p_kind, p_note);

  if p_apply and p_kind = 'deposit' then
    v_left := public._wallet_sum(p_ws, p_key, p_currency);
    for r in
      select ord.id, ord.balance_som, ord.order_number
        from public.orders ord left join public.clients c on c.id = ord.client_id
       where ord.workspace_id = p_ws
         and ord.client_currency = p_currency
         and ord.status <> 'cancelled'
         and ord.client_price is not null
         and ord.balance_som > 0
         and public.client_key(coalesce(c.phone, ord.client_phone), coalesce(c.name, ord.client_name)) = p_key
       order by ord.order_date, ord.created_at
       for update of ord
    loop
      exit when v_left <= 0;
      v_x := least(r.balance_som, v_left);
      update public.orders set paid_amount = paid_amount + v_x where id = r.id;
      insert into public.client_wallet (workspace_id, ckey, client_name, currency, amount, kind, order_id, order_number)
      values (p_ws, p_key, left(coalesce(btrim(p_name), ''), 120), p_currency, -v_x, 'order', r.id, r.order_number);
      v_left := v_left - v_x; v_paid := v_paid + v_x; v_n := v_n + 1;
    end loop;
  end if;

  return json_build_object('balance', public._wallet_sum(p_ws, p_key, p_currency), 'paid', v_paid, 'orders', v_n);
end;
$$;
revoke all on function public.wallet_add(uuid, text, text, text, numeric, text, text, boolean) from public, anon, authenticated;
grant execute on function public.wallet_add(uuid, text, text, text, numeric, text, text, boolean) to authenticated;


-- Отменить строку выписки (только владелец кабинета). Оплата заказа откатывается обратно.
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
  perform public._wallet_lock(w.workspace_id, w.ckey);
  -- снять пополнение, которое уже потрачено на заказы, нельзя: баланс ушёл бы в минус
  if w.amount > 0 and public._wallet_sum(w.workspace_id, w.ckey, w.currency) < w.amount then
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


-- Балансы всех клиентов кабинета (только ненулевые)
create or replace function public.wallet_totals(p_ws uuid)
returns table (ckey text, client_name text, currency text, amount numeric, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select w.ckey,
         (array_agg(w.client_name order by w.created_at desc))[1],
         w.currency, sum(w.amount), max(w.created_at)
    from public.client_wallet w
   where w.workspace_id = p_ws and public.is_member(p_ws)
   group by w.ckey, w.currency
  having sum(w.amount) <> 0;
$$;
revoke all on function public.wallet_totals(uuid) from public, anon, authenticated;
grant execute on function public.wallet_totals(uuid) to authenticated;


-- Заказ удалён — то, что за него списали с баланса, возвращается клиенту на баланс
create or replace function public._wallet_order_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.client_wallet (workspace_id, ckey, client_name, currency, amount, kind, order_number, note)
  select w.workspace_id, w.ckey, (array_agg(w.client_name))[1], w.currency, -sum(w.amount), 'return', old.order_number, 'deleted'
    from public.client_wallet w
   where w.order_id = old.id and w.kind in ('order', 'return')
   group by w.workspace_id, w.ckey, w.currency
  having sum(w.amount) < 0;
  return old;
end;
$$;
revoke all on function public._wallet_order_deleted() from public, anon, authenticated;
drop trigger if exists orders_wallet_return on public.orders;
create trigger orders_wallet_return before delete on public.orders
  for each row execute function public._wallet_order_deleted();


-- Клиент: к прежнему (заказы, долг) добавились баланс и выписка (последние 50 строк)
create or replace function public.get_client_cabinet(p_token text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_key text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    return null;
  end if;
  select workspace_id, ckey into v_ws, v_key from public.client_cabinets where token = p_token;
  if v_ws is null then
    return null;
  end if;

  return (
    with mine as (
      select o.*, c.name as cname
        from public.orders o
        left join public.clients c on c.id = o.client_id
       where o.workspace_id = v_ws
         and public.client_key(coalesce(c.phone, o.client_phone), coalesce(c.name, o.client_name)) = v_key
    ), lim as (
      select * from mine order by order_date desc, created_at desc limit 300
    )
    select json_build_object(
      'brand', public.ws_brand(v_ws),
      'name', (select coalesce(cname, client_name) from mine order by created_at desc limit 1),
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
               where workspace_id = v_ws and ckey = v_key group by currency having sum(amount) <> 0) b), '[]'::json),
      'wallet_ops', coalesce((
        select json_agg(json_build_object('kind', kind, 'amount', amount, 'currency', currency,
                                          'order_number', order_number, 'created_at', created_at) order by created_at desc)
        from (select * from public.client_wallet
               where workspace_id = v_ws and ckey = v_key order by created_at desc limit 50) z), '[]'::json)
    )
  );
end;
$$;
revoke all on function public.get_client_cabinet(text) from public, anon, authenticated;
grant execute on function public.get_client_cabinet(text) to anon, authenticated;


-- Режим правки администратора (файл 48): движения по балансу тоже попадают в журнал
do $$
begin
  if to_regprocedure('public._admin_audit()') is not null then
    drop trigger if exists admin_audit on public.client_wallet;
    create trigger admin_audit after insert or update or delete on public.client_wallet
      for each row execute function public._admin_audit();
  end if;
end $$;


-- Живое обновление: другой телефон команды пополнил — баланс обновится сам (файл 49)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'client_wallet') then
    alter publication supabase_realtime add table public.client_wallet;
  end if;
end $$;


-- ✅ ОТМЕТКА: файл 50 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (50, 'migration_50_client_balance.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
