// =====================================================
// ULA FACTORY — push-уведомления (Supabase Edge Function)
//
// Приходят на телефон и компьютер, даже когда сайт закрыт. Что умеет (поле action):
//   "support" — написали в поддержку: байер → всем администраторам; администратор (с полем user) → этому байеру.
//   "kyc"     — байер отправил документы на проверку → администраторам.
//   "exchange" / "exchange_paid" — клиент оставил заявку на обмен / загрузил оплату (без входа, по номеру заявки) → владельцу кабинета.
// Ключи отправителя создаются сами при первом запуске и лежат в таблице push_keys (читает только эта функция).
// =====================================================

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    let { data: keys } = await db.from("push_keys").select("pub, priv").eq("id", 1).maybeSingle();
    if (!keys?.pub || !keys?.priv) {
      // первый запуск: создаём пару ключей прямо здесь, секретный ключ остаётся только в базе
      const k = webpush.generateVAPIDKeys();
      await db.from("push_keys").upsert({ id: 1, pub: k.publicKey, priv: k.privateKey });
      keys = { pub: k.publicKey, priv: k.privateKey };
    }
    if (action === "init") return json({ ok: true });
    webpush.setVapidDetails("mailto:miradio.5555@gmail.com", keys.pub, keys.priv);

    // отправить всем подпискам этих людей; умершие подписки (телефон отписался) удаляем
    const send = async (userIds: string[], msg: { title: string; body: string; tag: string }) => {
      if (!userIds.length) return 0;
      const { data: subs } = await db.from("push_subs").select("endpoint, p256dh, auth").in("user_id", userIds);
      let n = 0;
      await Promise.all((subs ?? []).map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ ...msg, url: "./" }),
            { TTL: 3600, urgency: "high" },
          );
          n++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint);
        }
      }));
      return n;
    };
    const admins = async () => {
      const { data } = await db.from("profiles").select("user_id").eq("role", "admin").eq("is_active", true);
      return (data ?? []).map((r: any) => r.user_id as string);
    };

    // ---------- без входа: заявка клиента на обмен ----------
    if (action === "exchange" || action === "exchange_paid") {
      const id = String(body.id ?? "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ok: false });
      const paid = action === "exchange_paid";
      const since = new Date(Date.now() - (paid ? 24 * 60 : 15) * 60 * 1000).toISOString();
      let q = db.from("exchange_requests")
        .update(paid ? { push_paid_at: new Date().toISOString() } : { push_at: new Date().toISOString() })
        .eq("id", id).gte("created_at", since);
      q = paid ? q.eq("status", "paid").is("push_paid_at", null) : q.is("push_at", null);
      const { data: x } = await q.select("workspace_id, client_name, cny, som").maybeSingle();
      if (!x) return json({ ok: true, sent: 0 });
      const { data: w } = await db.from("workspaces").select("owner_id").eq("id", x.workspace_id).maybeSingle();
      if (!w?.owner_id) return json({ ok: true, sent: 0 });
      const sent = await send([w.owner_id], {
        title: paid ? "💰 Клиент оплатил обмен" : "💱 Новая заявка на обмен",
        body: String(x.client_name || "—").slice(0, 60) + " · ¥" + x.cny + " = " + x.som + " сом",
        tag: "fx",
      });
      return json({ ok: true, sent });
    }

    // ---------- дальше нужен вход ----------
    const userSb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "", {
      global: { headers: { Authorization: auth } },
    });
    const { data: who } = await userSb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    const user = who?.user;
    if (!user) return json({ error: "not_authenticated" }, 401);
    const { data: isAdmin } = await userSb.rpc("is_admin");

    if (action === "support" || action === "kyc") {
      const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      if (isAdmin === true && action === "support") {
        // ответ администратора — этому байеру (только если он правда что-то написал минуту назад)
        const target = String(body.user ?? "");
        if (!/^[0-9a-f-]{36}$/.test(target)) return json({ ok: false });
        const { data: m } = await db.from("support_messages").select("body").eq("user_id", target)
          .eq("from_admin", true).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!m) return json({ ok: true, sent: 0 });
        const sent = await send([target], { title: "Поддержка ответила", body: String(m.body || "📎 файл").slice(0, 120), tag: "support" });
        return json({ ok: true, sent });
      }
      // байер → всем администраторам (только если сообщение действительно было минуту назад)
      const { data: m } = await db.from("support_messages").select("body").eq("user_id", user.id)
        .eq("from_admin", false).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!m) return json({ ok: true, sent: 0 });
      const { data: p } = await db.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      const sent = await send(await admins(), {
        title: action === "kyc" ? "🪪 Новая проверка личности" : "💬 Новое сообщение в поддержку",
        body: (p?.full_name ? p.full_name + ": " : "") + String(m.body || "📎 файл").slice(0, 100),
        tag: action === "kyc" ? "kyc" : "support",
      });
      return json({ ok: true, sent });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("push-notify", String(e));
    return json({ error: "server_error" }, 500);
  }
});
