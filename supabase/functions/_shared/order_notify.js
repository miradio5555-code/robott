// =====================================================
// ULA FACTORY — общая часть обработчика очереди уведомлений о статусах заказов (файл 57).
// Чистый JavaScript без зависимостей: его запускает Edge Function order-notify-worker (Deno) и тесты (Node)
// с поддельным сервисом доставки (tests/notify_worker_test.mjs).
//
// В сообщение клиенту попадают ТОЛЬКО поля, которые отдаёт notify_claim (название и номер заказа, статус,
// трек-номер, ссылка заказа, название кабинета): закупочных цен, прибыли, заметок и чужих клиентов там нет.
// =====================================================

export const SITE_URL = "https://miradio5555-code.github.io/robott/";

const T = {
  ru: {
    order: (n, p) => (p ? "Ваш заказ «" + p + "» (№ " + n + ")" : "Ваш заказ № " + n),
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
    order: (n, p) => (p ? "Your order “" + p + "” (No. " + n + ")" : "Your order No. " + n),
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
    order: (n, p) => (p ? "您的订单「" + p + "」（编号 " + n + "）" : "您的订单 " + n),
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

// Напоминание об оплате (kind = payment_reminder). Только то, что клиент видит на своей странице: остаток к оплате и срок оплаты.
// Никаких обещаний по доставке и срокам товара здесь нет.
const R = {
  ru: (ref, a, c, d) => "Напоминание: по " + ref.ru + " осталось оплатить " + a + " " + c + ". Срок оплаты был " + d + ". Подробности по ссылке ниже. Если вы уже оплатили — просто напишите нам, мы проверим.",
  en: (ref, a, c, d) => "Reminder: " + ref.en + " still has " + a + " " + c + " to pay. The payment was due on " + d + ". Details at the link below. If you have already paid, just message us and we will check.",
  zh: (ref, a, c, d) => "提醒：" + ref.zh + "还有 " + a + " " + c + " 待付款，付款期限为 " + d + "。详情请看下方链接。如已付款，请直接联系我们核对。",
};

/** Текст сообщения по задаче из notify_claim; null — для этого статуса сообщения нет. */
export function buildMessage(it, siteUrl = SITE_URL) {
  const L = T[it.lang] || T.ru;
  if (it.kind === "payment_reminder") {
    const prod = String((it.lang === "zh" ? it.product_zh || it.product_ru : it.product_ru) || "").trim().slice(0, 60);
    const ref = {
      ru: prod ? "заказу «" + prod + "» (№ " + it.order_number + ")" : "заказу № " + it.order_number,
      en: prod ? "your order \u201c" + prod + "\u201d (No. " + it.order_number + ")" : "your order No. " + it.order_number,
      zh: prod ? "订单「" + prod + "」（编号 " + it.order_number + "）" : "订单 " + it.order_number,
    };
    const amount = String(Number(it.amount));
    if (!isFinite(Number(it.amount)) || Number(it.amount) <= 0) return null;
    return [
      (R[it.lang] || R.ru)(ref, amount, String(it.currency || ""), String(it.due_date || "")),
      ...(it.public_token ? ["", L.link, siteUrl + "?order=" + it.public_token] : []),
      ...(it.brand ? ["", "— " + it.brand] : []),
    ].join("\n").slice(0, 3900);
  }
  const line = L.st[it.to_status];
  if (!line) return null;
  const prod = String((it.lang === "zh" ? it.product_zh || it.product_ru : it.product_ru) || "").trim().slice(0, 60);
  return [
    line.replace("{o}", L.order(it.order_number, prod)).replace(/^./, (ch) => ch.toUpperCase()),
    ...(it.tracking_number && ["in_transit", "arrived"].includes(it.to_status) ? ["", L.track + it.tracking_number] : []),
    ...(it.public_token ? ["", L.link, siteUrl + "?order=" + it.public_token] : []),
    ...(it.brand ? ["", "— " + it.brand] : []),
  ].join("\n").slice(0, 3900);
}

/** Безопасное описание ошибки: без токена бота, ссылок и лишних символов. */
export function safeError(s) {
  return String(s ?? "")
    .replace(/\d{6,}:[A-Za-z0-9_-]{20,}/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^A-Za-z0-9 _.:,()/-]/g, "")
    .trim()
    .slice(0, 160);
}

// Ошибка сети: если запрос точно не дошёл (нет DNS, отказ в соединении) — можно повторять сразу по графику;
// таймаут и обрыв — сообщение могло дойти, исход неизвестен.
function classifyThrown(e) {
  const m = String((e && (e.name + " " + e.message + " " + (e.cause && (e.cause.code || e.cause.message)))) || "");
  if (/timeout|timed out|abort|reset|closed|EPIPE|ECONNRESET|socket hang up|terminated|incomplete/i.test(m)) return "unknown";
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|dns|resolve|refused/i.test(m)) return "retry";
  return "unknown";
}

/**
 * Один проход обработчика.
 * rpc(name, args) → данные или бросает ошибку; send(chatId, text) → { ok, status, body } или бросает ошибку сети.
 */
export async function processBatch({ rpc, send, worker, limit = 20, lease = 120, siteUrl = SITE_URL }) {
  const stats = { claimed: 0, sent: 0, retry: 0, failed: 0, skipped: 0, unknown: 0, lost: 0 };
  const items = (await rpc("notify_claim", { p_worker: worker, p_limit: limit, p_lease: lease })) || [];
  stats.claimed = items.length;
  for (const it of items) {
    let outcome = "retry", error = "", retryAfter = null, messageId = null;
    try {
      const ok = await rpc("notify_begin_send", { p_id: it.id, p_worker: worker });
      if (!ok) { stats.skipped++; continue; }   // получатель больше не подходит (отзыв, отключение) или задачу забрал другой
      const text = buildMessage(it, siteUrl);
      if (!text) { outcome = "permanent"; error = "no_text_for_status"; }
      else {
        let r;
        try { r = await send(it.chat_id, text); }
        catch (e) { outcome = classifyThrown(e); error = outcome === "unknown" ? "no_response" : "network_error"; r = null; }
        if (r) {
          const code = Number(r.status) || 0;
          const body = r.body || {};
          if (r.ok && body.ok !== false) { outcome = "sent"; messageId = body.result && body.result.message_id != null ? String(body.result.message_id) : null; }
          else if (code === 429) { outcome = "retry"; error = "telegram_429"; retryAfter = Number(body.parameters && body.parameters.retry_after) || 30; }
          else if (code === 403) { outcome = "blocked"; error = "telegram_403"; }
          else if (code === 400) { outcome = "permanent"; error = "telegram_400 " + safeError(body.description); }
          else if (code === 401 || code === 404) { outcome = "permanent"; error = "telegram_" + code + "_bot_not_configured"; }
          else if (code >= 500 || code === 0) { outcome = "retry"; error = "telegram_" + (code || "no_status"); }
          else { outcome = "permanent"; error = "telegram_" + code + " " + safeError(body.description); }
        }
      }
    } catch (e) {
      // сбой базы/обработчика ДО отправки — задача вернётся по истечении аренды
      outcome = null; error = safeError(e && e.message);
    }
    if (outcome === null) { stats.failed++; continue; }
    try {
      const done = await rpc("notify_finish", { p_id: it.id, p_worker: worker, p_outcome: outcome, p_error: error || null, p_retry_after: retryAfter, p_message_id: messageId });
      if (!done) { stats.lost++; continue; }
      stats[outcome === "blocked" ? "skipped" : outcome === "permanent" ? "failed" : outcome]++;
    } catch (_) { stats.lost++; }
  }
  return stats;
}
