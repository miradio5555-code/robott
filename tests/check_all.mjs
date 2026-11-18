// =====================================================
// ВСЕ БЫСТРЫЕ ПРОВЕРКИ ULA Factory ОДНОЙ КОМАНДОЙ (без Docker и без браузера).
//
//   npm run check          (то же: node tests/check_all.mjs)
//   npm run check -- --only=web,static      только выбранные шаги
//
// Каждая проверка запускается отдельно, даже если предыдущая упала: в конце — общий список,
// что прошло и что нет, с текстом ошибки. Ничего не публикует и рабочую базу не трогает.
// Не входят сюда (дольше и требуют программ): база — npm run test:db (Docker),
// экраны — npm run smoke (Chrome), мобильная копия — npm run mobile:check.
// =====================================================
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shFiles = ["mobile/copy-web.sh", "scripts/make_backup.sh", "scripts/release_check.sh"]
  .concat(fs.readdirSync(path.join(ROOT, "tests")).filter((f) => f.endsWith(".sh")).map((f) => "tests/" + f));
const mjsFiles = fs.readdirSync(path.join(ROOT, "scripts")).filter((f) => /\.(mjs|js)$/.test(f)).map((f) => "scripts/" + f)
  .concat(fs.readdirSync(path.join(ROOT, "tests")).filter((f) => /\.(mjs|js)$/.test(f)).map((f) => "tests/" + f))
  .concat(fs.readdirSync(path.join(ROOT, "tests/browser")).filter((f) => /\.(mjs|js)$/.test(f)).map((f) => "tests/browser/" + f));

const STEPS = [
  { id: "web", name: "Сайт: синтаксис, словари, версия, файлы базы, документы", cmd: ["node", "tests/check_web.js"] },
  { id: "static", name: "Статический анализ: фразы, элементы, подписи", cmd: ["node", "tests/check_static.js"] },
  { id: "sw", name: "Память «приложения» (sw.js)", cmd: ["node", "tests/sw_test.mjs"] },
  { id: "orders", name: "Шаблоны и повтор заказа", cmd: ["node", "tests/templates_test.mjs"] },
  { id: "clients", name: "Карточка клиента", cmd: ["node", "tests/clientcard_test.mjs"] },
  { id: "tracking", name: "Путь заказа", cmd: ["node", "tests/tracking_test.mjs"] },
  { id: "whatsapp", name: "WhatsApp-интеграция", cmd: ["python3", "-m", "unittest", "discover", "-s", "integrations/whatsapp", "-p", "test_*.py"] },
  { id: "functions", name: "Серверные функции Supabase", cmd: ["bash", "tests/check_functions.sh"] },
  { id: "scripts", name: "Служебные скрипты: синтаксис", multi: shFiles.map((f) => ["bash", "-n", f]).concat(mjsFiles.map((f) => ["node", "--check", f])) },
];

const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const steps = only.length ? STEPS.filter((s) => only.includes(s.id)) : STEPS;
if (only.length && steps.length !== only.length) {
  console.error("Неизвестный шаг. Есть: " + STEPS.map((s) => s.id).join(", "));
  process.exit(2);
}

function run(cmd) {
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  const out = ((r.stdout || "") + (r.stderr || "")).trim();
  if (r.error) return { ok: false, out: "Не удалось запустить «" + cmd[0] + "»: " + r.error.message };
  return { ok: r.status === 0, out };
}

const results = [];
const t0 = Date.now();
for (const s of steps) {
  const started = Date.now();
  let ok = true, out = "";
  if (s.multi) {
    const bad = s.multi.map((c) => ({ c, r: run(c) })).filter((x) => !x.r.ok);
    ok = !bad.length;
    out = ok ? "✅ " + s.multi.length + " файлов без ошибок синтаксиса" : bad.map((x) => x.c.join(" ") + "\n" + x.r.out).join("\n");
  } else {
    const r = run(s.cmd);
    ok = r.ok; out = r.out;
  }
  const lines = out.split("\n").filter(Boolean);
  const last = lines[lines.length - 1] || "";
  results.push({ s, ok, out, last, ms: Date.now() - started });
  console.log((ok ? "✅ " : "❌ ") + s.name + "  (" + ((Date.now() - started) / 1000).toFixed(1) + " с)");
  if (ok) console.log("     " + last.replace(/^[✅🎉]\s*/u, ""));
  else console.log(lines.map((l) => "     " + l).join("\n"));
}

const failed = results.filter((r) => !r.ok);
console.log("\n" + "─".repeat(60));
if (failed.length) {
  console.log("❌ Не прошло: " + failed.length + " из " + results.length);
  failed.forEach((r) => console.log("   • " + r.s.name + "  →  повторить отдельно: " + (r.s.cmd ? r.s.cmd.join(" ") : "npm run check -- --only=" + r.s.id)));
  process.exit(1);
}
console.log("✅ Все быстрые проверки пройдены: " + results.length + " из " + results.length + " за " + ((Date.now() - t0) / 1000).toFixed(1) + " с");
console.log("   Не входит сюда: база (npm run test:db, нужен Docker), экраны (npm run smoke, нужен Chrome), мобильная копия (npm run mobile:check)");
