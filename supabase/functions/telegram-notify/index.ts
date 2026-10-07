// =====================================================
// ULA FACTORY — уведомления о техподдержке в Telegram (Supabase Edge Function)
//
// Что умеет (поле action в запросе):
//   "notify"  — байер только что написал в поддержку → прислать админу сообщение в Telegram.
//               Берём только новые сообщения ЭТОГО байера, о которых ещё не сообщали.
//   "connect" — (только админ) найти чат, где админ нажал Start у бота, запомнить его
//               и прислать «✅ Уведомления подключены».
//   "status"  — (только админ) подключено ли, как зовут бота.
//
// Секрет TELEGRAM_BOT_TOKEN хранится в Supabase → Edge Functions → Secrets.
// SUPABASE_SERVICE_ROLE_KEY Supabase даёт функции сам — в коде сайта его нет.
// =====================================================

import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = "https://miradio5555-code.github.io/robott/";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";

    // 1) Кто спрашивает (от имени пользователя, с его правами)
    const userSb = createClient(
      url,
      Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: who } = await userSb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const user = who?.user;
    if (!user) return json({ error: "not_authenticated" }, 401);
    const { data: isAdmin } = await userSb.rpc("is_admin");

    // 2) Служебный доступ к базе — только внутри этой функции
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return json({ error: "no_bot_token" });
    const tg = async (method: string, body: Record<string, unknown> = {}) => {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false }));
    };

    const getSetting = async (key: string) => {
      const { data } = await db.from("admin_settings").select("value").eq("key", key).maybeSingle();
      return data?.value ?? null;
    };
    const setSetting = (key: string, value: string) =>
      db.from("admin_settings").upsert({ key, value, updated_at: new Date().toISOString() });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // ---------- статус (админ) ----------
    if (action === "status") {
      if (isAdmin !== true) return json({ error: "forbidden" }, 403);
      const me = await tg("getMe");
      if (!me.ok) return json({ error: "bad_token" });
      return json({
        ok: true,
        bot: me.result?.username ?? null,
        connected: !!(await getSetting("telegram_chat_id")),
        chat_name: await getSetting("telegram_chat_name"),
      });
    }

    // ---------- подключить (админ) ----------
    if (action === "connect") {
      if (isAdmin !== true) return json({ error: "forbidden" }, 403);
      const up = await tg("getUpdates", { limit: 100 });
      if (!up.ok) return json({ error: "bad_token" });
      // последний личный чат, где написали боту (например, нажали Start)
      const msgs = (up.result ?? [])
        .map((u: any) => u.message)
        .filter((m: any) => m && m.chat && m.chat.type === "private");
      const last = msgs[msgs.length - 1];
      if (!last) return json({ error: "no_start" });
      const chat = last.chat;
      const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
      await setSetting("telegram_chat_id", String(chat.id));
      await setSetting("telegram_chat_name", name);
      await tg("sendMessage", {
        chat_id: chat.id,
        text: "✅ Уведомления ULA Factory подключены.\nСюда будут приходить новые обращения байеров в техподдержку.",
      });
      return json({ ok: true, chat_name: name });
    }

    // ---------- уведомить о новом обращении (байер) ----------
    if (action === "notify") {
      const chatId = await getSetting("telegram_chat_id");
      if (!chatId) return json({ ok: true, sent: 0, reason: "not_connected" });

      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: rows } = await db.from("support_messages")
        .select("id, body, meta")
        .eq("user_id", user.id)
        .eq("from_admin", false)
        .is("notified_at", null)
        .gte("created_at", since)
        .order("created_at")
        .limit(5);
      if (!rows || !rows.length) return json({ ok: true, sent: 0 });

      const { data: prof } = await db.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle();
      const { data: ws } = await db.from("workspaces").select("name").eq("owner_id", user.id)
        .order("created_at").limit(1).maybeSingle();
      const errors = (rows[rows.length - 1].meta?.errors ?? []) as string[];

      const text = [
        "🆘 Техподдержка ULA Factory",
        "👤 " + (prof?.full_name || "—"),
        "📞 " + (prof?.phone || "—"),
        "🏢 " + (ws?.name || "—"),
        "✉️ " + (user.email || "—"),
        "",
        ...rows.map((r) => "💬 " + String(r.body).slice(0, 1500)),
        ...(errors.length ? ["", "⚠️ Ошибки на странице:", ...errors.slice(-3)] : []),
        "",
        "Ответить: " + SITE_URL + "#/support",
      ].join("\n").slice(0, 4000);

      const sent = await tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
      if (!sent.ok) {
        console.error("telegram error", JSON.stringify(sent).slice(0, 300));
        return json({ error: "telegram_failed" }, 502);
      }
      await db.from("support_messages").update({ notified_at: new Date().toISOString() })
        .in("id", rows.map((r) => r.id));
      return json({ ok: true, sent: rows.length });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
