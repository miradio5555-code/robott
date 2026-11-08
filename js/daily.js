// =====================================================
// ULA FACTORY — ежедневная работа байера и сотрудника (файл 59).
//
// • «Сегодня»: что требует действия. Задачи берутся из того, что уже есть: заявки клиентов, сроки и недостающие данные
//   (серверные задачи файла 58, их же показывает «Умный помощник»). Своего хранилища задач здесь нет: выполнил — задача
//   исчезла из списка сама. Слов «оплата поступила» / «проверьте оплату» нет: такого события в системе не хранится.
// • Простой режим хранится в профиле пользователя (все устройства). Автоматическое решение (мало заказов) записывается только
//   в пустой профиль и явный выбор никогда не заменяет. Без файла 59 режим помнит браузер, как раньше.
// • Модули «Магазин» и «Обмен»: выключение прячет только обычные входы. Данные, правила и завершение сделок не затрагиваются:
//   пока есть незавершённые сделки обмена или споры, вход в «Обмен» остаётся.
// • Часовой пояс кабинета: владелец видит значение и подтверждает его или меняет (с предпросмотром последствий).
//
// ULA.daily: loadPrefs(), savePrefs(on, explicit), prefs(), loadModules(), moduleVisible(name), applyModules(), render(), refreshSettings()
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, state = c.state, toast = c.toast;

  var prefs = { ready: false, simple: null, explicit: false };
  var mods = { ready: false, shop: true, exchange: true, shop_open: 0, exchange_open: 0, time_zone: null, time_zone_confirmed_at: null };
  var LIMIT = 8, showAll = false;

  function owner() { return state.myRole === "owner" && !state.readOnly; }
  function isAdmin() { return !!(state.me && state.me.role === "admin"); }

  // ---------- профиль: простой режим ----------
  function loadPrefs() {
    var db = c.db();
    if (!db) return Promise.resolve(prefs);
    return Promise.resolve(db.rpc("my_ui_prefs")).then(function (r) {
      if (r.error || !r.data) { prefs = { ready: false, simple: null, explicit: false }; return prefs; }
      prefs = { ready: true, simple: r.data.simple, explicit: !!r.data.explicit };
      return prefs;
    }).catch(function () { prefs = { ready: false, simple: null, explicit: false }; return prefs; });
  }
  function savePrefs(on, explicit) {
    var db = c.db();
    if (!db || !prefs.ready) return Promise.resolve(null);
    return Promise.resolve(db.rpc("my_ui_prefs_set", { p_simple: !!on, p_explicit: explicit !== false })).then(function (r) {
      if (r.error) { toast(t("error_generic"), "error"); return null; }
      prefs = { ready: true, simple: r.data.simple, explicit: !!r.data.explicit };
      return prefs;
    }).catch(function () { return null; });
  }

  // ---------- модули кабинета ----------
  function loadModules() {
    var db = c.db(), ws = state.ws && state.ws.id;
    if (!db || !ws) { mods.ready = false; return Promise.resolve(mods); }
    return Promise.resolve(db.rpc("ws_daily_get", { p_ws: ws })).then(function (r) {
      if (!state.ws || state.ws.id !== ws) return mods;
      if (r.error || !r.data) { mods = { ready: false, shop: true, exchange: true, shop_open: 0, exchange_open: 0, time_zone: null, time_zone_confirmed_at: null }; return mods; }
      mods = Object.assign({ ready: true }, r.data);
      return mods;
    }).catch(function () { mods.ready = false; return mods; });
  }
  function moduleVisible(name) {
    if (isAdmin() || !mods.ready) return true;
    if (name === "shop") return !!mods.shop;
    if (name === "exchange") return !!mods.exchange || Number(mods.exchange_open) > 0;
    return true;
  }
  function exchangeHeld() { return !!mods.ready && !mods.exchange && Number(mods.exchange_open) > 0; }
  function applyModules() {
    ["shop", "exchange"].forEach(function (k) {
      var vis = moduleVisible(k);
      $$('.section-menu .tab[data-tab="' + k + '"]').forEach(function (b) { b.classList.toggle("mod-hidden", !vis); });
    });
    if (!moduleVisible(state.tab) && (state.tab === "shop" || state.tab === "exchange")) c.switchTab("home");
    var fx = $("#s-mod-fx-wrap"), sh = $("#s-mod-shop-wrap");
    if (fx) fx.classList.toggle("hidden", !(mods.ready && owner()));
    if (sh) sh.classList.toggle("hidden", !(mods.ready && owner()));
    if ($("#s-mod-shop")) $("#s-mod-shop").checked = !!mods.shop;
    if ($("#s-mod-fx")) $("#s-mod-fx").checked = !!mods.exchange;
    var note = $("#s-mod-note");
    if (note) {
      note.classList.toggle("hidden", !owner());
      note.textContent = !mods.ready ? t("mod_old") : t(Number(mods.exchange_open) > 0 && !mods.exchange ? "mod_note_open" : "mod_note", { n: mods.exchange_open || 0 });
    }
  }
  function saveModules() {
    var db = c.db(), ws = state.ws && state.ws.id;
    if (!db || !ws || !owner()) return;
    var shop = $("#s-mod-shop").checked, fx = $("#s-mod-fx").checked;
    Promise.resolve(db.rpc("ws_daily_set_modules", { p_ws: ws, p_shop: shop, p_exchange: fx })).then(function (r) {
      if (r.error) { c.handleError(r.error); return loadModules().then(applyModules); }
      mods = Object.assign({ ready: true }, r.data);
      applyModules();
      toast(t("mod_saved"), "ok");
    });
  }

  // ---------- «Сегодня» ----------
  function orderById(id) { return state.orders.filter(function (o) { return o.id === id; })[0]; }
  function active(o) { return c.CLOSED.indexOf(o.status) === -1; }
  function who(o) { return (o.client && o.client.name) || o.client_name || ""; }

  // список дел: { key, level, reason, o, btn:{ label, act } }; порядок = важность
  function build() {
    var items = [], seen = {};
    function add(level, reasonKey, vars, o, act, label) {
      var k = o.id + ":" + reasonKey;
      if (seen[k]) return;           // один случай — одна строка
      seen[k] = 1;
      items.push({ key: k, level: level, reason: t(reasonKey, vars), o: o, act: act, label: t(label) });
    }
    var D = U.deadlines, serverTasks = D && D.ready() ? D.list() : null;
    // 1. новые заявки клиентов
    state.orders.filter(function (o) { return o.source === "request" && o.status === "new"; })
      .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); })
      .forEach(function (o) { add("warn", "td_r_request", { name: who(o) }, o, "quote", "td_btn_calc"); });
    // 2. просроченные оплаты и задержки доставки: только по явно заданным срокам (серверные задачи)
    (serverTasks || []).forEach(function (k) {
      var o = orderById(k.order_id);
      if (!o) return;
      var d = k.details || {};
      if (k.kind === "payment_overdue") add("bad", "td_r_payment_overdue", { s: c.cur(d.balance, d.currency).replace(/&amp;/g, "&") }, o, "open", "td_btn_open");
    });
    (serverTasks || []).forEach(function (k) {
      var o = orderById(k.order_id);
      if (!o) return;
      if (k.kind === "delivery_overdue") add("bad", "td_r_delivery_overdue", { d: D.etaText(o) }, o, "open", "td_btn_open");
      else if (k.kind === "delivery_soon") add("warn", "td_r_delivery_soon", { d: D.etaText(o) }, o, "open", "td_btn_open");
    });
    // 3. не хватает данных для следующего этапа: по серверным задачам (с учётом «отложить»); без файла 58 — те же правила на месте
    if (serverTasks) {
      serverTasks.forEach(function (k) {
        var o = orderById(k.order_id), m = k.details && k.details.missing;
        if (k.kind !== "missing_data" || !o) return;
        if (m === "no_price") add("warn", "td_r_no_price", {}, o, "edit", "td_btn_price");
        else if (m === "no_weight") add("warn", "td_r_no_weight", {}, o, "weight", "td_btn_weight");
        else if (m === "no_tracking") add("warn", "td_r_no_tracking", {}, o, "track", "td_btn_track");
      });
    } else {
      state.orders.filter(active).forEach(function (o) {
        if (o.status === "awaiting_payment" && o.client_price == null) add("warn", "td_r_no_price", {}, o, "edit", "td_btn_price");
        else if (o.status === "china_warehouse" && !(c.num(o.weight_kg) > 0)) add("warn", "td_r_no_weight", {}, o, "weight", "td_btn_weight");
        else if (o.status === "in_transit" && !o.tracking_number) add("warn", "td_r_no_tracking", {}, o, "track", "td_btn_track");
      });
    }
    return items;
  }

  function rowHtml(it, i) {
    var o = it.o;
    return '<article class="td-item ' + it.level + '" data-td="' + i + '">' +
      '<div class="td-body"><p class="td-reason">' + esc(it.reason) + "</p>" +
      '<p class="td-order"><b>№ ' + esc(o.order_number) + "</b> · " + esc(o.product_ru) + (who(o) ? " · " + esc(who(o)) : "") + "</p></div>" +
      '<button type="button" class="btn btn-primary td-btn" data-td-act="' + i + '"' + (state.readOnly && it.act !== "open" ? " disabled" : "") + ">" + esc(it.label) + "</button></article>";
  }

  var current = [];
  function render() {
    var box = $("#today-list");
    if (!box || !state.ws) return;
    current = build();
    var cnt = $("#today-count");
    cnt.textContent = current.length ? String(current.length) : "";
    cnt.classList.toggle("hidden", !current.length);
    if (!state.orders.length) {
      box.innerHTML = '<div class="td-empty">' + esc(t("td_empty_new")) + "</div>";
      return;
    }
    if (!current.length) { box.innerHTML = '<div class="td-empty">' + U.icon("check", 18) + esc(t("td_empty")) + "</div>"; return; }
    var shown = showAll ? current : current.slice(0, LIMIT);
    box.innerHTML = shown.map(rowHtml).join("") +
      (current.length > shown.length ? '<button type="button" class="btn btn-block td-more" data-td-more>' + esc(t("td_more", { n: current.length - shown.length })) + "</button>" : "");
  }

  function onTodayClick(e) {
    var more = e.target.closest("[data-td-more]");
    if (more) { showAll = true; render(); return; }
    var b = e.target.closest("[data-td-act]");
    if (!b) return;
    var it = current[Number(b.getAttribute("data-td-act"))];
    if (it) c.runAction(it.act, it.o);
  }

  // ---------- часовой пояс ----------
  var tzBusy = false;
  function tzNow() { return mods.time_zone || (state.ws && state.ws.time_zone) || "Asia/Bishkek"; }
  function refreshSettings() {
    var sec = $("#tz-section");
    if (!sec) return Promise.resolve();
    refreshContact();
    return loadModules().then(function () {
      applyModules();
      var show = mods.ready && owner();
      sec.classList.toggle("hidden", !show);
      if (!show) return;
      $("#tz-input").value = tzNow();
      var at = mods.time_zone_confirmed_at;
      $("#tz-state").textContent = at
        ? t("tz_state_ok", { z: tzNow(), d: new Date(at).toLocaleDateString(c.locale()) })
        : t("tz_state_new", { z: tzNow() });
      sec.classList.toggle("tz-warn", !at);
      $("#tz-confirm").classList.toggle("hidden", !!at);
      $("#tz-preview").textContent = "";
      var dl = $("#tz-list");
      if (dl && !dl.childElementCount && window.Intl && Intl.supportedValuesOf) {
        try { dl.innerHTML = Intl.supportedValuesOf("timeZone").map(function (z) { return '<option value="' + esc(z) + '">'; }).join(""); } catch (e) { /* не страшно */ }
      }
    });
  }
  // способ связи для клиентов (файл 60): без файла 60 блок остаётся скрытым
  function refreshContact() {
    var sec = $("#cc-section"), db = c.db(), ws = state.ws && state.ws.id;
    if (!sec || !db || !ws || !owner()) { if (sec) sec.classList.add("hidden"); return Promise.resolve(); }
    return Promise.resolve(db.rpc("ws_client_contact_get", { p_ws: ws })).then(function (r) {
      if (r.error || !r.data) { sec.classList.add("hidden"); return; }
      sec.classList.remove("hidden");
      $("#cc-phone").value = r.data.phone || "";
      $("#cc-tg").value = r.data.telegram ? "@" + r.data.telegram : "";
      $("#cc-err").classList.add("hidden");
    }).catch(function () { sec.classList.add("hidden"); });
  }
  function saveContact() {
    var db = c.db(), ws = state.ws && state.ws.id, err = $("#cc-err");
    if (!db || !ws || !owner()) return;
    err.classList.add("hidden");
    Promise.resolve(db.rpc("ws_set_client_contact", { p_ws: ws, p_phone: $("#cc-phone").value, p_telegram: $("#cc-tg").value })).then(function (r) {
      if (r.error) {
        var m = String(r.error.message || "");
        if (/invalid_(phone|telegram)/.test(m)) { err.textContent = t(/phone/.test(m) ? "cab_contact_bad_phone" : "cab_contact_bad_tg"); err.classList.remove("hidden"); $(/phone/.test(m) ? "#cc-phone" : "#cc-tg").focus(); }
        else c.handleError(r.error);
        return;
      }
      toast(t("cab_contact_saved"), "ok");
      return refreshContact();
    });
  }
  function confirmTz() {
    var db = c.db(), ws = state.ws && state.ws.id;
    if (!db || !ws || !owner() || tzBusy) return;
    tzBusy = true;
    Promise.resolve(db.rpc("ws_confirm_timezone", { p_ws: ws })).then(function (r) {
      tzBusy = false;
      if (r.error) { c.handleError(r.error); return; }
      toast(t("tz_saved"), "ok");
      return Promise.resolve(U.deadlines ? U.deadlines.refreshSettings() : null).then(refreshSettings);
    });
  }
  function changeTz() {
    var db = c.db(), ws = state.ws && state.ws.id;
    var zone = $("#tz-input").value.trim();
    if (!db || !ws || !owner() || tzBusy) return;
    if (!zone || zone === tzNow()) { confirmTz(); return; }
    tzBusy = true;
    Promise.resolve(db.rpc("ws_timezone_preview", { p_ws: ws, p_tz: zone })).then(function (r) {
      if (r.error) { tzBusy = false; toast(t("tz_err"), "error"); return null; }
      var p = r.data;
      $("#tz-preview").textContent = t("tz_preview", { n: p.orders_with_deadlines, d: p.date_changes });
      if (!window.confirm(t("tz_confirm_change", { a: p.old, b: p.new, n: p.orders_with_deadlines, d: p.date_changes }))) { tzBusy = false; return null; }
      return db.rpc("ws_set_timezone", { p_ws: ws, p_tz: zone }).then(function (r2) {
        tzBusy = false;
        if (r2.error) { toast(t("tz_err"), "error"); return; }
        state.ws.time_zone = zone;
        toast(t("tz_saved"), "ok");
        return Promise.resolve(U.deadlines ? U.deadlines.refreshSettings() : null).then(refreshSettings).then(function () { if (c.renderAll) c.renderAll(); });
      });
    }).catch(function () { tzBusy = false; });
  }

  function bind() {
    var tl = $("#today-list");
    if (tl) tl.addEventListener("click", onTodayClick);
    var sh = $("#s-mod-shop"), fx = $("#s-mod-fx");
    if (sh) sh.addEventListener("change", saveModules);
    if (fx) fx.addEventListener("change", saveModules);
    var tc = $("#tz-confirm"), tg = $("#tz-change");
    if (tc) tc.addEventListener("click", confirmTz);
    if (tg) tg.addEventListener("click", changeTz);
    var cs = $("#cc-save");
    if (cs) cs.addEventListener("click", saveContact);
    var ti = $("#tz-input");
    if (ti) ti.addEventListener("input", function () { $("#tz-preview").textContent = ""; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();

  U.daily = {
    loadPrefs: loadPrefs, savePrefs: savePrefs, prefs: function () { return prefs; },
    loadModules: loadModules, exchangeHeld: exchangeHeld, moduleVisible: moduleVisible, applyModules: applyModules,
    render: render, refreshSettings: refreshSettings, build: build,
    resetToday: function () { showAll = false; }
  };
})(window.ULA);
