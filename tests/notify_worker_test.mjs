// =====================================================
// ПРОВЕРКА ОБРАБОТЧИКА ОЧЕРЕДИ УВЕДОМЛЕНИЙ (файл 57) с поддельным сервисом доставки.
// Запускается из tests/notify_queue_test.sh: ULA_PG_CONTAINER — временная база в Docker, настоящий Telegram НЕ используется.
// Обработчик — тот же код, что у Edge Function (supabase/functions/_shared/order_notify.js); база — настоящие функции файла 57.
// =====================================================
import { execFile } from "node:child_process";
import http from "node:http";
import assert from "node:assert/strict";
import { promisify } from "node:util";
import { processBatch, buildMessage } from "../supabase/functions/_shared/order_notify.js";

const sh = promisify(execFile);
const NAME = process.env.ULA_PG_CONTAINER;
if (!NAME) throw new Error("нужна переменная ULA_PG_CONTAINER");

async function sql(q) {
  const { stdout } = await sh("docker", ["exec", "-i", NAME, "psql", "-U", "postgres", "-At", "-q", "-X", "-v", "ON_ERROR_STOP=1", "-c", q]);
  return stdout.trim();
}
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");
async function rpc(name, args) {
  const a = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ");
  const out = await sql(`set role service_role; select to_jsonb(public.${name}(${a}))`);
  const line = out.split("\n").filter((l) => l && l !== "SET").pop();
  return line === undefined ? null : JSON.parse(line);
}

// ---------- поддельный Telegram ----------
const received = [];       // принятые сообщения (даже если ответ «потерялся»)
const requests = [];       // все обращения
const script = {};         // chat_id → очередь сценариев: ok | 500 | 429 | 400 | 403 | drop (принял, но оборвал ответ)
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    const m = JSON.parse(body || "{}");
    const chat = String(m.chat_id);
    requests.push(chat);
    const step = (script[chat] && script[chat].length ? script[chat].shift() : "ok");
    const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (step === "ok") { received.push({ chat, text: m.text }); return json(200, { ok: true, result: { message_id: received.length } }); }
    if (step === "drop") { received.push({ chat, text: m.text }); req.socket.destroy(); return; }   // сообщение принято, ответ потерян
    if (step === "429") return json(429, { ok: false, description: "Too Many Requests", parameters: { retry_after: 120 } });
    if (step === "400") return json(400, { ok: false, description: "Bad Request: chat not found" });
    if (step === "403") return json(403, { ok: false, description: "Forbidden: bot was blocked by the user" });
    return json(500, { ok: false, description: "Internal" });
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const send = async (chatId, text) => {
  const r = await fetch(`http://127.0.0.1:${PORT}/sendMessage`, { method: "POST", body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(2000) });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
};
let wn = 0;
const batch = (over = {}) => processBatch({ rpc: over.rpc || rpc, send, worker: over.worker || "t-" + ++wn, limit: over.limit || 20, siteUrl: "https://example.test/" });
const later = () => sql("update public.order_notify_queue set next_attempt_at = now() - interval '1 second' where status = 'pending'");   // «прошло время»
const expireLease = () => sql("update public.order_notify_queue set locked_until = now() - interval '1 second' where status = 'processing'");
const rows = async (where = "true") => JSON.parse(await sql(`select coalesce(jsonb_agg(to_jsonb(q) order by seq), '[]') from (select * from public.order_notify_queue where ${where}) q`));
const O = async (k) => sql(`select v from public._t where k = '${k}'`);
const setStatus = (order, st) => sql(`update public.orders set status = '${st}' where id = '${order}'`);
const addSubs = () => sql(`delete from public.order_tg_subs where order_id in (select id from public.orders where workspace_id in (select workspace_id from public.workspace_members where role = 'owner'));
  insert into public.order_tg_subs (order_id, chat_id, lang, last_status) values
  ((select v::uuid from public._t where k = 'o1'), '1001', 'ru', 'new'), ((select v::uuid from public._t where k = 'o1'), '1002', 'en', 'new'),
  ((select v::uuid from public._t where k = 'o2'), '2001', 'ru', 'new')`);
