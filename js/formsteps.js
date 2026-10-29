// =====================================================
// ULA FACTORY — формы шагами: «1 Клиент → 2 Товар → 3 Цена товара → …».
//
// Блок формы с классом .fstep — карточка с кружком-номером. Когда главное поле шага заполнено,
// кружок становится зелёной галочкой, а справа в заголовке появляется короткий итог шага
// (сумма, имя клиента, число заказов). Так сразу видно, что уже сделано и что осталось.
// Правила для каждой формы — ниже, в RULES. Значения формы сайт подставляет сам (без событий),
// поэтому, кроме ввода, следим за изменениями внутри формы (итоги расчёта меняются при каждом пересчёте).
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, parseNum = c.parseNum;

  function val(id) { var el = $("#" + id); return el ? String(el.value || "").trim() : ""; }
  function pos(id) { return (parseNum(val(id)) || 0) > 0; }
  function count(id, sel) { var el = $("#" + id); return el ? el.querySelectorAll(sel).length : 0; }

  // шаг → { done, sum }
  var RULES = {
    "order-form": {
      client: function () { return { done: !!val("f-client_name"), sum: val("f-client_name") }; },
      product: function () { return { done: !!val("f-product_ru"), sum: "" }; },
      // итог шага коротко: «240 CNY», «3 кг», «5 000 KGS»
      goods: function () {
        var d = pos("f-unit_price_cny");
        return { done: d, sum: d ? c.money((parseNum(val("f-quantity")) || 1) * parseNum(val("f-unit_price_cny"))) + " " + (val("f-purchase_currency") || "CNY") : "" };
      },
      delivery: function () {
        var w = pos("f-weight_kg");
        return { done: w || pos("f-delivery_cost"), sum: w ? c.money(parseNum(val("f-weight_kg"))) + " " + t("kg") : "" };
      },
      price: function () { var d = pos("f-client_price"); return { done: d, sum: d ? c.money(parseNum(val("f-client_price"))) + " " + val("f-client_currency") : "" }; },
      photos: function () { var n = count("photo-previews", ".pv"); return { done: n > 0, sum: n ? String(n) : "" }; }
    },
    "modal-shipment": {
      "sh-main": function () { return { done: !!val("sh-name"), sum: "" }; },
      "sh-cost": function () { var d = pos("sh-total") || (pos("sh-weight") && pos("sh-tariff")); return { done: d, sum: "" }; },
      "sh-orders": function () { var n = count("sh-orders", ".sh-order"); return { done: n > 0, sum: n ? String(n) : "" }; }
    },
    "product-form": {
      "pr-photo": function () { return { done: !!($("#pr-preview") && $("#pr-preview").querySelector("img")), sum: "" }; },
      "pr-main": function () { return { done: !!val("pr-title"), sum: pos("pr-price") ? val("pr-price") + " " + val("pr-currency") : "" }; },
      "pr-desc": function () { return { done: !!val("pr-desc"), sum: "" }; }
    }
  };

  function update(root, rules) {
    Array.prototype.forEach.call(root.querySelectorAll(".fstep[data-fs]"), function (st) {
      var fn = rules[st.getAttribute("data-fs")];
      if (!fn) return;
      var r = fn(), sum = st.querySelector("[data-fs-sum]");
      // записываем только перемены — иначе наблюдатель за формой будет срабатывать по кругу
      if (st.classList.contains("done") !== !!r.done) st.classList.toggle("done", !!r.done);
      if (sum && sum.textContent !== (r.sum || "")) sum.textContent = r.sum || "";
    });
  }

  function watch(id, rules) {
    var root = document.getElementById(id);
    if (!root) return;
    var queued = false;
    function later() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; update(root, rules); });
    }
    root.addEventListener("input", later);
    root.addEventListener("change", later);
    new MutationObserver(later).observe(root, { subtree: true, childList: true, characterData: true });
    // окно открылось — значения уже подставлены
    var modal = root.closest(".modal");
    if (modal) new MutationObserver(later).observe(modal, { attributes: true, attributeFilter: ["class"] });
    later();
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll(".fstep-ico[data-ico]"), function (el) {
      el.innerHTML = U.icon(el.getAttribute("data-ico"), 18);
    });
    Object.keys(RULES).forEach(function (id) { watch(id, RULES[id]); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window.ULA);
