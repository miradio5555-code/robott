// =====================================================
// СТЕНД ДЛЯ ПРОВЕРКИ САЙТА В БРАУЗЕРЕ (ничего не отправляет наружу, настоящая база не нужна).
//   node tests/browser/server.mjs [порт]      → http://127.0.0.1:8765/index.html?scn=veteran
// Настоящий index.html, app.js и стили, но вместо Supabase — поддельный клиент (tests/browser/fake_supabase.js),
// который обращается к этому серверу. Данные — в памяти, по сценариям: empty, new1, veteran, staff, fxoff, fxoff0, clients, no55, no54.
// Правила сервера повторяют файлы 56–59 в нужных местах (клиент заказа, пояс, модули, профиль), но это МОДЕЛЬ, а не база:
// настоящие правила проверяет tests/run_db_tests.sh.
// =====================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = Number(process.argv[2] || 8765);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };

let seq = 1000;
const uid = (p = "id") => `${p}-${++seq}`;
const NOW = () => new Date();
const iso = (d) => d.toISOString();
const days = (n) => iso(new Date(Date.now() + n * 864e5));

function build(scn) {
  const ws = { id: "ws1", name: "Тест-карго", order_prefix: "CN", warehouse_address: "Иу, склад 5", warehouse_contacts: "+86 100", logo_path: null, fx_on: false, fx_tiers: [], fx_note: null, fx_updated_at: null, fx_eta: null,
    default_purchase_currency: "CNY", default_client_currency: "KGS", default_delivery_currency: "USD", default_delivery_tariff: 3, custom_rates: null, request_token: "reqtok", profit_goals: null, country: "KG",
    time_zone: "Asia/Bishkek", time_zone_confirmed_at: null, module_shop: true, module_exchange: true };
  const staff = scn === "staff";
  const me = staff ? "u-staff" : "u-owner";
  const db = {
    scn, me, staff, has55: scn !== "no55" && scn !== "no54", has54: scn !== "no54",
    profiles: [{ user_id: me, role: "buyer", full_name: staff ? "Помощник" : "Байер Тест", phone: "+996555000111", is_active: true, ui_simple: null, ui_simple_explicit: false }],
    workspaces: [ws],
    workspace_members: [{ workspace_id: "ws1", user_id: me, role: staff ? "staff" : "owner", created_at: "2026-01-01T00:00:00Z" }],
    orders: [], clients: [], exchange_requests: [], tz_log: [], rpc_log: [], writes: [],
  };
  if (scn === "fxoff") { ws.module_exchange = false; db.exchange_requests.push({ id: "fx1", workspace_id: "ws1", status: "sent", dispute: null }, { id: "fx2", workspace_id: "ws1", status: "paid", dispute: "open" }); }
  if (scn === "fxoff0") { ws.module_exchange = false; ws.module_shop = false; }
  const mkClient = (name, phone, extra = {}) => { const c = { id: uid("c"), workspace_id: "ws1", name, phone: phone || null, match_phone: phone || null, telegram: null, city: null, address: null, pickup_point: null, has_card: false, created_at: iso(NOW()), ...extra }; db.clients.push(c); return c; };
  const mkOrder = (o) => {
    const c = o.client_id ? db.clients.find((x) => x.id === o.client_id) : mkClient(o.client_name, o.client_phone);
    const r = { id: uid("o"), workspace_id: "ws1", order_number: `CN-${db.orders.length + 1}`, order_date: iso(NOW()).slice(0, 10), status: "new", source: "manual", client_phone: null, client_wechat: null,
      product_ru: "Товар", product_zh: null, supplier: null, supplier_link: null, supplier_wechat: null, purchase_currency: "CNY", client_currency: "KGS", quantity: 1, unit_price_cny: 100, exchange_rate: 12,
      weight_kg: 0, delivery_cost: 0, delivery_currency: "USD", delivery_tariff: 3, delivery_rate: 88, client_price: null, paid_amount: 0, tracking_number: null, delivery_info: null, client_comment: null, admin_comment: null,
      shipment_id: null, public_token: uid("tok"), created_at: iso(NOW()), updated_at: iso(NOW()), payment_due_at: null, delivery_eta_from: null, delivery_eta_to: null, reminders_paused_at: null, client_id: c.id, ...o };
    db.orders.push(calc(r));
    return r;
  };
  db.mkOrder = mkOrder; db.mkClient = mkClient;
  const N = { cab: 0, empty: 0, new1: 3, veteran: 420, staff: 40, fxoff: 12, fxoff0: 12, clients: 4, no55: 30, no54: 30 }[scn] ?? 12;
  const flow = ["new", "awaiting_payment", "purchasing", "china_warehouse", "in_transit", "arrived", "delivered", "cancelled"];
  for (let i = 0; i < N; i++) {
    const st = flow[i % flow.length];
    mkOrder({ client_name: `Клиент ${i % 37}`, client_phone: i % 3 ? `+99655${String(1000000 + i).slice(1)}` : null, product_ru: `Товар ${i + 1} ${i % 5 === 0 ? "с очень длинным названием для проверки переноса строк в карточке заказа" : ""}`.trim(),
      status: st, client_price: i % 7 === 0 ? null : 1000 + i * 10, paid_amount: st === "delivered" ? 1000 + i * 10 : i % 4 === 0 ? 300 : 0, weight_kg: st === "china_warehouse" && i % 2 ? 0 : 2,
      tracking_number: st === "in_transit" && i % 2 ? null : "TRK" + i, source: i % 11 === 0 && st === "new" ? "request" : "manual", order_date: iso(new Date(Date.now() - i * 864e5)).slice(0, 10), created_at: days(-i) });
  }
  if (scn === "veteran" || scn === "staff") {
    // сроки: просрочки оплаты/доставки, скоро доставка
    const act = db.orders.filter((o) => !["delivered", "cancelled"].includes(o.status) && o.client_price != null);
    act.slice(0, 3).forEach((o) => { o.payment_due_at = days(-2); o.paid_amount = 100; calc(o); });
    act.slice(3, 5).forEach((o) => { o.delivery_eta_from = days(-9); o.delivery_eta_to = days(-1); });
    act.slice(5, 7).forEach((o) => { o.delivery_eta_from = days(1); o.delivery_eta_to = days(2); });
    // 5 новых заявок
    for (let k = 0; k < 5; k++) mkOrder({ client_name: `Заявка ${k + 1}`, source: "request", status: "new", product_ru: `Заявка-товар ${k + 1}` });
  }
  if (scn === "new1") {
    mkOrder({ client_name: "Айбек", product_ru: "Кроссовки", source: "request", status: "new" });
  }
  if (scn === "cab") buildCab(db, ws, mkClient, mkOrder);
  if (scn === "clients") {
    // два «Айбека» без адреса и без телефона; у одного заказ уже есть
    const a = mkClient("Айбек", null), b = mkClient("Айбек", null), c = mkClient("Нурлан", "+996700111222");
    mkOrder({ client_name: "Айбек", client_id: a.id, product_ru: "Старый заказ А" });
    mkOrder({ client_name: "Айбек", client_id: b.id, product_ru: "Старый заказ Б" });
  }
  return db;
}
// Кабинет клиента (задание 7): несколько клиентов, у каждого своя общая ссылка. Токены — фиксированные, чтобы проверять руками.
const T = { A: "1".repeat(32), B: "2".repeat(32), C: "3".repeat(32), REVOKED: "4".repeat(32) };
const OT = (n) => "f" + String(n).padStart(31, "0");   // ссылка отдельного заказа № n
function buildCab(db, ws, mkClient, mkOrder) {
  ws.client_contact_phone = "+996555123456"; ws.client_contact_tg = "buyer_tg";
  db.cabinets = [];
  const A = mkClient("Айбек Тестов", "+996555111222", { city: "Бишкек", address: "ул. Ленина 1, кв. 5", has_card: true });
  const A0 = mkClient("Айбек", "+996555111222");                 // клиент, которого потом объединили с A
  const B = mkClient("Айбек Тестов", "+996555111223", { city: "Ош", pickup_point: "Пункт выдачи 7", has_card: true });   // тёзка, похожий номер
  const C = mkClient("Новый Клиент", "+996700000001");           // без карточки
  db.clientsKey = { A: A.id, A0: A0.id, B: B.id, C: C.id };
  let n = 0;
  const o = (cl, x) => { n++; return mkOrder({ client_id: cl.id, order_number: "CAB-" + n, public_token: OT(n), order_date: "2026-11-0" + Math.min(n, 9), unit_price_cny: 100, exchange_rate: 12, quantity: 1, delivery_cost: 0, supplier: "СЕКРЕТНЫЙ ПОСТАВЩИК", admin_comment: "ВНУТРЕННЯЯ ЗАМЕТКА", ...x }); };
  o(A, { product_ru: "Куртка зимняя", status: "in_transit", client_price: 5000, paid_amount: 2000, tracking_number: "TRK-100500", delivery_eta_from: "2026-12-10T00:00:00+06:00", delivery_eta_to: "2026-12-15T23:59:59+06:00", client_card_ok: true });
  o(A, { product_ru: "Наушники", status: "awaiting_payment", client_currency: "USD", client_price: 300, paid_amount: 0 });
  o(A, { product_ru: "Заказ без цены", status: "new", client_price: null, paid_amount: 150 });   // себестоимость 1200 (100 × 12) клиенту видна быть не должна
  o(A, { product_ru: "Старый заказ (доставлен)", status: "delivered", client_price: 1000, paid_amount: 1000 });
  o(A, { product_ru: "Отменённый заказ", status: "cancelled", client_price: 1000, paid_amount: 500 });
  o(A, { product_ru: "Сумка (прибыла)", status: "arrived", client_price: 1000, paid_amount: 1000, delivery_eta_from: "2026-11-20T00:00:00+06:00", delivery_eta_to: "2026-11-20T23:59:59+06:00" });
  o(A0, { product_ru: "Заказ после объединения", status: "purchasing", client_price: 800, paid_amount: 0 });   // CAB-7: card_ok=false (чужая карточка)
  const ob = o(B, { product_ru: "ЧУЖОЙ заказ тёзки Б", status: "purchasing", client_price: 900, paid_amount: 100 });
  o(C, { product_ru: "Единственный заказ", status: "new", client_price: 1200, paid_amount: 0 });
  // «слияние»: заказ A0 переехал к A (карточка A не «карточка этого заказа»)
  db.orders.filter((x) => x.client_id === A0.id).forEach((x) => { x.client_id = A.id; x.client_card_ok = false; });
  db.cabinets.push({ token: T.A, client_id: A.id }, { token: T.B, client_id: B.id }, { token: T.C, client_id: C.id });
  db.wallet = [
    { client_id: A.id, currency: "KGS", amount: 700, kind: "deposit", order_number: null, created_at: "2026-11-01T10:00:00Z" },
    { client_id: A.id, currency: "USD", amount: 50, kind: "deposit", order_number: null, created_at: "2026-11-02T10:00:00Z" },
    { client_id: null, currency: "KGS", amount: 99999, kind: "deposit", order_number: null, created_at: "2026-11-03T10:00:00Z" },   // спорная, ничья
    { client_id: B.id, currency: "KGS", amount: 12345, kind: "deposit", order_number: null, created_at: "2026-11-03T10:00:00Z" },
  ];
  db.delivery = {};   // файл 61: адрес заказа (id заказа → строка)
  const cab2 = db.orders.find((x) => x.order_number === "CAB-2");
  db.delivery[cab2.id] = { name: "Айбек Тестов", phone: "+996555111222", telegram: null, city: "Бишкек", address: "ул. Абая 10", pickup_point: null, state: "proposed", source: "cabinet" };
  db.tgOn = new Set([db.orders.find((x) => x.order_number === "CAB-1").id]);
}
function calc(r) {
  const cost = Number(r.quantity) * Number(r.unit_price_cny) * Number(r.exchange_rate) + Number(r.delivery_cost) * Number(r.delivery_rate);
  r.cost_som = cost; r.total_som = r.client_price == null ? cost : Number(r.client_price); r.balance_som = r.total_som - Number(r.paid_amount);
  r.profit_som = r.client_price == null ? null : Number(r.client_price) - cost; r.updated_at = iso(NOW());
  return r;
}

