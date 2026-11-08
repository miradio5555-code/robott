-- =====================================================
-- ТЕСТ ОЧЕРЕДИ УВЕДОМЛЕНИЙ (файл 57), часть базы. Запускается из tests/notify_queue_test.sh после файла 57.
-- =====================================================
\set ON_ERROR_STOP on
\set QUIET on
create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$
begin if not coalesce(c, false) then raise exception 'ПРОВАЛ: %', m; end if; end $$;
create function pg_temp.o(p text) returns uuid language sql as $$ select v::uuid from public._t where k = p $$;
create function pg_temp.q(p_order uuid) returns bigint language sql as $$ select count(*) from public.order_notify_queue where order_id = p_order $$;

-- 0. Установка файла не создала событий для старой истории
select pg_temp.ok((select count(*) = 0 from public.order_notify_queue), 'после установки в очереди уже есть события: ' || (select count(*) from public.order_notify_queue));
\echo '✅ 0. Для старой истории событий нет'

-- 1. Статус и событие — вместе; по одной строке на подписчика
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
update public.orders set status = 'awaiting_payment' where id = pg_temp.o('o1');
reset role;
select pg_temp.ok(pg_temp.q(pg_temp.o('o1')) = 2, 'события по заказу 1: ' || pg_temp.q(pg_temp.o('o1')));
select pg_temp.ok((select count(distinct event_id) = 1 and bool_and(to_status = 'awaiting_payment' and from_status = 'new' and status = 'pending') from public.order_notify_queue where order_id = pg_temp.o('o1')), 'событие неверное');
select pg_temp.ok((select count(*) = 2 from public.order_notify_log where action = 'created'), 'журнал «создано»');
\echo '✅ 1. Событие создано вместе со сменой статуса, по одному на подписчика'

-- 2. Откат смены статуса — события нет
begin;
update public.orders set status = 'purchasing' where id = pg_temp.o('o1');
select pg_temp.ok(pg_temp.q(pg_temp.o('o1')) = 4, 'внутри транзакции события нет');
rollback;
select pg_temp.ok(pg_temp.q(pg_temp.o('o1')) = 2, 'после отката осталось событие');
select pg_temp.ok((select status from public.orders where id = pg_temp.o('o1')) = 'awaiting_payment', 'откат не вернул статус');
-- ошибка в той же транзакции после смены статуса
do $$ begin
  begin
    update public.orders set status = 'purchasing' where id = pg_temp.o('o1');
    perform 1 / 0;
  exception when division_by_zero then null; end;
end $$;
select pg_temp.ok(pg_temp.q(pg_temp.o('o1')) = 2, 'после ошибки в транзакции осталось событие');
\echo '✅ 2. Откат смены статуса откатывает и событие'

-- 3. Тот же статус и правка других полей — события нет; статус «new» — тоже
update public.orders set status = 'awaiting_payment' where id = pg_temp.o('o1');
update public.orders set status = status, client_comment = 'x' where id = pg_temp.o('o1');
update public.orders set weight_kg = 3 where id = pg_temp.o('o1');
select pg_temp.ok(pg_temp.q(pg_temp.o('o1')) = 2, 'повтор того же статуса создал событие');
update public.orders set status = 'new' where id = pg_temp.o('o1');
select pg_temp.ok(pg_temp.q(pg_temp.o('o1')) = 2, 'статус «new» создал событие');
\echo '✅ 3. Тот же статус и «new» не создают событий'

-- 4. Реальные повторные переходы — отдельные события
update public.orders set status = 'purchasing' where id = pg_temp.o('o1');
update public.orders set status = 'in_transit' where id = pg_temp.o('o1');
update public.orders set status = 'purchasing' where id = pg_temp.o('o1');
update public.orders set status = 'in_transit' where id = pg_temp.o('o1');
select pg_temp.ok((select count(distinct event_id) = 5 from public.order_notify_queue where order_id = pg_temp.o('o1')), 'события переходов: ' || (select count(distinct event_id) from public.order_notify_queue where order_id = pg_temp.o('o1')));
select pg_temp.ok((select count(*) = 4 from public.order_notify_queue where order_id = pg_temp.o('o1') and to_status in ('purchasing', 'in_transit') and chat_id = '1001'), 'повторные переходы объединены');
-- заказ без подписчиков событий не даёт
update public.orders set status = 'cancelled' where id = pg_temp.o('o2');
select pg_temp.ok(pg_temp.q(pg_temp.o('o2')) = 1, 'у заказа чужого кабинета с подпиской должно быть одно событие');
\echo '✅ 4. Реальные повторные переходы — отдельные события'
truncate public.order_notify_queue cascade;

-- 5. Закрытые данные: в задаче только поля, которые клиент и так видит
update public.orders set status = 'arrived' where id = pg_temp.o('o1');
set role service_role;
create temp table claimed as select jsonb_array_elements(public.notify_claim('w-test', 50, 120)) as j;
reset role;
select pg_temp.ok((select count(*) = 2 from claimed), 'забрано не 2 задачи: ' || (select count(*) from claimed));
select pg_temp.ok((select bool_and((select array_agg(k order by k) from jsonb_object_keys(j) k) @> array['attempt','brand','chat_id','id','lang','max_attempts','order_number','product_ru','product_zh','public_token','to_status','tracking_number']
                                   and (select array_agg(k order by k) from jsonb_object_keys(j) k) <@ array['attempt','brand','chat_id','id','lang','max_attempts','order_number','product_ru','product_zh','public_token','to_status','tracking_number','kind','amount','currency','due_date'])
                    from claimed), 'в задаче лишние или пропавшие поля: ' || (select (array_agg(distinct k))::text from claimed, jsonb_object_keys(j) k));
