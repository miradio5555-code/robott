// =====================================================
// ПРОВЕРКА САЙТА ULA Factory — запускать перед публикацией (и сама запускается на GitHub).
//
//   node tests/check_web.js
//
// Что проверяет:
//   1. Все скрипты сайта без ошибок синтаксиса.
//   2. В четырёх словарях (ru, en, zh, vi) одинаковый набор фраз — ни одна не забыта.
//   3. Версия везде одна: все ?v= в index.html и APP_VERSION в app.js.
//      Иначе у части людей останется старый файл из памяти телефона.
//   4. Каждый скрипт и стиль, подключённый в index.html, есть в папке.
//   5. Номера миграций без повторов и пропусков, отметка в schema_migrations совпадает с файлом.
// =====================================================
"use strict";
var fs = require("fs"), path = require("path"), vm = require("vm");
var root = path.join(__dirname, "..");
var fails = [];
function fail(msg) { fails.push(msg); }
function read(f) { return fs.readFileSync(path.join(root, f), "utf8"); }

// 1. синтаксис
var scripts = ["app.js", "config.js", "sw.js", "i18n.js"]
  .concat(fs.readdirSync(root).filter(function (f) { return /^i18n\.\w+\.js$/.test(f); }))
  .concat(fs.readdirSync(path.join(root, "js")).filter(function (f) { return /\.js$/.test(f); }).map(function (f) { return "js/" + f; }));
scripts.forEach(function (f) {
  try { new vm.Script(read(f), { filename: f }); } catch (e) { fail("Синтаксис " + f + ": " + e.message); }
});

// 2. словари
var LANGS = ["ru", "en", "zh", "vi"], ctx = { I18N: {} };
vm.createContext(ctx);
LANGS.forEach(function (l) {
  try { vm.runInContext(read("i18n." + l + ".js"), ctx); } catch (e) { fail("Словарь " + l + ": " + e.message); }
});
var base = Object.keys(ctx.I18N.ru || {});
LANGS.slice(1).forEach(function (l) {
  var d = ctx.I18N[l] || {};
  var miss = base.filter(function (k) { return !(k in d); });
  var extra = Object.keys(d).filter(function (k) { return !(k in ctx.I18N.ru); });
  if (miss.length) fail("В словаре " + l + " нет фраз: " + miss.slice(0, 20).join(", "));
  if (extra.length) fail("В словаре " + l + " лишние фразы (нет в ru): " + extra.slice(0, 20).join(", "));
});

// 3. версия
var html = read("index.html");
var app = /APP_VERSION\s*=\s*"([^"]+)"/.exec(read("app.js"));
var vers = {};
(html.match(/\?v=[0-9a-zA-Z]+/g) || []).forEach(function (v) { vers[v.slice(3)] = 1; });
var list = Object.keys(vers);
if (!app) fail("В app.js нет APP_VERSION");
else if (list.length !== 1 || list[0] !== app[1]) fail("Разные версии: index.html " + list.join(", ") + " / app.js " + app[1]);

// 4. подключённые файлы на месте
var re = /(?:src|href)="([^"?#]+)(?:\?v=[^"]*)?"/g, m;
while ((m = re.exec(html))) {
  var u = m[1];
  if (/^(https?:|data:|mailto:)/.test(u) || !/\.(js|css|webmanifest|png|svg|woff2)$/.test(u)) continue;
  if (!fs.existsSync(path.join(root, u))) fail("index.html подключает " + u + ", а файла нет");
}

// 5. нумерация миграций (без Docker): номера не повторяются и идут без пропусков,
//    каждый файл в конце ставит отметку о себе в schema_migrations со своим номером и именем.
//    Так ловится переименование вроде истории с файлами 52–55 ещё до запуска SQL.
var migs = fs.readdirSync(root).filter(function (f) { return /^migration_\d+_.+\.sql$/.test(f); });
var seen = {};
migs.forEach(function (f) {
  var n = parseInt(/^migration_(\d+)_/.exec(f)[1], 10);
  if (seen[n]) fail("Два файла с номером " + n + ": " + seen[n] + " и " + f);
  seen[n] = f;
  var sql = read(f).replace(/\s+/g, "");
  if (sql.indexOf("schema_migrations(version,name)values(" + n + ",'" + f + "')") < 0)
    fail(f + ": нет отметки в schema_migrations с номером " + n + " и этим именем файла");
});
var nums = Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
for (var i = 1; i <= nums[nums.length - 1]; i++) if (!seen[i]) fail("Пропущен номер миграции " + i);
if (read("supabase_schema.sql").replace(/\s+/g, "").indexOf("schema_migrations(version,name)values(0,'supabase_schema.sql')") < 0)
  fail("supabase_schema.sql: нет отметки с номером 0");

if (fails.length) {
  console.error("❌ Найдены ошибки:\n  • " + fails.join("\n  • "));
  process.exit(1);
}
console.log("✅ Сайт: " + scripts.length + " скриптов, " + base.length + " фраз × " + LANGS.length + " языка, версия " + app[1] + ", миграций " + migs.length + " (0–" + nums[nums.length - 1] + ")");
