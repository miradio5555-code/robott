// =====================================================
// ЗАЩИТА order-notify-worker (проверка JWT выключена, вместо неё — секрет NOTIFY_WORKER_SECRET в заголовке).
// Запуск: deno run --allow-read --allow-env --import-map=tests/notify_importmap.json tests/notify_worker_auth_test.ts
// Настоящая функция запускается с поддельными базой и Telegram; сети нет.
// =====================================================
// deno-lint-ignore-file no-explicit-any
let handler: any = null;
(Deno as any).serve = (h: any) => { handler = h; return {}; };
Deno.env.set("TELEGRAM_BOT_TOKEN", "123456:TEST-TOKEN-not-real-0000000000000000");
Deno.env.set("SUPABASE_URL", "http://fake.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role");
const SECRET = "s3cret-".padEnd(40, "x");
await import("../supabase/functions/order-notify-worker/index.ts");

const call = async (headers: Record<string, string>, method = "POST") => {
  const r = await handler(new Request("http://x/", { method, headers, body: method === "POST" ? "{}" : undefined }));
  return { status: r.status, text: await r.text() };
};
function eq(a: unknown, b: unknown, m: string) { if (a !== b) { console.error("ПРОВАЛ: " + m + " (получено " + JSON.stringify(a) + ")"); Deno.exit(1); } }

// секрет не задан → обработчик не работает, даже с «правильным» заголовком
Deno.env.delete("NOTIFY_WORKER_SECRET");
let r = await call({ "x-worker-secret": SECRET }); eq(r.status, 503, "без секрета в настройках функция запустилась");
Deno.env.set("NOTIFY_WORKER_SECRET", "short");
r = await call({ "x-worker-secret": "short" }); eq(r.status, 503, "слишком короткий секрет принят");
Deno.env.set("NOTIFY_WORKER_SECRET", SECRET);
r = await call({}); eq(r.status, 401, "вызов без заголовка разрешён");
r = await call({ "x-worker-secret": "wrong".padEnd(SECRET.length, "y") }); eq(r.status, 401, "неверный секрет принят");
r = await call({ "x-worker-secret": SECRET.slice(0, -1) }); eq(r.status, 401, "обрезанный секрет принят");
r = await call({ authorization: "Bearer " + SECRET }); eq(r.status, 401, "секрет в Authorization принят");
r = await call({ "x-worker-secret": SECRET }, "GET"); eq(r.status, 405, "GET разрешён");
r = await call({ "x-worker-secret": SECRET }); eq(r.status, 200, "верный секрет не пропущен");
for (const x of [r.text]) if (x.includes(SECRET)) { console.error("ПРОВАЛ: секрет попал в ответ"); Deno.exit(1); }
r = await call({ "x-worker-secret": "bad" + SECRET }); if (r.text.includes(SECRET)) { console.error("ПРОВАЛ: секрет в ответе об ошибке"); Deno.exit(1); }
console.log("   ✓ обработчик: нет/короткий секрет — 503; нет/неверный заголовок — 401; верный — 200; секрета в ответах нет");
