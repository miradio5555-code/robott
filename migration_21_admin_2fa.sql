-- =====================================================
-- ULA FACTORY — миграция 21: двухфакторный вход администратора защищён на уровне базы
--
-- Если у администратора включён вход с кодом (приложение-аутентификатор), то админские права
-- действуют ТОЛЬКО в сессии, где код введён. Без кода (даже при правильном пароле) база считает,
-- что это не администратор, и ничего чужого не показывает.
--
-- Если 2FA у администратора не включена, всё работает как раньше.
-- Если потеряли телефон с кодом: Supabase → Authentication → Users → ваш пользователь → удалить фактор (MFA).
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_20_tg_ws.sql. Можно запускать повторно.
-- =====================================================

-- ⛔ ЗАЩИТА: если уже запущен более новый файл, этот старый файл не выполнится
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    if exists (select 1 from public.schema_migrations where version > 21) then
      raise exception 'СТОП: файл 21 старше уже запущенных в базе. Ничего не изменено. Смотрите DATABASE.md';
    end if;
  end if;
end $$;


create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where user_id = auth.uid() and role = 'admin' and is_active
  )
  and (
    -- код введён в этой сессии
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    -- или вход с кодом у этого администратора не включён
    or not exists (
      select 1 from auth.mfa_factors f
       where f.user_id = auth.uid() and f.status = 'verified'
    )
  );
$$;

-- ✅ ОТМЕТКА: файл 21 запущен (список: select * from public.schema_migrations order by version;)
create table if not exists public.schema_migrations (
  version    int primary key,
  name       text not null,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anon, authenticated;
insert into public.schema_migrations (version, name) values (21, 'migration_21_admin_2fa.sql')
on conflict (version) do update set name = excluded.name, applied_at = now();


-- ГОТОВО ✅
