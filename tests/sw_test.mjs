// =====================================================
// ПРОВЕРКА «ПРИЛОЖЕНИЯ» (sw.js): сайт открывается из памяти, обновляется в фоне, память не растёт.
//
//   node tests/sw_test.mjs
//
// Настоящий sw.js запускается здесь с поддельными «памятью браузера» и «сетью» — без браузера и без интернета.
// Проверяет: первая установка, обновление версии (старая версия остаётся для открытой вкладки, всё старше — удаляется),
// работу без сети, неудачное обновление (ничего не теряется), шрифты и картинки без версии, запросы мимо памяти.
// =====================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCOPE = "https://site.test/robott/";
let passed = 0;
const ok = (cond, name) => { if (!cond) { console.error("❌ " + name); process.exit(1); } passed++; console.log("   ✓ " + name); };

// ---------- поддельный сайт ----------
const site = { version: "A", online: true, missing: new Set(), fonts: { "fonts/inter.woff2": "font-1", "img/icon-192.png": "icon-1" }, hits: [] };
const pageHtml = (v) => `<html><head><link rel="stylesheet" href="style.css?v=${v}"><link rel="manifest" href="manifest.webmanifest"></head>` +
  `<body><img src="img/icon-192.png"><script src="app.js?v=${v}"></script><script src="js/pwa.js?v=${v}"></script><script src="supabase.js"></script></body></html>`;
function siteFetch(input) {
  const url = new URL(typeof input === "string" ? input : input.url, SCOPE);
  site.hits.push(url.href);
  if (!site.online) return Promise.reject(new TypeError("offline"));
  const rel = url.pathname.replace("/robott/", "");
  if (site.missing.has(rel)) return Promise.resolve(new Response("nope", { status: 404 }));
  if (rel === "" || rel === "index.html") return Promise.resolve(new Response(pageHtml(site.version), { status: 200 }));
  if (rel in site.fonts) return Promise.resolve(new Response(site.fonts[rel], { status: 200 }));
  return Promise.resolve(new Response(rel + "@" + (url.searchParams.get("v") || "-"), { status: 200 }));
}

// ---------- поддельная память браузера ----------
class FakeCache {
  constructor() { this.m = new Map(); }
  key(r) { return new URL(typeof r === "string" ? r : r.url, SCOPE).href; }
  async match(r) { const x = this.m.get(this.key(r)); return x ? x.clone() : undefined; }
  async put(r, res) { this.m.set(this.key(r), res); }
  async delete(r) { return this.m.delete(this.key(r)); }
  async keys() { return [...this.m.keys()].map((url) => ({ url })); }
  async addAll(list) {
    const got = await Promise.all(list.map(async (u) => { const r = await siteFetch(u); if (!r.ok) throw new TypeError("addAll " + u); return [u, r]; }));
    got.forEach(([u, r]) => this.m.set(this.key(u), r));
  }
}
const store = new Map();
const caches = {
  open: async (n) => { if (!store.has(n)) store.set(n, new FakeCache()); return store.get(n); },
  keys: async () => [...store.keys()],
  delete: async (n) => store.delete(n),
};

