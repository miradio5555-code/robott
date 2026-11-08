-- =====================================================
-- ТЕСТ ПЕРЕНОСА КЛИЕНТОВ, часть 2: проверки ПОСЛЕ файла 56 (и новое поведение).
-- =====================================================
\set ON_ERROR_STOP on
\set QUIET on

create function pg_temp.ok(c boolean, m text) returns void language plpgsql as $$
begin if not coalesce(c, false) then raise exception 'ПРОВАЛ: %', m; end if; end $$;
create function pg_temp.cid(p_k text) returns uuid language sql as
  $$ select o.client_id from public.orders o join ord k on k.id = o.id where k.k = p_k $$;

-- ---------- Перенос ----------
select pg_temp.ok((select count(*) = 0 from public.orders where client_id is null), 'остались заказы без клиента');
select pg_temp.ok(pg_temp.cid('o1') <> pg_temp.cid('o2'), 'разные страны с одинаковыми 9 цифрами объединены');
select pg_temp.ok(pg_temp.cid('o3') = pg_temp.cid('o4') and pg_temp.cid('o3') = pg_temp.cid('o15'), 'один полный номер не стал одним клиентом');
select pg_temp.ok(pg_temp.cid('o5') <> pg_temp.cid('o6'), 'два «Азиза» без телефона объединены');
select pg_temp.ok(pg_temp.cid('o8') <> pg_temp.cid('o9'), 'номер без кода страны объединён с международным');
select pg_temp.ok(pg_temp.cid('o10') = pg_temp.cid('o11') and pg_temp.cid('o10') = '11111111-1111-1111-1111-111111111111', 'заказ с полным номером не присоединился к карточке');
select pg_temp.ok(pg_temp.cid('o12') <> pg_temp.cid('o1') and pg_temp.cid('o12') <> pg_temp.cid('o2'), 'один человек в двух кабинетах — один клиент');
select pg_temp.ok((select workspace_id from public.clients where id = pg_temp.cid('o12')) = :'w2', 'клиент чужого кабинета');
select pg_temp.ok((select name from public.clients where id = pg_temp.cid('o13')) = 'Без имени', 'заявка без имени/телефона');
select pg_temp.ok((select phone is null and match_phone is null from public.clients where id = pg_temp.cid('o14')), 'мусорный телефон попал в клиента');
select pg_temp.ok((select count(*) from public.clients where workspace_id = :'w1' and not has_card) = 10, 'число клиентов без карточки в кабинете 1');
\echo '✅ 1. Заказы привязаны к клиентам по полному номеру; имя и 9 цифр никого не объединяют'

-- предоплата
select pg_temp.ok((select count(*) from public.client_wallet where client_id is not null and workspace_id = :'w1') = 6, 'разобранные строки кабинета 1: ' || (select count(*) from public.client_wallet where client_id is not null and workspace_id = :'w1'));
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = pg_temp.cid('o3') and currency = 'KGS') = 2600, 'баланс Нурлана в сомах');
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = pg_temp.cid('o3') and currency = 'CNY') = 50, 'баланс Нурлана в юанях');
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = pg_temp.cid('o7')) = 700, 'единственный клиент без телефона не получил свой баланс');
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = '11111111-1111-1111-1111-111111111111') = 400, 'баланс карточки');
select pg_temp.ok((select count(*) = 6 from public.client_wallet where client_id is null and ckey is not null and workspace_id = :'w1' and ckey in (public.client_key('+996700111222','x'), public.client_key(null,'Азиз'), public.client_key('0700555666','x'), public.client_key('+996 111 000 999','x'))), 'спорные строки: должны остаться без клиента');
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id is null and workspace_id = :'w1' and ckey = public.client_key('+996700111222','x')) = 3500, 'спорная сумма A изменилась');
select pg_temp.ok((select count(*) from public.client_wallet where client_id = pg_temp.cid('o1') or client_id = pg_temp.cid('o2')) = 0, 'спорные деньги кому-то выданы автоматически');
select pg_temp.ok((select client_id is not null from public.client_wallet where workspace_id = :'w2' limit 1), 'деньги другого кабинета не разобраны');
select pg_temp.ok((select count(*) from public.client_link_review where kind = 'wallet' and resolved_at is null) = 4, 'причины спорных связей записаны: ' || (select count(*) from public.client_link_review where kind='wallet'));
select pg_temp.ok((select count(*) from public.client_wallet) = (select count(*) from public._snap_wallet)
                  and not exists (select 1 from public.client_wallet w join public._snap_wallet s using (id) where w.amount <> s.amount or w.kind <> s.kind or w.created_at <> s.created_at or w.ckey is distinct from s.ckey),
                  'история финансовых операций изменилась');