async function reset() {
  await sql("truncate public.order_notify_queue cascade");
  await sql("update public.orders set status = 'new' where id in (select v::uuid from public._t where k in ('o1','o2'))");
  await sql("update public.orders set public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', '')) where id in (select v::uuid from public._t where k in ('o1','o2'))");
  await addSubs();
  await sql("truncate public.order_notify_queue cascade");
  received.length = 0; requests.length = 0; for (const k of Object.keys(script)) delete script[k];
}
const forbidden = /СЕКРЕТНЫЙ|ВНУТРЕННЯЯ|ЗАМЕТКА-ЧУЖОГО|111[.]11|\b3000\b|Клиент Б|Чужой клиент|Чужой товар/;
let n = 0;
const pass = (m) => console.log("   ✓ " + m) || n++;

const o1 = await O("o1"), o2 = await O("o2");

// ---------- A. Сайт не нужен: событие → обработчик → сообщение, закрытых данных нет ----------
await reset();
await setStatus(o1, "awaiting_payment");   // «байер сохранил статус и закрыл вкладку»: дальше работает только обработчик
let st = await batch();
assert.equal(st.sent, 2, "A: отправлено " + JSON.stringify(st));
assert.deepEqual(received.map((r) => r.chat).sort(), ["1001", "1002"]);
const ru = received.find((r) => r.chat === "1001").text, en = received.find((r) => r.chat === "1002").text;
assert.match(ru, /Кроссовки/); assert.match(en, /Your order/);
assert.match(ru, /https:\/\/example\.test\/\?order=[a-f0-9]{32}/);
for (const r of received) assert.ok(!forbidden.test(r.text), "в сообщении закрытые данные: " + r.text);
assert.ok(!/2001/.test(received.map((r) => r.chat).join()), "сообщение ушло в чужой кабинет");
assert.equal((await rows("status = 'sent'")).length, 2);
assert.equal(await sql("select string_agg(last_status, ',' order by chat_id) from public.order_tg_subs where order_id = '" + o1 + "'"), "awaiting_payment,awaiting_payment", "метка last_status для старой функции не обновлена");
st = await batch(); assert.equal(st.claimed, 0); assert.equal(received.length, 2, "повторный проход отправил ещё раз");
pass("A. Закрытый браузер не мешает: сообщения ушли, закрытых данных нет, повторный проход ничего не шлёт");

// ---------- B. Временная ошибка → повтор позже, с задержкой ----------
await reset();
script["1001"] = ["500", "ok"];
await setStatus(o1, "in_transit");
st = await batch();
assert.equal(st.retry, 1); assert.equal(st.sent, 1);
let r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "pending"); assert.equal(r.attempts, 1); assert.match(r.last_error, /telegram_500/);
assert.ok(new Date(r.next_attempt_at) > new Date(Date.now() + 30000), "нет задержки между попытками");
st = await batch(); assert.equal(st.claimed, 0, "повтор раньше срока");
await later(); st = await batch(); assert.equal(st.sent, 1);
r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "sent"); assert.equal(r.attempts, 2);
assert.equal(received.filter((x) => x.chat === "1001").length, 1, "временная ошибка (сообщение не принято) дала дубль");
pass("B. Временная ошибка → повтор не раньше срока, затем отправлено один раз");

await reset();
script["1001"] = ["429"];
await setStatus(o1, "in_transit"); await batch();
r = (await rows("chat_id = '1001'"))[0];
assert.ok(new Date(r.next_attempt_at) > new Date(Date.now() + 100000), "retry_after Telegram не учтён");
pass("B2. Ответ «слишком часто» (429): ждём не меньше указанного Telegram времени");

