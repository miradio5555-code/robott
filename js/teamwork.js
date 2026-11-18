// =====================================================
// ULA FACTORY — раздел «Команда» (файлы 67–68): «моя работа» (роль, отдел, руководитель, права), сотрудники,
// приглашения с ролью и отделом, отключение и возврат сотрудника, отделы, роли и права, журнал, уведомления.
// Задачи — js/teamtasks.js (ULA.teamtasks).
//
// Права проверяет база (каждая функция сама смотрит, кто вошёл и что ему можно). Здесь только прячутся кнопки,
// которые всё равно не сработали бы. Без файлов 67–68 в базе раздел не показывается (body без .tw-on), а кнопка
// «Команда» в меню работает по-старому (js/team.js, окно помощников).
// Подключается после app.js и js/team.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;
  var PERMS = ["team.manage", "tasks.create", "tasks.view_all", "tasks.manage", "tasks.review"];
  var S = { ws: null, on: false, ov: null, view: "mine", counts: {}, timer: 0, form: null, seq: 0 };

  function db() { return c.db(); }
  function loading() { return '<p class="muted">' + esc(t("loading")) + "</p>"; }

  // нет функции в базе = файлы 67–68 ещё не запущены
  function isMissing(e) {
    var m = String((e && e.message) || "");
    return !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(m));
  }

  // понятный текст ошибки из ответа базы
  var ERR = {
    forbidden: "tw_e_forbidden", team_full: "tm_err_full", too_many_invites: "tm_err_many", role_not_allowed: "tw_e_role",
    duplicate_name: "tw_e_dup", department_cycle: "tw_e_cycle", manager_cycle: "tw_e_cycle", role_in_use: "tw_e_role_used",
    system_role: "tw_e_system_role", cannot_deactivate_self: "tw_e_self", works_elsewhere: "tw_e_elsewhere",
    checklist_incomplete: "tw_e_checklist", note_required: "tw_e_note", review_required: "tw_e_review_required",
    no_reviewer: "tw_e_no_reviewer", reviewer_required: "tw_e_no_reviewer", bad_reviewer: "tw_e_reviewer",
    bad_assignee: "tw_e_assignee", task_closed: "tw_e_closed", task_locked: "tw_e_locked", task_not_found: "tw_e_not_found",
    bad_name: "tw_e_name", bad_title: "tw_e_name", too_many_items: "tw_e_items",
    // файл 69: заказы
    order_not_found: "to_e_not_found", milestones_exist: "to_e_ms_exist", delay_open: "to_e_delay_open", order_closed: "to_e_closed",
    bad_category: "to_e_category", bad_steps: "to_e_steps", delay_closed: "to_e_delay_closed", milestone_closed: "to_e_ms_closed"
  };
  function fail(e) {
    var m = String((e && e.message) || "");
    var k = Object.keys(ERR).filter(function (x) { return new RegExp("(^|[^a-z_])" + x + "([^a-z_]|$)").test(m); })[0];
    if (k) toast(t(ERR[k]), "error"); else c.handleError(e);
  }

  // ---------- Кто есть кто ----------
  function perms() { return (S.ov && S.ov.catalog) || PERMS; }
  function can(p) { return !!S.ov && (S.ov.me.permissions || []).indexOf(p) !== -1; }
  function isOwner() { return !!S.ov && !!S.ov.me.is_owner; }
  function meId() { return S.ov ? S.ov.me.user_id : null; }
  function member(id) { return S.ov ? S.ov.members.filter(function (m) { return m.user_id === id; })[0] : null; }
  function nameOf(id) {
    if (!id) return t("tw_nobody");
    var m = member(id);
    return m ? (m.full_name || t("tw_no_name")) : t("tw_former");
  }
  function role(key) { return S.ov ? S.ov.roles.filter(function (r) { return r.key === key; })[0] : null; }
  function roleName(key) {
    if (!key) return t("tm_role_owner");
    var r = role(key);
    return !r ? key : r.is_system ? t("tw_role_" + key) : r.name;
  }
  function dept(id) { return S.ov ? S.ov.departments.filter(function (d) { return d.id === id; })[0] : null; }
  function deptName(id) { var d = dept(id); return d ? d.name : ""; }
  function active() { return S.ov ? S.ov.members.filter(function (m) { return m.active; }) : []; }
  function hasManage(m) {
    if (m.role === "owner") return true;
    var r = role(m.role_key);
    return !!r && r.permissions.indexOf("team.manage") !== -1;
  }
  function initials(n) {
    var p = String(n || "?").trim().split(/\s+/);
    return ((p[0] || "?").charAt(0) + (p[1] ? p[1].charAt(0) : "")).toUpperCase();
  }
  // роли, которые я могу выдать: владелец — любые; с правом «команда» — без права «команда»
  function grantable() {
    return S.ov.roles.filter(function (r) { return isOwner() || r.permissions.indexOf("team.manage") === -1; });
  }

  // ---------- Включение раздела, значок в меню ----------
  function setOn(v) {
    S.on = !!v;
    document.body.classList.toggle("tw-on", S.on);
  }

  async function start(ws) {
    S.ws = ws || null; S.ov = null; S.view = "mine"; S.counts = {};
    renderBadge();
    if (!ws || state.readOnly) { setOn(false); return; }
    await refreshCounts();
    if (!S.timer) {
      S.timer = setInterval(tick, 60000);
      document.addEventListener("visibilitychange", tick);
    }
  }

  function stop() { S.ws = null; S.ov = null; setOn(false); renderBadge(); }

  function tick() { if (S.on && S.ws && document.visibilityState === "visible") refreshCounts(); }

  async function refreshCounts() {
    if (!S.ws) return;
    var wsId = S.ws.id;
    var r = await db().rpc("task_counts", { p_ws: wsId });
    if (!S.ws || S.ws.id !== wsId) return;
    if (r.error) { if (isMissing(r.error)) setOn(false); return; }
    setOn(true);
    S.counts = r.data || {};
    renderBadge();
    if (state.tab === "team" && S.ov) renderChips();
  }

  function renderBadge() {
    var n = (S.counts.unread || 0) + (S.counts.review || 0);
    var b = $("#team-badge");
    b.textContent = n > 99 ? "99+" : String(n);
    b.classList.toggle("hidden", !n || !S.on);
  }

  // ---------- Раздел ----------
  async function open(view) {
    if (!S.on || !S.ws) return;
    if (view) S.view = view;
    if (!S.ov) $("#tw-body").innerHTML = loading();
    if (!(await reload())) return;
    renderHead();
    renderChips();
    renderView();
  }

  async function reload() {
    var wsId = S.ws.id;
    var r = await db().rpc("team_overview", { p_ws: wsId });
    if (!S.ws || S.ws.id !== wsId) return false;
    if (r.error) { if (isMissing(r.error)) setOn(false); else fail(r.error); return false; }
    S.ov = r.data;
    return true;
  }

  // после изменения: свежие данные и тот же вид
  async function refresh() {
    if (!(await reload())) return;
    renderHead();
    renderChips();
    renderView();
    refreshCounts();
  }

  function renderHead() {
    var me = S.ov.me, m = member(me.user_id) || {};
    var nm = m.full_name || (state.me && state.me.name) || "—";
    var bits = [me.title, roleName(me.role === "owner" ? null : me.role_key), deptName(me.department_id)].filter(Boolean);
    var mine = perms().filter(can).map(function (p) {
      return '<span class="tw-tag">' + esc(t("tw_perm_" + p.replace(".", "_"))) + "</span>";
    }).join("");
    $("#tw-head").innerHTML =
      '<div class="tw-me"><span class="tw-ava" aria-hidden="true">' + esc(initials(nm)) + "</span>" +
        '<div class="tw-me-txt"><b>' + esc(nm) + "</b>" +
          '<span class="muted">' + esc(bits.join(" · ")) + "</span>" +
          (me.manager_id ? '<span class="muted">' + esc(t("tw_reports_to", { n: nameOf(me.manager_id) })) + "</span>" : "") +
        "</div></div>" +
      '<div class="tw-perms"><span class="muted">' + esc(t("tw_my_rights")) + "</span> " +
        (mine || '<span class="muted">' + esc(t("tw_perm_none")) + "</span>") + "</div>";
    $("#tw-invite").classList.toggle("hidden", !can("team.manage"));
  }

  // Виды раздела по группам: [вид, ключ названия, число, группа]. Группы — первая строка, виды группы — вторая.
  var GROUPS = [["tasks", "tw_g_tasks"], ["orders", "tw_g_orders"], ["ops", "tw_g_ops"], ["people", "tw_g_people"], ["reports", "tw_g_reports"], ["notif", "tw_v_notif"]];
  function views() {
    var c = S.counts, v = [["mine", "tw_v_mine", c.mine, "tasks"], ["review", "tw_v_review", c.review, "tasks"], ["created", "tw_v_created", 0, "tasks"]];
    if (can("tasks.view_all") || can("tasks.manage")) v.push(["all", "tw_v_all", 0, "tasks"]);
    // файл 69: заказы, где я в команде; заказы с задержками и просрочкой (доступ ко всем заказам); шаблоны этапов
    if ("orders" in c) {
      v.push(["orders", "to_v_orders", c.orders, "orders"]);
      if (c.full) v.push(["attention", "to_v_attention", c.alerts, "orders"]);
      v.push(["templates", "to_v_templates", 0, "orders"]);
    }
    // файл 70: сводка, инциденты, календарь, регламенты; файл 71: аналитика
    if (c.ops) {
      if (c.full) v.push(["dashboard", "op_v_dashboard", 0, "ops"]);
      v.push(["incidents", "op_v_incidents", c.incidents, "ops"], ["calendar", "op_v_calendar", 0, "ops"], ["sops", "op_v_sops", c.sops_unread, "ops"]);
      v.push(["analytics", "op_v_analytics", 0, "reports"]);
    }
    v.push(["people", "tw_v_people", 0, "people"], ["depts", "tw_v_depts", 0, "people"], ["roles", "tw_v_roles", 0, "people"]);
    if (can("team.manage")) v.push(["audit", "tw_v_audit", 0, "people"]);
    v.push(["notif", "tw_v_notif", c.unread, "notif"]);
    return v;
  }

  function chip(attr, id, key, n, on) {
    return '<button type="button" class="chip' + (on ? " active" : "") + '" role="tab" aria-selected="' + on + '" ' + attr + '="' + id + '">' +
      esc(t(key)) + (n ? " <b>" + esc(String(n)) + "</b>" : "") + "</button>";
  }

  function renderChips() {
    var list = views();
    if (!list.some(function (v) { return v[0] === S.view; })) S.view = "mine";
    var cur = list.filter(function (v) { return v[0] === S.view; })[0][3];
    var groups = GROUPS.filter(function (g) { return list.some(function (v) { return v[3] === g[0]; }); });
    var sub = list.filter(function (v) { return v[3] === cur; });
    $("#tw-chips").innerHTML =
      '<div class="chips tw-groups" role="tablist">' + groups.map(function (g) {
        var n = list.filter(function (v) { return v[3] === g[0] && g[0] !== "people"; }).reduce(function (a, v) { return a + (v[2] || 0); }, 0);
        return chip("data-tw-group", g[0], g[1], g[0] === "tasks" ? (S.counts.mine || 0) + (S.counts.review || 0) : n, g[0] === cur);
      }).join("") + "</div>" +
      (sub.length > 1 ? '<div class="chips tw-sub" role="tablist">' + sub.map(function (v) { return chip("data-tw-view", v[0], v[1], v[2], v[0] === S.view); }).join("") + "</div>" : "");
    if (S.counts.overdue) {
      $("#tw-alert").innerHTML = '<span>' + esc(t("tw_overdue_n", { n: S.counts.overdue })) + "</span>";
      $("#tw-alert").classList.remove("hidden");
    } else $("#tw-alert").classList.add("hidden");
  }

  function firstOf(g) { return views().filter(function (v) { return v[3] === g; })[0][0]; }

  function renderView() {
    var el = $("#tw-body"), v = S.view;
    if (v === "mine" || v === "review" || v === "created" || v === "all") return U.teamtasks.renderList(v, el);
    if (v === "people") return renderPeople(el);
    if (v === "depts") return renderDepts(el);
    if (v === "roles") return renderRoles(el);
    if (v === "audit") return renderAudit(el);
    if (v === "notif") return renderNotif(el);
    if (v === "orders") return U.teamorders.renderList("mine", el);
    if (v === "attention") return U.teamorders.renderList("attention", el);
    if (v === "templates") return U.teamorders.renderTemplates(el);
    if (U.teamops && (v === "dashboard" || v === "incidents" || v === "calendar" || v === "sops")) return U.teamops.render(v, el);
    if (v === "analytics" && U.teamreports) return U.teamreports.render(el);
  }

  function emptyBox(key) { return '<div class="state-box"><p>' + esc(t(key)) + "</p></div>"; }

  // ---------- Сотрудники ----------
  function personRow(m) {
    var manage = can("team.manage"), mine = m.user_id === meId();
    var editable = manage && m.active && (isOwner() || (!mine && !hasManage(m)));
    var line = [m.title, roleName(m.role === "owner" ? null : m.role_key), deptName(m.department_id)].filter(Boolean).join(" · ");
    var contacts = [m.phone ? c.fmtPhone(m.phone) : "", m.email || ""].filter(Boolean).join(" · ");
    var off = !m.active;
    return '<div class="tw-row' + (off ? " tw-off" : "") + '">' +
      '<span class="tw-ava" aria-hidden="true">' + esc(initials(m.full_name)) + "</span>" +
      '<div class="tw-row-txt"><b>' + esc(m.full_name || t("tw_no_name")) + (mine ? ' <span class="tw-tag">' + esc(t("tw_you")) + "</span>" : "") + "</b>" +
        '<span class="muted">' + esc(line) + "</span>" +
        (m.manager_id ? '<span class="muted">' + esc(t("tw_reports_to", { n: nameOf(m.manager_id) })) + "</span>" : "") +
        (contacts ? '<span class="muted">' + esc(contacts) + "</span>" : "") +
        (off && m.deactivated_at ? '<span class="tw-warn">' + esc(t("tw_off_since", { d: c.fmtDate(m.deactivated_at) })) +
          (m.deactivation_note ? " — " + esc(m.deactivation_note) : "") + "</span>" : "") +
      "</div>" +
      '<div class="tw-row-act">' +
        (editable ? '<button type="button" class="btn btn-sm" data-tw-edit="' + esc(m.user_id) + '">' + esc(t("tw_edit")) + "</button>" : "") +
        (editable && m.role === "staff" && !mine ? '<button type="button" class="btn btn-sm btn-danger" data-tw-off="' + esc(m.user_id) + '">' + esc(t("tw_deactivate")) + "</button>" : "") +
        (off && manage ? '<button type="button" class="btn btn-sm" data-tw-on="' + esc(m.user_id) + '">' + esc(t("tw_reactivate")) + "</button>" : "") +
      "</div></div>";
  }

  function inviteUrl(code) {
    return location.origin + location.pathname.replace(/index\.html$/, "") + "?team=" + code;
  }

  function inviteRow(i) {
    var url = inviteUrl(i.code);
    var who = [i.invitee_name, i.title, roleName(i.role_key), deptName(i.department_id)].filter(Boolean).join(" · ");
    return '<div class="tw-row tw-invite"><div class="tw-row-txt"><b>' + esc(who) + "</b>" +
      '<span class="muted">' + esc(t("tm_invite_until", { d: c.fmtDate(i.expires_at) })) + "</span>" +
      '<input class="link-input" type="text" readonly value="' + esc(url) + '" aria-label="' + esc(t("tw_invite_link")) + '"></div>' +
      '<div class="tw-row-act">' +
        '<button type="button" class="btn btn-sm" data-tw-copy="' + esc(url) + '">' + esc(t("copy")) + "</button>" +
        '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t("tm_wa_text") + " " + url) + '">WhatsApp</a>' +
        '<button type="button" class="btn btn-sm btn-ghost" data-tw-revoke="' + esc(i.code) + '">' + esc(t("tm_cancel")) + "</button>" +
      "</div></div>";
  }

  function renderPeople(el) {
    var manage = can("team.manage");
    var on = S.ov.members.filter(function (m) { return m.active; });
    var off = S.ov.members.filter(function (m) { return !m.active; });
    var staff = on.filter(function (m) { return m.role === "staff"; }).length;
    var h = '<div class="tw-list">' + on.map(personRow).join("") + "</div>";
    if (manage && S.ov.invites.length) h += '<h3 class="b-sub">' + esc(t("tm_invites")) + '</h3><div class="tw-list">' + S.ov.invites.map(inviteRow).join("") + "</div>";
    if (manage && off.length) h += '<h3 class="b-sub">' + esc(t("tw_inactive")) + '</h3><div class="tw-list">' + off.map(personRow).join("") + "</div>";
    h += '<p class="fine-print">' + esc(t("tw_limit", { n: staff, max: S.ov.limit || 5 })) + "</p>";
    el.innerHTML = h;
  }

  // ---------- Окно-форма (одно на все формы раздела) ----------
  function field(label, input, hint) {
    return '<label class="field"><span>' + esc(label) + "</span>" + input + (hint ? '<p class="field-hint">' + esc(hint) + "</p>" : "") + "</label>";
  }
  function select(name, opts, val) {
    return '<select name="' + name + '">' + opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val == null ? "" : val) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select>";
  }
  function memberOpts(except, noneLabel) {
    var list = active().filter(function (m) { return except.indexOf(m.user_id) === -1; }).map(function (m) {
      return [m.user_id, (m.full_name || t("tw_no_name")) + (m.user_id === meId() ? " (" + t("tw_you") + ")" : "")];
    });
    return noneLabel ? [["", noneLabel]].concat(list) : list;
  }
  function deptOpts(except) {
    // дерево: вложенные отделы со сдвигом
    var out = [["", t("tw_no_dept")]];
    (function walk(parent, depth) {
      S.ov.departments.filter(function (d) { return (d.parent_id || null) === parent && except.indexOf(d.id) === -1; })
        .forEach(function (d) { out.push([d.id, new Array(depth + 1).join("— ") + d.name]); walk(d.id, depth + 1); });
    })(null, 0);
    return out;
  }

  function openForm(title, html, onSubmit, saveKey) {
    $("#tw-form-title").textContent = title;
    $("#tw-form-fields").innerHTML = html;
    $("#tw-form-error").classList.add("hidden");
    $("#tw-form-save").textContent = t(saveKey || "s_save");
    $("#tw-form-save").classList.remove("hidden", "btn-danger");
    S.form = onSubmit;
    c.openModal("modal-tw-form");
  }

  function formError(msg) {
    var el = $("#tw-form-error");
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!S.form) return;
    var btn = $("#tw-form-save");
    btn.disabled = true;
    formError("");
    try {
      var fd = new FormData($("#tw-form"));
      var get = function (k) { var v = fd.get(k); return v == null ? "" : String(v).trim(); };
      var done = await S.form(get, fd);
      if (done !== false) c.closeModal("modal-tw-form");
    } finally {
      btn.disabled = false;
    }
  }

  // ответ базы → ошибка в окне (не закрывать) или успех
  function ok(res) {
    if (res.error) { fail(res.error); return false; }
    return true;
  }

  // ---------- Приглашение ----------
  function openInvite() {
    var roles = grantable().map(function (r) { return [r.key, roleName(r.key)]; });
    openForm(t("tw_invite_title"),
      '<p class="muted">' + esc(t("tw_invite_hint")) + "</p>" +
      field(t("tw_f_name"), '<input name="name" type="text" maxlength="120" autocomplete="off">', t("tw_f_name_hint")) +
      field(t("tw_f_role"), select("role", roles, "assistant")) +
      field(t("tw_f_dept"), select("dept", deptOpts([]), "")) +
      field(t("tw_f_title"), '<input name="title" type="text" maxlength="80" autocomplete="off">'),
      async function (get) {
        var res = await db().rpc("team_invite_new", { p_ws: S.ws.id, p_role_key: get("role"), p_department: get("dept") || null, p_title: get("title") || null, p_name: get("name") || null });
        if (!ok(res)) return false;
        var url = inviteUrl(res.data);
        var copied = await c.copyText(url);
        toast(t(copied ? "tm_created_copied" : "tm_created"), "ok");
        S.view = "people";
        refresh();
      }, "tw_invite_create");
  }

  // ---------- Изменить сотрудника ----------
  function openEdit(id) {
    var m = member(id);
    if (!m) return;
    var roles = grantable();
    if (m.role_key && !roles.some(function (r) { return r.key === m.role_key; })) roles = roles.concat([role(m.role_key)].filter(Boolean));
    var managers = memberOpts([id], t("tw_no_manager"));
    openForm(t("tw_edit_title", { n: m.full_name || t("tw_no_name") }),
      (m.role === "staff" ? field(t("tw_f_role"), select("role", roles.map(function (r) { return [r.key, roleName(r.key)]; }), m.role_key)) : "") +
      field(t("tw_f_dept"), select("dept", deptOpts([]), m.department_id)) +
      field(t("tw_f_title"), '<input name="title" type="text" maxlength="80" value="' + esc(m.title || "") + '">') +
      field(t("tw_f_manager"), select("manager", managers, m.manager_id)),
      async function (get) {
        return ok(await db().rpc("team_member_update", { p_ws: S.ws.id, p_user: id, p_role_key: m.role === "staff" ? get("role") : null,
          p_department: get("dept") || null, p_title: get("title") || null, p_manager: get("manager") || null })) ? (toast(t("s_saved"), "ok"), refresh()) : false;
      });
  }

  // ---------- Отключить / включить ----------
  function openDeactivate(id) {
    var m = member(id);
    if (!m) return;
    openForm(t("tw_off_title", { n: m.full_name || t("tw_no_name") }),
      '<p class="muted">' + esc(t("tw_off_hint")) + "</p>" +
      field(t("tw_f_handover"), select("to", memberOpts([id], t("tw_leave_unassigned")), ""), t("tw_f_handover_hint")) +
      field(t("tw_f_note"), '<input name="note" type="text" maxlength="300" autocomplete="off">'),
      async function (get) {
        var res = await db().rpc("team_deactivate", { p_ws: S.ws.id, p_user: id, p_reassign_to: get("to") || null, p_note: get("note") || null });
        if (!ok(res)) return false;
        toast(t("tw_off_done", { n: (res.data && res.data.moved) || 0 }), "ok");
        refresh();
      }, "tw_deactivate");
    $("#tw-form-save").classList.add("btn-danger");
  }

  async function reactivate(id) {
    var m = member(id);
    if (!m || !window.confirm(t("tw_on_confirm", { n: m.full_name || t("tw_no_name") }))) return;
    if (ok(await db().rpc("team_reactivate", { p_ws: S.ws.id, p_user: id }))) { toast(t("tw_on_done"), "ok"); refresh(); }
  }

  async function revokeInvite(code) {
    if (ok(await db().rpc("team_invite_revoke", { p_ws: S.ws.id, p_code: code }))) refresh();
  }

  // ---------- Отделы ----------
  function renderDepts(el) {
    var manage = can("team.manage");
    var ds = S.ov.departments;
    var count = function (id) { return active().filter(function (m) { return m.department_id === id; }).length; };
    var rows = [];
    (function walk(parent, depth) {
      ds.filter(function (d) { return (d.parent_id || null) === parent; }).forEach(function (d) {
        var people = active().filter(function (m) { return m.department_id === d.id; }).map(function (m) { return m.full_name || t("tw_no_name"); });
        rows.push('<div class="tw-row" style="--depth:' + depth + '"><div class="tw-row-txt"><b>' + esc(d.name) + "</b>" +
          '<span class="muted">' + esc(t("tw_dept_head", { n: d.head_user_id ? nameOf(d.head_user_id) : t("tw_nobody") })) + " · " + esc(t("tw_people_n", { n: count(d.id) })) + "</span>" +
          (people.length ? '<span class="muted">' + esc(people.join(", ")) + "</span>" : "") + "</div>" +
          (manage ? '<div class="tw-row-act"><button type="button" class="btn btn-sm" data-tw-dept="' + esc(d.id) + '">' + esc(t("tw_edit")) + "</button>" +
            '<button type="button" class="btn btn-sm btn-ghost" data-tw-dept-del="' + esc(d.id) + '">' + esc(t("tw_delete")) + "</button></div>" : "") +
          "</div>");
        walk(d.id, depth + 1);
      });
    })(null, 0);
    var none = active().filter(function (m) { return !m.department_id; }).map(function (m) { return m.full_name || t("tw_no_name"); });
    el.innerHTML = (manage ? '<div class="tw-tools"><button type="button" class="btn btn-sm" data-tw-dept="">' + esc("+ " + t("tw_dept_add")) + "</button></div>" : "") +
      (rows.length ? '<div class="tw-list tw-tree">' + rows.join("") + "</div>" : emptyBox("tw_dept_empty")) +
      (none.length && rows.length ? '<p class="fine-print">' + esc(t("tw_no_dept_people", { n: none.join(", ") })) + "</p>" : "");
  }

  function descendants(id) {
    var out = [id];
    S.ov.departments.forEach(function (d) { if (d.parent_id === id) out = out.concat(descendants(d.id)); });
    return out;
  }

  function openDept(id) {
    var d = id ? dept(id) : null;
    openForm(t(d ? "tw_dept_edit" : "tw_dept_add"),
      field(t("tw_f_dept_name"), '<input name="name" type="text" maxlength="80" required value="' + esc(d ? d.name : "") + '">') +
      field(t("tw_f_parent"), select("parent", deptOpts(d ? descendants(d.id) : []), d && d.parent_id)) +
      field(t("tw_f_head"), select("head", memberOpts([], t("tw_nobody")), d && d.head_user_id)),
      async function (get) {
        if (!get("name")) { formError(t("tw_e_name")); return false; }
        return ok(await db().rpc("team_department_save", { p_ws: S.ws.id, p_id: id || null, p_name: get("name"), p_parent: get("parent") || null, p_head: get("head") || null }))
          ? (toast(t("s_saved"), "ok"), refresh()) : false;
      });
  }

  async function deleteDept(id) {
    var d = dept(id);
    if (!d || !window.confirm(t("tw_dept_del_confirm", { n: d.name }))) return;
    if (ok(await db().rpc("team_department_delete", { p_ws: S.ws.id, p_id: id }))) refresh();
  }

  // ---------- Роли и права ----------
  function renderRoles(el) {
    var owner = isOwner();
    el.innerHTML = (owner ? '<div class="tw-tools"><button type="button" class="btn btn-sm" data-tw-role="">' + esc("+ " + t("tw_role_add")) + "</button></div>" : "") +
      '<p class="muted">' + esc(t(owner ? "tw_roles_hint_owner" : "tw_roles_hint")) + "</p>" +
      '<div class="tw-list">' + S.ov.roles.map(function (r) {
        return '<div class="tw-row"><div class="tw-row-txt"><b>' + esc(roleName(r.key)) + "</b>" +
          '<span class="muted">' + esc(t("tw_people_n", { n: r.members || 0 })) + (r.is_system ? " · " + esc(t("tw_role_system")) : "") + "</span>" +
          '<ul class="tw-perm-list">' + perms().map(function (p) {
            var on = r.permissions.indexOf(p) !== -1;
            return '<li class="' + (on ? "on" : "off") + '">' + (on ? "✓ " : "— ") + esc(t("tw_perm_" + p.replace(".", "_"))) + "</li>";
          }).join("") + "</ul></div>" +
          (owner ? '<div class="tw-row-act"><button type="button" class="btn btn-sm" data-tw-role="' + esc(r.key) + '">' + esc(t("tw_edit")) + "</button>" +
            (!r.is_system && !r.members ? '<button type="button" class="btn btn-sm btn-ghost" data-tw-role-del="' + esc(r.key) + '">' + esc(t("tw_delete")) + "</button>" : "") + "</div>" : "") +
          "</div>";
      }).join("") + "</div>" +
      '<p class="fine-print">' + esc(t(perms().indexOf("orders.all") !== -1 ? "tw_roles_orders_note69" : "tw_roles_orders_note")) + "</p>";
  }

  function openRole(key) {
    var r = key ? role(key) : null;
    openForm(t(r ? "tw_role_edit" : "tw_role_add"),
      field(t("tw_f_role_name"), '<input name="name" type="text" maxlength="60" required value="' + esc(r ? roleName(r.key) : "") + '">') +
      '<fieldset class="tw-perm-pick"><legend>' + esc(t("tw_f_perms")) + "</legend>" + perms().map(function (p) {
        var k = p.replace(".", "_");
        return '<label class="check"><input type="checkbox" name="perm" value="' + p + '"' + (r && r.permissions.indexOf(p) !== -1 ? " checked" : "") + ">" +
          '<span><b>' + esc(t("tw_perm_" + k)) + '</b><small class="muted">' + esc(t("tw_perm_" + k + "_d")) + "</small></span></label>";
      }).join("") + "</fieldset>",
      async function (get, fd) {
        if (!get("name")) { formError(t("tw_e_name")); return false; }
        return ok(await db().rpc("team_role_save", { p_ws: S.ws.id, p_key: key || null, p_name: get("name"), p_permissions: fd.getAll("perm") }))
          ? (toast(t("s_saved"), "ok"), refresh()) : false;
      });
  }

  async function deleteRole(key) {
    if (!window.confirm(t("tw_role_del_confirm", { n: roleName(key) }))) return;
    if (ok(await db().rpc("team_role_delete", { p_ws: S.ws.id, p_key: key }))) refresh();
  }

  // ---------- Журнал ----------
  function auditText(a) {
    var d = a.detail || {};
    var who = nameOf(a.actor_id), whom = a.target_user ? nameOf(a.target_user) : "";
    var extra = d.name || (d.role_key && typeof d.role_key === "string" ? roleName(d.role_key) : "") || "";
    if (a.action === "member.deactivate" && d.moved) extra = t("tw_moved_n", { n: d.moved });
    return t("tw_a_" + a.action.replace(".", "_"), { who: who, whom: whom, x: extra });
  }

  function renderAudit(el) {
    var list = S.ov.audit || [];
    el.innerHTML = list.length ? '<div class="tw-list tw-log">' + list.map(function (a) {
      return '<div class="tw-log-row"><span class="muted">' + esc(c.fmtTime(a.at)) + "</span><span>" + esc(auditText(a)) + "</span></div>";
    }).join("") + "</div>" : emptyBox("tw_audit_empty");
  }

  // ---------- Уведомления ----------
  function notifText(n) {
    var who = n.actor || t("tw_no_name");
    if (/^order_/.test(n.kind)) return t("to_n_" + n.kind.slice(6), { who: who, x: n.title || "" });   // файл 69: заказ
    if (/^incident_/.test(n.kind)) return t("op_n_" + n.kind, { who: who, x: n.title || "", n: n.incident_number || "?",   // файл 70
      s: n.kind === "incident_status" ? t("op_ist_" + n.note) : n.kind === "incident_new" ? t("op_sev_" + n.note) : "" });
    if (n.kind === "sop_published") return t("op_n_sop_published", { who: who, x: n.title || "" });
    return t("tw_n_" + n.kind, { who: who, n: n.task_number || "?", x: n.title || "" });
  }

  async function renderNotif(el) {
    el.innerHTML = loading();
    var r = await db().rpc("team_notif_list", { p_ws: S.ws.id, p_limit: 50 });
    if (r.error) { el.innerHTML = ""; fail(r.error); return; }
    var list = r.data || [];
    var unread = list.some(function (n) { return !n.read; });
    el.innerHTML = (unread ? '<div class="tw-tools"><button type="button" class="btn btn-sm" data-tw-read-all>' + esc(t("tw_read_all")) + "</button></div>" : "") +
      (list.length ? '<div class="tw-list">' + list.map(function (n) {
        return '<button type="button" class="tw-notif' + (n.read ? "" : " unread") + '" data-tw-notif="' + esc(n.id) + '" data-task="' + esc(n.task_id || "") + '" data-order="' + esc(n.order_id || "") + '" data-incident="' + esc(n.incident_id || "") + '" data-sop="' + esc(n.sop_id || "") + '">' +
          '<span class="tw-dot" aria-hidden="true"></span><span class="tw-row-txt"><span>' + esc(notifText(n)) + "</span>" +
          (n.note && !/^(incident_|sop_)/.test(n.kind) ? '<span class="muted tw-note">' + esc(n.note) + "</span>" : "") +
          '<span class="muted">' + esc(c.fmtTime(n.at)) + "</span></span></button>";
      }).join("") + "</div>" : emptyBox("tw_notif_empty"));
  }

  async function readNotif(ids) {
    var r = await db().rpc("team_notif_read", { p_ws: S.ws.id, p_ids: ids });
    if (r.error) { fail(r.error); return; }
    await refreshCounts();
  }

  // ---------- События ----------
  function bind() {
    $("#tab-team").addEventListener("click", async function (e) {
      var b;
      if ((b = e.target.closest("[data-tw-group]"))) { S.view = firstOf(b.getAttribute("data-tw-group")); renderChips(); renderView(); return; }
      if ((b = e.target.closest("[data-tw-view]"))) { S.view = b.getAttribute("data-tw-view"); renderChips(); renderView(); return; }
      if (e.target.closest("#tw-invite")) return openInvite();
      if (e.target.closest("#tw-new-task")) return U.teamtasks.openForm(null);
      if ((b = e.target.closest("[data-tw-edit]"))) return openEdit(b.getAttribute("data-tw-edit"));
      if ((b = e.target.closest("[data-tw-off]"))) return openDeactivate(b.getAttribute("data-tw-off"));
      if ((b = e.target.closest("[data-tw-on]"))) return reactivate(b.getAttribute("data-tw-on"));
      if ((b = e.target.closest("[data-tw-revoke]"))) return revokeInvite(b.getAttribute("data-tw-revoke"));
      if ((b = e.target.closest("[data-tw-copy]"))) {
        var copied = await c.copyText(b.getAttribute("data-tw-copy"));
        toast(t(copied ? "copied" : "error_generic"), copied ? "ok" : "error");
        return;
      }
      if ((b = e.target.closest("[data-tw-dept]"))) return openDept(b.getAttribute("data-tw-dept"));
      if ((b = e.target.closest("[data-tw-dept-del]"))) return deleteDept(b.getAttribute("data-tw-dept-del"));
      if ((b = e.target.closest("[data-tw-role]"))) return openRole(b.getAttribute("data-tw-role"));
      if ((b = e.target.closest("[data-tw-role-del]"))) return deleteRole(b.getAttribute("data-tw-role-del"));
      if (e.target.closest("[data-tw-read-all]")) { await readNotif(null); return renderView(); }
      if ((b = e.target.closest("[data-tw-notif]"))) {
        var task = b.getAttribute("data-task"), order = b.getAttribute("data-order");
        b.classList.remove("unread");
        readNotif([Number(b.getAttribute("data-tw-notif"))]);
        var inc = b.getAttribute("data-incident"), sop = b.getAttribute("data-sop");
        if (task) U.teamtasks.openTask(task);
        else if (inc && U.teamops) U.teamops.openIncident(inc);
        else if (sop && U.teamops) U.teamops.openSop(sop);
        else if (order && U.teamorders) U.teamorders.openOrder(order);
        return;
      }
      if ((b = e.target.closest("[data-task]"))) return U.teamtasks.openTask(b.getAttribute("data-task"));
    });
    $("#tw-form").addEventListener("submit", submitForm);
  }

  U.teamwork = {
    bind: bind, start: start, stop: stop, open: open, refresh: refresh, refreshCounts: refreshCounts,
    isOn: function () { return S.on; }, ws: function () { return S.ws; }, ov: function () { return S.ov; }, counts: function () { return S.counts; },
    can: can, meId: meId, member: member, nameOf: nameOf, deptName: deptName, deptOpts: deptOpts, memberOpts: memberOpts,
    active: active, fail: fail, field: field, select: select, openForm: openForm, formError: formError, ok: ok, emptyBox: emptyBox,
    view: function () { return S.view; }, rerender: function () { if (state.tab === "team" && S.ov) renderView(); }
  };
})(window.ULA);
