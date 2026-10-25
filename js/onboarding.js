// =====================================================
// ULA FACTORY — подсказка для нового байера: «Начните с 4 шагов».
//
// Показывается владельцу вверху страницы заказов, пока не выполнены шаги:
//   1) указать адрес склада в Китае;  2) поставить свои курсы;
//   3) создать ссылку для заявок;     4) добавить первый заказ.
// Каждый шаг — кнопка, которая сразу открывает нужное место. Когда всё сделано, карточка исчезает сама.
// «Скрыть» запоминается в браузере. Вынесено из app.js; общие помощники — из window.ULA.core.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state;

  function key() { return "ula_onboard_hide_" + (state.ws ? state.ws.id : ""); }
  function hidden() { try { return localStorage.getItem(key()) === "1"; } catch (e) { return false; } }

  function steps() {
    var ws = state.ws || {};
    return [
      { id: "wh", done: !!String(ws.warehouse_address || "").trim(), text: t("ob_wh") },
      { id: "rates", done: !!ws.custom_rates && Object.keys(ws.custom_rates).length > 0, text: t("ob_rates") },
      { id: "link", done: !!ws.request_token, text: t("ob_link") },
      { id: "order", done: (state.orders || []).length > 0, text: t("ob_order") },
      { id: "import", done: (state.orders || []).length >= 5, text: t("ob_import") }
    ];
  }

  function refresh() {
    var box = $("#onboard-card");
    if (!box) return;
    var mine = state.ws && state.myWs && state.myWs.id === state.ws.id && !state.readOnly && state.myRole !== "staff";
    var list = mine ? steps() : [];
    var left = list.filter(function (s) { return !s.done; }).length;
    if (!mine || !left || hidden() || state.loading) { box.classList.add("hidden"); box.innerHTML = ""; return; }
    box.classList.remove("hidden");
    box.innerHTML = '<div class="ob-head"><h2>' + esc(t("ob_title")) + '</h2><span>' + esc(t("ob_progress", { a: list.length - left, b: list.length })) + "</span></div>" +
      '<div class="ob-bar"><i style="width:' + Math.round((list.length - left) / list.length * 100) + '%"></i></div>' +
      list.map(function (s) {
        return '<button type="button" class="ob-step' + (s.done ? " done" : "") + '" data-ob="' + s.id + '"' + (s.done ? " disabled" : "") + '><b>' +
          (s.done ? U.icon("check", 13) : "") + "</b><span>" + esc(s.text) + "</span>" + (s.done ? "" : "<i>›</i>") + "</button>";
      }).join("") +
      '<button type="button" class="btn btn-ghost btn-sm ob-hide" data-ob="hide">' + esc(t("ob_hide")) + "</button>";
  }

  function run(id) {
    if (id === "hide") {
      try { localStorage.setItem(key(), "1"); } catch (e) { /* ignore */ }
      refresh();
    } else if (id === "wh") {
      $("#wh-edit").click();
    } else if (id === "rates") {
      c.switchTab("quote");
      var d = document.querySelector(".quote-rates");
      if (d) { d.open = true; d.scrollIntoView({ block: "center" }); }
    } else if (id === "link") {
      U.requests.openLink();
    } else if (id === "order") {
      $("#new-order").click();
    } else if (id === "import") {
      U.importer.open();
    }
  }

  function bind() {
    $("#onboard-card").addEventListener("click", function (e) {
      var b = e.target.closest("[data-ob]");
      if (b && !b.disabled) run(b.getAttribute("data-ob"));
    });
  }

  U.onboarding = { bind: bind, refresh: refresh };
})(window.ULA);