// ---------- C. Постоянная ошибка видна и не повторяется; лимит попыток ----------
await reset();
script["1001"] = ["400"];
await setStatus(o1, "in_transit"); await batch();
r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "failed"); assert.equal(r.attempts, 1); assert.match(r.last_error, /^telegram_400/);
await later(); await batch(); await later(); await batch();
assert.equal(requests.filter((c) => c === "1001").length, 1, "постоянная ошибка повторяется");
const owner = "00000000-0000-0000-0000-0000000000b1";
const list = JSON.parse(await sql(`set request.uid = '${owner}'; set role authenticated; select public.notify_queue_list((select workspace_id from public.workspace_members where user_id = '${owner}' and role = 'owner'))`).then((x) => x.split("\n").pop()));
assert.equal(list.counts.failed, 1); assert.ok(list.items.some((i) => i.status === "failed" && /telegram_400/.test(i.last_error)), "ошибка не видна владельцу");
pass("C. Постоянная ошибка: одна попытка, видна владельцу в списке, не повторяется");

await reset();
script["1001"] = Array(20).fill("500");
await setStatus(o1, "in_transit");
for (let i = 0; i < 10; i++) { await batch(); await later(); }
r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "failed"); assert.equal(r.attempts, 6); assert.equal(requests.filter((c) => c === "1001").length, 6, "попыток не 6");
assert.match(r.last_error, /telegram_500/);
// ручной повтор после ошибки — та же строка, история остаётся
await sql(`set request.uid = '${owner}'; set role authenticated; select public.notify_retry('${r.id}')`);
script["1001"] = ["ok"]; await batch();
r = (await rows("chat_id = '1001'"))[0]; assert.equal(r.status, "sent");
const hist = await sql(`select string_agg(action, ',' order by id) from public.order_notify_log where queue_id = '${r.id}'`);
assert.match(hist, /created.*claimed.*retry.*failed.*requeued.*claimed.*sent/s, "история повтора: " + hist);
pass("C2. Постоянные временные ошибки: ровно 6 попыток, затем «ошибка»; повтор вручную через ту же очередь с историей");

// ---------- D. Клиент заблокировал бота ----------
await reset();
script["1001"] = ["403"];
await setStatus(o1, "in_transit"); await batch();
r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "skipped"); assert.equal(r.last_error, "client_blocked_bot");
assert.equal(await sql("select count(*) from public.order_tg_subs where chat_id = '1001'"), "0", "подписка не снята");
pass("D. Бот заблокирован: подписка снята, без повторов");

// ---------- E. Сервис принял сообщение, а ответ потерялся ----------
await reset();
script["1001"] = ["drop", "ok"];
await setStatus(o1, "in_transit"); await batch();
r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "pending"); assert.equal(r.ambiguous, 1); assert.equal(r.last_error, "delivery_unknown_retry");
assert.ok(new Date(r.next_attempt_at) > new Date(Date.now() + 9 * 60000), "повтор после потерянного ответа не отложен минимум на 10 минут");
await later(); await batch();
assert.equal((await rows("chat_id = '1001'"))[0].status, "sent");
assert.equal(received.filter((x) => x.chat === "1001").length, 2, "ожидаем 2 копии: первая принята, ответ потерян (возможный дубль — известное ограничение)");
pass("E. Ответ потерян: один отложенный повтор (≥10 мин), дубль возможен и описан");

await reset();
script["1001"] = ["drop", "drop", "ok", "ok"];
await setStatus(o1, "in_transit"); await batch(); await later(); await batch(); await later(); await batch(); await later(); await batch();
r = (await rows("chat_id = '1001'"))[0];
assert.equal(r.status, "failed"); assert.equal(r.last_error, "delivery_unknown");
assert.equal(requests.filter((c) => c === "1001").length, 2, "после двух потерянных ответов отправка повторилась в третий раз");
pass("E2. Ответ потерян дважды: «ошибка: исход неизвестен», больше автоматических попыток нет");

