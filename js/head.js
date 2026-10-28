// =====================================================
// ULA FACTORY — запускается в <head> до отрисовки страницы (вынесено из index.html,
// чтобы правило безопасности CSP могло запретить любые встроенные скрипты).
//   • тема: "light", "dark" или "auto" (как в системе);
//   • шрифты Google грузятся «в фоне»: если Google Fonts недоступен (например, в Китае),
//     сайт сразу покажется со шрифтами системы и не будет ждать;
//   • защита от «кликджекинга»: сайт нельзя открыть внутри чужой страницы (в рамке).
// =====================================================
(function () {
  "use strict";
  if (window.top !== window.self) {
    try { window.top.location.replace(window.location.href); }
    catch (e) { document.documentElement.style.display = "none"; }
  }
  try {
    var th = localStorage.getItem("cc_theme");
    if (th === "light" || th === "dark") document.documentElement.setAttribute("data-theme", th);
  } catch (e) { /* ignore */ }
  var l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&family=Unbounded:wght@600&display=swap";
  document.head.appendChild(l);
})();