const DBS = new Map();
const get = (scn) => { if (!DBS.has(scn)) DBS.set(scn, build(scn)); return DBS.get(scn); };

// ---------- «РПЦ» ----------
const err = (message, code = "P0001") => ({ error: { message, code } });
const ok = (data) => ({ data, error: null });
const active = (o) => !["delivered", "cancelled"].includes(o.status);
function tasks(db) {
  const now = Date.now(), out = [];
  for (const o of db.orders.filter(active)) {
    const d = (x) => ({ id: `${o.id}:${x}`, order_id: o.id, order_number: o.order_number });
    if (o.payment_due_at && Date.parse(o.payment_due_at) < now && o.balance_som > 0 && o.client_price != null) out.push({ ...d("pay"), kind: "payment_overdue", details: { due_at: o.payment_due_at, balance: o.balance_som, currency: o.client_currency } });
    if (o.delivery_eta_to && Date.parse(o.delivery_eta_to) < now) out.push({ ...d("late"), kind: "delivery_overdue", details: { eta_from: o.delivery_eta_from, eta_to: o.delivery_eta_to } });
    else if (o.delivery_eta_to && Date.parse(o.delivery_eta_to) - now < 2 * 864e5) out.push({ ...d("soon"), kind: "delivery_soon", details: { eta_from: o.delivery_eta_from, eta_to: o.delivery_eta_to } });
    if (o.status === "awaiting_payment" && o.client_price == null) out.push({ ...d("m1"), kind: "missing_data", details: { missing: "no_price" } });
    if (o.status === "china_warehouse" && !(Number(o.weight_kg) > 0)) out.push({ ...d("m2"), kind: "missing_data", details: { missing: "no_weight" } });
    if (o.status === "in_transit" && !o.tracking_number) out.push({ ...d("m3"), kind: "missing_data", details: { missing: "no_tracking" } });
  }
  return out;
}
const dayOf = (v) => (v ? String(v).slice(0, 10) : null);
function contactOf(db) { const w = db.workspaces[0]; return !db.hideContact && (w.client_contact_phone || w.client_contact_tg) ? { phone: w.client_contact_phone || null, telegram: w.client_contact_tg || null } : null; }
// сервер с файлом 61: сумма и остаток — только при назначенной цене; srv56=1 воспроизводит старую базу (с подстановкой себестоимости)
function money(db, o) {
  if (db.srv56) return { total_som: o.total_som, paid_amount: o.paid_amount, balance_som: o.balance_som };
  const set = o.client_price != null;
  return { price_set: set, total_som: set ? o.total_som : null, paid_amount: o.paid_amount, balance_som: set ? o.balance_som : null };
}
const delOf = (db, o) => (db.delivery && db.delivery[o.id]) || null;
const delView = (d) => d && { name: d.name, phone: d.phone, telegram: d.telegram, city: d.city, address: d.address, pickup_point: d.pickup_point, state: d.state };
function putDelivery(db, o, a, source) {
  if (["delivered", "cancelled"].includes(o.status)) return err("order_locked");
  const d = delOf(db, o); if (d && d.state === "confirmed") return err("delivery_confirmed");
  db.delivery[o.id] = { name: a.p_name, phone: a.p_phone, telegram: a.p_telegram || null, city: a.p_city, address: a.p_address || null, pickup_point: a.p_pickup_point || null, state: "proposed", source };
  db.writes.push("delivery:" + o.order_number + ":" + source);
  return ok({ ...delView(db.delivery[o.id]) });
}
function cardOf(db, o, needOk) { const c = db.clients.find((x) => x.id === o.client_id); return c && c.city && (!needOk || o.client_card_ok) ? { name: c.name, phone: c.phone, telegram: c.telegram, city: c.city, address: c.address, pickup_point: c.pickup_point } : null; }
// только то, что видит клиент: никаких закупочных цен, прибыли, заметок, поставщика, чужих полей
function orderView(db, o, needOk, extra) {
  return { brand: { name: db.workspaces[0].name, logo: null, fx: null }, contact: contactOf(db), order_number: o.order_number, order_date: o.order_date, product_ru: o.product_ru, product_zh: o.product_zh,
    quantity: o.quantity, weight_kg: o.weight_kg, status: o.status, client_currency: o.client_currency, ...money(db, o),
    delivery_info: o.delivery_info, client_comment: o.client_comment, tracking_number: o.tracking_number, delivery_eta_from: dayOf(o.delivery_eta_from), delivery_eta_to: dayOf(o.delivery_eta_to),
    updated_at: o.updated_at, status_history: [], photos: [], ...(db.srv56 ? {} : { delivery: delView(delOf(db, o)) }), client: cardOf(db, o, needOk), ...extra };
}
function clientRpc(db, name, a) {
  const cab = (tok) => (typeof tok === "string" && /^[a-f0-9]{32}$/.test(tok) ? (db.cabinets || []).find((x) => x.token === tok) : null);
  switch (name) {
    case "get_client_cabinet": {
      const k = cab(a.p_token); if (!k) return ok(null);
      const mine = db.orders.filter((o) => o.client_id === k.client_id), cl = db.clients.find((c) => c.id === k.client_id);
      const debt = {}; mine.filter((o) => o.status !== "cancelled" && (db.srv56 || o.client_price != null) && o.balance_som > 0).forEach((o) => { debt[o.client_currency] = (debt[o.client_currency] || 0) + o.balance_som; });
      const wal = {}; db.wallet.filter((w) => w.client_id === k.client_id).forEach((w) => { wal[w.currency] = (wal[w.currency] || 0) + w.amount; });
      return ok({ brand: { name: db.workspaces[0].name, logo: null, fx: null }, contact: contactOf(db), name: cl.name, card: !!cl.city,
        orders: mine.map((o) => ({ order_number: o.order_number, order_date: o.order_date, product_ru: o.product_ru, quantity: o.quantity, status: o.status, tracking_number: o.tracking_number, client_currency: o.client_currency,
          ...money(db, o), ...(db.srv56 ? {} : { delivery_state: (delOf(db, o) || {}).state || null }), delivery_eta_from: dayOf(o.delivery_eta_from), delivery_eta_to: dayOf(o.delivery_eta_to), tg_on: db.tgOn.has(o.id), photo: null })),
        debt: Object.entries(debt).map(([currency, amount]) => ({ currency, amount })), wallet: Object.entries(wal).filter(([, v]) => v !== 0).map(([currency, amount]) => ({ currency, amount })),
        wallet_ops: db.wallet.filter((w) => w.client_id === k.client_id).map((w) => ({ kind: w.kind, amount: w.amount, currency: w.currency, order_number: w.order_number, created_at: w.created_at })) });
    }
    case "get_cabinet_order": {
      const k = cab(a.p_token); if (!k) return ok(null);
      const o = db.orders.find((x) => x.client_id === k.client_id && x.order_number === a.p_order_number); if (!o) return ok(null);
      return ok(orderView(db, o, false, { tg_on: db.tgOn.has(o.id) }));
    }
    case "get_client_order": {
      const o = typeof a.p_token === "string" ? db.orders.find((x) => x.public_token === a.p_token) : null; if (!o) return ok(null);
      return ok(orderView(db, o, true, {}));
    }
    case "save_client_info": {   // файл 61: предложение в этот заказ; srv56 — модель файла 56 (карточка/перепривязка)
      const o = db.orders.find((x) => x.public_token === a.p_token); if (!o) return err("order_not_found", "P0002");
      if (!db.srv56) return putDelivery(db, o, a, "order_link");
      if (["delivered", "cancelled"].includes(o.status)) return err("order_locked");
      const c = db.clients.find((x) => x.id === o.client_id);
      if (c && o.client_card_ok) Object.assign(c, { name: a.p_name, phone: a.p_phone, city: a.p_city, address: a.p_address, pickup_point: a.p_pickup_point, has_card: true });
      else { const n = db.mkClient(a.p_name, a.p_phone, { city: a.p_city, address: a.p_address, pickup_point: a.p_pickup_point, has_card: true }); o.client_id = n.id; o.client_card_ok = true; }
      db.writes.push("save_client_info:" + o.order_number);
      return ok({ name: a.p_name, phone: a.p_phone, telegram: a.p_telegram, city: a.p_city, address: a.p_address, pickup_point: a.p_pickup_point });
    }
    case "save_cabinet_client_info": {   // модель файла 60: только пустая карточка своего клиента
      const k = cab(a.p_token); if (!k) return err("order_not_found", "P0002");
      const o = db.orders.find((x) => x.client_id === k.client_id && x.order_number === a.p_order_number); if (!o) return err("order_not_found", "P0002");
      if (!db.srv56) return putDelivery(db, o, a, "cabinet");
      if (["delivered", "cancelled"].includes(o.status)) return err("order_locked");
      const c = db.clients.find((x) => x.id === k.client_id); if (c.city) return err("card_exists");
      Object.assign(c, { name: a.p_name, phone: a.p_phone, telegram: a.p_telegram, city: a.p_city, address: a.p_address, pickup_point: a.p_pickup_point, has_card: true });
      db.writes.push("save_cabinet_client_info:" + o.order_number);
      return ok({ name: a.p_name, phone: a.p_phone, telegram: a.p_telegram, city: a.p_city, address: a.p_address, pickup_point: a.p_pickup_point });
    }
  }
  return null;
}
function rpc(db, name, a) {
  db.rpc_log.push(name);
  { const r = clientRpc(db, name, a); if (r) return r; }
  if (name === "ws_client_contact_get" || name === "ws_set_client_contact") {
    const w = db.workspaces[0];
    if (db.scn === "no56") return err(`Could not find the function public.${name}`, "PGRST202");
    if (name === "ws_client_contact_get") return ok({ phone: w.client_contact_phone || null, telegram: w.client_contact_tg || null });
    if (db.staff) return err("forbidden", "42501");
    const ph = String(a.p_phone || "").replace(/[\s().-]/g, "") || null, tg = String(a.p_telegram || "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "") || null;
    if (ph && !/^\+?[0-9]{9,15}$/.test(ph)) return err("invalid_phone", "22023");
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) return err("invalid_telegram", "22023");
    w.client_contact_phone = ph; w.client_contact_tg = tg; return ok({ phone: ph, telegram: tg });
  }
  if (name === "order_delivery_get" || name === "order_delivery_review") {
    if (db.srv56 || !db.delivery) return err(`Could not find the function public.${name}`, "PGRST202");
    const o = db.orders.find((x) => x.id === a.p_order); if (!o) return err("forbidden", "42501");
    const d = db.delivery[o.id] || null;
    if (name === "order_delivery_get") return ok(d && { ...d, submitted_at: iso(NOW()) });
    if (!d) return err("no_delivery", "P0002");
    if (a.p_action === "confirm") { d.state = "confirmed"; db.writes.push("delivery_confirm:" + o.order_number); return ok({ state: "confirmed" }); }
    if (a.p_action === "reject") { delete db.delivery[o.id]; db.writes.push("delivery_reject:" + o.order_number); return ok({ state: null }); }
    return err("invalid_action", "22023");
  }
  const w = db.workspaces[0], prof = db.profiles[0], owner = !db.staff;
  const has55 = db.has55, has54 = db.has54;
  switch (name) {
    case "my_ui_prefs": if (!has55) break; return ok({ simple: prof.ui_simple, explicit: prof.ui_simple_explicit });
    case "my_ui_prefs_set":
      if (!has55) break;
      if (a.p_explicit !== false) { prof.ui_simple = !!a.p_simple; prof.ui_simple_explicit = true; }
      else if (prof.ui_simple == null) { prof.ui_simple = !!a.p_simple; prof.ui_simple_explicit = false; }
      return ok({ simple: prof.ui_simple, explicit: prof.ui_simple_explicit });
    case "ws_daily_get": if (!has55) break;
      return ok({ shop: w.module_shop, exchange: w.module_exchange, shop_open: 0, time_zone: w.time_zone, time_zone_confirmed_at: w.time_zone_confirmed_at,
        exchange_open: db.exchange_requests.filter((r) => ["new", "paid", "confirmed", "sent"].includes(r.status) || r.dispute === "open").length });
    case "ws_daily_set_modules": if (!has55) break;
      if (!owner) return err("forbidden", "42501");
      w.module_shop = !!a.p_shop; w.module_exchange = !!a.p_exchange; db.writes.push("modules"); return rpc(db, "ws_daily_get", a);
    case "ws_confirm_timezone": if (!has55) break; if (!owner) return err("forbidden", "42501"); w.time_zone_confirmed_at = iso(NOW()); return ok(w.time_zone_confirmed_at);
    case "ws_timezone_preview": if (!has55) break; if (!owner) return err("forbidden", "42501");
      return ok({ old: w.time_zone, new: a.p_tz, orders_with_deadlines: db.orders.filter((o) => active(o) && (o.payment_due_at || o.delivery_eta_to)).length, date_changes: 1 });
    case "ws_set_timezone": if (!has55) break; if (!owner) return err("forbidden", "42501");
      db.tz_log.push([w.time_zone, a.p_tz]); w.time_zone = a.p_tz; w.time_zone_confirmed_at = iso(NOW()); return ok(a.p_tz);
    case "tasks_list": if (!has54) break; return ok(tasks(db));
    case "reminder_settings_get": if (!has54) break;
      return ok({ enabled: false, send_from: 9, send_to: 20, grace_hours: 24, min_gap_hours: 72, max_per_order: 3, max_per_day: 50, time_zone: w.time_zone });
    case "order_set_deadlines": if (!has54) break; {
      const o = db.orders.find((x) => x.id === a.p_order); if (!o) return err("not_found");
      o.payment_due_at = a.p_payment_due ? new Date(a.p_payment_due + "Z").toISOString() : null; return ok({}); }
    case "order_deadline_history": return ok([]);
    case "order_reminders_pause": return ok({});
    case "client_link_candidates": {
      // возможные совпадения: только по именам одинаковых клиентов (ничего не объединяется само)
      const out = [], cs = db.clients;
      for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++)
        if (cs[i].name === cs[j].name && cs[i].name !== "Клиент") out.push({ a_id: cs[i].id, a_name: cs[i].name, a_phone: cs[i].phone, a_orders: db.orders.filter((o) => o.client_id === cs[i].id).length,
          b_id: cs[j].id, b_name: cs[j].name, b_phone: cs[j].phone, b_orders: db.orders.filter((o) => o.client_id === cs[j].id).length, reason: "same_name" });
      return ok(out.slice(0, 20)); }
    case "client_wallet_review": case "wallet_reconcile": return ok([]);
    case "wallet_totals": return ok([]);
    case "notify_queue_list": return ok({ counts: { pending: 0, failed: 0, sent_7d: 0, skipped_7d: 0 }, items: [] });
  }
  return err(`Could not find the function public.${name}`, "PGRST202");
}

