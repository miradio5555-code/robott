// =====================================================
// ПРОВЕРКА ЭКРАНОВ САЙТА В НАСТОЯЩЕМ CHROME — без сторонних пакетов и без рабочей Supabase.
//
//   npm run smoke                         (то же: node tests/browser/smoke.mjs)
//   node tests/browser/smoke.mjs --shots=папка      ещё и сохранить снимки экранов
//   node tests/browser/smoke.mjs --only=375         только одна ширина (375, 390, 768, 1280)
//   node tests/browser/smoke.mjs --verbose          показать мелкие кнопки по экранам
//
// Сам запускает стенд (tests/browser/server.mjs: настоящие index.html, app.js и стили, вместо Supabase — поддельная база в памяти),
// открывает Chrome без окна и проходит основные экраны на телефоне (375 и 390), планшете (768) и компьютере (1280):
// вход, «Сегодня», заказы, карточка заказа, новый заказ, клиенты, карточка клиента, долги, импорт, путь доставки,
// страница клиента по ссылке, кабинет клиента, настройки, «Ещё».
//
// На каждом экране проверяет:
//   • нет ошибок в скриптах и в консоли;
//   • страница не шире экрана (нет прокрутки вбок);
//   • нужный блок действительно виден;
//   • нет кнопок без названия (их не прочитает экранный диктор) и не вылез ключ фразы вместо текста;
//   • на телефоне нет кнопок меньше 24 px (кнопки меньше 44 px считаются и выводятся как замечание).
//
// Chrome ищется сам; другой путь — переменная CHROME_BIN. Нужен Node 22 или новее.
// Код выхода: 0 — всё хорошо, 1 — найдены ошибки, 3 — проверку нельзя выполнить (нет Chrome или старый Node).
// =====================================================
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (n) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "").split("=").slice(1).join("=");
const SHOTS = arg("shots"), ONLY = arg("only"), VERBOSE = process.argv.includes("--verbose");

function cannot(msg) { console.log("⚠️  Экраны НЕ проверены: " + msg); process.exit(3); }
if (typeof WebSocket === "undefined") cannot("нужен Node 22 или новее (сейчас " + process.version + ")");

function findChrome() {
  const list = [process.env.CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/snap/bin/chromium"];
  return list.find((p) => p && fs.existsSync(p));
}
const CHROME = findChrome();
if (!CHROME) cannot("Chrome не найден. Установите Chrome или задайте путь: CHROME_BIN=/путь/к/chrome npm run smoke");

const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kids = [];
let tmp = "";
function cleanup() { kids.forEach((k) => { try { k.kill("SIGKILL"); } catch (e) { /* уже завершён */ } }); if (tmp) try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* ignore */ } }
process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

// ---------- стенд ----------
const port = await freePort();
const stand = spawn(process.execPath, [path.join(ROOT, "tests/browser/server.mjs"), String(port)], { stdio: "ignore" });
kids.push(stand);
const BASE = "http://127.0.0.1:" + port + "/index.html";
for (let i = 0; ; i++) {
  try { const r = await fetch(BASE); if (r.ok) break; } catch (e) { /* ещё не поднялся */ }
  if (i > 50) { console.error("❌ Стенд не запустился (tests/browser/server.mjs)"); process.exit(1); }
  await sleep(100);
}

// ---------- Chrome ----------
tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ula-smoke-"));
const flags = ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + tmp, "--no-first-run", "--no-default-browser-check",
  "--disable-gpu", "--hide-scrollbars", "--disable-extensions", "--disable-background-networking", "--mute-audio", "about:blank"];
if (process.env.CI || process.platform === "linux") flags.unshift("--no-sandbox", "--disable-dev-shm-usage");
const chrome = spawn(CHROME, flags, { stdio: ["ignore", "ignore", "pipe"] });
kids.push(chrome);
const wsUrl = await new Promise((res, rej) => {
  let buf = "";
  const to = setTimeout(() => rej(new Error("Chrome не ответил за 20 секунд")), 20000);
  chrome.stderr.on("data", (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(to); res(m[1]); } });
  chrome.on("exit", () => rej(new Error("Chrome закрылся при запуске")));
}).catch((e) => cannot(e.message));

