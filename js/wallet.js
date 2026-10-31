// =====================================================
// ULA FACTORY — баланс клиента (предоплата, файл 50).
//
// Клиент платит заранее → «Пополнить»: деньги лежат на его счету и, если надо, сразу
// закрывают долги по заказам (сначала старые). В заказе — «Оплатить с баланса» и
// «Вернуть оплату на баланс». Выписка: каждое движение отдельной строкой, владелец может
// отменить ошибочную. Клиент видит баланс и выписку по своей общей ссылке (js/client.js).
//
// Клиент — как в «Долгах»: последние 9 цифр телефона, иначе имя (одинаково с базой: client_key).
// Пока файл 50 не запущен, кнопок баланса нет — сайт работает как раньше.
//
// ULA.wallet: load(), chip(key, name), orderHtml(o), debtsNote(), keyOf(phone, name)
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, num = c.num, cur = c.cur, state = c.state, toast = c.toast;

  var ready = false;            // файл 50 запущен
  var totals = {};              // ключ клиента → { name, sums: { KGS: 10500 } }
  var ui = { key: "", name: "", rows: [], mode: "", busy: false, loaded: false };

  function keyOf(phone, name) {
    var p = String(phone || "").replace(/\D/g, "");
    return p.length >= 9 ? "p" + p.slice(-9) : "n" + String(name || "").trim().toLowerCase();
  }
  function orderKey(o) {
    return keyOf((o.client && o.client.phone) || o.client_phone, (o.client && o.client.name) || o.client_name);
  }
  function sums(key) { return (totals[key] && totals[key].sums) || {}; }
  function signed(n, code) { return (n > 0 ? "+" : n < 0 ? "−" : "") + cur(Math.abs(n), code); }
  function sumsText(s) {
    var k = Object.keys(s).filter(function (x) { return Math.abs(s[x]) >= 0.005; });
    return k.length ? k.map(function (x) { return signed(s[x], x); }).join(" · ") : "";
  }

  // долги клиента по заказам (как в «Долгах»: только заказы с ценой для клиента)
  function debts(key) {
    var out = {}, n = {};
    (state.orders || []).forEach(function (o) {
      if (o.status === "cancelled" || o.profit_som == null || num(o.balance_som) <= 0.005 || orderKey(o) !== key) return;
      out[o.client_currency] = (out[o.client_currency] || 0) + num(o.balance_som);
      n[o.client_currency] = (n[o.client_currency] || 0) + 1;
    });
    return { sums: out, n: n };
  }

  // ---------- Загрузка ----------
  function load() {
    var db = c.db();
    if (!state.ws || !db) { totals = {}; return Promise.resolve(); }
    var ws = state.ws.id;
    return db.rpc("wallet_totals", { p_ws: ws }).then(function (r) {
      if (!state.ws || state.ws.id !== ws) return;
      ready = !r.error;
      totals = {};
      (r.data || []).forEach(function (x) {
        var t0 = totals[x.ckey] || (totals[x.ckey] = { name: x.client_name, sums: {} });
        t0.sums[x.currency] = num(x.amount);
      });
      if (isOpen()) render();
    }).catch(function () { ready = false; });
  }

  // ---------- Значок «Баланс» (Долги, Клиенты) ----------
  function chip(key, name) {
    if (!ready || !key) return "";
    var s = sums(key), txt = sumsText(s);
    var neg = Object.keys(s).some(function (x) { return s[x] < 0; });
    return '<button type="button" class="wallet-chip' + (txt ? (neg ? " neg" : " pos") : "") + '" data-wallet="' + esc(key) + '" data-wallet-name="' + esc(name || "") + '">' +
      U.icon("wallet", 14) + "<span>" + esc(t("wl_chip")) + (txt ? ": <b>" + txt + "</b>" : "") + "</span></button>";
  }

  // «Предоплата клиентов: …» над списком должников
  function debtsNote() {
    if (!ready) return "";
    var all = {};
    Object.keys(totals).forEach(function (k) {
      var s = totals[k].sums;
      Object.keys(s).forEach(function (x) { if (s[x] > 0) all[x] = (all[x] || 0) + s[x]; });
    });
    var txt = Object.keys(all).map(function (x) { return cur(all[x], x); }).join(" + ");
    return txt ? '<p class="wallet-note">' + U.icon("wallet", 15) + esc(t("wl_prepaid")) + ": <b>" + txt + "</b></p>" : "";
  }

  // ---------- В карточке заказа ----------
  function orderHtml(o) {
    if (!ready || !o) return "";
    var key = orderKey(o), code = o.client_currency, have = num(sums(key)[code]);
    var due = o.status !== "cancelled" ? Math.max(0, num(o.balance_som)) : 0;
    var name = (o.client && o.client.name) || o.client_name || "";
    var h = "";
    if (have > 0.005 && due > 0.005) {
      h += '<button type="button" class="btn btn-primary" data-wallet-pay="' + esc(o.id) + '" data-write>' +
        esc(t("wl_pay", { s: cur(Math.min(have, due), code) })) + "</button>";
    }
    if (num(o.paid_amount) > 0.005) {
      h += '<button type="button" class="btn btn-light" data-wallet-back="' + esc(o.id) + '" data-write>' + esc(t("wl_back")) + "</button>";
    }
    return '<div class="wallet-order">' +
      '<button type="button" class="wallet-order-line" data-wallet="' + esc(key) + '" data-wallet-name="' + esc(name) + '">' + U.icon("wallet", 16) +
        "<span>" + esc(t("wl_balance_line", { s: "" })) + "<b>" + (sumsText(sums(key)) || cur(0, code)) + "</b></span><i>›</i></button>" +
      (h ? '<div class="wallet-order-btns">' + h + "</div>" : "") +
    "</div>";
  }

  // ---------- Окно «Баланс клиента» ----------
  function ensureModal() {
    var m = $("#modal-wallet");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-wallet";
    m.className = "modal modal-small";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="wl-title">' +
      '<div class="modal-head"><h2 id="wl-title"></h2><button class="icon-btn" type="button" data-close aria-label="Close">×</button></div>' +
      '<div class="modal-body" id="wl-body"></div></div>';
    document.body.appendChild(m);
    m.addEventListener("submit", function (e) { if (e.target.id === "wl-form") { e.preventDefault(); save(); } });
    m.addEventListener("change", function (e) { if (e.target.id === "wl-cur") renderApply(); });
    m.addEventListener("input", function (e) { if (e.target.id === "wl-sum") renderApply(); });
    return m;
  }
  function isOpen() { var m = $("#modal-wallet"); return !!(m && m.classList.contains("open")); }

  function open(key, name) {
    ui.key = key; ui.name = name || (totals[key] && totals[key].name) || ""; ui.rows = []; ui.mode = ""; ui.loaded = false;
    ensureModal();
    render();
    c.openModal("modal-wallet");
    history();
  }

  function history() {
    var key = ui.key;
    return c.db().from("client_wallet").select("id, kind, amount, currency, order_id, order_number, note, created_at")
      .eq("workspace_id", state.ws.id).eq("ckey", key).order("created_at", { ascending: false }).limit(100)
      .then(function (r) {
        if (key !== ui.key) return;
        if (r.error) { c.handleError(r.error); return; }
        ui.rows = r.data || []; ui.loaded = true;
        render();
      });
  }

  function currencies() {
    var list = [], d = debts(ui.key).sums, s = sums(ui.key);
    [(state.ws && state.ws.default_client_currency) || "KGS"].concat(Object.keys(d), Object.keys(s), ["KGS", "CNY", "USD"]).forEach(function (x) {
      if (x && list.indexOf(x) === -1) list.push(x);
    });
    return list;
  }

  function render() {
    var body = $("#wl-body");
    if (!body) return;
    $("#wl-title").textContent = t("wl_title") + (ui.name ? " · " + ui.name : "");
    var s = sums(ui.key), d = debts(ui.key).sums, codes = currencies().filter(function (x) { return s[x] || d[x]; });
    if (!codes.length) codes = [currencies()[0]];
    var owner = !c.state.myRole || c.state.myRole === "owner";

    var big = codes.map(function (x) {
      var b = num(s[x]), debt = num(d[x]), net = b - debt;
      return '<div class="wl-cur">' +
        '<div class="wl-big ' + (b > 0 ? "pos" : b < 0 ? "neg" : "") + '">' + signed(b, x) + "</div>" +
        (debt > 0.005 ? '<div class="wl-sub"><span>' + esc(t("wl_debt")) + "</span><b class=\"neg\">−" + cur(debt, x) + "</b></div>" +
          '<div class="wl-sub"><span>' + esc(t("wl_net")) + '</span><b class="' + (net < 0 ? "neg" : "pos") + '">' + signed(net, x) + "</b></div>" : "") +
      "</div>";
    }).join("");
    var hasPlus = codes.some(function (x) { return num(s[x]) > 0; });

    var acts = ui.mode ? formHtml() :
      '<div class="wl-acts">' +
        '<button type="button" class="btn btn-primary" data-wl-mode="deposit" data-write>' + esc(t("wl_btn_add")) + "</button>" +
        (hasPlus ? '<button type="button" class="btn btn-light" data-wl-mode="withdraw" data-write>' + esc(t("wl_btn_out")) + "</button>" : "") +
      "</div>";

    var rows = !ui.loaded ? '<p class="muted">…</p>' : ui.rows.length ? '<ol class="wl-list">' + ui.rows.map(function (r) {
      var a = num(r.amount);
      var title = r.kind === "order" ? t("wl_k_order", { n: r.order_number || "—" })
        : r.kind === "return" ? t("wl_k_return", { n: r.order_number || "—" }) : t("wl_k_" + r.kind);
      var note = r.note === "deleted" ? t("wl_deleted") : r.note;
      return '<li class="wl-row">' +
        '<div class="wl-row-main">' + (r.order_id ? '<button type="button" class="link-btn" data-wl-order="' + esc(r.order_id) + '">' + esc(title) + "</button>" : "<b>" + esc(title) + "</b>") +
          '<small class="muted">' + esc(c.fmtTime(r.created_at)) + (note ? " · " + esc(note) : "") + "</small></div>" +
        '<b class="wl-amt ' + (a > 0 ? "pos" : "neg") + '">' + signed(a, r.currency) + "</b>" +
        (owner ? '<button type="button" class="icon-btn wl-undo" data-wl-undo="' + esc(r.id) + '" data-write title="' + esc(t("wl_undo")) + '" aria-label="' + esc(t("wl_undo")) + '">↶</button>' : "") +
      "</li>";
    }).join("") + "</ol>" : '<p class="muted wl-empty">' + esc(t("wl_empty")) + "</p>";

    body.innerHTML = '<div class="wl-head">' + big + "</div>" + acts +
      '<h3 class="wl-h">' + esc(t("wl_history")) + "</h3>" + rows;
    if (ui.mode) {
      c.fillCurrencySelect($("#wl-cur"), ui.cur || currencies()[0], currencies());
      renderApply();
      setTimeout(function () { var i = $("#wl-sum"); if (i) i.focus(); }, 50);
    }
  }

  function formHtml() {
    var dep = ui.mode === "deposit";
    return '<form id="wl-form" class="wl-form" novalidate>' +
      '<div class="wl-form-row"><label>' + esc(t("wl_amount")) + '<input id="wl-sum" type="text" inputmode="decimal" autocomplete="off" required></label>' +
        "<label>" + esc(t("wl_currency")) + '<select id="wl-cur" class="currency-select"></select></label></div>' +
      "<label>" + esc(t("wl_note")) + '<input id="wl-note" type="text" maxlength="200" placeholder="' + esc(t("wl_note_ph")) + '"></label>' +
      (dep ? '<label class="check-line wl-apply hidden"><input id="wl-apply" type="checkbox" checked><span id="wl-apply-t"></span></label>' : "") +
      '<div class="wl-acts"><button type="button" class="btn btn-ghost" data-wl-mode="">' + esc(t("cancel")) + "</button>" +
        '<button type="submit" class="btn btn-primary" id="wl-save">' + esc(t(dep ? "wl_save_add" : "wl_save_out")) + "</button></div>" +
    "</form>";
  }

  function renderApply() {
    var box = $(".wl-apply");
    if (!box) return;
    var code = $("#wl-cur").value, d = debts(ui.key), owe = num(d.sums[code]);
    box.classList.toggle("hidden", owe <= 0.005);
    $("#wl-apply-t").textContent = t("wl_apply", { s: c.money(owe) + " " + code, n: d.n[code] || 0 });
  }

  function errText(e) {
    var m = String((e && e.message) || "");
    if (/no_funds/.test(m)) return t("wl_no_funds");
    if (/bad_amount/.test(m)) return t("wl_bad_amount");
    return "";
  }
  function fail(e) {
    var m = errText(e);
    if (m) toast(m, "error"); else c.handleError(e);
  }

  // после операции: заказы и балансы свежие, открытые окна перерисованы
  function after() {
    return Promise.resolve(c.reloadOrders(true)).then(function () {
      if (state.detailId && $("#modal-detail").classList.contains("open")) c.openDetail(state.detailId);
      if (isOpen()) history();
    });
  }

  function save() {
    if (ui.busy) return;
    var amount = c.parseNum($("#wl-sum").value);
    if (!(amount > 0)) { toast(t("wl_bad_amount"), "error"); $("#wl-sum").focus(); return; }
    var code = $("#wl-cur").value, apply = !!($("#wl-apply") && $("#wl-apply").checked && !$(".wl-apply").classList.contains("hidden"));
    var dep = ui.mode === "deposit";
    ui.busy = true; ui.cur = code;
    $("#wl-save").disabled = true;
    c.db().rpc("wallet_add", { p_ws: state.ws.id, p_key: ui.key, p_name: ui.name, p_currency: code, p_amount: amount,
      p_kind: dep ? "deposit" : "withdraw", p_note: $("#wl-note").value, p_apply: apply })
      .then(function (r) {
        ui.busy = false;
        if (r.error) { fail(r.error); var b = $("#wl-save"); if (b) b.disabled = false; return; }
        var d = r.data || {}, s = cur(amount, code);
        toast(!dep ? t("wl_out_ok", { s: s }) : num(d.paid) > 0 ? t("wl_add_paid", { s: s, p: cur(d.paid, code), n: d.orders }) : t("wl_add_ok", { s: s }), "ok");
        ui.mode = "";
        return after();
      });
  }

  function payOrder(id) {
    if (ui.busy) return;
    ui.busy = true;
    var o = (state.orders || []).filter(function (x) { return x.id === id; })[0];
    c.db().rpc("wallet_order", { p_order: id, p_dir: "pay" }).then(function (r) {
      ui.busy = false;
      if (r.error) { fail(r.error); return; }
      toast(t("wl_paid_ok", { s: cur(r.data, o && o.client_currency) }), "ok");
      return after();
    });
  }

  function backOrder(id) {
    var o = (state.orders || []).filter(function (x) { return x.id === id; })[0];
    if (!o || ui.busy) return;
    if (!window.confirm(t("wl_back_q", { s: c.money(o.paid_amount) + " " + o.client_currency, n: o.order_number }))) return;
    ui.busy = true;
    c.db().rpc("wallet_order", { p_order: id, p_dir: "return" }).then(function (r) {
      ui.busy = false;
      if (r.error) { fail(r.error); return; }
      toast(t("wl_back_ok", { s: cur(r.data, o.client_currency) }), "ok");
      return after();
    });
  }

  function undo(id) {
    if (ui.busy || !window.confirm(t("wl_undo_q"))) return;
    ui.busy = true;
    c.db().rpc("wallet_undo", { p_id: id }).then(function (r) {
      ui.busy = false;
      if (r.error) { fail(r.error); return; }
      toast(t("wl_undo_ok"), "ok");
      return after();
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-wallet],[data-wallet-pay],[data-wallet-back],[data-wl-mode],[data-wl-undo],[data-wl-order]");
    if (!b) return;
    if (b.hasAttribute("data-wallet")) { e.stopPropagation(); open(b.getAttribute("data-wallet"), b.getAttribute("data-wallet-name")); }
    else if (b.hasAttribute("data-wallet-pay")) payOrder(b.getAttribute("data-wallet-pay"));
    else if (b.hasAttribute("data-wallet-back")) backOrder(b.getAttribute("data-wallet-back"));
    else if (b.hasAttribute("data-wl-mode")) { ui.mode = b.getAttribute("data-wl-mode"); render(); }
    else if (b.hasAttribute("data-wl-undo")) undo(b.getAttribute("data-wl-undo"));
    else if (b.hasAttribute("data-wl-order")) { c.closeModal("modal-wallet"); c.openDetail(b.getAttribute("data-wl-order")); }
  });

  U.wallet = { load: load, chip: chip, orderHtml: orderHtml, debtsNote: debtsNote, keyOf: keyOf, open: open,
    reset: function () { totals = {}; ready = false; } };
})(window.ULA);
