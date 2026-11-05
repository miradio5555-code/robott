begin;
do $$ begin if exists(select 1 from public.schema_migrations where version>55) then raise exception 'СТОП: файл 55 старше уже запущенных в базе'; end if; end $$;
alter table public.wa_settings add column if not exists new_contact_policy text not null default 'first' check(new_contact_policy in ('first','command','none'));
alter table public.wa_settings add column if not exists client_numbers text[] not null default '{}';
alter table public.wa_settings add column if not exists excluded_numbers text[] not null default '{}';
alter table public.wa_settings add column if not exists welcome_message text not null default '' check(char_length(welcome_message)<=500);
alter table public.wa_settings add column if not exists delivery_message text not null default '' check(char_length(delivery_message)<=1000);
alter table public.wa_settings add column if not exists conditions_message text not null default '' check(char_length(conditions_message)<=1000);
create or replace function public.wa_normalize_numbers(p_numbers jsonb) returns text[] language plpgsql immutable set search_path=public as $$
declare a text[]; v text;
begin
 if jsonb_typeof(p_numbers)<>'array' or jsonb_array_length(p_numbers)>5000 then raise exception 'invalid_phone_list';end if;
 a='{}';
 for v in select jsonb_array_elements_text(p_numbers) loop
  v=regexp_replace(v,'[[:space:]().+-]','','g');
  if v !~ '^[1-9][0-9]{8,14}$' then raise exception 'invalid_phone';end if;
  if not v=any(a) then a=array_append(a,v);end if;
 end loop;
 return a;