const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("нет связи с Chrome")); }).catch((e) => cannot(e.message));
let seq = 0;
const waiting = new Map();
const events = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && waiting.has(d.id)) { const w = waiting.get(d.id); waiting.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); }
  else if (d.method) events.push(d);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const cdp = (m, p) => send(m, p, sessionId);
await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Log.enable");
// заставку и обучение показываем один раз в жизни — в проверке они только мешают
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "try{sessionStorage.setItem('ula_intro','1')}catch(e){}" });

async function ev(expression) {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression, what, timeout = 8000) {
  const t0 = Date.now();
  for (;;) {
    let v = false;
    try { v = await ev(expression); } catch (e) { /* страница ещё загружается */ }
    if (v) return true;
    if (Date.now() - t0 > timeout) throw new Error("не дождались: " + what);
    await sleep(60);
  }
}
const visible = (sel) => `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;var r=e.getBoundingClientRect();var s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"})()`;
const click = (sel) => ev(`(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)throw new Error("нет элемента ${sel.replace(/"/g, "'")}");e.click();return true})()`);
async function open(query) {
  events.length = 0;
  await cdp("Page.navigate", { url: BASE + query });
  await waitFor("document.readyState==='complete' && !document.getElementById('boot')", "сайт открылся (" + query + ")", 15000);
  await sleep(150);
}
const tab = async (name) => { await click('.tab[data-tab="' + name + '"]'); await waitFor(visible("#tab-" + name), "раздел " + name); };
const closeModals = () => ev(`(function(){document.querySelectorAll(".modal.open [data-close]").forEach(function(b){b.click()});return true})()`);

// Что измеряем на экране (выполняется внутри страницы)
const MEASURE = `(function(){
  var vw = window.innerWidth, out = { overflow: document.documentElement.scrollWidth - vw, wide: [], nameless: [], tiny: [], small: 0, smallList: [], keys: [] };
  function shown(e){ var r=e.getBoundingClientRect(), s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&s.opacity!=="0"; }
  function onTop(e){ var r=e.getBoundingClientRect(); var x=Math.min(vw-1,Math.max(0,r.left+r.width/2)), y=Math.min(innerHeight-1,Math.max(0,r.top+r.height/2)); if(r.bottom<0||r.top>innerHeight) return false; var t=document.elementFromPoint(x,y); return !!t&&(e===t||e.contains(t)||t.contains(e)); }
  function name(e){ return (e.id?"#"+e.id:e.tagName.toLowerCase()+(e.className&&typeof e.className==="string"?"."+e.className.trim().split(/\\s+/).slice(0,2).join("."):"")); }
  var scope = document.querySelector(".modal.open:last-of-type") || document;
  var open = Array.prototype.slice.call(document.querySelectorAll(".modal.open")); if (open.length) scope = open[open.length-1];
  if (out.overflow > 1) Array.prototype.forEach.call(document.body.querySelectorAll("*"), function(e){ if(out.wide.length<5&&shown(e)){ var r=e.getBoundingClientRect(); if(r.right>vw+1&&r.width<=vw*3&&!e.closest(".chips,.tabs,[data-scroll-x],.table-wrap,.an-chart")) out.wide.push(name(e)+" →"+Math.round(r.right)); } });
  Array.prototype.forEach.call(scope.querySelectorAll("button, a[href], [role=button], input[type=checkbox], input[type=radio], select"), function(e){
    if(!shown(e)||!onTop(e)) return;
    var r=e.getBoundingClientRect();
    if(/^(BUTTON|A)$/.test(e.tagName)||e.getAttribute("role")==="button"){
      var label=(e.getAttribute("aria-label")||e.getAttribute("title")||e.textContent||"").trim();
      if(!label && !e.querySelector("img[alt]:not([alt=''])")) out.nameless.push(name(e));
    }
    if(e.tagName==="A" && getComputedStyle(e).display==="inline") return;   // ссылка внутри текста
    var w=Math.round(r.width),h=Math.round(r.height), lab=e.closest("label"); if(lab){ var lr=lab.getBoundingClientRect(); w=Math.max(w,Math.round(lr.width)); h=Math.max(h,Math.round(lr.height)); }
    if(Math.min(w,h)<24) out.tiny.push(name(e)+" "+Math.round(w)+"×"+Math.round(h)); else if(Math.min(w,h)<44){ out.small++; out.smallList.push(name(e)+" "+Math.round(w)+"×"+Math.round(h)); }
  });
  var tw=document.createTreeWalker(scope===document?document.body:scope, NodeFilter.SHOW_TEXT), n;
  while((n=tw.nextNode())){ var s=n.nodeValue.trim(); if(/^[a-z]{1,6}_[a-z0-9_]{2,}$/.test(s)&&n.parentElement&&!n.parentElement.closest("code,pre,script,style,input,textarea,[data-raw]")&&shown(n.parentElement)) out.keys.push(s); }
  return out;
})()`;

