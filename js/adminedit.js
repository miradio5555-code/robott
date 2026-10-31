// =====================================================
// ULA FACTORY — режим правки: администратор меняет данные в кабинете байера (файл 48).
//
// В чужом кабинете у администратора в красной полосе сверху — «Включить правку» и «Журнал».
// Правка включается на 2 часа для одного кабинета: администратор работает в нём как владелец.
// Каждое изменение база записывает в журнал (кто, когда, что). «Завершить правку» — снова только просмотр.
// ULA.adminEdit.check(ws, mine) — зовёт openWorkspace; ULA.adminEdit.banner() — кнопки в полосе.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;
  var timer = null, active = null;   // active — кабинет, где сейчас включена правка

  function isAdmin() { return !!(state.me && state.me.role === "admin"); }
  function foreign() { return !!(state.ws && !(state.myWs && state.myWs.id === state.ws.id)); }
  function hhmm(s) { return new Date(s).toLocaleTimeString(c.locale(), { hour: "2-digit", minute: "2-digit" }); }

  // Promise → до какого времени включена правка этого кабинета (null — только просмотр)
  function check(ws, mine) {
    clearTimeout(timer);
    if (!isAdmin()) return Promise.resolve(null);
    if (mine) { if (active) stop(true); return Promise.resolve(null); }
    return c.db().from("admin_edit").select("workspace_id, until").maybeSingle().then(function (r) {
      var e = r.data, live = !r.error && e && new Date(e.until) > new Date();
      active = live ? e.workspace_id : null;
      if (!live || e.workspace_id !== ws.id) return null;
      timer = setTimeout(expired, Math.min(new Date(e.until) - new Date(), 2147483000));
      return e.until;
    }, function () { return null; });
  }

  function reopen() {
    var tab = state.tab;
    return c.openWorkspace(state.ws).then(function () { if (tab) c.switchTab(tab); });
  }
  function expired() {
    active = null;
    toast(t("adm_edit_expired"), "error");
    if (state.adminEdit) reopen();
  }

  function start() {
    if (!state.ws || !confirm(t("adm_edit_confirm", { n: state.ws.name }))) return;
    c.db().rpc("admin_edit_start", { p_ws: state.ws.id }).then(function (r) {
      if (r.error) { c.handleError(r.error); return; }
      toast(t("adm_edit_started"), "ok");
      reopen();
    });
  }
  function stop(silent) {
    active = null;
    clearTimeout(timer);
    return c.db().rpc("admin_edit_stop").then(function (r) {
      if (silent) return;
      if (r.error) { c.handleError(r.error); return; }
      toast(t("adm_edit_stopped"), "ok");
      reopen();
    });
  }

  function banner() {
    var show = isAdmin() && foreign();
    var edit = $("#ws-edit"), log = $("#ws-log");
    edit.classList.toggle("hidden", !show);
    log.classList.toggle("hidden", !show);
    edit.textContent = t(state.adminEdit ? "adm_edit_off" : "adm_edit_on");
    log.textContent = t("adm_log");
    if (state.adminEdit) $("#ws-banner-text").textContent = t("adm_edit_banner", { n: state.ws.name, t: hhmm(state.adminEdit) });
    document.body.classList.toggle("admin-editing", !!state.adminEdit);
  }

  // ---------- Журнал правок кабинета ----------
  function ensureLog() {
    var m = $("#modal-admlog");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-admlog";
    m.className = "modal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet" role="dialog" aria-modal="true">' +
      '<div class="modal-head"><h2 id="admlog-title"></h2><button class="icon-btn" type="button" data-close aria-label="Close">×</button></div>' +
      '<div class="modal-body"><div id="admlog-list" class="admlog"></div></div></div>';
    document.body.appendChild(m);
    return m;
  }
  function what(r, num) {
    if (r.op === "edit_on" || r.op === "edit_off") return t("adm_op_" + r.op);
    var s = t("adm_op_" + r.op) + " " + t("adm_t_" + r.tbl);
    if (num[r.row_id]) s += " " + num[r.row_id];
    return s;
  }
  async function openLog() {
    ensureLog();
    $("#admlog-title").textContent = t("adm_log_title", { n: state.ws.name });
    var box = $("#admlog-list");
    box.innerHTML = '<p class="muted">…</p>';
    c.openModal("modal-admlog");
    var db = c.db();
    var r = await db.from("admin_audit").select("admin_id, tbl, op, row_id, cols, at")
      .eq("workspace_id", state.ws.id).order("at", { ascending: false }).limit(200);
    if (r.error) { box.innerHTML = '<p class="muted">' + esc(t("error_generic")) + "</p>"; return; }
    var rows = r.data || [];
    if (!rows.length) { box.innerHTML = '<p class="muted">' + esc(t("adm_log_empty")) + "</p>"; return; }
    var admins = rows.map(function (x) { return x.admin_id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var orders = rows.filter(function (x) { return x.tbl === "orders" && x.row_id; }).map(function (x) { return x.row_id; });
    var res = await Promise.all([
      db.from("profiles").select("user_id, full_name").in("user_id", admins),
      orders.length ? db.from("orders").select("id, order_number").in("id", orders.slice(0, 150)) : Promise.resolve({ data: [] })
    ]);
    var names = {}, num = {};
    (res[0].data || []).forEach(function (p) { names[p.user_id] = p.full_name; });
    (res[1].data || []).forEach(function (o) { num[o.id] = o.order_number; });
    box.innerHTML = rows.map(function (x) {
      return '<div class="admlog-row admlog-' + esc(String(x.op).toLowerCase()) + '"><time>' + esc(c.fmtTime(x.at)) + "</time><div><b>" +
        esc(names[x.admin_id] || t("adm_someone")) + "</b> " + esc(what(x, num)) +
        (x.cols && x.cols.length ? '<small>' + esc(t("adm_fields")) + " " + esc(x.cols.join(", ")) + "</small>" : "") + "</div></div>";
    }).join("");
  }

  function bind() {
    $("#ws-edit").addEventListener("click", function () { if (state.adminEdit) stop(false); else start(); });
    $("#ws-log").addEventListener("click", openLog);
  }

  U.adminEdit = { check: check, banner: banner, bind: bind };
})(window.ULA);
