// =====================================================
// ULA FACTORY — вход с кодом из телефона (двухфакторная защита, 2FA).
//
// После пароля сайт просит 6-значный код из приложения-аутентификатора (Google Authenticator, Authy, 1Password…).
// Включается в Настройках → «Вход с кодом». Для администратора настоятельно рекомендуется: когда код
// включён, база (migration_21_admin_2fa.sql) считает админом только ту сессию, где код введён.
// Использует встроенную защиту Supabase (TOTP). Вынесено из app.js. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;
  var st = { enabled: false, factorId: "", enroll: null, busy: false };

  function mfa() { return c.db().auth.mfa; }

  function cleanCode(v) { return String(v || "").replace(/\D/g, "").slice(0, 6); }

  // ---------- Вход: запросить код, если он включён ----------
  // Возвращает true, если можно продолжать (код не нужен или введён), false — если вышли.
  async function gate() {
    var aal;
    try { aal = await mfa().getAuthenticatorAssuranceLevel(); } catch (e) { return true; }
    var d = aal && aal.data;
    if (!d || d.nextLevel !== "aal2" || d.currentLevel === "aal2") return true;

    $("#mfa-login-code").value = "";
    setLoginError("");
    c.openModal("modal-mfa");
    $("#mfa-login-code").focus();
    return new Promise(function (resolve) {
      function done(ok) {
        $("#mfa-login-form").removeEventListener("submit", onSubmit);
        $("#mfa-login-out").removeEventListener("click", onOut);
        c.closeModal("modal-mfa");
        resolve(ok);
      }
      async function onSubmit(e) {
        e.preventDefault();
        var code = cleanCode($("#mfa-login-code").value);
        if (code.length !== 6) { setLoginError(t("mfa_err_code")); return; }
        var btn = $("#mfa-login-btn");
        btn.disabled = true;
        try {
          var list = await mfa().listFactors();
          var f = list.data && list.data.totp && list.data.totp[0];
          if (!f) { setLoginError(t("error_generic")); return; }
          var res = await mfa().challengeAndVerify({ factorId: f.id, code: code });
          if (res.error) { setLoginError(t("mfa_err_wrong")); $("#mfa-login-code").select(); return; }
          done(true);
        } finally {
          btn.disabled = false;
        }
      }
      async function onOut() {
        await c.db().auth.signOut();
        done(false);
      }
      $("#mfa-login-form").addEventListener("submit", onSubmit);
      $("#mfa-login-out").addEventListener("click", onOut);
    });
  }

  function setLoginError(msg) {
    var el = $("#mfa-login-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  // ---------- Настройки ----------
  function render() {
    var setup = !!st.enroll;
    $("#mfa-state").textContent = t(st.enabled ? "mfa_on" : "mfa_off");
    $("#mfa-start").classList.toggle("hidden", st.enabled || setup);
    $("#mfa-off").classList.toggle("hidden", !st.enabled);
    $("#mfa-setup").classList.toggle("hidden", !setup);
    if (setup) {
      $("#mfa-qr").src = st.enroll.qr;
      $("#mfa-secret").textContent = st.enroll.secret;
      $("#mfa-setup-error").classList.add("hidden");
    }
  }

  async function refresh() {
    try {
      var list = await mfa().listFactors();
      var f = list.data && list.data.totp || [];
      st.enabled = f.length > 0;
      st.factorId = f[0] ? f[0].id : "";
    } catch (e) { st.enabled = false; }
    render();
    banner();
  }

  async function start() {
    var btn = $("#mfa-start");
    btn.disabled = true;
    try {
      // убираем недоделанные прошлые попытки
      var all = await mfa().listFactors();
      var old = (all.data && all.data.all || []).filter(function (f) { return f.status !== "verified"; });
      for (var i = 0; i < old.length; i++) { await mfa().unenroll({ factorId: old[i].id }); }
      var res = await mfa().enroll({ factorType: "totp", friendlyName: "ULA " + Date.now() });
      if (res.error) { c.handleError(res.error); return; }
      st.enroll = { id: res.data.id, qr: res.data.totp.qr_code, secret: res.data.totp.secret };
      $("#mfa-code").value = "";
      render();
      $("#mfa-code").focus();
    } finally {
      btn.disabled = false;
    }
  }

  async function confirm() {
    var code = cleanCode($("#mfa-code").value);
    var err = $("#mfa-setup-error");
    if (code.length !== 6) { err.textContent = t("mfa_err_code"); err.classList.remove("hidden"); return; }
    var btn = $("#mfa-confirm");
    btn.disabled = true;
    try {
      var res = await mfa().challengeAndVerify({ factorId: st.enroll.id, code: code });
      if (res.error) { err.textContent = t("mfa_err_wrong"); err.classList.remove("hidden"); return; }
      st.enroll = null;
      toast(t("mfa_done"), "ok");
      await refresh();
    } finally {
      btn.disabled = false;
    }
  }

  async function cancelSetup() {
    if (st.enroll) { try { await mfa().unenroll({ factorId: st.enroll.id }); } catch (e) { /* ignore */ } }
    st.enroll = null;
    render();
  }

  // Отключить можно только с новым кодом из телефона: так забытый открытый телефон или украденный пароль не снимут защиту
  function disable() {
    $("#mfa-off-code").value = "";
    $("#mfa-off-error").classList.add("hidden");
    $("#mfa-offbox").classList.remove("hidden");
    $("#mfa-off").classList.add("hidden");
    $("#mfa-off-code").focus();
  }

  function cancelDisable() {
    $("#mfa-offbox").classList.add("hidden");
    render();
  }

  async function confirmDisable() {
    var err = $("#mfa-off-error"), code = cleanCode($("#mfa-off-code").value);
    if (code.length !== 6) { err.textContent = t("mfa_err_code"); err.classList.remove("hidden"); return; }
    var btn = $("#mfa-off-confirm");
    btn.disabled = true;
    try {
      var ver = await mfa().challengeAndVerify({ factorId: st.factorId, code: code });
      if (ver.error) { err.textContent = t("mfa_err_wrong"); err.classList.remove("hidden"); $("#mfa-off-code").select(); return; }
      var res = await mfa().unenroll({ factorId: st.factorId });
      if (res.error) { c.handleError(res.error); return; }
      $("#mfa-offbox").classList.add("hidden");
      toast(t("mfa_off_done"), "ok");
      await refresh();
    } finally {
      btn.disabled = false;
    }
  }

  // Напоминание администратору: «Включите вход с кодом»
  function banner() {
    var b = $("#mfa-banner");
    if (!b) return;
    b.classList.toggle("hidden", !(state.me && state.me.role === "admin" && !st.enabled));
  }

  function bind() {
    $("#mfa-start").addEventListener("click", start);
    $("#mfa-confirm").addEventListener("click", confirm);
    $("#mfa-cancel").addEventListener("click", cancelSetup);
    $("#mfa-off").addEventListener("click", disable);
    $("#mfa-off-confirm").addEventListener("click", confirmDisable);
    $("#mfa-off-cancel").addEventListener("click", cancelDisable);
    $("#mfa-off-code").addEventListener("input", function (e) { e.target.value = cleanCode(e.target.value); });
    $("#mfa-banner-btn").addEventListener("click", function () { $("#settings-btn").click(); });
    $("#mfa-code").addEventListener("input", function (e) { e.target.value = cleanCode(e.target.value); });
    $("#mfa-login-code").addEventListener("input", function (e) { e.target.value = cleanCode(e.target.value); });
    $("#mfa-secret").addEventListener("click", async function () {
      var ok = await c.copyText($("#mfa-secret").textContent);
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
  }

  U.mfa = { bind: bind, gate: gate, refresh: refresh };
})(window.ULA);
