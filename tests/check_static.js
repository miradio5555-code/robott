// =====================================================
// СТАТИЧЕСКИЙ АНАЛИЗ САЙТА ULA Factory — без сторонних пакетов и без переформатирования кода.
//
//   node tests/check_static.js
//
// Ловит ошибки, которые не видны ни по синтаксису, ни по сравнению словарей:
//   1. Одна и та же фраза объявлена в словаре дважды (вторая молча затирает первую).
//   2. Сайт просит фразу, которой нет в словаре: t("…") в скриптах и data-i18n… в index.html
//      (на экране вместо текста появилось бы имя ключа).
//   3. Скрипт обращается к элементу $("#…"), которого нет ни в index.html, ни в разметке, создаваемой скриптами
//      (ошибка «Cannot read properties of null» при открытии раздела).
//   4. В index.html два элемента с одним id.
//   5. Скрипт подключён в index.html дважды или лежит в js/, но не подключён.
//   6. В окнах сайта нет английских подписей для экранного диктора (aria-label="Close").
// =====================================================
"use strict";
var fs = require("fs"), path = require("path"), vm = require("vm");
var root = path.join(__dirname, "..");
var fails = [], notes = [];
function read(f) { return fs.readFileSync(path.join(root, f), "utf8"); }
function fail(m) { fails.push(m); }

var LANGS = ["ru", "en", "zh", "vi"];
var jsFiles = ["app.js"].concat(fs.readdirSync(path.join(root, "js")).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return "js/" + f; }));
var html = read("index.html");

// ---------- 1. повторы ключей в словаре ----------
// Проходим по тексту файла: строки и комментарии пропускаем, на первом уровне скобок собираем «имя:».
function topKeys(src) {
  var keys = [], depth = 0, i = 0, n = src.length, start = src.indexOf("{");
  if (start < 0) return keys;
  for (i = start; i < n; i++) {
    var ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      var q = ch, j = i + 1;
      while (j < n && src[j] !== q) { if (src[j] === "\\") j++; j++; }
      // ключ в кавычках: "имя": …
      if (depth === 1 && /^\s*:/.test(src.slice(j + 1, j + 4))) keys.push({ k: src.slice(i + 1, j), at: i });
      i = j;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (ch === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 1; if (i <= 0) break; continue; }
    if (ch === "{" || ch === "[" || ch === "(") { depth++; continue; }
    if (ch === "}" || ch === "]" || ch === ")") { depth--; if (depth === 0) break; continue; }
    if (depth === 1 && /[A-Za-z_$]/.test(ch) && !/[\w$]/.test(src[i - 1] || "")) {
      var m = /^[\w$]+/.exec(src.slice(i));
      if (m && /^\s*:/.test(src.slice(i + m[0].length, i + m[0].length + 4))) keys.push({ k: m[0], at: i });
      i += m ? m[0].length - 1 : 0;
    }
  }
  return keys;
}
function lineOf(src, at) { return src.slice(0, at).split("\n").length; }

var dict = {};
var ctx = { I18N: {} };
vm.createContext(ctx);
LANGS.forEach(function (l) {
  var f = "i18n." + l + ".js", src = read(f), seen = {};
  topKeys(src).forEach(function (x) {
    if (seen[x.k]) fail(f + ":" + lineOf(src, x.at) + " — фраза «" + x.k + "» уже объявлена в строке " + seen[x.k] + " (вторая затирает первую)");
    else seen[x.k] = lineOf(src, x.at);
  });
  // дописанные ниже словаря строки вида I18N.ru.ключ = "…" не должны затирать фразу из словаря
  var re = new RegExp("^I18N\\." + l + "\\.([\\w$]+)\\s*=", "gm"), m;
  while ((m = re.exec(src))) {
    if (seen[m[1]]) fail(f + ":" + lineOf(src, m.index) + " — фраза «" + m[1] + "» уже объявлена в строке " + seen[m[1]]);
    else seen[m[1]] = lineOf(src, m.index);
  }
  try { vm.runInContext(src, ctx); } catch (e) { fail(f + ": " + e.message); }
});
dict = ctx.I18N.ru || {};

