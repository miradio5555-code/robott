// =====================================================
// ПРОВЕРКА ПУТИ ЗАКАЗА (js/tracking.js) без браузера и без базы:   node tests/tracking_test.mjs
// Этап из статуса (старые заказы), уточнение этапом, «в пути N дней», срок прибытия, «срок увеличен»,
// проверка полей байера, история без дублей, экранирование, никаких закрытых данных, фразы во всех словарях.
// =====================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// словари
const I18N = {};
const dctx = vm.createContext({ I18N });
for (const l of ["ru", "en", "zh", "vi"]) vm.runInContext(read(`i18n.${l}.js`), dctx);

// окружение страницы: только то, что нужно модулю
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let lang = "ru";
const t = (k, vars) => { let s = I18N[lang][k]; if (s === undefined) return k; for (const v in vars || {}) s = s.split("{" + v + "}").join(vars[v]); return s; };
const store = {};
const win = {
  ULA: { core: { esc, fmtDate: (s) => String(s).slice(0, 10).split("-").reverse().join("."), locale: () => "ru-RU", cur: (n, c) => n + " " + c, state: { orders: [] }, todayISO: () => "2026-11-08", toast() {}, handleError() {} } },
  matchMedia: () => ({ matches: false }),
};
const ctx = vm.createContext({ window: win, t, document: { addEventListener() {} }, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, Intl, Date, Math, String, Number, Object });
vm.runInContext(read("js/tracking.js"), ctx);
const TK = win.ULA.tracking;
TK._now = () => new Date(2026, 10, 8, 15, 0);   // 8 ноября 2026, 15:00 местного времени

let n = 0; const pass = (m) => { console.log("   ✓ " + m); n++; };
const name = (o) => { const i = TK.stageIndex(o); return i === -1 ? "cancelled" : TK.STAGES[i]; };

// 1. старые заказы (без track_stage): этап из статуса
assert.deepEqual(["new", "awaiting_payment", "purchasing", "china_warehouse", "in_transit", "arrived", "delivered", "cancelled"].map((s) => name({ status: s })),
  ["accepted", "accepted", "buying", "cn_warehouse", "shipped", "arrived_dest", "received", "cancelled"]);
assert.equal(name({ status: "что-то-новое" }), "accepted");
pass("старые заказы: этап выводится из статуса, неизвестный статус не ломает страницу");

// 2. уточнение этапом — только внутри своего статуса
assert.equal(name({ status: "purchasing", track_stage: "bought" }), "bought");
assert.equal(name({ status: "arrived", track_stage: "ready" }), "ready");
assert.equal(name({ status: "arrived", track_stage: "buying" }), "arrived_dest", "этап не подходит к статусу (статус сменили кнопкой) → этап статуса");
assert.equal(name({ status: "delivered", track_stage: "packing" }), "received");
assert.equal(name({ status: "cancelled", track_stage: "shipped" }), "cancelled");
pass("этап уточняет статус; несовместимый этап и отмена — по статусу");

// 3. какой статус ставит выбор этапа
assert.equal(TK.statusFor(0, "awaiting_payment"), "awaiting_payment", "«Заявка принята» не сбрасывает «Ожидает оплаты»");
assert.equal(TK.statusFor(2, "purchasing"), "purchasing");
assert.equal(TK.statusFor(4, "purchasing"), "china_warehouse");
assert.equal(TK.statusFor(5, "china_warehouse"), "in_transit");
assert.equal(TK.statusFor(7, "in_transit"), "arrived");
assert.equal(TK.statusFor(9, "arrived"), "delivered");
pass("выбор этапа меняет статус только при переходе через его границу");

// 4. «в пути»: по дате отправки и сроку байера; трек-номер не нужен
let tr = TK.transit({ status: "in_transit", track_stage: "shipped", shipped_at: "2026-11-01", transit_days_min: 10, transit_days_max: 18 });
assert.equal(tr.days, 7); assert.deepEqual([...tr.eta], ["2026-11-11", "2026-11-19"]); assert.equal(tr.late, false);
assert.ok(tr.p > 0.3 && tr.p < 0.45, "положение на маршруте ≈ 7/18");
tr = TK.transit({ status: "in_transit", shipped_at: "2026-10-15", transit_days_min: 10, transit_days_max: 20 });
assert.equal(tr.days, 24); assert.equal(tr.late, true); assert.equal(tr.p, 0.9, "грузовик не уезжает за конец маршрута");
tr = TK.transit({ status: "in_transit", shipped_at: "2026-10-29", transit_days_min: 10, transit_days_max: 10 });
assert.equal(tr.late, false, "ровно максимум — ещё не задержка");
pass("дни в пути, срок прибытия и «срок увеличен» по сроку байера");

