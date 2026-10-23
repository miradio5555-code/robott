// =====================================================
// ULA FACTORY — раздел «Отчёт»: сколько вы заработали.
// Прибыль по месяцам, по клиентам и по товарам, за выбранный период,
// с выгрузкой в Excel (CSV). Считается из уже загруженных заказов.
//
// Что считается:
//   • заказы с ценой для клиента (без неё прибыль неизвестна), без отменённых;
//   • месяц = дата заказа; прибыль = цена для клиента − себестоимость;
//   • «наценка» = прибыль / себестоимость (так же, как в форме заказа);
//   • разные валюты не складываются: переключатель валюты.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, money = c.money, num = c.num, cur = c.cur, locale = c.locale,
      state = c.state, toast = c.toast;

  var PERIODS = ["month", "3m", "12m", "all"];
  var VIEWS = ["months", "clients", "products"];
  var ui = { view: "months", period: "12m", cur: "" };

  // ---------- Даты ----------
  function iso(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function periodFrom() {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    if (ui.period === "month") return iso(new Date(y, m, 1));
    if (ui.period === "3m") return iso(new Date(y, m - 2, 1));
    if (ui.period === "12m") return iso(new Date(y, m - 11, 1));
    return "";
  }
  function monthLabel(key) {   // "2026-10" → «Октябрь 2026»
    var p = key.split("-");
    var s = new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString(locale(), { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function prevMonthKey(key) {
    var p = key.split("-"), d = new Date(Number(p[0]), Number(p[1]) - 2, 1);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
  }

  // ---------- Отбор и подсчёт ----------
  function inPeriod(o) {
    var d = String(o.order_date || "").slice(0, 10);
    if (!d) return false;
    var from = periodFrom();
    return !from || d >= from;
  }
  function counted(o) { return o.status !== "cancelled" && o.profit_som != null; }

  function emptyAgg() { return { orders: 0, qty: 0, rev: 0, cost: 0, profit: 0, paid: 0, debt: 0 }; }
  function addTo(a, o) {
    a.orders++;
    a.qty += num(o.quantity);
    a.rev += num(o.total_som);
    a.cost += num(o.cost_som);
    a.profit += num(o.profit_som);
    a.paid += Math.min(num(o.paid_amount), num(o.total_som));
    a.debt += Math.max(0, num(o.balance_som));
  }
  function markup(a) { return a.cost > 0 ? Math.round(a.profit / a.cost * 1000) / 10 : 0; }

  function group(list, keyFn, labelFn) {
    var map = {};
    list.forEach(function (o) {
      var k = keyFn(o);
      var g = map[k] || (map[k] = { key: k, labels: {}, agg: emptyAgg() });
      var l = labelFn(o);
      g.labels[l] = (g.labels[l] || 0) + 1;
      addTo(g.agg, o);
    });
    return Object.keys(map).map(function (k) {
      var g = map[k];
      // подпись — самое частое написание
      g.label = Object.keys(g.labels).sort(function (a, b) { return g.labels[b] - g.labels[a]; })[0];
      return g;
    });
  }

  function clientKey(o) {
    var phone = String((o.client && o.client.phone) || o.client_phone || "").replace(/\D/g, "");
    return phone.length >= 9 ? "p" + phone : "n" + String(o.client_name || "").trim().toLowerCase();
  }
  function productKey(o) {
    return String(o.product_ru || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  // Все данные отчёта для текущих настроек
  function build() {
    var inP = (state.orders || []).filter(function (o) { return o.status !== "cancelled" && inPeriod(o); });
    var priced = inP.filter(counted);
    var unpriced = inP.filter(function (o) { return !counted(o) && num(o.total_som) > 0; }).length;

    // валюты: берём ту, где больше заказов (если выбранной нет в периоде)
    var counts = {};
    priced.forEach(function (o) { counts[o.client_currency] = (counts[o.client_currency] || 0) + 1; });
    var curs = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (curs.indexOf(ui.cur) === -1) ui.cur = curs[0] || "";
    var list = priced.filter(function (o) { return o.client_currency === ui.cur; });

    var total = emptyAgg();
    list.forEach(function (o) { addTo(total, o); });
    return { list: list, total: total, curs: curs, unpriced: unpriced };
  }

  // ---------- Показ ----------
  function chips(id, items, active, labelFn, attr) {
    $(id).innerHTML = items.map(function (it) {
      return '<button type="button" class="chip' + (it === active ? " active" : "") + '" data-' + attr + '="' + esc(it) + '"><span>' +
        esc(labelFn(it)) + "</span></button>";
    }).join("");
  }

  function sign(n, code) { return (n > 0 ? "+" : "") + cur(n, code); }

  function render() {
    if ($("#tab-report").classList.contains("hidden")) return;
    var d = build(), code = ui.cur, T = d.total;

    chips("#r-periods", PERIODS, ui.period, function (p) { return t("r_p_" + p); }, "period");
    chips("#r-views", VIEWS, ui.view, function (v) { return t("r_v_" + v); }, "view");
    chips("#r-curs", d.curs, ui.cur, function (x) { return x; }, "cur");
    $("#r-curs").classList.toggle("hidden", d.curs.length < 2);
    $("#r-export").disabled = !d.list.length;

    $("#r-note").textContent = t("r_note") + (d.unpriced ? " " + t("r_unpriced", { n: d.unpriced }) : "");

    if (!d.list.length) {
      $("#r-summary").innerHTML = "";
      $("#r-list").innerHTML = "";
      $("#r-views").classList.add("hidden");
      $("#r-empty").textContent = t("r_empty");
      $("#r-empty").classList.remove("hidden");
      return;
    }
    $("#r-views").classList.remove("hidden");
    $("#r-empty").classList.add("hidden");

    $("#r-summary").innerHTML =
      '<div class="r-main ' + (T.profit < 0 ? "neg" : "") + '"><span class="r-main-label">' + esc(t("r_profit")) + "</span><b>" +
        sign(T.profit, code) + "</b><span class=\"r-main-sub\">" + esc(t("r_orders", { n: T.orders })) + " · " +
        esc(t("r_markup", { n: money(markup(T)) })) + "</span></div>" +
      '<div class="r-grid">' +
        cell(t("r_revenue"), cur(T.rev, code)) + cell(t("r_cost"), cur(T.cost, code)) +
        cell(t("r_paid"), cur(T.paid, code)) + cell(t("r_debt"), cur(T.debt, code), T.debt > 0 ? "neg" : "") +
      "</div>";

    var rows = ui.view === "months" ? monthRows(d.list) : ui.view === "clients" ? clientRows(d.list) : productRows(d.list);
    var max = rows.reduce(function (m, r) { return Math.max(m, Math.abs(r.agg.profit)); }, 0) || 1;
    $("#r-list").innerHTML = rows.map(function (r) { return rowHtml(r, max, code, T.profit); }).join("");
  }

  function cell(label, value, cls) {
    return '<div class="r-cell ' + (cls || "") + '"><span>' + esc(label) + "</span><b>" + value + "</b></div>";
  }

  // Строки по месяцам (новые сверху) с изменением к прошлому месяцу
  function monthRows(list) {
    var rows = group(list, function (o) { return String(o.order_date).slice(0, 7); }, function (o) { return String(o.order_date).slice(0, 7); });
    var byKey = {};
    rows.forEach(function (r) { byKey[r.key] = r; });
    rows.sort(function (a, b) { return a.key < b.key ? 1 : -1; });
    rows.forEach(function (r) {
      r.name = monthLabel(r.key);
      var prev = byKey[prevMonthKey(r.key)];
      if (prev && prev.agg.profit !== 0) r.delta = Math.round((r.agg.profit - prev.agg.profit) / Math.abs(prev.agg.profit) * 100);
    });
    return rows;
  }
  function clientRows(list) {
    var rows = group(list, clientKey, function (o) { return (o.client && o.client.name) || o.client_name || "—"; });
    rows.forEach(function (r) { r.name = r.label; });
    return rows.sort(function (a, b) { return b.agg.profit - a.agg.profit; });
  }
  function productRows(list) {
    var rows = group(list, productKey, function (o) { return String(o.product_ru || "—").trim(); });
    rows.forEach(function (r) { r.name = r.label; });
    return rows.sort(function (a, b) { return b.agg.profit - a.agg.profit; });
  }

  function rowHtml(r, max, code, totalProfit) {
    var a = r.agg, pct = Math.max(2, Math.round(Math.abs(a.profit) / max * 100));
    var meta = [t("r_orders", { n: a.orders })];
    if (ui.view === "products") meta.push(t("r_qty", { n: money(a.qty) }));
    meta.push(t("r_rev_short", { x: cur(a.rev, code) }));
    meta.push(t("r_markup", { n: money(markup(a)) }));
    if (ui.view === "clients" && totalProfit > 0) meta.push(t("r_share", { n: Math.round(a.profit / totalProfit * 100) }));
    var delta = r.delta == null ? "" : ' <span class="r-delta ' + (r.delta >= 0 ? "up" : "down") + '">' + (r.delta >= 0 ? "▲ " : "▼ ") + Math.abs(r.delta) + "%</span>";
    return '<div class="r-row"><div class="r-line"><b class="r-name">' + esc(r.name) + '</b><span class="r-profit ' + (a.profit < 0 ? "neg" : "pos") + '">' +
      sign(a.profit, code) + "</span></div>" +
      '<div class="r-bar ' + (a.profit < 0 ? "neg" : "") + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="r-meta">' + meta.map(esc).join(" · ") + delta + "</div></div>";
  }

  // ---------- Выгрузка в Excel ----------
  function nstr(n) { return n.toLocaleString(locale(), { useGrouping: false, maximumFractionDigits: 2 }); }

  function exportCsv() {
    var d = build();
    if (!d.list.length) { toast(t("export_empty"), "error"); return; }
    var rows = ui.view === "months" ? monthRows(d.list) : ui.view === "clients" ? clientRows(d.list) : productRows(d.list);
    var first = ui.view === "months" ? "r_col_month" : ui.view === "clients" ? "r_col_client" : "r_col_product";
    var cols = [first, "r_col_orders"].concat(ui.view === "products" ? ["r_col_qty"] : [],
      ["r_col_revenue", "r_col_cost", "r_col_profit", "r_col_markup", "r_col_paid", "r_col_debt"],
      ui.view === "clients" ? ["r_col_share"] : [], ["r_col_cur"]);
    var head = cols.map(function (k) { return c.csvCell(t(k)); }).join(";");
    var total = d.total;
    var lines = rows.map(function (r) {
      var a = r.agg;
      var cells = [c.csvCell(r.name), nstr(a.orders)].concat(ui.view === "products" ? [nstr(a.qty)] : [],
        [nstr(a.rev), nstr(a.cost), nstr(a.profit), nstr(markup(a)), nstr(a.paid), nstr(a.debt)],
        ui.view === "clients" ? [nstr(total.profit > 0 ? Math.round(a.profit / total.profit * 1000) / 10 : 0)] : [], [c.csvCell(ui.cur)]);
      return cells.join(";");
    });
    var blob = new Blob(["﻿" + head + "\r\n" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "ula-report-" + ui.view + "-" + ui.period + "-" + ui.cur + "-" + c.todayISO() + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(t("export_done"), "ok");
  }

  // ---------- События ----------
  function bind() {
    $("#tab-report").addEventListener("click", function (e) {
      var p = e.target.closest("[data-period]"), v = e.target.closest("[data-view]"), cu = e.target.closest("[data-cur]");
      if (p) ui.period = p.getAttribute("data-period");
      else if (v) ui.view = v.getAttribute("data-view");
      else if (cu) ui.cur = cu.getAttribute("data-cur");
      else return;
      render();
    });
    $("#r-export").addEventListener("click", exportCsv);
  }

  U.report = { open: render, refresh: render, bind: bind, _build: build, _rows: function () { return ui.view; } };
})(window.ULA);
