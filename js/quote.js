// =====================================================
// ULA FACTORY — «Расчёт цены для клиента».
// Клиент прислал ссылку с 1688 и спрашивает «сколько будет?»:
// вписали цену, вес и тариф карго → получили себестоимость, цену для клиента
// с вашей наценкой, прибыль и готовый текст ответа клиенту.
// Из расчёта в один клик создаётся заказ.
//
// В текст ответа попадает только цена для клиента (без себестоимости и прибыли).
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js и js/fx.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, toast = c.toast, money = c.money, parseNum = c.parseNum, numStr = c.numStr,
      fillCurrencySelect = c.fillCurrencySelect, state = c.state;

  var PREF_KEY = "cc_quote";        // наценка, округление и способ указания веса — запоминаем
  var LANG_KEY = "cc_notify_lang";  // язык ответа клиенту (общий с «Сообщить клиенту»)
  var ROUND_STEPS = [0, 10, 50, 100];

  var qs = {
    wsId: null,          // для какого кабинета заполнены поля
    wmode: "total",      // вес указан «за всё» (total) или «за 1 шт» (unit)
    lang: "ru",
    msgEdited: false,    // байер поправил текст вручную — не перезаписываем
    touched: { r: false, d: false },   // курс вписан вручную — не подменяем
    market: { r: false, d: false },    // в поле стоит рыночный курс (не свой)
    result: null,
    inView: false        // блок «Результат» сейчас на экране
  };

  // ---------- Тексты ответа клиенту ----------
  var TXT = {
    ru: {
      hello: "Здравствуйте!",
      what: function (p) { return p ? "«" + p + "»" : "заказа"; },
      many: function (w, price, q, unit) { return "Стоимость " + w + ": " + price + " за " + q + " шт (" + unit + " за 1 шт)."; },
      one: function (w, price) { return "Стоимость " + w + ": " + price + "."; },
      tail: "Цена с учётом доставки из Китая. Если всё устраивает — оформляем заказ."
    },
    en: {
      hello: "Hello!",
      what: function (p) { return p ? "\"" + p + "\"" : "your order"; },
      many: function (w, price, q, unit) { return "Price for " + w + ": " + price + " for " + q + " pcs (" + unit + " each)."; },
      one: function (w, price) { return "Price for " + w + ": " + price + "."; },
      tail: "The price includes delivery from China. If it works for you, we will place the order."
    },
    zh: {
      hello: "您好！",
      what: function (p) { return p || "您的订单"; },
      many: function (w, price, q, unit) { return w + "的价格：" + q + "件共" + price + "（每件" + unit + "）。"; },
      one: function (w, price) { return w + "的价格：" + price + "。"; },
      tail: "价格含从中国发货的运费。如无问题，我们就下单。"
    }
  };

  // ---------- Запоминаем настройки ----------
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        markup: $("#q-markup").value.trim(), round: $("#q-round").value, wmode: qs.wmode
      }));
    } catch (e) { /* ignore */ }
  }
  function msgLang() {
    try { var l = localStorage.getItem(LANG_KEY); if (TXT[l]) return l; } catch (e) { /* ignore */ }
    return "ru";
  }

  // ---------- Курсы ----------
  // Свой курс (из «Мои курсы» или последний из заказа). Нет — рыночный, только для подсказки.
  function defaultRate(a, b) {
    if (a === b) return { value: "1", market: false };
    var own = c.lastRateFor(a, b);
    if (own) return { value: own, market: false };
    var m = U.fx.market(a, b);
    return m ? { value: String(Math.round(m * 100) / 100), market: true } : { value: "", market: false };
  }

  function setRate(which, force) {
    if (qs.touched[which] && !force) return;
    var a, b;
    if (which === "r") { a = $("#q-pcur").value; b = $("#q-ccur").value; }
    else { a = $("#q-dcur").value; b = $("#q-ccur").value; }
    var d = defaultRate(a, b);
    $(which === "r" ? "#q-rate" : "#q-drate").value = d.value;
    qs.market[which] = d.market;
    if (force) qs.touched[which] = false;
  }

  function same(which) {
    return which === "r" ? $("#q-pcur").value === $("#q-ccur").value : $("#q-dcur").value === $("#q-ccur").value;
  }

  // ---------- Расчёт ----------
  function compute() {
    var a = $("#q-pcur").value, b = $("#q-ccur").value, dc = $("#q-dcur").value;
    var qty = parseNum($("#q-qty").value), price = parseNum($("#q-price").value), rate = parseNum($("#q-rate").value);
    var w = parseNum($("#q-weight").value), tariff = parseNum($("#q-tariff").value), drate = parseNum($("#q-drate").value);
    var markup = parseNum($("#q-markup").value);
    var step = Number($("#q-round").value) || 0;

    var wTotal = qs.wmode === "unit" ? w * qty : w;
    var dAmount = tariff > 0 ? Math.round(wTotal * tariff * 100) / 100 : 0;   // в валюте доставки
    var goods = qty * price * rate;                                            // в валюте клиента
    var delivery = dAmount * drate;
    var cost = goods + delivery;
    var raw = cost * (1 + markup / 100);
    var out = cost > 0
      ? (step > 0 ? Math.ceil(raw / step - 1e-9) * step : (raw >= 100 ? Math.round(raw) : Math.round(raw * 100) / 100))
      : 0;
    var valid = qty > 0 && price > 0 && rate > 0;
    return {
      a: a, b: b, dc: dc, qty: qty, price: price, rate: rate, wTotal: wTotal, tariff: tariff, drate: drate,
      dAmount: dAmount, goods: goods, delivery: delivery, cost: cost, markup: markup, out: out,
      profit: out - cost, valid: valid && out > 0,
      missingDeliveryRate: dAmount > 0 && !(drate > 0) && dc !== b
    };
  }

  function fmt(n, code) { return (money(n) + " " + code).replace(/[  ]/g, " "); }

  function buildMessage(r, lang) {
    var T = TXT[lang] || TXT.ru;
    var name = $("#q-name").value.trim();
    if (name.length > 60) name = name.slice(0, 57) + "…";
    var what = T.what(name);
    var line = r.qty > 1 ? T.many(what, fmt(r.out, r.b), money(r.qty), fmt(r.out / r.qty, r.b)) : T.one(what, fmt(r.out, r.b));
    return T.hello + "\n\n" + line + "\n" + T.tail;
  }

  // ---------- Показ ----------
  function render() {
    if (!$("#tab-quote")) return;
    var r = compute();
    qs.result = r;

    // подписи полей с кодами валют
    $("#q-lbl-price").textContent = t("f_price_cur", { c: r.a });
    $("#q-lbl-rate").textContent = r.a === r.b ? t("f_rate_same") : t("f_rate_cur", { a: r.a, b: r.b });
    $("#q-lbl-tariff").textContent = t("f_tariff_cur", { c: r.dc });
    $("#q-lbl-drate").textContent = r.dc === r.b ? t("f_rate_same") : t("f_delivery_rate_cur", { a: r.dc, b: r.b });
    $("#q-lbl-weight").textContent = t(qs.wmode === "unit" ? "q_weight_unit" : "q_weight_total");
    $("#q-rate").readOnly = same("r");
    $("#q-drate").readOnly = same("d");
    // «Запомнить курс» нужен только когда курс не 1 и есть что запоминать
    $("#q-save-rate").classList.toggle("hidden", same("r") || !(r.rate > 0));
    $("#q-save-drate").classList.toggle("hidden", same("d") || !(r.drate > 0));
    $$("#q-wmodes [data-wm]").forEach(function (b) {
      var on = b.getAttribute("data-wm") === qs.wmode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });

    // варианты округления (с переводом)
    var sel = $("#q-round"), cur = sel.value;
    sel.innerHTML = ROUND_STEPS.map(function (n) {
      return '<option value="' + n + '">' + (n ? t("q_round_n", { n: n }) : t("q_round_0")) + "</option>";
    }).join("");
    sel.value = cur || "0";

    // подсказки
    var hint = "";
    if (qs.market.r || qs.market.d) hint = t("q_rate_market");
    else if (r.missingDeliveryRate) hint = t("q_warn_drate");
    $("#q-hint").textContent = hint;
    $("#q-hint").classList.toggle("hidden", !hint);

    // результат
    var dash = "—";
    $("#q-r-goods").textContent = r.valid ? fmt(r.goods, r.b) : dash;
    $("#q-r-delivery").textContent = !r.valid ? dash
      : (r.dc === r.b ? fmt(r.delivery, r.b) : fmt(r.dAmount, r.dc) + " × " + money(r.drate) + " = " + fmt(r.delivery, r.b));
    $("#q-r-cost").textContent = r.valid ? fmt(r.cost, r.b) : dash;
    $("#q-r-price").textContent = r.valid ? fmt(r.out, r.b) : dash;
    $("#q-r-unit").textContent = r.valid && r.qty > 0 ? fmt(r.out / r.qty, r.b) : dash;
    $("#q-r-profit").textContent = !r.valid ? dash
      : fmt(r.profit, r.b) + (r.cost > 0 ? " (" + money(Math.round(r.profit / r.cost * 1000) / 10) + "%)" : "");
    $("#q-result").classList.toggle("q-empty", !r.valid);
    $("#q-bar-price").textContent = r.valid ? fmt(r.out, r.b) : "";
    $("#q-need").classList.toggle("hidden", r.valid);

    // текст ответа клиенту
    $$("#tab-quote [data-ql]").forEach(function (b) {
      var on = b.getAttribute("data-ql") === qs.lang;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (!qs.msgEdited) $("#q-msg").value = r.valid ? buildMessage(r, qs.lang) : "";
    refreshButtons();
    updateBar();
  }

  // Плашка с ценой внизу экрана: только когда расчёт готов, а «Результат» не виден
  function updateBar() {
    var show = !!(qs.result && qs.result.valid) && !qs.inView && !$("#tab-quote").classList.contains("hidden");
    $("#q-bar").classList.toggle("hidden", !show);
  }

  function refreshButtons() {
    var ok = !!(qs.result && qs.result.valid);
    var text = $("#q-msg").value;
    $("#q-copy").disabled = !ok || !text;
    $("#q-order").disabled = !ok;
    var wa = $("#q-wa");
    wa.href = ok ? "https://wa.me/?text=" + encodeURIComponent(text) : "#";
    wa.classList.toggle("disabled", !ok);
    wa.setAttribute("aria-disabled", String(!ok));
  }

  // ---------- Поля ----------
  function initFields(ws) {
    var prefs = loadPrefs();
    qs.wsId = ws.id || "";
    qs.wmode = prefs.wmode === "unit" ? "unit" : "total";
    qs.lang = msgLang();
    qs.msgEdited = false;
    qs.touched = { r: false, d: false };
    fillCurrencySelect($("#q-pcur"), ws.default_purchase_currency || "CNY", c.PURCHASE_CURRENCIES);
    fillCurrencySelect($("#q-ccur"), ws.default_client_currency || "KGS");
    fillCurrencySelect($("#q-dcur"), ws.default_delivery_currency || "USD", c.deliveryCurrencies($("#q-ccur").value));
    $("#q-tariff").value = numStr(ws.default_delivery_tariff);
    $("#q-markup").value = prefs.markup != null && prefs.markup !== "" ? prefs.markup : "15";
    $("#q-round").value = ROUND_STEPS.indexOf(Number(prefs.round)) !== -1 ? String(prefs.round) : "0";
    clearItem();
    setRate("r", true);
    setRate("d", true);
  }

  // Очистить данные товара (валюты, тариф, наценку оставляем)
  function clearItem() {
    ["q-name", "q-link", "q-price", "q-weight"].forEach(function (id) { $("#" + id).value = ""; });
    $("#q-qty").value = "1";
    qs.msgEdited = false;
  }

  function onCurrencyChange() {
    // список валют доставки зависит от валюты клиента
    var dsel = $("#q-dcur"), b = $("#q-ccur").value;
    var list = c.deliveryCurrencies(b);
    var keep = list.indexOf(dsel.value) !== -1 ? dsel.value : "USD";
    fillCurrencySelect(dsel, keep, list);
    setRate("r", true);
    setRate("d", true);
    render();
  }

  // ---------- Создать заказ из расчёта ----------
  function makeOrder() {
    var r = qs.result;
    if (!r || !r.valid) return;
    var link = $("#q-link").value.trim();
    c.switchTab("orders");
    c.openOrderPrefill({
      purchase_currency: r.a, client_currency: r.b, delivery_currency: r.dc,
      quantity: r.qty, unit_price: r.price, exchange_rate: r.rate,
      weight: r.wTotal, tariff: r.tariff, delivery_cost: r.dAmount, delivery_rate: r.drate,
      client_price: r.out,
      markup: r.cost > 0 ? Math.round((r.out / r.cost - 1) * 1000) / 10 : "",
      product_ru: $("#q-name").value.trim(), supplier_link: link
    });
  }

  // ---------- События ----------
  function bind() {
    ["q-qty", "q-price", "q-weight", "q-tariff", "q-markup", "q-name"].forEach(function (id) {
      $("#" + id).addEventListener("input", function () {
        if (id === "q-markup") savePrefs();
        render();
      });
    });
    $("#q-link").addEventListener("input", function () { /* ссылка нужна только для заказа */ });
    $("#q-rate").addEventListener("input", function () { qs.touched.r = true; qs.market.r = false; render(); });
    $("#q-drate").addEventListener("input", function () { qs.touched.d = true; qs.market.d = false; render(); });
    $("#q-pcur").addEventListener("change", onCurrencyChange);
    $("#q-ccur").addEventListener("change", onCurrencyChange);
    $("#q-dcur").addEventListener("change", function () { setRate("d", true); render(); });
    $("#q-round").addEventListener("change", function () { savePrefs(); render(); });

    $$("#q-wmodes [data-wm]").forEach(function (b) {
      b.addEventListener("click", function () {
        qs.wmode = b.getAttribute("data-wm");
        savePrefs();
        render();
      });
    });
    $$("#tab-quote [data-ql]").forEach(function (b) {
      b.addEventListener("click", function () {
        qs.lang = b.getAttribute("data-ql");
        qs.msgEdited = false;   // язык сменили — текст собираем заново
        try { localStorage.setItem(LANG_KEY, qs.lang); } catch (e) { /* ignore */ }
        render();
      });
    });
    $("#q-msg").addEventListener("input", function () { qs.msgEdited = true; refreshButtons(); });

    $("#q-copy").addEventListener("click", async function () {
      var ok = await c.copyText($("#q-msg").value);
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
    $("#q-wa").addEventListener("click", function (e) { if (!(qs.result && qs.result.valid)) e.preventDefault(); });
    $("#q-order").addEventListener("click", makeOrder);
    $("#q-bar").addEventListener("click", function () {
      $("#q-result").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        qs.inView = entries[0].isIntersecting;
        updateBar();
      }, { threshold: 0.2 }).observe($("#q-result"));
    }
    $("#q-clear").addEventListener("click", function () { clearItem(); render(); $("#q-name").focus(); });

    // «Запомнить курс» — сохраняет в «Мои курсы» кабинета
    $("#q-save-rate").addEventListener("click", async function () {
      var r = qs.result;
      if (await U.fx.save(r.a, r.b, r.rate)) { qs.market.r = false; render(); }
    });
    $("#q-save-drate").addEventListener("click", async function () {
      var r = qs.result;
      if (await U.fx.save(r.dc, r.b, r.drate)) { qs.market.d = false; render(); }
    });

    // список «Мои курсы»: выбрать пару / курсы изменились
    U.fx.onPick = function (a, b) {
      if (c.PURCHASE_CURRENCIES.indexOf(a) !== -1) fillCurrencySelect($("#q-pcur"), a, c.PURCHASE_CURRENCIES);
      fillCurrencySelect($("#q-ccur"), b);
      onCurrencyChange();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    U.fx.onChange = function () { setRate("r", true); setRate("d", true); render(); };
  }

  // Открыли раздел
  function open() {
    var ws = state.ws || {};
    if (qs.wsId !== (ws.id || "")) initFields(ws);
    U.fx.renderList();
    render();
    // рыночный курс — подсказка, если своего нет (подгружается один раз за 6 часов)
    U.fx.load(false).then(function () {
      setRate("r"); setRate("d");
      render();
    });
  }

  U.quote = { open: open, render: render, bind: bind };
})(window.ULA);