\echo '✅ 2. Предоплата: однозначное отдано клиентам, спорное осталось неразобранным, история цела'

-- суммы
select pg_temp.ok(not exists (
  select 1 from (select workspace_id, currency, sum(amount) s from public.client_wallet group by 1,2) a
  full join (select workspace_id, currency, sum(amount) s from public._snap_wallet group by 1,2) b using (workspace_id, currency)
  where a.s is distinct from b.s), 'суммы кошелька по кабинетам и валютам не сошлись');
select pg_temp.ok(not exists (
  select 1 from (select workspace_id, client_currency, sum(paid_amount) p, sum(balance_som) b from public.orders group by 1,2) a
  full join (select workspace_id, client_currency, sum(paid_amount) p, sum(balance_som) b from public._snap_orders group by 1,2) s using (workspace_id, client_currency)
  where a.p is distinct from s.p or a.b is distinct from s.b), 'суммы заказов не сошлись');
select pg_temp.ok((select count(*) > 20 from public.client_migration_audit where stage = 'after'), 'нет записей сверки');
\echo '✅ 3. Суммы по кабинетам и валютам до и после совпадают'

-- ссылки
select pg_temp.ok(public.get_client_cabinet('a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1') is null, 'ссылка двух людей (A) осталась рабочей');
select pg_temp.ok(public.get_client_cabinet('a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3a3') is null, 'ссылка двух Азизов осталась рабочей');
select pg_temp.ok((select count(*) = 2 from public.client_link_review where kind = 'cabinet'), 'причины отключённых ссылок не записаны');
select pg_temp.ok(not exists (
  select 1 from public._snap_cab s,
       lateral (select array(select x->>'order_number' from json_array_elements(public.get_client_cabinet(s.token)->'orders') x order by 1) as nums) n
   where public.get_client_cabinet(s.token) is not null and not (n.nums <@ s.nums)),
  'общая ссылка стала показывать больше заказов, чем раньше');
select pg_temp.ok(public.get_client_cabinet('a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2') is not null, 'однозначная ссылка B перестала работать');
select pg_temp.ok(public.get_client_cabinet('a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4a4') is not null, 'однозначная ссылка F перестала работать');
select pg_temp.ok(public.get_client_cabinet('a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5') is not null, 'ссылка другого кабинета перестала работать');
select pg_temp.ok(json_array_length(public.get_client_cabinet('a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5')->'orders') = 1, 'ссылка G показывает не только свой заказ');
select pg_temp.ok(public.get_cabinet_order('a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2', (select order_number from public._snap_orders where k = 'o1')) is null, 'ссылка B открывает заказ A');
select pg_temp.ok(public.get_cabinet_order('a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2', (select order_number from public._snap_orders where k = 'o3')) is not null, 'ссылка B не открывает свой заказ');
-- ссылки отдельных заказов: страница заказа прежняя (кроме заказа, присоединённого к карточке по полному номеру)
select pg_temp.ok(not exists (select 1 from public._snap_order_pages s join ord k on k.k = s.k join public.orders o on o.id = k.id
                               where md5(public.get_client_order(o.public_token)::text) <> s.h), 'страница отдельного заказа изменилась');
select pg_temp.ok(public.get_client_order((select tok from ord where k = 'o5')) is not null, 'ссылка отдельного заказа не открывается');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'o5'))->>'client') is null, 'клиент без карточки выглядит как карточка (форма адреса не покажется)');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'o11'))->>'client') is null, 'заказ, присоединённый к карточке по номеру, показывает чужую карточку');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'o10'))->'client'->>'city') = 'Бишкек', 'заказ с собственной карточкой перестал её показывать');
\echo '✅ 4. Спорные общие ссылки отключены, однозначные работают и не шире прежних, ссылки заказов целы'

-- ---------- Повторный запуск файла 56 ----------
create temp table before_rerun as select
  (select count(*) from public.client_wallet) w, (select count(*) from public.clients) c, (select count(*) from public.client_link_review) r,
  (select count(*) from public.client_migration_audit) a, (select sum(amount) from public.client_wallet) s;
\i migration_56_client_identity.sql
select pg_temp.ok((select (w, c, r, a, s) = ((select w from before_rerun), (select c from before_rerun), (select r from before_rerun), (select a from before_rerun), (select s from before_rerun))
                    from (select (select count(*) from public.client_wallet) w, (select count(*) from public.clients) c, (select count(*) from public.client_link_review) r,
                                 (select count(*) from public.client_migration_audit) a, (select sum(amount) from public.client_wallet) s) q),
                  'повторный запуск файла 56 изменил данные');