// ---------- «таблицы» ----------
function embed(db, table, row, sel) {
  const out = { ...row };
  if (table === "orders") {
    out.client = db.clients.find((c) => c.id === row.client_id) || null;
    out.order_photos = []; out.status_history = []; out.tg_subs = [];
  }
  if (table === "workspace_members") out.workspace = db.workspaces.find((x) => x.id === row.workspace_id);
  if (table === "clients") out.orders = db.orders.filter((o) => o.client_id === row.id).map((o) => ({ id: o.id, order_number: o.order_number, status: o.status, order_date: o.order_date }));
  return out;
}
function match(row, f) {
  const v = row[f.col];
  switch (f.op) {
    case "eq": return String(v) === String(f.val);
    case "neq": return String(v) !== String(f.val);
    case "in": return f.val.map(String).includes(String(v));
    case "is": return f.val === null ? v == null : v === f.val;
    case "gte": return v >= f.val; case "lte": return v <= f.val; case "gt": return v > f.val; case "lt": return v < f.val;
    default: return true;
  }
}
function query(db, q) {
  const t = db[q.table];
  if (!Array.isArray(t)) return ok(q.single || q.maybe ? null : []);
  let rows = t.filter((r) => (q.filters || []).every((f) => match(r, f)));
  if (q.method === "insert") {
    const made = [];
    for (const p of [].concat(q.payload)) {
      let row = { id: uid(q.table.slice(0, 2)), workspace_id: "ws1", created_at: iso(NOW()), ...p };
      if (q.table === "orders") {
        if (p.client_id) { const c = db.clients.find((x) => x.id === p.client_id); if (!c || c.workspace_id !== row.workspace_id) return err("bad_client", "22023"); }
        else { const ph = (p.client_phone || "").replace(/\D/g, ""); const found = ph.length >= 11 && p.source !== "request" ? db.clients.filter((c) => (c.match_phone || "").replace(/\D/g, "") === ph) : []; row.client_id = found.length === 1 ? found[0].id : db.mkClient(p.client_name, p.client_phone || null).id; }
        row = { quantity: 1, unit_price_cny: 0, exchange_rate: 0, weight_kg: 0, delivery_cost: 0, delivery_rate: 0, paid_amount: 0, source: "manual", delivery_currency: "USD", delivery_tariff: 0, ...row };
        row.order_number = `CN-${db.orders.length + 1}`; row.public_token = uid("tok"); calc(row);
        db.writes.push("order-insert:" + JSON.stringify(p));
      }
      t.push(row); made.push(row);
    }
    return ok(q.single ? made[0] : made);
  }
  if (q.method === "update") {
    // сервер не даёт менять «сервисные» поля, как и настоящая база (здесь важно только поведение формы)
    if (q.table === "orders" && q.payload.client_id) { const c = db.clients.find((x) => x.id === q.payload.client_id); if (!c || c.workspace_id !== "ws1") return err("bad_client", "22023"); }
    if (q.table === "orders" && q.payload.__fail) return err("violates check constraint \"orders_weight_kg_check\" on column weight_kg", "23514");
    if (db.staff && q.table === "workspaces") return ok(null);
    rows.forEach((r) => { Object.assign(r, q.payload); if (q.table === "orders") calc(r); });
    if (q.table === "orders") db.writes.push("order-update:" + JSON.stringify(q.payload));
    return ok(null);
  }
  if (q.method === "delete") {
    if (db.staff) return ok(null);
    db[q.table] = t.filter((r) => !rows.includes(r)); return ok(null);
  }
  (q.orders || []).slice().reverse().forEach((o) => rows.sort((x, y) => (x[o.col] > y[o.col] ? 1 : x[o.col] < y[o.col] ? -1 : 0) * (o.asc ? 1 : -1)));
  const total = rows.length;
  if (q.range) rows = rows.slice(q.range[0], q.range[1] + 1);
  if (q.limit != null) rows = rows.slice(0, q.limit);
  if (q.head) return { data: null, count: total, error: null };
  rows = rows.map((r) => embed(db, q.table, r, q.select));
  if (q.single) return rows.length === 1 ? ok(rows[0]) : err("JSON object requested, multiple (or no) rows returned", "PGRST116");
  if (q.maybe) return ok(rows[0] || null);
  return { data: rows, count: q.count ? total : null, error: null };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__api" && req.method === "POST") {
    let b = ""; for await (const d of req) b += d;
    const q = JSON.parse(b), db = get(q.scn || "veteran");
    let out;
    try { out = q.op === "rpc" ? rpc(db, q.name, q.args || {}) : q.op === "state" ? ok({ profiles: db.profiles, workspaces: db.workspaces, writes: db.writes, tz_log: db.tz_log, rpc_log: db.rpc_log, orders: db.orders.length, clients: db.clients }) : query(db, q); }
    catch (e) { out = err(String(e && e.message)); }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out)); return;
  }
  const rest = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z_0-9]+)$/);
  if (rest && req.method === "POST") {
    let b = ""; for await (const d of req) b += d;
    const sp = new URLSearchParams(String(req.headers["x-stand-q"] || "")), db = get(sp.get("scn") || "cab");
    db.hideContact = !!sp.get("nocontact"); db.srv56 = !!sp.get("srv56");   // проверка: байер не указал способ связи
    if (sp.get("neterr")) { res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ message: "network down" })); return; }
    let out = sp.get("legacy") && rest[1] === "save_cabinet_client_info" ? null : clientRpc(db, rest[1], JSON.parse(b || "{}"));
    if (out && out.data && sp.get("legacy")) {   // база без файла 60: новых полей в ответе нет
      const strip = (x) => { if (Array.isArray(x)) x.forEach(strip); else if (x && typeof x === "object") { for (const k of ["contact", "card", "delivery_eta_from", "delivery_eta_to", "tg_on"]) delete x[k]; Object.values(x).forEach(strip); } };
      out = ok(JSON.parse(JSON.stringify(out.data))); strip(out.data);
    }
    out = out || err(`Could not find the function public.${rest[1]}`, "PGRST202");
    db.rpc_log.push("rest:" + rest[1]);
    if (out.error) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify(out.error)); } else { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(out.data)); }
    return;
  }
  if (u.pathname.startsWith("/functions/v1/")) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false })); return; }
  if (u.pathname.startsWith("/storage/")) { res.writeHead(404); res.end("no"); return; }
  if (u.pathname === "/__reset") { DBS.delete(u.searchParams.get("scn") || "veteran"); res.writeHead(200); res.end("ok"); return; }
  if (u.pathname === "/__state") { const db = get(u.searchParams.get("scn") || "veteran"); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ profile: db.profiles[0], ws: db.workspaces[0], writes: db.writes, tz_log: db.tz_log, orders: db.orders.length })); return; }
  let p = decodeURIComponent(u.pathname); if (p === "/") p = "/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  let body = fs.readFileSync(file);
  if (p === "/index.html") {
    // вместо настоящей библиотеки Supabase — поддельный клиент
    body = Buffer.from(body.toString("utf8").replace(/<script src="supabase\.js[^"]*"><\/script>/, '<script src="/tests/browser/fake_supabase.js"></script>'));
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
});
server.listen(PORT, "127.0.0.1", () => console.log(`Стенд: http://127.0.0.1:${PORT}/index.html?scn=veteran`));
