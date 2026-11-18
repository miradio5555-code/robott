// =====================================================
// ULA FACTORY — команда на заказах (файл 69): «Мои заказы» и «Требуют внимания» в разделе «Команда», карточка
// заказа для команды (поля по обязанности, команда заказа, этапы, задержки и корректирующие действия, история),
// шаблоны этапов, кнопка «Команда и этапы» в обычной карточке заказа.
//
// Что показать и что разрешить, решает база (order_ops_get → access, my_duties, can); она же проверяет каждое действие.
// Без файла 69 в базе ничего из этого не показывается.
// Подключается после js/teamwork.js и js/teamtasks.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast;
  var DUTIES = ["lead", "sourcing", "qc", "logistics", "support"];
  var CATS = ["supplier", "quality", "logistics", "customs", "client", "other"];
  var S = { on: null, cur: null, seq: 0 };

  function W() { return U.teamwork; }
  function db() { return c.db(); }
  function dutyName(d) { return d ? t("to_duty_" + d) : t("to_duty_none"); }
  function overdue(iso, st) { return !!iso && ["pending", "in_progress", "delayed"].indexOf(st) !== -1 && new Date(iso) < new Date(); }
  function statePill(s) { return '<span class="tw-st to-state-' + esc(s || "on_track") + '">' + esc(t("to_state_" + (s || "on_track"))) + "</span>"; }
  function msPill(s) { return '<span class="tw-st to-ms-' + esc(s) + '">' + esc(t("to_ms_" + s)) + "</span>"; }
  function title(o) { return o.order_number + (o.product_ru ? " · " + o.product_ru : ""); }
  function isMissing(e) { return !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(String(e.message || ""))); }

  // ---------- Списки ----------
  function card(o) {
    var nx = o.next;
    var meta = [
      o.lead ? esc(t("to_lead_n", { n: o.lead })) : esc(t("to_no_lead")),
      (o.my_duties || []).length ? esc((o.my_duties || []).map(dutyName).join(", ")) : "",
      nx ? '<span class="' + (overdue(nx.due_at, nx.status) ? "tw-overdue" : "") + '">' + esc(t("to_next", { x: nx.title, d: nx.due_at ? c.fmtTime(nx.due_at) : "—" })) + "</span>" : ""
    ].filter(Boolean).join(" · ");
    return '<button type="button" class="tw-task to-order" data-tw-order="' + esc(o.id) + '">' +
      '<span class="tw-task-top"><span class="tw-num">' + esc(o.order_number) + "</span>" + statePill(o.state) +
        '<span class="tw-tag">' + esc(t("status_" + o.status)) + "</span>" +
        (o.open_delays ? '<span class="tw-prio tw-prio-urgent">' + esc(t("to_delays_n", { n: o.open_delays })) + "</span>" : "") + "</span>" +
      '<span class="tw-task-title">' + esc(o.product_ru || "—") + (o.quantity ? " × " + esc(o.quantity) : "") + "</span>" +
      '<span class="tw-task-meta muted">' + meta + "</span></button>";
  }

  async function renderList(scope, el) {
    var my = ++S.seq;
    el.innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>";
    var r = await db().rpc("order_ops_list", { p_ws: W().ws().id, p_scope: scope });
    if (my !== S.seq) return;
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    var list = r.data || [];
    el.innerHTML = (scope === "mine" ? '<p class="muted">' + esc(t("to_mine_hint")) + "</p>" : '<p class="muted">' + esc(t("to_attention_hint")) + "</p>") +
      (list.length ? '<div class="tw-list">' + list.map(card).join("") + "</div>" : W().emptyBox(scope === "mine" ? "to_empty_mine" : "to_empty_attention"));
  }

  // ---------- Карточка заказа для команды ----------
  async function openOrder(id) {
    $("#tw-order-title").textContent = t("loading");
    $("#tw-order-body").innerHTML = "";
    c.openModal("modal-tw-order");
    await load(id);
  }

  async function load(id) {
    var r = await db().rpc("order_ops_get", { p_order: id });
    if (r.error) { c.closeModal("modal-tw-order"); W().fail(r.error); return; }
    S.cur = r.data;
    draw();
  }

  async function after() {
    await load(S.cur.order.id);
    W().refreshCounts();
    W().rerender();
  }

  function row(label, value) { return value == null || value === "" ? "" : '<div class="tw-meta-row"><dt>' + esc(label) + "</dt><dd>" + value + "</dd></div>"; }

  function draw() {
    var d = S.cur, o = d.order, can = d.can || {};
    var editable = (can.fields || []).length && ["delivered", "cancelled"].indexOf(o.status) === -1;
    $("#tw-order-title").textContent = title(o);

    var general =
      '<div class="tw-task-top">' + statePill(d.state) + '<span class="tw-tag">' + esc(t("status_" + o.status)) + "</span>" +
        (d.access === "team" ? '<span class="tw-tag">' + esc(t("to_my_duties", { x: (d.my_duties || []).map(dutyName).join(", ") })) + "</span>" : "") + "</div>" +
      '<dl class="tw-meta">' +
        row(t("to_f_product"), esc((o.product_ru || "—") + (o.product_zh ? " / " + o.product_zh : ""))) +
        row(t("to_f_qty"), esc(o.quantity)) +
        row(t("to_f_date"), esc(c.fmtDate(o.order_date))) +
        row(t("to_f_eta"), o.delivery_eta_to ? esc(c.fmtDate(o.delivery_eta_from) + " – " + c.fmtDate(o.delivery_eta_to)) : "") +
        row(t("to_f_ship_to"), o.ship_to ? esc(o.ship_to) : "") +
        ("client_name" in o ? row(t("to_f_client"), esc([o.client_name, o.client_phone ? c.fmtPhone(o.client_phone) : ""].filter(Boolean).join(" · "))) : "") +
        ("supplier" in o ? row(t("to_f_supplier"), esc([o.supplier, o.supplier_wechat ? "WeChat: " + o.supplier_wechat : ""].filter(Boolean).join(" · ") || "—") +
            (o.supplier_link ? ' <a href="' + esc(o.supplier_link) + '" target="_blank" rel="noopener noreferrer">' + esc(t("to_link")) + "</a>" : "")) : "") +
        ("unit_price_cny" in o ? row(t("to_f_price"), esc(c.money(o.unit_price_cny) + " " + (o.purchase_currency || "CNY"))) : "") +
        ("tracking_number" in o ? row(t("to_f_track"), esc(o.tracking_number || "—")) : "") +
        ("client_city" in o ? row(t("to_f_dest"), esc([o.client_city, o.client_address || o.pickup_point].filter(Boolean).join(", ") || "—")) : "") +
      "</dl>" +
      (editable ? '<button type="button" class="btn btn-sm" data-to-fields>' + esc(t("to_edit_fields")) + "</button>" : "") +
      (d.access === "team" ? '<p class="fine-print">' + esc(t("to_scoped_note")) + "</p>" : "");

    // команда
    var team = DUTIES.map(function (du) {
      var ppl = (d.team || []).filter(function (m) { return m.duty === du; });
      if (!ppl.length && !can.assign) return "";
      return '<div class="to-duty"><span class="muted">' + esc(dutyName(du)) + "</span><span>" +
        (ppl.length ? ppl.map(function (m) {
          return '<span class="tw-tag' + (m.active ? "" : " to-off") + '">' + esc(m.name || t("tw_no_name")) +
            (can.assign ? ' <button type="button" class="to-x" data-to-unassign="' + esc(m.user_id) + '" data-duty="' + du + '" aria-label="' + esc(t("tw_delete")) + '">×</button>' : "") + "</span>";
        }).join(" ") : '<span class="muted">—</span>') + "</span></div>";
    }).join("");
    var teamHtml = '<h3 class="b-sub">' + esc(t("to_team")) + "</h3>" + (team || '<p class="muted">' + esc(t("to_team_empty")) + "</p>") +
      (can.assign ? '<button type="button" class="btn btn-sm" data-to-assign>' + esc("+ " + t("to_assign")) + "</button>" : "");

    // этапы
    var ms = d.milestones || [];
    var msHtml = '<h3 class="b-sub">' + esc(t("to_milestones")) + "</h3>" +
      (ms.length ? '<ol class="to-ms">' + ms.map(function (m) {
        var od = overdue(m.due_at, m.status);
        var acts = [];
        if (m.can && (m.status === "pending")) acts.push(["in_progress", "to_ms_start"]);
        if (m.can && (m.status === "pending" || m.status === "in_progress" || m.status === "delayed")) acts.push(["done", "to_ms_finish"]);
        if (m.status === "done" && m.can) acts.push(["in_progress", "to_ms_undo"]);
        if (can.lead && (m.status === "pending" || m.status === "in_progress")) acts.push(["skipped", "to_ms_skip"]);
        return '<li class="to-ms-row' + (od ? " is-overdue" : "") + '"><div class="tw-row-txt"><span>' + msPill(m.status) + " <b>" + esc(m.title) + "</b></span>" +
          '<span class="muted">' + esc(dutyName(m.duty)) + (m.due_at ? " · " : "") + (m.due_at ? '<span class="' + (od ? "tw-overdue" : "") + '">' + esc(c.fmtTime(m.due_at)) + "</span>" : "") + "</span>" +
          (m.note ? '<span class="muted tw-note">' + esc(m.note) + "</span>" : "") + "</div>" +
          '<div class="tw-row-act">' + acts.map(function (a) { return '<button type="button" class="btn btn-sm" data-to-ms="' + esc(m.id) + '" data-st="' + a[0] + '">' + esc(t(a[1])) + "</button>"; }).join("") +
            (m.can && m.status !== "done" && m.status !== "skipped" ? '<button type="button" class="btn btn-sm btn-ghost" data-to-delay="' + esc(m.id) + '">' + esc(t("to_report_delay")) + "</button>" : "") +
            (can.lead ? '<button type="button" class="btn btn-sm btn-ghost" data-to-ms-edit="' + esc(m.id) + '">' + esc(t("tw_edit")) + "</button>" : "") +
          "</div></li>";
      }).join("") + "</ol>" : '<p class="muted">' + esc(t("to_ms_empty")) + "</p>") +
      (can.lead ? '<div class="tw-actions">' +
        ((d.templates || []).length ? '<button type="button" class="btn btn-sm" data-to-template>' + esc(t(ms.length ? "to_tpl_replace" : "to_tpl_apply")) + "</button>" : "") +
        '<button type="button" class="btn btn-sm" data-to-ms-edit="">' + esc("+ " + t("to_ms_add")) + "</button></div>" : "");

    // задержки
    var delays = (d.delays || []).map(function (x) {
      var open = x.status === "open";
      var mt = ms.filter(function (m) { return m.id === x.milestone_id; })[0];
      var actions = (x.actions || []).map(function (a) {
        return '<button type="button" class="to-action" data-task="' + esc(a.id) + '">' + '<span class="tw-st tw-st-' + esc(a.status) + '">' + esc(t("tw_st_" + a.status)) + "</span> " +
          esc(t("tw_task_no", { n: a.number }) + " " + a.title) + ' <span class="muted">· ' + esc(a.assignee_id ? W().nameOf(a.assignee_id) : t("tw_unassigned")) + "</span></button>";
      }).join("");
      return '<div class="to-delay' + (open ? " open" : "") + '"><div class="tw-task-top"><span class="tw-st ' + (open ? "to-state-delayed" : "tw-st-done") + '">' + esc(t(open ? "to_delay_open" : "to_delay_closed")) + "</span>" +
          '<span class="tw-tag">' + esc(t("to_cat_" + x.category)) + "</span>" + (mt ? '<span class="muted">' + esc(mt.title) + "</span>" : "") + "</div>" +
        '<p class="to-reason">' + esc(x.reason) + "</p>" +
        '<p class="muted">' + esc([x.reported_by || "—", c.fmtTime(x.created_at)].join(" · ")) +
          (x.new_due ? " · " + esc(t("to_new_due", { a: x.old_due ? c.fmtTime(x.old_due) : "—", b: c.fmtTime(x.new_due) })) : "") + "</p>" +
        (actions ? '<div class="to-actions-list"><span class="muted">' + esc(t("to_actions")) + "</span>" + actions + "</div>" : "") +
        (x.resolution ? '<p class="to-resolution">' + esc(t("to_resolution", { x: x.resolution })) + "</p>" : "") +
        (open ? '<div class="tw-actions">' +
          (can.lead ? '<button type="button" class="btn btn-sm" data-to-action="' + esc(x.id) + '">' + esc("+ " + t("to_action_add")) + "</button>" : "") +
          (can.lead || x.reporter_id === W().meId() ? '<button type="button" class="btn btn-sm btn-primary" data-to-resolve="' + esc(x.id) + '">' + esc(t("to_resolve")) + "</button>" : "") +
        "</div>" : "") + "</div>";
    }).join("");
    var delayHtml = '<h3 class="b-sub">' + esc(t("to_delays")) + "</h3>" + (delays || '<p class="muted">' + esc(t("to_delays_none")) + "</p>") +
      (["delivered", "cancelled"].indexOf(o.status) === -1 ? '<div class="tw-actions"><button type="button" class="btn btn-sm btn-danger" data-to-delay="">' + esc(t("to_report_delay")) + "</button>" +
        (U.teamops && W().counts().ops ? '<button type="button" class="btn btn-sm" data-to-incident>' + esc(t("op_inc_new")) + "</button>" : "") + "</div>" : "");

    var events = (d.events || []).slice().reverse().map(function (e) {
      return '<li><span class="muted">' + esc(c.fmtTime(e.at)) + "</span> " + esc(eventText(e)) + "</li>";
    }).join("");

    $("#tw-order-body").innerHTML = general + teamHtml + msHtml + delayHtml +
      '<p class="fine-print">' + esc(t("to_internal_note")) + "</p>" +
      (events ? '<details class="tw-history"><summary>' + esc(t("tw_history")) + '</summary><ul class="tw-events">' + events + "</ul></details>" : "");
  }

  function eventText(e) {
    var x = e.detail || {}, who = e.actor || t("tw_no_name");
    switch (e.kind) {
      case "team.add": return t("to_ev_team_add", { who: who, n: W().nameOf(x.user_id), d: dutyName(x.duty) });
      case "team.remove": return t("to_ev_team_remove", { who: who, n: W().nameOf(x.user_id), d: dutyName(x.duty) });
      case "team.handover": return t("to_ev_handover", { a: W().nameOf(x.from), b: x.to ? W().nameOf(x.to) : t("tw_nobody"), d: dutyName(x.duty) });
      case "template.apply": return t("to_ev_template", { who: who, x: x.name || "" });
      case "milestone.add": return t("to_ev_ms_add", { who: who, x: x.title || "" });
      case "milestone.edit": return t("to_ev_ms_edit", { who: who, x: x.title || "" });
      case "milestone.delete": return t("to_ev_ms_delete", { who: who, x: x.title || "" });
      case "milestone.status": return t("to_ev_ms_status", { who: who, x: x.title || "", s: t("to_ms_" + x.to) });
      case "fields": return t("to_ev_fields", { who: who, x: Object.keys(x).map(function (k) { return t("to_fld_" + k); }).join(", ") });
      case "delay.report": return t("to_ev_delay", { who: who, x: t("to_cat_" + x.category) });
      case "delay.action": return t("to_ev_action", { who: who, x: x.title || "" });
      case "delay.resolve": return t("to_ev_resolve", { who: who });
    }
    return e.kind;
  }

  // ---------- Формы ----------
  function localInput(iso) {
    if (!iso) return "";
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function iso(v) { return v ? new Date(v).toISOString() : null; }
  function dutyOpts(none) { return (none ? [["", t("to_duty_none")]] : []).concat(DUTIES.map(function (d) { return [d, dutyName(d)]; })); }

  async function rpcOk(name, args, okKey) {
    var r = await db().rpc(name, args);
    if (r.error) { W().fail(r.error); return false; }
    if (okKey) toast(t(okKey), "ok");
    after();
    return true;
  }

  function openFields() {
    var o = S.cur.order, f = S.cur.can.fields || [], w = W();
    w.openForm(t("to_edit_fields"),
      (f.indexOf("supplier") !== -1 ? w.field(t("to_fld_supplier"), '<input name="supplier" type="text" maxlength="200" value="' + esc(o.supplier || "") + '">') : "") +
      (f.indexOf("supplier_link") !== -1 ? w.field(t("to_fld_supplier_link"), '<input name="supplier_link" type="url" maxlength="1000" value="' + esc(o.supplier_link || "") + '">') : "") +
      (f.indexOf("supplier_wechat") !== -1 ? w.field(t("to_fld_supplier_wechat"), '<input name="supplier_wechat" type="text" maxlength="200" value="' + esc(o.supplier_wechat || "") + '">') : "") +
      (f.indexOf("tracking_number") !== -1 ? w.field(t("to_fld_tracking_number"), '<input name="tracking_number" type="text" maxlength="200" value="' + esc(o.tracking_number || "") + '">') : "") +
      '<p class="field-hint">' + esc(t("to_fields_hint")) + "</p>",
      async function (get) {
        var p = {};
        f.forEach(function (k) { p[k] = get(k); });
        return rpcOk("order_ops_fields", { p_order: o.id, p_fields: p }, "s_saved");
      });
  }

  function openAssign() {
    var w = W();
    w.openForm(t("to_assign"),
      w.field(t("to_f_person"), w.select("user", w.memberOpts([]), "")) +
      w.field(t("to_f_duty"), w.select("duty", dutyOpts(false), "lead")) +
      '<p class="field-hint">' + esc(t("to_assign_hint")) + "</p>",
      async function (get) {
        return rpcOk("order_team_set", { p_order: S.cur.order.id, p_user: get("user"), p_duty: get("duty"), p_on: true }, "s_saved");
      });
  }

  function openMilestone(id) {
    var m = (S.cur.milestones || []).filter(function (x) { return x.id === id; })[0] || null, w = W();
    w.openForm(t(m ? "to_ms_edit" : "to_ms_add"),
      w.field(t("to_f_ms_title"), '<input name="title" type="text" maxlength="120" required value="' + esc(m ? m.title : "") + '">') +
      '<div class="grid-2">' + w.field(t("to_f_duty"), w.select("duty", dutyOpts(true), m ? m.duty : "")) +
        w.field(t("tw_f_due"), '<input name="due" type="datetime-local" value="' + esc(localInput(m && m.due_at)) + '">') + "</div>" +
      (m ? '<button type="button" class="btn btn-sm btn-ghost" data-to-ms-del="' + esc(m.id) + '">' + esc(t("to_ms_delete")) + "</button>" : ""),
      async function (get) {
        if (!get("title")) { w.formError(t("tw_e_name")); return false; }
        return rpcOk("order_milestone_save", { p_order: S.cur.order.id, p_id: m ? m.id : null, p_title: get("title"), p_duty: get("duty") || null, p_due: iso(get("due")) }, "s_saved");
      });
  }

  function openTemplate() {
    var w = W(), has = (S.cur.milestones || []).length;
    w.openForm(t(has ? "to_tpl_replace" : "to_tpl_apply"),
      w.field(t("to_f_template"), w.select("tpl", (S.cur.templates || []).map(function (x) { return [x.id, x.name]; }), "")) +
      '<p class="field-hint">' + esc(t(has ? "to_tpl_replace_hint" : "to_tpl_hint")) + "</p>",
      async function (get) {
        return rpcOk("order_apply_template", { p_order: S.cur.order.id, p_template: get("tpl"), p_replace: !!has }, "s_saved");
      });
  }

  function openDelay(msId) {
    var w = W(), ms = (S.cur.milestones || []).filter(function (m) { return m.status !== "done" && m.status !== "skipped"; });
    var m = ms.filter(function (x) { return x.id === msId; })[0];
    w.openForm(t("to_report_delay"),
      '<p class="muted">' + esc(t("to_delay_hint")) + "</p>" +
      w.field(t("to_f_milestone"), w.select("ms", [["", t("to_whole_order")]].concat(ms.map(function (x) { return [x.id, x.title]; })), msId || "")) +
      w.field(t("to_f_category"), w.select("cat", CATS.map(function (k) { return [k, t("to_cat_" + k)]; }), "supplier")) +
      w.field(t("to_f_reason"), '<textarea name="reason" rows="3" maxlength="1000" required></textarea>') +
      w.field(t("to_f_new_due"), '<input name="due" type="datetime-local" value="' + esc(localInput(m && m.due_at)) + '">') +
      '<label class="check"><input type="checkbox" name="shift" value="1" checked><span>' + esc(t("to_f_shift")) + "</span></label>",
      async function (get) {
        if (get("reason").length < 2) { w.formError(t("tw_e_note")); return false; }
        return rpcOk("order_report_delay", { p_order: S.cur.order.id, p_milestone: get("ms") || null, p_category: get("cat"), p_reason: get("reason"),
          p_new_due: iso(get("due")), p_shift: !!get("shift") }, "to_delay_saved");
      }, "to_report_delay");
  }

  function openAction(delayId) {
    var w = W();
    w.openForm(t("to_action_add"),
      w.field(t("to_f_action"), '<input name="title" type="text" maxlength="200" required>') +
      '<div class="grid-2">' + w.field(t("tw_f_assignee"), w.select("user", w.memberOpts([]), w.meId())) +
        w.field(t("tw_f_due"), '<input name="due" type="datetime-local">') + "</div>" +
      '<p class="field-hint">' + esc(t("to_action_hint")) + "</p>",
      async function (get) {
        if (!get("title")) { w.formError(t("tw_e_name")); return false; }
        return rpcOk("order_delay_action", { p_delay: delayId, p_title: get("title"), p_assignee: get("user") || null, p_due: iso(get("due")) }, "tw_task_created");
      }, "tw_task_create");
  }

  function openResolve(delayId) {
    var w = W();
    w.openForm(t("to_resolve"),
      w.field(t("to_f_resolution"), '<textarea name="note" rows="3" maxlength="1000" required></textarea>'),
      async function (get) {
        if (get("note").length < 2) { w.formError(t("tw_e_note")); return false; }
        return rpcOk("order_delay_resolve", { p_delay: delayId, p_note: get("note") }, "to_resolved");
      }, "to_resolve");
  }

  // ---------- Шаблоны (раздел «Команда» → «Шаблоны») ----------
  var TPL = [];
  async function renderTemplates(el) {
    el.innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>";
    var r = await db().rpc("workflow_templates_list", { p_ws: W().ws().id });
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    TPL = r.data || [];
    var manage = W().can("orders.assign");
    el.innerHTML = (manage ? '<div class="tw-tools"><button type="button" class="btn btn-sm" data-to-tpl="">' + esc("+ " + t("to_tpl_new")) + "</button></div>" : "") +
      '<p class="muted">' + esc(t("to_tpl_page_hint")) + "</p>" +
      '<div class="tw-list">' + TPL.map(function (x) {
        return '<div class="tw-row"><div class="tw-row-txt"><b>' + esc(x.name) + "</b>" + (x.is_system ? '<span class="muted">' + esc(t("tw_role_system")) + "</span>" : "") +
          '<ol class="to-steps">' + (x.steps || []).map(function (s) { return "<li>" + esc(s.title) + ' <span class="muted">· ' + esc(dutyName(s.duty)) + " · " + esc(t("to_day_n", { n: s.days })) + "</span></li>"; }).join("") + "</ol></div>" +
          (manage ? '<div class="tw-row-act"><button type="button" class="btn btn-sm" data-to-tpl="' + esc(x.id) + '">' + esc(t("tw_edit")) + "</button>" +
            (x.is_system ? "" : '<button type="button" class="btn btn-sm btn-ghost" data-to-tpl-del="' + esc(x.id) + '">' + esc(t("tw_delete")) + "</button>") + "</div>" : "") + "</div>";
      }).join("") + "</div>";
  }

  function stepRow(s) {
    s = s || { title: "", duty: "", days: 1 };
    return '<div class="to-step-row"><input name="st_title" type="text" maxlength="120" placeholder="' + esc(t("to_f_ms_title")) + '" aria-label="' + esc(t("to_f_ms_title")) + '" value="' + esc(s.title) + '">' +
      W().select("st_duty", dutyOpts(true), s.duty || "") +
      '<input name="st_days" type="number" min="0" max="365" step="1" aria-label="' + esc(t("to_f_days")) + '" value="' + esc(s.days) + '">' +
      '<button type="button" class="icon-btn" data-wf-del aria-label="' + esc(t("tw_delete")) + '">×</button></div>';
  }

  function openTplForm(id) {
    var x = TPL.filter(function (y) { return y.id === id; })[0] || null, w = W();
    w.openForm(t(x ? "to_tpl_edit" : "to_tpl_new"),
      w.field(t("tw_f_dept_name"), '<input name="name" type="text" maxlength="80" required value="' + esc(x ? x.name : "") + '">') +
      '<p class="field-hint">' + esc(t("to_tpl_steps_hint")) + '</p><div id="to-steps">' + (x ? x.steps : [null]).map(stepRow).join("") + "</div>" +
      '<button type="button" class="btn btn-sm" data-wf-add>' + esc("+ " + t("to_step_add")) + "</button>",
      async function (get, fd) {
        var titles = fd.getAll("st_title"), duties = fd.getAll("st_duty"), days = fd.getAll("st_days");
        var steps = titles.map(function (ti, i) { return { title: String(ti).trim(), duty: duties[i] || null, days: Math.max(0, Math.min(365, parseInt(days[i], 10) || 0)) }; })
          .filter(function (s) { return s.title; });
        if (!get("name") || !steps.length) { w.formError(t("to_e_steps")); return false; }
        var r = await db().rpc("workflow_template_save", { p_ws: w.ws().id, p_id: x ? x.id : null, p_name: get("name"), p_steps: steps });
        if (r.error) { w.fail(r.error); return false; }
        toast(t("s_saved"), "ok");
        w.rerender();
      });
  }

  async function deleteTpl(id) {
    var x = TPL.filter(function (y) { return y.id === id; })[0];
    if (!x || !window.confirm(t("to_tpl_del_confirm", { n: x.name }))) return;
    var r = await db().rpc("workflow_template_delete", { p_ws: W().ws().id, p_id: id });
    if (r.error) { W().fail(r.error); return; }
    W().rerender();
  }

  // ---------- Кнопка в обычной карточке заказа (доступ ко всем заказам, база с файлом 69) ----------
  function detailHtml(o) {
    if (!W() || !W().isOn() || !W().counts().full || c.state.readOnly) return "";
    return '<section class="to-detail"><div><b>' + esc(t("to_detail_title")) + '</b><p class="muted">' + esc(t("to_detail_hint")) + "</p></div>" +
      '<button type="button" class="btn btn-sm" data-tw-order="' + esc(o.id) + '">' + esc(t("to_detail_open")) + "</button></section>";
  }

  // ---------- События ----------
  function bind() {
    // открыть карточку заказа для команды — из списков, уведомлений и обычной карточки заказа
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-tw-order]");
      if (b) { e.preventDefault(); openOrder(b.getAttribute("data-tw-order")); }
    });
    $("#modal-tw-order").addEventListener("click", async function (e) {
      var b;
      if (e.target.closest("[data-to-fields]")) return openFields();
      if (e.target.closest("[data-to-assign]")) return openAssign();
      if (e.target.closest("[data-to-template]")) return openTemplate();
      if ((b = e.target.closest("[data-to-unassign]"))) {
        if (!window.confirm(t("to_unassign_confirm"))) return;
        return rpcOk("order_team_set", { p_order: S.cur.order.id, p_user: b.getAttribute("data-to-unassign"), p_duty: b.getAttribute("data-duty"), p_on: false });
      }
      if ((b = e.target.closest("[data-to-ms]"))) { b.disabled = true; return rpcOk("order_milestone_set", { p_id: b.getAttribute("data-to-ms"), p_status: b.getAttribute("data-st"), p_note: null }); }
      if ((b = e.target.closest("[data-to-ms-edit]"))) return openMilestone(b.getAttribute("data-to-ms-edit"));
      if ((b = e.target.closest("[data-to-delay]"))) return openDelay(b.getAttribute("data-to-delay"));
      if (e.target.closest("[data-to-incident]")) return U.teamops.newIncident(S.cur.order.id);
      if ((b = e.target.closest("[data-to-action]"))) return openAction(b.getAttribute("data-to-action"));
      if ((b = e.target.closest("[data-to-resolve]"))) return openResolve(b.getAttribute("data-to-resolve"));
      if ((b = e.target.closest("[data-task]"))) return U.teamtasks.openTask(b.getAttribute("data-task"));
    });
    $("#modal-tw-form").addEventListener("click", async function (e) {
      var b;
      if (e.target.closest("[data-wf-add]")) { $("#to-steps").insertAdjacentHTML("beforeend", stepRow(null)); return; }
      if ((b = e.target.closest("[data-wf-del]"))) { if ($("#to-steps").children.length > 1) b.closest(".to-step-row").remove(); return; }
      if ((b = e.target.closest("[data-to-ms-del]"))) {
        if (!window.confirm(t("to_ms_del_confirm"))) return;
        var r = await db().rpc("order_milestone_delete", { p_id: b.getAttribute("data-to-ms-del") });
        if (r.error) { W().fail(r.error); return; }
        c.closeModal("modal-tw-form");
        after();
      }
    });
    $("#tab-team").addEventListener("click", function (e) {
      var b;
      if ((b = e.target.closest("[data-to-tpl]"))) return openTplForm(b.getAttribute("data-to-tpl"));
      if ((b = e.target.closest("[data-to-tpl-del]"))) return deleteTpl(b.getAttribute("data-to-tpl-del"));
    });
  }

  U.teamorders = { bind: bind, renderList: renderList, renderTemplates: renderTemplates, openOrder: openOrder, detailHtml: detailHtml, isMissing: isMissing };
})(window.ULA);
