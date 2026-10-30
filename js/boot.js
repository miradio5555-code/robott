// =====================================================
// ULA FACTORY — если сайт не открылся (старый браузер, встроенный браузер мессенджера),
// вместо белого экрана показать подсказку. Вынесено из index.html (правило безопасности CSP).
// =====================================================
(function () {
  "use strict";
  function fail() {
    var b = document.getElementById("boot");
    if (!b) return; // сайт уже открылся
    document.getElementById("boot-text").innerHTML =
      "Страница не открылась в этом браузере.<br>Откройте ссылку в <b>Chrome</b> или <b>Safari</b>: " +
      "нажмите ⋮ или ••• вверху → «Открыть в браузере».<br><br>" +
      "This page did not open in this browser. Please open the link in Chrome or Safari.";
  }
  window.addEventListener("error", function () { setTimeout(fail, 300); });
  setTimeout(fail, 12000);
})();

// Заставка со знаком при входе в кабинет: один раз за сессию, нажатие — пропустить.
(function () {
  "use strict";
  var el = document.getElementById("intro");
  if (!el) return;
  var seen = false;
  try { seen = sessionStorage.getItem("ula_intro") === "1"; sessionStorage.setItem("ula_intro", "1"); } catch (e) {}
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // на страницах для клиентов (витрина, заказ, заявка) заставку не показываем
  var pub = /[?&](order|c|shop|xr|fx|request)=/.test(location.search);
  // когда знак «пролетает» и фон растворяется — сообщить сайту, чтобы блоки «выехали» (app.js, showView)
  var opened = false;
  function open() {
    if (opened) return;
    opened = true;
    el.classList.remove("play-on");
    document.dispatchEvent(new Event("ula-intro-done"));
  }
  function done() { open(); if (el.parentNode) el.parentNode.removeChild(el); }
  if (seen || calm || pub) { done(); return; }
  el.classList.add("play", "play-on");
  el.addEventListener("click", done);
  setTimeout(open, 1850);
  setTimeout(done, 2600);
})();