// ---------- запуск настоящего sw.js ----------
const handlers = {};
const messages = [];
const self = {
  addEventListener: (t, fn) => { handlers[t] = fn; },
  skipWaiting: async () => {},
  location: { origin: "https://site.test" },
  registration: { scope: SCOPE, showNotification: async () => {} },
  clients: { claim: async () => {}, get: async () => ({ postMessage: (m) => messages.push(m) }), matchAll: async () => [], openWindow: async () => {} },
};
const ctx = vm.createContext({ self, caches, fetch: siteFetch, URL, Response, Request, Promise, console });
vm.runInContext(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"), ctx, { filename: "sw.js" });

async function fire(type, extra = {}) {
  const waits = [];
  let answer = null;
  const ev = { waitUntil: (p) => waits.push(p), respondWith: (p) => { answer = p; }, ...extra };
  handlers[type](ev);
  const res = answer ? await answer : null;
  await Promise.all(waits);
  return res;
}
const navigate = () => fire("fetch", { request: { method: "GET", url: SCOPE + "?o=abc", mode: "navigate" }, clientId: "tab1" });
const asset = (rel) => fire("fetch", { request: { method: "GET", url: SCOPE + rel, mode: "no-cors" } });
const cache = () => store.get("ula-v1");
const cached = () => [...cache().m.keys()].map((u) => u.replace(SCOPE, "")).sort();
const versions = () => [...new Set(cached().map((u) => (/v=(\w+)/.exec(u) || [])[1]).filter(Boolean))].sort().join(",");

console.log("▶ Память «приложения» (sw.js)");

// 1. первая установка
await fire("install");
await fire("activate");
ok(cached().includes("") && cached().includes("app.js?v=A") && cached().includes("style.css?v=A") && cached().includes("supabase.js"),
  "установка: страница и все её файлы сохранены");

// шрифт подгружается со страницы и запоминается
await asset("fonts/inter.woff2");
ok(cached().includes("fonts/inter.woff2"), "шрифт запоминается при первом обращении");

// 2. вышла версия B: человек видит прежнюю страницу сразу, новая скачивается в фоне
site.version = "B";
let res = await navigate();
ok((await res.text()).includes("app.js?v=A"), "обновление: страница открыта из памяти мгновенно (прежняя версия)");
ok((await (await cache().match("./")).text()).includes("app.js?v=B"), "обновление: в памяти уже новая страница");
ok(versions() === "A,B", "обновление: файлы предыдущей версии оставлены для открытой вкладки (" + versions() + ")");
ok(messages.length === 1 && messages[0].type === "ula-update" && messages[0].version === "B", "вкладке отправлено «вышло обновление»");

// 3. вышла версия C: версия A больше не нужна
site.version = "C";
site.fonts["img/icon-192.png"] = "icon-2";            // картинку заменили под тем же именем
site.missing.add("fonts/inter.woff2");                 // а шрифт с сайта убрали
await navigate();
ok(versions() === "B,C", "память не растёт: версия A удалена, остались B и C (" + versions() + ")");
ok(!cached().some((u) => /v=A/.test(u)), "ни одного файла версии A не осталось");
ok((await (await cache().match("img/icon-192.png")).text()) === "icon-2", "картинка без версии обновилась");
ok(!cached().includes("fonts/inter.woff2"), "файл, которого больше нет на сайте, удалён из памяти");
site.missing.clear();

// 4. без сети: сайт открывается, ничего не удаляется
const before = cached().join("|");
site.online = false;
res = await navigate();
ok(res.status === 200 && (await res.text()).includes("app.js?v=C"), "без сети: страница открывается из памяти");
res = await asset("app.js?v=C");
ok(res.status === 200, "без сети: файлы сайта отдаются из памяти");
ok(cached().join("|") === before, "без сети: из памяти ничего не пропало");
site.online = true;

// 5. неудачное обновление: один файл новой версии не скачался → остаёмся на прежней целиком
site.version = "D";
site.missing.add("js/pwa.js");
const msgs = messages.length;
await navigate();
ok((await (await cache().match("./")).text()).includes("app.js?v=C"), "сбой обновления: сохранённая страница осталась прежней");
ok(cached().includes("app.js?v=C") && cached().includes("js/pwa.js?v=C"), "сбой обновления: файлы рабочей версии на месте");
ok(messages.length === msgs, "сбой обновления: «вышло обновление» не показано");
site.missing.clear();
await navigate();
ok(versions() === "C,D", "после исправления обновление проходит (" + versions() + ")");

// 6. новая копия sw.js: остаются файлы только текущей страницы
await fire("install");
await fire("activate");
ok(versions() === "D", "новая копия sw.js: оставлена только текущая версия (" + versions() + ")");

// 7. данные не кешируются
let touched = false;
handlers.fetch({ request: { method: "GET", url: "https://abc.supabase.co/rest/v1/orders", mode: "cors" }, respondWith: () => { touched = true; }, waitUntil: () => {} });
handlers.fetch({ request: { method: "POST", url: SCOPE + "app.js?v=D", mode: "cors" }, respondWith: () => { touched = true; }, waitUntil: () => {} });
handlers.fetch({ request: { method: "GET", url: SCOPE + "terms.html", mode: "navigate" }, respondWith: () => { touched = true; }, waitUntil: () => {} });
ok(!touched, "запросы к базе, отправка данных и другие страницы идут мимо памяти");
ok(!cached().some((u) => /supabase\.co|rest\/v1/.test(u)), "данных кабинета в памяти нет");

// 8. правило удаления само по себе
const stale = vm.runInContext("staleUrls", ctx)(["a.js?v=1", "b.css?v=2", "fonts/x.woff2", "c.js?v=3", "d.js?x=1&v=1"], ["2", "3"]);
ok(stale.join(",") === "a.js?v=1,d.js?x=1&v=1", "удаляются только файлы с версией не из списка; файлы без версии не трогаются");

console.log("🎉 Память «приложения»: проверок пройдено — " + passed);
