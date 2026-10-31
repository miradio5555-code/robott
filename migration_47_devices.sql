-- =====================================================
-- ULA FACTORY — миграция 47: устройства пользователей (для поддержки)
--
-- Когда человек пишет «не работает», поддержке сразу видно, с чего он заходит:
-- телефон/компьютер, система и браузер, установлено ли приложение, версия сайта,
-- включены ли уведомления, язык, часовой пояс, сеть, IP и страна, когда был в сети,
-- и место на карте — только если человек сам разрешил местоположение.
--
--   • user_devices — по строке на каждое устройство человека (не больше 10, старые удаляются);
--   • device_ping(устройство, данные, место) — сайт обновляет строку при входе и раз в полчаса;
--   • читать: сам человек — свои устройства, администратор — все. Писать — только через функцию.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_46_fast_rls.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 47) then
      raise exception 'СТОП: файл 47 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


create table if not exists public.user_devices (
  user_id    uuid not null references auth.users(id) on delete cascade,
  device_id  text not null,                        -- случайный номер, который сайт хранит в браузере
  info       jsonb not null default '{}'::jsonb,   -- система, браузер, экран, язык, уведомления…
  geo        jsonb,                                -- { lat, lon, acc, at } — только с разрешения человека
  ip         text,
  country    text,                                 -- код страны по IP (KG, CN, RU…)
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  primary key (user_id, device_id)
);
create index if not exists user_devices_seen_idx on public.user_devices (user_id, last_seen desc);

alter table public.user_devices enable row level security;

drop policy if exists "devices: read" on public.user_devices;
create policy "devices: read" on public.user_devices for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke insert, update, delete on public.user_devices from anon, authenticated;
grant select on public.user_devices to authenticated;


create or replace function public.device_ping(p_device text, p_info jsonb, p_geo jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_h  json;
  v_ip text;
  v_cc text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(p_device, '') !~ '^[A-Za-z0-9_-]{8,64}$' then raise exception 'bad_device'; end if;
  if jsonb_typeof(p_info) is distinct from 'object' or octet_length(p_info::text) > 4000 then raise exception 'bad_info'; end if;
  if p_geo is not null and (jsonb_typeof(p_geo) <> 'object' or octet_length(p_geo::text) > 500) then p_geo := null; end if;

  -- IP и страна — из заголовков запроса (Supabase стоит за Cloudflare)
  begin
    v_h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_h := null;
  end;
  v_ip := nullif(btrim(split_part(coalesce(v_h->>'cf-connecting-ip', v_h->>'x-forwarded-for', v_h->>'x-real-ip', ''), ',', 1)), '');
  v_cc := nullif(btrim(coalesce(v_h->>'cf-ipcountry', '')), '');

  insert into public.user_devices (user_id, device_id, info, geo, ip, country)
  values (auth.uid(), p_device, p_info, p_geo, left(v_ip, 64), left(v_cc, 8))
  on conflict (user_id, device_id) do update
    set info      = excluded.info,
        geo       = coalesce(excluded.geo, public.user_devices.geo),
        ip        = coalesce(excluded.ip, public.user_devices.ip),
        country   = coalesce(excluded.country, public.user_devices.country),
        last_seen = now();

  -- не больше 10 устройств у человека: самые давние удаляем
  delete from public.user_devices
   where user_id = auth.uid()
     and device_id in (select device_id from public.user_devices
                        where user_id = auth.uid() order by last_seen desc offset 10);
end;
$$;
revoke all on function public.device_ping(text, jsonb, jsonb) from public, anon;
grant execute on function public.device_ping(text, jsonb, jsonb) to authenticated;


-- ✅ ОТМЕТКА: файл 47 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (47, 'migration_47_devices.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
