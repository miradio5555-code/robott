-- =====================================================
-- ФАЙЛ 35 — витрина: несколько товаров в одном заказе (корзина)
-- Безопасно запускать повторно.
-- =====================================================
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 35) then
      raise exception 'СТОП: файл 35 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;

create or replace function public.shop_order_multi(
  p_token text, p_items jsonb,
  p_name text, p_phone text, p_telegram text, p_comment text, p_website text default null
)
returns json
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  it      jsonb;
  pr      record;
  v_qty   numeric;
  v_total numeric := 0;
  v_n     int := 0;
  v_list  text := '';
  v_title text := '';
  v_c     text;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then
    raise exception 'link_not_found' using errcode = 'P0002';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    begin
      v_qty := (it->>'qty')::numeric;
    exception when others then
      raise exception 'invalid_quantity' using errcode = '22023';
    end;
    if v_qty is null or v_qty <= 0 or v_qty > 100000 then raise exception 'invalid_quantity' using errcode = '22023'; end if;
    select p.title, p.price, p.currency into pr
      from public.shop_products p
      join public.workspaces w on w.id = p.workspace_id
     where p.id = (it->>'id')::uuid and p.is_active and w.request_token = p_token;
    if pr.title is null then raise exception 'product_not_found' using errcode = 'P0002'; end if;
    v_n := v_n + 1;
    v_total := v_total + v_qty;
    v_list := v_list || E'\n' || v_n || '. ' || pr.title || ' × ' || trim(to_char(v_qty, 'FM999999990.##'))
      || case when pr.price is not null then ' (' || trim(to_char(pr.price, 'FM999999990.##')) || ' ' || pr.currency || ' за шт.)' else '' end;
    v_title := v_title || case when v_n > 1 then ', ' else '' end || pr.title || ' ×' || trim(to_char(v_qty, 'FM999999990.##'));
  end loop;

  v_c := 'Из витрины, товаров: ' || v_n || ':' || v_list
    || case when nullif(btrim(coalesce(p_comment, '')), '') is not null then E'\n' || btrim(p_comment) else '' end;

  return public.submit_request(p_token, p_name, p_phone, p_telegram, left(v_title, 300), null, v_total, left(v_c, 1000), p_website);
end;
$$;
revoke all on function public.shop_order_multi(text, jsonb, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.shop_order_multi(text, jsonb, text, text, text, text, text) to anon, authenticated;

create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (35, 'migration_35_shop_cart.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
