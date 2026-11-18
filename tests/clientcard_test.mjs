// =====================================================
// ПРОВЕРКА КАРТОЧКИ КЛИЕНТА (js/clientcard.js, расчёт без страницы).
//
//   node tests/clientcard_test.mjs
//
// Долг считается тем же правилом, что раздел «Долги»: только заказы с ценой для клиента, по валютам,
// отменённые не считаются, «просрочено» — 7 дней с заказа или последней оплаты. Чужие заказы в карточку не попадают.
// =====================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
const ok = (cond, name) => { if (!cond) { console.error("❌ " + name); process.exit(1); } passed++; console.log("   ✓ " + name); };
const win = { ULA: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/clientcard.js"), "utf8"), { window: win, document: {} }, { filename: "js/clientcard.js" });
const S = win.ULA.clientcard.summarize;

const NOW = new Date("2026-11-18T12:00:00").getTime();
const day = (n) => new Date(NOW - n * 864e5).toISOString().slice(0, 10);
const me = { id: "c1", name: "Айбек", phone: "+996 555 111-222", telegram: "@aibek_1" };
const o = (x) => ({ client_id: "c1", client_currency: "KGS", status: "new", profit_som: 100, balance_som: 0, paid_amount: 0, status_history: [], ...x });
const orders = [
  o({ id: "1", order_number: "CN-1", order_date: day(30), status: "delivered", balance_som: 0, paid_amount: 1000,
      status_history: [{ event_type: "status", new_status: "new", created_at: day(30) + "T09:00:00Z" },
                       { event_type: "payment", paid_total: 400, created_at: day(29) + "T09:00:00Z" },
                       { event_type: "payment", paid_total: 1000, created_at: day(20) + "T09:00:00Z" },
                       { event_type: "status", new_status: "delivered", created_at: day(19) + "T09:00:00Z" }] }),
  o({ id: "2", order_number: "CN-2", order_date: day(10), status: "in_transit", balance_som: 2500, paid_amount: 500,
      status_history: [{ event_type: "payment", paid_total: 500, created_at: day(9) + "T09:00:00Z" }] }),   // 9 дней без оплаты → просрочено
  o({ id: "3", order_number: "CN-3", order_date: day(2), status: "purchasing", balance_som: 100, client_currency: "USD" }),   // свежий долг в $
  o({ id: "4", order_number: "CN-4", order_date: day(40), status: "new", balance_som: 1200, profit_som: null }),           // без цены для клиента — не долг
  o({ id: "5", order_number: "CN-5", order_date: day(40), status: "cancelled", balance_som: 900 }),                         // отменён — не долг
  o({ id: "6", order_number: "CN-6", order_date: day(40), status: "arrived", balance_som: 0.3 }),                           // копейки — не долг
  o({ id: "9", order_number: "CN-9", order_date: day(40), status: "arrived", balance_som: 7000, client_id: "c2" }),          // чужой заказ
];

console.log("▶ Карточка клиента");
const s = S(me, orders, NOW);
ok(s.total === 6 && !s.orders.some((x) => x.client_id !== "c1"), "в карточке только заказы этого клиента (6), чужой не попал");
ok(s.orders[0].order_number === "CN-3" && s.last.order_number === "CN-3", "заказы — от новых к старым; «последний» — самый новый");
ok(s.active.length === 4, "в работе — все, кроме выданных и отменённых (4)");
ok(s.debt.KGS === 2500 && s.debt.USD === 100 && Object.keys(s.debt).length === 2, "долг по валютам: 2500 KGS и 100 USD; без цены, отменённые и копейки не считаются");
ok(s.overdue.KGS === 2500 && !("USD" in s.overdue) && s.hasOverdue, "просрочено: 9 дней без оплаты — да; заказ двухдневной давности — нет");
ok(s.payments.length === 3, "оплаты найдены в истории (3)");
const amounts = s.payments.map((p) => p.order + ":" + p.amount).sort().join(" ");
ok(amounts === "CN-1:400 CN-1:600 CN-2:500", "сумма платежа = разница «оплачено всего» (400, затем 600), а не накопленный итог: " + amounts);
ok(s.payments[0].order === "CN-2", "оплаты — от новых к старым");
ok(s.statuses.length === 2 && s.statuses[0].status === "delivered", "смены статусов — из истории, от новых к старым");
ok(s.paid.KGS === 1500 && !s.paid.USD, "оплачено по заказам (без отменённых): 1500 KGS");
ok(s.phone === "+996555111222" && s.telegram === "aibek_1", "телефон для WhatsApp — международный без пробелов, Telegram без @");
ok(S({ id: "c1", phone: "0555 111 222", telegram: "bad name!" }, [], NOW).phone === "" && S({ id: "c1", telegram: "x y" }, [], NOW).telegram === "",
  "номер без кода страны и неправильный Telegram: кнопок «написать» нет (не угадываем)");
const e = S({ id: "zzz" }, orders, NOW);
ok(e.total === 0 && !e.last && !Object.keys(e.debt).length && !e.payments.length, "клиент без заказов: пусто, без ошибок");
ok(S(null, orders, NOW).total === 0 && S(me, null, NOW).total === 0, "нет клиента или заказов — без ошибок");
// расчёт не меняет данные
const before = JSON.stringify(orders);
S(me, orders, NOW);
ok(JSON.stringify(orders) === before, "заказы при расчёте не меняются");

console.log("🎉 Карточка клиента: проверок пройдено — " + passed);
