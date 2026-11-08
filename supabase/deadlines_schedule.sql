-- =====================================================
-- ULA FACTORY — РАСПИСАНИЕ контроля сроков и автозакрытия обмена (НЕ миграция; НЕ ЗАПУЩЕНО).
--
-- Что делает: база сама (pg_cron) запускает SQL-функции файла 58, браузер и Edge Functions не нужны:
--   • каждые 10 минут  deadlines_scan()    — задачи по срокам + постановка напоминаний в очередь (доставку делает
--                                            order-notify-worker по отдельному расписанию, см. notify_schedule.sql);
--   • каждые 5 минут   fx_autoclose_job()  — автозакрытие обмена через 24 часа (правила споров прежние).
-- Пока файл не выполнен, расписания НЕТ: администратор увидит «не запускалось» (jobs_status, строка в диагностике).
-- Выполнять после migration_58_deadlines.sql: SQL Editor → вставить файл → Run. Включать в рабочей базе — только после
-- диагностики, оценки переноса и настоящей резервной копии.
-- =====================================================
create extension if not exists pg_cron;

select cron.schedule('ula-deadlines',   '*/10 * * * *', $job$ select public.deadlines_scan() $job$);
select cron.schedule('ula-fx-autoclose', '*/5 * * * *',  $job$ select public.fx_autoclose_job() $job$);

-- Проверка (отдельно): select jobname, schedule, active from cron.job where jobname like 'ula-%';
--                     select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
-- Выключить: select cron.unschedule('ula-deadlines'); select cron.unschedule('ula-fx-autoclose');
