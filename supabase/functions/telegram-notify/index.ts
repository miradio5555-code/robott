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
//   Для страницы заказа клиента (без входа, по секретной ссылке заказа):
//   "client_info"       — как зовут бота и подписан ли уже кто-то на этот заказ.
//   "client_connect"    — клиент нажал Start со ссылкой «o<токен>» → запомнить его чат для заказа.
//   "client_disconnect" — отключить уведомления по этому заказу.
//   Для байера:
//   "order_status"   — статус заказов поменялся → написать подписанным клиентам (кто ещё не получил этот статус).
//
// Входящие сообщения боту (нажатия Start) функция забирает у Telegram (getUpdates) и складывает в таблицу
// tg_updates, отмечая их прочитанными — так ни одно подключение не теряется, даже когда их много.
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

    const getSetting = async (key: string) => {
      const { data } = await db.from("admin_settings").select("value").eq("key", key).maybeSingle();
      return data?.value ?? null;
    };
    const setSetting = (key: string, value: string) =>
      db.from("admin_settings").upsert({ key, value, updated_at: new Date().toISOString() });

    // Забрать новые сообщения боту и сохранить их (личные чаты), потом отметить прочитанными
    const drain = async () => {
      let offset = Number(await getSetting("tg_offset")) || 0;
      for (let i = 0; i < 10; i++) {
        const up = await tg("getUpdates", { offset, limit: 100, timeout: 0 });
        if (!up.ok) return false;
        const list = (up.result ?? []) as any[];
        if (!list.length) break;
        const rows = list.map((u) => ({ u, m: u.message }))
          .filter(({ m }) => m && m.chat && m.chat.type === "private")
          .map(({ u, m }) => ({
            update_id: u.update_id,
            chat_id: String(m.chat.id),
            chat_name: ([m.chat.first_name, m.chat.last_name].filter(Boolean).join(" ") || m.chat.username || String(m.chat.id)).slice(0, 200),
            lang: String(m.from?.language_code ?? "").slice(0, 10),
            text: String(m.text ?? "").trim().slice(0, 200),
          }));
        if (rows.length) await db.from("tg_updates").upsert(rows, { onConflict: "update_id", ignoreDuplicates: true });
        offset = Math.max(...list.map((u) => u.update_id)) + 1;
        await setSetting("tg_offset", String(offset));
        if (list.length < 100) break;
      }
      return true;
    };
    const lastStart = async (text: string) => {
      const { data } = await db.from("tg_updates").select("chat_id, chat_name, lang").eq("text", text)
        .order("update_id", { ascending: false }).limit(1).maybeSingle();
      return data;
    };
    const langOf = (code: string) => (/^zh/.test(code) ? "zh" : /^en/.test(code) ? "en" : "ru");

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

    // ---------- страница заказа клиента (без входа, по секретной ссылке) ----------
    if (action === "client_info" || action === "client_connect" || action === "client_disconnect") {
      const tok = String(body.token ?? "");
      if (!/^[a-f0-9]{32}$/i.test(tok)) return json({ ok: false, error: "bad_token" });
      const { data: o } = await db.from("orders").select("id, order_number, product_ru, status, workspace_id").eq("public_token", tok).maybeSingle();
      if (!o) return json({ ok: false, error: "not_found" });
      if (action === "client_info") {
        const me = await tg("getMe");
        const { count } = await db.from("order_tg_subs").select("chat_id", { count: "exact", head: true }).eq("order_id", o.id);
        return json({ ok: true, bot: me.ok ? me.result?.username ?? null : null, subscribed: (count ?? 0) > 0 });
      }
      if (action === "client_disconnect") {
        await db.from("order_tg_subs").delete().eq("order_id", o.id);
        return json({ ok: true, subscribed: false });
      }
      // client_connect: ищем «/start o<токен>»
      if (!(await drain())) return json({ ok: false, error: "bad_bot" });
      const hit = await lastStart("/start o" + tok);
      if (!hit) return json({ ok: false, error: "no_start" });
      const lang = langOf(hit.lang ?? "");
      await db.from("order_tg_subs").upsert({ order_id: o.id, chat_id: hit.chat_id, lang, last_status: o.status }, { onConflict: "order_id,chat_id" });
      const hello = {
        ru: "✅ Готово! Теперь я сам напишу вам, когда заказ № " + o.order_number + " поедет, прибудет и будет готов к выдаче.",
        en: "✅ Done! I'll message you when order No. " + o.order_number + " is shipped, arrives and is ready for pickup.",
        zh: "✅ 已开通！订单 " + o.order_number + " 发货、到货和可以取货时，我会主动通知您。",
      }[lang];
      await tg("sendMessage", { chat_id: hit.chat_id, text: hello });
      return json({ ok: true, subscribed: true });
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
      if (!(await drain())) return json({ error: "bad_token" });
      const hit = await lastStart("/start w" + row.code);
      if (!hit) return json({ error: "no_start" });
      const name = hit.chat_name || hit.chat_id;
      await db.from("ws_telegram").update({
        chat_id: hit.chat_id, chat_name: String(name).slice(0, 200), connected_at: new Date().toISOString(),
        code: null, code_expires_at: null,
      }).eq("workspace_id", wsId);
      await tg("sendMessage", {
        chat_id: hit.chat_id,
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
      if (!(await drain())) return json({ error: "bad_token" });
      // последний личный чат, где написали боту (например, нажали Start) за последний час.
      // Подключения кабинетов байеров («/start w…») и клиентов («/start o…») пропускаем — это не чат админа.
      const { data: recent } = await db.from("tg_updates").select("chat_id, chat_name, text")
        .gte("created_at", new Date(Date.now() - 3600 * 1000).toISOString())
        .order("update_id", { ascending: false }).limit(50);
      const last = (recent ?? []).find((m: any) => !/^\/start [wo][a-f0-9]{24,32}$/i.test(String(m.text ?? "")));
      if (!last) return json({ error: "no_start" });
      const name = last.chat_name || last.chat_id;
      await setSetting("telegram_chat_id", String(last.chat_id));
      await setSetting("telegram_chat_name", String(name));
      await tg("sendMessage", {
        chat_id: last.chat_id,
        text: "✅ Уведомления ULA Factory подключены.\nСюда будут приходить новые обращения байеров в техподдержку.",
      });
      return json({ ok: true, chat_name: name });
    }

    // ---------- статус заказов поменялся → написать подписанным клиентам (байер) ----------
    if (action === "order_status") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter((x: string) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
      if (!ids.length) return json({ ok: true, sent: 0 });
      // заказы читаем от имени байера: чужие он и не увидит
      const { data: orders } = await userSb.from("orders")
        .select("id, workspace_id, order_number, product_ru, product_zh, status, tracking_number, public_token, client_name").in("id", ids);
      if (!orders || !orders.length) return json({ ok: true, sent: 0 });
      // писать клиентам может только тот, кто работает в кабинете (админ только смотрит)
      const allowed: Record<string, boolean> = {};
      for (const w of [...new Set(orders.map((o: any) => o.workspace_id))]) {
        const { data: m } = await userSb.rpc("is_member", { p_ws: w });
        allowed[w as string] = m === true;
      }
      const { data: subs } = await db.from("order_tg_subs").select("order_id, chat_id, lang, last_status")
        .in("order_id", orders.filter((o: any) => allowed[o.workspace_id]).map((o: any) => o.id));
      if (!subs || !subs.length) return json({ ok: true, sent: 0 });
      const wsNames: Record<string, string> = {};
      const { data: wss } = await db.from("workspaces").select("id, name").in("id", [...new Set(orders.map((o: any) => o.workspace_id))]);
      (wss ?? []).forEach((w: any) => { wsNames[w.id] = w.name || ""; });

      const T: Record<string, any> = {
        ru: {
          order: (n: string, p: string) => (p ? "Ваш заказ «" + p + "» (№ " + n + ")" : "Ваш заказ № " + n),
          st: {
            awaiting_payment: "{o} готов к оплате. Сумму и детали можно посмотреть по ссылке ниже.",
            purchasing: "Спасибо за оплату! 🙏 {o} уже закупаем у поставщика.",
            china_warehouse: "Хорошая новость: {o} уже на нашем складе в Китае 📦 Скоро отправим.",
            in_transit: "{o} уже в пути 🚚 Как только прибудет — сразу напишу.",
            arrived: "{o} прибыл! 🎉 Напишите, когда вам удобно забрать, или куда привезти.",
            delivered: "{o} у вас — спасибо, что выбрали нас! 🙏",
            cancelled: "{o} отменён. Если это ошибка — просто напишите нам.",
          },
          track: "Трек-номер: ", link: "Всё о заказе:",
        },
        en: {
          order: (n: string, p: string) => (p ? "Your order \u201c" + p + "\u201d (No. " + n + ")" : "Your order No. " + n),
          st: {
            awaiting_payment: "{o} is ready for payment. See the amount and details at the link below.",
            purchasing: "Thank you for your payment! 🙏 We're now buying {o} from the supplier.",
            china_warehouse: "Good news: {o} is already at our warehouse in China 📦 It will be shipped soon.",
            in_transit: "{o} is on its way 🚚 I'll message you as soon as it arrives.",
            arrived: "{o} has arrived! 🎉 Let us know when it suits you to pick it up, or where to deliver it.",
            delivered: "{o} is with you — thank you for choosing us! 🙏",
            cancelled: "{o} has been cancelled. If this is a mistake, just message us.",
          },
          track: "Tracking number: ", link: "Everything about your order:",
        },
        zh: {
          order: (n: string, p: string) => (p ? "您的订单「" + p + "」（编号 " + n + "）" : "您的订单 " + n),
          st: {
            awaiting_payment: "{o}可以付款了，金额和详情请看下方链接。",
            purchasing: "感谢您的付款！🙏 我们正在向供应商采购{o}。",
            china_warehouse: "好消息：{o}已经到达我们的中国仓库 📦 很快发货。",
            in_transit: "{o}已经在路上了 🚚 到货后马上通知您。",
            arrived: "{o}到货了！🎉 请告诉我们方便取货的时间，或需要送到哪里。",
            delivered: "{o}已交付，感谢您选择我们！🙏",
            cancelled: "{o}已取消。如有误，请直接联系我们。",
          },
          track: "物流单号：", link: "订单详情：",
        },
      };
      let sent = 0;
      for (const sub of subs) {
        const o: any = orders.find((x: any) => x.id === sub.order_id);
        if (!o || o.status === "new" || sub.last_status === o.status) continue;   // этот статус клиент уже получил
        const L = T[sub.lang] ?? T.ru;
        const line = L.st[o.status];
        if (!line) continue;
        const prod = String((sub.lang === "zh" ? o.product_zh || o.product_ru : o.product_ru) || "").trim().slice(0, 60);
        const text = [
          line.replace("{o}", L.order(o.order_number, prod)).replace(/^./, (ch: string) => ch.toUpperCase()),
          ...(o.tracking_number && ["in_transit", "arrived"].includes(o.status) ? ["", L.track + o.tracking_number] : []),
          ...(o.public_token ? ["", L.link, SITE_URL + "?order=" + o.public_token] : []),
          ...(wsNames[o.workspace_id] ? ["", "— " + wsNames[o.workspace_id]] : []),
        ].join("\n").slice(0, 3900);
        const r = await tg("sendMessage", { chat_id: sub.chat_id, text, disable_web_page_preview: true });
        if (r.ok) {
          sent++;
          await db.from("order_tg_subs").update({ last_status: o.status }).eq("order_id", sub.order_id).eq("chat_id", sub.chat_id);
        } else if (r.error_code === 403) {
          // клиент заблокировал бота — подписку больше не держим
          await db.from("order_tg_subs").delete().eq("order_id", sub.order_id).eq("chat_id", sub.chat_id);
        }
      }
      return json({ ok: true, sent });
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
