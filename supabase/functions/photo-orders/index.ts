// =====================================================
// ULA FACTORY — заказы с фото тетради (Supabase Edge Function)
//
// Как работает:
//   1. Сайт присылает 1–5 фото страниц тетради (уже уменьшенных, JPEG).
//   2. Функция проверяет, что это вошедший байер или помощник, и списывает фото с дневного лимита
//      (ai_photo_take в базе: 30 фото в день на человека).
//   3. Отправляет фото в Google Gemini и просит вернуть строки заказов в виде JSON.
//   4. Возвращает строки сайту. В базу функция ничего не пишет — байер сначала проверяет строки сам
//      и загружает их через обычное окно «Загрузка из Excel».
//
// Секрет GEMINI_API_KEY — тот же, что у ai-assistant (Supabase → Edge Functions → Secrets).
// Фото нигде не сохраняются.
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

const MAX_IMAGES = 5;
const MAX_B64 = 2_500_000; // ~1,8 МБ на фото после сжатия на сайте

const PROMPT =
  "На фото — страницы тетради или листы, где байер (закупщик товаров из Китая) записывал заказы клиентов от руки " +
  "или печатно. Язык: русский, кыргызский, английский или китайский. Найди КАЖДЫЙ заказ (обычно одна строка или один блок = один заказ) " +
  "и верни его полями:\n" +
  "date — дата заказа в формате ГГГГ-ММ-ДД, если видна (если год не указан — текущий год); иначе пусто;\n" +
  "client — имя клиента, как написано;\n" +
  "phone — телефон, только цифры и +, если есть;\n" +
  "product — что заказали;\n" +
  "qty — количество числом (если не указано — 1);\n" +
  "price — сумма для клиента (сколько клиент должен заплатить всего) числом, без валюты;\n" +
  "paid — сколько клиент уже заплатил числом (аванс, предоплата, «опл», «+»); если зачёркнуто как оплаченное полностью — равно price;\n" +
  "status — статус словами, если записан (например «выдан», «в пути», «оплачен»), иначе пусто;\n" +
  "comment — всё остальное полезное с этой строки (размер, цвет, карго, заметки);\n" +
  "unsure — true, если почерк трудно разобрать и в этой строке могут быть ошибки.\n" +
  "Правила: ничего не придумывай — чего не видно, оставь пустым. Не объединяй разных клиентов. " +
  "Пропускай заголовки, итоги страницы и зачёркнутые целиком строки. Числа вроде «5т», «5к» = 5000. " +
  "Сегодняшняя дата: " + new Date().toISOString().slice(0, 10) + ".";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    rows: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" }, client: { type: "STRING" }, phone: { type: "STRING" }, product: { type: "STRING" },
          qty: { type: "NUMBER" }, price: { type: "NUMBER" }, paid: { type: "NUMBER" }, status: { type: "STRING" },
          comment: { type: "STRING" }, unsure: { type: "BOOLEAN" },
        },
        required: ["client"],
      },
    },
  },
  required: ["rows"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length) return json({ error: "no_images" }, 400);
    if (images.length > MAX_IMAGES) return json({ error: "too_many" }, 400);
    for (const im of images) {
      if (typeof im?.data !== "string" || im.data.length > MAX_B64 || !/^image\/(jpeg|png|webp)$/.test(im?.mime ?? "")) {
        return json({ error: "bad_image" }, 400);
      }
    }

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "no_api_key" }, 500);

    // 1) Кто прислал и не кончился ли лимит — база проверяет от имени этого человека
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || req.headers.get("apikey") || "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: remaining, error: qErr } = await sb.rpc("ai_photo_take", { p_count: images.length });
    if (qErr) {
      const msg = String(qErr.message || "");
      if (msg.includes("quota_exceeded")) return json({ error: "quota_exceeded" }, 429);
      return json({ error: "forbidden" }, 403);
    }

    // 2) Фото → Gemini, ответ строго по схеме (JSON)
    const payload = JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { text: PROMPT },
          ...images.map((im: { mime: string; data: string }) => ({ inline_data: { mime_type: im.mime, data: im.data } })),
        ],
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json", responseSchema: SCHEMA },
    });
    const models = [Deno.env.get("GEMINI_VISION_MODEL") || "gemini-flash-latest", "gemini-flash-lite-latest"];
    let g: any = null, lastStatus = 0;
    outer: for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: payload,
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok) { g = data; break outer; }
        lastStatus = r.status;
        console.error("gemini error", model, r.status, JSON.stringify(data).slice(0, 300));
        if (r.status !== 503 && r.status !== 429 && r.status !== 500) break;
        await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
      }
    }
    if (!g) return json({ error: lastStatus === 429 ? "rate_limited" : "ai_failed" }, 502);

    const text = (g?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }
    const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
    const numv = (v: unknown) => (typeof v === "number" && isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);
    const rows = (Array.isArray(parsed.rows) ? parsed.rows : []).slice(0, 300).map((r: any) => ({
      date: str(r.date, 20), client: str(r.client, 200), phone: str(r.phone, 40), product: str(r.product, 300),
      qty: numv(r.qty), price: numv(r.price), paid: numv(r.paid), status: str(r.status, 60),
      comment: str(r.comment, 500), unsure: r.unsure === true,
    })).filter((r: any) => r.client || r.product);

    return json({ rows, remaining });
  } catch (e) {
    console.error(e);
    return json({ error: "server_error" }, 500);
  }
});
