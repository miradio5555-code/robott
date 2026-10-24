// =====================================================
// ULA FACTORY — рассылка клиентам через WhatsApp.
//
// Раздел «Клиенты» → «Рассылка»: выбираете, кому (все, кто покупал, должники, давно не заказывали),
// выбираете готовый текст (акция, новое поступление, напоминание об оплате или свой), и по кнопке
// у каждого клиента открывается WhatsApp с уже вставленным текстом. В тексте можно писать {имя} и {долг}.
// Сообщения отправляете вы сами из своего WhatsApp — сайт ничего не отправляет без вас.
// Список клиентов собирается из заказов кабинета (и из раздела «Клиенты», если он открыт).
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, state = c.state;

  var SEGMENTS = ["buyers", "debtors", "sleeping", "all"];
  var TEMPLATES = ["promo", "arrivals", "debt", "custom"];
  var TEXTS = {
    ru: {
      promo: "Здравствуйте, {имя}! У нас скидки на товары из Китая. Напишите, что вас интересует — посчитаю цену и сроки.",
      arrivals: "Здравствуйте, {имя}! Появились новые товары из Китая. Хотите, пришлю фото и цены?",
      debt: "Здравствуйте, {имя}! Напоминаю об оплате заказа: осталось {долг}. Спасибо!"
    },
    en: {
      promo: "Hello, {имя}! We have discounts on products from China. Tell me what you need — I will calculate the price and delivery time.",
      arrivals: "Hello, {имя}! New products from China have arrived. Shall I send you photos and prices?",
      debt: "Hello, {имя}! A reminder about your order payment: {долг} is left to pay. Thank you!"
    },
    zh: {
      promo: "{имя}，您好！我们的中国商品正在打折。告诉我您需要什么，我来计算价格和时间。",
      arrivals: "{имя}，您好！到了一批新的中国商品，需要我发图片和价格给您吗？",
      debt: "{имя}，您好！提醒您订单还需支付 {долг}。谢谢！"
    }
  };

  var bc = { seg: "buyers", tpl: "promo", lang: "ru", text: "", edited: false, list: [], sent: {} };

  function phoneKey(p) { var d = String(p || "").replace(/\D/g, ""); return d.length >= 9 ? d : ""; }

  // Клиенты: из заказов (с суммой долга и датой последнего заказа) + из раздела «Клиенты»
  function people() {
    var map = {};
    (state.orders || []).forEach(function (o) {
      var key = phoneKey((o.client && o.client.phone) || o.client_phone);
      if (!key) return;
      var p = map[key] || (map[key] = { key: key, name: "", phone: key, orders: 0, debt: {}, last: "" });
      p.name = p.name || (o.client && o.client.name) || o.client_name || "";
      if (o.status === "cancelled") return;
      p.orders++;
      var d = String(o.order_date || "").slice(0, 10);
      if (d > p.last) p.last = d;
      var bal = num(o.balance_som);
      if (bal > 0 && num(o.total_som) > 0) p.debt[o.client_currency || ""] = (p.debt[o.client_currency || ""] || 0) + bal;
    });
    (state.clients || []).forEach(function (cl) {
      var key = phoneKey(cl.phone);
      if (!key) return;
      var p = map[key] || (map[key] = { key: key, name: "", phone: key, orders: 0, debt: {}, last: "" });
      p.name = cl.name || p.name;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function debtText(p) {
    return Object.keys(p.debt).map(function (cur) { return money(p.debt[cur]) + " " + cur; }).join(", ");
  }

  function filter(list) {
    var cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    return list.filter(function (p) {
      if (bc.seg === "buyers") return p.orders > 0;
      if (bc.seg === "debtors") return Object.keys(p.debt).length > 0;
      if (bc.seg === "sleeping") return p.orders > 0 && p.last && p.last < cutoff;
      return true;
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
  }

  function message(p) {
    var first = String(p.name || "").trim().split(/\s+/)[0] || "";
    return bc.text.replace(/\{имя\}/g, first).replace(/\{долг\}/g, debtText(p) || "—").replace(/\s+([,!?.])/g, "$1").trim();
  }

  function waLink(p) {
    return "https://wa.me/" + p.phone + "?text=" + encodeURIComponent(message(p));
  }

  function chips(items, active, keyPrefix, attr, counts) {
    return items.map(function (k) {
      return '<button type="button" class="chip' + (k === active ? " active" : "") + '" data-' + attr + '="' + k + '"><span>' +
        esc(t(keyPrefix + k)) + "</span>" + (counts ? "<b>" + counts[k] + "</b>" : "") + "</button>";
    }).join("");
  }

  function render() {
    var all = people(), counts = {};
    SEGMENTS.forEach(function (s) { var keep = bc.seg; bc.seg = s; counts[s] = filter(all).length; bc.seg = keep; });
    bc.list = filter(all);
    $("#bc-segs").innerHTML = chips(SEGMENTS, bc.seg, "bc_seg_", "bc-seg", counts);
    $("#bc-tpls").innerHTML = chips(TEMPLATES, bc.tpl, "bc_tpl_", "bc-tpl");
    $$("#modal-broadcast [data-bc-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-bc-lang") === bc.lang)); });
    if (!bc.edited && bc.tpl !== "custom") bc.text = TEXTS[bc.lang][bc.tpl];
    if ($("#bc-text").value !== bc.text) $("#bc-text").value = bc.text;
    renderList();
  }

  function renderList() {
    var left = bc.list.filter(function (p) { return !bc.sent[p.key]; }).length;
    $("#bc-count").textContent = t("bc_count", { n: bc.list.length, left: left });
    $("#bc-next").disabled = !left || !bc.text.trim();
    $("#bc-next").textContent = left ? t("bc_next", { n: left }) : t("bulk_q_all");
    if (!bc.list.length) { $("#bc-list").innerHTML = '<p class="muted bc-none">' + esc(t("bc_none")) + "</p>"; return; }
    $("#bc-list").innerHTML = bc.list.map(function (p) {
      var done = !!bc.sent[p.key], debt = debtText(p);
      return '<div class="bq-row' + (done ? " done" : "") + '"><div><b>' + esc(p.name || "—") + "</b><span>" + esc(c.fmtPhone("+" + p.phone)) +
        (debt ? " · " + esc(t("bc_owes", { s: debt })) : "") + '</span></div>' +
        '<a class="btn btn-sm ' + (done ? "" : "btn-primary") + '" target="_blank" rel="noopener" data-bc-send="' + esc(p.key) + '" href="' + esc(waLink(p)) + '">' +
        esc(done ? "✓ " + t("bulk_q_again") : "WhatsApp") + "</a></div>";
    }).join("");
  }

  function open() {
    bc.sent = {};
    bc.edited = false;
    bc.lang = (typeof getLang === "function" && TEXTS[getLang()]) ? getLang() : "ru";
    render();
    c.openModal("modal-broadcast");
  }

  function bind() {
    $("#bc-btn").addEventListener("click", open);
    var modal = $("#modal-broadcast");
    modal.addEventListener("click", function (e) {
      var s = e.target.closest("[data-bc-seg]"), tp = e.target.closest("[data-bc-tpl]"), lg = e.target.closest("[data-bc-lang]");
      if (s) { bc.seg = s.getAttribute("data-bc-seg"); bc.sent = {}; render(); return; }
      if (tp) {
        bc.tpl = tp.getAttribute("data-bc-tpl"); bc.edited = false;
        if (bc.tpl === "custom") bc.text = "";
        if (bc.tpl === "debt") bc.seg = "debtors";
        render(); if (bc.tpl === "custom") $("#bc-text").focus(); return;
      }
      if (lg) { bc.lang = lg.getAttribute("data-bc-lang"); bc.edited = false; render(); return; }
      var send = e.target.closest("[data-bc-send]");
      if (send) {
        if (!bc.text.trim()) { e.preventDefault(); toast(t("bc_e_text"), "error"); return; }
        bc.sent[send.getAttribute("data-bc-send")] = true;
        setTimeout(renderList, 50);   // ссылка открывается в WhatsApp, список отмечаем сразу после
      }
    });
    $("#bc-text").addEventListener("input", function (e) { bc.text = e.target.value; bc.edited = true; renderList(); });
    $("#bc-next").addEventListener("click", function () {
      var p = bc.list.filter(function (x) { return !bc.sent[x.key]; })[0];
      if (!p) return;
      bc.sent[p.key] = true;
      window.open(waLink(p), "_blank", "noopener");
      renderList();
    });
  }

  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  U.broadcast = { bind: bind, open: open, _people: people };
})(window.ULA);
