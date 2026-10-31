-- =====================================================
-- ULA FACTORY — миграция 45: обмен сом → юань по ссылке и у администратора
--
-- У байеров есть «ссылка обмена для клиентов»: клиент вводит, сколько юаней нужно, видит сумму в сомах,
-- оплачивает и оставляет заявку. Включить обмен байер может только после проверки личности (паспорт + селфи).
-- Администратор платформы — это сама ULA, ему проверка не нужна: теперь кабинет администратора
-- считается проверенным, и он может включить такую же ссылку для своих клиентов.
--
--   • kyc_ok(кабинет) — «проверен» также, если владелец кабинета — администратор платформы.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_44_request_photos.sql. Можно запускать повторно.
-- =====================================================

do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 45) then
      raise exception 'СТОП: файл 45 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


create or replace function public.kyc_ok(p_ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workspaces w join public.fx_kyc k on k.user_id = w.owner_id
                  where w.id = p_ws and k.status = 'approved')
      or exists (select 1 from public.workspaces w join public.admins a on a.user_id = w.owner_id
                  where w.id = p_ws);
$$;
revoke all on function public.kyc_ok(uuid) from public, anon, authenticated;


-- ✅ ОТМЕТКА: файл 45 запущен
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (45, 'migration_45_admin_exchange.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();

-- ГОТОВО ✅
