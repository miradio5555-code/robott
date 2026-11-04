-- WhatsApp inbox: isolated workspaces, reliable outbound queue, quotes and settings.
begin;
do $$ begin
 if exists(select 1 from public.schema_migrations where version>52) then
 raise exception 'СТОП: файл 52 старше уже запущенных в базе'; end if;
end $$;
create table if not exists public.wa_settings (
 workspace_id uuid primary key references public.workspaces(id) on delete cascade,
 enabled boolean not null default false,
 bot_enabled boolean not null default true,
 notify_new boolean not null default true,
 notify_status boolean not null default true,
 notify_payment boolean not null default true,
 language text not null default 'ru' check(language in ('ru','en','zh','vi')),
 status_template text not null default 'ULA Factory · №{order}: {status}' check(char_length(status_template) between 1 and 500),
 last_heartbeat timestamptz, connection_ok boolean not null default false,
 updated_at timestamptz not null default now()
);
create table if not exists public.wa_threads (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 phone text not null check(phone ~ '^[0-9]{9,15}$'),
 display_name text not null default '' check(char_length(display_name)<=120),
 mode text not null default 'bot' check(mode in ('bot','human','closed')),
 opted_out boolean not null default false,
 assigned_to uuid references auth.users(id) on delete set null,
 unread integer not null default 0 check(unread>=0),
 last_message_at timestamptz not null default now(),
 unique(workspace_id,phone), unique(id,workspace_id)
);
create table if not exists public.wa_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null, workspace_id uuid not null,
 direction text not null check(direction in ('in','out')),
 kind text not null default 'text' check(kind in ('text','photo','quote','status','payment','control')),
 body text not null check(char_length(body)<=4000),
 media_path text,
 state text not null default 'queued' check(state in ('received','queued','sending','sent','delivered','read','failed','cancelled')),
 dedupe_key text, provider_id text, created_by uuid references auth.users(id) on delete set null,
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_until timestamptz, error text,
 created_at timestamptz not null default now(), sent_at timestamptz,
 foreign key(thread_id,workspace_id) references public.wa_threads(id,workspace_id) on delete cascade,
 unique(workspace_id,direction,provider_id), unique(workspace_id,dedupe_key)
);
create index if not exists wa_messages_dispatch on public.wa_messages(workspace_id,next_attempt_at) where state in ('queued','sending');
create index if not exists wa_messages_thread on public.wa_messages(thread_id,created_at desc);
create index if not exists wa_threads_recent on public.wa_threads(workspace_id,last_message_at desc);
create table if not exists public.wa_thread_orders (
 thread_id uuid not null references public.wa_threads(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 primary key(thread_id,order_id)
);
create table if not exists public.wa_quotes (
 id uuid primary key default gen_random_uuid(),
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 thread_id uuid not null, order_id uuid not null references public.orders(id) on delete cascade,
 amount numeric not null check(amount>0), currency text not null,
 state text not null default 'pending' check(state in ('pending','accepted','declined','expired')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days',
 decided_at timestamptz,
 foreign key(thread_id,workspace_id) references public.wa_threads(id,workspace_id) on delete cascade
);
-- Browser roles can read through RLS; mutations go through scoped RPCs.
alter table public.wa_settings enable row level security;
alter table public.wa_threads enable row level security;
alter table public.wa_messages enable row level security;
alter table public.wa_thread_orders enable row level security;
alter table public.wa_quotes enable row level security;
revoke all on public.wa_settings,public.wa_threads,public.wa_messages,public.wa_thread_orders,public.wa_quotes from anon,authenticated;
grant select on public.wa_settings,public.wa_threads,public.wa_messages,public.wa_thread_orders,public.wa_quotes to authenticated;
grant all on public.wa_settings,public.wa_threads,public.wa_messages,public.wa_thread_orders,public.wa_quotes to service_role;
drop policy if exists wa_settings_read on public.wa_settings;
create policy wa_settings_read on public.wa_settings for select to authenticated using(public.can_read_ws(workspace_id));
drop policy if exists wa_threads_read on public.wa_threads;
create policy wa_threads_read on public.wa_threads for select to authenticated using(public.can_read_ws(workspace_id));
drop policy if exists wa_messages_read on public.wa_messages;
create policy wa_messages_read on public.wa_messages for select to authenticated using(public.can_read_ws(workspace_id));
drop policy if exists wa_quotes_read on public.wa_quotes;
create policy wa_quotes_read on public.wa_quotes for select to authenticated using(public.can_read_ws(workspace_id));
drop policy if exists wa_thread_orders_read on public.wa_thread_orders;
create policy wa_thread_orders_read on public.wa_thread_orders for select to authenticated using(exists(select 1 from public.wa_threads t where t.id=thread_id and public.can_read_ws(t.workspace_id)));

create or replace function public.wa_send(p_thread uuid,p_body text) returns uuid language plpgsql security definer set search_path=public as $$
declare t public.wa_threads; m uuid;
begin
 select * into t from public.wa_threads where id=p_thread for update;
 if t.id is null or not public.is_member(t.workspace_id) then raise exception 'access_denied' using errcode='42501'; end if;
 if t.opted_out then raise exception 'contact_opted_out'; end if;
 if not exists(select 1 from public.wa_settings where workspace_id=t.workspace_id and enabled) then raise exception 'whatsapp_not_enabled'; end if;
 if char_length(btrim(p_body)) not between 1 and 4000 then raise exception 'invalid_message'; end if;
 if (select count(*) from public.wa_messages where thread_id=t.id and created_by=auth.uid() and created_at>now()-interval '1 minute')>=20 then raise exception 'rate_limit'; end if;
 insert into public.wa_messages(thread_id,workspace_id,direction,body,created_by) values(t.id,t.workspace_id,'out',btrim(p_body),auth.uid()) returning id into m;
 update public.wa_threads set mode='human',assigned_to=coalesce(assigned_to,auth.uid()),last_message_at=now() where id=t.id;
 return m;
end $$;
create or replace function public.wa_thread_action(p_thread uuid,p_action text) returns void language plpgsql security definer set search_path=public as $$
declare t public.wa_threads;
begin
 select * into t from public.wa_threads where id=p_thread for update;
 if t.id is null or not public.is_member(t.workspace_id) then raise exception 'access_denied' using errcode='42501'; end if;
 if p_action='read' then update public.wa_threads set unread=0 where id=t.id;
 elsif p_action='take' then update public.wa_threads set mode='human',assigned_to=auth.uid() where id=t.id;
 elsif p_action='bot' then update public.wa_threads set mode='bot',assigned_to=null where id=t.id;
 elsif p_action='close' then update public.wa_threads set mode='closed' where id=t.id;
 else raise exception 'invalid_action'; end if;
end $$;
create or replace function public.wa_retry(p_message uuid) returns void language plpgsql security definer set search_path=public as $$
declare m public.wa_messages;
begin
 select * into m from public.wa_messages where id=p_message for update;
 if m.id is null or not public.is_member(m.workspace_id) then raise exception 'access_denied' using errcode='42501'; end if;
 if m.state<>'failed' or m.direction<>'out' then raise exception 'not_retryable'; end if;
 update public.wa_messages set state='queued',attempts=0,next_attempt_at=now(),lease_until=null,error=null where id=m.id;
end $$;
create or replace function public.wa_settings_save(p_workspace uuid,p_settings jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner(p_workspace) then raise exception 'access_denied' using errcode='42501'; end if;
 insert into public.wa_settings(workspace_id) values(p_workspace) on conflict do nothing;
 update public.wa_settings set
 enabled=coalesce((p_settings->>'enabled')::boolean,enabled),
 bot_enabled=coalesce((p_settings->>'bot_enabled')::boolean,bot_enabled),
 notify_new=coalesce((p_settings->>'notify_new')::boolean,notify_new),
 notify_status=coalesce((p_settings->>'notify_status')::boolean,notify_status),
 notify_payment=coalesce((p_settings->>'notify_payment')::boolean,notify_payment),
 language=coalesce(p_settings->>'language',language),
 status_template=coalesce(p_settings->>'status_template',status_template),updated_at=now()
 where workspace_id=p_workspace;
end $$;
-- Only the connected server may ingest events or lease pending messages.
create or replace function public.wa_ingest(p_workspace uuid,p_phone text,p_provider text,p_body text,p_direction text default 'in',p_kind text default 'text',p_media text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.wa_threads; m uuid;
begin
 if p_direction not in ('in','out') or p_kind not in ('text','photo','quote','status','payment','control') or p_provider is null or char_length(p_provider)>200 then raise exception 'invalid_event'; end if;
 insert into public.wa_threads(workspace_id,phone) values(p_workspace,p_phone) on conflict(workspace_id,phone) do nothing;
 select * into t from public.wa_threads where workspace_id=p_workspace and phone=p_phone for update;
 insert into public.wa_thread_orders(thread_id,order_id) select t.id,o.id from public.orders o where o.workspace_id=p_workspace and regexp_replace(coalesce(o.client_phone,''),'[[:space:]().+-]','','g')=p_phone on conflict do nothing;
 insert into public.wa_messages(thread_id,workspace_id,direction,kind,body,media_path,state,provider_id,sent_at)
 values(t.id,p_workspace,p_direction,p_kind,left(p_body,4000),p_media,case when p_direction='in' then 'received' else 'sent' end,p_provider,case when p_direction='out' then now() else null end)
 on conflict(workspace_id,direction,provider_id) do nothing returning id into m;
 if m is not null then
  update public.wa_threads set unread=unread+case when p_direction='in' then 1 else 0 end,last_message_at=now(),mode=case when mode='closed' and p_direction='in' then 'human' else mode end where id=t.id returning * into t;
 end if;
 return to_jsonb(t);
end $$;
create or replace function public.wa_claim(p_workspace uuid) returns setof public.wa_messages language sql security definer set search_path=public as $$
 with picked as (
 select m.id from public.wa_messages m join public.wa_settings s on s.workspace_id=m.workspace_id
 where m.workspace_id=p_workspace and s.enabled and m.direction='out'
 and (m.state='queued' and m.next_attempt_at<=now() or m.state='sending' and m.lease_until<now())
 and m.attempts<5 order by m.created_at limit 10 for update of m skip locked
 ) update public.wa_messages m set state='sending',attempts=attempts+1,lease_until=now()+interval '5 minutes'
 from picked where m.id=picked.id returning m.*;
$$;
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
 values(t.id,t.workspace_id,'out','quote','ULA Factory · Расчёт №'||o.order_number||E'\nИтого: '||q.amount||' '||q.currency||E'\nПодтвердить: ДА '||q.code||E'\nОтклонить: НЕТ '||q.code||E'\nРасчёт действует 7 дней. Подтверждение не означает оплату.',auth.uid());
 return q.id;
end $$;
create or replace function public.wa_decide_quote(p_workspace uuid,p_phone text,p_code text,p_accept boolean) returns text language plpgsql security definer set search_path=public as $$
declare q public.wa_quotes; o public.orders;
begin
 select x.* into q from public.wa_quotes x join public.wa_threads t on t.id=x.thread_id
 where x.workspace_id=p_workspace and t.phone=p_phone and x.code=upper(p_code) for update of x;
 if q.id is null then return 'not_found'; end if;
 if q.state<>'pending' then return q.state; end if;
 select * into o from public.orders where id=q.order_id for update;
 if q.expires_at<now() or q.amount is distinct from o.total_som or q.currency is distinct from o.client_currency or o.status in ('cancelled','delivered') then
 update public.wa_quotes set state='expired',decided_at=now() where id=q.id;return 'expired'; end if;
 update public.wa_quotes set state=case when p_accept then 'accepted' else 'declined' end,decided_at=now() where id=q.id;
 update public.wa_threads set mode='human' where id=q.thread_id;
 return case when p_accept then 'accepted' else 'declined' end;
end $$;
-- Server validates ownership of a cabinet link before calling this function.
create or replace function public.wa_link_order(p_workspace uuid,p_thread uuid,p_order uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.wa_threads t join public.orders o on o.workspace_id=t.workspace_id where t.id=p_thread and o.id=p_order and t.workspace_id=p_workspace) then raise exception 'workspace_mismatch'; end if;
 insert into public.wa_thread_orders values(p_thread,p_order) on conflict do nothing;
end $$;
-- Notifications use real DB changes; existing rows are never backfilled.
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
 if k='payment' then b='ULA Factory · №'||new.order_number||E'\n'||case s.language when 'en' then 'Recorded payment: ' when 'zh' then '已登记付款：' when 'vi' then 'Thanh toán đã ghi nhận: ' else 'Учтённая оплата: ' end||new.paid_amount||' '||new.client_currency; end if;
 insert into public.wa_messages(thread_id,workspace_id,direction,kind,body) values(t.id,t.workspace_id,'out',k,left(b||E'\nSTOP / СТОП — отключить уведомления',4000));
 if do_status and do_payment then
  insert into public.wa_messages(thread_id,workspace_id,direction,kind,body) values(t.id,t.workspace_id,'out','payment','ULA Factory · №'||new.order_number||E'\n'||case s.language when 'en' then 'Recorded payment: ' when 'zh' then '已登记付款：' when 'vi' then 'Thanh toán đã ghi nhận: ' else 'Учтённая оплата: ' end||new.paid_amount||' '||new.client_currency||E'\nSTOP / СТОП — отключить уведомления');
 end if;
 update public.wa_threads set last_message_at=now() where id=t.id;
 return new;
end $$;
drop trigger if exists orders_whatsapp on public.orders;
create trigger orders_whatsapp after insert or update of status,paid_amount on public.orders for each row execute function public.enqueue_whatsapp_order();
-- Private inbound attachments are readable only by the corresponding workspace team.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('wa-attachments','wa-attachments',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
drop policy if exists wa_attachment_read on storage.objects;
create policy wa_attachment_read on storage.objects for select to authenticated using(bucket_id='wa-attachments' and exists(select 1 from public.wa_threads t where t.id::text=split_part(name,'/',2) and t.workspace_id::text=split_part(name,'/',1) and public.can_read_ws(t.workspace_id)));

create or replace function public.wa_queue_reply(p_workspace uuid,p_phone text,p_incoming text,p_body text,p_control boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare t public.wa_threads; m uuid;
begin
 select * into t from public.wa_threads where workspace_id=p_workspace and phone=p_phone;
 if t.id is null then raise exception 'thread_not_found'; end if;
 insert into public.wa_messages(thread_id,workspace_id,direction,kind,body,dedupe_key)
 values(t.id,p_workspace,'out',case when p_control then 'control' else 'text' end,left(p_body,4000),'bot:'||p_incoming)
 on conflict(workspace_id,dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id into m;
 return m;
end $$;
revoke all on function public.wa_queue_reply(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.wa_queue_reply(uuid,text,text,text,boolean) to service_role;

-- Explicit function grants; service RPCs are never exposed to browser roles.
revoke all on function public.wa_send(uuid,text),public.wa_thread_action(uuid,text),public.wa_retry(uuid),public.wa_settings_save(uuid,jsonb),public.wa_publish_quote(uuid,uuid) from public,anon,authenticated;
grant execute on function public.wa_send(uuid,text),public.wa_thread_action(uuid,text),public.wa_retry(uuid),public.wa_settings_save(uuid,jsonb),public.wa_publish_quote(uuid,uuid) to authenticated;
revoke all on function public.wa_ingest(uuid,text,text,text,text,text,text),public.wa_claim(uuid),public.wa_decide_quote(uuid,text,text,boolean),public.wa_link_order(uuid,uuid,uuid),public.enqueue_whatsapp_order() from public,anon,authenticated;
grant execute on function public.wa_ingest(uuid,text,text,text,text,text,text),public.wa_claim(uuid),public.wa_decide_quote(uuid,text,text,boolean),public.wa_link_order(uuid,uuid,uuid) to service_role;
insert into public.schema_migrations(version,name) values(52,'migration_52_whatsapp_inbox.sql') on conflict(version) do update set applied_at=now();
commit;
