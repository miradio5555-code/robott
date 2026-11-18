// =====================================================
// ULA FACTORY — задачи команды (файл 68): списки «Мне», «На проверке», «Поставил я», «Все»; карточка задачи
// (чек-лист, действия по статусу, причина, комментарии, история); форма новой задачи и правки.
//
// Какие кнопки показать, подсказывает сама база (task_get → can: edit / work / review / assign_others);
// она же проверяет каждое действие ещё раз. Общие помощники и данные команды — ULA.teamwork (js/teamwork.js).
// Подключается после js/teamwork.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast;
  var OPEN = ["todo", "in_progress", "blocked", "submitted"];
  var S = { list: [], scope: "mine", cur: null, pending: null, seq: 0 };

  function W() { return U.teamwork; }
  function db() { return c.db(); }
  function closed(x) { return x.status === "done" || x.status === "cancelled"; }
  function overdue(x) { return !!x.due_at && !closed(x) && x.status !== "submitted" && new Date(x.due_at) < new Date(); }
  function num(x) { return t("tw_task_no", { n: x.number }); }

  function pill(st) { return '<span class="tw-st tw-st-' + st + '">' + esc(t("tw_st_" + st)) + "</span>"; }
  function prio(p) { return p === "normal" ? "" : '<span class="tw-prio tw-prio-' + p + '">' + esc(t("tw_pr_" + p)) + "</span>"; }
  function due(x) {
    if (!x.due_at) return "";
    return '<span class="' + (overdue(x) ? "tw-overdue" : "") + '">' + esc(t(overdue(x) ? "tw_due_over" : "tw_due", { d: c.fmtTime(x.due_at) })) + "</span>";
  }

  // ---------- Список ----------
  function card(x) {
    var meta = [
      esc(x.assignee_id ? W().nameOf(x.assignee_id) : t("tw_unassigned")),
      due(x),
      x.items_total ? esc(t("tw_items_n", { a: x.items_done, b: x.items_total })) : "",
      x.comments ? esc(t("tw_comments_n", { n: x.comments })) : ""
    ].filter(Boolean).join(" · ");
    return '<button type="button" class="tw-task' + (overdue(x) ? " is-overdue" : "") + '" data-task="' + esc(x.id) + '">' +
      '<span class="tw-task-top"><span class="tw-num">' + esc(num(x)) + "</span>" + pill(x.status) + prio(x.priority) +
        (x.order_number ? '<span class="tw-tag">' + esc(x.order_number) + "</span>" : "") + "</span>" +
      '<span class="tw-task-title">' + esc(x.title) + "</span>" +
      '<span class="tw-task-meta muted">' + meta + "</span></button>";
  }

  var EMPTY = { mine: "tw_empty_mine", review: "tw_empty_review", created: "tw_empty_created", all: "tw_empty_all" };

  function draw(el) {
    var open = S.list.filter(function (x) { return !closed(x); });
    var done = S.list.filter(closed);
    var newBtn = '<div class="tw-tools"><button type="button" class="btn btn-sm btn-primary" id="tw-new-task">' + esc("+ " + t("tw_task_new")) + "</button></div>";
    el.innerHTML = newBtn +
      (open.length ? '<div class="tw-list">' + open.map(card).join("") + "</div>" : W().emptyBox(EMPTY[S.scope])) +
      (done.length ? '<details class="tw-closed"><summary>' + esc(t("tw_closed_n", { n: done.length })) + '</summary><div class="tw-list">' +
        done.map(card).join("") + "</div></details>" : "");
  }

  async function renderList(scope, el) {
    S.scope = scope;
    var my = ++S.seq;
    if (!S.list.length) el.innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>";
    var r = await db().rpc("task_list", { p_ws: W().ws().id, p_scope: scope });
    if (my !== S.seq) return;   // пока ждали, открыли другой список
    if (r.error) { el.innerHTML = ""; W().fail(r.error); return; }
    S.list = r.data || [];
    draw(el);
  }

  // ---------- Карточка задачи ----------
  async function openTask(id) {
    S.pending = null;
    $("#tw-task-title").textContent = t("loading");
    $("#tw-task-body").innerHTML = "";
    c.openModal("modal-tw-task");
    await loadTask(id);
  }

  async function loadTask(id) {
    var r = await db().rpc("task_get", { p_id: id });
    if (r.error) { c.closeModal("modal-tw-task"); W().fail(r.error); return; }
    S.cur = r.data;
    drawTask();
  }

  // действия: [что сделать, ключ текста, вид кнопки, нужна ли причина: "need" | "opt" | ""]
  function actions(x) {
    var a = [], can = x.can || {}, st = x.status;
    var itemsOk = x.items_done >= x.items_total;
    if (can.work) {
      if (st === "todo") a.push(["in_progress", "tw_act_start", "primary", ""]);
      if (st === "blocked") a.push(["in_progress", "tw_act_resume", "primary", ""]);
      if (st === "todo" || st === "in_progress") {
        a.push([x.reviewer_id ? "submitted" : "done", x.reviewer_id ? "tw_act_submit" : "tw_act_done", st === "in_progress" ? "primary" : "", "", !itemsOk]);
        a.push(["blocked", "tw_act_block", "", "need"]);
      }
      if (st === "submitted") a.push(["in_progress", "tw_act_withdraw", "", ""]);
    } else if (can.edit && (st === "todo" || st === "in_progress") && !x.reviewer_id) {
      a.push(["done", "tw_act_done", "", "", !itemsOk]);
    }
    if (can.review) {
      a.push(["@approve", "tw_act_approve", "primary", ""]);
      a.push(["@reject", "tw_act_reject", "", "need"]);
    }
    if (can.edit) {
      if (OPEN.indexOf(st) !== -1) { a.push(["@edit", "tw_act_edit", "", ""]); a.push(["cancelled", "tw_act_cancel", "danger", "opt"]); }
      if (st === "cancelled") a.push(["todo", "tw_act_restore", "", ""]);
      if (st === "done") a.push(["in_progress", "tw_act_reopen", "", "need"]);
    }
    return a;
  }

  function metaRow(label, value) {
    return '<div class="tw-meta-row"><dt>' + esc(label) + "</dt><dd>" + value + "</dd></div>";
  }

  function eventText(e) {
    var who = e.actor || t("tw_no_name");
    switch (e.kind) {
      case "created": return t("tw_ev_created", { who: who });
      case "status": return t("tw_ev_status", { who: who, a: t("tw_st_" + e.from), b: t("tw_st_" + e.to) });
      case "review": return t(e.to === "done" ? "tw_ev_approved" : "tw_ev_rejected", { who: who });
      case "assigned": return t("tw_ev_assigned", { who: who, n: e.to ? W().nameOf(e.to) : t("tw_unassigned") });
      case "reviewer": return t("tw_ev_reviewer", { who: who, n: e.to ? W().nameOf(e.to) : t("tw_nobody") });
      case "handover": return t(e.note === "reviewer" ? "tw_ev_handover_r" : "tw_ev_handover", { a: e.from ? W().nameOf(e.from) : "—", b: e.to ? W().nameOf(e.to) : t("tw_unassigned") });
      case "edited": return t("tw_ev_edited", { who: who });
      case "item": return t("tw_ev_item_" + e.to, { who: who, x: e.note || "" });
    }
    return e.kind;
  }

  function drawTask() {
    var x = S.cur, can = x.can || {};
    var editableItems = (can.work || can.edit) && ["todo", "in_progress", "blocked"].indexOf(x.status) !== -1;
    $("#tw-task-title").textContent = num(x) + " · " + x.title;

    var acts = actions(x).map(function (a) {
      var cls = a[2] === "primary" ? " btn-primary" : a[2] === "danger" ? " btn-danger" : "";
      return '<button type="button" class="btn btn-sm' + cls + '" data-tw-act="' + a[0] + '" data-note="' + a[3] + '"' + (a[4] ? " disabled" : "") + ">" + esc(t(a[1])) + "</button>";
    }).join("");
    var blockedByItems = actions(x).some(function (a) { return a[4]; });

    var items = (x.items || []).map(function (i) {
      return '<li class="tw-item' + (i.done ? " done" : "") + '"><label class="check"><input type="checkbox" data-tw-item="' + esc(i.id) + '"' +
        (i.done ? " checked" : "") + (editableItems ? "" : " disabled") + "><span>" + esc(i.text) + "</span></label>" +
        (can.edit && editableItems ? '<button type="button" class="icon-btn" data-tw-item-del="' + esc(i.id) + '" aria-label="' + esc(t("tw_delete")) + '">×</button>' : "") + "</li>";
    }).join("");

    var comments = (x.comment_list || []).map(function (m) {
      return '<div class="tw-comment' + (m.author_id === W().meId() ? " mine" : "") + '"><div class="muted">' + esc(m.author || t("tw_no_name")) + " · " + esc(c.fmtTime(m.at)) + "</div>" +
        '<div class="tw-comment-body">' + esc(m.body) + "</div></div>";
    }).join("");

    var events = (x.events || []).slice().reverse().map(function (e) {
      return '<li><span class="muted">' + esc(c.fmtTime(e.at)) + "</span> " + esc(eventText(e)) +
        (e.note && e.kind !== "item" && e.kind !== "handover" && e.kind !== "edited" ? ' <span class="tw-note">«' + esc(e.note) + "»</span>" : "") + "</li>";
    }).join("");

    $("#tw-task-body").innerHTML =
      '<div class="tw-task-top">' + pill(x.status) + prio(x.priority) + "</div>" +
      '<dl class="tw-meta">' +
        metaRow(t("tw_f_assignee"), esc(x.assignee_id ? W().nameOf(x.assignee_id) : t("tw_unassigned"))) +
        metaRow(t("tw_f_reviewer"), esc(x.reviewer_id ? W().nameOf(x.reviewer_id) : t("tw_no_review"))) +
        (x.due_at ? metaRow(t("tw_f_due"), '<span class="' + (overdue(x) ? "tw-overdue" : "") + '">' + esc(c.fmtTime(x.due_at)) + "</span>") : "") +
        (x.department_id ? metaRow(t("tw_f_dept"), esc(W().deptName(x.department_id))) : "") +
        metaRow(t("tw_f_author"), esc(W().nameOf(x.created_by) + " · " + c.fmtTime(x.created_at))) +
        (x.order_id ? metaRow(t("to_f_order"), '<button type="button" class="link-btn" data-tw-order="' + esc(x.order_id) + '">' + esc(x.order_number || "—") + "</button>") : "") +
      "</dl>" +
      (x.description ? '<p class="tw-desc">' + esc(x.description) + "</p>" : "") +
      ((x.items || []).length || editableItems ?
        '<h3 class="b-sub">' + esc(t("tw_checklist")) + (x.items_total ? " " + esc(t("tw_items_n", { a: x.items_done, b: x.items_total })) : "") + "</h3>" +
        '<ul class="tw-items">' + items + "</ul>" +
        (editableItems && (can.edit || can.work) ? '<div class="tw-add-row"><input id="tw-item-new" type="text" maxlength="300" placeholder="' + esc(t("tw_item_add")) + '" aria-label="' + esc(t("tw_item_add")) + '"><button type="button" class="btn btn-sm" data-tw-item-add>' + esc(t("tw_add")) + "</button></div>" : "") : "") +
      (acts ? '<div class="tw-actions">' + acts + "</div>" : "") +
      (blockedByItems ? '<p class="field-hint">' + esc(t("tw_items_first")) + "</p>" : "") +
      '<div id="tw-reason" class="tw-reason hidden"><label class="field"><span id="tw-reason-label"></span>' +
        '<textarea id="tw-reason-text" rows="2" maxlength="1000"></textarea></label>' +
        '<div class="tw-actions"><button type="button" class="btn btn-sm btn-ghost" data-tw-reason-cancel>' + esc(t("cancel")) + "</button>" +
        '<button type="button" class="btn btn-sm btn-primary" data-tw-reason-ok>' + esc(t("tw_confirm")) + "</button></div></div>" +
      '<h3 class="b-sub">' + esc(t("tw_comments")) + "</h3>" +
      '<div class="tw-comments">' + (comments || '<p class="muted">' + esc(t("tw_no_comments")) + "</p>") + "</div>" +
      '<div class="tw-add-row tw-comment-new"><textarea id="tw-comment-text" rows="2" maxlength="4000" placeholder="' + esc(t("tw_comment_ph")) + '" aria-label="' + esc(t("tw_comment_ph")) + '"></textarea>' +
        '<button type="button" class="btn btn-sm" data-tw-comment>' + esc(t("tw_send")) + "</button></div>" +
      '<p class="fine-print">' + esc(t("tw_internal_note")) + "</p>" +
      (events ? '<details class="tw-history"><summary>' + esc(t("tw_history")) + '</summary><ul class="tw-events">' + events + "</ul></details>" : "");
  }

  // после действия: свежая карточка, список и значки
  async function after() {
    await loadTask(S.cur.id);
    W().refreshCounts();
    W().rerender();
  }

  async function act(what, note) {
    var x = S.cur, r;
    if (what === "@approve") r = await db().rpc("task_review", { p_id: x.id, p_approve: true, p_note: note || null });
    else if (what === "@reject") r = await db().rpc("task_review", { p_id: x.id, p_approve: false, p_note: note });
    else r = await db().rpc("task_set_status", { p_id: x.id, p_status: what, p_note: note || null });
    if (r.error) { W().fail(r.error); return false; }
    toast(t("tw_saved_status"), "ok");
    await after();
    return true;
  }

  function askReason(what, need) {
    S.pending = { what: what, need: need === "need" };
    $("#tw-reason-label").textContent = t(need === "need" ? "tw_reason" : "tw_reason_opt");
    $("#tw-reason-text").value = "";
    $("#tw-reason").classList.remove("hidden");
    $("#tw-reason-text").focus();
  }

  // ---------- Форма задачи ----------
  function localInput(iso) {
    if (!iso) return "";
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function openForm(x) {
    var w = W(), me = w.meId();
    var others = x ? x.can && x.can.assign_others : w.can("tasks.create");
    var assignees = others ? w.memberOpts([], t("tw_unassigned")) : w.memberOpts([]).filter(function (o) { return o[0] === me; });
    if (x && x.assignee_id && !assignees.some(function (o) { return o[0] === x.assignee_id; })) assignees.push([x.assignee_id, w.nameOf(x.assignee_id)]);
    var prios = ["low", "normal", "high", "urgent"].map(function (p) { return [p, t("tw_pr_" + p)]; });
    w.openForm(t(x ? "tw_task_edit" : "tw_task_new"),
      w.field(t("tw_f_task_title"), '<input name="title" type="text" maxlength="200" required value="' + esc(x ? x.title : "") + '">') +
      w.field(t("tw_f_desc"), '<textarea name="desc" rows="3" maxlength="4000">' + esc(x ? x.description || "" : "") + "</textarea>") +
      '<div class="grid-2">' +
        w.field(t("tw_f_assignee"), w.select("assignee", assignees, x ? x.assignee_id : me)) +
        w.field(t("tw_f_reviewer"), w.select("reviewer", w.memberOpts([], t("tw_no_review")), x ? x.reviewer_id : "")) +
      "</div>" +
      '<div class="grid-2">' +
        w.field(t("tw_f_due"), '<input name="due" type="datetime-local" value="' + esc(localInput(x && x.due_at)) + '">') +
        w.field(t("tw_f_priority"), w.select("priority", prios, x ? x.priority : "normal")) +
      "</div>" +
      w.field(t("tw_f_dept"), w.select("dept", w.deptOpts([]), x ? x.department_id : (w.ov().me.department_id || ""))) +
      (x ? "" : w.field(t("tw_checklist"), '<textarea name="items" rows="3" maxlength="6000"></textarea>', t("tw_f_items_hint"))) +
      (others ? "" : '<p class="field-hint">' + esc(t("tw_only_self")) + "</p>"),
      async function (get) {
        var title = get("title");
        if (!title) { w.formError(t("tw_e_name")); return false; }
        var assignee = get("assignee") || null, reviewer = get("reviewer") || null;
        if (reviewer && reviewer === assignee) { w.formError(t("tw_e_reviewer")); return false; }
        var dueVal = get("due") ? new Date(get("due")).toISOString() : null;
        var r;
        if (!x) {
          var items = get("items").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
          r = await db().rpc("task_create", { p_ws: w.ws().id, p_title: title, p_description: get("desc") || null, p_assignee: assignee, p_reviewer: reviewer,
            p_due: dueVal, p_priority: get("priority"), p_department: get("dept") || null, p_items: items });
          if (!w.ok(r)) return false;
          toast(t("tw_task_created"), "ok");
          W().refreshCounts();
          W().rerender();
          return true;
        }
        r = await db().rpc("task_update", { p_id: x.id, p_title: title, p_description: get("desc") || null, p_due: dueVal, p_priority: get("priority"), p_department: get("dept") || null });
        if (!w.ok(r)) return false;
        if (assignee !== (x.assignee_id || null) || reviewer !== (x.reviewer_id || null)) {
          r = await db().rpc("task_assign", { p_id: x.id, p_assignee: assignee, p_reviewer: reviewer });
          if (!w.ok(r)) return false;
        }
        toast(t("s_saved"), "ok");
        await after();
        return true;
      }, x ? "s_save" : "tw_task_create");
  }

  // ---------- События карточки ----------
  function bind() {
    $("#modal-tw-task").addEventListener("click", async function (e) {
      var b;
      if ((b = e.target.closest("[data-tw-act]"))) {
        var what = b.getAttribute("data-tw-act"), need = b.getAttribute("data-note");
        if (what === "@edit") return openForm(S.cur);
        if (need) return askReason(what, need);
        b.disabled = true;
        await act(what, null);
        return;
      }
      if (e.target.closest("[data-tw-reason-cancel]")) { S.pending = null; $("#tw-reason").classList.add("hidden"); return; }
      if ((b = e.target.closest("[data-tw-reason-ok]"))) {
        var note = $("#tw-reason-text").value.trim();
        if (S.pending.need && note.length < 2) { toast(t("tw_e_note"), "error"); $("#tw-reason-text").focus(); return; }
        b.disabled = true;
        if (!(await act(S.pending.what, note))) b.disabled = false;
        return;
      }
      if ((b = e.target.closest("[data-tw-item-del]"))) {
        var rd = await db().rpc("task_item_delete", { p_item: b.getAttribute("data-tw-item-del") });
        if (rd.error) W().fail(rd.error); else after();
        return;
      }
      if (e.target.closest("[data-tw-item-add]")) {
        var txt = $("#tw-item-new").value.trim();
        if (!txt) return;
        var ra = await db().rpc("task_item_add", { p_task: S.cur.id, p_text: txt });
        if (ra.error) W().fail(ra.error); else after();
        return;
      }
      if ((b = e.target.closest("[data-tw-comment]"))) {
        var body = $("#tw-comment-text").value.trim();
        if (!body) return;
        b.disabled = true;
        var rc = await db().rpc("task_comment_add", { p_task: S.cur.id, p_body: body });
        b.disabled = false;
        if (rc.error) { W().fail(rc.error); return; }
        after();
      }
    });
    $("#modal-tw-task").addEventListener("change", async function (e) {
      var box = e.target.closest("[data-tw-item]");
      if (!box) return;
      box.disabled = true;
      var r = await db().rpc("task_item_toggle", { p_item: box.getAttribute("data-tw-item"), p_done: box.checked });
      if (r.error) { box.checked = !box.checked; box.disabled = false; W().fail(r.error); return; }
      after();
    });
    $("#modal-tw-task").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.id === "tw-item-new") { e.preventDefault(); $("[data-tw-item-add]").click(); }
    });
  }

  U.teamtasks = { bind: bind, renderList: renderList, openTask: openTask, openForm: openForm };
})(window.ULA);