// ---------- F. Обработчик пропал ----------
await reset();
await setStatus(o1, "in_transit");
let cl = await rpc("notify_claim", { p_worker: "crash-1", p_limit: 10, p_lease: 30 });      // взял и упал ДО отправки
assert.equal(cl.length, 2);
await expireLease(); cl = await rpc("notify_claim", { p_worker: "ok-1", p_limit: 10, p_lease: 30 });
assert.equal(cl.length, 2, "после падения до отправки задачи не вернулись"); assert.ok(cl.every((x) => x.attempt === 2));
const sent0 = cl[0].id, cl1 = cl[1];
await rpc("notify_begin_send", { p_id: cl[0].id, p_worker: "ok-1" });                       // начал отправку и упал
await expireLease(); cl = await rpc("notify_claim", { p_worker: "ok-2", p_limit: 10, p_lease: 30 });
assert.ok(!cl.some((x) => x.id === sent0), "задача с неизвестным исходом возвращена сразу");
assert.ok(cl.some((x) => x.id === cl1.id), "вторая задача (отправка не начиналась) не вернулась");
assert.equal((await rows("ambiguous = 1")).length, 1, "падение во время отправки не помечено как «исход неизвестен»");
pass("F. Обработчик пропал: до отправки — задача возвращается, во время отправки — отложенный повтор");

// ---------- G. Параллельные исполнители ----------
await reset();
await sql(`insert into public.orders (workspace_id, client_name, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, status)
  select (select workspace_id from public.orders where id = '${o1}'), 'Клиент ' || g, 'Товар ' || g, 1, 1, 1, 10, 0, 'new' from generate_series(1, 40) g`);
await sql(`insert into public.order_tg_subs (order_id, chat_id, lang, last_status)
  select id, '9' || lpad(row_number() over ()::text, 3, '0'), 'ru', 'new' from public.orders where product_ru like 'Товар %'`);
await sql("update public.orders set status = 'purchasing' where product_ru like 'Товар %'");
assert.equal((await rows()).length, 40);
const claims = await Promise.all(Array.from({ length: 8 }, (_, i) => rpc("notify_claim", { p_worker: "par-" + i, p_limit: 10, p_lease: 120 })));
const ids = claims.flat().map((x) => x.id);
assert.equal(ids.length, new Set(ids).size, "одну задачу забрали несколько исполнителей");
assert.equal(ids.length, 40, "забрано не всё: " + ids.length);
await sql("truncate public.order_notify_queue cascade");
await sql("update public.orders set status = 'new' where product_ru like 'Товар %'");
await sql("update public.orders set status = 'purchasing' where product_ru like 'Товар %'");
const sts = await Promise.all(Array.from({ length: 6 }, () => batch({ limit: 10 })));
assert.equal(sts.reduce((a, s) => a + s.sent, 0), 40);
const chats = received.map((x) => x.chat);
assert.equal(chats.length, 40, "сообщений " + chats.length); assert.equal(new Set(chats).size, 40, "кому-то отправили дважды");
assert.ok((await rows()).every((x) => x.status === "sent" && x.attempts === 1));
pass("G. 8 параллельных исполнителей не взяли ни одной задачи дважды; 6 обработчиков отправили каждому ровно одно сообщение");
await sql("delete from public.orders where product_ru like 'Товар %'");

// ---------- H. Порядок сообщений ----------
await reset();
await setStatus(o1, "in_transit"); await setStatus(o1, "arrived"); await setStatus(o1, "delivered");
await batch();
assert.deepEqual(received.filter((x) => x.chat === "1001").map((x) => /в пути/.test(x.text) ? "in_transit" : "other"), ["in_transit"], "позднее событие обогнало раннее");
await batch(); await batch();
const order = received.filter((x) => x.chat === "1001").map((x) => (/в пути/.test(x.text) ? "in_transit" : /прибыл/.test(x.text) ? "arrived" : /у вас/.test(x.text) ? "delivered" : "?"));
assert.deepEqual(order, ["in_transit", "arrived", "delivered"]);
pass("H. Сообщения одного заказа уходят по порядку");