end $$;
revoke all on function public.wa_normalize_numbers(jsonb) from public,anon,authenticated;
create or replace function public.wa_settings_save(p_workspace uuid,p_settings jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner(p_workspace) then raise exception 'access_denied' using errcode='42501'; end if;
 insert into public.wa_settings(workspace_id) values(p_workspace) on conflict do nothing;
 update public.wa_settings set
 enabled=coalesce((p_settings->>'enabled')::boolean,enabled),bot_enabled=coalesce((p_settings->>'bot_enabled')::boolean,bot_enabled),
 notify_new=coalesce((p_settings->>'notify_new')::boolean,notify_new),notify_status=coalesce((p_settings->>'notify_status')::boolean,notify_status),notify_payment=coalesce((p_settings->>'notify_payment')::boolean,notify_payment),
 language=coalesce(p_settings->>'language',language),status_template=coalesce(p_settings->>'status_template',status_template),
 new_contact_policy=coalesce(p_settings->>'new_contact_policy',new_contact_policy),
 client_numbers=case when p_settings ? 'client_numbers' then public.wa_normalize_numbers(p_settings->'client_numbers') else client_numbers end,
 excluded_numbers=case when p_settings ? 'excluded_numbers' then public.wa_normalize_numbers(p_settings->'excluded_numbers') else excluded_numbers end,
 welcome_message=coalesce(p_settings->>'welcome_message',welcome_message),delivery_message=coalesce(p_settings->>'delivery_message',delivery_message),conditions_message=coalesce(p_settings->>'conditions_message',conditions_message),updated_at=now()
 where workspace_id=p_workspace;
 if p_settings ? 'client_numbers_add' or p_settings ? 'client_numbers_remove' then
  update public.wa_settings set client_numbers=array(select distinct n from unnest(client_numbers||public.wa_normalize_numbers(coalesce(p_settings->'client_numbers_add','[]'::jsonb))) n where not n=any(public.wa_normalize_numbers(coalesce(p_settings->'client_numbers_remove','[]'::jsonb)))) where workspace_id=p_workspace;
 end if;
 if p_settings ? 'excluded_numbers_add' or p_settings ? 'excluded_numbers_remove' then
  update public.wa_settings set excluded_numbers=array(select distinct n from unnest(excluded_numbers||public.wa_normalize_numbers(coalesce(p_settings->'excluded_numbers_add','[]'::jsonb))) n where not n=any(public.wa_normalize_numbers(coalesce(p_settings->'excluded_numbers_remove','[]'::jsonb)))) where workspace_id=p_workspace;
 end if;
end $$;
-- Personal exclusion lists are visible only to the owner, never to staff.
revoke select on public.wa_settings from public,anon,authenticated;
grant select(workspace_id,enabled,bot_enabled,notify_new,notify_status,notify_payment,language,status_template,last_heartbeat,connection_ok,updated_at,new_contact_policy,welcome_message,delivery_message,conditions_message) on public.wa_settings to authenticated;
create or replace function public.wa_settings_owner(p_workspace uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner(p_workspace) then raise exception 'access_denied' using errcode='42501';end if;
 return coalesce((select to_jsonb(s) from public.wa_settings s where workspace_id=p_workspace),'{}'::jsonb);
end $$;
revoke all on function public.wa_settings_owner(uuid) from public,anon,authenticated;
grant execute on function public.wa_settings_owner(uuid) to authenticated;
-- Called BEFORE copying an incoming message into the business inbox.
-- Existing personal threads are not treated as customers merely because they exist.
create or replace function public.wa_incoming_policy(p_workspace uuid,p_phone text,p_purchase boolean default false,p_new boolean default true) returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.wa_settings; known boolean; first_contact boolean;
begin
 if p_phone !~ '^[1-9][0-9]{8,14}$' then return jsonb_build_object('allowed',false);end if;
 select * into s from public.wa_settings where workspace_id=p_workspace for update;
 if s.workspace_id is null or not s.enabled or p_phone=any(s.excluded_numbers) then return jsonb_build_object('allowed',false);end if;
 first_contact=not exists(select 1 from public.wa_threads where workspace_id=p_workspace and phone=p_phone);
 known=p_phone=any(s.client_numbers) or exists(select 1 from public.orders where workspace_id=p_workspace and regexp_replace(coalesce(client_phone,''),'[[:space:]().+-]','','g')=p_phone);
 if not known and s.bot_enabled and p_new and (s.new_contact_policy='first' and first_contact or s.new_contact_policy in ('first','command') and p_purchase) then
  update public.wa_settings set client_numbers=array_append(client_numbers,p_phone) where workspace_id=p_workspace returning * into s;
  known=true;
 end if;
 return jsonb_build_object('allowed',known,'first_message',first_contact,'settings',to_jsonb(s));
end $$;
revoke all on function public.wa_incoming_policy(uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.wa_incoming_policy(uuid,text,boolean,boolean) to service_role;
create or replace function public.wa_queue_reply(p_workspace uuid,p_phone text,p_incoming text,p_body text,p_control boolean default false) returns uuid language plpgsql security definer set search_path=public as $$
declare t public.wa_threads; m uuid;
begin
 if exists(select 1 from public.wa_settings where workspace_id=p_workspace and p_phone=any(excluded_numbers)) then return null;end if;
 select * into t from public.wa_threads where workspace_id=p_workspace and phone=p_phone;
 if t.id is null then raise exception 'thread_not_found'; end if;
 insert into public.wa_messages(thread_id,workspace_id,direction,kind,body,dedupe_key)
 values(t.id,p_workspace,'out',case when p_control then 'control' else 'text' end,left(p_body,4000),'bot:'||p_incoming)
 on conflict(workspace_id,dedupe_key) do update set dedupe_key=excluded.dedupe_key returning id into m;
 return m;
end $$;
-- Stop already-queued automatic messages immediately after a number is excluded.
create or replace function public.wa_cancel_excluded() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.wa_messages m set state='cancelled',lease_until=null
 from public.wa_threads t where m.thread_id=t.id and m.workspace_id=new.workspace_id and t.phone=any(new.excluded_numbers) and m.created_by is null and m.direction='out' and m.state in ('queued','sending');
 return new;
end $$;
revoke all on function public.wa_cancel_excluded() from public,anon,authenticated;
drop trigger if exists wa_cancel_excluded on public.wa_settings;
create trigger wa_cancel_excluded after update of excluded_numbers on public.wa_settings for each row execute function public.wa_cancel_excluded();
insert into public.schema_migrations(version,name) values(55,'migration_55_whatsapp_audience.sql') on conflict(version) do update set applied_at=now();
commit;
