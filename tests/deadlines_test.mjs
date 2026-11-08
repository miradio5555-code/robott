// =====================================================
// ПРОВЕРКА СРОКОВ, ЗАДАЧ, НАПОМИНАНИЙ И ЗАКРЫТИЯ ОБМЕНА (файл 58). Запускается из tests/deadlines_test.sh.
// «Сейчас» подставляется параметром p_now (служебные функции его принимают), поэтому границы времени проверяются точно.
// Доставка — настоящий обработчик (supabase/functions/_shared/order_notify.js) и поддельный Telegram.
// =====================================================
import { execFile } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import { processBatch } from "../supabase/functions/_shared/order_notify.js";

const sh = promisify(execFile);
const NAME = process.env.ULA_PG_CONTAINER;
const B = "00000000-0000-0000-0000-0000000000b1", C = "00000000-0000-0000-0000-0000000000c1", D = "00000000-0000-0000-0000-0000000000d1", ADM = "00000000-0000-0000-0000-00000000000a";

async function psql(q, ...flags) {
  const { stdout } = await sh("docker", ["exec", "-i", NAME, "psql", "-U", "postgres", "-At", "-q", "-X", "-v", "ON_ERROR_STOP=1", ...flags, "-c", q]);
  return stdout.trim();
}
const sql = async (q) => (await psql(q)).split("\n").filter((l) => l && l !== "SET").pop() ?? "";
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
const asUser = (uid, q) => sql(`set request.uid = '${uid}'; set role authenticated; ${q}`);
const failsWith = async (fn, re, msg) => { try { await fn(); } catch (e) { assert.match(String(e.stderr || e.message), re, msg + ": " + (e.stderr || e.message)); return; } assert.fail(msg + ": ошибки не было"); };
async function rpc(name, args) {
  const a = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ");
  const out = await sql(`set role service_role; select to_jsonb(public.${name}(${a}))`);
  return out ? JSON.parse(out) : null;
}

// ---------- поддельный Telegram ----------
const received = [], requests = [];
const server = http.createServer((req, res) => {
  let body = ""; req.on("data", (d) => (body += d));
  req.on("end", () => { const m = JSON.parse(body || "{}"); requests.push(String(m.chat_id)); received.push({ chat: String(m.chat_id), text: m.text });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, result: { message_id: received.length } })); });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const send = async (chatId, text) => { const r = await fetch(`http://127.0.0.1:${PORT}/sendMessage`, { method: "POST", body: JSON.stringify({ chat_id: chatId, text }) }); return { ok: r.ok, status: r.status, body: await r.json() }; };
let wn = 0;
// обработчик с подставленным «сейчас» (как будто он запущен в этот момент)
const worker = (now, over = {}) => processBatch({ siteUrl: "https://example.test/", worker: "w-" + ++wn, send,
  rpc: over.rpc || ((name, args) => rpc(name, name === "notify_claim" || name === "notify_begin_send" ? { ...args, p_now: now } : args)) });

const O1 = await sql("select v from public._t where k = 'o1'"), O2 = await sql("select v from public._t where k = 'o2'");
const WSB = await sql(`select workspace_id from public.workspace_members where user_id = '${B}' and role = 'owner'`);
const WSC = await sql(`select workspace_id from public.workspace_members where user_id = '${C}' and role = 'owner'`);
const scan = (now) => rpc("deadlines_scan", { p_now: now });
const tasks = async (where = "true") => JSON.parse(await sql(`select coalesce(jsonb_agg(to_jsonb(t) order by created_at, id), '[]') from (select * from public.order_tasks where ${where}) t`));
const queue = async (where = "true") => JSON.parse(await sql(`select coalesce(jsonb_agg(to_jsonb(q) order by seq), '[]') from (select * from public.order_notify_queue where ${where}) q`));
const enable = (extra = {}) => { const s = { en: true, f: 9, t: 20, gr: 24, gap: 72, mx: 3, day: 50, ...extra };
  return asUser(B, `select public.reminder_settings_set('${WSB}', ${s.en}, ${s.f}, ${s.t}, ${s.gr}, ${s.gap}, ${s.mx}, ${s.day})`); };