\echo '✅ 5. Повторный запуск файла 56 ничего не дублирует'

-- ---------- Новые заказы, телефон, предоплата, ссылки ----------
create function pg_temp.ins(p_k text, p_ws uuid, p_name text, p_phone text, p_src text default 'manual') returns void language plpgsql as $$
declare v_id uuid; v_tok text;
begin
  insert into public.orders (workspace_id, client_name, client_phone, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, client_currency, source)
  values (p_ws, p_name, p_phone, 'Новый ' || p_k, 1, 10, 12, 1000, 0, 'KGS', p_src) returning id, public_token into v_id, v_tok;
  insert into ord values (p_k, v_id, v_tok);
end $$;
select pg_temp.ins('n1', :'w1', 'Дина', '+996 701 000 000');
select pg_temp.ins('n2', :'w1', 'Дина Т.', '+996701000000');        -- тот же полный номер
select pg_temp.ins('n3', :'w1', 'Диана', '+7701000000');            -- 9 цифр те же, страна другая
select pg_temp.ins('n4', :'w1', 'Тимур', null);
select pg_temp.ins('n5', :'w1', 'Тимур', null);                     -- то же имя без телефона
select pg_temp.ins('n6', :'w1', 'Заявитель', '+996701000000', 'request');   -- заявка с чужим (существующим) номером
select pg_temp.ins('n7', :'w1', '', '');                            -- пустые данные
select pg_temp.ok(pg_temp.cid('n1') = pg_temp.cid('n2'), 'новый заказ с тем же полным номером не присоединился');
select pg_temp.ok(pg_temp.cid('n3') <> pg_temp.cid('n1'), 'новый номер другой страны присоединился');
select pg_temp.ok(pg_temp.cid('n4') <> pg_temp.cid('n5'), 'одинаковые имена без телефона объединились');
select pg_temp.ok(pg_temp.cid('n6') <> pg_temp.cid('n1'), 'заявка по ссылке присоединилась к существующему клиенту сама');
select pg_temp.ok(pg_temp.cid('n7') is not null, 'пустой заказ без клиента');
\echo '✅ 6. Новые заказы: только полный номер присоединяет; заявки, 9 цифр и имена — нет'

-- телефон существующего клиента меняется: связи остаются
select pg_temp.ok((select match_phone from public.clients where id = pg_temp.cid('n1')) = '+996701000000', 'match_phone');
update public.clients set phone = '+996701999999' where id = pg_temp.cid('o3');
select pg_temp.ok((select match_phone from public.clients where id = pg_temp.cid('o3')) = '+996555000111', 'смена телефона карточки изменила ключ поиска');
select pg_temp.ok(pg_temp.cid('o3') = pg_temp.cid('o4') and (select sum(amount) from public.client_wallet where client_id = pg_temp.cid('o3') and currency = 'KGS') = 2600, 'смена телефона нарушила связи');
select pg_temp.ok(public.get_client_cabinet('a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2') is not null, 'смена телефона сломала ссылку клиента');
update public.orders set client_phone = '+996 702 111 111', client_name = 'Тимур Новый' where id = (select id from ord where k = 'n4');
select pg_temp.ok((select name = 'Тимур Новый' and match_phone = '+996702111111' from public.clients where id = pg_temp.cid('n4')), 'правка заказа не обновила клиента без карточки');
select pg_temp.ok(pg_temp.cid('n4') <> pg_temp.cid('n5'), 'правка заказа слила клиентов');
update public.orders set client_phone = '+996777888999' where id = (select id from ord where k = 'n1');   -- у клиента несколько заказов: клиент не меняется
select pg_temp.ok(pg_temp.cid('n1') = pg_temp.cid('n2'), 'правка телефона в одном заказе увела заказ к другому человеку');
\echo '✅ 7. Смена телефона не меняет, кто клиент'

