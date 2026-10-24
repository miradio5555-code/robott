// =====================================================
// ULA FACTORY — помощник в кабинете (команда).
//
// Владелец создаёт приглашение и отправляет ссылку помощнику. Помощник входит под своим
// паролем и работает в том же кабинете, но не может удалять, менять настройки,
// видеть отчёт о прибыли и звать других.
//
// Ссылка приглашения: https://сайт/?team=КОД. Код запоминается в браузере и принимается
// сразу после входа или регистрации (acceptPending).
// Права проверяет база (migration_18_team.sql); здесь — окно «Команда» и приём приглашения.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;
  var KEY = "ula_team_code";

  // ---------- Приём приглашения ----------
  // Запомнить код из ссылки (?team=…) и убрать его из адреса
  function captureFromUrl() {
    var code = new URLSearchParams(location.search).get("team");
    if (!code || !/^[a-f0-9]{32}$/i.test(code)) return false;
    try { localStorage.setItem(KEY, code.toLowerCase()); } catch (e) { /* без хранилища — не страшно */ }
    history.replaceState(null, "", location.pathname + location.hash);
    return true;
  }

  function pendingCode() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }

  function clearPending() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }

  // Принять приглашение после входа. Возвращает "ok" | "none" | текст ошибки (ключ перевода)
  async function acceptPending() {
    var code = pendingCode();
    if (!code) return "none";
    var res = await c.db().rpc("team_join", { p_code: code });
    clearPending();
    if (!res.error) return "ok";
    var m = String(res.error.message || "");
    if (/already_member/.test(m)) return "none";
    if (/has_own_data/.test(m)) return "tm_err_own";
    if (/team_full/.test(m)) return "tm_err_full";
    if (/admin_cannot_join/.test(m)) return "tm_err_admin";
    return "tm_err_invalid";
  }

  // ---------- Окно «Команда» (у владельца) ----------
  var data = { members: [], invites: [] };

  function inviteUrl(code) {
    return location.origin + location.pathname.replace(/index\.html$/, "") + "?team=" + code;
  }

  function fmtMember(m) {
    var who = m.full_name || "—";
    var tail = m.phone ? " · " + c.fmtPhone(m.phone) : "";
    return '<div class="tm-row"><div><b>' + esc(who) + "</b>" + esc(tail) +
      '<div class="muted">' + esc(t(m.role === "owner" ? "tm_role_owner" : "tm_role_staff")) + "</div></div>" +
      (m.role === "staff" ? '<button type="button" class="btn btn-danger btn-sm" data-tm-remove="' + esc(m.user_id) + '">' + esc(t("tm_remove")) + "</button>" : "") +
      "</div>";
  }

  function fmtInvite(i) {
    var url = inviteUrl(i.code);
    return '<div class="tm-row"><div><span class="muted">' + esc(t("tm_invite_until", { d: c.fmtDate(i.expires_at) })) + "</span>" +
      '<input class="link-input" type="text" readonly value="' + esc(url) + '"></div>' +
      '<div class="tm-actions">' +
        '<button type="button" class="btn btn-sm" data-tm-copy="' + esc(url) + '">' + esc(t("copy")) + "</button>" +
        '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t("tm_wa_text") + " " + url) + '">WhatsApp</a>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-tm-revoke="' + esc(i.code) + '">' + esc(t("tm_cancel")) + "</button>" +
      "</div></div>";
  }

  function render() {
    $("#tm-members").innerHTML = data.members.map(fmtMember).join("");
    $("#tm-invites").innerHTML = data.invites.map(fmtInvite).join("");
    $("#tm-invites-title").classList.toggle("hidden", !data.invites.length);
  }

  async function load() {
    if (!state.ws) return;
    $("#tm-members").innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>";
    var res = await c.db().rpc("team_list", { p_ws: state.ws.id });
    if (res.error) { c.handleError(res.error); return; }
    data = { members: res.data.members || [], invites: res.data.invites || [] };
    render();
  }

  async function createInvite() {
    var btn = $("#tm-create");
    btn.disabled = true;
    var res = await c.db().rpc("team_invite_create", { p_ws: state.ws.id });
    btn.disabled = false;
    if (res.error) {
      var m = String(res.error.message || "");
      if (/team_full/.test(m)) toast(t("tm_err_full"), "error");
      else if (/too_many_invites/.test(m)) toast(t("tm_err_many"), "error");
      else c.handleError(res.error);
      return;
    }
    await load();
    var ok = await c.copyText(inviteUrl(res.data));
    toast(ok ? t("tm_created_copied") : t("tm_created"), "ok");
  }

  async function removeMember(id) {
    if (!window.confirm(t("tm_confirm_remove"))) return;
    var res = await c.db().rpc("team_remove", { p_ws: state.ws.id, p_user: id });
    if (res.error) { c.handleError(res.error); return; }
    toast(t("tm_removed"), "ok");
    load();
  }

  async function revokeInvite(code) {
    var res = await c.db().rpc("team_invite_revoke", { p_ws: state.ws.id, p_code: code });
    if (res.error) { c.handleError(res.error); return; }
    load();
  }

  function open() {
    if (state.readOnly || !state.ws) return;
    c.openModal("modal-team");
    load();
  }

  function bind() {
    $("#team-btn").addEventListener("click", open);
    $("#tm-create").addEventListener("click", createInvite);
    $("#modal-team").addEventListener("click", async function (e) {
      var rm = e.target.closest("[data-tm-remove]");
      if (rm) return removeMember(rm.getAttribute("data-tm-remove"));
      var rv = e.target.closest("[data-tm-revoke]");
      if (rv) return revokeInvite(rv.getAttribute("data-tm-revoke"));
      var cp = e.target.closest("[data-tm-copy]");
      if (cp) {
        var ok = await c.copyText(cp.getAttribute("data-tm-copy"));
        toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
      }
    });
  }

  U.team = { bind: bind, captureFromUrl: captureFromUrl, pendingCode: pendingCode, acceptPending: acceptPending };
})(window.ULA);