const setDue = (order, localTs, from = null, to = null, uid = B) => asUser(uid, `select public.order_set_deadlines('${order}', ${lit(localTs)}::timestamp, ${from ? lit(from) + "::date" : "null::date"}, ${to ? lit(to) + "::date" : "null::date"})`);
async function reset() {
  await sql("truncate public.order_notify_queue, public.order_tasks, public.ws_reminder_settings, public.ws_reminder_log, public.order_deadline_history, public.job_heartbeats cascade");
  await sql(`update public.workspaces set time_zone = 'Asia/Bishkek'`);
  await sql(`update public.orders set status = 'purchasing', client_price = 3000, paid_amount = 1000, payment_due_at = null, delivery_eta_from = null, delivery_eta_to = null, reminders_paused_at = null,
             tracking_number = 'TRK-1', weight_kg = 2 where id in ('${O1}', '${O2}')`);
  await sql(`update public.orders set client_price = 500, paid_amount = 0 where id = '${O2}'`);
  await sql(`update public.orders set public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', '')) where id in ('${O1}', '${O2}')`);
  await sql(`delete from public.order_tg_subs; insert into public.order_tg_subs (order_id, chat_id, lang, last_status) values
    ('${O1}', '1001', 'ru', 'purchasing'), ('${O1}', '1002', 'en', 'purchasing'), ('${O2}', '2001', 'ru', 'purchasing')`);
  await sql("truncate public.order_tasks, public.order_deadline_history, public.order_notify_queue cascade");
  received.length = 0; requests.length = 0;
}
let n = 0; const pass = (m) => { console.log("   ✓ " + m); n++; };
// «Сейчас», далёкое будущее: боевые триггеры (по реальному времени) ничего не видят, проверки идут по p_now
const DUE_LOCAL = "2099-03-10 09:00";           // местное время кабинета (Asia/Bishkek, UTC+6) = 03:00:00Z
const DUE = Date.parse("2099-03-10T03:00:00Z");
const at = (ms) => new Date(DUE + ms).toISOString();
const H = 3600e3;

// ---------- 0. Защита обработчика и служебных функций ----------
{
  const bad = await sql(`select string_agg(p.oid::regprocedure::text, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname in ('_tasks_sync','_reminders_enqueue','_notify_check','_notify_log','_notify_unknown','_job_beat','_next_send_window','_orders_tasks_sync','_orders_notify_enqueue','_orders_deadline_history','notify_claim','notify_finish','notify_begin_send','deadlines_scan','fx_autoclose_all','fx_autoclose_job','job_beat'))
       and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`);
  assert.equal(bad, "", "служебные функции доступны сайту или анониму: " + bad);
  await failsWith(() => sql("set role anon; select public.deadlines_scan()"), /permission denied/, "аноним запускает проверку сроков");
  await failsWith(() => asUser(B, "select public.deadlines_scan()"), /permission denied/, "обычный пользователь запускает проверку сроков");
  await failsWith(() => asUser(B, "select public.fx_autoclose_job()"), /permission denied/, "пользователь запускает закрытие обмена");
  await failsWith(() => asUser(B, "select public.job_beat('order_notify_worker', true)"), /permission denied/, "пользователь пишет пульс");
  await failsWith(() => sql("set role service_role; select public.job_beat('anything', true)"), /bad_job/, "пульс чужой задачи");
  assert.equal(await sql("select count(*) from pg_tables where schemaname = 'public' and tablename in ('order_tasks','ws_reminder_settings','ws_reminder_log','job_heartbeats','order_deadline_history') and not rowsecurity"), "0", "таблица без RLS");
  assert.equal(await sql(`select count(*) from information_schema.role_table_grants where grantee in ('anon','authenticated') and table_schema = 'public' and table_name in ('order_tasks','ws_reminder_settings','ws_reminder_log','job_heartbeats','order_deadline_history','order_notify_queue','order_notify_log')`), "0", "пользователям выданы права на служебные таблицы");
  // секрета обработчика нет ни в одной таблице public (он живёт только в Secrets функции и Vault)
  assert.equal(await sql(`select count(*) from information_schema.columns where table_schema = 'public' and (column_name ilike '%secret%' or column_name ilike '%worker_key%')`), "0", "в таблицах есть столбец с секретом");
  pass("0. Служебные функции и таблицы закрыты от анонимов и обычных пользователей; секрета в таблицах нет");
}

// ---------- 1. Нет срока — нет просрочки ----------
await reset();
await sql(`update public.orders set created_at = '2020-01-01', updated_at = '2020-01-02' where id = '${O1}'`);
await enable({ gr: 0 });
await scan(at(1000 * H));
assert.equal((await tasks()).length, 0, "у заказа без срока есть задача: " + JSON.stringify(await tasks()));
assert.equal((await queue()).length, 0, "у заказа без срока есть напоминание");
pass("1. Заказ без срока (старый, с долгом и без платежей) не считается просроченным и не получает напоминаний");