// ---------- 2. фразы, которых нет в словаре ----------
// Только цельные ключи: t("ключ") и t("ключ", {…}). Составные — t("status_" + s) — так не проверить.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, function (m) { return m.replace(/[^\n]/g, " "); })
            .replace(/(^|[^:"'\\])\/\/[^\n]*/g, function (m, a) { return a + m.slice(a.length).replace(/./g, " "); });
}
var used = {};
jsFiles.forEach(function (f) {
  if (f === "js/qrcode.js" || f === "js/inbox.js") return;   // сторонняя библиотека; у «Сообщений» свой словарь внутри файла
  var src = stripComments(read(f)), re = /(?:^|[^\w$.])t\(\s*(["'])([a-zA-Z0-9_]+)\1\s*[,)]/g, m;
  while ((m = re.exec(src))) {
    used[m[2]] = 1;
    if (!(m[2] in dict)) fail(f + ":" + lineOf(src, m.index) + " — фразы «" + m[2] + "» нет в словаре");
  }
});
["index.html"].forEach(function (f) {
  var re = /data-i18n(?:-title|-placeholder)?="([^"]+)"/g, m;
  while ((m = re.exec(html))) {
    used[m[1]] = 1;
    if (!(m[1] in dict)) fail(f + ":" + lineOf(html, m.index) + " — фразы «" + m[1] + "» нет в словаре");
  }
});

// ---------- 3. обращения к элементам, которых нет ----------
var ids = {}, dupIds = {};
(html.match(/\sid="([^"]+)"/g) || []).forEach(function (x) {
  var id = /id="([^"]+)"/.exec(x)[1];
  if (ids[id]) dupIds[id] = 1;
  ids[id] = 1;
});
// id, которые скрипты создают сами: id="…" внутри строк, el.id = "…", setAttribute("id", "…")
var allJs = jsFiles.map(function (f) { return read(f); }).join("\n");
(allJs.match(/id=\\?["']([\w-]+)\\?["']/g) || []).forEach(function (x) { ids[/([\w-]+)\\?["']$/.exec(x)[1]] = 1; });
(allJs.match(/\.id\s*=\s*["']([\w-]+)["']/g) || []).forEach(function (x) { ids[/["']([\w-]+)["']/.exec(x)[1]] = 1; });
(allJs.match(/setAttribute\(\s*["']id["']\s*,\s*["']([\w-]+)["']/g) || []).forEach(function (x) { ids[/,\s*["']([\w-]+)["']/.exec(x)[1]] = 1; });
// id, собранные из частей: "cd-" + key  или  id="' + id + '-cny"  — запоминаем начало и конец
var prefixes = {}, suffixes = {};
(allJs.match(/["']([a-z][\w]*-)["']\s*\+/g) || []).forEach(function (x) { prefixes[/["']([\w-]+)["']/.exec(x)[1]] = 1; });
(allJs.match(/\+\s*["'](-[\w-]+)\\?["']/g) || []).forEach(function (x) { suffixes[/["'](-[\w-]+)/.exec(x)[1]] = 1; });
function dynamicId(id) {
  return Object.keys(prefixes).some(function (p) { return id.indexOf(p) === 0; }) ||
         Object.keys(suffixes).some(function (x) { return id.slice(-x.length) === x; });
}
// Элементы, которых может не быть (скрипт проверяет это сам: var el = $("#…"); if (el) …)
var OPTIONAL_IDS = { "brand-ws": 1 };   // название кабинета в шапке: убрано из разметки, функция оставлена
jsFiles.forEach(function (f) {
  if (f === "js/qrcode.js") return;
  var src = stripComments(read(f)), re = /(?:\$|getElementById|querySelector)\(\s*(["'])#?([\w-]+)\1\s*\)/g, m;
  while ((m = re.exec(src))) {
    var isId = /getElementById/.test(m[0]) || m[0].indexOf("#") !== -1;
    if (isId && !ids[m[2]] && !OPTIONAL_IDS[m[2]] && !dynamicId(m[2])) fail(f + ":" + lineOf(src, m.index) + " — элемента с id «" + m[2] + "» нет в index.html");
  }
});

// ---------- 4. повторы id ----------
Object.keys(dupIds).forEach(function (id) { fail("index.html — два элемента с id «" + id + "»"); });

// ---------- 5. подключение скриптов ----------
var linked = {}, re5 = /<script[^>]+src="([^"?]+)/g, m5;
while ((m5 = re5.exec(html))) {
  if (linked[m5[1]]) fail("index.html — скрипт " + m5[1] + " подключён дважды");
  linked[m5[1]] = 1;
}
// Подключаются не сразу, а когда понадобятся (скрипт сам добавляет <script>)
var LAZY = { "js/qrcode.js": "js/tools.js" };   // QR-коды для этикеток
jsFiles.forEach(function (f) {
  if (linked[f]) return;
  if (LAZY[f] && read(LAZY[f]).indexOf(f) !== -1) return;
  fail(f + " лежит в папке сайта, но не подключён в index.html");
});

// ---------- 6. подписи для экранного диктора ----------
var enRe = /aria-label=\\?"(Close|Open|Menu|Search|Back|Previous|Next|Delete|Edit)\\?"/g;
var en = (html.match(enRe) || []).length;
if (en) fail("index.html — " + en + " подписей aria-label на английском (Close…): замените на data-i18n-title, чтобы диктор читал на языке человека");
jsFiles.forEach(function (f) {
  var n = (read(f).match(enRe) || []).length;
  if (n) fail(f + " — " + n + " подписей aria-label на английском: используйте esc(t(\"close\"))");
});

if (fails.length) {
  console.error("❌ Статический анализ: найдено замечаний — " + fails.length + "\n  • " + fails.slice(0, 60).join("\n  • ") + (fails.length > 60 ? "\n  … и ещё " + (fails.length - 60) : ""));
  process.exit(1);
}
console.log("✅ Статический анализ: " + jsFiles.length + " скриптов, " + Object.keys(used).length + " фраз в использовании, " +
  Object.keys(ids).length + " элементов с id — замечаний нет" + (notes.length ? "\n" + notes.join("\n") : ""));
