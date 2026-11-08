// =====================================================
// ПРОВЕРКА ФАЙЛА 59 (ежедневная работа). Запускается из tests/daily_test.sh.
// =====================================================
import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { promisify } from "node:util";

const sh = promisify(execFile);
const NAME = process.env.ULA_PG_CONTAINER;
const B = "00000000-0000-0000-0000-0000000000b1", C = "00000000-0000-0000-0000-0000000000c1", D = "00000000-0000-0000-0000-0000000000d1";

async function psql(q) {
  const { stdout } = await sh("docker", ["exec", "-i", NAME, "psql", "-U", "postgres", "-At", "-q", "-X", "-v", "ON_ERROR_STOP=1", "-c", q]);
  return stdout.trim();
}
const sql = async (q) => (await psql(q)).split("\n").filter((l) => l && l !== "SET").pop() ?? "";
const asUser = (uid, q) => sql(`set request.uid = '${uid}'; set role authenticated; ${q}`);
const asAnon = (q) => sql(`set role anon; ${q}`);
const json = async (p) => JSON.parse(await p);
const failsWith = async (fn, re, msg) => {
  try { await fn(); } catch (e) { assert.match(String(e.stderr || e.message), re, msg + ": " + (e.stderr || e.message)); return; }
  assert.fail(msg + ": ошибки не было");
};
let n = 0; const pass = (m) => { console.log("   ✓ " + m); n++; };

const WSB = await sql(`select workspace_id from public.workspace_members where user_id = '${B}' and role = 'owner'`);
const WSC = await sql(`select workspace_id from public.workspace_members where user_id = '${C}' and role = 'owner'`);
const O1 = await sql("select v from public._t where k = 'o1'");

// ---------- 1. Режим в профиле ----------
{
  let p = await json(asUser(B, "select public.my_ui_prefs()::text"));
  assert.equal(p.simple, null); assert.equal(p.explicit, false);
  // автоматическое решение заполняет только пустой профиль
  p = await json(asUser(B, "select public.my_ui_prefs_set(true, false)::text"));
  assert.deepEqual([p.simple, p.explicit], [true, false]);
  // явный выбор записывается и помечается явным
  p = await json(asUser(B, "select public.my_ui_prefs_set(false, true)::text"));
  assert.deepEqual([p.simple, p.explicit], [false, true]);
  // автоматическое решение (число заказов) явный выбор не меняет
  p = await json(asUser(B, "select public.my_ui_prefs_set(true, false)::text"));
  assert.deepEqual([p.simple, p.explicit], [false, true], "автоматика перезаписала явный выбор");
  // чужой профиль не меняется
  p = await json(asUser(C, "select public.my_ui_prefs()::text"));
  assert.equal(p.simple, null, "выбор одного человека виден другому");
  p = await json(asUser(C, "select public.my_ui_prefs_set(true, false)::text"));
  assert.deepEqual([p.simple, p.explicit], [true, false]);
  p = await json(asUser(C, "select public.my_ui_prefs_set(false, false)::text"));   // авто уже решило — повторное авто молчит
  assert.deepEqual([p.simple, p.explicit], [true, false]);
  p = await json(asUser(B, "select public.my_ui_prefs()::text"));
  assert.deepEqual([p.simple, p.explicit], [false, true], "правка C изменила профиль B");
  await failsWith(() => asUser(B, "select public.my_ui_prefs_set(null, true)"), /bad_value/, "пустое значение");
  await failsWith(() => asAnon("select public.my_ui_prefs()"), /permission denied/, "аноним читает профиль");
  await failsWith(() => asAnon("select public.my_ui_prefs_set(true, true)"), /permission denied/, "аноним меняет профиль");
  // напрямую в таблицу профиля писать нельзя ни одному пользователю чужое
  assert.equal(await asUser(B, `with x as (update public.profiles set ui_simple = true where user_id = '${C}' returning 1) select count(*) from x`).catch(() => "0"), "0", "B изменил профиль C напрямую");
  pass("простой режим хранится в профиле: явный выбор защищён от автоматики, чужой профиль недоступен");
}