const VIEWPORTS = [
  { id: "375", w: 375, h: 812, phone: true, name: "телефон 375" },
  { id: "390", w: 390, h: 844, phone: true, name: "телефон 390" },
  { id: "768", w: 768, h: 1024, phone: false, name: "планшет 768" },
  { id: "1280", w: 1280, h: 800, phone: false, name: "компьютер 1280" },
].filter((v) => !ONLY || v.id === ONLY);

// Экраны: что открыть и какой блок должен быть виден
const SCREENS = [
  { id: "home", name: "Главная (гость)", go: async () => { await open("?scn=loggedout#/"); }, see: "#view-home .lp-h1" },
  { id: "login", name: "Вход", go: async () => { await open("?scn=loggedout#/login"); }, see: "#view-login" },
  { id: "today", name: "Сегодня", go: async () => { await open("?scn=veteran"); await tab("home"); }, see: "#tab-home" },
  { id: "orders", name: "Список заказов", go: async () => { await tab("orders"); await waitFor(visible("#orders [data-id]"), "карточки заказов"); }, see: "#orders [data-id]" },
  { id: "order-card", name: "Карточка заказа", go: async () => { await click('#orders [data-id] [data-act="open"]'); await waitFor(visible("#modal-detail.open #detail-body .detail"), "карточка заказа"); }, see: "#modal-detail.open .detail", after: closeModals },
  { id: "order-new", name: "Новый заказ", go: async () => { await click("#new-order"); await waitFor(visible("#modal-order.open #order-form"), "форма заказа"); }, see: "#modal-order.open #f-client_name", after: closeModals },
  { id: "clients", name: "Клиенты", go: async () => {
      await tab("clients");
      await waitFor("!document.querySelector('#clients-loading:not(.hidden)')", "клиенты загрузились");
      // на стенде клиенты без адреса: показываем и их («Показать клиентов без адреса»)
      if (!(await ev(visible("#clients .client-row"))) && (await ev(visible("#clients-nocard-btn")))) await click("#clients-nocard-btn");
      await waitFor(visible("#clients .client-row"), "список клиентов");
    }, see: "#clients .client-row" },
  { id: "client-card", name: "Карточка клиента", go: async () => { await click("#clients [data-client-card]"); await waitFor(visible("#modal-clientcard.open .cc-head"), "карточка клиента"); }, see: "#modal-clientcard.open .cc-head", after: closeModals },
  { id: "debts", name: "Долги", go: async () => { await tab("debts"); }, see: "#tab-debts" },
  { id: "import", name: "Импорт", go: async () => { await click("#import-btn"); await waitFor(visible("#modal-import.open #im-file"), "окно импорта"); }, see: "#modal-import.open #im-pick", after: closeModals },
  { id: "settings", name: "Настройки", go: async () => { await click("#settings-btn"); await waitFor(visible("#modal-settings.open"), "настройки"); }, see: "#modal-settings.open .modal-body", after: closeModals },
  { id: "more", name: "«Ещё»", phoneOnly: true, go: async () => { await click("#bn-more"); await waitFor(visible("#section-menu"), "шторка «Все разделы»"); }, see: "#section-menu #sheet-close",
    after: async () => { await click("#sheet-close"); await waitFor("!(" + visible("#section-menu") + ")", "шторка закрылась"); } },
  { id: "track", name: "Путь доставки (байер)", go: async () => { await open("?scn=track"); await tab("orders"); await waitFor(visible("#orders [data-id]"), "заказы"); await click('#orders [data-id] [data-act="open"]'); await waitFor(visible("#modal-detail.open .detail"), "карточка заказа"); }, see: "#modal-detail.open .detail", after: closeModals },
  // раздел «Команда» (файлы 67–68): владелец — задачи, карточка задачи, сотрудники, роли; сотрудник — свои задачи
  { id: "team", name: "Команда: задачи", go: async () => { await open("?scn=team"); await waitFor("document.body.classList.contains('tw-on')", "раздел «Команда» включился"); await tab("team"); await waitFor(visible('[data-tw-view="all"]'), "вкладки раздела «Команда»"); await click('[data-tw-view="all"]'); await waitFor(visible("#tw-body .tw-task"), "задачи команды"); }, see: "#tw-body .tw-task" },
  { id: "team-task", name: "Команда: карточка задачи", go: async () => { await click("#tw-body .tw-task"); await waitFor(visible("#modal-tw-task.open .tw-meta"), "карточка задачи"); }, see: "#modal-tw-task.open .tw-meta", after: closeModals },
  { id: "team-new", name: "Команда: новая задача", go: async () => { await click("#tw-new-task"); await waitFor(visible("#modal-tw-form.open #tw-form-fields input"), "форма задачи"); }, see: "#modal-tw-form.open #tw-form-fields", after: closeModals },
  { id: "team-people", name: "Команда: сотрудники", go: async () => { await click('[data-tw-group="people"]'); await waitFor(visible("#tw-body .tw-row"), "сотрудники"); }, see: "#tw-body .tw-row" },
  { id: "team-roles", name: "Команда: роли", go: async () => { await click('[data-tw-view="roles"]'); await waitFor(visible("#tw-body .tw-perm-list"), "роли"); }, see: "#tw-body .tw-perm-list" },
  { id: "team-order", name: "Команда: заказ с задержкой", go: async () => { await click('[data-tw-group="orders"]'); await waitFor(visible('[data-tw-view="attention"]'), "вкладка «Требуют внимания»"); await click('[data-tw-view="attention"]'); await waitFor(visible("#tw-body .to-order"), "заказы с задержкой"); await click("#tw-body .to-order"); await waitFor(visible("#modal-tw-order.open .to-delay"), "карточка заказа для команды"); }, see: "#modal-tw-order.open .tw-meta", after: closeModals },
  { id: "ops-dash", name: "Операции: сводка", go: async () => { await click('[data-tw-group="ops"]'); await waitFor(visible("#tw-body .op-tiles"), "сводка"); }, see: "#tw-body .op-table" },
  { id: "ops-incident", name: "Операции: инцидент", go: async () => { await click('[data-tw-view="incidents"]'); await waitFor(visible("#tw-body [data-op-inc]"), "инциденты"); await click("#tw-body [data-op-inc]"); await waitFor(visible("#modal-tw-doc.open .tw-meta"), "карточка инцидента"); }, see: "#modal-tw-doc.open .op-events", after: closeModals },
  { id: "ops-calendar", name: "Операции: календарь", go: async () => { await click('[data-tw-view="calendar"]'); await waitFor(visible("#tw-body .op-cal"), "календарь"); }, see: "#tw-body .op-day" },
  { id: "ops-sop", name: "Операции: регламент", go: async () => { await click('[data-tw-view="sops"]'); await waitFor(visible("#tw-body [data-op-sop]"), "регламенты"); await click("#tw-body [data-op-sop]"); await waitFor(visible("#modal-tw-doc.open .op-sop-body"), "регламент"); }, see: "#modal-tw-doc.open .op-acks", after: closeModals },
  { id: "ops-analytics", name: "Отчёты: аналитика", go: async () => { await click('[data-tw-group="reports"]'); await waitFor(visible("#tw-body .rp-chart"), "аналитика"); }, see: "#tw-body .op-table" },
  { id: "team-staff", name: "Команда: сотрудник", go: async () => { await open("?scn=teamstaff"); await waitFor("document.body.classList.contains('tw-on')", "раздел «Команда» включился"); await tab("team"); await waitFor(visible("#tw-body .tw-task"), "мои задачи"); }, see: "#tw-head .tw-me" },
  { id: "team-staff-order", name: "Команда: заказ сотрудника", go: async () => { await click('[data-tw-group="orders"]'); await waitFor(visible("#tw-body .to-order"), "мои заказы"); await click("#tw-body .to-order"); await waitFor(visible("#modal-tw-order.open .tw-meta"), "заказ сотрудника"); }, see: "#modal-tw-order.open .to-ms", after: closeModals },
  { id: "ops-staff", name: "Операции: сотрудник", go: async () => { await click('[data-tw-group="ops"]'); await waitFor(visible("#tw-body [data-op-inc]"), "инциденты сотрудника"); }, see: "#tw-body [data-op-inc]" },
  { id: "public-order", name: "Страница клиента по ссылке", go: async () => { await open("?scn=cab&order=f" + "1".padStart(31, "0")); await waitFor(visible("#view-client"), "страница клиента"); }, see: "#view-client" },
  { id: "public-cabinet", name: "Кабинет клиента", go: async () => { await open("?scn=cab&c=" + "1".repeat(32)); await waitFor(visible("#view-client"), "кабинет клиента"); }, see: "#view-client" },
];

