-- Owner-driven WhatsApp pairing. API tokens remain server-only.
begin;
do $$ begin if exists(select 1 from public.schema_migrations where version>53) then raise exception 'СТОП: файл 53 старше уже запущенных в базе'; end if; end $$;
create table if not exists public.wa_connections (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 instance_id text not null unique,
 instance_name text not null unique,
 api_token text not null unique check(char_length(api_token) between 32 and 200),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.wa_connections enable row level security;
revoke all on public.wa_connections from public,anon,authenticated;
grant all on public.wa_connections to service_role;
create table if not exists public.wa_pairing (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 state text not null default 'disconnected' check(state in ('disconnected','queued','starting','qr','connected','error','disconnecting')),
 qr text check(qr is null or char_length(qr)<=30000),
 qr_expires_at timestamptz,
 action text not null default 'connect' check(action in ('connect','refresh','disconnect')),
 request_seq integer not null default 0,
 handled_seq integer not null default 0,
 processing_seq integer not null default 0,
 lease_until timestamptz,
 error_code text,
 requested_at timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.wa_pairing enable row level security;
revoke all on public.wa_pairing from public,anon,authenticated;
grant select on public.wa_pairing to authenticated;
grant all on public.wa_pairing to service_role;
drop policy if exists wa_pairing_owner on public.wa_pairing;
create policy wa_pairing_owner on public.wa_pairing for select to authenticated using(public.is_owner(workspace_id));
create or replace function public.wa_request_connection(p_workspace uuid,p_action text default 'connect') returns void language plpgsql security definer set search_path=public as $$
declare p public.wa_pairing;
begin
 if not public.is_owner(p_workspace) then raise exception 'access_denied' using errcode='42501'; end if;
 if p_action not in ('connect','refresh','disconnect') then raise exception 'invalid_action'; end if;
 insert into public.wa_pairing(workspace_id) values(p_workspace) on conflict do nothing;
 select * into p from public.wa_pairing where workspace_id=p_workspace for update;
 if p.requested_at>now()-interval '5 seconds' then raise exception 'rate_limit'; end if;
 if p.state='connected' and p_action='connect' then return; end if;
 update public.wa_pairing set action=p_action,request_seq=request_seq+1,state=case when p_action='disconnect' then 'disconnecting' else 'queued' end,qr=null,qr_expires_at=null,error_code=null,requested_at=now(),updated_at=now() where workspace_id=p_workspace;
end $$;
create or replace function public.wa_pairing_claim() returns setof public.wa_pairing language sql security definer set search_path=public as $$
 with picked as(select workspace_id from public.wa_pairing where handled_seq<request_seq and (lease_until is null or lease_until<now()) order by requested_at limit 4 for update skip locked)
 update public.wa_pairing p set processing_seq=request_seq,lease_until=now()+interval '2 minutes',state=case when action='disconnect' then 'disconnecting' else 'starting' end,updated_at=now() from picked where p.workspace_id=picked.workspace_id returning p.*;
$$;
revoke all on function public.wa_request_connection(uuid,text) from public,anon,authenticated;
grant execute on function public.wa_request_connection(uuid,text) to authenticated;
revoke all on function public.wa_pairing_claim() from public,anon,authenticated;
grant execute on function public.wa_pairing_claim() to service_role;
-- Use the connected workspace brand in quotes and payment notices.
create or replace function public.wa_publish_quote(p_thread uuid,p_order uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare t public.wa_threads; o public.orders; q public.wa_quotes;
begin
 select * into t from public.wa_threads where id=p_thread for update;
 if t.id is null or not public.is_member(t.workspace_id) then raise exception 'access_denied' using errcode='42501'; end if;
 if t.opted_out then raise exception 'contact_opted_out'; end if;
 select * into o from public.orders where id=p_order and workspace_id=t.workspace_id;
 if o.id is null or not exists(select 1 from public.wa_thread_orders where thread_id=t.id and order_id=o.id) then raise exception 'order_not_linked'; end if;
 if o.total_som<=0 or o.status in ('cancelled','delivered') then raise exception 'quote_not_available'; end if;
 update public.wa_quotes set state='expired' where thread_id=t.id and order_id=o.id and state='pending';
 insert into public.wa_quotes(workspace_id,thread_id,order_id,amount,currency) values(t.workspace_id,t.id,o.id,o.total_som,o.client_currency) returning * into q;
 insert into public.wa_messages(thread_id,workspace_id,direction,kind,body,created_by)
 values(t.id,t.workspace_id,'out','quote',coalesce((select name from public.workspaces where id=t.workspace_id),'ULA Factory')||' · Расчёт №'||o.order_number||E'\nИтого: '||q.amount||' '||q.currency||E'\nПодтвердить: ДА '||q.code||E'\nОтклонить: НЕТ '||q.code||E'\nРасчёт действует 7 дней. Подтверждение не означает оплату.',auth.uid());
 return q.id;
end $$;
create or replace function public.enqueue_whatsapp_order() returns trigger language plpgsql security definer set search_path=public as $$
declare s public.wa_settings; t public.wa_threads; ph text; b text; k text; label text; do_status boolean; do_payment boolean;
begin
 select * into s from public.wa_settings where workspace_id=new.workspace_id and enabled;
 if s.workspace_id is null then return new; end if;
 ph=regexp_replace(coalesce(new.client_phone,''),'[[:space:]().+-]','','g');
 if ph !~ '^[0-9]{9,15}$' then return new; end if;
 if tg_op='INSERT' then do_status=s.notify_new;do_payment=false;
 else do_status=s.notify_status and new.status is distinct from old.status;
 do_payment=s.notify_payment and new.paid_amount is distinct from old.paid_amount;end if;
 if not do_status and not do_payment then return new;end if;
 k=case when do_status then 'status' else 'payment' end;
 insert into public.wa_threads(workspace_id,phone,display_name) values(new.workspace_id,ph,left(new.client_name,120)) on conflict(workspace_id,phone) do nothing;
 select * into t from public.wa_threads where workspace_id=new.workspace_id and phone=ph;
 if t.opted_out then return new; end if;
 insert into public.wa_thread_orders values(t.id,new.id) on conflict do nothing;
 label=case s.language
 when 'en' then case new.status when 'new' then 'created' when 'awaiting_payment' then 'awaiting payment' when 'purchasing' then 'purchasing' when 'china_warehouse' then 'at China warehouse' when 'in_transit' then 'in transit' when 'arrived' then 'arrived' when 'delivered' then 'delivered' else 'cancelled' end
 when 'zh' then case new.status when 'new' then '已创建' when 'awaiting_payment' then '等待付款' when 'purchasing' then '采购中' when 'china_warehouse' then '已到中国仓库' when 'in_transit' then '运输中' when 'arrived' then '已到达' when 'delivered' then '已交付' else '已取消' end
 when 'vi' then case new.status when 'new' then 'Đã tạo' when 'awaiting_payment' then 'Chờ thanh toán' when 'purchasing' then 'Đang mua' when 'china_warehouse' then 'Tại kho Trung Quốc' when 'in_transit' then 'Đang vận chuyển' when 'arrived' then 'Đã đến' when 'delivered' then 'Đã giao' else 'Đã hủy' end
 else case new.status when 'new' then 'создан' when 'awaiting_payment' then 'ожидает оплаты' when 'purchasing' then 'закупается' when 'china_warehouse' then 'на складе Китая' when 'in_transit' then 'в пути' when 'arrived' then 'прибыл' when 'delivered' then 'выдан' else 'отменён' end end;
 b=replace(replace(s.status_template,'{order}',new.order_number),'{status}',label);
 if k='payment' then b=coalesce((select name from public.workspaces where id=new.workspace_id),'ULA Factory')||' · №'||new.order_number||E'\n'||case s.language when 'en' then 'Recorded payment: ' when 'zh' then '已登记付款：' when 'vi' then 'Thanh toán đã ghi nhận: ' else 'Учтённая оплата: ' end||new.paid_amount||' '||new.client_currency; end if;
 insert into public.wa_messages(thread_id,workspace_id,direction,kind,body) values(t.id,t.workspace_id,'out',k,left(b||E'\nSTOP / СТОП — отключить уведомления',4000));
 if do_status and do_payment then
  insert into public.wa_messages(thread_id,workspace_id,direction,kind,body) values(t.id,t.workspace_id,'out','payment',coalesce((select name from public.workspaces where id=new.workspace_id),'ULA Factory')||' · №'||new.order_number||E'\n'||case s.language when 'en' then 'Recorded payment: ' when 'zh' then '已登记付款：' when 'vi' then 'Thanh toán đã ghi nhận: ' else 'Учтённая оплата: ' end||new.paid_amount||' '||new.client_currency||E'\nSTOP / СТОП — отключить уведомления');
 end if;
 update public.wa_threads set last_message_at=now() where id=t.id;
 return new;
end $$;
insert into public.schema_migrations(version,name) values(53,'migration_53_whatsapp_connect.sql') on conflict(version) do update set applied_at=now();
commit;
