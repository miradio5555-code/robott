// =====================================================
// ULA FACTORY — раздел «Курс»: калькулятор валют и «Мои курсы» байера.
// Вынесено из app.js. Общие помощники ($, esc, toast, state, база…)
// берутся из window.ULA.core — их отдаёт app.js. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, toast = c.toast, handleError = c.handleError,
      money = c.money, numStr = c.numStr, parseNum = c.parseNum, locale = c.locale,
      curName = c.curName, fillCurrencySelect = c.fillCurrencySelect, openModal = c.openModal,
      fmtTime = c.fmtTime, state = c.state, WS_FIELDS = c.WS_FIELDS, APP_VERSION = c.APP_VERSION;

  // =====================================================
  //  💱 КАЛЬКУЛЯТОР ВАЛЮТ
  //  Курсы берём бесплатно с open.er-api.com (обновляются раз в день),
  //  храним в браузере 6 часов, чтобы не запрашивать каждый раз.
  // =====================================================
  var fx = { rates: null, date: "", loading: false, error: false };
  var FX_CACHE = "cc_fx_rates";

  async function loadFxRates(force) {
    if (!force) {
      try {
        var c = JSON.parse(localStorage.getItem(FX_CACHE) || "null");
        if (c && Date.now() - c.saved < 6 * 3600 * 1000) { fx.rates = c.rates; fx.date = c.date; fx.error = false; renderFx(true); return; }
      } catch (e) { /* ignore */ }
    }
    fx.loading = true;
    renderFx(true);
    try {
      var r = await fetch("https://open.er-api.com/v6/latest/USD");
      var d = await r.json();
      if (d.result !== "success" || !d.rates) throw new Error("bad rates");
      fx.rates = d.rates;
      fx.date = d.time_last_update_utc || new Date().toUTCString();
      fx.error = false;
      try { localStorage.setItem(FX_CACHE, JSON.stringify({ rates: fx.rates, date: fx.date, saved: Date.now() })); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      fx.error = !fx.rates;
    }
    fx.loading = false;
    renderFx(true);
  }

  // Сколько единиц валюты b за 1 единицу валюты a
  function fxRate(a, b) {
    if (!fx.rates || !fx.rates[a] || !fx.rates[b]) return null;
    return fx.rates[b] / fx.rates[a];
  }

  // Красивое число курса: 12,34 или 0,0123
  function fxNum(n) {
    var digits = n >= 100 ? 2 : n >= 1 ? 4 : 6;
    return n.toLocaleString(locale(), { maximumFractionDigits: digits });
  }

  function openFx() {
    var pair = null;
    try { pair = JSON.parse(localStorage.getItem("cc_fx_pair") || "null"); } catch (e) { /* ignore */ }
    var ws = state.ws || {};
    var from = (pair && pair[0]) || ws.default_purchase_currency || "CNY";
    var to = (pair && pair[1]) || ws.default_client_currency || "KGS";
    fillCurrencySelect($("#fx-from"), from);
    fillCurrencySelect($("#fx-to"), to);
    if (fx.rates) renderFx(true);
    loadFxRates(false);
  }

  function saveFxPair() {
    try { localStorage.setItem("cc_fx_pair", JSON.stringify([$("#fx-from").value, $("#fx-to").value])); } catch (e) { /* ignore */ }
  }

  // full = true — перерисовать ещё и таблицу курсов и подписи
  function renderFx(full) {
    if (full) {
      // перевести названия валют в выпадающих списках
      fillCurrencySelect($("#fx-from"), $("#fx-from").value || "CNY");
      fillCurrencySelect($("#fx-to"), $("#fx-to").value || "KGS");
    }
    var a = $("#fx-from").value, b = $("#fx-to").value;
    var amount = parseNum($("#fx-amount").value);
    var market = fxRate(a, b);
    var mine = myRate(a, b);
    var rate = mine != null ? mine : market; // свой курс главнее рыночного

    if (mine != null) {
      $("#fx-result").textContent = money(amount * rate) + " " + b;
      $("#fx-rate").textContent = t("fx_by_my") + ": 1 " + a + " = " + fxNum(rate) + " " + b;
    } else if (fx.loading && !fx.rates) {
      $("#fx-result").textContent = t("fx_loading");
      $("#fx-rate").textContent = "";
    } else if (fx.error || rate == null) {
      $("#fx-result").textContent = "—";
      $("#fx-rate").textContent = fx.error ? t("fx_error") : "";
    } else {
      $("#fx-result").textContent = money(amount * rate) + " " + b;
      $("#fx-rate").textContent = t("fx_by_market") + ": 1 " + a + " = " + fxNum(rate) + " " + b;
    }
    // поле «Мой курс»
    $("#fx-my-label").textContent = t("fx_my_label", { a: a, b: b });
    var inp = $("#fx-my-rate");
    if (document.activeElement !== inp || full) inp.value = mine != null ? numStr(mine) : "";
    inp.placeholder = market != null ? numStr(Math.round(market * 10000) / 10000) : "";
    $("#fx-my-save").disabled = a === b;
    $("#fx-market").textContent = market != null ? t("fx_market", { r: "1 " + a + " = " + fxNum(market) + " " + b }) : "";
    $("#fx-updated").textContent = fx.date ? t("fx_updated", { d: new Date(fx.date).toLocaleDateString(locale()) }) : "";

    if (!full) return;
    renderMyRates();
    // таблица: популярные валюты в валюте «В»
    $("#fx-table-title").textContent = t("fx_table", { c: b });
    $("#fx-table").innerHTML = fx.rates ? ["CNY", "USD", "EUR", "RUB", "KZT", "KGS", "UZS"]
      .filter(function (c) { return c !== b && fx.rates[c]; })
      .map(function (c) {
        return '<div class="fx-cell"><span>1 ' + esc(c) + ' <small class="muted">' + esc(curName(c)) + "</small></span><b>" +
          esc(fxNum(fxRate(c, b))) + " " + esc(b) + "</b></div>";
      }).join("") : "";
  }

  // =====================================================
  //  МОИ КУРСЫ — байер сам выставляет курс.
  //  Хранятся в кабинете (workspaces.custom_rates) как {"CNY_KGS": 13.2}.
  //  Видны на любом устройстве, подставляются в новые заказы и в калькулятор.
  // =====================================================
  function myRates() {
    return (state.ws && state.ws.custom_rates) || {};
  }

  // Свой курс для пары a→b. Если записан только обратный (b→a) — переворачиваем.
  function myRate(a, b) {
    if (a === b) return 1;
    var r = myRates();
    if (r[a + "_" + b] > 0) return Number(r[a + "_" + b]);
    if (r[b + "_" + a] > 0) return 1 / Number(r[b + "_" + a]);
    return null;
  }

  async function writeMyRates(rates) {
    if (state.readOnly || !state.ws) return false;
    var res = await c.db().from("workspaces").update({ custom_rates: rates }).eq("id", state.ws.id).select(WS_FIELDS).single();
    if (res.error) { handleError(res.error); return false; }
    state.ws = res.data;
    if (state.myWs && state.myWs.id === res.data.id) state.myWs = res.data;
    return true;
  }

  // Кнопка «Сохранить мой курс». Пустое поле — взять рыночный курс.
  async function saveMyRate() {
    var a = $("#fx-from").value, b = $("#fx-to").value;
    if (a === b) return;
    var v = $("#fx-my-rate").value.trim();
    var r = v ? parseNum(v) : fxRate(a, b);
    if (!(r > 0)) { toast(t("fx_my_bad"), "err"); return; }
    r = Math.round(r * 10000) / 10000;
    var rates = Object.assign({}, myRates());
    delete rates[b + "_" + a]; // одна пара — один курс, без путаницы с обратным
    rates[a + "_" + b] = r;
    var btn = $("#fx-my-save");
    btn.disabled = true;
    if (await writeMyRates(rates)) toast(t("fx_used", { r: "1 " + a + " = " + fxNum(r) + " " + b }), "ok");
    btn.disabled = false;
    renderFx(true);
  }

  // Список «Мои курсы»: нажать на курс — открыть его в калькуляторе, ✕ — удалить
  function renderMyRates() {
    var r = myRates(), keys = Object.keys(r).sort();
    $("#my-rates").innerHTML = keys.length ? keys.map(function (k) {
      var p = k.split("_");
      return '<div class="fx-cell"><button type="button" class="link-btn" data-pick="' + esc(k) + '">1 ' + esc(p[0]) + " = <b>" +
        esc(fxNum(Number(r[k]))) + " " + esc(p[1]) + "</b></button>" +
        (state.readOnly ? "" : '<button type="button" class="icon-btn fx-del" data-del="' + esc(k) + '" aria-label="' + esc(t("remove")) + '">✕</button>') +
        "</div>";
    }).join("") : '<p class="muted">' + esc(t("fx_my_empty")) + "</p>";
  }

  async function onMyRatesClick(e) {
    var pick = e.target.closest("[data-pick]"), del = e.target.closest("[data-del]");
    if (pick) {
      var p = pick.dataset.pick.split("_");
      fillCurrencySelect($("#fx-from"), p[0]);
      fillCurrencySelect($("#fx-to"), p[1]);
      saveFxPair();
      renderFx(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (del) {
      var rates = Object.assign({}, myRates());
      delete rates[del.dataset.del];
      if (await writeMyRates(rates)) toast(t("fx_my_deleted"), "ok");
      renderFx(true);
    }
  }


  // Кнопки и поля раздела (вызывается из app.js при входе в кабинет)
  function bind() {
  $("#fx-amount").addEventListener("input", function () { renderFx(); });
  $("#fx-from").addEventListener("change", function () { saveFxPair(); renderFx(); });
  $("#fx-to").addEventListener("change", function () { saveFxPair(); renderFx(); });
  $("#fx-swap").addEventListener("click", function () {
    var a = $("#fx-from").value;
    $("#fx-from").value = $("#fx-to").value;
    $("#fx-to").value = a;
    saveFxPair();
    renderFx();
  });
  $("#fx-my-form").addEventListener("submit", function (e) { e.preventDefault(); saveMyRate(); });
  $("#my-rates").addEventListener("click", onMyRatesClick);
  }

  U.fx = { open: openFx, render: renderFx, load: loadFxRates, myRate: myRate, bind: bind };
})(window.ULA);
