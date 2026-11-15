// =====================================================
// ULA FACTORY — запускается в <head> до отрисовки страницы (вынесено из index.html,
// чтобы правило безопасности CSP могло запретить любые встроенные скрипты).
//   • тема: выбор человека "light", "dark" или "auto" (как в системе) хранится в cc_theme;
//     на странице всегда стоит готовая тема html[data-theme="light|dark"] — стили описывают
//     тёмную тему один раз, а «Авто» следит за системой и переключается без перезагрузки;
//   • защита от «кликджекинга»: сайт нельзя открыть внутри чужой страницы (в рамке).
// =====================================================
(function () {
  "use strict";
  if (window.top !== window.self) {
    try { window.top.location.replace(window.location.href); }
    catch (e) { document.documentElement.style.display = "none"; }
  }
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var pref = "auto";

  function resolve() {
    var dark = pref === "dark" || (pref === "auto" && !!(mq && mq.matches));
    root.setAttribute("data-theme", dark ? "dark" : "light");
    root.setAttribute("data-theme-pref", pref);
    // цвет строки состояния телефона — как фон шапки темы
    var mt = document.querySelector('meta[name="theme-color"]');
    if (mt) mt.setAttribute("content", dark ? "#111216" : "#FFFFFF");
    return dark;
  }

  // Общая точка для app.js и profile.js: ULA_THEME.set("dark"), ULA_THEME.isDark()
  window.ULA_THEME = {
    set: function (th) {
      pref = th === "light" || th === "dark" ? th : "auto";
      try { localStorage.setItem("cc_theme", pref); } catch (e) { /* ignore */ }
      return resolve();
    },
    get: function () { return pref; },
    isDark: function () { return root.getAttribute("data-theme") === "dark"; }
  };

  try {
    var th = localStorage.getItem("cc_theme");
    if (th === "light" || th === "dark") pref = th;
  } catch (e) { /* ignore */ }
  resolve();
  if (mq) {
    var onSys = function () { if (pref === "auto") resolve(); };
    if (mq.addEventListener) mq.addEventListener("change", onSys); else if (mq.addListener) mq.addListener(onSys);
  }

  try {
    // внешний вид из «Профиля»: цвет кнопок, размер текста, стиль углов
    [["ula_accent", "data-accent", "ula"], ["ula_tsize", "data-tsize", "m"], ["ula_ui", "data-ui", "rounded"]].forEach(function (x) {
      var v = localStorage.getItem(x[0]);
      if (v && v !== x[2] && /^[a-z]{1,10}$/.test(v)) root.setAttribute(x[1], v);
    });
  } catch (e) { /* ignore */ }
})();