// ---------- 2. Модули «Магазин» и «Обмен» ----------
{
  let g = await json(asUser(B, `select public.ws_daily_get('${WSB}')::text`));
  assert.equal(g.shop, true); assert.equal(g.exchange, true);   // по умолчанию всё включено
  g = await json(asUser(D, `select public.ws_daily_get('${WSB}')::text`));
  assert.equal(g.shop, true, "сотрудник не видит настройки кабинета");
  await failsWith(() => asUser(C, `select public.ws_daily_get('${WSB}')`), /forbidden/, "чужой кабинет читает настройки");
  await failsWith(() => asAnon(`select public.ws_daily_get('${WSB}')`), /permission denied/, "аноним читает настройки");
  await failsWith(() => asUser(D, `select public.ws_daily_set_modules('${WSB}', false, false)`), /forbidden/, "сотрудник выключает модули");
  await failsWith(() => asUser(C, `select public.ws_daily_set_modules('${WSB}', false, false)`), /forbidden/, "чужой владелец выключает модули");
  await failsWith(() => asAnon(`select public.ws_daily_set_modules('${WSB}', false, false)`), /permission denied/, "аноним выключает модули");
  await failsWith(() => asUser(B, `select public.ws_daily_set_modules('${WSB}', null, false)`), /bad_value/, "пустое значение модуля");
  assert.equal(await sql(`select module_shop::text || module_exchange::text from public.workspaces where id = '${WSB}'`), "truetrue");

  // действующая сделка обмена: отправлена давно, спора нет
  await sql(`insert into public.exchange_requests (workspace_id, client_name, client_phone, cny, som, rate, source, status, sent_at)
             values ('${WSB}', 'Сделка Один', '+996555111222', 100, 1300, 13, 'cab', 'sent', now() - interval '30 hours'),
                    ('${WSB}', 'Сделка Два', '+996555111333', 100, 1300, 13, 'cab', 'sent', now() - interval '30 hours')`);
  await sql(`update public.exchange_requests set dispute = 'open', dispute_by = 'client', dispute_at = now() where client_name = 'Сделка Два'`);
  const before = await sql(`select count(*) || '/' || (select count(*) from public.orders where workspace_id = '${WSB}') from public.exchange_requests where workspace_id = '${WSB}'`);
  g = await json(asUser(B, `select public.ws_daily_set_modules('${WSB}', false, false)::text`));
  assert.deepEqual([g.shop, g.exchange], [false, false]);
  assert.equal(Number(g.exchange_open), 2, "действующие сделки и спор должны быть видны при выключенном модуле");
  // данные целы
  assert.equal(await sql(`select count(*) || '/' || (select count(*) from public.orders where workspace_id = '${WSB}') from public.exchange_requests where workspace_id = '${WSB}'`), before, "выключение модуля изменило данные");
  // финансовые правила не изменились: автозакрытие работает при выключенном модуле, спор защищает сделку
  await sql(`set role service_role; select public.fx_autoclose_all(100, now())`);
  const st = await sql(`select string_agg(client_name || '=' || status, ',' order by client_name) from public.exchange_requests where workspace_id = '${WSB}'`);
  assert.equal(st, "Сделка Один=done,Сделка Два=sent".split(",").sort().join(","), "правила автозакрытия изменились: " + st);
  // спор по-прежнему защищает сделку: пока он открыт, статус менять нельзя (правило файла 31, модуль его не отключает)
  await failsWith(() => asUser(D, `update public.exchange_requests set status = 'cancelled' where client_name = 'Сделка Два'`), /dispute_open/, "спор перестал защищать сделку");
  await sql(`update public.exchange_requests set dispute = 'resolved', dispute_result = 'client' where client_name = 'Сделка Два'`);   // спор решён (в базе это делает администратор платформы)
  // сделка завершена обычным путём (в базе: клиент подтвердил / администратор закрыл спор) — обязательств больше нет
  await sql(`update public.exchange_requests set status = 'done' where client_name = 'Сделка Два'`);
  g = await json(asUser(B, `select public.ws_daily_get('${WSB}')::text`));
  assert.equal(Number(g.exchange_open), 0);
  // включается обратно без потерь
  g = await json(asUser(B, `select public.ws_daily_set_modules('${WSB}', true, true)::text`));
  assert.deepEqual([g.shop, g.exchange], [true, true]);
  pass("модули: только владелец, данные и правила не меняются, действующие сделки и споры видны");
}