select pg_temp.ok((select not bool_or(j::text ~ 'СЕКРЕТНЫЙ|ВНУТРЕННЯЯ|ЗАМЕТКА-ЧУЖОГО|111[.]11|3000|Чужой|Клиент Б') from claimed), 'в задаче закрытые данные: ' || (select j::text from claimed limit 1));
\echo '✅ 5. В задаче нет закупочных цен, заметок и чужих данных'

-- 6. Права: служебные функции недоступны сайту и анониму, список и повтор — только владельцу своего кабинета
set role authenticated;
do $$ begin
  begin perform public.notify_claim('x'); raise exception 'ПРОВАЛ: сайт вызвал notify_claim'; exception when insufficient_privilege then null; end;
  begin perform public.notify_finish(gen_random_uuid(), 'x', 'sent'); raise exception 'ПРОВАЛ: сайт вызвал notify_finish'; exception when insufficient_privilege then null; end;
end $$;
do $$ begin
  begin perform count(*) from public.order_notify_queue; raise exception 'ПРОВАЛ: сайт читает очередь напрямую'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.notify_claim('x'); raise exception 'ПРОВАЛ: аноним вызвал notify_claim'; exception when insufficient_privilege then null; end;
  begin perform public.notify_queue_list((select id from public.workspaces limit 1)); raise exception 'ПРОВАЛ: аноним вызвал notify_queue_list'; exception when insufficient_privilege then null; end;
end $$;
reset role;
\echo '✅ 6a. Служебные функции очереди недоступны сайту и анониму'

-- 6b. Владелец своего кабинета видит состояние и повторяет ошибку; чужой кабинет и помощник — нет
create temp table ws as select (select workspace_id from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000b1' and role = 'owner') as b,
                               (select workspace_id from public.workspace_members where user_id = '00000000-0000-0000-0000-0000000000c1' and role = 'owner') as c;
grant all on ws to authenticated;
create temp table qids as select id, chat_id from public.order_notify_queue;
grant all on qids to authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
create temp table lst as select public.notify_queue_list((select b from ws)) as j;
reset role;
select pg_temp.ok((select jsonb_array_length(j->'items') = 2 and (j->'counts'->>'pending')::int = 2 from lst), 'список владельца: ' || (select j::text from lst));
select pg_temp.ok((select j::text !~ '1001|1002|ВНУТРЕННЯЯ|СЕКРЕТНЫЙ|public_token|TRK-777' from lst), 'в списке для сайта личные или закрытые данные');
set request.uid = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
do $$ begin
  begin perform public.notify_queue_list((select b from ws)); raise exception 'ПРОВАЛ: помощник видит очередь'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
do $$ begin
  begin perform public.notify_queue_list((select b from ws)); raise exception 'ПРОВАЛ: чужой кабинет видит очередь'; exception when insufficient_privilege then null; end;
  begin perform public.notify_retry((select id from qids limit 1)); raise exception 'ПРОВАЛ: чужой кабинет повторил отправку'; exception when insufficient_privilege or others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
create temp table lst2 as select public.notify_queue_list((select c from ws)) as j;
reset role;
select pg_temp.ok((select jsonb_array_length(j->'items') = 0 from lst2), 'в списке чужого кабинета есть чужие события');
-- ошибка → повтор владельцем: та же строка, история сохраняется
set role service_role;
select public.notify_finish((select id from public.order_notify_queue where chat_id = '1001'), 'w-test', 'permanent', 'telegram_400 chat not found');
reset role;
select pg_temp.ok((select status = 'failed' and last_error like 'telegram_400%' and attempts = 1 from public.order_notify_queue where chat_id = '1001'), 'ошибка не записана');
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
select public.notify_retry((select id from qids where chat_id = '1001'));
do $$ begin
  begin perform public.notify_retry((select id from qids where chat_id = '1001')); raise exception 'ПРОВАЛ: повтор сработал дважды';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'not_failed' then raise; end if; end;
  begin perform public.notify_retry((select id from qids where chat_id = '1002')); raise exception 'ПРОВАЛ: повтор не-ошибки';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'not_failed' then raise; end if; end;
end $$;
reset role;
select pg_temp.ok((select status = 'pending' and attempts = 0 and last_error is null from public.order_notify_queue where chat_id = '1001'), 'строка не вернулась в очередь');
select pg_temp.ok((select count(*) = 1 from public.order_notify_log l join public.order_notify_queue q on q.id = l.queue_id where q.chat_id = '1001' and l.action = 'requeued' and l.actor = '00000000-0000-0000-0000-0000000000b1'), 'повтор не записан в журнал');
select pg_temp.ok((select count(*) >= 4 from public.order_notify_log l join public.order_notify_queue q on q.id = l.queue_id where q.chat_id = '1001'), 'история потеряна');
\echo '✅ 6b. Просмотр и повтор — только владельцу своего кабинета; повтор через ту же очередь с историей'

\echo ''
\echo '🎉 Очередь уведомлений (база): все проверки пройдены'