// ---------- 2. Границы времени и часовые пояса ----------
await reset();
const stored = JSON.parse(await setDue(O1, DUE_LOCAL, "2099-03-12", "2099-03-14"));
assert.equal(Date.parse(stored.payment_due_at), DUE, "срок оплаты 09:00 по Бишкеку должен быть 03:00Z: " + stored.payment_due_at);
assert.equal(Date.parse(stored.delivery_eta_from), Date.parse("2099-03-11T18:00:00Z"), "начало интервала доставки");
assert.equal(Date.parse(stored.delivery_eta_to), Date.parse("2099-03-14T17:59:59Z"), "конец интервала доставки (конец дня по местному времени)");
await scan(at(-1000)); assert.equal((await tasks("kind = 'payment_overdue'")).length, 0, "задача до срока");
await scan(at(0)); assert.equal((await tasks("kind = 'payment_overdue'")).length, 0, "ровно в момент срока (не позже срока) ещё не просрочено");
await scan(at(1000)); assert.equal((await tasks("kind = 'payment_overdue'")).length, 1, "после срока задачи нет");
const ETA = Date.parse("2099-03-14T17:59:59Z"), ata = (ms) => new Date(ETA + ms).toISOString();
await scan(ata(-2 * 24 * H - 1000)); assert.equal((await tasks("kind = 'delivery_soon'")).length, 0, "«приближается» раньше чем за 2 суток");
await scan(ata(-2 * 24 * H)); assert.equal((await tasks("kind = 'delivery_soon'")).length, 1, "«приближается» не появилась за 2 суток");
await scan(ata(0)); assert.equal((await tasks("kind = 'delivery_overdue'")).length, 0, "доставка просрочена в последнюю секунду интервала");
await scan(ata(1000)); assert.equal((await tasks("kind = 'delivery_overdue'")).length, 1, "после конца интервала задачи нет");
assert.equal((await tasks("kind = 'delivery_soon'"))[0].status, "resolved", "«приближается» не закрылась при просрочке");
// другой часовой пояс: тот же ввод = другой момент
await asUser(B, `select public.ws_set_timezone('${WSB}', 'America/New_York')`);
const ny = JSON.parse(await setDue(O1, "2099-03-10 09:00"));
assert.equal(ny.payment_due_at.replace(" ", "T").slice(0, 16), (await sql("select to_char(('2099-03-10 09:00'::timestamp at time zone 'America/New_York') at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI')")), "пересчёт для Нью-Йорка");
assert.ok(Date.parse(ny.payment_due_at) - DUE >= 10 * H, "пояса не различаются");
await failsWith(() => asUser(B, `select public.ws_set_timezone('${WSB}', 'Mars/Olympus')`), /bad_timezone/, "неверный пояс принят");
await failsWith(() => asUser(D, `select public.ws_set_timezone('${WSB}', 'Asia/Bishkek')`), /forbidden/, "помощник меняет пояс");
pass("2. Границы (ровно в срок — ещё нет; +1 с — да), конец дня интервала, 2 суток до срока, часовые пояса");

// ---------- 3. Повторный и параллельный запуск ----------
await reset();
await setDue(O1, DUE_LOCAL, "2099-03-12", "2099-03-14");
await enable({ gr: 0 });
await scan(at(H)); const a1 = (await tasks()).length, q1 = (await queue()).length;
await scan(at(H)); await scan(at(H));
assert.equal((await tasks()).length, a1); assert.equal((await queue()).length, q1);
const res = await Promise.all(Array.from({ length: 6 }, () => scan(at(H))));
assert.ok(res.every((r) => r && !r.error), JSON.stringify(res));
assert.equal((await tasks()).length, a1, "параллельный запуск создал дубли задач"); assert.equal((await queue()).length, q1, "параллельный запуск создал дубли напоминаний");
assert.equal(new Set((await tasks()).map((t) => t.order_id + t.kind + t.dedupe_key)).size, a1);
pass("3. Повторный и параллельный запуск (6 одновременных): задач и напоминаний столько же");