// ---------- I. Отзыв доступа до отправки ----------
await reset();
await setStatus(o1, "in_transit");
await sql(`update public.orders set public_token = null where id = '${o1}'`);   // ссылку отключили; триггер файла 25 снимает подписки
st = await batch();
assert.equal(received.length, 0, "сообщение ушло после отзыва ссылки");
assert.ok((await rows()).every((x) => x.status === "skipped" && x.last_error === "subscription_removed"), JSON.stringify(await rows()));
await reset();
// ссылку отключили между «взял задачу» и «отправил»
await setStatus(o1, "in_transit");
const racy = async (name, args) => { const res = await rpc(name, args); if (name === "notify_claim") await sql(`update public.orders set public_token = null where id = '${o1}'`); return res; };
await batch({ rpc: racy });
assert.equal(received.length, 0, "сообщение ушло, хотя ссылку отключили после взятия задачи");
await reset();
// клиент отключил уведомления; подписался заново (другая подписка) — старое событие не уходит
await setStatus(o1, "in_transit");
await sql("delete from public.order_tg_subs where chat_id = '1001'");
await batch(); assert.equal(received.filter((x) => x.chat === "1001").length, 0, "отключённый получил сообщение");
await reset();
await setStatus(o1, "in_transit");
await sql(`delete from public.order_tg_subs where chat_id = '1002'; insert into public.order_tg_subs (order_id, chat_id, lang, last_status) values ('${o1}', '1002', 'en', 'new')`);
await batch(); assert.equal(received.filter((x) => x.chat === "1002").length, 0, "после смены подписки ушло старое событие");
assert.equal(received.filter((x) => x.chat === "1001").length, 1, "действующая подписка не получила сообщение");
pass("I. Отзыв ссылки, отключение и смена подписки до отправки учитываются (в том числе между взятием и отправкой)");

// ---------- J. Кабинеты изолированы ----------
await reset();
await setStatus(o2, "in_transit"); await setStatus(o1, "arrived");
await batch();
const toC = received.filter((x) => x.chat === "2001"), toB = received.filter((x) => x.chat !== "2001");
assert.equal(toC.length, 1); assert.equal(toB.length, 2);
const tokB = await sql(`select public_token from public.orders where id = '${o1}'`), tokC = await sql(`select public_token from public.orders where id = '${o2}'`);
assert.ok(toC[0].text.includes(tokC) && !toC[0].text.includes(tokB), "ссылка другого кабинета в сообщении");
assert.ok(toB.every((x) => x.text.includes(tokB) && !x.text.includes(tokC)), "ссылка чужого кабинета попала к клиентам");
assert.ok(toB.every((x) => !forbidden.test(x.text)), "в сообщении клиенту кабинета Б чужие или закрытые данные");
assert.ok(toC.every((x) => !/СЕКРЕТНЫЙ|ВНУТРЕННЯЯ|ЗАМЕТКА-ЧУЖОГО|Кроссовки|Клиент Б/.test(x.text)), "в сообщении клиенту кабинета В данные кабинета Б или закрытые данные");
pass("J. Кабинеты изолированы: каждый клиент получает только свой заказ и свою ссылку");

// ---------- K. Тексты не меняются относительно прежней функции ----------
const sample = { lang: "ru", to_status: "in_transit", order_number: "CN-1", product_ru: "Куртка", tracking_number: "T1", public_token: "a".repeat(32), brand: "Б" };
assert.equal(buildMessage(sample, "https://s/"), "Куртка".length ? "Ваш заказ «Куртка» (№ CN-1) уже в пути 🚚 Как только прибудет — сразу напишу.\n\nТрек-номер: T1\n\nВсё о заказе:\nhttps://s/?order=" + "a".repeat(32) + "\n\n— Б" : "");
assert.equal(buildMessage({ ...sample, to_status: "new" }), null);
pass("K. Текст сообщения совпадает с прежним (проверен образец)");

server.close();
console.log("🎉 Обработчик очереди: проверено сценариев — " + n);