// 5. без своего срока: «обычно 10–20 дней», но «срок увеличен» по обычному сроку НЕ показываем
tr = TK.transit({ status: "in_transit", shipped_at: "2026-10-01" });
assert.equal(tr.min, 10); assert.equal(tr.max, 20); assert.deepEqual([...tr.eta], ["2026-10-11", "2026-10-21"]); assert.equal(tr.late, false);
pass("без срока байера — ориентир 10–20 дней без ложной тревоги");

// 6. даты из «Сроков» (файл 58) главнее расчёта; просрочены — «срок увеличен»
tr = TK.transit({ status: "in_transit", shipped_at: "2026-11-01", transit_days_min: 5, transit_days_max: 6, delivery_eta_from: "2026-11-20", delivery_eta_to: "2026-11-25" });
assert.deepEqual([...tr.eta], ["2026-11-20", "2026-11-25"]); assert.equal(tr.late, false);
tr = TK.transit({ status: "arrived", track_stage: "local", delivery_eta_from: "2026-11-01", delivery_eta_to: "2026-11-05" });
assert.equal(tr.late, true);
assert.equal(TK.transit({ status: "arrived", track_stage: "ready", delivery_eta_to: "2026-11-05" }).late, false, "«готов к выдаче» — уже не задержка");
pass("срок из блока «Сроки» и задержка на этапах 6–8");

// 7. старый заказ «В пути» без даты отправки: дата — из истории статусов
tr = TK.transit({ status: "in_transit", status_history: [
  { event_type: "status", status: "purchasing", created_at: "2026-10-01T10:00:00Z" },
  { event_type: "status", status: "in_transit", created_at: "2026-11-03T10:00:00Z" }] });
assert.equal(tr.days, 5); assert.equal(tr.ship, "2026-11-03");
assert.equal(TK.transit({ status: "in_transit" }).days, null, "истории нет — дни не выдумываем");
assert.equal(TK.transit({ status: "in_transit" }).p, 0.5);
pass("старые заказы в пути: дата отправки из истории");

// 8. проверка полей байера
assert.equal(TK.validate({ shipped: "2026-11-01", min: 10, max: 20 }), null);
assert.equal(TK.validate({ shipped: "", min: 0, max: 0 }), null);
assert.equal(TK.validate({ min: 10, max: 0 }), "tk_e_both");
assert.equal(TK.validate({ min: 20, max: 10 }), "tk_e_order");
assert.equal(TK.validate({ min: 0.5, max: 10 }), "tk_e_days");
assert.equal(TK.validate({ min: 10, max: 400 }), "tk_e_days");
assert.equal(TK.validate({ shipped: "2027-01-01" }), "tk_e_date");
assert.equal(TK.validate({ shipped: "мусор" }), "tk_e_date");
pass("проверка полей байера (те же пределы, что в базе: 1–180, от ≤ до)");

// 9. HTML клиента: экранирование, только публичное, аккуратная шкала
const XSS = '<img src=x onerror=alert(1)>';
const o = { order_number: "CN-1", status: "in_transit", track_stage: "shipped", shipped_at: "2026-11-01", transit_days_min: 10, transit_days_max: 20,
  ship_to: XSS, client_currency: "KGS", admin_comment: "СЕКРЕТ", supplier: "ПОСТАВЩИК", cost_som: 777777, profit_som: 55555,
  status_history: [
    { event_type: "status", status: "in_transit", created_at: "2026-11-01T10:00:00Z" },
    { event_type: "stage", status: "in_transit", stage: "shipped", note: XSS, created_at: "2026-11-01T10:00:03Z" },
    { event_type: "payment", paid_total: 500, created_at: "2026-10-20T10:00:00Z" },
    { event_type: "address", created_at: "2026-10-21T10:00:00Z" }] };
const html = TK.clientHtml(o) + TK.routeHtml(o, "Бишкек") + TK.historyHtml(o);
assert.ok(!html.includes("<img"), "текст байера экранируется");
for (const bad of ["СЕКРЕТ", "ПОСТАВЩИК", "777777", "55555"]) assert.ok(!html.includes(bad), "закрытые данные не выводятся: " + bad);
assert.equal((html.match(/aria-current="step"/g) || []).length, 1);
assert.equal((html.match(/class="tl-step done"/g) || []).length, 5);
assert.ok(html.includes("Прогресс ориентировочный"), "подпись «не GPS»");
assert.ok(html.includes("7 дней") && html.includes("Обычно доставка занимает"));
assert.equal((html.match(/class="tk-h"/g) || []).length + (html.match(/class="tk-h pay"/g) || []).length, 2, "статус+этап в одну секунду — одна запись; адрес не показывается");
assert.ok(TK.routeHtml({ status: "purchasing" }) === "" && TK.routeHtml({ status: "delivered" }) === "", "маршрут только на этапах 6–8");
assert.ok(TK.clientHtml({ status: "cancelled" }).includes("cancelled-note"));
pass("страница клиента: экранирование, без закрытых данных, одна текущая точка, без дублей в истории");