// ---------- 4. Частичная и полная оплата ----------
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 0 });
await scan(at(H));
assert.equal((await tasks("kind = 'payment_overdue'"))[0].details.balance, 2000);
await sql(`update public.orders set paid_amount = 2500 where id = '${O1}'`);
await scan(at(2 * H));
assert.equal((await tasks("kind = 'payment_overdue'"))[0].status, "open", "частичная оплата закрыла задачу");
await worker(at(10 * H));   // 13:00 по Бишкеку: час отправки
const part = received.find((r) => r.chat === "1001");
assert.ok(part && /500/.test(part.text) && !/2000/.test(part.text), "в напоминании не остаток после частичной оплаты: " + (part && part.text));
await sql(`update public.orders set paid_amount = 3000 where id = '${O1}'`);
await scan(at(11 * H));
assert.equal((await tasks("kind = 'payment_overdue'"))[0].status, "resolved"); assert.equal((await tasks("kind = 'payment_overdue'"))[0].resolved_reason, "paid");
pass("4. Частичная оплата: задача остаётся, напоминание про остаток; полная — задача закрыта");

// ---------- 5. Перенос срока ----------
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 0 });
await scan(at(H));
assert.equal((await queue("kind = 'payment_reminder'")).length, 2);
await setDue(O1, "2099-03-20 09:00");
await scan(at(2 * H));
let t = await tasks("kind = 'payment_overdue'");
assert.equal(t.length, 1); assert.equal(t[0].status, "resolved"); assert.equal(t[0].resolved_reason, "deadline_changed");
await worker(at(3 * H));
assert.equal(received.length, 0, "напоминание ушло после переноса срока");
assert.ok((await queue()).every((x) => x.status === "skipped" && x.last_error === "deadline_changed"));
const hist = JSON.parse(await asUser(B, `select public.order_deadline_history('${O1}')`));
assert.ok(hist.length >= 2 && hist.some((h) => h.field === "payment_due_at" && h.old && h.new), "изменение срока не записано в историю");
await scan(Date.parse("2099-03-20T03:00:01Z") && "2099-03-20T03:00:01Z");
t = await tasks("kind = 'payment_overdue'"); assert.equal(t.length, 2, "новый срок не открыл новый цикл"); assert.equal(t.filter((x) => x.status === "open").length, 1);
pass("5. Перенос срока: старая задача и напоминание сняты, история записана, новый срок — новый цикл");

// ---------- 6. Отмена и приостановка ----------
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 0 });
await scan(at(H));
await sql(`update public.orders set status = 'cancelled' where id = '${O1}'`);
await scan(at(2 * H)); await worker(at(3 * H));
assert.equal(received.filter((r) => /Напоминание|Reminder/.test(r.text)).length, 0, "напоминание по отменённому заказу");
assert.ok((await queue("kind = 'payment_reminder'")).every((x) => x.status === "skipped" && x.last_error === "cancelled"));
assert.equal((await tasks("kind = 'payment_overdue'"))[0].resolved_reason, "cancelled");
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 0 });
await scan(at(H));
await asUser(D, `select public.order_reminders_pause('${O1}', true)`);          // помощник приостанавливает (спор о товаре)
await failsWith(() => asUser(C, `select public.order_reminders_pause('${O1}', true)`), /forbidden/, "чужой кабинет приостановил");
await worker(at(3 * H)); assert.equal(received.length, 0, "ушло после приостановки");
assert.ok((await queue()).every((x) => x.last_error === "paused"));
await scan(at(30 * H)); assert.equal((await queue("status = 'pending'")).length, 0, "новые напоминания при приостановке");
await asUser(D, `select public.order_reminders_pause('${O1}', false)`);
await scan(at(31 * H)); assert.equal((await queue("status = 'pending'")).length, 2, "после снятия приостановки напоминания не продолжились");
pass("6. Отмена и приостановка (помощником) останавливают напоминания; снятие приостановки возобновляет");

