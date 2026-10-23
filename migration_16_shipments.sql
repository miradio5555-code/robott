-- =====================================================
-- ULA FACTORY — миграция 16: партии (несколько заказов одним карго)
--
-- Партия объединяет заказы, которые едут одним грузом. Вы указываете вес по весам карго
-- и тариф (или сумму по счёту карго) — база сама делит стоимость доставки между заказами
-- пропорционально их весу и пересчитывает им доставку (а значит, себестоимость и прибыль).
--
--   • shipments            — партии кабинета (чужие байеры их не видят);
--   • orders.shipment_id   — в какой партии заказ (пусто = ни в какой);
--   • shipment_recalc(id)  — разделить стоимость доставки партии между её заказами;
--   • shipment_set_status(id, status) — сменить статус сразу всем заказам партии.
--
-- Как делится:
--   вес партии  = вес по весам карго (если указан), иначе сумма весов заказов;
--   стоимость   = сумма по счёту (если указана), иначе тариф × вес партии;
--   доля заказа = вес заказа / сумма весов заказов; последний заказ получает остаток,
--   чтобы сумма сошлась до копейки. Курс доставки берётся из «Моих курсов» кабинета.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_15_tracking.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
--    (иначе он перезапишет новые функции). Ничего не будет изменено.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 16) then
      raise exception 'СТОП: файл 16 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


-- 1. Партии
create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null check (char_length(btrim(name)) between 1 and 120),
  cargo           text check (cargo is null or char_length(cargo) <= 120),
  sent_at         date,
  delivery_currency text not null default 'USD' check (delivery_currency ~ '^[A-Z]{3}$'),
  tariff          numeric(12,4) check (tariff is null or tariff >= 0),          -- тариф за 1 кг
  actual_weight   numeric(12,2) check (actual_weight is null or actual_weight >= 0),  -- вес партии по весам карго
  total_cost      numeric(14,2) check (total_cost is null or total_cost >= 0),  -- сумма по счёту карго
  notes           text check (notes is null or char_length(notes) <= 1000),
  created_at      timestamptz not null default now()
);

create index if not exists shipments_workspace_idx on public.shipments(workspace_id, created_at desc);

alter table public.shipments enable row level security;

drop policy if exists "shipments: read own workspace"   on public.shipments;
drop policy if exists "shipments: add to own workspace" on public.shipments;
drop policy if exists "shipments: update own workspace" on public.shipments;
drop policy if exists "shipments: delete own workspace" on public.shipments;

create policy "shipments: read own workspace"
  on public.shipments for select to authenticated
  using (public.can_read_ws(workspace_id));

create policy "shipments: add to own workspace"
  on public.shipments for insert to authenticated
  with check (public.is_member(workspace_id));

create policy "shipments: update own workspace"
  on public.shipments for update to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));

create policy "shipments: delete own workspace"
  on public.shipments for delete to authenticated
  using (public.is_member(workspace_id));

revoke all on public.shipments from anon;
grant select, insert, update, delete on public.shipments to authenticated;


-- 2. Заказ → партия. Удалили партию — заказы остаются, просто без партии.
alter table public.orders
  add column if not exists shipment_id uuid references public.shipments(id) on delete set null;

create index if not exists orders_shipment_idx on public.orders(shipment_id) where shipment_id is not null;

-- Заказ можно положить только в партию своего кабинета
create or replace function public.orders_check_shipment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.shipment_id is not null and not exists (
    select 1 from public.shipments s where s.id = new.shipment_id and s.workspace_id = new.workspace_id
  ) then
    raise exception 'shipment_other_workspace' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_check_shipment on public.orders;
create trigger orders_check_shipment
  before insert or update of shipment_id, workspace_id on public.orders
  for each row execute function public.orders_check_shipment();


-- 3. Курс из «Моих курсов» кабинета: прямой, обратный или 1 для одинаковых валют (иначе null)
create or replace function public._ws_rate(p_rates jsonb, a text, b text)
returns numeric
language sql
immutable
as $$
  select case
    when a = b then 1::numeric
    when coalesce((p_rates ->> (a || '_' || b))::numeric, 0) > 0 then (p_rates ->> (a || '_' || b))::numeric
    when coalesce((p_rates ->> (b || '_' || a))::numeric, 0) > 0 then 1 / (p_rates ->> (b || '_' || a))::numeric
    else null
  end;
