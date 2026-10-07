-- =====================================================
-- ULA FACTORY — миграция 06: свободная регистрация байеров
--
-- Что делает:
--   • байер может зарегистрироваться САМ (без приглашения):
--     по почте или через Google — кабинет создаётся автоматически;
--   • приглашения продолжают работать как раньше;
--   • если телефона нет (например, вход через Google),
--     сайт попросит указать его при первом входе;
--   • админ видит всех во вкладке «Байеры» и может заблокировать.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Порядок: после migration_05_delivery.sql. Можно запускать повторно.
-- ВАЖНО: если когда-нибудь повторно запускаете 02 или 03 — после них снова запустите 06.
-- =====================================================


-- 1. Создать байеру профиль и кабинет (без приглашения).
--    Телефон сохраняется, только если он правильный; иначе — пусто, сайт попросит позже.
create or replace function public._register_buyer(
  p_user uuid, p_full_name text, p_ws_name text, p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws      uuid;
  v_name    text := nullif(left(btrim(coalesce(p_full_name, '')), 120), '');
  v_ws_name text := nullif(left(btrim(coalesce(p_ws_name, '')), 120), '');
  v_phone   text := public._clean_phone(p_phone);
begin
  if p_user is null then
    return null;
  end if;
  -- профиль уже есть — ничего не делаем
  if exists (select 1 from public.profiles where user_id = p_user) then
    return null;
  end if;
  if v_phone !~ '^\+?[0-9]{9,15}$' then
    v_phone := null;
  end if;

  insert into public.profiles (user_id, role, full_name, phone)
  values (p_user, 'buyer', v_name, v_phone);

  insert into public.workspaces (name, owner_id)
  values (coalesce(v_ws_name, v_name, 'Мой кабинет'), p_user)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role) values (v_ws, p_user, 'owner');
  return v_ws;
end;
$$;
revoke all on function public._register_buyer(uuid, text, text, text) from public, anon, authenticated;


-- 2. При регистрации любого нового пользователя:
--    есть приглашение → принять его; нет (или не подошло) → обычная регистрация.
--    Имя берётся из формы или из Google (full_name / name).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text  := coalesce(m ->> 'full_name', m ->> 'name');
  v_ws   uuid;
begin
  begin
    if m ? 'invite_code' then
      v_ws := public._claim_invite(new.id, m ->> 'invite_code', v_name, m ->> 'workspace_name', m ->> 'phone');
    end if;
    if v_ws is null then
      perform public._register_buyer(new.id, v_name, m ->> 'workspace_name', m ->> 'phone');
    end if;
  exception when others then
    -- ошибка здесь не должна мешать регистрации
    raise warning 'buyer setup failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_claim on auth.users;
create trigger on_auth_user_created_claim
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 3. Запасной путь: вошёл, а профиля нет (например, регистрировался раньше).
--    Сайт вызывает эту функцию — и кабинет создаётся.
create or replace function public.register_me(p_full_name text, p_ws_name text, p_phone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  v_ws := public._register_buyer(auth.uid(), p_full_name, p_ws_name, p_phone);
  if v_ws is null then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;
  return v_ws;
end;
$$;
revoke all on function public.register_me(text, text, text) from public, anon, authenticated;
grant execute on function public.register_me(text, text, text) to authenticated;

-- ГОТОВО ✅