// ---------- 7. Автоматизация выключена / отзыв подписки ----------
await reset();
await setDue(O1, DUE_LOCAL);
await scan(at(H)); assert.equal((await queue()).length, 0, "по умолчанию автоматизация должна быть выключена");
assert.equal(JSON.parse(await asUser(D, `select public.reminder_settings_get('${WSB}')`)).enabled, false);
await failsWith(() => enable_as(D), /forbidden/, "помощник включил автоматизацию");
async function enable_as(uid) { return asUser(uid, `select public.reminder_settings_set('${WSB}', true, 9, 20, 0, 72, 3, 50)`); }
await failsWith(() => enable_as(C), /forbidden/, "чужой кабинет включил автоматизацию");
await failsWith(() => asUser(B, `select public.reminder_settings_set('${WSB}', true, 20, 9, 0, 72, 3, 50)`), /bad_settings/, "некорректные часы приняты");
await enable({ gr: 0 }); await scan(at(H));
assert.equal((await queue("status = 'pending'")).length, 2);
await asUser(B, `select public.reminder_settings_set('${WSB}', false, 9, 20, 0, 72, 3, 50)`);   // владелец выключил
await worker(at(3 * H)); assert.equal(received.length, 0, "ушло после выключения автоматизации");
assert.ok((await queue()).every((x) => x.last_error === "automation_off"));
await reset(); await setDue(O1, DUE_LOCAL); await enable({ gr: 0 }); await scan(at(H));
await sql(`delete from public.order_tg_subs where chat_id = '1001'`);               // клиент отключил уведомления
await sql(`update public.orders set public_token = null where id = '${O1}'`);       // ссылку отозвали (подписки снимает триггер)
await worker(at(3 * H)); assert.equal(received.length, 0, "ушло после отзыва");
assert.ok((await queue()).every((x) => x.status === "skipped" && x.last_error === "subscription_removed"));
assert.equal(await sql("select count(*) from public.ws_reminder_log where detail like 'ВКЛЮЧЕНО%'"), "1", "включение не записано в журнал");
pass("7. По умолчанию выключено; включает только владелец; выключение, отзыв ссылки и отключение подписки останавливают отправку");

// ---------- 8. Оплата между постановкой и отправкой ----------
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 0 });
await scan(at(H));
await sql(`update public.orders set paid_amount = 3000 where id = '${O1}'`);
await worker(at(3 * H)); assert.equal(received.length, 0, "устаревшее напоминание: долг уже погашен");
assert.ok((await queue()).every((x) => x.last_error === "paid"));
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 0 }); await scan(at(H));
const racy = async (name, args) => {
  const r = await rpc(name, name === "notify_claim" || name === "notify_begin_send" ? { ...args, p_now: at(3 * H) } : args);
  if (name === "notify_claim") await sql(`update public.orders set paid_amount = 3000 where id = '${O1}'`);   // оплатили между «взял» и «отправил»
  return r;
};
await worker(null, { rpc: racy }); assert.equal(received.length, 0, "ушло, хотя оплатили между взятием и отправкой");
pass("8. Оплата между постановкой и отправкой (и между взятием и отправкой) — сообщение не уходит");

// ---------- 9. Частота, количество, часы отправки ----------
await reset();
await setDue(O1, DUE_LOCAL); await enable({ gr: 24, gap: 72, mx: 2 });
await scan(at(23 * H)); assert.equal((await queue()).length, 0, "напоминание раньше паузы после срока");
await scan(at(24 * H + 1000)); assert.equal((await queue()).length, 2, "нет напоминания после паузы");   // 03:00Z+24h = 09:00 местного следующего дня
await scan(at(25 * H)); assert.equal((await queue()).length, 2, "второе напоминание раньше времени");
await worker(at(25 * H)); assert.equal(received.length, 2);
await scan(at(24 * H + 71 * H)); assert.equal((await queue()).length, 2, "интервал между напоминаниями не соблюдён");
await scan(at(24 * H + 73 * H)); assert.equal((await queue()).length, 4, "второе напоминание не поставлено");
assert.deepEqual((await queue("status = 'pending'")).map((x) => x.reminder_no), [2, 2]);
await worker(at(24 * H + 74 * H)); assert.equal(received.length, 4);
await scan(at(24 * H + 200 * H)); assert.equal((await queue()).length, 4, "превышено число напоминаний на заказ");
// суточный лимит
await reset(); await setDue(O1, DUE_LOCAL); await sql(`update public.orders set payment_due_at = '${at(0)}' where id = '${O2}'`);
await sql(`update public.workspaces set time_zone = 'Asia/Bishkek'`);
await enable({ gr: 0, day: 1 }); await scan(at(H));
assert.equal((await queue("workspace_id = '" + WSB + "'")).length, 1, "суточный лимит кабинета не соблюдён");
// часы отправки (пояс Бишкека): поставлено в 23:00 — уходит завтра в 09:00; вне часов обработчик ничего не шлёт
await reset(); await setDue(O1, DUE_LOCAL); await enable({ gr: 0 });
const late = at(14 * H);                                  // 03:00Z + 14h = 17:00Z = 23:00 местного
await scan(late);
let qq = await queue();
assert.equal(qq.length, 2); assert.equal(Date.parse(qq[0].next_attempt_at), Date.parse("2099-03-11T03:00:00Z"), "время отправки не перенесено на 09:00 следующего дня: " + qq[0].next_attempt_at);
await worker(late); assert.equal(received.length, 0, "отправлено вне часов");
await worker("2099-03-11T02:59:00Z"); assert.equal(received.length, 0, "отправлено в 08:59 (до начала окна)");
await worker("2099-03-11T03:00:00Z"); assert.equal(received.length, 2, "в 09:00 не отправлено");
// сдвиг окна между постановкой и отправкой: владелец сузил часы, обработчик переносит, а не шлёт
await reset(); await setDue(O1, DUE_LOCAL); await enable({ gr: 0 }); await scan(at(H));          // 04:00Z = 10:00 местного
await enable({ gr: 0, f: 12, t: 20 });
await worker(at(H)); assert.equal(received.length, 0, "отправлено вне нового окна");
qq = await queue(); assert.ok(qq.every((x) => x.status === "pending" && x.attempts === 0), "перенос не должен тратить попытки: " + JSON.stringify(qq.map((x) => [x.status, x.attempts])));
assert.equal(Date.parse(qq[0].next_attempt_at), Date.parse("2099-03-10T06:00:00Z"), "перенос на 12:00");
pass("9. Пауза после срока, интервал, максимум на заказ, суточный лимит, часы отправки (граница 09:00, перенос окна)");

