// =====================================================
// ПРОВЕРКА СТАРОЙ ФУНКЦИИ telegram-notify (action = order_status), которую зовут старые вкладки сайта.
// Запуск: deno run --allow-read --allow-env --import-map=tests/notify_importmap.json tests/notify_legacy_test.ts
// Настоящая функция запускается с поддельными базой и Telegram: сети нет, сообщений нет.
//   • очередь есть (файл 57)        → функция ничего не отправляет (иначе клиент получил бы сообщение дважды);
//   • очереди нет (файл 57 не запущен) → прежнее поведение (отправляет сама);
//   • сбой проверки очереди          → не отправляет (безопаснее пропустить, чем продублировать).
// =====================================================
// deno-lint-ignore-file no-explicit-any
import { fake } from "./notify_fake_supabase.ts";

let handler: any = null;
(Deno as any).serve = (h: any) => { handler = h; return {}; };
Deno.env.set("TELEGRAM_BOT_TOKEN", "123456:TEST-TOKEN-not-real-0000000000000000");
Deno.env.set("SUPABASE_URL", "http://fake.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake");
const tgCalls: string[] = [];
(globalThis as any).fetch = (url: string) => {
  tgCalls.push(String(url));
  return Promise.resolve(new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }));
};
await import("../supabase/functions/telegram-notify/index.ts");

const ORDER = "11111111-1111-1111-1111-111111111111";
async function call() {
  tgCalls.length = 0;
  fake.orders = [{ id: ORDER, workspace_id: "ws1", order_number: "CN-1", product_ru: "Куртка", product_zh: null, status: "in_transit", tracking_number: null, public_token: "a".repeat(32), client_name: "К" }];
  fake.subs = [{ order_id: ORDER, chat_id: "1001", lang: "ru", last_status: "purchasing" }];
  const res = await handler(new Request("http://x/", { method: "POST", headers: { Authorization: "Bearer t", apikey: "k" }, body: JSON.stringify({ action: "order_status", ids: [ORDER] }) }));
  return { body: await res.json(), sends: tgCalls.filter((u) => u.includes("/sendMessage")).length };
}
function eq(a: unknown, b: unknown, m: string) { if (a !== b) { console.error("ПРОВАЛ: " + m + " (получено " + JSON.stringify(a) + ")"); Deno.exit(1); } }

fake.queue = "exists";
let r = await call();
eq(r.sends, 0, "при наличии очереди старый вызов отправил сообщение (будет дубль)"); eq(r.body.queued, true, "ответ без признака очереди"); eq(r.body.sent, 0, "sent");
fake.queue = "error";
r = await call();
eq(r.sends, 0, "при сбое проверки очереди старый вызов отправил сообщение"); eq(r.body.error, "queue_check_failed", "ошибка проверки");
fake.queue = "missing";
r = await call();
eq(r.sends, 1, "без очереди (до файла 57) старая отправка не работает"); eq(r.body.sent, 1, "sent без очереди");
console.log("   ✓ старый вызов: очередь есть — не отправляет; сбой проверки — не отправляет; очереди нет — прежнее поведение");