// ---------- 3. Часовой пояс ----------
{
  await sql("truncate public.order_tasks, public.order_deadline_history cascade");
  await sql(`update public.orders set status = 'purchasing', client_price = 3000, paid_amount = 1000 where id = '${O1}'`);
  // срок оплаты 10.03.2099 23:30 по Бишкеку (UTC+6) = 17:30Z; доставка 10–12.03 (до конца 12 марта)
  await asUser(B, `select public.order_set_deadlines('${O1}', '2099-03-10 23:30'::timestamp, '2099-03-10'::date, '2099-03-12'::date)`);
  const snap = async () => sql(`select payment_due_at::text || '|' || delivery_eta_from::text || '|' || delivery_eta_to::text from public.orders where id = '${O1}'`);
  const s0 = await snap();
  const h0 = await sql("select count(*) from public.order_deadline_history");
  assert.equal(await sql(`select time_zone_confirmed_at is null from public.workspaces where id = '${WSB}'`), "t", "пояс не должен считаться подтверждённым сам");
  await failsWith(() => asUser(D, `select public.ws_timezone_preview('${WSB}', 'Asia/Tokyo')`), /forbidden/, "сотрудник смотрит последствия смены пояса");
  await failsWith(() => asUser(C, `select public.ws_timezone_preview('${WSB}', 'Asia/Tokyo')`), /forbidden/, "чужой владелец смотрит последствия");
  await failsWith(() => asUser(D, `select public.ws_set_timezone('${WSB}', 'Asia/Tokyo')`), /forbidden/, "сотрудник меняет пояс");
  await failsWith(() => asUser(D, `select public.ws_confirm_timezone('${WSB}')`), /forbidden/, "сотрудник подтверждает пояс");
  await failsWith(() => asUser(C, `select public.ws_set_timezone('${WSB}', 'Asia/Tokyo')`), /forbidden/, "чужой владелец меняет пояс");
  await failsWith(() => asUser(B, `select public.ws_set_timezone('${WSB}', 'Mars/Olympus')`), /bad_timezone/, "несуществующий пояс");
  await failsWith(() => asAnon(`select public.ws_set_timezone('${WSB}', 'Asia/Tokyo')`), /permission denied/, "аноним меняет пояс");
  assert.equal(await sql(`select time_zone from public.workspaces where id = '${WSB}'`), "Asia/Bishkek");

  // Токио (UTC+9): 17:30Z = 02:30 следующего дня, начало 10 марта 00:00+06 = 18:00Z (9 марта) → 03:00 10 марта: даты меняются
  const pv = await json(asUser(B, `select public.ws_timezone_preview('${WSB}', 'Asia/Tokyo')::text`));
  assert.equal(pv.old, "Asia/Bishkek"); assert.equal(pv.new, "Asia/Tokyo");
  assert.equal(Number(pv.orders_with_deadlines), 1); assert.equal(Number(pv.date_changes), 1, "предпросмотр не заметил сдвиг даты");
  assert.equal(await snap(), s0, "предпросмотр изменил сроки");
  const pv2 = await json(asUser(B, `select public.ws_timezone_preview('${WSB}', 'Asia/Almaty')::text`));   // UTC+5: 18:30 — день тот же
  assert.equal(Number(pv2.date_changes), 1, "Алматы: начало интервала 10.03 00:00+06 = 9.03 23:00+05 — дата другая");

  // подтверждение без смены
  await asUser(B, `select public.ws_confirm_timezone('${WSB}')`);
  assert.equal(await sql(`select (time_zone_confirmed_at is not null)::text || time_zone from public.workspaces where id = '${WSB}'`), "trueAsia/Bishkek");
  assert.equal(await sql("select count(*) from public.ws_timezone_log"), "0", "подтверждение попало в журнал смен");

  // смена: моменты, история и задачи не меняются
  const t0 = await sql("select count(*) from public.order_tasks");
  await asUser(B, `select public.ws_set_timezone('${WSB}', 'Asia/Tokyo')`);
  assert.equal(await snap(), s0, "смена пояса сдвинула согласованные моменты");
  assert.equal(await sql("select count(*) from public.order_deadline_history"), h0, "смена пояса записала сдвиг в историю сроков");
  assert.equal(await sql("select count(*) from public.order_tasks"), t0, "смена пояса пересоздала задачи");
  const lg = await sql("select old_zone || '>' || new_zone || ':' || affected from public.ws_timezone_log");
  assert.equal(lg, "Asia/Bishkek>Asia/Tokyo:1", "смена пояса не записана в журнал: " + lg);
  // граница просрочки — тот же абсолютный момент (17:30:00Z) до и после смены пояса
  const DUEZ = "2099-03-10T17:30:00Z";
  const run = async (now) => { await sql("set role service_role; select public.deadlines_scan('" + now + "'::timestamptz)"); return sql(`select count(*) from public.order_tasks where order_id = '${O1}' and kind = 'payment_overdue' and status = 'open'`); };
  assert.equal(await run("2099-03-10T17:30:00Z"), "0", "в момент срока заказ уже просрочен");
  assert.equal(await run("2099-03-10T17:30:01Z"), "1", "после срока задача должна появиться ровно по прежнему моменту");
  // возврат пояса: те же моменты
  await asUser(B, `select public.ws_set_timezone('${WSB}', 'Asia/Bishkek')`);
  assert.equal(await snap(), s0);
  pass("часовой пояс: подтверждение, предпросмотр, журнал; сроки, история и задачи не двигаются, граница просрочки прежняя");
}