-- предоплата и права байера
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set request.jwt.claims = '{"aal":"aal2"}';
set role authenticated;
insert into t select 'dep1', public.wallet_add(pg_temp.cid('n1'), 'KGS', 1500, 'deposit', null, true)::text;
reset role;
select pg_temp.ok((select (v::json->>'balance')::numeric = 0 and (v::json->>'paid')::numeric = 1500 and (v::json->>'orders')::int = 2 from t where k = 'dep1'), 'пополнение: оплатило не долг этого клиента: ' || (select v from t where k = 'dep1'));
select pg_temp.ok((select paid_amount from public.orders where id = (select id from ord where k = 'n1')) = 1000, 'заказ клиента не оплачен');
select pg_temp.ok((select paid_amount from public.orders where id = (select id from ord where k = 'n3')) = 0, 'оплачен заказ другого человека (те же 9 цифр)');
set role authenticated;
select public.wallet_order((select id from ord where k = 'n2'), 'return', 200);
select public.wallet_order((select id from ord where k = 'n2'), 'pay', 100);
insert into t select 'cab1', public.client_cabinet((select id from ord where k = 'n1'), 'create');
insert into t select 'neg', (select count(*)::text from public.wallet_totals((select workspace_id from public.orders where id = (select id from ord where k = 'n1'))));
do $$ begin
  begin perform public.wallet_order((select id from ord where k = 'n3'), 'pay'); raise exception 'ПРОВАЛ: заказ другого человека оплачен с чужого баланса';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = pg_temp.cid('n1')) = 100, 'баланс после оплаты и возврата: ' || (select sum(amount) from public.client_wallet where client_id = pg_temp.cid('n1')));
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = pg_temp.cid('n3')) is null, 'у клиента n3 появились чужие деньги');
select pg_temp.ok(json_array_length(public.get_client_cabinet((select v from t where k = 'cab1'))->'orders') = 2, 'новая ссылка показывает не 2 заказа клиента');
select pg_temp.ok((public.get_client_cabinet((select v from t where k = 'cab1'))->'wallet'->0->>'amount')::numeric = 100, 'клиент в ссылке видит не свой баланс');
\echo '✅ 8. Предоплата и общая ссылка работают по клиенту, чужие 9 цифр не затрагиваются'

-- байер другого кабинета не видит чужих клиентов и денег и не может ничего объединять
create temp table ids as select pg_temp.cid('o1') as a1, pg_temp.cid('o2') as a2, pg_temp.cid('o5') as c1, pg_temp.cid('o6') as c2,
                                pg_temp.cid('o12') as g1, pg_temp.cid('o8') as e1, pg_temp.cid('o9') as e2;
grant all on ids to authenticated;
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set request.jwt.claims = '{"aal":"aal2"}';
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.client_link_candidates((select id from public.workspaces where name = 'Б-карго'));
  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужие совпадения'; end if;
  select count(*) into n from public.wallet_totals((select id from public.workspaces where name = 'Б-карго'));
  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужие балансы'; end if;
  select count(*) into n from public.client_wallet_review((select id from public.workspaces where name = 'Б-карго'));
  if n <> 0 then raise exception 'ПРОВАЛ: байер В видит чужие неразобранные деньги'; end if;
  begin perform public.client_merge((select a1 from ids), (select a2 from ids)); raise exception 'ПРОВАЛ: чужой байер объединил клиентов';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.client_merge((select a1 from ids), (select g1 from ids)); raise exception 'ПРОВАЛ: объединение клиентов разных кабинетов';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.client_wallet_assign_rows((select id from public.workspaces where name = 'Б-карго'),
          jsonb_build_array(jsonb_build_object('id', (select id from public.client_wallet where client_id is null limit 1), 'client', (select a1 from ids))));
        raise exception 'ПРОВАЛ: чужой байер распределил деньги';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
  begin perform public.wallet_add((select a1 from ids), 'KGS', 1, 'deposit'); raise exception 'ПРОВАЛ: чужой байер пополнил баланс';
  exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; end;
end $$;
reset role;
\echo '✅ 9. Другой кабинет не видит и не меняет клиентов, деньги и совпадения'

-- совпадения: предлагаются, но не объединяются сами
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
create temp table cand as select * from public.client_link_candidates((select id from public.workspaces where name = 'Б-карго'));
grant all on cand to authenticated;
reset role;
select pg_temp.ok(exists (select 1 from cand c, ids i where c.reason = 'same_last9' and least(c.a_id, c.b_id) = least(i.a1, i.a2) and greatest(c.a_id, c.b_id) = greatest(i.a1, i.a2)), 'нет предложения для одинаковых 9 цифр');
select pg_temp.ok(exists (select 1 from cand c, ids i where c.reason = 'same_name' and least(c.a_id, c.b_id) = least(i.c1, i.c2) and greatest(c.a_id, c.b_id) = greatest(i.c1, i.c2)), 'нет предложения для одинаковых имён');
select pg_temp.ok(exists (select 1 from cand c, ids i where c.reason = 'same_last9' and least(c.a_id, c.b_id) = least(i.e1, i.e2) and greatest(c.a_id, c.b_id) = greatest(i.e1, i.e2)), 'нет предложения для местного номера');
select pg_temp.ok(exists (select 1 from cand c where c.reason = 'same_phone'), 'нет предложения для заявки с тем же номером');
select pg_temp.ok(not exists (select 1 from cand c, ids i where i.g1 in (c.a_id, c.b_id)), 'клиент другого кабинета попал в предложения');
set role authenticated;
select public.client_link_dismiss((select e1 from ids), (select e2 from ids));
create temp table cand2 as select * from public.client_link_candidates((select id from public.workspaces where name = 'Б-карго'));
reset role;
select pg_temp.ok(not exists (select 1 from cand2 c, ids i where least(c.a_id, c.b_id) = least(i.e1, i.e2) and greatest(c.a_id, c.b_id) = greatest(i.e1, i.e2)), '«разные люди» не скрыло пару');
select pg_temp.ok(pg_temp.cid('o8') <> pg_temp.cid('o9'), 'предложение само объединило клиентов');
\echo '✅ 10. Совпадения только предлагаются; «разные люди» скрывает пару'

