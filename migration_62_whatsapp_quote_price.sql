-- ============================================================================
-- ULA FACTORY — миграция 62: WhatsApp-расчёт не отправляется без цены для клиента
--
-- ЗАЧЕМ. Функция wa_publish_quote (файлы 52 и 53) берёт сумму из orders.total_som, а это
-- «цена для клиента, а если её нет — себестоимость» (файл 07). У заказа без назначенной цены клиенту
-- в WhatsApp ушло бы «Итого: <себестоимость>». Теперь расчёт возможен только при назначенной цене.
-- Уже отправленные расчёты не трогаются; ожидающий расчёт, у которого цену сняли, становится «expired».
--
-- ПРЕДВАРИТЕЛЬНОЕ УСЛОВИЕ: запущены файлы 53 (WhatsApp) и 61 (цена и адрес заказа).
-- Как запустить: SQL Editor → вставить весь файл → Run (одной транзакцией; при ошибке откатывается всё).
-- Можно запускать повторно. Таблицы и данные не меняются, заменяются две функции с теми же именами и параметрами.
-- ============================================================================
begin;

do $$ begin
  if to_regclass('public.schema_migrations') is null
     or not exists (select 1 from public.schema_migrations where version = 53)
     or not exists (select 1 from public.schema_migrations where version = 61) then
    raise exception 'СТОП: сначала запустите файлы 53 (WhatsApp) и 61 (цена и адрес заказа). Ничего не изменено.';
  end if;
  if exists (select 1 from public.schema_migrations where version > 62) then
    raise exception 'СТОП: файл 62 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
  end if;
end $$;

-- Тело — как в файле 53; добавлено одно условие: client_price обязателен.
create or replace function public.wa_publish_quote(p_thread uuid,p_order uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare t public.wa_threads; o public.orders; q public.wa_quotes;
begin
select * into t from public.wa_threads where id=p_thread for update;
if t.id is null or not public.is_member(t.workspace_id) then raise exception 'access_denied' using errcode='42501'; end if;
if t.opted_out then raise exception 'contact_opted_out'; end if;
select * into o from public.orders where id=p_order and workspace_id=t.workspace_id;
if o.id is null or not exists(select 1 from public.wa_thread_orders where thread_id=t.id and order_id=o.id) then raise exception 'order_not_linked'; end if;
if o.client_price is null or o.client_price<=0 then raise exception 'price_not_set'; end if;
if o.total_som<=0 or o.status in ('cancelled','delivered') then raise exception 'quote_not_available'; end if;
update public.wa_quotes set state='expired' where thread_id=t.id and order_id=o.id and state='pending';
insert into public.wa_quotes(workspace_id,thread_id,order_id,amount,currency) values(t.workspace_id,t.id,o.id,o.total_som,o.client_currency) returning * into q;
insert into public.wa_messages(thread_id,workspace_id,direction,kind,body,created_by)
values(t.id,t.workspace_id,'out','quote',coalesce((select name from public.workspaces where id=t.workspace_id),'ULA Factory')||' · Расчёт №'||o.order_number||E'\nИтого: '||q.amount||' '||q.currency||E'\nПодтвердить: ДА '||q.code||E'\nОтклонить: НЕТ '||q.code||E'\nРасчёт действует 7 дней. Подтверждение не означает оплату.',auth.uid());
return q.id;
end $$;

-- Тело — как в файле 52; добавлено: цену сняли — расчёт больше нельзя принять.
create or replace function public.wa_decide_quote(p_workspace uuid,p_phone text,p_code text,p_accept boolean) returns text language plpgsql security definer set search_path=public as $$
declare q public.wa_quotes; o public.orders;
begin
select x.* into q from public.wa_quotes x join public.wa_threads t on t.id=x.thread_id
where x.workspace_id=p_workspace and t.phone=p_phone and x.code=upper(p_code) for update of x;
if q.id is null then return 'not_found'; end if;
if q.state<>'pending' then return q.state; end if;
select * into o from public.orders where id=q.order_id for update;
if q.expires_at<now() or o.client_price is null or q.amount is distinct from o.total_som or q.currency is distinct from o.client_currency or o.status in ('cancelled','delivered') then
update public.wa_quotes set state='expired',decided_at=now() where id=q.id;return 'expired'; end if;
update public.wa_quotes set state=case when p_accept then 'accepted' else 'declined' end,decided_at=now() where id=q.id;
update public.wa_threads set mode='human' where id=q.thread_id;
return case when p_accept then 'accepted' else 'declined' end;
end $$;

-- ✅ ОТМЕТКА: файл 62 запущен
insert into public.schema_migrations (version, name) values (62, 'migration_62_whatsapp_quote_price.sql')
  on conflict (version) do update set applied_at = now();

commit;
