// =====================================================
// ПРОВЕРКА ШАБЛОНОВ ЗАКАЗА (js/templates.js): «1688», «Taobao», «Повторить заказ».
//
//   node tests/templates_test.mjs
//
// Главное: повтор заказа не должен создавать денежных и личных ошибок —
// не переносить оплату, долг, цену, трек-номер, историю, фото, заметки и не привязывать заказ к чужому клиенту.
// =====================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
const ok = (cond, name) => { if (!cond) { console.error("❌ " + name); process.exit(1); } passed++; console.log("   ✓ " + name); };

const win = { ULA: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, "js/templates.js"), "utf8"), { window: win, URL }, { filename: "js/templates.js" });
const T = win.ULA.templates;
const rate = (a, b) => (a === b ? "1" : a === "CNY" && b === "KGS" ? "12.4" : a === "USD" && b === "KGS" ? "87.5" : "");
const ws = { default_client_currency: "KGS", default_delivery_currency: "USD", default_delivery_tariff: 3 };

console.log("▶ Шаблоны заказа");

// ---------- площадки ----------
const a = T.platform("1688", { ws, rate });
ok(a.supplier === "1688" && a.purchase_currency === "CNY" && a.client_currency === "KGS" && a.delivery_currency === "USD" && a.delivery_tariff === 3,
  "1688: поставщик, закупка в юанях, валюты и тариф из настроек кабинета");
ok(a.exchange_rate === "12.4" && a.delivery_rate === "87.5" && a.quantity === 1, "1688: сегодняшние курсы и количество 1");
const b = T.platform("taobao", { ws: {}, rate: () => "" });
ok(b.supplier === "Taobao" && b.client_currency === "KGS" && b.delivery_tariff === null && b.exchange_rate === "", "Taobao: без настроек кабинета — значения по умолчанию, курс пустой (не выдумывается)");
ok(T.platform("amazon", { ws }) === null, "неизвестная площадка: шаблона нет");
const forbidden = ["client_id", "client_name", "client_phone", "paid_amount", "client_price", "tracking_number", "status", "admin_comment"];
ok(forbidden.every((k) => !(k in a) && !(k in b)), "шаблон площадки не подставляет клиента, деньги, статус и заметки");
ok(T.kindOfLink("https://detail.1688.com/offer/777.html") === "1688" && T.kindOfLink("https://item.taobao.com/item.htm?id=1") === "taobao" &&
  T.kindOfLink("https://detail.tmall.com/item.htm?id=1") === "taobao" && T.kindOfLink("https://evil-1688.com.example.org/x") === "" && T.kindOfLink("не ссылка") === "",
  "площадка по ссылке: 1688, Taobao/Tmall; похожий чужой адрес не подходит");

// ---------- повтор заказа ----------
const client = { id: "c1", name: "Айбек Тестов", phone: "+996555111222", city: "Бишкек", address: "ул. Ленина 1" };
const old = {
  id: "o1", workspace_id: "ws1", order_number: "CN-17", order_date: "2026-09-01", status: "delivered", source: "request", public_token: "secret-token",
  created_at: "2026-09-01T10:00:00Z", updated_at: "2026-10-01T10:00:00Z",
  client_id: "c1", client_name: "Айбек (старое имя)", client_phone: "+996555000000", client_wechat: "aibek_wx",
  product_ru: "  Кроссовки  ", product_zh: "运动鞋", quantity: 3, unit_price_cny: 120,
  supplier: "Фабрика Х", supplier_link: "https://detail.1688.com/offer/777.html", supplier_wechat: "factory_wx",
  purchase_currency: "CNY", client_currency: "KGS", delivery_currency: "USD", delivery_tariff: 3.5,
  exchange_rate: 11.1, delivery_rate: 80, delivery_cost: 21, weight_kg: 6,
  client_price: 9000, paid_amount: 4000, cost_som: 5676, total_som: 9000, balance_som: 5000, profit_som: 3324,
  tracking_number: "YT123", track_stage: "handed", shipped_at: "2026-09-10", transit_days_min: 10, transit_days_max: 15, ship_to: "Бишкек", shipment_id: "s1",
  payment_due_at: "2026-09-05T00:00:00Z", delivery_eta_from: "2026-09-20", delivery_eta_to: "2026-09-25", reminders_paused_at: null,
  delivery_info: "Бишкек, ул. Ленина 1", client_comment: "Размер 42", admin_comment: "Клиент торгуется",
  status_history: [{ event_type: "payment", amount: 4000 }], photos: [{ path: "x.jpg" }], client,
};
const r = T.repeat(old, { client, rate });
const f = r.fields;
const allowed = new Set([...T.COPY, ...T.FRESH, ...T.IF_CONFIRMED]);
ok(Object.keys(f).every((k) => allowed.has(k)), "в повторный заказ попадают только разрешённые поля: " + Object.keys(f).filter((k) => !allowed.has(k)).join(","));
ok(T.NEVER.every((k) => !(k in f)), "не переносятся: оплата, цена, вес, трек, этап, сроки, статус, история, фото, заметки, ссылка клиента");
ok(!("paid_amount" in f) && !("client_price" in f) && !("balance_som" in f) && !("profit_som" in f), "деньги: ни оплаты, ни цены для клиента, ни долга, ни прибыли");
ok(f.exchange_rate === "12.4" && f.delivery_rate === "87.5", "курсы — сегодняшние (12.4 и 87.5), а не из старого заказа (11.1 и 80)");
ok(f.client_id === "c1" && f.client_name === "Айбек Тестов" && f.client_phone === "+996555111222", "клиент — по постоянному номеру, имя и телефон из его карточки, а не из старого заказа");
ok(f.product_ru === "Кроссовки" && f.product_zh === "运动鞋" && f.quantity === 3 && f.unit_price_cny === 120, "товар: название, количество и цена поставщика");
ok(f.supplier === "Фабрика Х" && f.supplier_link === old.supplier_link && f.supplier_wechat === "factory_wx", "поставщик и ссылка на товар");
ok(f.purchase_currency === "CNY" && f.client_currency === "KGS" && f.delivery_currency === "USD" && f.delivery_tariff === 3.5, "валюты и тариф доставки");
ok(f.delivery_info === "Бишкек, ул. Ленина 1" && r.addressCopied && !r.addressSkipped, "адрес перенесён: у клиента есть карточка с адресом");
ok(r.from === "CN-17" && r.clientLinked, "известно, какой заказ повторяется");
ok(JSON.stringify(old.status_history) === '[{"event_type":"payment","amount":4000}]' && old.paid_amount === 4000, "исходный заказ не изменён");

