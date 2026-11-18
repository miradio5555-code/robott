// =====================================================
// ULA FACTORY — карточка клиента: всё о человеке в одном окне.
//
// Открывается из «Клиенты» (кнопка «Карточка» в строке клиента). Строится только из данных, которые сайт
// уже загрузил (заказы кабинета с историей статусов и оплат, карточка клиента, баланс) — без новых запросов
// к базе и без миграций:
//   • контакты и адрес; • заказы всего и в работе; • долг по валютам и просрочка (то же правило, что «Долги»);
//   • оплаты по заказам (из истории); • последние смены статусов; • список заказов;
//   • быстрые действия: новый заказ этому клиенту, повторить последний заказ, написать (WhatsApp / Telegram /
//     позвонить), открыть баланс.
// Теги, заметки и история переписки требуют новых таблиц — см. docs/crm-data-model.md.
//
// ULA.clientcard: open(clientId), summarize(client, orders, now) — расчёт без страницы (tests/clientcard_test.mjs)
// Подключается после app.js, js/debts.js, js/wallet.js, js/templates.js.
// =====================================================
(function (U) {
  "use strict";

  var OVERDUE_DAYS = 7;   // как в js/debts.js: столько дней без оплаты — «просрочено»
  var CLOSED = ["delivered", "cancelled"];

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function dayStart(iso) { return new Date(String(iso).length === 10 ? iso + "T00:00:00" : iso).getTime(); }

  // ---------- Расчёт (без страницы) ----------
  // client: { id, name, phone, telegram, city, address, pickup_point }
  // orders: заказы кабинета (как в state.orders): status, client_id, client_currency, balance_som, profit_som,
  //         order_date, order_number, status_history: [{ event_type, new_status, paid_total, created_at }]
  function summarize(client, orders, now) {
    now = now || Date.now();
    var mine = (orders || []).filter(function (o) { return client && o.client_id === client.id; })
      .sort(function (a, b) { return String(b.order_date).localeCompare(String(a.order_date)) || String(b.order_number).localeCompare(String(a.order_number)); });
    var debt = {}, overdue = {}, payments = [], statuses = [], paidBy = {};
    mine.forEach(function (o) {
      var hist = (o.status_history || []).slice().sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
      // оплаты: в истории хранится «оплачено всего» — сумма платежа = разница с предыдущей отметкой
      var prev = 0, lastPay = 0;
      hist.forEach(function (h) {
        if (h.event_type === "payment" && h.paid_total != null) {
          var d = Math.round((num(h.paid_total) - prev) * 100) / 100;
          prev = num(h.paid_total);
          lastPay = Math.max(lastPay, dayStart(h.created_at));
          if (Math.abs(d) >= 0.01) payments.push({ order: o.order_number, orderId: o.id, amount: d, currency: o.client_currency || "KGS", at: h.created_at });
        } else if (h.new_status) {
          statuses.push({ order: o.order_number, orderId: o.id, status: h.new_status, at: h.created_at });
        }
      });
      if (o.status !== "cancelled") paidBy[o.client_currency || "KGS"] = (paidBy[o.client_currency || "KGS"] || 0) + num(o.paid_amount);
      // долг — только где назначена цена для клиента (иначе «к оплате» = себестоимость, её клиенту не называют)
      if (o.status === "cancelled" || o.profit_som == null || num(o.balance_som) <= 0.5) return;
      var cur = o.client_currency || "KGS";
      debt[cur] = Math.round(((debt[cur] || 0) + num(o.balance_som)) * 100) / 100;
      var ref = Math.max(o.order_date ? dayStart(o.order_date) : 0, lastPay);
      if (ref && Math.floor((now - ref) / 864e5) >= OVERDUE_DAYS) overdue[cur] = Math.round(((overdue[cur] || 0) + num(o.balance_som)) * 100) / 100;
    });
    payments.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    statuses.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    var active = mine.filter(function (o) { return CLOSED.indexOf(o.status) === -1; });
    return {
      orders: mine, active: active, total: mine.length,
      debt: debt, overdue: overdue, hasOverdue: Object.keys(overdue).length > 0, paid: paidBy,
      payments: payments.slice(0, 30), statuses: statuses.slice(0, 20),
      last: mine[0] || null,
      phone: /^\+\d{9,15}$/.test(String(client && client.phone || "").replace(/[\s().-]/g, "")) ? String(client.phone).replace(/[\s().-]/g, "") : "",
      telegram: /^[A-Za-z0-9_]{3,64}$/.test(String(client && client.telegram || "").replace(/^@/, "")) ? String(client.telegram).replace(/^@/, "") : ""
    };
  }

  // ---------- Окно ----------
  var ui = { id: "" };

  function core() { return U.core; }
  function ensureModal() {
    var c = core(), m = document.getElementById("modal-clientcard");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-clientcard";
    m.className = "modal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet">' +
      '<div class="modal-head"><h2 id="cc-title"></h2><button class="icon-btn" type="button" data-close aria-label="' + c.esc(t("close")) + '">×</button></div>' +
      '<div class="modal-body" id="cc-body"></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", onClick);
    return m;
  }

  function sumsText(map) {
    var c = core();
    return Object.keys(map).filter(function (k) { return Math.abs(map[k]) >= 0.005; }).map(function (k) { return c.cur(map[k], k); }).join(" + ");
  }

  function render() {
    var c = core(), esc = c.esc, state = c.state;
    var client = (state.clients || []).filter(function (x) { return x.id === ui.id; })[0];
    if (!client) {   // клиента нет в списке (удалили или ещё не загружен): берём из заказа
      var o0 = (state.orders || []).filter(function (o) { return o.client && o.client.id === ui.id; })[0];
      client = o0 ? o0.client : null;
    }
    var body = document.getElementById("cc-body");
    if (!client) { document.getElementById("cc-title").textContent = t("cc_title"); body.innerHTML = '<p class="muted">' + esc(t("cc_none")) + "</p>"; return; }
    var s = summarize(client, state.orders, Date.now());
    document.getElementById("cc-title").textContent = client.name || t("cp_noname");
    var ro = !!state.readOnly;

    var contacts = [
      s.phone ? '<a class="btn btn-sm" href="tel:' + esc(s.phone) + '">' + esc(t("cc_call")) + "</a>" : "",
      s.phone ? '<a class="btn btn-sm" href="https://wa.me/' + esc(s.phone.slice(1)) + '" target="_blank" rel="noopener">WhatsApp</a>' : "",
      s.telegram ? '<a class="btn btn-sm" href="https://t.me/' + encodeURIComponent(s.telegram) + '" target="_blank" rel="noopener">Telegram</a>' : ""
    ].filter(Boolean).join("");
    var place = client.city ? [client.city, client.address || client.pickup_point].filter(Boolean).join(", ") : "";

    var stat = function (label, value, cls) { return '<div class="cc-stat' + (cls ? " " + cls : "") + '"><span>' + esc(label) + "</span><b>" + esc(value) + "</b></div>"; };
    var debtText = sumsText(s.debt), overText = sumsText(s.overdue), paidText = sumsText(s.paid);

    var html =
      '<div class="cc-head"><dl class="info">' +
        "<div><dt>" + esc(t("l_phone")) + "</dt><dd>" + (client.phone ? esc(c.fmtPhone(client.phone)) : "—") + "</dd></div>" +
        (client.telegram ? "<div><dt>Telegram</dt><dd>@" + esc(String(client.telegram).replace(/^@/, "")) + "</dd></div>" : "") +
        "<div><dt>" + esc(t("l_address")) + "</dt><dd>" + (place ? esc(place) : '<span class="muted">' + esc(t("cl_nocard")) + "</span>") + "</dd></div>" +
      "</dl>" + (contacts ? '<div class="cc-contact" aria-label="' + esc(t("cc_write")) + '">' + contacts + "</div>" : '<p class="fine-print">' + esc(t("cc_no_contact")) + "</p>") + "</div>" +
      '<div class="cc-stats">' +
        stat(t("cc_orders"), String(s.total)) + stat(t("cc_active"), String(s.active.length)) +
        stat(t("cc_debt"), debtText || "0", debtText ? "warn" : "") +
        stat(t("cc_overdue"), overText || "—", overText ? "bad" : "") +
      "</div>" +
      (paidText ? '<p class="fine-print">' + esc(t("cc_paid_total", { s: paidText })) + "</p>" : "") +
      '<div class="card-actions cc-actions">' +
        (ro ? "" : '<button type="button" class="btn btn-primary" data-cc="new">' + esc(t("cc_new_order")) + "</button>") +
        (ro || !s.last ? "" : '<button type="button" class="btn" data-cc="repeat">' + esc(t("cc_repeat_last", { n: s.last.order_number })) + "</button>") +
        (debtText ? '<button type="button" class="btn" data-cc="debt">' + esc(t("cc_open_debt")) + "</button>" : "") +
        (U.wallet && !ro ? '<button type="button" class="btn" data-cc="wallet">' + esc(t("cc_wallet")) + "</button>" : "") +
      "</div>";

    html += "<h3 class=\"money-sub\">" + esc(t("cc_orders_list")) + "</h3>" + (s.orders.length
      ? '<div class="cc-orders">' + s.orders.slice(0, 50).map(function (o) {
          return '<button type="button" class="cc-order" data-cc-order="' + esc(o.id) + '"><span class="pill pill-dot st-' + esc(o.status) + '">' + esc(t("status_" + o.status)) + "</span>" +
            "<b>№ " + esc(o.order_number) + "</b><span class=\"cc-order-p\">" + esc(o.product_ru || "") + "</span><small>" + esc(c.fmtDate(o.order_date)) +
            (o.profit_som != null && num(o.balance_som) > 0.5 && o.status !== "cancelled" ? " · " + esc(t("cc_left", { s: c.cur(o.balance_som, o.client_currency) })) : "") + "</small></button>";
        }).join("") + (s.orders.length > 50 ? '<p class="fine-print">' + esc(t("cc_more", { n: s.orders.length - 50 })) + "</p>" : "") + "</div>"
      : '<p class="muted">' + esc(t("cc_no_orders")) + "</p>");

    html += "<h3 class=\"money-sub\">" + esc(t("cc_payments")) + "</h3>" + (s.payments.length
      ? '<ul class="cc-list">' + s.payments.map(function (p) {
          return "<li><b class=\"" + (p.amount < 0 ? "neg" : "") + "\">" + esc((p.amount > 0 ? "+" : "−") + c.cur(Math.abs(p.amount), p.currency)) + "</b><span>№ " + esc(p.order) + "</span><small>" + esc(c.fmtDate(String(p.at).slice(0, 10))) + "</small></li>";
        }).join("") + "</ul>"
      : '<p class="muted">' + esc(t("cc_no_payments")) + "</p>");

    html += "<h3 class=\"money-sub\">" + esc(t("cc_history")) + "</h3>" + (s.statuses.length
      ? '<ul class="cc-list">' + s.statuses.map(function (h) {
          return "<li><b>" + esc(t("status_" + h.status)) + "</b><span>№ " + esc(h.order) + "</span><small>" + esc(c.fmtDate(String(h.at).slice(0, 10))) + "</small></li>";
        }).join("") + "</ul>"
      : '<p class="muted">' + esc(t("cc_no_history")) + "</p>");

    body.innerHTML = html;
  }

  function onClick(e) {
    var c = core(), b = e.target.closest("[data-cc], [data-cc-order]");
    if (!b) return;
    var orderId = b.getAttribute("data-cc-order");
    if (orderId) { c.closeModal("modal-clientcard"); c.openDetail(orderId); return; }
    var act = b.getAttribute("data-cc"), state = c.state;
    var client = (state.clients || []).filter(function (x) { return x.id === ui.id; })[0];
    var s = summarize(client || { id: ui.id }, state.orders, Date.now());
    c.closeModal("modal-clientcard");
    if (act === "new") {
      c.openOrderForm(null);
      c.setPickedClient(ui.id);   // имя и телефон — из карточки клиента
    } else if (act === "repeat" && s.last) {
      c.openOrderRepeat(s.last);
    } else if (act === "debt") {
      c.switchTab("debts");
    } else if (act === "wallet" && U.wallet) {
      U.wallet.open(U.wallet.keyOf(ui.id), client && client.name);
    }
  }

  function open(id) {
    if (!id) return;
    ui.id = id;
    ensureModal();
    render();
    core().openModal("modal-clientcard");
  }

  U.clientcard = { open: open, summarize: summarize, OVERDUE_DAYS: OVERDUE_DAYS };
})(window.ULA = window.ULA || {});
