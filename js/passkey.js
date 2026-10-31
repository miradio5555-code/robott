// =====================================================
// ULA FACTORY — вход по Face ID / Touch ID / отпечатку (ключ доступа, passkey).
//
// Встроено в Supabase Auth (бета с мая 2026): ключ хранится в телефоне (iCloud-связка, Google),
// сервер Supabase проверяет подпись — это настоящий вход без пароля, а не «замок на экране».
//   • Настройки → «Вход по Face ID» → «Добавить»: телефон спрашивает Face ID, ключ создан.
//   • Экран входа: на устройстве, где ключ уже есть, — кнопка «Войти по Face ID».
// Включается один раз в Supabase: Authentication → Passkeys. Пока выключено — кнопок не видно.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;
  var KEY = "ula_passkey";   // на этом устройстве есть ключ — показываем кнопку на экране входа
  var st = { list: [], off: false, busy: false };

  function supported() { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get); }
  function has() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function mark(on) { try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }

  // как называется биометрия на этом устройстве
  function kind() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Macintosh/.test(ua)) return "apple";
    if (/Android/.test(ua)) return "android";
    if (/Windows/.test(ua)) return "windows";
    return "other";
  }
  function btnText() { return t("pk_login_" + kind()); }

  function isOff(e) { return !!e && (e.code === "passkey_disabled" || /passkey_disabled|passkeys are disabled/i.test(String(e.message || e.msg || ""))); }
  function isCancel(e) { return !!e && /NotAllowed|AbortError|cancel|ceremony failed|timed out/i.test(String((e.name || "") + " " + (e.message || ""))); }

  // ---------- Экран входа ----------
  function renderLogin() {
    var b = $("#pk-login");
    if (!b) return;
    b.classList.toggle("hidden", !supported() || !has());
    $("#pk-login-text").textContent = btnText();
  }
  function loginError(msg) {
    var el = $("#login-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }
  async function login() {
    if (st.busy) return;
    st.busy = true;
    var b = $("#pk-login");
    b.disabled = true;
    loginError("");
    try {
      var r = await c.db().auth.signInWithPasskey();
      if (r.error) {
        if (isOff(r.error)) { mark(false); renderLogin(); loginError(t("pk_err_off")); }
        else if (!isCancel(r.error)) loginError(t("pk_err_login"));
        return;
      }
      var u = (await c.db().auth.getUser()).data.user;
      if (u) await c.enterAdmin(u);
    } catch (e) {
      if (!isCancel(e)) { console.error(e); loginError(t("pk_err_login")); }
    } finally {
      st.busy = false;
      b.disabled = false;
    }
  }

  // ---------- Настройки ----------
  function setError(msg) {
    var el = $("#pk-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }
  function render() {
    var box = $("#pk-list"), add = $("#pk-add"), note = $("#pk-note");
    add.textContent = t("pk_add_" + kind());
    if (!supported()) { note.textContent = t("pk_unsupported"); add.classList.add("hidden"); box.innerHTML = ""; return; }
    if (st.off) {
      note.textContent = t(state.me && state.me.role === "admin" ? "pk_off_admin" : "pk_off");
      add.classList.add("hidden"); box.innerHTML = ""; return;
    }
    note.textContent = st.list.length ? "" : t("pk_none");
    add.classList.remove("hidden");
    box.innerHTML = st.list.map(function (p) {
      var name = p.friendly_name || p.name || t("pk_noname");
      var when = [p.created_at ? t("pk_created", { d: c.fmtDate(p.created_at) }) : "", p.last_used_at ? t("pk_used", { d: c.fmtTime(p.last_used_at) }) : ""].filter(Boolean).join(" · ");
      return '<div class="pk-row"><span class="pk-ico" aria-hidden="true">🔐</span><div class="pk-txt"><b>' + esc(name) + "</b><small>" + esc(when) + "</small></div>" +
        '<button type="button" class="btn btn-ghost btn-sm" data-pk-del="' + esc(p.id) + '">' + esc(t("pk_delete")) + "</button></div>";
    }).join("");
  }
  async function refresh() {
    setError("");
    if (!supported()) { render(); return; }
    try {
      var r = await c.db().auth.passkey.list();
      st.off = isOff(r.error);
      st.list = r.error ? [] : (Array.isArray(r.data) ? r.data : (r.data && (r.data.passkeys || r.data.items)) || []);
      if (r.error && !st.off) setError(t("error_generic"));
    } catch (e) { st.off = isOff(e); st.list = []; }
    render();
  }
  async function add() {
    if (st.busy) return;
    st.busy = true;
    setError("");
    $("#pk-add").disabled = true;
    try {
      var r = await c.db().auth.registerPasskey();
      if (r.error) {
        if (isOff(r.error)) { st.off = true; render(); }
        else if (/exist|already|excluded|InvalidState/i.test(String((r.error.name || "") + (r.error.message || "")))) setError(t("pk_err_exists"));
        else if (!isCancel(r.error)) setError(t("pk_err_add"));
        return;
      }
      mark(true);
      // имя ключа — устройство, на котором он создан: «iPhone · iOS 18 · Safari»
      var id = r.data && (r.data.id || (r.data.passkey && r.data.passkey.id));
      var name = U.device && U.device.name ? U.device.name() : "";
      if (id && name) { try { await c.db().auth.passkey.update({ passkeyId: id, friendlyName: name.slice(0, 60) }); } catch (e) { /* без имени */ } }
      toast(t("pk_added"), "ok");
      await refresh();
    } catch (e) {
      if (!isCancel(e)) { console.error(e); setError(t("pk_err_add")); }
    } finally {
      st.busy = false;
      $("#pk-add").disabled = false;
    }
  }
  async function del(id) {
    if (!confirm(t("pk_delete_confirm"))) return;
    var r = await c.db().auth.passkey.delete({ passkeyId: id });
    if (r.error) { setError(t("error_generic")); return; }
    toast(t("pk_deleted"), "ok");
    await refresh();
    if (!st.list.length) mark(false);
  }

  function bind() {
    $("#pk-login").addEventListener("click", login);
    $("#pk-add").addEventListener("click", add);
    $("#pk-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-pk-del]");
      if (b) del(b.getAttribute("data-pk-del"));
    });
    renderLogin();
  }

  U.passkey = { bind: bind, refresh: refresh, renderLogin: renderLogin };
})(window.ULA);