// ---------- 4. Выбор клиента по постоянному номеру ----------
{
  // два клиента с одним именем и без адреса (создаёт служебная часть базы, как триггер заказа)
  const c1 = await sql(`insert into public.clients (workspace_id, name) values ('${WSB}', 'Айбек') returning id`);
  const c2 = await sql(`insert into public.clients (workspace_id, name) values ('${WSB}', 'Айбек') returning id`);
  const foreign = await sql(`insert into public.clients (workspace_id, name) values ('${WSC}', 'Чужой клиент') returning id`);
  assert.notEqual(c1, c2);
  // заказ с выбранным client_id уходит именно к выбранному, а не к «первому по имени»
  const oid = await asUser(B, `insert into public.orders (client_name, product_ru, client_id) values ('Айбек', 'Лампа', '${c2}') returning id`);
  assert.equal(await sql(`select client_id from public.orders where id = '${oid}'`), c2, "выбранный клиент заменён другим");
  // заказ без выбора и без телефона не присоединяется к клиенту с тем же именем
  const oid2 = await asUser(B, `insert into public.orders (client_name, product_ru) values ('Айбек', 'Чайник') returning id`);
  const k2 = await sql(`select client_id from public.orders where id = '${oid2}'`);
  assert.ok(k2 !== c1 && k2 !== c2, "заказ без телефона объединён по имени");
  // чужой клиент недоступен
  await failsWith(() => asUser(B, `insert into public.orders (client_name, product_ru, client_id) values ('Айбек', 'Лампа', '${foreign}')`), /bad_client/, "заказ привязан к клиенту чужого кабинета");
  await failsWith(() => asUser(B, `update public.orders set client_id = '${foreign}' where id = '${oid}'`), /bad_client/, "заказ перепривязан к чужому клиенту");
  await failsWith(() => asUser(B, `insert into public.orders (client_name, product_ru, client_id) values ('Айбек', 'Лампа', '00000000-0000-0000-0000-00000000dead')`), /bad_client|violates foreign key/, "несуществующий клиент");
  // старые данные с «чужим» client_id не блокируют обычные правки заказа
  await sql(`alter table public.orders disable trigger orders_link_client; update public.orders set client_id = '${foreign}' where id = '${oid2}'; alter table public.orders enable trigger orders_link_client`);
  assert.equal(await asUser(B, `with x as (update public.orders set product_ru = 'Чайник 2' where id = '${oid2}' returning 1) select count(*) from x`), "1", "старая неточность блокирует правку заказа");
  pass("клиент выбирается по постоянному номеру: имя не объединяет, чужой кабинет закрыт, старые данные правке не мешают");
}

// ---------- 5. Права сотрудника на сервере ----------
{
  // кнопка может быть скрыта, но проверку делает база
  const oid = await asUser(B, `insert into public.orders (client_name, product_ru) values ('Права', 'Кружка') returning id`);
  assert.equal(await asUser(D, `with x as (delete from public.orders where id = '${oid}' returning 1) select count(*) from x`), "0", "сотрудник удалил заказ");
  assert.equal(await sql(`select count(*) from public.orders where id = '${oid}'`), "1");
  await failsWith(() => asUser(D, `select public.reminder_settings_set('${WSB}', true, 9, 20, 24, 72, 3, 50)`), /forbidden/, "сотрудник включил напоминания клиентам");
  assert.equal(await asUser(D, `with x as (update public.orders set status = 'purchasing' where id = '${oid}' returning 1) select count(*) from x`), "1", "сотрудник должен менять статус заказа");
  assert.equal(await asUser(C, `with x as (update public.orders set status = 'cancelled' where id = '${oid}' returning 1) select count(*) from x`), "0", "чужой кабинет изменил заказ");
  assert.equal(await asUser(C, `select count(*) from public.orders where id = '${oid}'`), "0", "чужой кабинет видит заказ");
  pass("сотрудник: нельзя удалять заказы и включать напоминания; изменять статус можно; чужой кабинет закрыт");
}

console.log(`\n🎉 Ежедневная работа (файл 59): проверено сценариев — ${n}`);
