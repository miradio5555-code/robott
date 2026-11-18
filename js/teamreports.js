// =====================================================
// ULA FACTORY — аналитика команды (файл 71): показатели сотрудников, загрузка, качество, понедельная динамика,
// выгрузка отчёта в Excel (js/xlsx.js).
// Кто что видит, решает база: с правом reports.view (и владелец) — все и итоги; остальные — только свои показатели.
// Подключается после js/teamwork.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast;
  var PERIODS = [7, 30, 90, 365];
  var S = { days: 30, data: null, seq: 0 };

  function W() { return U.teamwork; }
  function pct(a, b) { return b ? Math.round(100 * a / b) : null; }
  function pctText(a, b) { var p = pct(a, b); return p == null ? "—" : p + "%"; }
  function num(v) { return v == null ? "—" : String(v); }

  async function render(el) {
    var my = ++S.seq;
    el.innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>";
    var to = new Date(Date.now() + 60000), from = new Date(Date.now() - S.days * 864e5);
    var r = await c.db().rpc("team_analytics", { p_ws: W().ws().id, p_from: from.toISOString(), p_to: to.toISOString() });
    if (my !== S.seq) return;
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    S.data = r.data;
    draw(el);
  }

  function kpi(v, key, sub) {
    return '<div class="op-tile op-static"><b>' + esc(v) + "</b><span>" + esc(t(key)) + "</span>" + (sub ? '<small class="muted">' + esc(sub) + "</small>" : "") + "</div>";
  }

  function draw(el) {
    var d = S.data, T = d.totals;
    var head = '<div class="tw-tools op-rep-tools"><div class="chips" role="tablist">' + PERIODS.map(function (n) {
        var on = n === S.days;
        return '<button type="button" class="chip' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" data-rp-days="' + n + '">' + esc(t("rp_days_" + n)) + "</button>";
      }).join("") + "</div>" +
      (T ? '<button type="button" class="btn btn-sm" data-rp-export>' + esc(t("rp_export")) + "</button>" : "") + "</div>" +
      '<p class="muted">' + esc(t(d.all ? "rp_hint_all" : "rp_hint_me")) + "</p>";

    var tot = "";
    if (T) {
      var tk = T.tasks || {}, rv = T.reviews || {}, ms = T.milestones || {}, inc = T.incidents || {}, q = T.quality || {};
      tot = '<h3 class="b-sub">' + esc(t("rp_team")) + '</h3><div class="op-tiles">' +
        kpi(num(tk.done), "rp_k_done", t("rp_of_created", { n: tk.created || 0 })) +
        kpi(pctText(tk.on_time, tk.with_due), "rp_k_on_time", t("rp_of_due", { n: tk.with_due || 0 })) +
        kpi(tk.avg_cycle_h == null ? "—" : tk.avg_cycle_h + " " + t("rp_h"), "rp_k_cycle") +
        kpi(pctText(rv.returned, rv.submitted), "rp_k_returns", t("rp_of_submitted", { n: rv.submitted || 0 })) +
        kpi(pctText(ms.on_time, ms.done), "rp_k_ms_on_time", t("rp_of_done", { n: ms.done || 0 })) +
        kpi(num((T.delays || {}).count), "rp_k_delays") +
        kpi(num(inc.count), "rp_k_incidents", inc.avg_resolve_h == null ? "" : t("rp_resolve_h", { n: inc.avg_resolve_h })) +
        kpi(num(tk.overdue_now), "rp_k_overdue_now") + "</div>" +
        quality(T, q) + weekly(T.weekly || []);
    }

    var people = '<h3 class="b-sub">' + esc(t(d.all ? "rp_people" : "rp_me")) + '</h3><div class="op-table-wrap"><table class="op-table"><thead><tr>' +
      ["to_f_person", "rp_c_done", "rp_k_on_time", "rp_k_cycle", "rp_k_returns", "rp_c_ms", "rp_c_reviewed", "rp_c_open", "op_d_overdue", "to_v_orders"]
        .map(function (k) { return "<th>" + esc(t(k)) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (d.people || []).map(function (p) {
        return "<tr><td>" + esc(p.name || t("tw_no_name")) + "</td><td>" + esc(p.tasks_done) + "</td><td>" + esc(pctText(p.tasks_on_time, p.tasks_with_due)) +
          "</td><td>" + esc(p.avg_cycle_h == null ? "—" : p.avg_cycle_h + " " + t("rp_h")) + "</td><td>" + esc(pctText(p.returned, p.submitted)) +
          "</td><td>" + esc(p.milestones_done + " / " + pctText(p.milestones_on_time, p.milestones_done)) + "</td><td>" + esc(p.reviewed) +
          "</td><td>" + esc(p.open_now) + '</td><td class="' + (p.overdue_now ? "tw-overdue" : "") + '">' + esc(p.overdue_now) + "</td><td>" + esc(p.orders_now) + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="fine-print">' + esc(t("rp_people_note")) + "</p>";

    el.innerHTML = head + tot + people;
  }

  function quality(T, q) {
    var cats = Object.keys((T.delays || {}).by_category || {});
    var inc = T.incidents || {};
    return '<h3 class="b-sub">' + esc(t("rp_quality")) + '</h3><div class="op-tiles">' +
      kpi(num(q.qc_milestones_done), "rp_q_qc_done") + kpi(num(q.qc_milestones_delayed), "rp_q_qc_delayed") +
      kpi(num(q.quality_delays), "rp_q_delays") + kpi(num(q.quality_incidents), "rp_q_incidents") + "</div>" +
      (cats.length ? '<div class="op-table-wrap"><table class="op-table"><caption>' + esc(t("rp_delays_by")) + "</caption><thead><tr><th>" + esc(t("to_f_category")) + "</th><th>" +
        esc(t("rp_c_count")) + "</th><th>" + esc(t("rp_c_shift")) + "</th><th>" + esc(t("rp_c_resolve")) + "</th></tr></thead><tbody>" +
        cats.map(function (k) {
          var x = T.delays.by_category[k];
          return "<tr><td>" + esc(t("to_cat_" + k)) + "</td><td>" + esc(x.count) + "</td><td>" + esc(x.avg_shift_d == null ? "—" : x.avg_shift_d) + "</td><td>" + esc(x.avg_resolve_h == null ? "—" : x.avg_resolve_h) + "</td></tr>";
        }).join("") + "</tbody></table></div>" : "") +
      (Object.keys(inc.by_category || {}).length ? '<p class="op-line"><span class="muted">' + esc(t("rp_inc_by")) + "</span> " +
        Object.keys(inc.by_category).map(function (k) { return '<span class="tw-tag">' + esc(t("op_cat_" + k)) + " " + esc(inc.by_category[k]) + "</span>"; }).join(" ") + "</p>" : "") +
      ((T.steps || []).length ? '<p class="op-line"><span class="muted">' + esc(t("rp_steps")) + "</span> " +
        T.steps.map(function (s) { return '<span class="tw-tag">' + esc(s.title) + " · " + esc(s.delays) + "</span>"; }).join(" ") + "</p>" : "");
  }

  // Одна серия (выполнено задач по неделям): один цвет, тонкие столбцы от нуля, подсказка на столбце, рядом — таблица.
  function weekly(rows) {
    if (!rows.length) return "";
    var max = Math.max.apply(null, [1].concat(rows.map(function (r) { return r.tasks_done; })));
    return '<h3 class="b-sub">' + esc(t("rp_weekly")) + "</h3>" +
      '<div class="rp-chart" role="img" aria-label="' + esc(t("rp_weekly")) + '">' + rows.map(function (r) {
        var tip = t("rp_week_tip", { d: c.fmtDate(r.week), n: r.tasks_done });
        return '<div class="rp-col" title="' + esc(tip) + '"><span class="rp-bar" style="height:' + Math.max(r.tasks_done ? 4 : 0, Math.round(100 * r.tasks_done / max)) + '%"></span>' +
          '<span class="rp-x">' + esc(c.fmtDate(r.week).slice(0, 5)) + "</span></div>";
      }).join("") + "</div>" +
      '<details class="tw-history"><summary>' + esc(t("rp_table")) + '</summary><div class="op-table-wrap"><table class="op-table"><thead><tr><th>' + esc(t("rp_c_week")) + "</th><th>" +
        esc(t("rp_c_created")) + "</th><th>" + esc(t("rp_c_done")) + "</th><th>" + esc(t("rp_k_delays")) + "</th><th>" + esc(t("rp_k_incidents")) + "</th></tr></thead><tbody>" +
        rows.map(function (r) { return "<tr><td>" + esc(c.fmtDate(r.week)) + "</td><td>" + esc(r.tasks_created) + "</td><td>" + esc(r.tasks_done) + "</td><td>" + esc(r.delays) + "</td><td>" + esc(r.incidents) + "</td></tr>"; }).join("") +
      "</tbody></table></div></details>";
  }

  // ---------- Выгрузка в Excel ----------
  function exportXlsx() {
    var d = S.data;
    if (!d || !d.totals || !U.xlsx) return;
    var sub = t("rp_period", { a: c.fmtDate(d.from), b: c.fmtDate(new Date(new Date(d.to).getTime() - 60000).toISOString()) }) + " · " + W().ws().name;
    var frac = function (a, b) { return b ? Math.round(1000 * a / b) / 10 : null; };   // формат pct в js/xlsx.js — «85.0 %», число в процентах
    var people = {
      name: t("rp_people"), title: t("rp_people"), subtitle: sub,
      columns: [{ h: t("to_f_person"), w: 24 }, { h: t("rp_c_done"), w: 12, type: "int" }, { h: t("rp_k_on_time"), w: 12, type: "pct" },
        { h: t("rp_k_cycle") + ", " + t("rp_h"), w: 14, type: "money" }, { h: t("rp_k_returns"), w: 12, type: "pct" }, { h: t("rp_c_ms"), w: 12, type: "int" },
        { h: t("rp_k_ms_on_time"), w: 14, type: "pct" }, { h: t("rp_c_reviewed"), w: 12, type: "int" }, { h: t("rp_c_open"), w: 12, type: "int" },
        { h: t("op_d_overdue"), w: 12, type: "int" }, { h: t("to_v_orders"), w: 12, type: "int" }],
      rows: d.people.map(function (p) {
        return [p.name || "", p.tasks_done, frac(p.tasks_on_time, p.tasks_with_due), p.avg_cycle_h, frac(p.returned, p.submitted), p.milestones_done,
          frac(p.milestones_on_time, p.milestones_done), p.reviewed, p.open_now, p.overdue_now, p.orders_now];
      })
    };
    var dl = (d.totals.delays || {}).by_category || {};
    var delays = {
      name: t("rp_delays_by"), title: t("rp_delays_by"), subtitle: sub,
      columns: [{ h: t("to_f_category"), w: 22 }, { h: t("rp_c_count"), w: 12, type: "int" }, { h: t("rp_c_shift"), w: 16, type: "money" }, { h: t("rp_c_resolve"), w: 16, type: "money" }],
      rows: Object.keys(dl).map(function (k) { return [t("to_cat_" + k), dl[k].count, dl[k].avg_shift_d, dl[k].avg_resolve_h]; })
    };
    var weeks = {
      name: t("rp_weekly"), title: t("rp_weekly"), subtitle: sub,
      columns: [{ h: t("rp_c_week"), w: 14, type: "date" }, { h: t("rp_c_created"), w: 14, type: "int" }, { h: t("rp_c_done"), w: 14, type: "int" },
        { h: t("rp_k_delays"), w: 12, type: "int" }, { h: t("rp_k_incidents"), w: 12, type: "int" }],
      rows: (d.totals.weekly || []).map(function (r) { return [r.week, r.tasks_created, r.tasks_done, r.delays, r.incidents]; })
    };
    U.xlsx.download("ula-team-report-" + c.todayISO() + ".xlsx", [people, delays, weeks]);
    toast(t("rp_exported"), "ok");
  }

  function bind() {
    $("#tab-team").addEventListener("click", function (e) {
      var b = e.target.closest("[data-rp-days]");
      if (b) { S.days = Number(b.getAttribute("data-rp-days")); return render($("#tw-body")); }
      if (e.target.closest("[data-rp-export]")) exportXlsx();
    });
  }

  U.teamreports = { bind: bind, render: render };
})(window.ULA);
