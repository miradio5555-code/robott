// =====================================================
// СНИМКИ ЭКРАНОВ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ (блок «Так выглядит кабинет», img/lp/).
//
//   node scripts/landing_shots.mjs
//
// Сам запускает стенд (tests/browser/server.mjs, сценарий demo: выдуманный кабинет «Silk Road Cargo» за год)
// и Chrome без окна, снимает настоящие экраны программы в светлой и тёмной теме и сохраняет их в img/lp/*.webp.
// Ещё снимает карточку ссылки для WhatsApp и Telegram (scripts/og-card.html → img/og.jpg).
// Настоящая база не нужна и не используется. Запускать заново после заметных изменений вида кабинета.
// Chrome ищется сам; другой путь — переменная CHROME_BIN. Нужен Node 22 или новее.
// =====================================================
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "img/lp");
const DEMO_TOKEN = "d".repeat(32);   // то же, что DEMO_TOKEN в tests/browser/server.mjs

const CHROME = [process.env.CHROME_BIN, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find((p) => p && fs.existsSync(p));
if (!CHROME) { console.error("Chrome не найден: задайте CHROME_BIN"); process.exit(3); }
if (typeof WebSocket === "undefined") { console.error("Нужен Node 22 или новее"); process.exit(3); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
const kids = [];
let tmp = "";
process.on("exit", () => { kids.forEach((k) => { try { k.kill("SIGKILL"); } catch (e) { /* уже завершён */ } }); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

// ---------- стенд ----------
const port = await freePort();
kids.push(spawn(process.execPath, [path.join(ROOT, "tests/browser/server.mjs"), String(port)], { stdio: "ignore" }));
const BASE = "http://127.0.0.1:" + port + "/index.html";
for (let i = 0; ; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch (e) { /* ещё не поднялся */ }
  if (i > 50) { console.error("Стенд не запустился"); process.exit(1); }
  await sleep(100);
}

// ---------- Chrome ----------
tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ula-shots-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + tmp, "--no-first-run", "--no-default-browser-check",
  "--hide-scrollbars", "--disable-extensions", "--mute-audio", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
kids.push(chrome);
const wsUrl = await new Promise((res, rej) => {
  let buf = "";
  chrome.stderr.on("data", (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) res(m[1]); });
  setTimeout(() => rej(new Error("Chrome не ответил")), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise((res) => { ws.onopen = res; });
let seq = 0;
const waiting = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { const w = waiting.get(d.id); waiting.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); } };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const cdp = (m, p) => send(m, p, sessionId);
await cdp("Page.enable"); await cdp("Runtime.enable");

async function ev(expression) {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function waitFor(expression, what, timeout = 10000) {
  const t0 = Date.now();
  for (;;) {
    try { if (await ev(expression)) return; } catch (e) { /* загружается */ }
    if (Date.now() - t0 > timeout) throw new Error("не дождались: " + what);
    await sleep(80);
  }
}
const visible = (sel) => `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;var r=e.getBoundingClientRect();return r.width>0&&r.height>0})()`;

// заставка, обучение, всплывающие подсказки и значки игры на снимке не нужны
const QUIET = `(function(){try{sessionStorage.setItem('ula_intro','1');localStorage.setItem('cc_lang','ru');}catch(e){}
  var s=document.createElement('style');s.textContent='.toast,.gm-sum,.tour,.tour-pop,.onboard-card,#home-news,.pwa-banner,.update-banner{display:none!important}*{animation:none!important;transition:none!important;caret-color:transparent!important}';
  document.documentElement.appendChild(s);})()`;

const SHOTS = [
  { id: "orders", w: 1280, h: 800, phone: false, query: "?scn=demo", prep: `document.querySelector('.tab[data-tab="orders"]').click()`, see: "#orders [data-id]" },
  { id: "analytics", w: 1280, h: 800, phone: false, query: "?scn=demo", prep: `document.querySelector('.tab[data-tab="analytics"]').click()`, see: "#tab-analytics .an-hero, #tab-analytics" },
  { id: "client", w: 390, h: 844, phone: true, query: "?scn=demo&order=" + DEMO_TOKEN, prep: "1", see: "#view-client" },
];

fs.mkdirSync(OUT, { recursive: true });
for (const theme of ["light", "dark"]) {
  const boot = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem('cc_theme','${theme}')}catch(e){}` + ";document.addEventListener('DOMContentLoaded',function(){" + QUIET + "})" });
  for (const s of SHOTS) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: 2, mobile: s.phone });
    await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: theme }, { name: "prefers-reduced-motion", value: "reduce" }] });
    await cdp("Page.navigate", { url: BASE + s.query });
    await waitFor("document.readyState==='complete' && !document.getElementById('boot')", "сайт открылся");
    await sleep(500);
    await ev(s.prep);
    await waitFor(visible(s.see.split(",")[0]) + "||" + visible(s.see.split(",").pop().trim()), s.id);
    await sleep(900);   // дорисовка графиков и шрифтов
    await ev("window.scrollTo(0,0)");
    const shot = await cdp("Page.captureScreenshot", { format: "webp", quality: 82 });
    const file = path.join(OUT, s.id + "-" + theme + ".webp");
    fs.writeFileSync(file, Buffer.from(shot.data, "base64"));
    console.log("✓ " + path.relative(ROOT, file) + " (" + Math.round(fs.statSync(file).size / 1024) + " КБ)");
  }
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: boot.identifier });
}
// карточка ссылки для мессенджеров: 1200×630, JPEG (WhatsApp берёт картинки до ~300 КБ)
await cdp("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: "http://127.0.0.1:" + port + "/scripts/og-card.html" });
await waitFor("document.readyState==='complete' && document.fonts.status==='loaded'", "карточка ссылки");
await sleep(400);
const og = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 88 });
fs.writeFileSync(path.join(ROOT, "img/og.jpg"), Buffer.from(og.data, "base64"));
console.log("✓ img/og.jpg (" + Math.round(fs.statSync(path.join(ROOT, "img/og.jpg")).size / 1024) + " КБ)");

try { ws.close(); } catch (e) { /* ignore */ }
process.exit(0);
