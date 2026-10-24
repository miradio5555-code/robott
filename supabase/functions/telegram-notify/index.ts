// =====================================================
// ULA FACTORY — уведомления в Telegram (Supabase Edge Function)
//
// Что умеет (поле action в запросе):
//   Для админа (техподдержка):
//   "notify"         — байер только что написал в поддержку → прислать админу сообщение в Telegram.
//   "connect"        — (только админ) найти чат, где админ нажал Start у бота, и запомнить его.
//   "status"         — (только админ) подключено ли, как зовут бота.
//   Для байера (заявки клиентов):
//   "bot"            — (вошедший пользователь) как зовут бота, чтобы собрать ссылку «Start».
//   "connect_ws"     — (владелец кабинета) проверить, что он нажал Start с его кодом, и запомнить чат.
//   Для страницы заявки клиента (без входа):
//   "request_notify" — клиент только что оставил заявку → прислать байеру сообщение в Telegram.
//                      Принимает только секретный номер новой заявки; про каждую заявку сообщает один раз.
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
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    // Служебный доступ к базе — только внутри этой функции
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!token) return json({ error: "no_bot_token" });
    const tg = async (method: string, payload: Record<string, unknown> = {}) => {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await r.json().catch(() => ({ ok: false }));
    };

    // ---------- заявка клиента (без входа) ----------
    if (action === "request_notify") {
      const tok = String(body.token ?? "");
      if (!/^[a-f0-9]{32}$/.test(tok)) return json({ ok: false });
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      // «забираем» заявку одним действием: второй вызов уже ничего не найдёт
      const { data: o } = await db.from("orders")
        .update({ notified_at: new Date().toISOString() })
        .eq("public_token", tok).eq("source", "request").is("notified_at", null).gte("created_at", since)
        .select("workspace_id, order_number, client_name, client_phone, product_ru, supplier_link, quantity, admin_comment")
        .maybeSingle();
      if (!o) return json({ ok: true, sent: 0 });
      const { data: link } = await db.from("ws_telegram").select("chat_id").eq("workspace_id", o.workspace_id).maybeSingle();
      if (!link?.chat_id) return json({ ok: true, sent: 0, reason: "not_connected" });
      const text = [
        "📥 Новая заявка " + o.order_number,
        "👤 " + (o.client_name || "—"),
        "📞 " + (o.client_phone || "—"),
        "🛍 " + String(o.product_ru || "—").slice(0, 200) + " × " + (o.quantity ?? 1),
        ...(o.supplier_link ? ["🔗 " + String(o.supplier_link).slice(0, 300)] : []),
        ...(o.admin_comment ? ["", String(o.admin_comment).slice(0, 600)] : []),
        "",
        "Открыть: " + SITE_URL,
      ].join("\n").slice(0, 3900);
      const sent = await tg("sendMessage", { chat_id: link.chat_id, text, disable_web_page_preview: true });
      return json({ ok: true, sent: sent.ok ? 1 : 0 });
    }

    // ---------- дальше нужен вход ----------
    const userSb = createClient(
      url,
      Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: who } = await userSb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const user = who?.user;
    if (!user) return json({ error: "not_authenticated" }, 401);
    const { data: isAdmin } = await userSb.rpc("is_admin");

    const getSetting = async (key: string) => {
      const { data } = await db.from("admin_settings").select("value").eq("key", key).maybeSingle();
      return data?.value ?? null;
    };
    const setSetting = (key: string, value: string) =>
      db.from("admin_settings").upsert({ key, value, updated_at: new Date().toISOString() });

    // ---------- как зовут бота (любой вошедший) ----------
    if (action === "bot") {
      const me = await tg("getMe");
      if (!me.ok) return json({ error: "bad_token" });
      return json({ ok: true, bot: me.result?.username ?? null });
    }

    // ---------- подключить Telegram кабинета (владелец) ----------
    if (action === "connect_ws") {
      const wsId = String(body.ws_id ?? "");
      const { data: owner } = await userSb.rpc("is_owner", { p_ws: wsId });
      if (owner !== true) return json({ error: "forbidden" }, 403);
      const { data: row } = await db.from("ws_telegram").select("code, code_expires_at").eq("workspace_id", wsId).maybeSingle();
      if (!row?.code || !row.code_expires_at || new Date(row.code_expires_at) < new Date()) return json({ error: "code_expired" });
      const up = await tg("getUpdates", { limit: 100 });
      if (!up.ok) return json({ error: "bad_token" });
      const want = "/start w" + row.code;
      const msg = (up.result ?? []).map((u: any) => u.message)
        .filter((m: any) => m && m.chat && m.chat.type === "private" && String(m.text ?? "").trim() === want).pop();
      if (!msg) return json({ error: "no_start" });
      const chat = msg.chat;
      const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id);
      await db.from("ws_telegram").update({
        chat_id: String(chat.id), chat_name: name.slice(0, 200), connected_at: new Date().toISOString(),
        code: null, code_expires_at: null,
      }).eq("workspace_id", wsId);
      await tg("sendMessage", {
        chat_id: chat.id,
        text: "✅ Telegram подключён к кабинету ULA Factory.\nСюда будут приходить новые заявки клиентов.",
      });
      return json({ ok: true, chat_name: name });
    }

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
      // последний личный чат, где написали боту (например, нажали Start).
      // Сообщения байеров «/start w…» (подключение их кабинетов) пропускаем — это не чат админа.
      const msgs = (up.result ?? [])
        .map((u: any) => u.message)
        .filter((m: any) => m && m.chat && m.chat.type === "private" && !/^\/start w[a-f0-9]{24}$/.test(String(m.text ?? "").trim()));
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