// ---------- 10. Доставка: только внутренняя задача ----------
await reset();
await setDue(O1, null, "2099-03-12", "2099-03-14"); await enable({ gr: 0 });
await scan(ata(24 * H));
assert.equal((await tasks("kind = 'delivery_overdue'")).length, 1);
await worker(ata(25 * H)); assert.equal(received.length, 0, "просрочка доставки отправила сообщение клиенту");
assert.equal((await queue()).length, 0); assert.equal(await sql(`select status from public.orders where id = '${O1}'`), "purchasing", "статус товара изменился сам");
await reset(); await setDue(O1, DUE_LOCAL); await enable({ gr: 0 }); await scan(at(H)); await worker(at(H));
const msg = received[0].text;
assert.match(msg, /Напоминание/); assert.match(msg, /2000 KGS/); assert.match(msg, /10\.03\.2099/); assert.match(msg, /\?order=[a-f0-9]{32}/);
assert.ok(!/СЕКРЕТНЫЙ|ВНУТРЕННЯЯ|ЗАМЕТКА-ЧУЖОГО|111[.]11|Клиент Б|доставим|привезём|прибудет/.test(msg + received.map((r) => r.text).join()), "в напоминании закрытые данные или обещания");
assert.match(received.find((r) => r.chat === "1002").text, /Reminder/);
pass("10. Просрочка доставки — только задача; напоминание об оплате без закрытых данных и обещаний, на языке подписчика");

// ---------- 11. Задачи: «не хватает данных», права, изоляция ----------
await reset();
await sql(`update public.orders set status = 'in_transit', tracking_number = null where id = '${O1}'`);
await sql(`update public.orders set status = 'awaiting_payment', client_price = null where id = '${O2}'`);
await scan(at(0));
const miss = await tasks("kind = 'missing_data'");
assert.deepEqual(miss.map((x) => x.details.missing).sort(), ["no_price", "no_tracking"]);
assert.ok(miss.every((x) => x.status === "open"));
await scan(at(0)); assert.equal((await tasks("kind = 'missing_data'")).length, 2);
await sql(`update public.orders set tracking_number = 'ABC123' where id = '${O1}'`);
assert.equal((await tasks("kind = 'missing_data' and order_id = '" + O1 + "'"))[0].status, "resolved", "задача не закрылась после ввода трек-номера");
await sql(`update public.orders set status = 'awaiting_payment', client_price = null where id = '${O1}'`);
const lstB = JSON.parse(await asUser(B, `select public.tasks_list('${WSB}')`)), lstD = JSON.parse(await asUser(D, `select public.tasks_list('${WSB}')`));
assert.equal(lstD.length, lstB.length); assert.ok(lstB.every((x) => x.order_number && x.kind && x.order_id), "у задачи нет причины или заказа");
assert.ok(!JSON.stringify(lstB).includes("СЕКРЕТНЫЙ"));
await failsWith(() => asUser(C, `select public.tasks_list('${WSB}')`), /forbidden/, "чужой кабинет видит задачи");
await failsWith(() => asUser(C, `select public.order_set_deadlines('${O1}', null, null, null)`), /forbidden/, "чужой кабинет меняет сроки");
await failsWith(() => asUser(B, `select public.order_set_deadlines('${O2}', null, null, null)`), /forbidden/, "байер меняет сроки чужого заказа");
await failsWith(() => asUser(B, `select public.order_set_deadlines('${O1}', null, '2099-03-14', '2099-03-12')`), /eta_order/, "интервал наоборот принят");
await failsWith(() => asUser(B, `select public.order_set_deadlines('${O1}', null, '2099-03-14', null)`), /eta_incomplete/, "неполный интервал принят");
const lstC = JSON.parse(await asUser(C, `select public.tasks_list('${WSC}')`)); assert.ok(lstC.every((x) => x.order_number !== undefined) && !JSON.stringify(lstC).includes(O1));
await asUser(D, `select public.task_snooze('${lstD[0].id}', 3)`);
assert.equal(JSON.parse(await asUser(B, `select public.tasks_list('${WSB}')`)).length, lstB.length - 1, "отложенная задача осталась в списке");
await failsWith(() => asUser(C, `select public.task_snooze('${lstD[0].id}', 3)`), /forbidden/, "чужой кабинет откладывает задачу");
pass("11. «Не хватает данных»: задачи по этапам, закрываются сами; доступ — участникам кабинета, чужой кабинет изолирован");

