// =====================================================
// ULA FACTORY — «Сообщить клиенту».
// Готовый текст под статус заказа → WhatsApp / Telegram / копирование.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
//
// Важно: в сообщение попадают ТОЛЬКО те суммы, которые клиент и так видит
// на своей странице (к оплате / оплачено / осталось). Себестоимость,
// прибыль и цены поставщика сюда не попадают никогда.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, toast = c.toast, cur = c.cur, num = c.num, state = c.state,
      openModal = c.openModal, fmtPhone = c.fmtPhone;

  var LANG_KEY = "cc_notify_lang";   // язык сообщений клиенту (помним выбор)
  var AUTO_KEY = "cc_notify_auto";   // "0" — не открывать окно после смены статуса

  // ---------- Тексты сообщений: по языкам ----------
  // {order} — «заказ № CN-000007 («Кроссовки»)», остальное подставляет код ниже
  var TXT = {
    ru: {
      hello: function (n) { return n ? "Здравствуйте, " + n + "!" : "Здравствуйте!"; },
      order: function (num_, prod) { return "заказ № " + num_ + (prod ? " («" + prod + "»)" : ""); },
      status: {
        "new":              "Ваш {order} принят в работу.",
        awaiting_payment:   "Ваш {order} ждёт оплаты.",
        purchasing:         "Ваш {order}: оплата получена, закупаем товар у поставщика.",
        china_warehouse:    "Ваш {order} пришёл на наш склад в Китае. Скоро отправим.",
        in_transit:         "Ваш {order} отправлен и уже в пути.",
        arrived:            "Ваш {order} прибыл! 🎉",
        delivered:          "Ваш {order} выдан. Спасибо, что выбрали нас!",
        cancelled:          "Ваш {order} отменён. Если это ошибка — напишите мне."
      },
      pay: function (total, paid, left) { return "К оплате: " + total + ". Оплачено: " + paid + ". Осталось: " + left + "."; },
      paidFull: "Оплата получена полностью ✅",
      addr: "Пожалуйста, укажите данные для доставки по ссылке ниже.",
      link: "Следить за заказом:",
      track: "Трек-номер: "
    },
    en: {
      hello: function (n) { return n ? "Hello, " + n + "!" : "Hello!"; },
      order: function (num_, prod) { return "order " + num_ + (prod ? " (\"" + prod + "\")" : ""); },
      status: {
        "new":              "Your {order} has been accepted.",
        awaiting_payment:   "Your {order} is waiting for payment.",
        purchasing:         "Your {order}: payment received, we are buying the goods from the supplier.",
        china_warehouse:    "Your {order} has arrived at our warehouse in China. We will ship it soon.",
        in_transit:         "Your {order} has been shipped and is on its way.",
        arrived:            "Your {order} has arrived! 🎉",
        delivered:          "Your {order} has been handed over. Thank you for choosing us!",
        cancelled:          "Your {order} has been cancelled. If this is a mistake, please message me."
      },
      pay: function (total, paid, left) { return "Total: " + total + ". Paid: " + paid + ". Remaining: " + left + "."; },
      paidFull: "Fully paid ✅",
      addr: "Please enter your delivery details using the link below.",
      link: "Track your order:",
      track: "Tracking number: "
    },
    zh: {
      hello: function (n) { return n ? "您好，" + n + "！" : "您好！"; },
      order: function (num_, prod) { return "订单 " + num_ + (prod ? "（" + prod + "）" : ""); },
      status: {
        "new":              "您的{order}已受理。",
        awaiting_payment:   "您的{order}正在等待付款。",
        purchasing:         "您的{order}已收到付款，正在向供应商采购。",
        china_warehouse:    "您的{order}已到达我们在中国的仓库，即将发出。",
        in_transit:         "您的{order}已发出，正在运输途中。",
        arrived:            "您的{order}已到货！🎉",
        delivered:          "您的{order}已交付，感谢您的信任！",
        cancelled:          "您的{order}已取消。如有疑问请联系我。"
      },
      pay: function (total, paid, left) { return "应付：" + total + "。已付：" + paid + "。待付：" + left + "。"; },
      paidFull: "已全额付款 ✅",
      addr: "请通过下方链接填写收货信息。",
      link: "查看订单进度：",
      track: "物流单号："
    }
  };

  var cd = { order: null, custom: null, lang: "ru", afterStatus: false, hasPrice: true, hasLink: true, tgUser: "" };

  // ---------- Настройки (помним в браузере) ----------
  function getLang() {
    try { var l = localStorage.getItem(LANG_KEY); if (TXT[l]) return l; } catch (e) { /* ignore */ }
    return "ru";
  }
  function autoEnabled() {
    try { return localStorage.getItem(AUTO_KEY) !== "0"; } catch (e) { return true; }
  }

  // ---------- Сборка текста ----------
  // Деньги: убираем «неразрывные» пробелы, чтобы текст в мессенджере был обычным
  function money(n, code) { return cur(n, code).replace(/[  ]/g, " "); }

  function shortName(name) {
    name = String(name || "").trim();
    return name && name.length <= 30 ? name : "";
  }

  function buildText(o, lang, link) {
    var T = TXT[lang] || TXT.ru;
    var prod = String(lang === "zh" ? (o.product_zh || o.product_ru) : o.product_ru || "").trim();
    if (prod.length > 60) prod = prod.slice(0, 57) + "…";
    var orderPhrase = T.order(o.order_number, prod);
    var lines = [T.hello(shortName(o.client_name)), ""];
    lines.push((T.status[o.status] || T.status["new"]).replace("{order}", orderPhrase));

    // Суммы — только если байер указал цену для клиента (иначе «к оплате» = себестоимость)
    var showMoney = o.profit_som != null && num(o.total_som) > 0 && (o.status === "awaiting_payment" || o.status === "arrived");
    if (showMoney) {
      var left = num(o.balance_som);
      lines.push(left > 0
        ? T.pay(money(o.total_som, o.client_currency), money(o.paid_amount, o.client_currency), money(left, o.client_currency))
        : T.paidFull);
    }
    // Нет данных доставки — просим заполнить по ссылке
    // трек-номер — когда посылка уже отправлена
    var trk = String(o.tracking_number || "").trim();
    if (trk && ["in_transit", "arrived"].indexOf(o.status) !== -1) lines.push(T.track + trk);
    var needAddr = !o.client && link && ["china_warehouse", "in_transit", "arrived"].indexOf(o.status) !== -1;
    if (needAddr) lines.push(T.addr);
    if (link) { lines.push(""); lines.push(T.link); lines.push(link); }
    return lines.join("\n");
  }

  // ---------- Контакты клиента ----------
  function clientPhone(o) {
    var p = String((o.client && o.client.phone) || o.client_phone || "").replace(/[\s().-]/g, "");
    return /^\+\d{9,15}$/.test(p) ? p : "";   // для wa.me нужен международный номер
  }
  function clientTelegram(o) {
    var t = String((o.client && o.client.telegram) || "").trim().replace(/^@/, "");
    return /^[A-Za-z0-9_]{3,32}$/.test(t) ? t : "";
  }

  // ---------- Окно ----------
  function open(o, opts) {
    if (!o) return;
    opts = opts || {};
    cd.order = o;
    cd.custom = null;
    cd.afterStatus = !!opts.afterStatus;
    cd.lang = getLang();
    cd.hasLink = !!c.clientUrl(o);
    cd.hasPrice = o.profit_som != null;
    cd.tgUser = clientTelegram(o);

    $("#notify-title").textContent = cd.afterStatus
      ? t("notify_after_status", { s: t("status_" + o.status) })
      : t("notify_title");
    $("#notify-sub").textContent = "№ " + o.order_number + " · " + (o.client_name || "");
    $("#notify-auto").checked = autoEnabled();
    $("#notify-auto-row").classList.remove("hidden");
    $("#notify-later").textContent = t(cd.afterStatus ? "notify_later" : "close");
    fillText();
    openModal("modal-notify");
  }

  // Окно с любым готовым текстом (например, напоминание о долге).
  // cfg: { title, sub, build(lang) → текст, phone, tg, warn, onSent() — вызывается при отправке/копировании }
  function openText(cfg) {
    cd.order = null;
    cd.custom = cfg;
    cd.afterStatus = false;
    cd.lang = getLang();
    cd.tgUser = cfg.tg || "";
    $("#notify-title").textContent = cfg.title;
    $("#notify-sub").textContent = cfg.sub || "";
    $("#notify-auto-row").classList.add("hidden");   // «предлагать после смены статуса» тут не нужно
    $("#notify-later").textContent = t("close");
    fillText();
    openModal("modal-notify");
  }

  function sent() { if (cd.custom && cd.custom.onSent) cd.custom.onSent(); }

  function fillText() {
    if (cd.custom) {
      $$("#modal-notify [data-nl]").forEach(function (b) {
        var on = b.getAttribute("data-nl") === cd.lang;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      $("#notify-text").value = cd.custom.build(cd.lang);
      $("#notify-warn").textContent = cd.custom.warn || "";
      $("#notify-warn").classList.toggle("hidden", !cd.custom.warn);
      $("#notify-to").textContent = cd.custom.phone ? t("notify_to", { p: fmtPhone(cd.custom.phone) }) : t("notify_to_none");
      $("#notify-tg").textContent = cd.tgUser ? t("notify_tg_user", { u: cd.tgUser }) : t("notify_tg");
      refreshLinks();
      return;
    }
    var o = cd.order;
    $$("#modal-notify [data-nl]").forEach(function (b) {
      var on = b.getAttribute("data-nl") === cd.lang;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    $("#notify-text").value = buildText(o, cd.lang, c.clientUrl(o));

    var needsPrice = !cd.hasPrice && (o.status === "awaiting_payment" || o.status === "arrived");
    var warn = !cd.hasLink ? t("notify_no_link") : (needsPrice ? t("notify_no_price") : "");
    $("#notify-warn").textContent = warn;
    $("#notify-warn").classList.toggle("hidden", !warn);

    var phone = clientPhone(o);
    $("#notify-to").textContent = phone ? t("notify_to", { p: fmtPhone(phone) }) : t("notify_to_none");
    $("#notify-tg").textContent = cd.tgUser ? t("notify_tg_user", { u: cd.tgUser }) : t("notify_tg");
    refreshLinks();
  }

  // Кнопки «WhatsApp» / «Telegram» всегда отправляют то, что сейчас в поле (байер мог поправить текст)
  function refreshLinks() {
    var o = cd.order, text = $("#notify-text").value;
    var phone = cd.custom ? (cd.custom.phone || "") : clientPhone(o);
    $("#notify-wa").href = "https://wa.me/" + phone.replace(/\D/g, "") + "?text=" + encodeURIComponent(text);

    var link = cd.custom ? "" : c.clientUrl(o);
    if (cd.tgUser) {
      $("#notify-tg").href = "https://t.me/" + cd.tgUser;   // откроется чат; текст копируем при нажатии
    } else if (link && text.indexOf(link) !== -1) {
      $("#notify-tg").href = "https://t.me/share/url?url=" + encodeURIComponent(link) +
        "&text=" + encodeURIComponent(text.replace(link, "").trim());
    } else {
      $("#notify-tg").href = "https://t.me/share/url?url=" + encodeURIComponent(text);
    }
  }

  function bind() {
    $$("#modal-notify [data-nl]").forEach(function (b) {
      b.addEventListener("click", function () {
        cd.lang = b.getAttribute("data-nl");
        try { localStorage.setItem(LANG_KEY, cd.lang); } catch (e) { /* ignore */ }
        fillText();
      });
    });
    $("#notify-text").addEventListener("input", refreshLinks);
    $("#notify-wa").addEventListener("click", sent);
    $("#notify-copy").addEventListener("click", async function () {
      var ok = await c.copyText($("#notify-text").value);
      if (ok) sent();
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
    $("#notify-tg").addEventListener("click", function () {
      // в чат с @логином текст не передать — копируем, клиенту останется вставить
      sent();
      if (cd.tgUser) c.copyText($("#notify-text").value).then(function (ok) { if (ok) toast(t("notify_tg_copied"), "ok"); });
    });
    $("#notify-auto").addEventListener("change", function () {
      try { localStorage.setItem(AUTO_KEY, this.checked ? "1" : "0"); } catch (e) { /* ignore */ }
    });
    $("#notify-later").addEventListener("click", function () { c.closeModal("modal-notify"); });
  }

  U.notify = { open: open, openText: openText, bind: bind, autoEnabled: autoEnabled, _build: buildText };
})(window.ULA);
