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
  // Пишем как живой человек: приветствие по времени суток, что с заказом, что будет дальше, подпись байера.
  // {order} — «заказ «Кроссовки» (№ CN-000007)», остальное подставляет код ниже.
  // Глаголы без рода («принят», «закупаем»), чтобы текст подходил и байеру, и байерше.
  var TXT = {
    ru: {
      hello: function (n, h) {
        var g = h >= 5 && h < 12 ? "Доброе утро" : h >= 12 && h < 18 ? "Добрый день" : h >= 18 && h < 23 ? "Добрый вечер" : "Здравствуйте";
        return n ? g + ", " + n + "!" : g + "!";
      },
      order: function (num_, prod) { return prod ? "заказ «" + prod + "» (№ " + num_ + ")" : "заказ № " + num_; },
      status: {
        "new":              "Ваш {order} принят — уже занимаемся им 👍\nУточним цену и сроки и сразу напишем вам.",
        awaiting_payment:   "Ваш {order} готов к оплате.",
        purchasing:         "Спасибо за оплату! 🙏\nВаш {order} уже закупаем у поставщика. Как только товар придёт на наш склад в Китае — сообщим.",
        china_warehouse:    "Хорошая новость: ваш {order} уже на нашем складе в Китае 📦\nГотовим к отправке — скоро он поедет к вам.",
        in_transit:         "Ваш {order} уже в пути 🚚\nКак только прибудет — сразу дадим знать.",
        arrived:            "Ваш {order} прибыл! 🎉",
        delivered:          "Ваш {order} у вас — спасибо, что выбрали нас! 🙏\nЕсли будут вопросы или захотите заказать что-то ещё — мы всегда на связи.",
        cancelled:          "Ваш {order} отменён.\nЕсли это ошибка или хотите заказать что-то другое — просто напишите, всё решим."
      },
      next: {
        awaiting_payment: "Как оплатите — сразу закажем товар у поставщика 🙌",
        awaiting_rest:    "Как доплатите — сразу закажем товар у поставщика 🙌",
        arrived:          "Напишите, когда вам удобно забрать, или куда привезти."
      },
      pay: function (total, paid, left, paidSome) {
        return paidSome
          ? "Сумма заказа — " + total + ", вы уже оплатили " + paid + ". Осталось доплатить " + left + "."
          : "К оплате — " + total + ".";
      },
      paidFull: "Заказ оплачен полностью — спасибо! ✅",
      addr: "Чтобы доставить без задержек, укажите, пожалуйста, адрес или пункт выдачи по ссылке ниже 👇",
      link: "Всё о заказе — по этой ссылке:",
      track: "Трек-номер для отслеживания: ",
      sign: function (who) { return "— " + who; }
    },
    en: {
      hello: function (n, h) {
        var g = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : h >= 18 && h < 23 ? "Good evening" : "Hello";
        return n ? g + ", " + n + "!" : g + "!";
      },
      order: function (num_, prod) { return prod ? "order \u201c" + prod + "\u201d (No. " + num_ + ")" : "order No. " + num_; },
      status: {
        "new":              "We've got your {order} and we're already on it 👍\nWe'll check the price and timing and get back to you shortly.",
        awaiting_payment:   "Your {order} is ready for payment.",
        purchasing:         "Thank you for your payment! 🙏\nWe're now buying your {order} from the supplier. We'll let you know as soon as it reaches our warehouse in China.",
        china_warehouse:    "Good news: your {order} is already at our warehouse in China 📦\nWe're getting it ready — it will be on its way to you soon.",
        in_transit:         "Your {order} is on its way 🚚\nWe'll message you as soon as it arrives.",
        arrived:            "Your {order} has arrived! 🎉",
        delivered:          "Your {order} is with you — thank you for choosing us! 🙏\nIf you have any questions or want to order something else, we're always here.",
        cancelled:          "Your {order} has been cancelled.\nIf this is a mistake or you'd like something else, just message us and we'll sort it out."
      },
      next: {
        awaiting_payment: "As soon as you pay, we'll order the goods from the supplier 🙌",
        awaiting_rest:    "As soon as you pay the rest, we'll order the goods from the supplier 🙌",
        arrived:          "Let us know when it suits you to pick it up, or where to deliver it."
      },
      pay: function (total, paid, left, paidSome) {
        return paidSome
          ? "The order total is " + total + ", you've already paid " + paid + ". " + left + " is left to pay."
          : "Amount to pay: " + total + ".";
      },
      paidFull: "Your order is fully paid — thank you! ✅",
      addr: "To deliver without delays, please add your address or pickup point using the link below 👇",
      link: "Everything about your order is here:",
      track: "Tracking number: ",
      sign: function (who) { return "— " + who; }
    },
    zh: {
      hello: function (n, h) {
        var g = h >= 5 && h < 12 ? "早上好" : h >= 12 && h < 18 ? "下午好" : h >= 18 && h < 23 ? "晚上好" : "您好";
        return n ? n + "，" + g + "！" : g + "！";
      },
      order: function (num_, prod) { return prod ? "订单「" + prod + "」（编号 " + num_ + "）" : "订单 " + num_; },
      status: {
        "new":              "您的{order}已收到，我们正在处理 👍\n确认好价格和时间后会马上联系您。",
        awaiting_payment:   "您的{order}可以付款了。",
        purchasing:         "感谢您的付款！🙏\n我们正在向供应商采购您的{order}，货到我们中国仓库后会第一时间通知您。",
        china_warehouse:    "好消息：您的{order}已经到达我们的中国仓库 📦\n正在准备发货，很快就会寄给您。",
        in_transit:         "您的{order}已经在路上了 🚚\n到货后我们会马上通知您。",
        arrived:            "您的{order}到货了！🎉",
        delivered:          "您的{order}已交付，感谢您选择我们！🙏\n如有任何问题或想再下单，随时联系我们。",
        cancelled:          "您的{order}已取消。\n如果是误操作或想换别的商品，直接告诉我们就好。"
      },
      next: {
        awaiting_payment: "付款后我们会立即向供应商下单 🙌",
        awaiting_rest:    "付清余款后我们会立即向供应商下单 🙌",
        arrived:          "请告诉我们您方便取货的时间，或需要送到哪里。"
      },
      pay: function (total, paid, left, paidSome) {
        return paidSome
          ? "订单金额 " + total + "，您已支付 " + paid + "，还需支付 " + left + "。"
          : "应付金额：" + total + "。";
      },
      paidFull: "订单已全部付清，谢谢！✅",
      addr: "为了顺利送达，请通过下方链接填写收货地址或自提点 👇",
      link: "订单详情请看这里：",
      track: "物流单号：",
      sign: function (who) { return "—— " + who; }
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

  // В приветствии — только имя (первое слово): «Азамат», а не «Азамат Касымов уулу»
  function shortName(name) {
    name = String(name || "").trim().split(/\s+/)[0] || "";
    return name && name.length <= 20 && !/\d/.test(name) ? name : "";
  }

  // Подпись: имя байера и название кабинета — «— Айгерим, Б-Карго»
  function signature() {
    var me = (state.me && String(state.me.name || "").trim().split(/\s+/)[0]) || "";
    var ws = (state.ws && String(state.ws.name || "").trim()) || "";
    if (me && ws && ws.toLowerCase().indexOf(me.toLowerCase()) === -1) return me + ", " + ws;
    return ws || me;
  }

  function buildText(o, lang, link) {
    var T = TXT[lang] || TXT.ru;
    var prod = String(lang === "zh" ? (o.product_zh || o.product_ru) : o.product_ru || "").trim();
    if (prod.length > 50) prod = prod.slice(0, 47) + "…";
    var orderPhrase = T.order(o.order_number, prod);
    var lines = [T.hello(shortName(o.client_name), new Date().getHours()), ""];
    lines.push((T.status[o.status] || T.status["new"]).replace("{order}", orderPhrase));

    // Суммы — только если байер указал цену для клиента (иначе «к оплате» = себестоимость)
    var showMoney = o.profit_som != null && num(o.total_som) > 0 && (o.status === "awaiting_payment" || o.status === "arrived");
    var left = num(o.balance_som);
    if (showMoney) {
      lines.push(left > 0
        ? T.pay(money(o.total_som, o.client_currency), money(o.paid_amount, o.client_currency), money(left, o.client_currency), num(o.paid_amount) > 0)
        : T.paidFull);
    }
    // что делать клиенту дальше (за оплату не просим, если уже всё оплачено)
    var needAddr = !o.client && link && ["china_warehouse", "in_transit", "arrived"].indexOf(o.status) !== -1;
    var next = o.status === "awaiting_payment" && showMoney && num(o.paid_amount) > 0 ? T.next.awaiting_rest : T.next[o.status];
    if (o.status === "awaiting_payment" && showMoney && left <= 0) next = "";
    if (o.status === "arrived" && needAddr) next = "";   // про адрес и так спросим ниже
    if (next) lines.push(next);
    // трек-номер — когда посылка уже отправлена
    var trk = String(o.tracking_number || "").trim();
    if (trk && ["in_transit", "arrived"].indexOf(o.status) !== -1) { lines.push(""); lines.push(T.track + trk); }
    // нет данных доставки — просим заполнить по ссылке
    if (needAddr) { lines.push(""); lines.push(T.addr); }
    if (link) { if (!needAddr) lines.push(""); lines.push(T.link); lines.push(link); }
    var who = signature();
    if (who) { lines.push(""); lines.push(T.sign(who)); }
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