-- ручное объединение двух Азизов (владелец): заказы и деньги переходят, ссылки отключаются, история остаётся
set role authenticated;
insert into t select 'mrg', public.client_merge((select c1 from ids), (select c2 from ids))::text;
reset role;
select pg_temp.ok(pg_temp.cid('o5') = pg_temp.cid('o6'), 'после объединения заказы у разных клиентов');
select pg_temp.ok((select (v::json->>'orders')::int = 1 from t where k = 'mrg'), 'отчёт объединения: ' || (select v from t where k = 'mrg'));
select pg_temp.ok((select count(*) from public.client_merge_log where kept_id = pg_temp.cid('o5')) = 1, 'объединение не записано в журнал');
select pg_temp.ok((select count(*) from public.clients where id in ((select c1 from ids), (select c2 from ids))) = 1, 'после объединения остались оба клиента');
\echo '✅ 11. Объединение — только вручную, с журналом'

-- разбор спорных денег: только владелец, по одной операции, с журналом, без повторов и с сверкой
create temp table w1id as select id from public.workspaces where name = 'Б-карго';
grant all on w1id to authenticated;
set role authenticated;
create temp table rev as select * from public.client_wallet_review((select id from w1id));
create temp table rec0 as select * from public.wallet_reconcile((select id from w1id));
reset role;
select pg_temp.ok((select count(*) = 6 from rev), 'неразобранных операций: ' || (select count(*) from rev));
select pg_temp.ok((select sum(amount) from rev where currency = 'KGS') = (select unassigned from rec0 where currency = 'KGS'), 'сверка не видит неразобранные деньги');
select pg_temp.ok((select total = assigned + unassigned from rec0 where currency = 'KGS'), 'сверка: всего ≠ распределено + неразобрано');
select pg_temp.ok((select jsonb_array_length(candidates) = 2 from rev where legacy_key = public.client_key('+996700111222','x') limit 1), 'у спорного ключа не два кандидата');
create temp table rowid as select * from rev;
grant all on rowid to authenticated;
create temp table bal0 as select client_id, currency, sum(amount) s from public.client_wallet where client_id is not null group by 1,2;
set role authenticated;
-- 12a. деньги, оплатившие заказ, нельзя отдать не клиенту этого заказа
do $$
begin
  perform public.client_wallet_assign_rows((select id from w1id), (select jsonb_agg(jsonb_build_object('id', id, 'client', (select a2 from ids)))
          from rowid where legacy_key = public.client_key('+996700111222','x') and kind = 'order'));
  raise exception 'ПРОВАЛ: деньги оплаты заказа отданы чужому клиенту';
exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'order_client_mismatch' then raise exception 'ПРОВАЛ: ожидали order_client_mismatch, получили %', sqlerrm; end if;
end $$;
-- 12b. только списание без пополнения увело бы баланс в минус
do $$
begin
  perform public.client_wallet_assign_rows((select id from w1id), (select jsonb_agg(jsonb_build_object('id', id, 'client', (select a1 from ids)))
          from rowid where legacy_key = public.client_key('+996700111222','x') and kind = 'order'));
  raise exception 'ПРОВАЛ: баланс клиента ушёл в минус';
exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'negative_balance' then raise exception 'ПРОВАЛ: ожидали negative_balance, получили %', sqlerrm; end if;
end $$;
reset role;
select pg_temp.ok((select count(*) = 6 from public.client_wallet where client_id is null and ckey is not null and workspace_id = (select id from w1id)), 'отклонённые решения изменили данные');
select pg_temp.ok((select count(*) = 0 from public.client_wallet_assign_log), 'отклонённые решения попали в журнал');
set role authenticated;
-- 12c. настоящее решение: операции ключа A — клиенту A, «Азиз» — выбранному клиенту, «Призрак» — новому
insert into t select 'asg', public.client_wallet_assign_rows((select id from w1id),
  (select jsonb_agg(jsonb_build_object('id', id, 'client', (select a1 from ids))) from rowid where legacy_key = public.client_key('+996700111222','x')) ||
  (select jsonb_agg(jsonb_build_object('id', id, 'client', pg_temp.cid('o5'))) from rowid where legacy_key = public.client_key(null,'Азиз')) ||
  (select jsonb_agg(jsonb_build_object('id', id, 'new_name', 'Призрак')) from rowid where legacy_key = public.client_key('+996 111 000 999','x')))::text;
