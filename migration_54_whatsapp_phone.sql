begin;
do $$ begin if exists(select 1 from public.schema_migrations where version>54) then raise exception 'СТОП: файл 54 старше уже запущенных в базе'; end if; end $$;
alter table public.wa_pairing add column if not exists method text not null default 'qr' check(method in ('qr','phone'));
alter table public.wa_pairing add column if not exists phone text check(phone is null or phone ~ '^[1-9][0-9]{8,14}$');
alter table public.wa_pairing add column if not exists pairing_code text check(pairing_code is null or pairing_code ~ '^[A-Z0-9]{4}-?[A-Z0-9]{4}$');
alter table public.wa_pairing add column if not exists code_expires_at timestamptz;
alter table public.wa_pairing drop constraint if exists wa_pairing_state_check;
alter table public.wa_pairing add constraint wa_pairing_state_check check(state in ('disconnected','queued','starting','qr','code','connected','error','disconnecting'));
alter table public.wa_pairing drop constraint if exists wa_pairing_action_check;
alter table public.wa_pairing add constraint wa_pairing_action_check check(action in ('connect','refresh','disconnect','phone'));
create or replace function public.wa_request_phone(p_workspace uuid,p_phone text) returns void language plpgsql security definer set search_path=public as $$
declare p public.wa_pairing; ph text;
begin
 if not public.is_owner(p_workspace) then raise exception 'access_denied' using errcode='42501'; end if;
 ph=regexp_replace(coalesce(p_phone,''),'[[:space:]().+-]','','g');
 if ph !~ '^[1-9][0-9]{8,14}$' then raise exception 'invalid_phone'; end if;
 insert into public.wa_pairing(workspace_id) values(p_workspace) on conflict do nothing;
 select * into p from public.wa_pairing where workspace_id=p_workspace for update;
 if p.state='connected' then raise exception 'already_connected'; end if;
 if p.requested_at>now()-interval '60 seconds' then raise exception 'rate_limit'; end if;
 update public.wa_pairing set method='phone',phone=ph,pairing_code=null,code_expires_at=null,action='phone',request_seq=request_seq+1,state='queued',qr=null,qr_expires_at=null,error_code=null,requested_at=now(),updated_at=now() where workspace_id=p_workspace;
end $$;
create or replace function public.wa_request_connection(p_workspace uuid,p_action text default 'connect') returns void language plpgsql security definer set search_path=public as $$
declare p public.wa_pairing;
begin
 if not public.is_owner(p_workspace) then raise exception 'access_denied' using errcode='42501'; end if;
 if p_action not in ('connect','refresh','disconnect') then raise exception 'invalid_action'; end if;
 insert into public.wa_pairing(workspace_id) values(p_workspace) on conflict do nothing;
 select * into p from public.wa_pairing where workspace_id=p_workspace for update;
 if p.requested_at>now()-interval '5 seconds' then raise exception 'rate_limit'; end if;
 if p.state='connected' and p_action='connect' then return; end if;
 update public.wa_pairing set method='qr',phone=null,pairing_code=null,code_expires_at=null,action=p_action,request_seq=request_seq+1,state=case when p_action='disconnect' then 'disconnecting' else 'queued' end,qr=null,qr_expires_at=null,error_code=null,requested_at=now(),updated_at=now() where workspace_id=p_workspace;
end $$;
revoke all on function public.wa_request_phone(uuid,text) from public,anon,authenticated;
grant execute on function public.wa_request_phone(uuid,text) to authenticated;
insert into public.schema_migrations(version,name) values(54,'migration_54_whatsapp_phone.sql') on conflict(version) do update set applied_at=now();
commit;
