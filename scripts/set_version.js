// =====================================================
// СМЕНИТЬ ВЕРСИЮ САЙТА сразу во всех местах.
//
//   node scripts/set_version.js 20261217a        (или: npm run version:set -- 20261217a)
//
// Версия — это «?v=…» у каждого файла в index.html, privacy.html, terms.html, APP_VERSION в app.js
// и строка в RELEASE_CHECKLIST.md. Она должна быть одна и та же везде: по ней телефон понимает,
// что вышло обновление (sw.js читает её из index.html). Менять при каждой публикации сайта.
// После запуска: node tests/check_web.js
// =====================================================
"use strict";
var fs = require("fs"), path = require("path");
var root = path.join(__dirname, "..");
var next = process.argv[2];
if (!/^20\d{6}[a-z]{0,3}$/.test(next || "")) {
  console.error("Укажите версию: дата и буква, например 20261217a");
  process.exit(2);
}
function edit(f, fn) {
  var p = path.join(root, f), before = fs.readFileSync(p, "utf8"), after = fn(before);
  if (after !== before) fs.writeFileSync(p, after);
  return after !== before;
}
var cur = /APP_VERSION\s*=\s*"([^"]+)"/.exec(fs.readFileSync(path.join(root, "app.js"), "utf8"));
if (!cur) { console.error("В app.js нет APP_VERSION"); process.exit(1); }
var changed = [];
["index.html", "privacy.html", "terms.html"].forEach(function (f) {
  if (edit(f, function (s) { return s.replace(/\?v=[0-9a-zA-Z]+/g, "?v=" + next); })) changed.push(f);
});
if (edit("app.js", function (s) { return s.replace(/(APP_VERSION\s*=\s*")[^"]+(")/, "$1" + next + "$2"); })) changed.push("app.js");
if (edit("RELEASE_CHECKLIST.md", function (s) { return s.split("`" + cur[1] + "`").join("`" + next + "`"); })) changed.push("RELEASE_CHECKLIST.md");
console.log("Версия сайта: " + cur[1] + " → " + next + (changed.length ? " (" + changed.join(", ") + ")" : " (уже стояла)"));
console.log("Дальше: npm run check");
