// =====================================================
// ULA FACTORY — «Забыли пароль?»
//
// 1) На странице входа ссылка «Забыли пароль?» → вводите почту → на неё приходит письмо со ссылкой.
// 2) Ссылка открывает сайт в режиме восстановления: окно «Придумайте новый пароль» (два раза, чтобы не ошибиться).
// После этого вы сразу входите в кабинет. Письмо рассылает Supabase (нужно, чтобы адрес сайта был в Authentication → URL Configuration).
// Вынесено из app.js. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, toast = c.toast;

  // Открыли ссылку из письма? (в адресе есть type=recovery)
  var fromEmail = /[#&?]type=recovery\b/.test(location.hash + location.search);

  function isRecoveryLink() { return fromEmail; }

  function open() {
    $("#reset-email").value = $("#login-email").value.trim();
    $("#reset-msg").classList.add("hidden");
    $("#reset-error").classList.add("hidden");
    $("#reset-send").disabled = false;
    c.openModal("modal-reset");
    $("#reset-email").focus();
  }

  async function send(e) {
    e.preventDefault();
    var email = $("#reset-email").value.trim();
    var err = $("#reset-error");
    err.classList.add("hidden");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = t("e_email"); err.classList.remove("hidden"); return; }
    var btn = $("#reset-send");
    btn.disabled = true;
    try {
      var tok = await U.captcha.get("cf-reset");
      var res = await c.db().auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname,
        captchaToken: tok || undefined
      });
      if (res.error && /rate|seconds|limit/i.test(res.error.message || "")) {
        err.textContent = t("reset_wait"); err.classList.remove("hidden"); btn.disabled = false; return;
      }
      // одинаковый ответ в любом случае: нельзя узнать, зарегистрирован ли адрес
      $("#reset-msg").textContent = t("reset_sent", { e: email });
      $("#reset-msg").classList.remove("hidden");
    } catch (x) {
      err.textContent = /captcha/i.test(String(x && x.message)) ? t("captcha_err") : t("error_generic");
      err.classList.remove("hidden");
      btn.disabled = false;
    }
  }

  // Окно «новый пароль» после перехода по ссылке из письма. Возвращает true, если пароль сменили.
  function newPassword() {
    $("#np-pass").value = ""; $("#np-pass2").value = "";
    $("#np-error").classList.add("hidden");
    c.openModal("modal-newpass");
    $("#np-pass").focus();
    return new Promise(function (resolve) {
      var form = $("#newpass-form");
      async function onSubmit(e) {
        e.preventDefault();
        var p1 = $("#np-pass").value, p2 = $("#np-pass2").value, err = $("#np-error");
        function bad(k) { err.textContent = t(k); err.classList.remove("hidden"); }
        if (p1.length < 8) return bad("e_password");
        if (p1 !== p2) return bad("e_password_match");
        var btn = $("#np-save");
        btn.disabled = true;
        try {
          var res = await c.db().auth.updateUser({ password: p1 });
          if (res.error) { bad("error_generic"); return; }
          form.removeEventListener("submit", onSubmit);
          c.closeModal("modal-newpass");
          history.replaceState(null, "", location.pathname);
          fromEmail = false;
          toast(t("password_changed"), "ok");
          resolve(true);
        } finally {
          btn.disabled = false;
        }
      }
      form.addEventListener("submit", onSubmit);
    });
  }

  function bind() {
    $("#forgot-link").addEventListener("click", function (e) { e.preventDefault(); open(); });
    $("#reset-form").addEventListener("submit", send);
  }

  U.recovery = { bind: bind, isRecoveryLink: isRecoveryLink, newPassword: newPassword };
})(window.ULA);
