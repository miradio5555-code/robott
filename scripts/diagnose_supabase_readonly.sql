-- =====================================================
-- ULA FACTORY — ДИАГНОСТИКА РАБОЧЕЙ БАЗЫ (только чтение)
--
-- Что делает: сверяет устройство рабочей базы Supabase с текущим кодом сайта.
--   • какие SQL-файлы запущены (реестр schema_migrations);
--   • есть ли все таблицы и функции, которые нужны сайту и серверным функциям;
--   • закрыты ли таблицы правилами доступа (RLS) и закрыты ли от анонимов закрытые функции;
--   • настройки хранилищ (Storage), их правила, Realtime, признаки настройки уведомлений.
-- Чего НЕ делает: ничего не меняет (только SELECT), не показывает строки клиентов, заказов,
-- сообщений, почты, телефоны, ключи, токены и значения настроек. Выводит только названия
-- объектов, количества и «да / нет».
--
-- Как запустить: Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run.
-- Результат — одна таблица. Скопируйте её целиком (или сделайте снимок экрана) и отправьте помощнику.
-- Статусы: OK — совпадает с кодом; ПРОБЛЕМА — расходится; ПРОВЕРИТЬ — похоже на «ещё не настроено»;
--          ВРУЧНУЮ — из SQL не видно, проверить в панели; ИНФО — справка.
-- Файл можно запускать сколько угодно раз.
--
-- Список ожидаемого сформирован из кода сайта и SQL-файлов 0–63.
-- =====================================================
with
exp as (
  select
    array['order_delivery', 'admin_audit', 'admin_edit', 'admin_settings', 'admins', 'ai_photo_usage', 'client_cabinets', 'client_errors', 'client_link_dismissed', 'client_link_review', 'client_merge_log', 'client_migration_audit', 'client_wallet', 'client_wallet_assign_log', 'clients', 'exchange_events', 'exchange_requests', 'expenses', 'fx_blacklist', 'fx_kyc', 'invites', 'job_heartbeats', 'order_deadline_history', 'order_notify_log', 'order_notify_queue', 'order_tasks', 'order_photos', 'order_push', 'order_status_history', 'order_tg_subs', 'orders', 'platform_fx', 'platform_fx_history', 'platform_news', 'profiles', 'push_keys', 'push_subs', 'schema_migrations', 'shipments', 'shop_products', 'suppliers', 'support_messages', 'team_invites', 'tg_updates', 'user_devices', 'workspace_members', 'workspaces', 'ws_reminder_log', 'ws_reminder_settings', 'ws_telegram', 'ws_timezone_log']::text[] as tabs,
    array['admin_business_overview', 'admin_clear_errors', 'admin_create_invite', 'admin_delete_news', 'admin_edit_start', 'admin_edit_stop', 'admin_fx_disputes', 'admin_fx_resolve', 'admin_kyc_decide', 'admin_kyc_list', 'admin_list_workspaces', 'admin_post_news', 'admin_set_platform_fx', 'admin_set_user_active', 'admin_support_reply', 'admin_support_threads', 'ai_photo_take', 'check_invite', 'claim_invite', 'deadlines_scan', 'fx_autoclose_all', 'fx_autoclose_job', 'job_beat', 'jobs_status', 'order_deadline_history', 'order_reminders_pause', 'order_set_deadlines', 'reminder_settings_get', 'reminder_settings_set', 'task_snooze', 'tasks_list', 'ws_set_timezone', 'my_ui_prefs', 'my_ui_prefs_set', '_cabinet_contact', '_order_delivery_put', 'order_delivery_get', 'order_delivery_review', 'save_cabinet_client_info', 'ws_client_contact_get', 'ws_daily_get', 'ws_daily_set_modules', 'ws_timezone_preview', 'ws_confirm_timezone', 'client_cabinet', 'client_link_candidates', 'client_link_dismiss', 'client_merge', 'client_wallet_assign_rows', 'client_wallet_review', 'device_ping', 'fx_attach_proof', 'fx_autoclose_ws', 'fx_dispute_open', 'fx_dispute_post', 'fx_mark_sent', 'get_cabinet_order', 'get_client_cabinet', 'get_client_order', 'get_exchange_status', 'get_request_form', 'get_shop', 'is_admin', 'is_member', 'is_owner', 'kyc_submit', 'notify_begin_send', 'notify_claim', 'notify_finish', 'notify_queue_enabled', 'notify_queue_list', 'notify_retry', 'push_public_key', 'register_me', 'request_attach_photos', 'request_link_revoke', 'request_link_rotate', 'request_photo_dir', 'revoke_client_link', 'rotate_client_link', 'save_client_info', 'set_profit_goal', 'shipment_recalc', 'shipment_set_status', 'shop_order', 'shop_order_multi', 'submit_exchange', 'submit_request', 'support_agent', 'support_mark_read', 'support_send', 'support_unread', 'team_invite_create', 'team_invite_revoke', 'team_join', 'team_list', 'team_remove', 'tg_connect_start', 'tg_disconnect', 'tg_status', 'wallet_add', 'wallet_order', 'wallet_reconcile', 'wallet_totals', 'wallet_undo']::text[] as fns,
    array['avatars: delete', 'avatars: insert', 'avatars: read', 'avatars: update', 'fx-proofs: delete', 'fx-proofs: dispute', 'fx-proofs: insert', 'fx-proofs: read', 'fx-qr: delete', 'fx-qr: insert', 'fx-sent: insert', 'kyc: delete', 'kyc: insert', 'kyc: read', 'logos: delete', 'logos: insert', 'logos: read', 'logos: update', 'order-photos: delete', 'order-photos: insert', 'order-photos: read', 'order-photos: request insert', 'order-photos: update', 'shop-photos: delete', 'shop-photos: insert', 'shop-photos: read', 'shop-photos: update', 'support-files: insert', 'support-files: read']::text[] as pols,
    array['support_messages','client_wallet','orders','clients','shipments','exchange_requests']::text[] as rt
),
ver as (
  select coalesce(
    (select string_to_array(
       (xpath('/row/c/text()', query_to_xml('select coalesce(string_agg(version::text, '','' order by version), '''') c from public.schema_migrations', false, true, '')))[1]::text, ',')
     where to_regclass('public.schema_migrations') is not null),
    array[]::text[]) as v
),
want as (select g::text as v from generate_series(0, 63) g),
bk(id, pub, lim) as (values
  ('order-photos', true, 5242880::bigint), ('shop-photos', true, 5242880), ('fx-proofs', false, 5242880),
  ('kyc', false, 5242880), ('avatars', true, 1048576), ('support-files', false, 20971520),
  ('logos', true, 1048576), ('fx-sent', true, 5242880), ('fx-qr', true, 1048576)
),
r(ord, sec, chk, st, det) as (
  select 10, '1 Миграции', 'Реестр schema_migrations есть',
         case when to_regclass('public.schema_migrations') is not null then 'OK' else 'ПРОБЛЕМА' end, ''
  union all
  select 11, '1 Миграции', 'Самый новый запущенный файл (код ждёт 63)',
         case when coalesce((select max(x::int) from ver, unnest(ver.v) x where x <> ''), -1) = 63 then 'OK' else 'ПРОБЛЕМА' end,
         'максимум в базе: ' || coalesce((select max(x::int)::text from ver, unnest(ver.v) x where x <> ''), 'нет данных')
  union all
  select 12, '1 Миграции', 'Файлы 0–63 без пропусков',
         case when not exists (select 1 from want w, ver where w.v <> all (ver.v)) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('нет отметок: ' || (select string_agg(w.v, ', ' order by w.v::int) from want w, ver where w.v <> all (ver.v)), 'все 64 отметки есть')
  union all
  select 13, '1 Миграции', 'Файл 50 (баланс клиента) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '50') then 'OK' else 'ПРОБЛЕМА' end,
         'без него не работает «Баланс клиента» и кабинет клиента (get_client_cabinet)'
  union all
  select 14, '1 Миграции', 'Файл 51 (бизнес-обзор администратора) запущен после 50',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '51') and exists (select 1 from ver, unnest(ver.v) x where x = '50') then 'OK' else 'ПРОБЛЕМА' end,
         case when exists (select 1 from ver, unnest(ver.v) x where x = '51') then 'файл 51 отмечен' else 'файл 51 не запущен: «Бизнес-обзор» администратора не заработает' end
  union all
  select 15, '1 Миграции', 'Файл 56 (клиент по постоянному номеру) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '56') then 'OK' else 'ПРОБЛЕМА' end,
         'без него заказы, предоплата и общие ссылки определяют клиента по старому ключу (9 цифр или имя)'
  union all
  select 16, '1 Миграции', 'Файл 56: у всех заказов есть клиент (число заказов без клиента)',
         case when to_regclass('public.client_link_review') is null then 'ИНФО'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.orders where client_id is null', false, true, '')))[1]::text::int = 0 then 'OK' else 'ПРОБЛЕМА' end,
         case when to_regclass('public.client_link_review') is null then 'файл 56 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) c from public.orders where client_id is null', false, true, '')))[1]::text end
  union all
  select 17, '1 Миграции', 'Файл 56: неразобранных связей (деньги и общие ссылки, которые должен решить владелец)',
         case when to_regclass('public.client_link_review') is null then 'ИНФО'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.client_link_review where resolved_at is null', false, true, '')))[1]::text::int = 0 then 'OK' else 'ПРОВЕРИТЬ' end,
         case when to_regclass('public.client_link_review') is null then 'файл 56 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) c from public.client_link_review where resolved_at is null', false, true, '')))[1]::text end
  union all
  select 18, '1 Миграции', 'Файл 57 (очередь уведомлений клиентам) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '57') then 'OK' else 'ПРОБЛЕМА' end,
         'без него статусы клиентам отправляет браузер (как раньше); с ним — сервер по расписанию'
  union all
  select 19, '1 Миграции', 'Файл 57: очередь уведомлений (ожидает / ошибок)',
         case when to_regclass('public.order_notify_queue') is null then 'ИНФО'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.order_notify_queue where status = ''failed''', false, true, '')))[1]::text::int = 0 then 'OK' else 'ПРОВЕРИТЬ' end,
         case when to_regclass('public.order_notify_queue') is null then 'файл 57 ещё не запущен'
              else (xpath('/row/p/text()', query_to_xml('select count(*) filter (where status in (''pending'', ''processing'')) || '' / '' || count(*) filter (where status = ''failed'') p from public.order_notify_queue', false, true, '')))[1]::text end
  union all
  select 21, '1 Миграции', 'Файл 58 (сроки, задачи, напоминания) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '58') then 'OK' else 'ПРОБЛЕМА' end,
         'без него нет сроков оплаты и доставки, задач и серверного автозакрытия обмена'
  union all
  select 22, '1 Миграции', 'Файл 58: автоматические напоминания клиентам (кабинетов с включёнными)',
         case when to_regclass('public.ws_reminder_settings') is null then 'ИНФО' else 'ИНФО' end,
         case when to_regclass('public.ws_reminder_settings') is null then 'файл 58 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) c from public.ws_reminder_settings where enabled', false, true, '')))[1]::text end
  union all
  select 23, '1 Миграции', 'Файл 58: пульс серверных задач (deadlines_scan / fx_autoclose / order_notify_worker; пусто — не запускались)',
         case when to_regclass('public.job_heartbeats') is null then 'ИНФО'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.job_heartbeats where last_run_at > now() - interval ''1 hour''', false, true, '')))[1]::text::int >= 1 then 'OK' else 'ПРОВЕРИТЬ' end,
         case when to_regclass('public.job_heartbeats') is null then 'файл 58 ещё не запущен'
              else coalesce((xpath('/row/j/text()', query_to_xml('select string_agg(job || '': '' || coalesce(to_char(last_run_at, ''YYYY-MM-DD HH24:MI''), ''—'') || case when last_error is not null then '' ОШИБКА'' else '''' end, ''; '') j from public.job_heartbeats', false, true, '')))[1]::text, 'ни одна задача не запускалась: расписание не включено') end
  union all
  select 24, '1 Миграции', 'Файл 59 (простой режим в профиле, модули, часовой пояс, клиент по номеру) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '59') then 'OK' else 'ПРОБЛЕМА' end,
         'без него простой режим помнится только на устройстве, модули «Магазин» и «Обмен» и подтверждение пояса недоступны; сайт при этом работает'
  union all
  select 25, '1 Миграции', 'Файл 59: кабинеты с подтверждённым часовым поясом / всего',
         'ИНФО',
         case when to_regclass('public.ws_timezone_log') is null then 'файл 59 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) filter (where time_zone_confirmed_at is not null) || '' / '' || count(*) c from public.workspaces', false, true, '')))[1]::text end
  union all
  select 26, '1 Миграции', 'Файл 59: заказы, привязанные к клиенту другого кабинета (должно быть 0)',
         case when not exists (select 1 from ver, unnest(ver.v) x where x = '56') then 'ИНФО'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.orders o join public.clients c on c.id = o.client_id where c.workspace_id is distinct from o.workspace_id', false, true, '')))[1]::text::int = 0 then 'OK' else 'ПРОВЕРИТЬ' end,
         case when not exists (select 1 from ver, unnest(ver.v) x where x = '56') then 'файл 56 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) c from public.orders o join public.clients c on c.id = o.client_id where c.workspace_id is distinct from o.workspace_id', false, true, '')))[1]::text || ' заказов; их можно править, но привязать к такому клиенту заново нельзя' end
  union all
  select 27, '1 Миграции', 'Файл 60 (единый кабинет клиента: срок доставки, контакт байера, адрес по общей ссылке) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '60') then 'OK' else 'ПРОБЛЕМА' end,
         'без него кабинет клиента открывается, но без срока доставки, контакта байера и формы адреса; сайт при этом работает'
  union all
  select 28, '1 Миграции', 'Файл 60: кабинеты, где владелец указал способ связи для клиентов / всего',
         'ИНФО',
         case when not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'workspaces' and column_name = 'client_contact_phone') then 'файл 60 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) filter (where client_contact_phone is not null or client_contact_tg is not null) || '' / '' || count(*) c from public.workspaces', false, true, '')))[1]::text end
  union all
  select 29, '1 Миграции', 'Файл 61 (цена для клиента без себестоимости в публичных ответах, адрес заказа отдельно от карточки) запущен',
         case when exists (select 1 from ver, unnest(ver.v) x where x = '61') then 'OK' else 'ПРОБЛЕМА' end,
         'БЕЗ НЕГО клиент по ссылке видит себестоимость заказа без назначенной цены как «сумму» и «долг»; запуск обязателен до выпуска для клиентов'
  union all
  select 30, '1 Миграции', 'Файл 61: публичные функции отдают price_set (себестоимость скрыта)',
         case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname in ('get_client_cabinet', 'get_client_order', 'client_order_json') and p.prosrc like '%price_set%') = 3 then 'OK'
              else 'ПРОБЛЕМА' end,
         'проверяется текст трёх функций; 3 из 3 = закрыто'
  union all
  select 31, '1 Миграции', 'Файл 61: адреса заказов, ожидающие проверки байера / всего',
         'ИНФО',
         case when to_regclass('public.order_delivery') is null then 'файл 61 ещё не запущен'
              else (xpath('/row/c/text()', query_to_xml('select count(*) filter (where state = ''proposed'') || '' / '' || count(*) c from public.order_delivery', false, true, '')))[1]::text end
  union all
  select 32, '1 Миграции', 'WhatsApp: файлы 52–55 (из другой ветки разработки) отмечены в базе',
         case when (select count(*) from ver, unnest(ver.v) x where x in ('52', '53', '54', '55')) = 4 then 'OK' else 'ПРОБЛЕМА' end,
         'в рабочей базе под номерами 52–55 должны стоять именно WhatsApp-файлы (migration_52_whatsapp_inbox … 55_whatsapp_audience); таблица wa_threads: '
           || case when to_regclass('public.wa_threads') is null then 'нет' else 'есть' end
  union all
  select 33, '1 Миграции', 'Файл 62: WhatsApp-расчёт требует цену для клиента (текст wa_publish_quote)',
         case when to_regclass('public.wa_quotes') is null then 'ИНФО'
              when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and p.proname = 'wa_publish_quote' and p.prosrc like '%price_not_set%') then 'OK'
              else 'ПРОБЛЕМА' end,
         case when to_regclass('public.wa_quotes') is null then 'WhatsApp не установлен'
              else 'БЕЗ ФАЙЛА 62 расчёт в WhatsApp по заказу без цены уходит клиенту с себестоимостью как «Итого»' end
  union all
  select 34, '1 Миграции', 'Файл 63: изменения файлов 45 и 46 применены (my_ws_ids, kyc_ok для админа)',
         case when to_regprocedure('public.my_ws_ids()') is not null
               and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'public' and p.proname = 'kyc_ok' and p.prosrc like '%public.admins%') then 'OK' else 'ПРОБЛЕМА' end,
         'без них кабинет открывается медленнее, а админ не может включить ссылку обмена'
  union all
  select 20, '2 Таблицы и функции', 'Все таблицы из SQL-файлов на месте (' || cardinality((select tabs from exp)) || ')',
         case when not exists (select 1 from unnest((select tabs from exp)) t where to_regclass('public.' || t) is null) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('нет таблиц: ' || (select string_agg(t, ', ' order by t) from unnest((select tabs from exp)) t where to_regclass('public.' || t) is null), '')
  union all
  select 21, '2 Таблицы и функции', 'Все функции базы, которые вызывают сайт и серверные функции, на месте (' || cardinality((select fns from exp)) || ')',
         case when not exists (select 1 from unnest((select fns from exp)) f
                                where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                   where n.nspname = 'public' and p.proname = f)) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('нет функций: ' || (select string_agg(f, ', ' order by f) from unnest((select fns from exp)) f
                                       where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                          where n.nspname = 'public' and p.proname = f)), '')
  union all
  select 30, '3 Защита', 'У всех таблиц public включены правила строк (RLS)',
         case when not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('без RLS: ' || (select string_agg(c.relname, ', ' order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                   where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity), '')
  union all
  select 31, '3 Защита', 'Закрытые функции недоступны анонимам (баланс клиента, бизнес-обзор, режим правки)',
         case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname = 'public'
                                  and p.proname in ('wallet_add','wallet_order','wallet_undo','wallet_totals','admin_business_overview','admin_edit_start','admin_edit_stop')
                                  and has_function_privilege('anon', p.oid, 'execute')) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('доступны анониму: ' || (select string_agg(p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                            where n.nspname = 'public'
                                              and p.proname in ('wallet_add','wallet_order','wallet_undo','wallet_totals','admin_business_overview','admin_edit_start','admin_edit_stop')
                                              and has_function_privilege('anon', p.oid, 'execute')), '')
  union all
  select 40 + (row_number() over (order by bk.id))::int, '4 Хранилища (Storage)', 'Хранилище ' || bk.id,
         case when b.id is null then 'ПРОБЛЕМА'
              when b.public is distinct from bk.pub or b.file_size_limit is distinct from bk.lim then 'ПРОБЛЕМА' else 'OK' end,
         case when b.id is null then 'хранилища нет'
              else 'открытое: ' || b.public || ' (ждём ' || bk.pub || '), лимит: ' || coalesce(b.file_size_limit::text, 'нет') || ' (ждём ' || bk.lim || ')' end
  from bk left join storage.buckets b on b.id = bk.id
  union all
  select 60, '4 Хранилища (Storage)', 'Правила доступа к файлам (storage.objects): все ' || cardinality((select pols from exp)) || ' нужных на месте',
         case when not exists (select 1 from unnest((select pols from exp)) p
                                where not exists (select 1 from pg_policies q where q.schemaname = 'storage' and q.tablename = 'objects' and q.policyname = p)) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('нет правил: ' || (select string_agg(p, ', ' order by p) from unnest((select pols from exp)) p
                                      where not exists (select 1 from pg_policies q where q.schemaname = 'storage' and q.tablename = 'objects' and q.policyname = p)), '')
  union all
  select 61, '4 Хранилища (Storage)', 'Другие хранилища в проекте (справка)', 'ИНФО',
         coalesce((select string_agg(b.id, ', ' order by b.id) from storage.buckets b where b.id not in (select id from bk)), 'нет')
  union all
  select 70, '5 Realtime', 'Публикация supabase_realtime существует',
         case when exists (select 1 from pg_publication where pubname = 'supabase_realtime') then 'OK' else 'ПРОБЛЕМА' end, ''
  union all
  select 71, '5 Realtime', 'Включены таблицы: ' || array_to_string((select rt from exp), ', '),
         case when not exists (select 1 from unnest((select rt from exp)) t
                                where not exists (select 1 from pg_publication_tables x where x.pubname = 'supabase_realtime' and x.schemaname = 'public' and x.tablename = t)) then 'OK' else 'ПРОБЛЕМА' end,
         coalesce('не включены: ' || (select string_agg(t, ', ') from unnest((select rt from exp)) t
                                       where not exists (select 1 from pg_publication_tables x where x.pubname = 'supabase_realtime' and x.schemaname = 'public' and x.tablename = t)), '')
  union all
  select 80, '6 Вход', 'Подтверждённых кодов 2FA (число; кто именно — не показывается)', 'ИНФО',
         (select count(*)::text from auth.mfa_factors where status = 'verified')
  union all
  select 81, '6 Вход', 'Passkeys: служебная таблица Supabase', 'ИНФО',
         case when to_regclass('auth.webauthn_credentials') is not null then 'таблица есть; включён ли переключатель — смотреть в панели' else 'таблицы нет (или называется иначе) — смотреть в панели' end
  union all
  select 82, '6 Вход', 'Регистрация по почте, Google, Site URL, капча, письма', 'ВРУЧНУЮ',
         'Supabase → Authentication → Sign In / Providers, URL Configuration, Attack Protection, Emails'
  union all
  select 83, '6 Вход', 'Passkeys (Face ID) включены', 'ВРУЧНУЮ', 'Supabase → Authentication → Passkeys'
  union all
  select 90, '7 Уведомления', 'Push: ключи отправителя созданы (создаются при первом вызове push-notify)',
         case when to_regclass('public.push_keys') is null then 'ПРОБЛЕМА'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.push_keys where char_length(pub) > 0 and char_length(priv) > 0', false, true, '')))[1]::text::int > 0 then 'OK'
              else 'ПРОВЕРИТЬ' end,
         'значения ключей не показываются; «ПРОВЕРИТЬ» = push-notify ещё не вызывалась или не развёрнута'
  union all
  select 91, '7 Уведомления', 'Push: устройств подписано (число)', 'ИНФО',
         case when to_regclass('public.push_subs') is null then 'нет таблицы'
              else (xpath('/row/c/text()', query_to_xml('select count(*) c from public.push_subs', false, true, '')))[1]::text end
  union all
  select 92, '7 Уведомления', 'Telegram администратора подключён (чат сохранён; номер не показывается)',
         case when to_regclass('public.admin_settings') is null then 'ПРОБЛЕМА'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from public.admin_settings where key = ''telegram_chat_id'' and coalesce(value, '''') <> ''''', false, true, '')))[1]::text::int > 0 then 'OK'
              else 'ПРОВЕРИТЬ' end,
         '«ПРОВЕРИТЬ» = админ ещё не подключал бота в Настройках'
  union all
  select 93, '7 Уведомления', 'Telegram байеров: кабинетов с подключённым чатом (число)', 'ИНФО',
         case when to_regclass('public.ws_telegram') is null then 'нет таблицы'
              else (xpath('/row/c/text()', query_to_xml('select count(*) c from public.ws_telegram', false, true, '')))[1]::text end
  union all
  select 94, '7 Уведомления', 'Расписание обработчика очереди (pg_cron: ula-order-notify) включено',
         case when to_regclass('cron.job') is null then 'ПРОВЕРИТЬ'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from cron.job where jobname = ''ula-order-notify'' and active', false, true, '')))[1]::text::int > 0 then 'OK' else 'ПРОВЕРИТЬ' end,
         case when to_regclass('cron.job') is null then 'расширение pg_cron не включено: сообщения копятся в очереди, но не уходят (см. supabase/notify_schedule.sql)'
              else 'задание ula-order-notify: см. supabase/notify_schedule.sql; последние запуски — cron.job_run_details' end
  union all
  select 95, '7 Уведомления', 'Расписание контроля сроков и автозакрытия обмена (pg_cron: ula-deadlines, ula-fx-autoclose)',
         case when to_regclass('cron.job') is null then 'ПРОВЕРИТЬ'
              when (xpath('/row/c/text()', query_to_xml('select count(*) c from cron.job where jobname in (''ula-deadlines'', ''ula-fx-autoclose'') and active', false, true, '')))[1]::text::int = 2 then 'OK' else 'ПРОВЕРИТЬ' end,
         'должны быть оба задания; файл supabase/deadlines_schedule.sql, пока не выполнен — расписания нет'
  union all
  select 100, '8 Edge Functions', 'Развёрнуты ai-assistant, photo-orders, telegram-notify, push-notify и order-notify-worker', 'ВРУЧНУЮ',
         'Supabase → Edge Functions: должны быть все пять, статус Active (order-notify-worker — с флагом --no-verify-jwt); код — папка supabase/functions'
  union all
  select 101, '8 Edge Functions', 'Секреты функций', 'ВРУЧНУЮ',
         'Supabase → Edge Functions → Secrets: GEMINI_API_KEY (ai-assistant, photo-orders), TELEGRAM_BOT_TOKEN (telegram-notify, order-notify-worker), NOTIFY_WORKER_SECRET (order-notify-worker). SUPABASE_URL, SUPABASE_ANON_KEY и SUPABASE_SERVICE_ROLE_KEY Supabase подставляет сам'
  union all
  select 102, '8 Edge Functions', 'Код развёрнутых функций совпадает с папкой supabase/functions', 'ВРУЧНУЮ',
         'Из SQL не видно: сравнить дату последнего Deploy каждой функции с датой изменения файла в репозитории'
  union all
  select 110, '9 Справка', 'Версия Postgres', 'ИНФО', split_part(version(), ' on ', 1)
)
select sec as "Раздел", chk as "Проверка", st as "Статус", det as "Подробности"
from r
order by ord;