reset role;
select pg_temp.ok((select v::json->>'assigned' = '5' from t where k = 'asg'), 'распределено не 5 операций: ' || (select v from t where k = 'asg'));
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = (select a1 from ids)) = 3500, 'после разбора у клиента не та сумма');
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = (select a2 from ids)) is null, 'деньги достались не тому, кого выбрал владелец');
select pg_temp.ok((select name from public.clients where id = (select client_id from public.client_wallet where ckey = public.client_key('+996 111 000 999','x'))) = 'Призрак', 'новый клиент не создан');
select pg_temp.ok((select count(*) = 5 from public.client_wallet_assign_log), 'журнал распределения: ' || (select count(*) from public.client_wallet_assign_log));
select pg_temp.ok((select count(*) from public.client_link_review where kind = 'wallet' and resolved_at is not null) = 3, 'решение не записано');
select pg_temp.ok((select count(*) = 1 from public.client_wallet where client_id is null and ckey is not null and workspace_id = (select id from w1id)), 'осталась не одна неразобранная операция (Местный)');
-- 12d. повторное распределение той же операции невозможно, итоги не меняются
create temp table bal1 as select client_id, currency, sum(amount) s from public.client_wallet where client_id is not null group by 1,2;
set role authenticated;
do $$
begin
  perform public.client_wallet_assign_rows((select id from w1id), (select jsonb_agg(jsonb_build_object('id', id, 'client', (select a2 from ids))) from rowid where legacy_key = public.client_key('+996700111222','x') and kind = 'deposit'));
  raise exception 'ПРОВАЛ: уже распределённая операция распределена повторно';
exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm <> 'already_assigned' then raise exception 'ПРОВАЛ: ожидали already_assigned, получили %', sqlerrm; end if;
end $$;
create temp table rec1 as select * from public.wallet_reconcile((select id from w1id));
reset role;
select pg_temp.ok(not exists (select 1 from bal1 a full join (select client_id, currency, sum(amount) s from public.client_wallet where client_id is not null group by 1,2) b using (client_id, currency) where a.s is distinct from b.s), 'повтор изменил балансы');
select pg_temp.ok((select total from rec1 where currency = 'KGS') = (select total from rec0 where currency = 'KGS'), 'общая сумма предоплат изменилась после разбора');
select pg_temp.ok((select unassigned from rec1 where currency = 'KGS') = 100 and (select unassigned_rows from rec1 where currency = 'KGS') = 1, 'сверка не показывает оставшиеся 100 неразобранных');
\echo '✅ 12. Спорные деньги: по одной операции, только владелец, с журналом, без повторов, сверка сходится'

-- общая ссылка после объединения/разбора: новую выпускает байер, она показывает только его клиента
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
insert into t select 'cab2', public.client_cabinet((select id from ord where k = 'o1'), 'create');
reset role;
select pg_temp.ok(json_array_length(public.get_client_cabinet((select v from t where k = 'cab2'))->'orders') = 1, 'новая ссылка клиента A показывает не один заказ');
select pg_temp.ok((public.get_client_cabinet((select v from t where k = 'cab2'))->'wallet'->0->>'amount')::numeric = 3500, 'в ссылке клиента A не его баланс');
\echo '✅ 13. Новая ссылка показывает только своего клиента'

-- клиент сам заполняет адрес на странице своего заказа (публичная функция): тот же клиент, баланс и ссылки целы
create temp table pre as select pg_temp.cid('o7') as cl, (select sum(amount) from public.client_wallet where client_id = pg_temp.cid('o7')) as bal;
set request.uid = '';
set role anon;
select public.save_client_info((select tok from ord where k = 'o7'), 'Одинокий Клиент', '+996555111000', null, 'Ош', null, 'ПВЗ 5');
reset role;
select pg_temp.ok(pg_temp.cid('o7') = (select cl from pre), 'форма адреса создала другого клиента');
select pg_temp.ok((select has_card and city = 'Ош' from public.clients where id = pg_temp.cid('o7')), 'клиент без карточки не стал карточкой');
select pg_temp.ok((select match_phone is null from public.clients where id = pg_temp.cid('o7')), 'публичная форма изменила ключ поиска совпадений');
select pg_temp.ok((select sum(amount) from public.client_wallet where client_id = pg_temp.cid('o7')) = (select bal from pre), 'после заполнения адреса баланс изменился');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'o7'))->'client'->>'city') = 'Ош', 'после заполнения адреса карточка не видна на странице заказа');
\echo '✅ 14. Клиент заполняет адрес: тот же клиент, баланс и ключ поиска не меняются'

