// =====================================================
// ULA FACTORY — операционный контроль (файл 70): сводка, инциденты, календарь, регламенты (SOP).
// Что видно и что можно, решает база (каждая функция проверяет права); здесь только экраны.
// Без файла 70 в базе этих вкладок нет (task_counts без поля ops).
// Подключается после js/teamwork.js, js/teamtasks.js и js/teamorders.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast;
  var SEV = ["low", "medium", "high", "critical"];
  var CAT = ["supplier", "quality", "logistics", "customs", "client", "finance", "safety", "other"];
  var S = { incScope: "open", incCur: null, sopCur: null, calFrom: null, calMine: false, seq: 0, sops: [] };

  function W() { return U.teamwork; }
  function db() { return c.db(); }
  function ws() { return W().ws().id; }
  function loading(el) { el.innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>"; }
  function sevPill(s) { return '<span class="tw-st op-sev-' + esc(s) + '">' + esc(t("op_sev_" + s)) + "</span>"; }
  function istPill(s) { return '<span class="tw-st op-ist-' + esc(s) + '">' + esc(t("op_ist_" + s)) + "</span>"; }
  function localInput(iso) {
    if (!iso) return "";
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function iso(v) { return v ? new Date(v).toISOString() : null; }
  async function call(name, args) {
    var r = await db().rpc(name, args);
    if (r.error) { W().fail(r.error); return null; }
    return r;
  }

  function render(view, el) {
    if (view === "dashboard") return renderDashboard(el);
    if (view === "incidents") return renderIncidents(el);
    if (view === "calendar") return renderCalendar(el);
    if (view === "sops") return renderSops(el);
  }

  // ---------- Сводка ----------
  function tile(n, key, view, tone) {
    return '<button type="button" class="op-tile' + (tone && n ? " op-" + tone : "") + '"' + (view ? ' data-tw-view="' + view + '"' : "") + ">" +
      '<b>' + esc(String(n || 0)) + "</b><span>" + esc(t(key)) + "</span></button>";
  }

  async function renderDashboard(el) {
    var my = ++S.seq;
    loading(el);
    var r = await db().rpc("ops_dashboard", { p_ws: ws() });
    if (my !== S.seq) return;
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    var d = r.data, o = d.orders || {}, m = d.milestones || {}, tk = d.tasks || {}, inc = d.incidents || {}, dl = d.delays || {};
    var cats = Object.keys(dl.by_category || {}).map(function (k) { return '<span class="tw-tag">' + esc(t("to_cat_" + k)) + " " + esc(dl.by_category[k]) + "</span>"; }).join(" ");
    var sevs = SEV.slice().reverse().filter(function (k) { return (inc.by_severity || {})[k]; })
      .map(function (k) { return sevPill(k) + " " + esc(inc.by_severity[k]); }).join(" ");
    var max = Math.max.apply(null, [1].concat((d.workload || []).map(function (w) { return w.open; })));
    el.innerHTML =
      '<p class="muted">' + esc(t("op_dash_hint")) + "</p>" +
      '<h3 class="b-sub">' + esc(t("op_dash_orders")) + '</h3><div class="op-tiles">' +
        tile(o.open, "op_d_open") + tile(o.on_track, "to_state_on_track") + tile(o.at_risk, "to_state_at_risk", "attention", "warn") +
        tile(o.delayed, "to_state_delayed", "attention", "bad") + tile(o.no_lead, "op_d_no_lead", null, "warn") +
        tile(m.overdue, "op_d_ms_overdue", "attention", "bad") + tile(m.due_7d, "op_d_ms_week") + "</div>" +
      (cats ? '<p class="op-line"><span class="muted">' + esc(t("op_d_delays_by", { n: dl.open || 0 })) + "</span> " + cats + "</p>" : "") +
      '<h3 class="b-sub">' + esc(t("op_dash_tasks")) + '</h3><div class="op-tiles">' +
        tile(tk.open, "op_d_open", "all") + tile(tk.overdue, "op_d_overdue", "all", "bad") + tile(tk.blocked, "tw_st_blocked", "all", "warn") +
        tile(tk.submitted, "tw_st_submitted", "review") + tile(tk.unassigned, "tw_unassigned", "all", "warn") + tile(tk.done_7d, "op_d_done_week") + "</div>" +
      '<h3 class="b-sub">' + esc(t("op_dash_incidents")) + '</h3><div class="op-tiles">' +
        tile(inc.open, "op_d_inc_open", "incidents", "bad") + tile((d.sops || {}).published, "op_d_sops") + tile((d.sops || {}).unread, "op_d_sops_unread", "sops", "warn") + "</div>" +
      (sevs ? '<p class="op-line">' + sevs + "</p>" : "") +
      '<h3 class="b-sub">' + esc(t("op_dash_workload")) + "</h3>" +
      '<div class="op-table-wrap"><table class="op-table"><thead><tr><th>' + esc(t("to_f_person")) + "</th><th>" + esc(t("op_w_open")) + "</th><th>" + esc(t("op_d_overdue")) +
        "</th><th>" + esc(t("tw_v_review")) + "</th><th>" + esc(t("to_v_orders")) + "</th><th>" + esc(t("op_v_incidents")) + "</th></tr></thead><tbody>" +
        (d.workload || []).map(function (w) {
          return "<tr><td>" + esc(w.name || t("tw_no_name")) + '<span class="op-bar" aria-hidden="true"><i style="width:' + Math.round(100 * w.open / max) + '%"></i></span></td>' +
            "<td>" + esc(w.open) + '</td><td class="' + (w.overdue ? "tw-overdue" : "") + '">' + esc(w.overdue) + "</td><td>" + esc(w.review) + "</td><td>" + esc(w.orders) + "</td><td>" + esc(w.incidents) + "</td></tr>";
        }).join("") + "</tbody></table></div>";
  }

  // ---------- Инциденты ----------
  async function renderIncidents(el) {
    var my = ++S.seq;
    loading(el);
    var r = await db().rpc("incident_list", { p_ws: ws(), p_scope: S.incScope });
    if (my !== S.seq) return;
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    var list = r.data || [];
    el.innerHTML = '<div class="tw-tools"><button type="button" class="btn btn-sm" data-op-scope>' + esc(t(S.incScope === "open" ? "op_inc_show_all" : "op_inc_show_open")) + "</button>" +
        '<button type="button" class="btn btn-sm btn-primary" data-op-inc-new>' + esc("+ " + t("op_inc_new")) + "</button></div>" +
      (list.length ? '<div class="tw-list">' + list.map(function (i) {
        return '<button type="button" class="tw-task op-inc' + (i.severity === "critical" ? " is-overdue" : "") + '" data-op-inc="' + esc(i.id) + '">' +
          '<span class="tw-task-top"><span class="tw-num">' + esc(t("op_inc_no", { n: i.number })) + "</span>" + istPill(i.status) + sevPill(i.severity) +
            '<span class="tw-tag">' + esc(t("op_cat_" + i.category)) + "</span>" + (i.order_number ? '<span class="tw-tag">' + esc(i.order_number) + "</span>" : "") + "</span>" +
          '<span class="tw-task-title">' + esc(i.title) + "</span>" +
          '<span class="tw-task-meta muted">' + esc([i.owner_id ? t("op_owner_n", { n: W().nameOf(i.owner_id) }) : t("op_no_owner"), c.fmtTime(i.created_at),
            i.actions_open ? t("op_actions_open", { n: i.actions_open }) : ""].filter(Boolean).join(" · ")) + "</span></button>";
      }).join("") + "</div>" : W().emptyBox(S.incScope === "open" ? "op_inc_empty" : "op_inc_empty_all"));
  }

  async function orderOptions() {
    var list = (c.state.orders || []).filter(function (o) { return o.status !== "delivered" && o.status !== "cancelled"; })
      .map(function (o) { return [o.id, o.order_number + " · " + (o.product_ru || "")]; });
    if (!list.length) {
      var r = await db().rpc("order_ops_list", { p_ws: ws(), p_scope: "mine" });
      list = ((r && r.data) || []).map(function (o) { return [o.id, o.order_number + " · " + (o.product_ru || "")]; });
    }
    return [["", t("op_no_order")]].concat(list.slice(0, 300));
  }

  async function openIncidentForm(orderId) {
    var w = W(), opts = await orderOptions();
    w.openForm(t("op_inc_new"),
      '<p class="muted">' + esc(t("op_inc_hint")) + "</p>" +
      w.field(t("op_f_inc_title"), '<input name="title" type="text" maxlength="200" required>') +
      w.field(t("op_f_inc_desc"), '<textarea name="desc" rows="3" maxlength="4000"></textarea>') +
      '<div class="grid-2">' + w.field(t("op_f_severity"), w.select("sev", SEV.map(function (s) { return [s, t("op_sev_" + s)]; }), "medium")) +
        w.field(t("to_f_category"), w.select("cat", CAT.map(function (s) { return [s, t("op_cat_" + s)]; }), "other")) + "</div>" +
      w.field(t("to_f_order"), w.select("order", opts, orderId || "")) +
      (w.can("ops.manage") ? w.field(t("op_f_owner"), w.select("owner", w.memberOpts([], t("op_no_owner")), "")) : ""),
      async function (get) {
        if (!get("title")) { w.formError(t("tw_e_name")); return false; }
        var r = await call("incident_create", { p_ws: ws(), p_title: get("title"), p_description: get("desc") || null, p_severity: get("sev"),
          p_category: get("cat"), p_order: get("order") || null, p_owner: get("owner") || null });
        if (!r) return false;
        toast(t("op_inc_saved"), "ok");
        W().refreshCounts();
        W().rerender();
        openIncident(r.data);
      }, "op_inc_report");
  }

  async function openIncident(id) {
    $("#tw-doc-title").textContent = t("loading");
    $("#tw-doc-body").innerHTML = "";
    c.openModal("modal-tw-doc");
    var r = await call("incident_get", { p_id: id });
    if (!r) { c.closeModal("modal-tw-doc"); return; }
    S.incCur = r.data; S.sopCur = null;
    drawIncident();
  }

  function drawIncident() {
    var i = S.incCur, can = i.can || {};
    var acts = [];
    if (can.work && (i.status === "open")) acts.push(["investigating", "op_act_investigate", "primary"]);
    if (can.work && (i.status === "open" || i.status === "investigating")) acts.push(["@resolve", "op_act_resolve", i.status === "investigating" ? "primary" : ""]);
    if (can.close && i.status === "resolved") acts.push(["closed", "op_act_close", "primary"]);
    if (can.work && i.status === "resolved") acts.push(["investigating", "op_act_reopen", ""]);
    if (can.close && i.status === "closed") acts.push(["investigating", "op_act_reopen", ""]);
    if (can.manage && i.status !== "closed") acts.push(["@edit", "op_act_owner", ""]);
    if (can.work && (i.status === "open" || i.status === "investigating")) acts.push(["@action", "to_action_add", ""]);
    $("#tw-doc-title").textContent = t("op_inc_no", { n: i.number }) + " · " + i.title;
    $("#tw-doc-body").innerHTML =
      '<div class="tw-task-top">' + istPill(i.status) + sevPill(i.severity) + '<span class="tw-tag">' + esc(t("op_cat_" + i.category)) + "</span></div>" +
      '<dl class="tw-meta">' +
        '<div class="tw-meta-row"><dt>' + esc(t("op_f_owner")) + "</dt><dd>" + esc(i.owner_id ? W().nameOf(i.owner_id) : t("op_no_owner")) + "</dd></div>" +
        '<div class="tw-meta-row"><dt>' + esc(t("op_f_reporter")) + "</dt><dd>" + esc(W().nameOf(i.reported_by) + " · " + c.fmtTime(i.created_at)) + "</dd></div>" +
        (i.order_id ? '<div class="tw-meta-row"><dt>' + esc(t("to_f_order")) + '</dt><dd><button type="button" class="link-btn" data-tw-order="' + esc(i.order_id) + '">' + esc(i.order_number || "—") + "</button></dd></div>" : "") +
      "</dl>" +
      (i.description ? '<p class="tw-desc">' + esc(i.description) + "</p>" : "") +
      (i.root_cause ? '<p class="op-kv"><b>' + esc(t("op_f_root")) + "</b> " + esc(i.root_cause) + "</p>" : "") +
      (i.resolution ? '<p class="op-kv"><b>' + esc(t("op_f_resolution")) + "</b> " + esc(i.resolution) + "</p>" : "") +
      ((i.actions || []).length ? '<h3 class="b-sub">' + esc(t("to_actions")) + '</h3><div class="to-actions-list">' + i.actions.map(function (a) {
        return '<button type="button" class="to-action" data-task="' + esc(a.id) + '"><span class="tw-st tw-st-' + esc(a.status) + '">' + esc(t("tw_st_" + a.status)) + "</span> " +
          esc(t("tw_task_no", { n: a.number }) + " " + a.title) + ' <span class="muted">· ' + esc(a.assignee_id ? W().nameOf(a.assignee_id) : t("tw_unassigned")) + "</span></button>";
      }).join("") + "</div>" : "") +
      (acts.length ? '<div class="tw-actions">' + acts.map(function (a) {
        return '<button type="button" class="btn btn-sm' + (a[2] === "primary" ? " btn-primary" : "") + '" data-op-ist="' + a[0] + '">' + esc(t(a[1])) + "</button>";
      }).join("") + "</div>" : "") +
      '<h3 class="b-sub">' + esc(t("tw_history")) + '</h3><ul class="tw-events op-events">' + (i.events || []).map(function (e) {
        return '<li><span class="muted">' + esc(c.fmtTime(e.at)) + "</span> " + esc(incEventText(e)) + (e.note ? ' <span class="tw-note">«' + esc(e.note) + "»</span>" : "") + "</li>";
      }).join("") + "</ul>" +
      '<div class="tw-add-row tw-comment-new"><textarea id="op-inc-comment" rows="2" maxlength="2000" placeholder="' + esc(t("tw_comment_ph")) + '" aria-label="' + esc(t("tw_comment_ph")) + '"></textarea>' +
        '<button type="button" class="btn btn-sm" data-op-comment>' + esc(t("tw_send")) + "</button></div>" +
      '<p class="fine-print">' + esc(t("op_internal_note")) + "</p>";
  }

  function incEventText(e) {
    var who = e.actor || t("tw_no_name");
    switch (e.kind) {
      case "created": return t("op_ev_created", { who: who });
      case "status": return t("op_ev_status", { who: who, a: t("op_ist_" + e.from), b: t("op_ist_" + e.to) });
      case "owner": return t("op_ev_owner", { who: who, n: e.to ? W().nameOf(e.to) : t("op_no_owner") });
      case "severity": return t("op_ev_severity", { who: who, s: t("op_sev_" + e.to) });
      case "comment": return t("op_ev_comment", { who: who });
      case "action": return t("op_ev_action", { who: who });
    }
    return e.kind;
  }

  async function incidentAfter() {
    var r = await call("incident_get", { p_id: S.incCur.id });
    if (r) { S.incCur = r.data; drawIncident(); }
    W().refreshCounts();
    W().rerender();
  }

  function incidentStatus(st) {
    var w = W(), i = S.incCur;
    if (st === "@resolve") {
      return w.openForm(t("op_act_resolve"),
        w.field(t("op_f_root"), '<textarea name="root" rows="3" maxlength="2000" required>' + esc(i.root_cause || "") + "</textarea>") +
        w.field(t("op_f_resolution"), '<textarea name="res" rows="3" maxlength="2000" required>' + esc(i.resolution || "") + "</textarea>") +
        '<p class="field-hint">' + esc(t("op_resolve_hint")) + "</p>",
        async function (get) {
          if (get("root").length < 2 || get("res").length < 2) { w.formError(t("op_e_resolution")); return false; }
          if (!(await call("incident_set_status", { p_id: i.id, p_status: "resolved", p_note: null, p_root_cause: get("root"), p_resolution: get("res") }))) return false;
          toast(t("tw_saved_status"), "ok"); incidentAfter();
        }, "op_act_resolve");
    }
    if (st === "@edit") {
      return w.openForm(t("op_act_owner"),
        w.field(t("op_f_owner"), w.select("owner", w.memberOpts([], t("op_no_owner")), i.owner_id || "")) +
        w.field(t("op_f_severity"), w.select("sev", SEV.map(function (s) { return [s, t("op_sev_" + s)]; }), i.severity)),
        async function (get) {
          if (!(await call("incident_update", { p_id: i.id, p_owner: get("owner") || null, p_severity: get("sev") }))) return false;
          toast(t("s_saved"), "ok"); incidentAfter();
        });
    }
    if (st === "@action") {
      return w.openForm(t("to_action_add"),
        w.field(t("to_f_action"), '<input name="title" type="text" maxlength="200" required>') +
        '<div class="grid-2">' + w.field(t("tw_f_assignee"), w.select("user", w.memberOpts([]), w.meId())) +
          w.field(t("tw_f_due"), '<input name="due" type="datetime-local">') + "</div>",
        async function (get) {
          if (!get("title")) { w.formError(t("tw_e_name")); return false; }
          if (!(await call("incident_action", { p_id: i.id, p_title: get("title"), p_assignee: get("user") || null, p_due: iso(get("due")) }))) return false;
          toast(t("tw_task_created"), "ok"); incidentAfter();
        }, "tw_task_create");
    }
    return call("incident_set_status", { p_id: i.id, p_status: st, p_note: null, p_root_cause: null, p_resolution: null }).then(function (r) { if (r) { toast(t("tw_saved_status"), "ok"); incidentAfter(); } });
  }

  // ---------- Календарь ----------
  function startOfWeek(d) {
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  var KIND_ICO = { event: "op_k_event", task: "op_k_task", milestone: "op_k_milestone", incident: "op_k_incident" };

  async function renderCalendar(el) {
    if (!S.calFrom) S.calFrom = startOfWeek(new Date());
    var from = S.calFrom, to = new Date(from.getTime() + 14 * 864e5);
    var my = ++S.seq;
    loading(el);
    var r = await db().rpc("ops_calendar", { p_ws: ws(), p_from: from.toISOString(), p_to: to.toISOString() });
    if (my !== S.seq) return;
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    var items = (r.data || []).filter(function (x) { return !S.calMine || x.mine; });
    var days = [];
    for (var i = 0; i < 14; i++) days.push(new Date(from.getTime() + i * 864e5));
    var today = new Date().toDateString();
    var head = '<div class="tw-tools op-cal-tools">' +
      '<button type="button" class="btn btn-sm" data-op-cal="-14" aria-label="' + esc(t("op_cal_prev")) + '">←</button>' +
      '<span class="op-cal-range">' + esc(c.fmtDate(from.toISOString()) + " – " + c.fmtDate(new Date(to.getTime() - 864e5).toISOString())) + "</span>" +
      '<button type="button" class="btn btn-sm" data-op-cal="14" aria-label="' + esc(t("op_cal_next")) + '">→</button>' +
      '<button type="button" class="btn btn-sm" data-op-cal="0">' + esc(t("op_cal_today")) + "</button>" +
      '<label class="check op-cal-mine"><input type="checkbox" data-op-cal-mine' + (S.calMine ? " checked" : "") + "><span>" + esc(t("op_cal_mine")) + "</span></label>" +
      '<button type="button" class="btn btn-sm btn-primary" data-op-event="">' + esc("+ " + t("op_event_new")) + "</button></div>";
    var body = days.map(function (d) {
      var key = d.toDateString();
      var list = items.filter(function (x) { return new Date(x.at).toDateString() === key; });
      return '<div class="op-day' + (key === today ? " today" : "") + (list.length ? "" : " empty") + '"><div class="op-day-h">' +
        esc(d.toLocaleDateString(c.locale(), { weekday: "short", day: "numeric", month: "short" })) + "</div>" +
        (list.length ? list.map(function (x) {
          var attr = x.kind === "task" ? 'data-task="' + esc(x.id) + '"' : x.kind === "milestone" ? 'data-tw-order="' + esc(x.order_id) + '"'
            : x.kind === "incident" ? 'data-op-inc="' + esc(x.id) + '"' : 'data-op-event="' + esc(x.id) + '" data-mine="' + (x.mine ? 1 : 0) + '"';
          var late = (x.kind === "task" && ["todo", "in_progress", "blocked"].indexOf(x.status) !== -1 || x.kind === "milestone" && ["pending", "in_progress", "delayed"].indexOf(x.status) !== -1) && new Date(x.at) < new Date();
          return '<button type="button" class="op-item op-k-' + x.kind + (x.mine ? " mine" : "") + (late ? " late" : "") + '" ' + attr + ">" +
            '<span class="op-time">' + esc(new Date(x.at).toLocaleTimeString(c.locale(), { hour: "2-digit", minute: "2-digit" })) + "</span>" +
            '<span class="tw-tag">' + esc(t(KIND_ICO[x.kind])) + "</span> " +
            esc((x.order_number ? x.order_number + " · " : x.number ? (x.kind === "incident" ? t("op_inc_no", { n: x.number }) : t("tw_task_no", { n: x.number })) + " · " : "") + x.title) + "</button>";
        }).join("") : '<span class="muted">—</span>') + "</div>";
    }).join("");
    el.innerHTML = head + '<div class="op-cal">' + body + "</div>";
    S.calItems = r.data || [];
  }

  function openEvent(id) {
    var w = W(), e = (S.calItems || []).filter(function (x) { return x.kind === "event" && x.id === id; })[0] || null;
    if (e && !e.mine && !w.can("ops.manage")) {
      toast(e.title + (e.note ? " — " + e.note : ""), "ok");
      return;
    }
    var start = e ? e.at : new Date(Date.now() + 864e5).toISOString().slice(0, 11) + "10:00";
    w.openForm(t(e ? "op_event_edit" : "op_event_new"),
      w.field(t("op_f_event_title"), '<input name="title" type="text" maxlength="200" required value="' + esc(e ? e.title : "") + '">') +
      '<div class="grid-2">' + w.field(t("op_f_starts"), '<input name="starts" type="datetime-local" required value="' + esc(e ? localInput(e.at) : start) + '">') +
        w.field(t("op_f_ends"), '<input name="ends" type="datetime-local" value="' + esc(e && e.end ? localInput(e.end) : "") + '">') + "</div>" +
      w.field(t("op_f_note"), '<input name="note" type="text" maxlength="1000" value="' + esc(e && e.note || "") + '">') +
      (e ? '<button type="button" class="btn btn-sm btn-ghost" data-op-event-del="' + esc(e.id) + '">' + esc(t("tw_delete")) + "</button>" : ""),
      async function (get) {
        if (!get("title") || !get("starts")) { w.formError(t("tw_e_name")); return false; }
        if (!(await call("event_save", { p_ws: ws(), p_id: e ? e.id : null, p_title: get("title"), p_starts: iso(get("starts")), p_ends: iso(get("ends")), p_note: get("note") || null }))) return false;
        toast(t("s_saved"), "ok"); W().rerender();
      });
  }

  // ---------- Регламенты ----------
  async function renderSops(el) {
    var my = ++S.seq;
    loading(el);
    var r = await db().rpc("sop_list", { p_ws: ws() });
    if (my !== S.seq) return;
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    var list = S.sops = r.data || [], man = W().can("ops.manage");
    el.innerHTML = (man ? '<div class="tw-tools"><button type="button" class="btn btn-sm btn-primary" data-op-sop-edit="">' + esc("+ " + t("op_sop_new")) + "</button></div>" : "") +
      '<p class="muted">' + esc(t("op_sop_hint")) + "</p>" +
      (list.length ? '<div class="tw-list">' + list.map(function (s) {
        var unread = s.status === "published" && s.my_ack !== s.version;
        return '<button type="button" class="tw-task" data-op-sop="' + esc(s.id) + '"><span class="tw-task-top">' +
            (s.status !== "published" ? '<span class="tw-st op-sop-' + s.status + '">' + esc(t("op_sop_st_" + s.status)) + "</span>" : "") +
            (unread ? '<span class="tw-st op-sev-high">' + esc(t("op_sop_unread")) + "</span>" : '<span class="tw-st tw-st-done">' + esc(t("op_sop_read")) + "</span>") +
            (s.category ? '<span class="tw-tag">' + esc(s.category) + "</span>" : "") + (s.duty ? '<span class="tw-tag">' + esc(t("to_duty_" + s.duty)) + "</span>" : "") + "</span>" +
          '<span class="tw-task-title">' + esc(s.title) + "</span>" +
          '<span class="tw-task-meta muted">' + esc(t("op_sop_ver", { n: s.version, d: c.fmtDate(s.updated_at) }) +
            (s.members ? " · " + t("op_sop_acked", { a: s.acked, b: s.members }) : "")) + "</span></button>";
      }).join("") + "</div>" : W().emptyBox("op_sop_empty"));
  }

  async function openSop(id) {
    $("#tw-doc-title").textContent = t("loading");
    $("#tw-doc-body").innerHTML = "";
    c.openModal("modal-tw-doc");
    var r = await call("sop_get", { p_id: id });
    if (!r) { c.closeModal("modal-tw-doc"); return; }
    S.sopCur = r.data; S.incCur = null;
    drawSop();
  }

  function drawSop() {
    var s = S.sopCur, read = s.my_ack === s.version;
    $("#tw-doc-title").textContent = s.title;
    $("#tw-doc-body").innerHTML =
      '<div class="tw-task-top">' + (s.status !== "published" ? '<span class="tw-st op-sop-' + s.status + '">' + esc(t("op_sop_st_" + s.status)) + "</span>" : "") +
        (s.category ? '<span class="tw-tag">' + esc(s.category) + "</span>" : "") + (s.duty ? '<span class="tw-tag">' + esc(t("to_duty_" + s.duty)) + "</span>" : "") +
        '<span class="muted">' + esc(t("op_sop_ver", { n: s.version, d: c.fmtDate(s.updated_at) }) + (s.updated_by_name ? " · " + s.updated_by_name : "")) + "</span></div>" +
      '<div class="op-sop-body">' + esc(s.body) + "</div>" +
      '<div class="tw-actions">' +
        (s.status === "published" ? (read ? '<span class="tw-st tw-st-done">' + esc(t("op_sop_read_v", { n: s.version })) + "</span>"
          : '<button type="button" class="btn btn-sm btn-primary" data-op-sop-ack>' + esc(t("op_sop_ack")) + "</button>") : "") +
        (s.can_edit ? '<button type="button" class="btn btn-sm" data-op-sop-edit="' + esc(s.id) + '">' + esc(t("tw_edit")) + "</button>" : "") + "</div>" +
      (s.can_edit && (s.acks || []).length ? '<h3 class="b-sub">' + esc(t("op_sop_who")) + '</h3><ul class="op-acks">' + s.acks.map(function (a) {
        var st = a.version === s.version ? "ok" : a.version ? "old" : "no";
        return '<li class="op-ack-' + st + '"><span>' + esc(a.name || t("tw_no_name")) + "</span><span>" +
          esc(st === "ok" ? t("op_sop_ack_ok", { d: c.fmtDate(a.at) }) : st === "old" ? t("op_sop_ack_old", { n: a.version }) : t("op_sop_ack_no")) + "</span></li>";
      }).join("") + "</ul>" : "") +
      (s.can_edit && (s.versions || []).length ? '<details class="tw-history"><summary>' + esc(t("op_sop_versions", { n: s.versions.length })) + "</summary>" +
        s.versions.map(function (v) {
          return '<div class="op-ver"><div class="muted">' + esc(t("op_sop_ver", { n: v.version, d: c.fmtDate(v.edited_at) }) + (v.by ? " · " + v.by : "")) + "</div>" +
            '<div class="op-sop-body op-old">' + esc(v.body) + "</div></div>";
        }).join("") + "</details>" : "");
  }

  function openSopForm(id) {
    var w = W(), s = id && S.sopCur && S.sopCur.id === id ? S.sopCur : null;
    var duties = [["", t("to_duty_none")]].concat(["lead", "sourcing", "qc", "logistics", "support"].map(function (d) { return [d, t("to_duty_" + d)]; }));
    w.openForm(t(s ? "op_sop_edit" : "op_sop_new"),
      w.field(t("op_f_sop_title"), '<input name="title" type="text" maxlength="200" required value="' + esc(s ? s.title : "") + '">') +
      '<div class="grid-2">' + w.field(t("op_f_sop_cat"), '<input name="cat" type="text" maxlength="60" value="' + esc(s && s.category || "") + '">') +
        w.field(t("to_f_duty"), w.select("duty", duties, s && s.duty || "")) + "</div>" +
      w.field(t("op_f_sop_body"), '<textarea name="body" rows="12" maxlength="20000" required>' + esc(s ? s.body : "") + "</textarea>", t("op_sop_body_hint")) +
      w.field(t("op_f_sop_status"), w.select("st", ["draft", "published", "archived"].map(function (x) { return [x, t("op_sop_st_" + x)]; }), s ? s.status : "draft")),
      async function (get, fd) {
        var body = String(fd.get("body") || "");
        if (!get("title") || !body.trim()) { w.formError(t("op_e_sop")); return false; }
        var r = await call("sop_save", { p_ws: ws(), p_id: s ? s.id : null, p_title: get("title"), p_category: get("cat") || null, p_duty: get("duty") || null, p_body: body, p_status: get("st") });
        if (!r) return false;
        toast(t("s_saved"), "ok");
        W().refreshCounts();
        W().rerender();
        if (s) openSop(s.id);
      });
  }

  // ---------- События ----------
  function bind() {
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-op-inc]");
      if (b) { e.preventDefault(); openIncident(b.getAttribute("data-op-inc")); }
    });
    $("#tab-team").addEventListener("click", async function (e) {
      var b;
      if (e.target.closest("[data-op-scope]")) { S.incScope = S.incScope === "open" ? "all" : "open"; return W().rerender(); }
      if (e.target.closest("[data-op-inc-new]")) return openIncidentForm(null);
      if ((b = e.target.closest("[data-op-cal]"))) {
        var n = Number(b.getAttribute("data-op-cal"));
        S.calFrom = n ? new Date(S.calFrom.getTime() + n * 864e5) : startOfWeek(new Date());
        return W().rerender();
      }
      if ((b = e.target.closest("[data-op-event]"))) return openEvent(b.getAttribute("data-op-event"));
      if ((b = e.target.closest("[data-op-sop-edit]"))) { S.sopCur = null; return openSopForm(null); }
      if ((b = e.target.closest("[data-op-sop]"))) return openSop(b.getAttribute("data-op-sop"));
    });
    $("#tab-team").addEventListener("change", function (e) {
      if (e.target.matches("[data-op-cal-mine]")) { S.calMine = e.target.checked; W().rerender(); }
    });
    $("#modal-tw-doc").addEventListener("click", async function (e) {
      var b;
      if ((b = e.target.closest("[data-op-ist]"))) return incidentStatus(b.getAttribute("data-op-ist"));
      if (e.target.closest("[data-op-comment]")) {
        var txt = $("#op-inc-comment").value.trim();
        if (!txt) return;
        if (await call("incident_comment", { p_id: S.incCur.id, p_note: txt })) incidentAfter();
        return;
      }
      if (e.target.closest("[data-op-sop-ack]")) {
        if (await call("sop_ack", { p_id: S.sopCur.id })) { toast(t("op_sop_acked_ok"), "ok"); W().refreshCounts(); W().rerender(); openSop(S.sopCur.id); }
        return;
      }
      if ((b = e.target.closest("[data-op-sop-edit]"))) return openSopForm(b.getAttribute("data-op-sop-edit"));
      if ((b = e.target.closest("[data-task]"))) return U.teamtasks.openTask(b.getAttribute("data-task"));
    });
    $("#modal-tw-form").addEventListener("click", async function (e) {
      var b = e.target.closest("[data-op-event-del]");
      if (!b || !window.confirm(t("op_event_del_confirm"))) return;
      if (await call("event_delete", { p_id: b.getAttribute("data-op-event-del") })) { c.closeModal("modal-tw-form"); W().rerender(); }
    });
  }

  U.teamops = { bind: bind, render: render, openIncident: openIncident, openSop: openSop, newIncident: openIncidentForm };
})(window.ULA);
