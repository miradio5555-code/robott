-- =====================================================
-- ULA FACTORY — ОЦЕНКА ПЕРЕНОСА (файл 56) ДО ЗАПУСКА. Только чтение.
--
-- Что делает: по текущим данным рабочей базы считает, что сделает файл migration_56_client_identity.sql,
-- НИЧЕГО НЕ МЕНЯЯ (только SELECT; временных таблиц и функций не создаёт):
--   • сколько спорных и однозначных групп предоплаты (общий старый ключ у нескольких людей — спорная);
--   • сколько общих ссылок клиентов будет отключено (клиент увидит «ссылка не найдена», пока вы не выпустите новую);
--   • суммы спорных предоплат отдельно по кабинетам и валютам (эти деньги останутся «неразобранными»);
--   • сколько заказов не имеют надёжной связи с клиентом (без телефона, с неоднозначным телефоном).
-- Правила повторяют файл 56: телефон сравнивается ПОЛНОСТЬЮ (с кодом страны), имя и последние 9 цифр клиентов не объединяют.
--
-- Что НЕ выводит: имена, телефоны, адреса, токены ссылок, ключи, id клиентов и заказов. Только номера кабинетов
-- («Кабинет 1 (a1b2c3)» — первые 6 символов служебного номера кабинета), валюты, количества и суммы.
--
-- Как запустить: Supabase → SQL Editor → New query → вставить ВЕСЬ файл → Run. Результат — одна таблица:
-- скопируйте её целиком помощнику. Если не хватает предварительных условий, в таблице будет строка «СТОП» с пояснением,
-- а подсчётов не будет. Файл можно запускать сколько угодно раз.
--
-- Нужно до запуска: файл 50 (баланс клиента) запущен; файл 56 ещё НЕ запущен.
-- Оценка — до настоящей резервной копии и пробного восстановления не замена им (см. BACKUP.md).
-- =====================================================
with
ver as (
  select coalesce(
    (select string_to_array(
       (xpath('/row/c/text()', query_to_xml('select coalesce(string_agg(version::text, '','' order by version), '''') c from public.schema_migrations', false, true, '')))[1]::text, ',')
     where to_regclass('public.schema_migrations') is not null),
    array[]::text[]) as v
),
cols(t, c) as (values
  ('orders', 'client_id'), ('orders', 'client_phone'), ('orders', 'client_name'), ('orders', 'client_currency'),
  ('orders', 'paid_amount'), ('orders', 'balance_som'), ('orders', 'workspace_id'),
  ('clients', 'phone'), ('clients', 'name'), ('clients', 'city'), ('clients', 'workspace_id'),
  ('client_wallet', 'ckey'), ('client_wallet', 'currency'), ('client_wallet', 'amount'), ('client_wallet', 'workspace_id'),
  ('client_cabinets', 'ckey'), ('client_cabinets', 'workspace_id')
),
chk(ord, chk, ok, det) as (
  select 1, 'Реестр schema_migrations есть', to_regclass('public.schema_migrations') is not null,
         'без реестра нельзя понять, какие файлы запущены'
  union all
  select 2, 'Файл 50 (баланс клиента) запущен', exists (select 1 from ver, unnest(ver.v) x where x = '50'),
         'сначала запустите migration_50_client_balance.sql'
  union all
  select 3, 'Файл 56 ещё не запущен', not exists (select 1 from ver, unnest(ver.v) x where x = '56'),
         'файл 56 уже запущен: оценка до запуска не нужна'
  union all
  select 4, 'В базе нет файлов новее 56', not exists (select 1 from ver, unnest(ver.v) x where x <> '' and x::int > 56),
         'файл 56 старше уже запущенных — его запускать нельзя'
  union all
  select 5, 'Таблицы orders, clients, client_wallet, client_cabinets есть',
         to_regclass('public.orders') is not null and to_regclass('public.clients') is not null
         and to_regclass('public.client_wallet') is not null and to_regclass('public.client_cabinets') is not null,
         'нет таблиц: запущены не все файлы (диагностика scripts/diagnose_supabase_readonly.sql покажет, каких)'
  union all
  select 6, 'Функция client_key(text, text) есть', to_regprocedure('public.client_key(text,text)') is not null,
         'её создаёт файл 50'
  union all
  select 7, 'Нужные столбцы на месте',
         not exists (select 1 from cols k where not exists (
           select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = k.t and i.column_name = k.c)),
         coalesce('нет столбцов: ' || (select string_agg(k.t || '.' || k.c, ', ') from cols k where not exists (
           select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = k.t and i.column_name = k.c)), '')
),
gate as (select coalesce(bool_and(ok), false) as ok from chk),
raw as (
  select r from unnest(xpath('/t/row', ('<t>' || query_to_xml(
    case when (select ok from gate) then $q$
with
ph as (
  select raw,
         case
           when raw like '+%' and char_length(d) between 9 and 15 then '+' || d
           when d like '00%' and char_length(substr(d, 3)) between 9 and 15 then '+' || substr(d, 3)
           when char_length(d) not between 9 and 15 then null
           when d like '0%' then d
           when char_length(d) >= 11 then '+' || d
           else d
         end as norm
    from (select raw, regexp_replace(raw, '\D', '', 'g') as d
            from (select distinct btrim(coalesce(x, '')) as raw
                    from (select client_phone as x from public.orders union select phone from public.clients) u) r0) z
),
wsn as (select id, dense_rank() over (order by id) as rn, left(id::text, 6) as sid from public.workspaces),
cl as (
  select c.id, c.workspace_id as ws, c.city,
         public.client_key(c.phone, c.name) as ckey,
         (select p.norm from ph p where p.raw = btrim(coalesce(c.phone, ''))) as mp
    from public.clients c
),
ord as (
  select o.id, o.workspace_id as ws, o.client_id as cid,
         (select p.norm from ph p where p.raw = btrim(coalesce(o.client_phone, ''))) as p,
         public.client_key(coalesce(c.phone, o.client_phone), coalesce(c.name, o.client_name)) as ckey
    from public.orders o left join public.clients c on c.id = o.client_id
),
ec as (select ws, mp, count(*) as n, (array_agg(id::text))[1] as one from cl where mp is not null group by ws, mp),
ot as (
  select ord.ws, ord.ckey,
         case when ord.cid is not null then 'linked'
              when ord.p is not null and coalesce(ec.n, 0) = 1 then 'exact'
              when ord.p is not null and coalesce(ec.n, 0) = 0 then 'sharedstub'
              when ord.p is not null then 'ambiguous_phone'
              else 'nophone' end as kind,
         case when ord.cid is not null then ord.cid::text
              when ord.p is not null and coalesce(ec.n, 0) = 1 then ec.one
              when ord.p is not null and coalesce(ec.n, 0) = 0 then 'sp:' || ord.ws::text || ':' || ord.p
              else 's:' || ord.id::text end as tgt
    from ord left join ec on ec.ws = ord.ws and ec.mp = ord.p
),
cand as (
  select ws, ckey, tgt from ot where ckey is not null
  union
  select ws, ckey, id::text from cl where ckey is not null
),
wk as (select ws, ckey, count(*) as n, (array_agg(tgt))[1] as one from cand group by ws, ckey),
wg as (select w.workspace_id as ws, w.ckey, w.currency as cur, sum(w.amount) as amt, count(*) as rws
         from public.client_wallet w group by 1, 2, 3),
wcls as (
  select wg.*, case coalesce(wk.n, 0) when 1 then 'ok' when 0 then 'none' else 'ambiguous' end as cls
    from wg left join wk on wk.ws = wg.ws and wk.ckey = wg.ckey
),
cabc as (
  select cc.workspace_id as ws,
         case when coalesce(wk.n, 0) = 0 then 'no_client'
              when wk.n > 1 then 'ambiguous'
              when exists (select 1 from ot x where x.ws = cc.workspace_id and x.tgt = wk.one and x.ckey <> cc.ckey) then 'not_subset'
              else 'ok' end as cls
    from public.client_cabinets cc left join wk on wk.ws = cc.workspace_id and wk.ckey = cc.ckey
),
m(o, sec, ws, cur, metric, val, note) as (
  select 100, '1 Заказы', ws, '', 'заказов всего', count(*)::numeric, '' from ot group by ws
  union all select 101, '1 Заказы', ws, '', 'уже привязаны к клиенту (клиент был)', count(*)::numeric, 'доступ к карточке прежний' from ot where kind = 'linked' group by ws
  union all select 102, '1 Заказы', ws, '', 'присоединятся к ОДНОМУ существующему клиенту по полному номеру', count(*)::numeric, 'надёжно' from ot where kind = 'exact' group by ws
  union all select 103, '1 Заказы', ws, '', 'получат общего нового клиента (тот же полный номер, карточки нет)', count(*)::numeric, 'надёжно: номер полный и один' from ot where kind = 'sharedstub' group by ws
  union all select 104, '1 Заказы', ws, '', 'без надёжной связи: номер совпал с НЕСКОЛЬКИМИ клиентами (каждый заказ — свой клиент)', count(*)::numeric, 'разберёте в «Совпадения»' from ot where kind = 'ambiguous_phone' group by ws
  union all select 105, '1 Заказы', ws, '', 'без надёжной связи: нет пригодного телефона (каждый заказ — свой клиент)', count(*)::numeric, 'имя ничего не доказывает; разберёте в «Совпадения»' from ot where kind = 'nophone' group by ws
  union all select 110, '2 Предоплата (группы по старому ключу)', ws, '', 'групп однозначных (ключ принадлежит одному клиенту)', count(*)::numeric, 'будут закреплены сами' from (select distinct ws, ckey, cls from wcls) g where cls = 'ok' group by ws
  union all select 111, '2 Предоплата (группы по старому ключу)', ws, '', 'групп СПОРНЫХ (ключ у нескольких людей)', count(*)::numeric, 'останутся неразобранными' from (select distinct ws, ckey, cls from wcls) g where cls = 'ambiguous' group by ws
  union all select 112, '2 Предоплата (группы по старому ключу)', ws, '', 'групп без единого клиента', count(*)::numeric, 'останутся неразобранными' from (select distinct ws, ckey, cls from wcls) g where cls = 'none' group by ws
  union all select 120, '3 Деньги: закрепятся за клиентом', ws, cur, 'сумма', amt, rws::text || ' операций' from (select ws, cur, sum(amt) as amt, sum(rws) as rws from wcls where cls = 'ok' group by ws, cur) q
  union all select 121, '4 Деньги СПОРНЫЕ: останутся неразобранными', ws, cur, 'сумма', amt, rws::text || ' операций; в балансы не входят, видны в сверке' from (select ws, cur, sum(amt) as amt, sum(rws) as rws from wcls where cls <> 'ok' group by ws, cur) q
  union all select 130, '5 Общие ссылки клиентов', ws, '', 'всего ссылок', count(*)::numeric, '' from cabc group by ws
  union all select 131, '5 Общие ссылки клиентов', ws, '', 'продолжат работать (один клиент, не шире прежнего)', count(*)::numeric, '' from cabc where cls = 'ok' group by ws
  union all select 132, '5 Общие ссылки клиентов', ws, '', 'БУДУТ ОТКЛЮЧЕНЫ (клиент увидит «ссылка не найдена»)', count(*)::numeric, 'причина: ' || cls from cabc where cls <> 'ok' group by ws, cls
  union all select 140, '6 Клиенты (для справки)', ws, '', 'клиентов с карточкой (есть город)', count(*)::numeric, '' from cl where city is not null group by ws
  union all select 141, '6 Клиенты (для справки)', ws, '', 'полных номеров, общих у двух и более клиентов (предложения «Совпадения»)', count(*)::numeric, '' from ec where n > 1 group by ws
  union all select 150, '7 Сверка (будет повторена файлом 56 до и после)', w.workspace_id, w.currency, 'предоплаты всего, сумма (не должна измениться)', sum(w.amount), count(*)::text || ' операций' from public.client_wallet w group by w.workspace_id, w.currency
)
select m.o as o, m.sec as sec,
       coalesce('Кабинет ' || wsn.rn || ' (' || wsn.sid || ')', '—') as ws,
       m.cur as cur, m.metric as metric, round(m.val, 2)::text as val, m.note as note
  from m left join wsn on wsn.id = m.ws
$q$ else 'select 1 where false' end, false, true, '')::text || '</t>')::xml)) as r
),
metrics as (
  select (xpath('/row/o/text()', r))[1]::text::int as o,
         coalesce((xpath('/row/sec/text()', r))[1]::text, '') as sec,
         coalesce((xpath('/row/ws/text()', r))[1]::text, '') as ws,
         coalesce((xpath('/row/cur/text()', r))[1]::text, '') as cur,
         coalesce((xpath('/row/metric/text()', r))[1]::text, '') as metric,
         coalesce((xpath('/row/val/text()', r))[1]::text, '') as val,
         coalesce((xpath('/row/note/text()', r))[1]::text, '') as note
    from raw
)
select ord as "№", 'Условия' as "раздел", '' as "кабинет", '' as "валюта", chk as "показатель",
       case when ok then 'OK' else 'СТОП' end as "значение",
       case when ok then '' else det end as "пояснение"
  from chk
union all
select o, sec, ws, cur, metric, val, note from metrics
union all
select 99, 'Итог', '', '', 'можно ли считать оценку',
       case when (select ok from gate) then 'да' else 'НЕТ: не выполнены условия выше, подсчёты не делались' end, ''
order by 1, 2, 3, 4, 5;