// 10. получен: весь путь зелёный, конфетти один раз
const got = { order_number: "CN-9", status: "delivered" };
const h1 = TK.clientHtml(got), h2 = TK.clientHtml(got);
assert.equal((h1.match(/class="tl-step done"/g) || []).length, 10);
assert.ok(h1.includes("tk-confetti") && !h2.includes("tk-confetti"), "конфетти только при первом открытии");
win.matchMedia = () => ({ matches: true });
assert.ok(!TK.clientHtml({ order_number: "CN-10", status: "delivered" }).includes("tk-confetti"), "«уменьшить движение» — без конфетти");
pass("получен: все шаги зелёные, конфетти один раз и не при «уменьшить движение»");

// 11. байер: блок только с файлом 64, без отменённых
assert.equal(TK.buyerHtml({ id: "x", status: "new" }), "", "без полей файла 64 блока нет");
assert.ok(TK.buyerHtml({ id: "x", status: "new", track_stage: null }).includes("data-tk-save"));
assert.equal(TK.buyerHtml({ id: "x", status: "cancelled", track_stage: null }), "");
assert.ok(!TK.buyerHtml({ id: "x", status: "new", track_stage: null, ship_to: XSS, client_comment: XSS }).includes("<img"));
pass("блок байера: только с файлом 64, значения экранированы");

// 12. все фразы tk_* есть во всех словарях, во всех языках текст разный и заполненный
const used = new Set((read("js/tracking.js") + read("js/client.js")).match(/"tk_[a-z_]+"/g).map((s) => s.slice(1, -1)));
for (const k of TK.STAGES) { used.add("tk_s_" + k); used.add("tk_d_" + k); }
["tk_done", "tk_current", "tk_todo", "tk_days_one", "tk_days_few", "tk_days_many", "tk_days_other"].forEach((k) => used.add(k));
for (const l of ["ru", "en", "zh", "vi"]) for (const k of used) if (k !== "tk_days_" && k !== "tk_e_" && k !== "tk_s_" && k !== "tk_d_" && k !== "tk_")
  assert.ok(typeof I18N[l][k] === "string" && I18N[l][k].trim(), `нет фразы ${k} в словаре ${l}`);
for (const l of ["en", "zh", "vi"]) { lang = l; assert.ok(!/[а-яё]/i.test(TK.clientHtml({ order_number: "L" + l, status: "in_transit", shipped_at: "2026-11-01" }) + TK.routeHtml({ status: "in_transit", shipped_at: "2026-11-01", ship_to: "Bishkek" })), "русский текст в языке " + l); }
lang = "ru";
pass("фразы во всех четырёх словарях, без русского текста в других языках");

// 13. карта Китай → Бишкек (доставляем только в Бишкек): всегда один маршрут, грузовик смотрит в сторону Бишкека
win.matchMedia = () => ({ matches: false });
const ship = (to, extra) => ({ status: "in_transit", shipped_at: "2026-11-01", transit_days_min: 10, transit_days_max: 20, ship_to: to, ...extra });
const route = (o, dest) => TK.routeHtml(o, dest);
const pins = (h) => [...h.matchAll(/class="g-pin [^"]*"[^>]*>(.*?)<\/span>/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
for (const to of ["Бишкек, Кыргызстан", "Ош", "Москва", null, "<img src=x onerror=alert(1)>"]) {
  const h = route(ship(to), "Алматы");
  assert.deepEqual(pins(h), ["Склад в Китае", "Граница", "Бишкек"], "всегда Бишкек: " + to);
  assert.ok(h.includes("tk-geo") && !h.includes("<img"));
}
assert.ok(route(ship("Бишкек")).includes("<animateMotion"), "грузовик едет по маршруту");
assert.ok(route(ship("Бишкек")).includes('scale(-0.84 0.84)'), "грузовик развёрнут к Бишкеку (путь идёт справа налево)");
{ // путь идёт с востока (склад) на запад (Бишкек)
  const d = route(ship("Бишкек")).match(/class="g-route" d="M([\d.]+) [\d.]+.*L([\d.]+) [\d.]+"/);
  assert.ok(Number(d[1]) > Number(d[2]), "начало маршрута правее конца");
}
win.matchMedia = () => ({ matches: true });
const still = route(ship("Бишкек"));
assert.ok(!still.includes("<animateMotion") && /g-truck" transform="translate\(/.test(still), "«уменьшить движение» — грузовик стоит на месте");
win.matchMedia = () => ({ matches: false });
assert.ok(route({ status: "arrived", ship_to: "Бишкек" }).includes("tk-geo is-arrived"));
assert.ok(route({ status: "arrived", track_stage: "local", ship_to: "Бишкек" }).includes('class="tk-map'), "по городу — простая схема");
pass("карта: всегда Китай → граница → Бишкек, грузовик по направлению, без анимации по просьбе");

console.log(`🎉 Путь заказа: ${n} групп проверок пройдено`);
