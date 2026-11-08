// =====================================================
// ULA FACTORY — обработчик очереди уведомлений клиентам о статусах заказов (Supabase Edge Function, файл 57).
//
// Работает БЕЗ открытого сайта: его запускает расписание (supabase/notify_schedule.sql), раз в минуту.
// Берёт из очереди (public.order_notify_queue) готовые задачи, отправляет сообщение клиенту в Telegram и записывает
// результат. Повторы, задержки, защита от параллельной обработки и проверка получателя — в базе (notify_claim,
// notify_begin_send, notify_finish); тексты и разбор ответов Telegram — в ../_shared/order_notify.js.
//
// Доступ: только по секрету расписания в заголовке x-worker-secret (секрет NOTIFY_WORKER_SECRET). Сайт и вошедшие
// пользователи эту функцию не зовут. Деплой: supabase functions deploy order-notify-worker --no-verify-jwt
// (проверка JWT выключена, потому что вместо неё — секрет; без секрета функция отвечает 503/401).
// Секреты: TELEGRAM_BOT_TOKEN (тот же, что у telegram-notify), NOTIFY_WORKER_SECRET, SUPABASE_URL и
// SUPABASE_SERVICE_ROLE_KEY (Supabase подставляет сам).
// =====================================================
import { createClient } from "jsr:@supabase/supabase-js@2";
import { processBatch, safeError } from "../_shared/order_notify.js";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("NOTIFY_WORKER_SECRET") ?? "";
  if (secret.length < 32) return json({ error: "not_configured" }, 503);   // секрет не задан или слишком короткий: обработчик не работает
  if (!sameSecret(req.headers.get("x-worker-secret") ?? "", secret)) return json({ error: "unauthorized" }, 401);
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ error: "no_bot_token" }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error(error.code || "rpc_error");
    return data;
  };
  const send = async (chatId: string, text: string) => {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  };
  try {
    const stats = await processBatch({ rpc, send, worker: "edge-" + crypto.randomUUID(), limit: 20 });
    await rpc("job_beat", { p_job: "order_notify_worker", p_ok: true, p_detail: null }).catch(() => {});   // «пульс» для администратора
    return json({ ok: true, ...stats });
  } catch (e) {
    await rpc("job_beat", { p_job: "order_notify_worker", p_ok: false, p_detail: "worker_error" }).catch(() => {});
    return json({ ok: false, error: safeError((e as Error).message) }, 500);
  }
});
