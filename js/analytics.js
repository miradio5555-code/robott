// =====================================================
// ULA FACTORY — раздел «Аналитика»: дашборд с графиками.
//
// Показывает за выбранный период (и в выбранной валюте):
//   • главные цифры: выручка, прибыль, наценка, заказы, средний чек, долги клиентов
//     (с изменением к предыдущему такому же периоду);
//   • график «выручка и прибыль по месяцам»;
//   • заказы по статусам (кольцо);
//   • лучшие клиенты и товары по прибыли, самые крупные должники.
// Выгрузка «все заказы за период» в Excel.
//
// Графики нарисованы обычным HTML и CSS (без библиотек): чёткие на телефоне, подстраиваются под тёмную тему.
// Считается из уже загруженных заказов. Вынесено из app.js; общие помощники — из window.ULA.core.
// Подключается после app.js. Раздел виден только владельцу кабинета.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, money = c.money, num = c.num, cur = c.cur, locale = c.locale, state = c.state, toast = c.toast;

  var PERIODS = ["month", "3m", "12m", "all"];
  var ui = { period: "12m", cur: "", top: "clients", goalEdit: false };
  var STATUS_COLORS = {
    "new": "#8A8F98", awaiting_payment: "#D98A00", purchasing: "#2F6FDE", china_warehouse: "#7A4FD6",
    in_transit: "#3A8FD6", arrived: "#2E9E6A", delivered: "#146C43", cancelled: "#B3202F"
  };

  // ---------- Даты ----------
  function iso(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function monthsOf(period) { return period === "month" ? 1 : period === "3m" ? 3 : 12; }

  // Границы периода; shift = 0 — текущий, 1 — предыдущий такой же. "all" — без границ.
  function range(period, shift) {
    if (period === "all") return shift ? null : { from: "", to: "" };
    var n = monthsOf(period), now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var from = new Date(y, m - (n - 1) - n * shift, 1);
    var to = shift ? new Date(y, m - n * shift + 1, 0) : null;   // у текущего «до сегодня»
    return { from: iso(from), to: to ? iso(to) : "" };
  }
  function inRange(o, r) {
    var d = String(o.order_date || "").slice(0, 10);
    if (!d || !r) return false;
    return (!r.from || d >= r.from) && (!r.to || d <= r.to);
  }
  function monthShort(key) {
    var p = key.split("-"), d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
    var s = d.toLocaleDateString(locale(), { month: "short" }).replace(".", "");
    return s;
  }
  function monthLong(key) {
    var p = key.split("-"), d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
    var s = d.toLocaleDateString(locale(), { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ---------- Подсчёт ----------
  function priced(o) { return o.status !== "cancelled" && o.profit_som != null; }

  function sums(list) {
    var a = { rev: 0, cost: 0, profit: 0, debt: 0, paid: 0, n: 0 };
    list.forEach(function (o) {
      a.n++;
      a.rev += num(o.total_som);
      a.cost += num(o.cost_som);
      a.profit += num(o.profit_som);
      a.paid += Math.min(num(o.paid_amount), num(o.total_som));
      a.debt += Math.max(0, num(o.balance_som));
    });
    a.markup = a.cost > 0 ? Math.round(a.profit / a.cost * 1000) / 10 : 0;
    a.avg = a.n ? a.rev / a.n : 0;
    return a;
  }

  function clientKey(o) {
    var phone = String((o.client && o.client.phone) || o.client_phone || "").replace(/\D/g, "");
    return phone.length >= 9 ? "p" + phone : "n" + String(o.client_name || "").trim().toLowerCase();
  }
  function clientName(o) { return (o.client && o.client.name) || o.client_name || "—"; }
  function productKey(o) { return String(o.product_ru || "").trim().toLowerCase().replace(/\s+/g, " "); }

  // Группировка: ключ → { label, profit, debt, n }, по убыванию поля by
  function top(list, keyFn, labelFn, by, limit) {
    var map = {};
    list.forEach(function (o) {
      var k = keyFn(o), g = map[k] || (map[k] = { label: labelFn(o), profit: 0, debt: 0, n: 0 });
      g.profit += num(o.profit_som);
      g.debt += Math.max(0, num(o.balance_som));
      g.n++;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (g) { return by === "debt" ? g.debt > 0 : true; })
      .sort(function (a, b) { return b[by] - a[by]; }).slice(0, limit);
  }

  function build() {
    var rNow = range(ui.period, 0), rPrev = range(ui.period, 1);
    var all = (state.orders || []).filter(function (o) { return inRange(o, rNow); });
    var live = all.filter(function (o) { return o.status !== "cancelled"; });
    var pr = live.filter(priced);

    var counts = {};
    pr.forEach(function (o) { counts[o.client_currency] = (counts[o.client_currency] || 0) + 1; });
    var curs = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (curs.indexOf(ui.cur) === -1) ui.cur = curs[0] || "";

    var list = pr.filter(function (o) { return o.client_currency === ui.cur; });
    var prevList = rPrev ? (state.orders || []).filter(function (o) { return priced(o) && o.client_currency === ui.cur && inRange(o, rPrev); }) : null;
    var prev = prevList && prevList.length >= 3 ? sums(prevList) : null;   // с 1–2 заказами сравнивать нечего
    return { all: all, list: list, now: sums(list), prev: prev, curs: curs, range: rNow };
  }

  // ---------- Показ ----------
  function chips(id, items, active, labelFn, attr) {
    $(id).innerHTML = items.map(function (it) {
      return '<button type="button" class="chip' + (it === active ? " active" : "") + '" data-' + attr + '="' + esc(it) + '"><span>' +
        esc(labelFn(it)) + "</span></button>";
    }).join("");
  }

  // 12 400 → «12,4 тыс», 3 100 000 → «3,1 млн»
  function short(n) {
    var a = Math.abs(n), s = n < 0 ? "−" : "";
    var f = function (x) { return (Math.round(x * 10) / 10).toLocaleString(locale()); };
    if (a >= 1e6) return s + f(a / 1e6) + " " + t("an_m");
    if (a >= 1e5) return s + f(a / 1e3) + " " + t("an_k");
    return s + money(Math.round(n));
  }

  function delta(now, prev, higherIsGood) {
    if (prev == null || prev === 0) return "";
    var p = Math.round((now - prev) / Math.abs(prev) * 100);
    if (!isFinite(p) || p === 0) return "";
    p = Math.max(-999, Math.min(999, p));
    var good = higherIsGood ? p > 0 : p < 0;
    return '<em class="an-delta ' + (good ? "up" : "down") + '">' + (p > 0 ? "▲ " : "▼ ") + Math.abs(p) + "%</em>";
  }

  function kpi(label, value, extra, cls) {
    return '<div class="an-kpi ' + (cls || "") + '"><span>' + esc(label) + "</span><b>" + value + "</b>" + (extra || "") + "</div>";
  }

  // Чистая прибыль = прибыль с заказов − расходы (раздел «Расходы»); без расходов — приглашение их записать
  function netHtml(d) {
    if (!U.expenses || !U.expenses.ready()) return "";
    var spent = U.expenses.sumFor(ui.cur, d.range) || 0;
    if (!spent) return '<button type="button" class="an-net empty" data-expenses>' + esc(t("an_net_add")) + " →</button>";
    var net = d.now.profit - spent;
    return '<button type="button" class="an-net' + (net < 0 ? " neg" : "") + '" data-expenses><span>' + esc(t("an_net", { s: cur(spent, ui.cur) })) +
      "</span><b>" + esc(cur(net, ui.cur)) + "</b></button>";
  }

  // Одна главная цифра (прибыль) + три маленьких; остальное — в «Подробнее»
  function kpisHtml(d) {
    var N = d.now, P = d.prev, code = ui.cur;
    return '<div class="an-hero ' + (N.profit < 0 ? "neg" : "") + '"><span>' + esc(t("r_profit")) + "</span><b>" + esc(cur(N.profit, code)) + "</b>" +
        '<small>' + esc(t("r_orders", { n: N.n })) + " · " + esc(t("r_markup", { n: money(N.markup) })) + "</small>" + delta(N.profit, P && P.profit, true) + "</div>" +
      netHtml(d) +
      '<div class="an-kpis3">' +
        kpi(t("r_revenue"), esc(short(N.rev)) + " <small>" + esc(code) + "</small>", delta(N.rev, P && P.rev, true)) +
        kpi(t("an_orders"), money(N.n), delta(N.n, P && P.n, true)) +
        kpi(t("r_debt"), esc(short(N.debt)) + " <small>" + esc(code) + "</small>", delta(N.debt, P && P.debt, false), N.debt > 0 ? "warn" : "") +
      "</div>" +
      '<details class="an-more"><summary>' + esc(t("an_more")) + "</summary><div class=\"an-kpis3\">" +
        kpi(t("an_markup"), money(N.markup) + " %", delta(N.markup, P && P.markup, true)) +
        kpi(t("an_avg"), esc(short(Math.round(N.avg))) + " <small>" + esc(code) + "</small>", delta(N.avg, P && P.avg, true)) +
        kpi(t("r_cost"), esc(short(N.cost)) + " <small>" + esc(code) + "</small>", "") +
      "</div></details>";
  }

  // Колонки «по месяцам»
  function monthKeys(d) {
    var keys = [], now = new Date();
    var first;
    if (ui.period === "all") {
      var min = d.list.reduce(function (m, o) { var k = String(o.order_date).slice(0, 7); return !m || k < m ? k : m; }, "");
      first = min ? new Date(Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
      var floor = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      if (first < floor) first = floor;                       // не больше 12 колонок
    } else {
      first = new Date(now.getFullYear(), now.getMonth() - (monthsOf(ui.period) - 1), 1);
    }
    for (var d2 = first; d2 <= now; d2 = new Date(d2.getFullYear(), d2.getMonth() + 1, 1)) {
      keys.push(d2.getFullYear() + "-" + ("0" + (d2.getMonth() + 1)).slice(-2));
    }
    return keys;
  }

  function monthsBy(d) {
    var keys = monthKeys(d), by = {};
    keys.forEach(function (k) { by[k] = { rev: 0, profit: 0 }; });
    d.list.forEach(function (o) {
      var g = by[String(o.order_date).slice(0, 7)];
      if (g) { g.rev += num(o.total_som); g.profit += num(o.profit_som); }
    });
    return by;
  }

  function monthsHtml(d) {
    var keys = monthKeys(d), by = {};
    keys.forEach(function (k) { by[k] = { rev: 0, profit: 0 }; });
    d.list.forEach(function (o) {
      var g = by[String(o.order_date).slice(0, 7)];
      if (g) { g.rev += num(o.total_som); g.profit += num(o.profit_som); }
    });
    var max = keys.reduce(function (m, k) { return Math.max(m, by[k].rev, Math.abs(by[k].profit)); }, 0) || 1;
    var best = keys.reduce(function (b, k) { return !b || by[k].profit > by[b].profit ? k : b; }, "");
    var cols = keys.map(function (k) {
      var g = by[k];
      var hr = g.rev ? Math.max(3, Math.round(g.rev / max * 100)) : 0, hp = g.profit ? Math.max(3, Math.round(Math.abs(g.profit) / max * 100)) : 0;
      return '<button type="button" class="an-col' + (k === best ? " on" : "") + '" data-month="' + k + '" data-rev="' + g.rev + '" data-profit="' + g.profit + '">' +
        '<span class="an-bars"><i class="rev" style="height:' + hr + '%"></i><i class="pro' + (g.profit < 0 ? " neg" : "") + '" style="height:' + hp + '%"></i></span>' +
        '<span class="an-lbl">' + esc(monthShort(k)) + "</span></button>";
    }).join("");
    return '<div class="an-legend"><span><i class="rev"></i>' + esc(t("r_revenue")) + '</span><span><i class="pro"></i>' + esc(t("r_profit")) + "</span></div>" +
      '<div class="an-cols" style="--n:' + keys.length + '">' + cols + "</div>" +
      '<p id="an-readout" class="an-readout" aria-live="polite">' + readout(best, by[best]) + "</p>";
  }

  function readout(key, g) {
    if (!key || !g) return "";
    return "<b>" + esc(monthLong(key)) + "</b> · " + esc(t("r_revenue")) + " " + esc(cur(g.rev, ui.cur)) + " · " + esc(t("r_profit")) + " " + esc(cur(g.profit, ui.cur));
  }

  // Кольцо «заказы по статусам»
  function statusHtml(d) {
    var counts = {}, total = 0;
    d.all.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; total++; });
    var order = ["new", "awaiting_payment", "purchasing", "china_warehouse", "in_transit", "arrived", "delivered", "cancelled"];
    var parts = [], acc = 0;
    order.forEach(function (s) {
      if (!counts[s]) return;
      var from = acc / total * 100; acc += counts[s];
      parts.push(STATUS_COLORS[s] + " " + from.toFixed(2) + "% " + (acc / total * 100).toFixed(2) + "%");
    });
    var legend = order.filter(function (s) { return counts[s]; }).map(function (s) {
      return '<li><i style="background:' + STATUS_COLORS[s] + '"></i><span>' + esc(t("status_" + s)) + "</span><b>" + counts[s] + "</b></li>";
    }).join("");
    return '<div class="an-donut-wrap"><div class="an-donut" style="background:conic-gradient(' + parts.join(",") + ')"><div><b>' + total + "</b><span>" + esc(t("an_orders")) + "</span></div></div>" +
      '<ul class="an-legend-list">' + legend + "</ul></div>";
  }

  // Горизонтальные полоски «топ»
  function barsHtml(rows, field, code, negCls) {
    if (!rows.length) return '<p class="muted an-none">' + esc(t("an_none")) + "</p>";
    var max = rows.reduce(function (m, r) { return Math.max(m, Math.abs(r[field])); }, 0) || 1;
    return rows.map(function (r) {
      var pct = Math.max(3, Math.round(Math.abs(r[field]) / max * 100));
      return '<div class="an-hrow"><div class="an-hline"><span class="an-hname">' + esc(r.label) + "</span><b>" + esc(cur(r[field], code)) + "</b></div>" +
        '<div class="an-hbar ' + (negCls || "") + (r[field] < 0 ? " neg" : "") + '"><i style="width:' + pct + '%"></i></div></div>';
    }).join("");
  }

  // ---------- Выводы простыми словами ----------
  function insightsHtml(d, monthsBy) {
    var N = d.now, P = d.prev, code = ui.cur, lines = [];
    if (P && P.profit > 0) {
      var p = Math.round((N.profit - P.profit) / P.profit * 100);
      if (p !== 0) lines.push([p > 0 ? "up" : "down", t(p > 0 ? "an_i_up" : "an_i_down", { n: Math.min(999, Math.abs(p)) })]);
    }
    var months = Object.keys(monthsBy).filter(function (k) { return monthsBy[k].rev > 0; });
    if (months.length >= 2) {
      var best = months.reduce(function (b, k) { return monthsBy[k].profit > monthsBy[b].profit ? k : b; }, months[0]);
      lines.push(["", t("an_i_best", { m: monthLong(best), s: cur(monthsBy[best].profit, code) })]);
    }
    var tc = top(d.list, clientKey, clientName, "profit", 1)[0];
    if (tc && N.profit > 0 && tc.profit > 0 && d.list.length >= 3) {
      lines.push(["", t("an_i_client", { name: tc.label, n: Math.round(tc.profit / N.profit * 100) })]);
    }
    var td = top(d.list, clientKey, clientName, "debt", 1)[0];
    if (td) lines.push(["down", t("an_i_debt", { name: td.label, s: cur(td.debt, code) })]);
    if (!lines.length) return "";
    return '<ul class="an-insights">' + lines.map(function (l) { return '<li class="' + l[0] + '">' + esc(l[1]) + "</li>"; }).join("") + "</ul>";
  }

  // ---------- Что требует внимания ----------
  function daysSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

  function attentionHtml(d) {
    var all = state.orders || [], items = [];
    function row(o, text, tone) {
      return '<button type="button" class="an-att ' + tone + '" data-open="' + esc(o.id) + '"><span>' + esc(text) + "</span><i>›</i></button>";
    }
    var noPrice = all.filter(function (o) { return o.status !== "cancelled" && o.status !== "delivered" && o.profit_som == null; });
    if (noPrice.length) {
      items.push('<p class="an-att-head">' + esc(t("an_a_noprice", { n: noPrice.length })) + "</p>");
      noPrice.slice(0, 3).forEach(function (o) { items.push(row(o, "№ " + o.order_number + " · " + clientName(o), "warn")); });
    }
    var debts = all.filter(function (o) { return o.status !== "cancelled" && num(o.balance_som) > 0 && o.order_date && daysSince(o.order_date) >= 7; })
      .sort(function (a, b) { return num(b.balance_som) - num(a.balance_som); });
    if (debts.length) {
      items.push('<p class="an-att-head">' + esc(t("an_a_debts", { n: debts.length })) + "</p>");
      debts.slice(0, 3).forEach(function (o) {
        items.push(row(o, clientName(o) + " · " + cur(o.balance_som, o.client_currency) + " · " + t("an_days", { n: daysSince(o.order_date) }), "bad"));
      });
    }
    var losses = (d ? d.list : []).filter(function (o) { return num(o.profit_som) < 0; })
      .sort(function (a, b) { return num(a.profit_som) - num(b.profit_som); });
    if (losses.length) {
      items.push('<p class="an-att-head">' + esc(t("an_a_loss", { n: losses.length })) + "</p>");
      losses.slice(0, 3).forEach(function (o) {
        items.push(row(o, "№ " + o.order_number + " · " + clientName(o) + " · " + cur(o.profit_som, o.client_currency), "bad"));
      });
    }
    var stuck = all.filter(function (o) { return o.status !== "cancelled" && o.status !== "delivered" && o.updated_at && daysSince(o.updated_at) >= 10; })
      .sort(function (a, b) { return String(a.updated_at).localeCompare(String(b.updated_at)); });
    if (stuck.length) {
      items.push('<p class="an-att-head">' + esc(t("an_a_stuck", { n: stuck.length })) + "</p>");
      stuck.slice(0, 3).forEach(function (o) {
        items.push(row(o, "№ " + o.order_number + " · " + t("status_" + o.status) + " · " + t("an_days", { n: daysSince(o.updated_at) }), "warn"));
      });
    }
    var live = all.filter(function (o) { return o.status !== "cancelled" && o.status !== "delivered"; }).length;
    var head = '<p class="an-live">' + esc(t("an_a_live", { n: live })) + "</p>";
    return items.length ? head + items.join("") : head + '<p class="an-ok">' + U.icon("check", 16) + esc(t("an_a_ok")) + "</p>";
  }

  // ---------- Цель по прибыли на месяц ----------
  function canEditGoal() { return !state.readOnly && state.ws && state.myWs && state.myWs.id === state.ws.id; }

  function goalHtml() {
    var code = ui.cur;
    var goal = num(((state.ws && state.ws.profit_goals) || {})[code]);
    var month = c.todayISO().slice(0, 7), got = 0;
    (state.orders || []).forEach(function (o) {
      if (priced(o) && o.client_currency === code && String(o.order_date).slice(0, 7) === month) got += num(o.profit_som);
    });
    var now = new Date(), daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    var edit = ui.goalEdit && canEditGoal();
    var html = "";

    if (goal > 0) {
      var pct = Math.max(0, Math.round(got / goal * 100));
      html += '<div class="an-goal-line"><b>' + esc(cur(got, code)) + "</b><span>" + esc(t("an_g_of", { s: cur(goal, code) })) + "</span></div>" +
        '<div class="an-goal-bar' + (pct >= 100 ? " done" : "") + '"><i style="width:' + Math.min(100, pct) + '%"></i></div>' +
        '<p class="an-goal-note">' + esc(pct >= 100 ? t("an_g_done") :
          t("an_g_left", { p: pct, d: daysLeft }) + (daysLeft > 0 ? " " + t("an_g_need", { s: cur(Math.ceil((goal - got) / daysLeft), code) }) : "")) + "</p>";
    } else {
      html += '<p class="muted an-none">' + esc(t("an_g_none")) + "</p>";
    }

    if (canEditGoal()) {
      if (edit) {
        html += '<div class="an-goal-form"><input id="an-goal-input" type="text" inputmode="decimal" autocomplete="off" placeholder="' + esc(t("an_g_ph", { c: code })) +
          '" value="' + (goal > 0 ? esc(c.numStr(goal)) : "") + '"><button type="button" class="btn btn-primary" data-goal="save">' + esc(t("s_save")) + "</button>" +
          (goal > 0 ? '<button type="button" class="btn btn-ghost" data-goal="clear">' + esc(t("an_g_clear")) + "</button>" : "") + "</div>";
      } else {
        html += '<button type="button" class="btn" data-goal="edit">' + esc(t(goal > 0 ? "an_g_change" : "an_g_set")) + "</button>";
      }
    }
    return html;
  }

  async function saveGoal(amount) {
    var res = await c.db().rpc("set_profit_goal", { p_ws: state.ws.id, p_cur: ui.cur, p_amount: amount });
    if (res.error) { c.handleError(res.error); return; }
    state.ws.profit_goals = res.data;
    if (state.myWs && state.myWs.id === state.ws.id) state.myWs.profit_goals = res.data;
    ui.goalEdit = false;
    toast(t("s_saved"), "ok");
    render();
  }

  // Блок «лучшие клиенты / товары / должники» с переключателем
  function topBlock(d) {
    var code = ui.cur, tabs = ["clients", "products", "debtors"];
    var rows, field = "profit", cls = "";
    if (ui.top === "products") rows = top(d.list, productKey, function (o) { return String(o.product_ru || "—").trim(); }, "profit", 5);
    else if (ui.top === "debtors") { rows = top(d.list, clientKey, clientName, "debt", 5); field = "debt"; cls = "warn"; }
    else rows = top(d.list, clientKey, clientName, "profit", 5);
    var sw = '<div class="chips an-tabs">' + tabs.map(function (k) {
      return '<button type="button" class="chip' + (k === ui.top ? " active" : "") + '" data-top="' + k + '"><span>' + esc(t("an_top_" + k)) + "</span></button>";
    }).join("") + "</div>";
    return sw + barsHtml(rows, field, code, cls);
  }

  function card(title, body, cls) {
    return '<section class="an-card ' + (cls || "") + '"><h3>' + esc(title) + "</h3>" + body + "</section>";
  }

  function render() {
    if ($("#tab-analytics").classList.contains("hidden")) return;
    if (U.expenses && !U.expenses.ready()) U.expenses.ensure().then(function () { if (U.expenses.ready()) render(); });
    var d = build();
    chips("#an-periods", PERIODS, ui.period, function (p) { return t("r_p_" + p); }, "period");
    chips("#an-curs", d.curs, ui.cur, function (x) { return x; }, "cur");
    $("#an-curs").classList.toggle("hidden", d.curs.length < 2);
    $("#an-export").disabled = !d.all.length;

    if (!d.all.length) {
      $("#an-body").innerHTML = "";
      $("#an-empty").textContent = t("an_empty");
      $("#an-empty").classList.remove("hidden");
      return;
    }
    $("#an-empty").classList.add("hidden");

    var html = "";
    if (d.list.length) {
      html += '<div class="an-top">' + insightsHtml(d, monthsBy(d)) + kpisHtml(d) + "</div>";
    } else {
      html += '<p class="fine-print an-top">' + esc(t("an_no_price")) + "</p>";
    }
    if (ui.cur) html += card(t("an_goal", { c: ui.cur }), goalHtml(), "goal");
    html += card(t("an_attention"), attentionHtml(d), "att");
    if (d.list.length) html += card(t("an_by_month"), monthsHtml(d), "wide");
    html += card(t("an_by_status"), statusHtml(d));
    if (d.list.length) html += card(t("an_top"), topBlock(d));
    html += '<button type="button" class="btn btn-block an-detail" data-detail>' + esc(t("an_detail")) + " →</button>";
    $("#an-body").innerHTML = html;
  }

  // ---------- Выгрузка всех заказов за период в Excel ----------
  function exportOrders() {
    var d = build();
    if (!d.all.length) { toast(t("export_empty"), "error"); return; }
    var list = d.all.slice().sort(function (a, b) { return String(a.order_date) < String(b.order_date) ? 1 : -1; });
    U.xlsx.download("ula-orders-" + ui.period + "-" + c.todayISO() + ".xlsx", [{
      name: t("nav_orders"),
      title: (state.ws ? state.ws.name + " — " : "") + t("nav_orders"),
      subtitle: t("r_p_" + ui.period) + " · " + t("x_made", { d: c.fmtDate(c.todayISO()) }) + " · " + t("x_count", { n: list.length }),
      columns: [
        { h: t("an_c_num"), w: 14, type: "text" }, { h: t("an_c_date"), w: 12, type: "date" }, { h: t("an_c_status"), w: 18, type: "text" },
        { h: t("l_name"), w: 24, type: "text" }, { h: t("l_phone"), w: 18, type: "text" }, { h: t("an_c_product"), w: 36, type: "text" },
        { h: t("an_c_qty"), w: 8, type: "int" }, { h: t("an_c_cur"), w: 8, type: "text" },
        { h: t("r_col_revenue"), w: 14, type: "money" }, { h: t("r_col_paid"), w: 14, type: "money" }, { h: t("r_col_debt"), w: 14, type: "money" },
        { h: t("r_col_cost"), w: 14, type: "money" }, { h: t("r_col_profit"), w: 14, type: "money" }
      ],
      rows: list.map(function (o) {
        var known = o.profit_som != null;
        return [o.order_number, String(o.order_date || "").slice(0, 10), t("status_" + o.status), clientName(o),
          o.client_phone ? c.fmtPhone(o.client_phone) : "", o.product_ru, num(o.quantity), o.client_currency || "",
          num(o.total_som), num(o.paid_amount), o.status === "cancelled" ? 0 : Math.max(0, num(o.balance_som)), known ? num(o.cost_som) : null, known ? num(o.profit_som) : null];
      }),
      total: null
    }]);
    toast(t("export_done"), "ok");
  }

  // ---------- События ----------
  function bind() {
    $("#tab-analytics").addEventListener("click", function (e) {
      var col = e.target.closest("[data-month]");
      if (col) {
        $$cols().forEach(function (b) { b.classList.toggle("on", b === col); });
        $("#an-readout").innerHTML = readout(col.getAttribute("data-month"), { rev: num(col.getAttribute("data-rev")), profit: num(col.getAttribute("data-profit")) });
        return;
      }
      if (e.target.closest("[data-detail]")) { c.switchTab("report"); return; }
      if (e.target.closest("[data-expenses]")) { c.switchTab("expenses"); return; }
      var g = e.target.closest("[data-goal]");
      if (g) {
        var act = g.getAttribute("data-goal");
        if (act === "edit") { ui.goalEdit = true; render(); var inp = $("#an-goal-input"); if (inp) inp.focus(); }
        else if (act === "clear") saveGoal(0);
        else if (act === "save") {
          var v = c.parseNum($("#an-goal-input").value);
          if (!(v > 0)) { toast(t("an_g_bad"), "error"); return; }
          saveGoal(v);
        }
        return;
      }
      var op = e.target.closest("[data-open]");
      if (op) { c.openDetail(op.getAttribute("data-open")); return; }
      var tp = e.target.closest("[data-top]");
      if (tp) { ui.top = tp.getAttribute("data-top"); render(); return; }
      var p = e.target.closest("[data-period]"), cu = e.target.closest("[data-cur]");
      if (p) ui.period = p.getAttribute("data-period");
      else if (cu) ui.cur = cu.getAttribute("data-cur");
      else return;
      render();
    });
    $("#an-export").addEventListener("click", exportOrders);
  }
  function $$cols() { return Array.prototype.slice.call(document.querySelectorAll("#an-body .an-col")); }

  U.analytics = { open: render, refresh: render, bind: bind, _build: build };
})(window.ULA);
