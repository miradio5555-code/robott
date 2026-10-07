// =====================================================
// ULA FACTORY — ИИ-помощник администратора (Supabase Edge Function)
//
// Как работает:
//   1. Сайт присылает вопрос админа.
//   2. Функция проверяет, что спрашивает именно АДМИН (через базу, is_admin()).
//   3. Собирает ОБЩИЕ цифры по платформе: кабинеты, заказы по статусам,
//      суммы, прибыль. Имена, телефоны и адреса клиентов НЕ отправляются.
//   4. Отправляет вопрос и цифры в Google Gemini (бесплатный тариф) и возвращает ответ.
//
// Секрет GEMINI_API_KEY хранится в Supabase → Edge Functions → Secrets.
// В коде сайта ключа нет.
// =====================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

type Turn = { role: "user" | "model"; text: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // 1) Кто спрашивает? Клиент Supabase от имени пользователя —
    //    правила доступа (RLS) работают так же, как на сайте.
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      // публичный ключ: из настроек функции, а если его нет — тот же, что прислал сайт
      Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: isAdmin, error: adminErr } = await sb.rpc("is_admin");
    if (adminErr || isAdmin !== true) return json({ error: "forbidden" }, 403);

    // 2) Вопрос и короткая история диалога
    const body = await req.json().catch(() => ({}));
    const question = String(body.question ?? "").trim().slice(0, 2000);
    const lang = ["ru", "en", "zh"].includes(body.lang) ? body.lang : "ru";
    const history: Turn[] = Array.isArray(body.history)
      ? body.history.slice(-8).map((t: Turn) => ({
          role: t.role === "model" ? "model" : "user",
          text: String(t.text ?? "").slice(0, 2000),
        }))
      : [];
    if (!question) return json({ error: "empty_question" }, 400);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "no_api_key" }, 500);

    // 3) Общие цифры по платформе (без личных данных клиентов)
    const { data: ws } = await sb.rpc("admin_list_workspaces");
    const { data: orders } = await sb
      .from("orders")
      .select("workspace_id, status, client_currency, total_som, paid_amount, balance_som, profit_som, order_date")
      .limit(10000);

    const month = new Date().toISOString().slice(0, 7);
    const byWs: Record<string, any> = {};
    for (const w of ws ?? []) {
      byWs[w.id] = {
        workspace: w.name,
        owner: w.owner_name || "—",
        blocked: !w.owner_active,
        role: w.owner_role,
        registered: String(w.created_at).slice(0, 10),
        clients: Number(w.clients_count),
        orders_total: 0,
        orders_by_status: {} as Record<string, number>,
        money_by_currency: {} as Record<string, { due: number; paid: number; debt: number; profit: number; profit_this_month: number }>,
      };
    }
    for (const o of orders ?? []) {
      const w = byWs[o.workspace_id];
      if (!w) continue;
      w.orders_total++;
      w.orders_by_status[o.status] = (w.orders_by_status[o.status] ?? 0) + 1;
      if (o.status === "cancelled") continue;
      const c = o.client_currency || "KGS";
      const m = (w.money_by_currency[c] ??= { due: 0, paid: 0, debt: 0, profit: 0, profit_this_month: 0 });
      m.due += Number(o.total_som) || 0;
      m.paid += Number(o.paid_amount) || 0;
      m.debt += Math.max(0, Number(o.balance_som) || 0);
      if (o.profit_som != null) {
        m.profit += Number(o.profit_som) || 0;
        if (String(o.order_date).slice(0, 7) === month) m.profit_this_month += Number(o.profit_som) || 0;
      }
    }
    const stats = { today: new Date().toISOString().slice(0, 10), workspaces: Object.values(byWs) };

    const langName = { ru: "русском", en: "английском", zh: "китайском" }[lang];
    const system =
      "Ты — помощник администратора платформы ULA Factory (учёт заказов байеров, которые закупают товары в Китае " +
      "и отправляют карго в Центральную Азию). Отвечай коротко, по делу, на " + langName + " языке. " +
      "Для вопросов о платформе используй ТОЛЬКО данные ниже, ничего не придумывай; если данных нет — так и скажи. " +
      "Статусы: new — новый, awaiting_payment — ждёт оплаты, purchasing — закупается, china_warehouse — на складе в Китае, " +
      "in_transit — в пути, arrived — прибыл, delivered — выдан, cancelled — отменён. " +
      "Суммы в разных валютах не складывай между собой. " +
      "Также можешь помогать с текстами: письма поставщикам на китайском, сообщения клиентам, переводы, расчёты.\n\n" +
      "ДАННЫЕ ПЛАТФОРМЫ (JSON):\n" + JSON.stringify(stats);

    // 4) Запрос в Google Gemini.
    //    Бесплатный тариф иногда отвечает «перегружен» (503) или «слишком часто» (429) —
    //    тогда ждём немного и пробуем ещё раз, а потом запасную модель.
    const models = [Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest", "gemini-flash-lite-latest"];
    const contents = [
      ...history.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      { role: "user", parts: [{ text: question }] },
    ];
    const payload = JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
    });
    let g: any = null;
    let lastStatus = 0;
    outer: for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload },
        );
        const data = await r.json().catch(() => ({}));
        if (r.ok) { g = data; break outer; }
        lastStatus = r.status;
        console.error("gemini error", model, r.status, JSON.stringify(data).slice(0, 300));
        if (r.status !== 503 && r.status !== 429 && r.status !== 500) break; // другая ошибка — повтор не поможет
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
    }
    if (!g) return json({ error: lastStatus === 429 ? "rate_limited" : "ai_failed" }, 502);
    const answer = (g?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return json({ answer: answer || "—" });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