// ---------- 12. Задачи сразу реагируют на оплату (боевой триггер, реальное время) ----------
await reset();
await sql(`update public.orders set payment_due_at = now() - interval '2 hours' where id = '${O1}'`);
assert.equal((await tasks("kind = 'payment_overdue'")).length, 1, "задача не появилась сразу при просроченном сроке");
await sql(`update public.orders set paid_amount = 3000 where id = '${O1}'`);
const live = (await tasks("kind = 'payment_overdue'"))[0];
assert.equal(live.status, "resolved"); assert.equal(live.resolved_reason, "paid");
pass("12. Оплата сразу закрывает задачу (без ожидания расписания)");

// ---------- 13. Пульс задач виден администратору ----------
await reset();
let js = JSON.parse(await sql(`set request.uid = '${ADM}'; set role authenticated; select public.is_admin()::text`) === "true" ? await sql(`set request.uid = '${ADM}'; set role authenticated; select public.jobs_status()`) : "[]");
assert.ok(js.length === 3 && js.every((j) => j.state === "never"), "до первого запуска задачи должны быть «не запускались»: " + JSON.stringify(js));
await scan(at(0)); await rpc("fx_autoclose_job", {}); await rpc("job_beat", { p_job: "order_notify_worker", p_ok: true });
js = JSON.parse(await sql(`set request.uid = '${ADM}'; set role authenticated; select public.jobs_status()`));
assert.ok(js.every((j) => j.state === "ok"), JSON.stringify(js));
await sql("update public.job_heartbeats set last_run_at = now() - interval '2 hours' where job = 'deadlines_scan'");
js = JSON.parse(await sql(`set request.uid = '${ADM}'; set role authenticated; select public.jobs_status()`));
assert.equal(js.find((j) => j.job === "deadlines_scan").state, "stale", "остановленное расписание не видно");
await sql("alter table public.order_tasks rename to order_tasks_x");                  // искусственный сбой
const bad = await scan(at(0)); assert.ok(bad.error, "сбой не пойман: " + JSON.stringify(bad));
await sql("alter table public.order_tasks_x rename to order_tasks");
js = JSON.parse(await sql(`set request.uid = '${ADM}'; set role authenticated; select public.jobs_status()`));
assert.equal(js.find((j) => j.job === "deadlines_scan").state, "error"); assert.ok(!JSON.stringify(js).includes("order_tasks"), "в пульс попало описание ошибки");
await failsWith(() => asUser(B, "select public.jobs_status()"), /forbidden/, "байер видит пульс задач");
pass("13. Администратор видит: не запускалось / работает / остановилось / сбой; байер — нет");

// ---------- 14. Автозакрытие обмена: независимый запуск и гонки ----------
const mkEx = async (sentAgo) => sql(`insert into public.exchange_requests (workspace_id, client_name, client_phone, cny, som, rate, source, status, sent_at, sent_proof)
    values ('${WSB}', 'Клиент обмена', '+996555123456', 100, 1300, 13, 'order', 'sent', now() - interval '${sentAgo}', 'x/y') returning id`).then((x) => x.split("\n")[0]);
