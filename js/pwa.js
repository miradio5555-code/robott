// =====================================================
// ULA FACTORY — включает «приложение» (sw.js): сайт открывается сразу из памяти телефона.
// Когда вышла новая версия сайта, внизу появляется плашка «Вышло обновление → Обновить».
// Подключается после app.js.
// =====================================================
(function () {
  "use strict";
  if (!("serviceWorker" in navigator) || (location.protocol !== "https:" && location.hostname !== "localhost")) return;

  function tr(k, fb) { try { var s = window.t(k); return s && s !== k ? s : fb; } catch (e) { return fb; } }

  function banner() {
    if (document.getElementById("pwa-update")) return;
    var b = document.createElement("div");
    b.id = "pwa-update";
    b.className = "pwa-update";
    b.setAttribute("role", "status");
    var s = document.createElement("span");
    s.textContent = tr("pwa_update", "Вышло обновление сайта");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-light btn-sm";
    btn.textContent = tr("pwa_reload", "Обновить");
    btn.addEventListener("click", function () { location.reload(); });
    b.appendChild(s);
    b.appendChild(btn);
    document.body.appendChild(b);
  }

  navigator.serviceWorker.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ula-update") banner();
  });

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () { /* без «приложения» сайт работает как обычно */ });
  });
})();
