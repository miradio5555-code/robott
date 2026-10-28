// =====================================================
// ULA FACTORY — раздел «Профиль»: кто вы, цифры кабинета, что ещё не настроено,
// и внешний вид (тёмная тема, цвет кнопок, размер текста, стиль углов).
// Внешний вид хранится в этом браузере; до отрисовки его ставит js/head.js.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, money = c.money, state = c.state;

  var LOOK = {
    accent: { key: "ula_accent", attr: "data-accent", def: "ula", list: ["ula", "blue", "violet", "green", "orange"] },
    tsize: { key: "ula_tsize", attr: "data-tsize", def: "m", list: ["s", "m", "l", "xl"] },
    ui: { key: "ula_ui", attr: "data-ui", def: "rounded", list: ["rounded", "soft", "crisp"] }
  };
  var SWATCH = { ula: "#151417", blue: "#2F6FDE", violet: "#7C5CFC", green: "#15803D", orange: "#E8590C" };

  function getLook(name) {
    var L = LOOK[name], v = null;
    try { v = localStorage.getItem(L.key); } catch (e) { /* ignore */ }
    return L.list.indexOf(v) !== -1 ? v : L.def;
  }
  function setLook(name, v) {
    var L = LOOK[name];
    try { localStorage.setItem(L.key, v); } catch (e) { /* ignore */ }
    if (v === L.def) document.documentElement.removeAttribute(L.attr);
    else document.documentElement.setAttribute(L.attr, v);
  }
  function isDark() {
    var th = c.getTheme();
    return th === "dark" || (th === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  }

  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((p[0] || "U").charAt(0) + (p[1] ? p[1].charAt(0) : "")).toUpperCase();
  }
  function avatarHtml() {
    var path = state.ws && state.ws.logo_path, db = c.db();
    if (path && db) return '<img src="' + esc(db.storage.from("logos").getPublicUrl(path).data.publicUrl) + '" alt="">';
    return "<span>" + esc(initials(state.me && state.me.name || state.me && state.me.email)) + "</span>";
  }
  function roleLabel() {
    if (state.me && state.me.role === "admin") return t("pf_role_admin");
    return t(state.myRole === "staff" ? "pf_role_staff" : "pf_role_owner");
  }

  // Карточка профиля сверху меню разделов
  function refreshCard() {
    var ava = $("#mp-ava"), name = $("#mp-name"), top = $("#tp-ava");
    if (!ava || !state.me) return;
    ava.innerHTML = avatarHtml();
    if (top) top.innerHTML = ava.innerHTML;
    var tb = $("#top-profile");
    if (tb) tb.classList.toggle("active", state.tab === "profile");
    name.textContent = state.me.name || state.me.email || "";
  }

  // Что ещё не заполнено в кабинете — каждый пункт открывает нужное место в настройках
  function checks() {
    var w = state.ws || {}, me = state.me || {};
    return [
      { ok: !!me.name, label: "pf_c_name", go: null },
      { ok: !!me.phone, label: "pf_c_phone", go: null },
      { ok: !!w.logo_path, label: "pf_c_logo", go: "s-logo" },
      { ok: !!w.warehouse_address, label: "pf_c_wh", go: "s-warehouse" },
      { ok: Number(w.default_delivery_tariff) > 0, label: "pf_c_tariff", go: "s-def-tariff" }
    ];
  }

  function monthStats() {
    var ym = c.todayISO().slice(0, 7), n = 0, done = 0, byClient = {};
    (state.orders || []).forEach(function (o) {
      if (String(o.order_date || "").slice(0, 7) !== ym || o.status === "cancelled") return;
      n++;
      if (o.status === "delivered") done++;
      var k = o.client_name || (o.client && o.client.name);
      if (k) byClient[k] = (byClient[k] || 0) + 1;
    });
    var top = Object.keys(byClient).sort(function (a, b) { return byClient[b] - byClient[a]; })[0] || "";
    return { n: n, done: done, top: top };
  }

  function chip(text, cls, attrs) {
    return '<button type="button" class="pf-chip ' + (cls || "") + '"' + (attrs || "") + ">" + text + "</button>";
  }

  function render() {
    var box = $("#profile-body");
    if (!box || !state.me) return;
    var orders = state.orders || [], clients = {}, active = 0;
    orders.forEach(function (o) {
      var k = o.client_id || o.client_name;
      if (k) clients[k] = 1;
      if (o.status !== "delivered" && o.status !== "cancelled") active++;
    });
    var owner = state.myRole !== "staff" && state.me.role !== "admin" && !!state.ws;
    var h = "";

    h += '<div class="pf-head">' +
      '<div class="pf-ava-wrap"><div class="pf-ava">' + avatarHtml() + '</div><span class="pf-badge">' + U.icon(owner ? "shield" : "users", 14) + "</span></div>" +
      '<h1 class="pf-name">' + esc(state.me.name || state.me.email || "") + "</h1>" +
      '<p class="pf-sub">' + esc([state.ws && state.ws.name, roleLabel()].filter(Boolean).join(" · ")) + "</p>" +
      (state.me.email ? '<p class="pf-mail">' + esc(state.me.email) + "</p>" : "") +
      "</div>";

    if (state.ws) {
      h += '<div class="pf-stats">' +
        '<button type="button" data-pf-tab="orders"><b>' + money(orders.length) + "</b><span>" + esc(t("pf_orders")) + "</span></button>" +
        '<button type="button" data-pf-tab="orders"><b>' + money(active) + "</b><span>" + esc(t("pf_active")) + "</span></button>" +
        '<button type="button" data-pf-tab="clients"><b>' + money(Object.keys(clients).length) + "</b><span>" + esc(t("pf_clients")) + "</span></button>" +
        "</div>";
    }

    if (owner) {
      var cs = checks(), ok = cs.filter(function (x) { return x.ok; }).length;
      h += '<h3 class="pf-cap">' + esc(t("pf_ready")) + '<em>' + esc(t("pf_ready_n", { a: ok, b: cs.length })) + "</em></h3>" +
        '<div class="pf-card"><div class="pf-progress"><i style="width:' + Math.round(ok / cs.length * 100) + '%"></i></div><div class="pf-chips">' +
        cs.map(function (x) {
          return chip((x.ok ? U.icon("check", 14) : "<b>+</b>") + esc(t(x.label)), x.ok ? "ok" : "todo", ' data-pf-go="' + (x.go || "") + '"');
        }).join("") + "</div></div>";

      var m = monthStats();
      h += '<h3 class="pf-cap">' + esc(t("pf_month")) + '</h3><div class="pf-card"><div class="pf-chips">' +
        (m.n ? chip(esc(t("pf_m_new", { n: m.n })), "info", ' data-pf-tab="orders"') + chip(esc(t("pf_m_done", { n: m.done })), "info", ' data-pf-tab="orders"') +
          (m.top ? chip(esc(t("pf_m_top", { name: m.top })), "info", ' data-pf-tab="clients"') : "")
          : '<p class="muted">' + esc(t("pf_m_empty")) + "</p>") +
        "</div></div>";
    }

    // Внешний вид
    var dark = isDark(), acc = getLook("accent"), ts = getLook("tsize"), ui = getLook("ui");
    h += '<h3 class="pf-cap">' + esc(t("pf_look")) + "</h3>" +
      '<div class="pf-card pf-row"><span class="pf-row-ico">' + (dark ? "☾" : "☀") + "</span>" +
      '<span class="pf-row-t"><b>' + esc(t("pf_dark")) + "</b><small>" + esc(t("pf_dark_sub")) + "</small></span>" +
      '<button type="button" id="pf-dark" class="pf-switch' + (dark ? " on" : "") + '" role="switch" aria-checked="' + dark + '" aria-label="' + esc(t("pf_dark")) + '"><i></i></button></div>';

    h += '<h3 class="pf-cap">' + esc(t("pf_color")) + "<em>" + esc(t("pf_col_" + acc)) + "</em></h3>" +
      '<div class="pf-card pf-swatches">' + LOOK.accent.list.map(function (k) {
        return '<button type="button" class="pf-sw' + (k === acc ? " on" : "") + '" data-pf-accent="' + k + '" style="--sw:' + SWATCH[k] + '" aria-label="' + esc(t("pf_col_" + k)) + '" aria-pressed="' + (k === acc) + '"><i>' + U.icon("check", 16) + "</i></button>";
      }).join("") + "</div>";

    h += '<h3 class="pf-cap">' + esc(t("pf_text")) + "<em>" + esc(t("pf_ts_" + ts)) + "</em></h3>" +
      '<div class="pf-card pf-seg">' + LOOK.tsize.list.map(function (k) {
        return '<button type="button" class="pf-ts pf-ts-' + k + (k === ts ? " on" : "") + '" data-pf-tsize="' + k + '" aria-pressed="' + (k === ts) + '" aria-label="' + esc(t("pf_ts_" + k)) + '">Aa</button>';
      }).join("") + "</div>";

    h += '<h3 class="pf-cap">' + esc(t("pf_style")) + "<em>" + esc(t("pf_ui_" + ui)) + "</em></h3>" +
      '<div class="pf-styles">' + LOOK.ui.list.map(function (k) {
        return '<button type="button" class="pf-st pf-st-' + k + (k === ui ? " on" : "") + '" data-pf-ui="' + k + '" aria-pressed="' + (k === ui) + '">' +
          "<span class=\"pf-st-demo\"><i></i></span><b>" + esc(t("pf_ui_" + k)) + "</b></button>";
      }).join("") + "</div>" +
      '<p class="fine-print pf-note">' + esc(t("pf_device_note")) + "</p>";

    if (owner) h += '<button type="button" id="pf-settings" class="btn btn-block">' + U.icon("shield", 18) + " " + esc(t("pf_settings")) + "</button>";

    box.innerHTML = h;
  }

  function bind() {
    var box = $("#profile-body");
    box.addEventListener("click", function (e) {
      var b;
      if ((b = e.target.closest("#pf-dark"))) { c.applyTheme(isDark() ? "light" : "dark"); render(); return; }
      if ((b = e.target.closest("[data-pf-accent]"))) { setLook("accent", b.getAttribute("data-pf-accent")); render(); return; }
      if ((b = e.target.closest("[data-pf-tsize]"))) { setLook("tsize", b.getAttribute("data-pf-tsize")); render(); return; }
      if ((b = e.target.closest("[data-pf-ui]"))) { setLook("ui", b.getAttribute("data-pf-ui")); render(); return; }
      if ((b = e.target.closest("[data-pf-tab]"))) { c.switchTab(b.getAttribute("data-pf-tab")); return; }
      if ((b = e.target.closest("[data-pf-go]"))) { c.openSettings(b.getAttribute("data-pf-go") || null); return; }
      if (e.target.closest("#pf-settings")) c.openSettings();
    });
    var tp = $("#top-profile");
    if (tp) tp.addEventListener("click", function () { c.switchTab("profile"); });
    var mb = $("#section-menu-btn");
    if (mb) mb.addEventListener("click", refreshCard);
  }

  U.profile = { open: render, refreshCard: refreshCard };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})(window.ULA);
