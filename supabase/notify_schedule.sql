-- =====================================================
-- ULA FACTORY — РАСПИСАНИЕ обработчика уведомлений (НЕ миграция, не нумеруется; НЕ ЗАПУЩЕНО).
--
-- Что делает: раз в минуту база сама зовёт Edge Function order-notify-worker (pg_cron + pg_net).
-- Сайт и браузер для этого не нужны. Пока этот файл не выполнен в Supabase, расписания НЕТ: сообщения копятся в очереди
-- (ничего не теряется), но не уходят. Проверить, что расписание включено: запрос в конце файла.
--
-- Порядок (подробно — DATABASE.md, «Уведомления клиентам»):
--   1. Supabase → Edge Functions: задеплоить telegram-notify (новая версия) и order-notify-worker с флагом --no-verify-jwt.
--   2. Придумать длинный секрет (не короче 32 символов) и сохранить его в двух местах:
--        • Edge Functions → Secrets → NOTIFY_WORKER_SECRET;
--        • ниже вместо СЕКРЕТ (Vault базы).
--   3. Запустить файл migration_57_notify_queue.sql.
--   4. Здесь заменить АДРЕС_ПРОЕКТА (например abcd1234efgh) и СЕКРЕТ, выполнить файл целиком в SQL Editor.
-- Секрет не публикуйте и не вставляйте в чат.
-- =====================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('СЕКРЕТ', 'notify_worker_secret');   -- повторный запуск: сначала удалите старый или обновите vault.update_secret

select cron.schedule(
  'ula-order-notify',
  '* * * * *',
  $job$
    select net.http_post(
      url     := 'https://АДРЕС_ПРОЕКТА.supabase.co/functions/v1/order-notify-worker',
      headers := jsonb_build_object('Content-Type', 'application/json',
                   'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_worker_secret')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 25000
    );
  $job$
);

-- Проверка: расписание есть и срабатывает (запускать отдельно, секрет не показывает)
-- select jobname, schedule, active from cron.job where jobname = 'ula-order-notify';
-- select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'ula-order-notify') order by start_time desc limit 5;
-- Выключить: select cron.unschedule('ula-order-notify');
