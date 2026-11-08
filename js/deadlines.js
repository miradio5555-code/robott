// =====================================================
// ULA FACTORY — сроки оплаты и доставки, задачи, напоминания клиентам (файл 58).
//
// • В карточке заказа блок «Сроки»: срок оплаты и ожидаемый интервал доставки (вводятся и показываются во времени
//   кабинета с названием пояса), приостановка напоминаний, открытые задачи по заказу, история изменений срока.
//   У старых заказов срока нет, и программа его не придумывает: без срока заказ не бывает «просроченным».
// • Задачи (истёк срок оплаты, срок доставки, не хватает данных) попадают в существующий «Умный помощник».
//   Их создаёт сервер по расписанию, без открытого сайта; здесь они только показываются.
// • Настройки → «Напоминания об оплате»: автоматическая отправка по умолчанию ВЫКЛЮЧЕНА; владелец включает её явно и видит
//   правила. Сообщения идут через существующую очередь уведомлений (файл 57). Просрочка доставки клиенту не пишется.
// • Администратору: состояние серверных задач (не запускались / работают / остановились).
// Без файла 58 всё это скрыто, сайт работает как раньше.
//
// ULA.deadlines: load(), hints(), orderHtml(o), refreshSettings(), adminJobs(el)
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state, toast = c.toast, cur = c.cur;
  var tasks = [], settings = null, ready = false, history = {};

  function tz() { return (settings && settings.time_zone) || (state.ws && state.ws.time_zone) || "Asia/Bishkek"; }
  function owner() { return state.myRole === "owner"; }

  // момент → «10.03.2099, 09:00 GMT+6» во времени кабинета
  function show(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(c.locale(), { timeZone: tz(), day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
    } catch (e) { return String(iso); }
  }
  function showDate(iso) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(c.locale(), { timeZone: tz(), day: "2-digit", month: "2-digit", year: "numeric" }); } catch (e) { return String(iso); }
  }
  // момент → значения полей ввода (местное время кабинета)
  function parts(iso) {
    var f = new Intl.DateTimeFormat("en-CA", { timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    var o = {}; f.formatToParts(new Date(iso)).forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + "-" + o.month + "-" + o.day, time: o.hour + ":" + o.minute };
  }

  function load() {
    var db = c.db(), ws = state.ws && state.ws.id;
    if (!db || !ws) { tasks = []; ready = false; return Promise.resolve(); }
    return Promise.all([db.rpc("tasks_list", { p_ws: ws }), db.rpc("reminder_settings_get", { p_ws: ws })]).then(function (r) {
      if (!state.ws || state.ws.id !== ws) return;
      ready = !r[0].error && !r[1].error;
      tasks = ready ? (r[0].data || []) : [];
      settings = ready ? r[1].data : null;
    }).catch(function () { ready = false; });
  }

  // ---------- подсказки помощника ----------
  function hints() {
    if (!ready) return [];
    return tasks.map(function (k) {
      var d = k.details || {}, key, vars = { n: k.order_number };
      if (k.kind === "payment_overdue") { key = "dl_h_payment_overdue"; vars.d = show(d.due_at); vars.s = cur(d.balance, d.currency).replace(/&amp;/g, "&"); }
      else if (k.kind === "delivery_soon") { key = "dl_h_delivery_soon"; vars.d = showDate(d.eta_to); }
      else if (k.kind === "delivery_overdue") { key = "dl_h_delivery_overdue"; vars.d = showDate(d.eta_to); }
      else { key = "dl_h_missing_" + d.missing; }
      return { level: k.kind === "payment_overdue" || k.kind === "delivery_overdue" ? "bad" : "warn", text: t(key, vars), action: { type: "order", id: k.order_id } };
    });
  }

  // ---------- блок «Сроки» в заказе ----------
  function orderHtml(o) {
    if (!ready || !o) return "";
    var pay = o.payment_due_at ? parts(o.payment_due_at) : null, ef = o.delivery_eta_from ? parts(o.delivery_eta_from) : null, et = o.delivery_eta_to ? parts(o.delivery_eta_to) : null;
    var mine = tasks.filter(function (k) { return k.order_id === o.id; });
    var h = '<div class="dl-box" data-dl-order="' + esc(o.id) + '"><h4>' + esc(t("dl_title")) + "</h4>" +
      '<p class="field-hint">' + esc(t("dl_tz", { z: tz() })) + (o.payment_due_at ? " · " + esc(t("dl_pay_now", { d: show(o.payment_due_at) })) : " · " + esc(t("dl_none"))) + "</p>" +
      '<div class="dl-grid">' +
      '<label class="field"><span>' + esc(t("dl_pay")) + '</span><input type="datetime-local" data-dl-pay value="' + (pay ? pay.date + "T" + pay.time : "") + '"></label>' +
      '<label class="field"><span>' + esc(t("dl_eta_from")) + '</span><input type="date" data-dl-from value="' + (ef ? ef.date : "") + '"></label>' +
      '<label class="field"><span>' + esc(t("dl_eta_to")) + '</span><input type="date" data-dl-to value="' + (et ? et.date : "") + '"></label></div>' +
      '<div class="dl-acts"><button type="button" class="btn btn-primary" data-dl-save data-write>' + esc(t("dl_save")) + "</button>" +
      '<button type="button" class="btn btn-light" data-dl-pause="' + (o.reminders_paused_at ? "0" : "1") + '" data-write>' + esc(t(o.reminders_paused_at ? "dl_resume" : "dl_pause")) + "</button></div>" +
      (o.reminders_paused_at ? '<p class="field-hint">' + esc(t("dl_paused", { d: show(o.reminders_paused_at) })) + "</p>" : "");
    var hs = hints().filter(function (x) { return x.action.id === o.id; });
    if (hs.length) h += '<ul class="dl-tasks">' + hs.map(function (x, i) {
      var k = mine[i];
      return '<li class="' + x.level + '">' + esc(x.text) + (k ? ' <button type="button" class="btn btn-light" data-dl-snooze="' + esc(k.id) + '" data-write>' + esc(t("dl_snooze")) + "</button>" : "") + "</li>";
    }).join("") + "</ul>";
    h += '<details data-dl-hist="' + esc(o.id) + '"><summary>' + esc(t("dl_history")) + '</summary><ul class="dl-hist">' +
      (history[o.id] ? history[o.id] : "<li>…</li>") + "</ul></details></div>";
    return h;
  }

  function loadHistory(orderId, det) {
    Promise.resolve(c.db().rpc("order_deadline_history", { p_order: orderId })).then(function (r) {
      var rows = (r.data || []).map(function (x) {
        return "<li>" + esc(show(x.at)) + " · " + esc(t("dl_f_" + x.field)) + ": " + esc(x.old ? show(x.old) : "—") + " → " + esc(x.new ? show(x.new) : "—") + "</li>";
      }).join("") || "<li>" + esc(t("dl_hist_none")) + "</li>";
      history[orderId] = rows;
      var ul = det.querySelector("ul"); if (ul) ul.innerHTML = rows;
    });
  }

  function reloadAll() {
    return Promise.resolve(c.reloadOrders ? c.reloadOrders(true) : null).then(load).then(function () { if (c.renderAll) c.renderAll(); });
  }

  function save(box) {
    var id = box.getAttribute("data-dl-order");
    var pay = box.querySelector("[data-dl-pay]").value, f = box.querySelector("[data-dl-from]").value, to = box.querySelector("[data-dl-to]").value;
    if ((f && !to) || (!f && to)) { toast(t("dl_err_eta_incomplete"), "error"); return; }
    if (f && f > to) { toast(t("dl_err_eta_order"), "error"); return; }
    Promise.resolve(c.db().rpc("order_set_deadlines", { p_order: id, p_payment_due: pay || null, p_eta_from: f || null, p_eta_to: to || null })).then(function (r) {
      if (r.error) { c.handleError(r.error); return; }
      delete history[id]; toast(t("dl_saved"), "ok"); return reloadAll();
    });
  }

  function pause(id, on) {
    Promise.resolve(c.db().rpc("order_reminders_pause", { p_order: id, p_paused: on })).then(function (r) {
      if (r.error) { c.handleError(r.error); return; }
      delete history[id]; toast(t(on ? "dl_paused_ok" : "dl_resumed_ok"), "ok"); return reloadAll();
    });
  }

  function snooze(id) {
    Promise.resolve(c.db().rpc("task_snooze", { p_id: id, p_days: 3 })).then(function (r) {
      if (r.error) { c.handleError(r.error); return; }
      toast(t("dl_snoozed"), "ok"); return load().then(function () { if (c.renderAll) c.renderAll(); });
    });
  }

  // ---------- Настройки: напоминания об оплате ----------
  function rulesText(s) {
    return t("rm_rules", { f: s.send_from, to: s.send_to, z: s.time_zone, g: s.grace_hours, gap: s.min_gap_hours, m: s.max_per_order, d: s.max_per_day });
  }
  function refreshSettings() {
    var sec = $("#rm-section");
    if (!sec) return Promise.resolve();
    return load().then(function () {
      if (!ready || !settings) { sec.classList.add("hidden"); return; }
      sec.classList.remove("hidden");
      $("#rm-enabled").checked = !!settings.enabled;
      $("#rm-from").value = settings.send_from; $("#rm-to").value = settings.send_to; $("#rm-grace").value = settings.grace_hours;
      $("#rm-gap").value = settings.min_gap_hours; $("#rm-max").value = settings.max_per_order; $("#rm-day").value = settings.max_per_day;
      $("#rm-tz").value = settings.time_zone; $("#rm-tz").readOnly = true;
      $("#rm-state").textContent = t(settings.enabled ? "rm_on" : "rm_off");
      $("#rm-rules").textContent = rulesText(settings);
    });
  }
  function saveSettings() {
    var ws = state.ws.id, en = $("#rm-enabled").checked;
    var v = { f: Number($("#rm-from").value), to: Number($("#rm-to").value), g: Number($("#rm-grace").value), gap: Number($("#rm-gap").value), m: Number($("#rm-max").value), d: Number($("#rm-day").value) };
    var zone = tz();   // пояс здесь только показывается; меняется в блоке «Часовой пояс» (js/daily.js)
    if (en && !window.confirm(t("rm_confirm_on", { rules: rulesText({ send_from: v.f, send_to: v.to, time_zone: zone, grace_hours: v.g, min_gap_hours: v.gap, max_per_order: v.m, max_per_day: v.d }) }))) return;
    var db = c.db();
    Promise.resolve(db.rpc("reminder_settings_set", { p_ws: ws, p_enabled: en, p_from: v.f, p_to: v.to, p_grace: v.g, p_gap: v.gap, p_max: v.m, p_day: v.d })).then(function (r) {
      if (!r) return;
      if (r.error) { toast(/bad_settings/.test(String(r.error.message || "")) ? t("rm_err_values") : t("error_generic"), "error"); return; }
      toast(t("rm_saved"), "ok"); return refreshSettings();
    });
  }

  // ---------- Администратору: серверные задачи ----------
  function adminJobs(el) {
    if (!el || !c.db()) return;
    Promise.resolve(c.db().rpc("jobs_status")).then(function (r) {
      if (r.error || !r.data) return;
      el.insertAdjacentHTML("beforeend", r.data.map(function (j) {
        var lvl = j.state === "ok" ? "good" : "bad";
        var txt = t("dj_" + j.state, { name: t("dj_name_" + j.job), t: j.last_run_at ? new Date(j.last_run_at).toLocaleString(c.locale()) : "" });
        return '<div class="hint ' + lvl + '"><span class="hint-text">' + esc(txt) + "</span></div>";
      }).join(""));
    }).catch(function () {});
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-dl-save],[data-dl-pause],[data-dl-snooze],#rm-save,[data-dl-hist]");
    if (!b) return;
    var box = b.closest("[data-dl-order]");
    if (b.hasAttribute("data-dl-save")) save(box);
    else if (b.hasAttribute("data-dl-pause")) pause(box.getAttribute("data-dl-order"), b.getAttribute("data-dl-pause") === "1");
    else if (b.hasAttribute("data-dl-snooze")) snooze(b.getAttribute("data-dl-snooze"));
    else if (b.id === "rm-save") saveSettings();
  });
  document.addEventListener("toggle", function (e) {
    var det = e.target;
    if (det && det.matches && det.matches("[data-dl-hist]") && det.open) loadHistory(det.getAttribute("data-dl-hist"), det);
  }, true);

  // для экрана «Сегодня» и короткой карточки (js/daily.js, app.js)
  function etaText(o) {
    if (!ready || !o || !o.delivery_eta_to) return "";
    var a = showDate(o.delivery_eta_from), b = showDate(o.delivery_eta_to);
    return a === b ? a : a + " – " + b;
  }
  U.deadlines = { load: load, hints: hints, orderHtml: orderHtml, refreshSettings: refreshSettings, adminJobs: adminJobs,
    list: function () { return tasks.slice(); }, ready: function () { return ready; }, etaText: etaText, tz: tz };
})(window.ULA);
