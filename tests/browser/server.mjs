// =====================================================
// СТЕНД ДЛЯ ПРОВЕРКИ САЙТА В БРАУЗЕРЕ (ничего не отправляет наружу, настоящая база не нужна).
//   node tests/browser/server.mjs [порт]      → http://127.0.0.1:8765/index.html?scn=veteran
// Настоящий index.html, app.js и стили, но вместо Supabase — поддельный клиент (tests/browser/fake_supabase.js),
// который обращается к этому серверу. Данные — в памяти, по сценариям: empty, new1, veteran, staff, team, teamstaff, fxoff, fxoff0, clients, no55, no54, nqfail.
// Правила сервера повторяют файлы 56–59 в нужных местах (клиент заказа, пояс, модули, профиль), но это МОДЕЛЬ, а не база:
// настоящие правила проверяет tests/run_db_tests.sh.
// =====================================================
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { teamRpc } from "./team_model.mjs";

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
  const staff = scn === "staff" || scn === "teamstaff";   // teamstaff: закупщик в команде (файлы 67–68)
  const me = staff ? "u-staff" : "u-owner";
  const db = {
    scn, me, staff, has55: scn !== "no55" && scn !== "no54", has54: scn !== "no54",
    profiles: [{ user_id: me, role: "buyer", full_name: staff ? "Помощник" : "Байер Тест", phone: "+996555000111", is_active: true, ui_simple: null, ui_simple_explicit: false }],
    workspaces: [ws],
    workspace_members: [{ workspace_id: "ws1", user_id: me, role: staff ? "staff" : "owner", created_at: "2026-01-01T00:00:00Z" }],
    orders: [], clients: [], exchange_requests: [], tz_log: [], rpc_log: [], writes: [],
    // файл 72: «Мои цели» — личные цели и доска (модель: без правил доступа, их проверяет tests/goals_test.sh)
    my_goals: [], my_tasks: [], my_focus_days: [], my_boards: [], my_lists: [],
    // файл 73: «Карта фабрик» — своя карта человека (модель: строка с user_id = я; правила проверяет tests/factory_maps_test.sh).
    // Чужая карта лежит рядом, чтобы видеть, что страница её не берёт. Сценарий nofmap — файл 73 ещё не запущен.
    factory_maps: scn === "nofmap" ? undefined : [{ user_id: "u-other", version: 4, data: { factories: [{ id: "x1", company_cn: "别人的工厂有限公司" }], areas: [], tasks: [] } }],
  };
  if (scn === "fxoff") { ws.module_exchange = false; db.exchange_requests.push({ id: "fx1", workspace_id: "ws1", status: "sent", dispute: null }, { id: "fx2", workspace_id: "ws1", status: "paid", dispute: "open" }); }
  if (scn === "fxoff0") { ws.module_exchange = false; ws.module_shop = false; }
  // файл 76: у обменника две заявки, клиенты написали в чат (одна переписка частично прочитана)
  if (scn === "fxchat") {
    const at = (m) => iso(new Date(Date.now() - m * 60000));
    const base = { workspace_id: "ws1", source: "shop", rate: 12.62, comment: null, buyer_note: null, eta_until: null, sent_at: null, sent_proof: null, rating: null, dispute: null, client_flag: false };
    db.exchange_requests.push(
      { ...base, id: "fxr-1", client_name: "Азамат", client_phone: "+996555111222", cny: 1000, som: 12620, status: "paid", created_at: at(40), status_at: at(38), paid_at: at(38), proof_path: "fxr-1/pay.jpg", chat_buyer_seen: 11, chat_client_seen: 0,
        recv_method: "alipay", recv_account: null, recv_name: null, recv_qr: "fxr-1/q-abcdefgh12.jpg", recv_at: at(10) },
      { ...base, id: "fxr-2", client_name: "Бакыт", client_phone: "+996777000111", cny: 3000, som: 37860, status: "new", created_at: at(6), status_at: at(6), paid_at: null, proof_path: null, chat_buyer_seen: 0, chat_client_seen: 0,
        recv_method: null, recv_account: null, recv_name: null, recv_qr: null, recv_at: null });
    db.exchange_events = [
      { id: 11, request_id: "fxr-1", kind: "msg", author: "client", body: "Здравствуйте! Оплатил, проверьте, пожалуйста", file_path: null, file_pub: false, created_at: at(30) },
      { id: 12, request_id: "fxr-1", kind: "msg", author: "client", body: "Когда придут юани?", file_path: null, file_pub: false, created_at: at(3) },
      { id: 13, request_id: "fxr-2", kind: "msg", author: "client", body: "Что с моей заявкой?", file_path: null, file_pub: false, created_at: at(2) },
    ];
  }
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
  const N = { cab: 0, demo: 0, empty: 0, new1: 3, veteran: 420, staff: 40, fxoff: 12, fxoff0: 12, clients: 4, no55: 30, no54: 30 }[scn] ?? 12;
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
  if (scn === "nqfail") db.orders[3].supplier_link = "https://detail.1688.com/offer/777123.html";   // поиск по ссылке на товар
  if (scn === "new1") {
    mkOrder({ client_name: "Айбек", product_ru: "Кроссовки", source: "request", status: "new" });
  }
  if (scn === "cab") buildCab(db, ws, mkClient, mkOrder);
  if (scn === "demo") buildDemo(db, ws, mkClient, mkOrder);
  // байер с файлом 64: у заказов есть поля пути заказа → в карточке виден блок «Путь заказа для клиента»
  if (scn === "track") db.orders.forEach((o) => Object.assign(o, { track_stage: null, shipped_at: null, transit_days_min: null, transit_days_max: null, ship_to: null }));
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
  buildTrack(db, mkClient, o);
}
// Путь заказа (файл 64): клиент D, заказы на разных этапах. Ссылка заказа: ?order=OT(n), общая ссылка: ?c=T.D
// Заказы CAB-1…CAB-9 полей файла 64 не имеют — это «старые» заказы (этап из статуса).
T.D = "5".repeat(32);
function buildTrack(db, mkClient, o) {
  const D = mkClient("Дина Трекова", "+996555777888", { city: "Бишкек", address: "ул. Токтогула 5", has_card: true });
  const day = (n) => days(n).slice(0, 10);
  const at = (n, s = 0) => iso(new Date(Date.now() + n * 864e5 + s * 1000));
  const tk = (x) => o(D, { client_price: 4000, paid_amount: 0, client_card_ok: true, track_stage: null, shipped_at: null, transit_days_min: null, transit_days_max: null, ship_to: null, history: [], ...x });
  tk({ product_ru: "Кроссовки (в пути)", status: "in_transit", paid_amount: 4000, track_stage: "shipped", shipped_at: day(-8), transit_days_min: 10, transit_days_max: 20,
    ship_to: "Бишкек, Кыргызстан", tracking_number: "YT2611080001", client_comment: "Груз в машине, всё по плану",
    history: [
      { event_type: "status", status: "new", created_at: at(-20) }, { event_type: "payment", paid_total: 4000, created_at: at(-19) },
      { event_type: "status", status: "purchasing", created_at: at(-15) }, { event_type: "stage", status: "purchasing", stage: "bought", note: null, created_at: at(-13) },
      { event_type: "status", status: "china_warehouse", created_at: at(-11) },
      { event_type: "stage", status: "china_warehouse", stage: "packing", note: "Вес 2,4 кг, упаковали в коробку", created_at: at(-9) },
      { event_type: "status", status: "in_transit", created_at: at(-8) }, { event_type: "stage", status: "in_transit", stage: "shipped", note: "Груз в машине, всё по плану", created_at: at(-8, 2) },
    ] });                                                                                                         // CAB-10
  tk({ product_ru: "Платье (срок прошёл)", status: "in_transit", track_stage: "shipped", shipped_at: day(-25), transit_days_min: 10, transit_days_max: 18, ship_to: "Ош" });   // CAB-11
  tk({ product_ru: "Сумка (выкуплена)", status: "purchasing", track_stage: "bought" });                                    // CAB-12
  tk({ product_ru: "Куртка (готовим к отправке)", status: "china_warehouse", track_stage: "packing" });                     // CAB-13
  tk({ product_ru: "Часы (прибыли)", status: "arrived", track_stage: null });                                               // CAB-14
  tk({ product_ru: "Плед (по городу)", status: "arrived", track_stage: "local" });                                          // CAB-15
  tk({ product_ru: "Лампа (готова к выдаче)", status: "arrived", track_stage: "ready" });                                   // CAB-16
  tk({ product_ru: "Чайник (получен)", status: "delivered", track_stage: "received", paid_amount: 4000 });                  // CAB-17
  tk({ product_ru: "Рюкзак (заявка)", status: "new" });                                                                     // CAB-18
  tk({ product_ru: "Шарф (этап не подходит к статусу)", status: "arrived", track_stage: "buying" });                        // CAB-19 → «Прибыл в страну назначения»
  tk({ product_ru: "Зонт (в пути без даты)", status: "in_transit", history: [{ event_type: "status", status: "in_transit", created_at: at(-3) }] });   // CAB-20: дата из истории
  db.cabinets.push({ token: T.D, client_id: D.id });
}
// Витрина для главной страницы (scripts/landing_shots.mjs): правдоподобный кабинет байера за год — клиенты, товары, деньги.
// Всё выдумано и одинаково при каждом запуске. Заказ для страницы клиента: ?scn=demo&order=DEMO_TOKEN.
export const DEMO_TOKEN = "d".repeat(32);
function buildDemo(db, ws, mkClient, mkOrder) {
  ws.name = "Silk Road Cargo"; ws.order_prefix = "SR"; ws.client_contact_phone = "+996555123456"; ws.client_contact_tg = "silkroad_cargo";
  db.cabinets = []; db.wallet = []; db.delivery = {}; db.tgOn = new Set();
  db.profiles[0].full_name = "Айбек Касымов";
  const names = ["Айгерим Сапарова", "Бакыт Токтогулов", "Нурлан Асанов", "Элина Кадырова", "Тимур Жумабаев", "Мээрим Осмонова",
    "Азамат Беков", "Жылдыз Маматова", "Улан Исаков", "Динара Абдыкадырова", "Эрлан Сыдыков", "Асель Нурбекова"];
  const cities = ["Бишкек", "Бишкек", "Ош", "Бишкек", "Каракол", "Бишкек"];
  const people = names.map((n, i) => mkClient(n, "+99655" + String(5100000 + i * 7311).slice(0, 7), { city: cities[i % cities.length], address: "ул. Киевская " + (10 + i), has_card: true }));
  // товар, цена за штуку в юанях, сколько штук, вес кг, наценка
  const goods = [["Кроссовки беговые", 118, 40, 38, 1.32], ["Детские пуховики", 145, 25, 30, 1.3], ["Чехлы для телефонов", 6.5, 300, 9, 1.6],
    ["Женские сумки", 86, 30, 21, 1.38], ["Беспроводные наушники", 52, 60, 7, 1.42], ["Постельное бельё", 98, 24, 36, 1.3],
    ["Конструкторы для детей", 41, 80, 44, 1.35], ["Зимние ботинки", 132, 36, 48, 1.3], ["Термосы 0,5 л", 23, 120, 42, 1.45],
    ["LED-лампы", 9.8, 400, 26, 1.5], ["Школьные рюкзаки", 58, 45, 27, 1.36], ["Спортивные костюмы", 89, 40, 34, 1.33],
    ["Кухонные наборы", 74, 30, 52, 1.34], ["Солнцезащитные очки", 14, 150, 8, 1.7], ["Пледы флисовые", 39, 60, 45, 1.4]];
  const RATE = 12.4, USD = 87.5, TARIFF = 3.2;
  const day = (n) => new Date(Date.now() - n * 864e5);
  // активные заказы: последние две недели, все этапы
  const active = [["new", 0, 0], ["new", 1, 0], ["awaiting_payment", 2, 0], ["awaiting_payment", 3, 0.5], ["purchasing", 4, 1], ["purchasing", 5, 1],
    ["china_warehouse", 6, 1], ["china_warehouse", 8, 1], ["in_transit", 9, 1], ["in_transit", 11, 0.6], ["arrived", 13, 1], ["arrived", 14, 0.7]];
  let n = 0, featured = null;
  const make = (status, ago, paidPart, k) => {
    const [title, unit, qty, kg, markup] = goods[k % goods.length];
    const q = Math.round(qty * (0.8 + ((k * 37) % 9) / 20));
    const cost = q * unit * RATE + kg * TARIFF * USD;
    const price = Math.round((cost * markup) / 100) * 100;
    const d = day(ago);
    n++;
    const o = mkOrder({ client_id: people[k % people.length].id, client_name: people[k % people.length].name, client_phone: people[k % people.length].phone, order_number: "SR-" + (1000 + n), status, product_ru: title + ", " + q + " шт",
      unit_price_cny: unit, quantity: q, exchange_rate: RATE, weight_kg: ["new", "awaiting_payment", "purchasing"].includes(status) ? 0 : kg, delivery_cost: kg * TARIFF, delivery_rate: USD,
      client_currency: "KGS", client_price: price, paid_amount: Math.round(price * paidPart / 100) * 100, tracking_number: ["in_transit", "arrived", "delivered"].includes(status) ? "YT26" + String(110000 + n * 731) : null,
      order_date: iso(d).slice(0, 10), created_at: iso(d), supplier: "1688" });
    return o;
  };
  // история за 12 месяцев: выданные заказы (растущий бизнес: к концу года заказов больше)
  for (let m = 11; m >= 0; m--) {
    const cnt = 3 + Math.round((11 - m) * 0.6);
    for (let i = 0; i < cnt; i++) make(i === cnt - 1 && m % 4 === 2 ? "cancelled" : "delivered", 16 + m * 30 + i * 4, i === 0 && m < 2 ? 0.5 : 1, m * 7 + i * 3);
  }
  active.slice().reverse().forEach(([st, ago, paid], i) => { const o = make(st, ago, paid, i * 5 + 2); if (st === "in_transit" && !featured) featured = o; });
  // заказ для страницы клиента: кроссовки в пути, путь заказа заполнен
  const at = (k) => iso(day(k));
  Object.assign(featured, { product_ru: "Кроссовки беговые, 40 шт", public_token: DEMO_TOKEN, track_stage: "shipped", shipped_at: at(6).slice(0, 10), transit_days_min: 10, transit_days_max: 14,
    ship_to: "Бишкек, Кыргызстан", client_comment: "Груз в машине, всё по плану", client_card_ok: true,
    history: [{ event_type: "status", status: "new", created_at: at(16) }, { event_type: "payment", paid_total: featured.paid_amount, created_at: at(15) },
      { event_type: "status", status: "purchasing", created_at: at(14) }, { event_type: "stage", status: "purchasing", stage: "bought", note: null, created_at: at(12) },
      { event_type: "status", status: "china_warehouse", created_at: at(9) }, { event_type: "stage", status: "china_warehouse", stage: "packing", note: "Вес 38 кг, 2 коробки", created_at: at(8) },
      { event_type: "status", status: "in_transit", created_at: at(6) }, { event_type: "stage", status: "in_transit", stage: "shipped", note: "Груз в машине, всё по плану", created_at: at(6) }] });
  calc(featured);
  db.tgOn.add(featured.id);
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
    updated_at: o.updated_at, status_history: o.history || [], photos: [], ...(db.srv56 ? {} : { delivery: delView(delOf(db, o)) }), client: cardOf(db, o, needOk),
    // файл 64: только публичные поля пути заказа (у «старых» заказов стенда их нет — как в базе без файла 64)
    ...("track_stage" in o ? { track_stage: o.track_stage, shipped_at: dayOf(o.shipped_at), transit_days_min: o.transit_days_min, transit_days_max: o.transit_days_max, ship_to: o.ship_to } : {}),
    ...extra };
}
const GUEST_FX = "e".repeat(32);
const FX_NEW = "11111111-2222-4333-8444-555555555555", FX_TALK = "11111111-2222-4333-8444-555555555556";
function fxReq(db, id) {
  if (id !== FX_NEW && id !== FX_TALK) return null;
  db.fxReqs = db.fxReqs || {}; db.fxSeq = db.fxSeq || 100;
  if (!db.fxReqs[id]) {
    const at = (m) => iso(new Date(NOW().getTime() - m * 60000)), talk = id === FX_TALK;
    const view = { status: talk ? "confirmed" : "paid", cny: 1000, som: 12620, rate: 12.62, created_at: at(40), paid_at: at(38), status_at: at(talk ? 20 : 38),
      eta_until: talk ? iso(new Date(NOW().getTime() + 25 * 60000)) : null, buyer_note: null, has_proof: true, note: null, eta: 30, can_upload: false,
      brand: { name: "ULA Factory", logo: null }, sent_at: null, sent_proof: null, close_at: null, received_at: null, rating: null,
      dispute: null, dispute_by: null, dispute_result: null, dispute_note: null, can_dispute: false, dispute_from: at(-80),
      // файл 78: в переписке клиент уже указал Alipay, у новой заявки реквизитов нет
      recv_method: talk ? "alipay" : null, recv_account: null, recv_name: null, has_recv_qr: talk, recv_edit: true };
    const events = talk ? [
      { id: 11, kind: "msg", author: "client", body: "Здравствуйте! Я оплатил 12 620 сом, проверьте, пожалуйста", file: null, photo: false, at: at(30) },
      { id: 12, kind: "msg", author: "client", body: null, file: null, photo: true, at: at(29) },
      { id: 13, kind: "msg", author: "buyer", body: "Здравствуйте! Оплату получили, спасибо. Юани отправим в течение 30 минут на ваш Alipay.", file: null, photo: false, at: at(20) },
    ] : [];
    db.fxReqs[id] = { view, events, buyer_seen: talk ? 12 : 0 };
  }
  return db.fxReqs[id];
}
function clientRpc(db, name, a) {
  const cab = (tok) => (typeof tok === "string" && /^[a-f0-9]{32}$/.test(tok) ? (db.cabinets || []).find((x) => x.token === tok) : null);
  switch (name) {
    // ссылка обмена ULA для гостей с главной (scn=guestfx, config.js → EXCHANGE_LINK)
    case "get_shop": {
      if (a.p_token !== GUEST_FX) return ok(null);
      const d = NOW(); d.setHours(9, 30, 0, 0);
      return ok({ name: "ULA Factory", logo: null, products: [],
        fx: { tiers: [{ from: 1000, rate: 12.62 }, { from: 10000, rate: 12.55 }, { from: 50000, rate: 12.48 }], note: "Mbank 0555 000 000 · ULA", eta: 30, updated_at: iso(d) } });
    }
    case "submit_exchange": {
      if (a.p_token !== GUEST_FX) return err("link_not_found", "P0002");
      const cny = Number(a.p_cny), rate = cny >= 50000 ? 12.48 : cny >= 10000 ? 12.55 : cny >= 1000 ? 12.62 : 0;
      if (!rate) return err("below_min", "22023");
      (db.writes = db.writes || []).push("exchange:" + cny + (a.p_recv_method ? ":" + a.p_recv_method + ":" + (a.p_recv_account || "") : ""));
      return ok({ ok: true, id: "11111111-2222-4333-8444-555555555555", cny, som: Math.round(cny * rate * 100) / 100, rate, note: "Mbank 0555 000 000 · ULA" });
    }
    case "fx_attach_proof": (db.writes = db.writes || []).push("exchange_proof"); return ok(true);
    case "fx_set_recv": {
      const r = fxReq(db, a.p_id); if (!r) return err("request_not_found", "P0002");
      if (!["alipay", "wechat", "bank"].includes(a.p_method)) return err("invalid_recv_method", "22023");
      const qr = a.p_qr ? true : a.p_drop_qr ? false : r.view.has_recv_qr;
      if (!a.p_account && !qr) return err("recv_empty", "22023");
      Object.assign(r.view, { recv_method: a.p_method, recv_account: a.p_account || null, recv_name: a.p_name || null, has_recv_qr: qr });
      (db.writes = db.writes || []).push("fx_recv:" + a.p_method + ":" + (a.p_account || "") + (qr ? ":qr" : ""));
      return ok({ ok: true });
    }
    // страница заявки клиента с чатом (файл 76): …555 — новая заявка без сообщений, …556 — идёт переписка
    case "get_exchange_status": {
      const r = fxReq(db, a.p_id); if (!r) return ok(null);
      return ok({ ...r.view, buyer_seen: r.buyer_seen, chat_open: true, events: r.events });
    }
    case "fx_chat_post": {
      const r = fxReq(db, a.p_id); if (!r) return err("request_not_found", "P0002");
      const body = a.p_body == null ? null : String(a.p_body).trim();
      if (!body && !a.p_file) return err("empty", "22023");
      if (body === "!fast") return err("too_fast", "P0001");
      const id = ++db.fxSeq;
      r.events.push({ id, kind: "msg", author: "client", body: body || null, file: null, photo: !!a.p_file, at: iso(NOW()) });
      (db.writes = db.writes || []).push("fx_chat:" + (body || "photo"));
      return ok(id);
    }
    case "fx_chat_seen": { const r = fxReq(db, a.p_id); return ok(r ? r.events.reduce((m, e) => Math.max(m, e.id), 0) : null); }
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
// файл 75: курс ULA для главной (гостю — только цифры курса, без заметки с реквизитами). Сценарий nofx — гость, курса нет.
function publicFx(db) {
  if (db.scn === "nofx") return null;
  const day = (k, h) => { const d = NOW(); d.setDate(d.getDate() - k); d.setHours(h, 30, 0, 0); return iso(d); };
  const hist = [[34, 12.74], [26, 12.70], [21, 12.66], [15, 12.71], [11, 12.68], [6, 12.64], [3, 12.69], [0, 12.62]].map(([k, r]) => ({ at: day(k, 9), r }));
  return { tiers: [{ from: 1000, rate: 12.62 }, { from: 10000, rate: 12.55 }, { from: 50000, rate: 12.48 }], eta: 120, updated_at: day(0, 9), hist };
}
function rpc(db, name, a) {
  if (name === "public_fx") return ok(publicFx(db));
  // файл 76: чат заявки у обменника
  if (db.exchange_events && (name === "fx_chat_post" || name === "fx_chat_seen" || name === "fx_chat_unread")) {
    const ev = db.exchange_events, maxOf = (id) => ev.filter((e) => e.request_id === id).reduce((m, e) => Math.max(m, e.id), 0);
    if (name === "fx_chat_unread") return ok(db.exchange_requests.reduce((n, r) => n + ev.filter((e) => e.request_id === r.id && e.author !== "buyer" && e.id > (r.chat_buyer_seen || 0)).length, 0));
    const r = db.exchange_requests.find((x) => x.id === a.p_id); if (!r) return err("request_not_found", "P0002");
    if (name === "fx_chat_seen") { r.chat_buyer_seen = maxOf(r.id); return ok(r.chat_buyer_seen); }
    const body = a.p_body == null ? null : String(a.p_body).trim();
    if (!body && !a.p_file) return err("empty", "22023");
    const id = ev.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    ev.push({ id, request_id: r.id, kind: "msg", author: "buyer", body, file_path: a.p_file || null, file_pub: !!a.p_file, created_at: iso(NOW()) });
    r.chat_buyer_seen = id; db.writes.push("fx_chat_buyer:" + (body || "photo"));
    return ok(id);
  }
  if (name === "fx_autoclose_ws") return ok(0);
  if (name === "my_focus_add") {   // файл 72: минуты к дню и к задаче
    const m = Number(a.p_minutes); if (!(m >= 1 && m <= 240)) return err("bad_minutes", "22023");
    let d = db.my_focus_days.find((x) => x.day === a.p_day); if (!d) { d = { day: a.p_day, minutes: 0 }; db.my_focus_days.push(d); }
    d.minutes = Math.min(1440, d.minutes + m);
    const t = a.p_task ? db.my_tasks.find((x) => x.id === a.p_task) : null; if (t) t.focus_min = (t.focus_min || 0) + m;
    return ok({ day_minutes: d.minutes, task_minutes: t ? t.focus_min : null });
  }
  db.rpc_log.push(name);
  { const r = clientRpc(db, name, a); if (r) return r; }
  { const r = teamRpc(db, name, a); if (r) return r; }   // файлы 67–68: только сценарии team и teamstaff
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
    case "notify_queue_list": {   // сценарий nqfail: два сообщения клиентам не ушли
      if (db.scn !== "nqfail") return ok({ counts: { pending: 0, failed: 0, sent_7d: 0, skipped_7d: 0 }, items: [] });
      const it = (id, n) => ({ id, status: "failed", to_status: "arrived", order_number: n, attempts: 5, max_attempts: 5, last_error: "telegram_403", created_at: iso(NOW()), history: [] });
      return ok({ counts: { pending: 0, failed: 2, sent_7d: 7, skipped_7d: 0 }, items: [it("nq1", "CN-0001"), it("nq2", "CN-0002")] });
    }
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
  if (table === "workspace_members") out.workspace = db.scn === "teamstaff" ? null : db.workspaces.find((x) => x.id === row.workspace_id);   // файл 69: у закупщика нет доступа ко всему кабинету
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
  if (q.table === "factory_maps") {
    if (!t) return err("Could not find the table 'public.factory_maps' in the schema cache", "PGRST205");
    const mine = t.filter((r) => r.user_id === db.me);
    const pick = (rows) => rows.filter((r) => (q.filters || []).every((f) => match(r, f)));
    if (q.method === "insert") {
      if (mine.length) return err("duplicate key value violates unique constraint \"factory_maps_pkey\"", "23505");
      const row = { user_id: db.me, version: 1, data: q.payload.data };
      t.push(row); db.writes.push("fmap-insert"); return ok([row]);
    }
    if (q.method === "update") {
      const rows = pick(mine);
      rows.forEach((r) => { if (q.payload.version !== r.version + 1) throw new Error("stale_version"); Object.assign(r, q.payload); });
      db.writes.push("fmap-update:" + rows.length); return ok(rows.map((r) => ({ version: r.version, data: r.data })));
    }
    return ok(pick(mine).map((r) => ({ version: r.version, data: r.data })));
  }
  if (q.table === "factory_map_data") return err("permission denied for table factory_map_data", "42501");
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
  // сайт при входе спрашивает у Supabase, какие способы входа включены (app.js, «Войти через Google»)
  if (u.pathname === "/auth/v1/settings") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ external: {} })); return; }
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
  if (u.pathname.startsWith("/storage/v1/object/fx-proofs/") && req.method === "POST") { for await (const _ of req) { /* тело не нужно */ } res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ Key: "ok" })); return; }
  if (u.pathname.startsWith("/storage/")) { res.writeHead(404); res.end("no"); return; }
  if (u.pathname === "/__reset") { DBS.delete(u.searchParams.get("scn") || "veteran"); res.writeHead(200); res.end("ok"); return; }
  if (u.pathname === "/__state") { const db = get(u.searchParams.get("scn") || "veteran"); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ profile: db.profiles[0], ws: db.workspaces[0], writes: db.writes, tz_log: db.tz_log, orders: db.orders.length, fmaps: db.factory_maps })); return; }
  let p = decodeURIComponent(u.pathname); if (p === "/") p = "/index.html"; if (p === "/factory-map/") p = "/factory-map/index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  let body = fs.readFileSync(file);
  if (p === "/index.html") {
    // вместо настоящей библиотеки Supabase — поддельный клиент
    body = Buffer.from(body.toString("utf8").replace(/<script src="supabase\.js[^"]*"><\/script>/, '<script src="/tests/browser/fake_supabase.js"></script>'));
  }
  if (p === "/factory-map/index.html") {
    body = Buffer.from(body.toString("utf8").replace(/<script src="\.\.\/supabase\.js[^"]*"><\/script>/, '<script src="/tests/browser/fake_supabase.js"></script>'));
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
});
server.listen(PORT, "127.0.0.1", () => console.log(`Стенд: http://127.0.0.1:${PORT}/index.html?scn=veteran`));
