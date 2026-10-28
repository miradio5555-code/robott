// =====================================================
// ULA FACTORY — запускается в <head> до отрисовки страницы (вынесено из index.html,
// чтобы правило безопасности CSP могло запретить любые встроенные скрипты).
//   • тема: "light", "dark" или "auto" (как в системе);
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
    // внешний вид из «Профиля»: цвет кнопок, размер текста, стиль углов
    [["ula_accent", "data-accent", "ula"], ["ula_tsize", "data-tsize", "m"], ["ula_ui", "data-ui", "rounded"]].forEach(function (x) {
      var v = localStorage.getItem(x[0]);
      if (v && v !== x[2] && /^[a-z]{1,10}$/.test(v)) document.documentElement.setAttribute(x[1], v);
    });
  } catch (e) { /* ignore */ }
})();
