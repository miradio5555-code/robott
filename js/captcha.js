// =====================================================
// ULA FACTORY — капча при входе и регистрации (Cloudflare Turnstile).
//
// Нужна, чтобы боты не создавали кабинеты и не подбирали пароли. Обычному человеку почти не мешает:
// виджет невидим и показывается, только если Cloudflare сомневается.
// Включается так: в config.js вписать TURNSTILE_SITE_KEY (публичный ключ виджета), а в Supabase →
// Authentication → Attack Protection включить Captcha и вставить секретный ключ. Если ключ в config.js пустой,
// капчи нет и всё работает как раньше.
//   ULA.captcha.get("id-блока")  → Promise<строка-токен | null>; токен передаётся в signIn / signUp (captchaToken).
// Вынесено из app.js. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";

  var loading = null;

  function siteKey() {
    var cfg = window.CARGO_CONFIG || {};
    var k = String(cfg.TURNSTILE_SITE_KEY || "").trim();
    return /^[0-9A-Za-z_-]{10,}$/.test(k) ? k : "";
  }

  function enabled() { return !!siteKey(); }

  function loadApi() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = function () { resolve(window.turnstile); };
      s.onerror = function () { loading = null; reject(new Error("turnstile_load")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // Получить токен. Если капча выключена — null (вызывающий код просто не передаёт токен).
  // Если не удалось (нет интернета, закрыли проверку) — ошибка "captcha_failed".
  function get(containerId) {
    if (!enabled()) return Promise.resolve(null);
    var box = document.getElementById(containerId);
    if (!box) return Promise.resolve(null);
    return loadApi().then(function (ts) {
      return new Promise(function (resolve, reject) {
        box.innerHTML = "";
        box.classList.remove("hidden");
        var done = false, id;
        function finish(fn, v) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { ts.remove(id); } catch (e) { /* ignore */ }
          box.innerHTML = "";
          box.classList.add("hidden");
          fn(v);
        }
        var timer = setTimeout(function () { finish(reject, new Error("captcha_failed")); }, 60000);
        id = ts.render(box, {
          sitekey: siteKey(),
          appearance: "interaction-only",   // виден только если нужна проверка
          callback: function (token) { finish(resolve, token); },
          "error-callback": function () { finish(reject, new Error("captcha_failed")); },
          "timeout-callback": function () { finish(reject, new Error("captcha_failed")); }
        });
      });
    }).catch(function () { throw new Error("captcha_failed"); });
  }

  U.captcha = { enabled: enabled, get: get };
})(window.ULA = window.ULA || {});