const exState = async (id) => (await sql(`select status || '|' || coalesce(dispute, '-') || '|' || coalesce((select string_agg(kind, ',' order by id) from public.exchange_events where request_id = '${id}'), '') from public.exchange_requests where id = '${id}'`));
{
  await sql("truncate public.exchange_events, public.exchange_requests cascade");
  const old = await mkEx("25 hours"), fresh = await mkEx("23 hours"), disp = await mkEx("25 hours");
  await sql(`update public.exchange_requests set dispute = 'open', dispute_by = 'client', dispute_at = now() where id = '${disp}'`);
  const r1 = await rpc("fx_autoclose_job", {});
  assert.equal(r1.closed, 1);
  assert.match(await exState(old), /^done\|-\|auto_done$/); assert.match(await exState(fresh), /^sent\|/); assert.match(await exState(disp), /^sent\|open/, "закрыта сделка с открытым спором");
  assert.equal((await rpc("fx_autoclose_job", {})).closed, 0, "повторный запуск закрыл ещё раз");
  assert.equal(await sql(`select count(*) from public.exchange_events where request_id = '${old}'`), "1", "повторный запуск дублирует событие");
  // граница 24 часов на сервере: ровно 24 часа — ещё нет, на секунду позже — да
  const edge = await mkEx("0 seconds"); await sql(`update public.exchange_requests set sent_at = '2099-01-01T00:00:00Z' where id = '${edge}'`);
  await sql(`delete from public.exchange_requests where id <> '${edge}'`);
  assert.equal(await rpc("fx_autoclose_all", { p_limit: 10, p_now: "2099-01-02T00:00:00Z" }), 0, "закрыто ровно на 24-й час");
  assert.equal(await rpc("fx_autoclose_all", { p_limit: 10, p_now: "2099-01-02T00:00:01Z" }), 1, "не закрыто через 24 часа и секунду");
  // R1: подтверждение клиента и автозакрытие одновременно — результат один
  let both = 0;
  for (let i = 0; i < 6; i++) {
    const id = await mkEx("25 hours");
    await Promise.all([sql(`set role anon; set request.uid = ''; select public.fx_client_received('${id}', 5)`).catch(() => null), rpc("fx_autoclose_all", { p_limit: 500 })]);
    const st = await exState(id);
    assert.match(st, /^done\|-\|(received|auto_done)$/, "противоречивый итог гонки: " + st);
    if (/received.*auto_done|auto_done.*received/.test(st)) both++;
  }
  assert.equal(both, 0);
  // R2: спор на границе срока и автозакрытие: спор открыт и держит строку — автозакрытие её не трогает
  const ed = await mkEx("0 seconds"); await sql(`update public.exchange_requests set sent_at = now() - interval '24 hours' + interval '3 seconds' where id = '${ed}'`);
  const disputeP = sql(`set request.uid = ''; set role anon; select public.fx_dispute_open('${ed}', 'Юани не пришли, прошу разобраться'); select pg_sleep(2)`);
  await new Promise((r) => setTimeout(r, 500));
  const closed = await rpc("fx_autoclose_all", { p_limit: 500, p_now: new Date(Date.now() + 3600e3).toISOString() });   // по времени закрывать уже можно
  await disputeP;
  assert.equal(closed, 0, "автозакрытие тронуло строку, которую меняет спор");
  assert.match(await exState(ed), /^sent\|open\|dispute$/);
  assert.equal(await rpc("fx_autoclose_all", { p_limit: 500, p_now: new Date(Date.now() + 3600e3).toISOString() }), 0, "закрыта сделка с открытым спором");
  // R3: после закрытия спор уже нельзя открыть
  const cl = await mkEx("25 hours"); await rpc("fx_autoclose_all", { p_limit: 500 });
  await failsWith(() => sql(`set request.uid = ''; set role anon; select public.fx_dispute_open('${cl}', 'Юани не пришли, прошу разобраться')`), /cannot_dispute/, "спор открыт по закрытой сделке");
  assert.equal(await sql("select count(*) from public.exchange_requests where status = 'done' and dispute = 'open'"), "0", "есть закрытая сделка с открытым спором");
  pass("14. Автозакрытие обмена: серверный запуск, граница 24 ч, спор не закрывается, гонки с подтверждением и спором непротиворечивы");
}

server.close();
console.log("🎉 Сроки, задачи, напоминания и обмен: проверено сценариев — " + n);