-- ---------- 15. Ссылка заказа не получает чужую карточку ----------
\echo ''
create temp table vic as select gen_random_uuid() as v;
grant all on vic, ord, t to authenticated, anon;
insert into public.clients (id, workspace_id, name, phone, city, pickup_point, telegram)
  select v, :'w1', 'Жертва Карточкина', '+996702500500', 'Бишкек', 'ПВЗ СЕКРЕТ-77', 'victim_tg' from vic;
create temp table vsnap as select * from public.clients where id = (select v from vic);
select pg_temp.ins('v1', :'w1', 'Жертва', '+996702500500');                         -- заказ байера: автосвязь по полному номеру
select pg_temp.ins('r1', :'w1', 'Посторонний', '+996702500500', 'request');         -- заявка постороннего с чужим номером
select pg_temp.ins('r2', :'w1', 'Посторонний 2', '+996702500500', 'request');
select pg_temp.ok(pg_temp.cid('v1') = (select v from vic), 'заказ байера не присоединился к карточке по полному номеру');
select pg_temp.ok(pg_temp.cid('r1') <> (select v from vic), 'заявка присоединилась к карточке');
-- байер обрабатывает заявку (меняет статус и цену) — клиент не меняется
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
update public.orders set status = 'purchasing', client_price = 2000 where id = (select id from ord where k = 'r1');
reset role;
select pg_temp.ok(pg_temp.cid('r1') <> (select v from vic), 'обработка заявки присоединила её к карточке');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'v1'))->>'client') is null, 'заказ, присоединённый по номеру, показывает карточку');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'r1'))->>'client') is null, 'заявка показывает карточку');
-- владелец объединяет заявителя с карточкой (в обе стороны: один раз stub оставляем, второй раз — карточку)
set role authenticated;
select public.client_merge((select v from vic), pg_temp.cid('r1'));
select public.client_merge(pg_temp.cid('r2'), (select v from vic));
reset role;
select pg_temp.ok(pg_temp.cid('r1') = (select v from vic) and pg_temp.cid('r2') = (select v from vic), 'объединение не сработало');
select pg_temp.ok((select not client_card_ok from public.orders where id = (select id from ord where k = 'r1')) and (select not client_card_ok from public.orders where id = (select id from ord where k = 'r2')), 'объединение оставило доступ к карточке');
select pg_temp.ok(position('СЕКРЕТ-77' in coalesce(public.get_client_order((select tok from ord where k = 'r1'))::text, '')) = 0
                  and position('Жертва Карточкина' in public.get_client_order((select tok from ord where k = 'r1'))::text) = 0
                  and position('victim_tg' in public.get_client_order((select tok from ord where k = 'r2'))::text) = 0
                  and (public.get_client_order((select tok from ord where k = 'r2'))->>'client') is null,
                  'после объединения первоначальная ссылка заявки показывает адрес/контакты карточки');
select pg_temp.ok(position('Жертва Карточкина' in public.get_client_order((select tok from ord where k = 'r1'))::text) = 0, 'имя карточки видно по ссылке заявки');
-- посторонний пробует записать свои данные «в карточку» через форму
set request.uid = '';
set role anon;
select public.save_client_info((select tok from ord where k = 'r1'), 'Хакер', '+996700000001', 'hacker_tg', 'Ош', 'ул. Ленина 1 кв 2', null);
select public.save_client_info((select tok from ord where k = 'v1'), 'Хакер Два', '+996700000002', null, 'Талас', null, 'ПВЗ ХАКЕРА');
reset role;
select pg_temp.ok((select (name, phone, city, pickup_point, telegram, address) is not distinct from (name, phone, city, pickup_point, telegram, address)
                     from public.clients c where c.id = (select v from vic))
                  and (select row(name, phone, city, pickup_point, telegram, address) from public.clients where id = (select v from vic))
                      is not distinct from (select row(name, phone, city, pickup_point, telegram, address) from vsnap),
                  'форма заказа перезаписала чужую карточку');