$$;
revoke all on function public._ws_rate(jsonb, text, text) from public, anon, authenticated;


-- 4. Разделить стоимость доставки партии между её заказами (без отменённых)
create or replace function public.shipment_recalc(p_shipment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s              public.shipments;
  rates          jsonb;
  r              record;
  v_sum          numeric := 0;   -- сумма весов заказов
  v_cnt          int := 0;
  v_zero         int := 0;       -- заказов без веса
  v_total_w      numeric;        -- вес партии (по весам карго или сумма)
  v_total        numeric;        -- что делим
  v_tariff       numeric;
  v_left         numeric;
  v_rem          int;            -- сколько заказов с весом ещё не обработано
  v_cost         numeric;
  v_rate         numeric;
  v_missing_rate int := 0;
begin
  select * into s from public.shipments where id = p_shipment;
  if not found then raise exception 'shipment_not_found'; end if;
  if not public.is_member(s.workspace_id) then raise exception 'forbidden'; end if;

  select custom_rates into rates from public.workspaces where id = s.workspace_id;

  select coalesce(sum(weight_kg), 0), count(*), count(*) filter (where weight_kg <= 0)
    into v_sum, v_cnt, v_zero
    from public.orders
   where shipment_id = s.id and status <> 'cancelled';

  if v_cnt = 0 then return jsonb_build_object('ok', true, 'orders', 0); end if;
  if v_sum <= 0 then return jsonb_build_object('ok', false, 'error', 'no_weight', 'orders', v_cnt); end if;

  v_total_w := coalesce(nullif(s.actual_weight, 0), v_sum);
  v_total   := coalesce(s.total_cost, s.tariff * v_total_w);
  if v_total is null then return jsonb_build_object('ok', false, 'error', 'no_cost', 'orders', v_cnt); end if;
  v_tariff  := coalesce(s.tariff, round(v_total / v_total_w, 2));
  v_left    := v_total;
  v_rem     := v_cnt - v_zero;

  for r in
    select id, weight_kg, client_currency, delivery_rate
      from public.orders
     where shipment_id = s.id and status <> 'cancelled'
     order by created_at, id
  loop
    if r.weight_kg > 0 then
      v_rem := v_rem - 1;
      -- последний заказ с весом получает остаток: сумма сходится до копейки
      v_cost := case when v_rem = 0 then v_left else least(v_left, round(v_total * r.weight_kg / v_sum, 2)) end;
      v_left := v_left - v_cost;
    else
      v_cost := 0;
    end if;

    v_rate := public._ws_rate(rates, s.delivery_currency, r.client_currency);
    if v_rate is null then
      -- своего курса нет: оставляем тот, что был в заказе, и сообщаем, что его стоит проверить
      v_rate := r.delivery_rate;
      if v_rate <= 0 or v_rate = 1 then v_missing_rate := v_missing_rate + 1; end if;
    else
      v_rate := round(v_rate, 4);
    end if;

    update public.orders
       set delivery_cost = v_cost, delivery_tariff = least(v_tariff, 99999999.99),
           delivery_currency = s.delivery_currency, delivery_rate = v_rate
     where id = r.id;
  end loop;

  return jsonb_build_object(
    'ok', true, 'orders', v_cnt, 'zero_weight', v_zero, 'missing_rate', v_missing_rate,
    'total', v_total, 'total_weight', v_total_w, 'sum_weight', v_sum, 'tariff', v_tariff);
end;
$$;


-- 5. Сменить статус всем заказам партии (кроме отменённых). Возвращает, у скольких сменился.
create or replace function public.shipment_set_status(p_shipment uuid, p_status text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
  v_n  int;
begin
  select workspace_id into v_ws from public.shipments where id = p_shipment;
  if v_ws is null then raise exception 'shipment_not_found'; end if;
  if not public.is_member(v_ws) then raise exception 'forbidden'; end if;

  update public.orders set status = p_status
   where shipment_id = p_shipment and status <> 'cancelled' and status <> p_status;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.shipment_recalc(uuid)            from public, anon;
revoke all on function public.shipment_set_status(uuid, text)  from public, anon;
grant execute on function public.shipment_recalc(uuid)           to authenticated;
grant execute on function public.shipment_set_status(uuid, text) to authenticated;

-- ✅ ОТМЕТКА: файл 16 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (16, 'migration_16_shipments.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
