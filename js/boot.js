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