select pg_temp.ok(pg_temp.cid('r1') <> (select v from vic) and pg_temp.cid('v1') <> (select v from vic), 'заказы остались у чужой карточки после формы');
select pg_temp.ok((public.get_client_order((select tok from ord where k = 'r1'))->'client'->>'name') = 'Хакер', 'форма не вернула собственные данные заказа');
select pg_temp.ok((select match_phone from public.clients where id = pg_temp.cid('r1')) = '+996702500500', 'ключ поиска новой карточки взят из формы, а не из заказа');
select pg_temp.ok((select count(*) = 0 from public.clients c where c.workspace_id = :'w1' and not c.has_card and not exists (select 1 from public.orders o where o.client_id = c.id) and not exists (select 1 from public.client_wallet w where w.client_id = c.id) and c.name in ('Посторонний', 'Посторонний 2', 'Жертва')), 'остались «пустые» клиенты без заказов');
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
create temp table cand15 as select * from public.client_link_candidates(:'w1');
reset role;
select pg_temp.ok((select count(*) from cand15 where reason = 'same_phone') >= 1, 'пара «новая карточка и жертва» не предложена владельцу');
\echo '✅ 15. Ссылка заказа не даёт доступ к чужой карточке ни после автосвязи, ни после ручного объединения; форма её не перезаписывает'

-- ---------- 16. Совместимость со старым сайтом ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
grant all on w1id to authenticated;
create temp table wsum0 as select sum(amount) s, count(*) c from public.client_wallet;
set role authenticated;
do $$
begin
  perform public.wallet_add((select id from w1id), public.client_key('+996700111222','x'), 'Айбек', 'KGS', 999, 'deposit', null, false);
  raise exception 'ПРОВАЛ: старый вызов wallet_add выполнился';
exception when others then if sqlerrm like 'ПРОВАЛ%' then raise; end if; if sqlerrm not like 'app_update_required%' then raise exception 'ПРОВАЛ: ожидали app_update_required, получили %', sqlerrm; end if;
end $$;
create temp table oldtot as select * from public.wallet_totals((select id from w1id));
reset role;
select pg_temp.ok((select s = (select sum(amount) from public.client_wallet) and c = (select count(*) from public.client_wallet) from wsum0), 'старый вызов wallet_add сохранил часть денег');
select pg_temp.ok((select count(*) > 0 and bool_and(ckey like 'client:%') from oldtot), 'wallet_totals не отдаёт совместимое поле ckey');
select pg_temp.ok(not exists (select 1 from oldtot where ckey in (public.client_key('+996700111222','x'), public.client_key(null,'Азиз'))), 'старый ключ совпал с ключом нового баланса');
\echo '✅ 16. Старые вызовы wallet_add не сохраняют деньги и не угадывают клиента; старый сайт получает понятную ошибку'

-- ---------- 17. Клиент без адреса управляется байером ----------
set request.uid = '00000000-0000-0000-0000-0000000000b1';
set role authenticated;
create temp table stubs as select id, name from public.clients where workspace_id = :'w1' and not has_card;
create temp table stubupd as with u as (update public.clients set name = 'Исправлено Имя', phone = '+996703123123', telegram = 'fixed_tg' where id = (select id from stubs limit 1) returning id, match_phone) select * from u;
reset role;
select pg_temp.ok((select count(*) > 5 from stubs), 'байер не видит клиентов без адреса');
select pg_temp.ok((select count(*) = 1 from stubupd), 'байер не смог исправить клиента без адреса');
select pg_temp.ok((select match_phone from stubupd) = '+996703123123', 'ключ поиска не следует за исправленным телефоном');
set request.uid = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
create temp table foreign_upd as with u as (update public.clients set name = 'Взлом' where id = (select id from stubupd) returning id) select * from u;
create temp table foreign_see as select id from public.clients where id = (select id from stubupd);
reset role;
select pg_temp.ok((select count(*) = 0 from foreign_upd) and (select count(*) = 0 from foreign_see), 'байер другого кабинета видит или меняет клиента без адреса');
select pg_temp.ok((select name = 'Исправлено Имя' from public.clients where id = (select id from stubupd)), 'имя клиента изменилось чужим байером');
-- новый заказ с исправленным номером присоединяется к нему (если клиент один)
select pg_temp.ins('n9', :'w1', 'Кто-то', '+996703123123');
select pg_temp.ok(pg_temp.cid('n9') = (select id from stubupd) or (select count(*) from public.clients where workspace_id = :'w1' and match_phone = '+996703123123') > 1, 'новый заказ с исправленным номером не нашёл клиента');
\echo '✅ 17. Клиент без адреса доступен байеру для поиска, исправления и разбора; чужой кабинет его не видит'

\echo ''
\echo '🎉 Перенос и работа клиентов по постоянному номеру: все проверки пройдены'