// адрес не подтверждён
const noCard = { id: "c1", name: "Айбек", phone: null, city: null };
let r2 = T.repeat(old, { client: noCard, rate });
ok(!("delivery_info" in r2.fields) && r2.addressSkipped && !r2.addressCopied, "клиент без карточки: адрес НЕ переносится и об этом известно");
r2 = T.repeat(old, { client: noCard, rate, delivery: { state: "proposed" } });
ok(!("delivery_info" in r2.fields), "адрес только предложен клиентом (не принят байером): НЕ переносится");
r2 = T.repeat(old, { client: noCard, rate, delivery: { state: "confirmed" } });
ok(r2.fields.delivery_info === "Бишкек, ул. Ленина 1", "байер принял адрес заказа: переносится");

// чужой клиент
r2 = T.repeat(old, { client: { id: "c2", name: "Другой человек", phone: "+996700000000", city: "Ош" }, rate });
ok(!("client_id" in r2.fields) && r2.fields.client_name === "Айбек (старое имя)" && !r2.clientLinked && !("delivery_info" in r2.fields),
  "карточка другого клиента: заказ к нему не привязывается, его имя, телефон и адрес не подставляются");
r2 = T.repeat({ ...old, client_id: null }, { client: null, rate });
ok(!("client_id" in r2.fields) && r2.fields.client_name === "Айбек (старое имя)", "старый заказ без клиента: повтор тоже без привязки");

// мусор в данных
r2 = T.repeat({ ...old, quantity: 0, unit_price_cny: -5, delivery_tariff: "abc", supplier_link: "javascript:alert(1)", purchase_currency: "", delivery_currency: "" }, { client, rate });
ok(r2.fields.quantity === 1 && !("unit_price_cny" in r2.fields) && !("delivery_tariff" in r2.fields) && !("supplier_link" in r2.fields),
  "неверные числа и опасная ссылка не переносятся; количество не меньше 1");
ok(r2.fields.purchase_currency === "CNY" && r2.fields.delivery_currency === "KGS", "пустые валюты заменяются безопасными значениями");
ok(Object.keys(T.repeat(null, {}).fields).length > 0 && !("client_id" in T.repeat(undefined).fields), "пустой заказ не вызывает ошибку");

// ---------- каждое поле формы заказа учтено ----------
// Если в форму добавят новое поле, проверка заставит решить: переносить его в повтор или нет.
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const ids = [...new Set([...html.matchAll(/id="f-([a-z_]+)"/g)].map((m) => m[1]))];
const UI_ONLY = ["client_search", "more", "photos", "unsaved", "status"];   // не данные заказа: поиск, «ещё», выбор фото, плашка; статус — в NEVER
const known = new Set([...T.COPY, ...T.NEVER, ...T.FRESH, ...T.IF_CONFIRMED, ...UI_ONLY]);
const unknown = ids.filter((k) => !known.has(k));
ok(!unknown.length, "каждое поле формы заказа отнесено к «переносить» или «не переносить»" + (unknown.length ? ": не учтены " + unknown.join(", ") : ""));
ok(T.COPY.every((k) => !T.NEVER.includes(k)) && T.FRESH.every((k) => !T.COPY.includes(k)), "списки «переносить» и «не переносить» не пересекаются");

console.log("🎉 Шаблоны заказа: проверок пройдено — " + passed);