const problems = [], notes = [];
let checked = 0;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

for (const vp of VIEWPORTS) {
  await cdp("Emulation.setDeviceMetricsOverride", { width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.phone });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: vp.phone });
  let smallTotal = 0;
  for (const sc of SCREENS) {
    if (sc.phoneOnly && !vp.phone) continue;
    const where = vp.name + " · " + sc.name;
    try {
      await sc.go();
      await waitFor(visible(sc.see), "виден блок " + sc.see);
      await sleep(250);   // дорисовка и переходы
      const m = await ev(MEASURE);
      checked++;
      const errs = events.filter((e) => e.method === "Runtime.exceptionThrown").map((e) => (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text).split("\n")[0])
        .concat(events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error").map((e) => "console.error: " + e.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 160)))
        .concat(events.filter((e) => e.method === "Log.entryAdded" && e.params.entry.level === "error" && !/favicon/.test(e.params.entry.url || "")).map((e) => "ошибка загрузки: " + e.params.entry.text.slice(0, 120) + " " + (e.params.entry.url || "")));
      events.length = 0;
      [...new Set(errs)].forEach((x) => problems.push(where + " — " + x));
      if (m.overflow > 1) problems.push(where + " — страница шире экрана на " + m.overflow + " px" + (m.wide.length ? ": " + m.wide.join(", ") : ""));
      if (m.nameless.length) problems.push(where + " — кнопки без названия: " + [...new Set(m.nameless)].slice(0, 5).join(", "));
      if (m.keys.length) problems.push(where + " — вместо текста виден ключ фразы: " + [...new Set(m.keys)].slice(0, 5).join(", "));
      if (vp.phone && m.tiny.length) problems.push(where + " — кнопки меньше 24 px: " + [...new Set(m.tiny)].slice(0, 5).join(", "));
      if (vp.phone) { smallTotal += m.small; if (VERBOSE && m.small) notes.push(where + " — кнопок меньше 44 px: " + m.small + " (" + [...new Set(m.smallList)].slice(0, 12).join(", ") + ")"); }
      if (SHOTS) {
        const shot = await cdp("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(path.join(SHOTS, vp.id + "-" + sc.id + ".png"), Buffer.from(shot.data, "base64"));
      }
    } catch (e) {
      problems.push(where + " — " + e.message.split("\n")[0]);
      events.length = 0;
    }
    try { if (sc.after) await sc.after(); } catch (e) { problems.push(where + " — не закрылось: " + e.message.split("\n")[0]); }
  }
  console.log("   " + (problems.some((p) => p.startsWith(vp.name)) ? "✗" : "✓") + " " + vp.name + (vp.phone ? " (кнопок меньше 44 px: " + smallTotal + ")" : ""));
}

try { ws.close(); } catch (e) { /* ignore */ }
if (notes.length) console.log(notes.map((n) => "   · " + n).join("\n"));
if (problems.length) {
  console.error("❌ Экраны: найдено проблем — " + problems.length + "\n  • " + problems.join("\n  • "));
  process.exit(1);
}
console.log("🎉 Экраны: проверено " + checked + " (" + VIEWPORTS.map((v) => v.id).join(", ") + " px) — ошибок нет" + (SHOTS ? ". Снимки: " + SHOTS : ""));
process.exit(0);
