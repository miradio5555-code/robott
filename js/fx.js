// =====================================================
// ULA FACTORY — курсы валют.
//   • рыночный курс (open.er-api.com, бесплатно, обновляется раз в день) — только для справки;
//   • «Мои курсы» — курсы, которые байер выставляет сам. Хранятся в кабинете
//     (workspaces.custom_rates) как {"CNY_KGS": 13.2}: одинаковы на любом устройстве,
//     подставляются в расчёт цены (js/quote.js) и в новые заказы.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, handleError = c.handleError,
      locale = c.locale, state = c.state, WS_FIELDS = c.WS_FIELDS;

  // ---------- Рыночный курс ----------
  var fx = { rates: null, date: "", loading: false, error: false };
  var FX_CACHE = "cc_fx_rates";   // храним в браузере 6 часов

  async function loadFxRates(force) {
    if (!force) {
      try {
        var cached = JSON.parse(localStorage.getItem(FX_CACHE) || "null");
        if (cached && Date.now() - cached.saved < 6 * 3600 * 1000) {
          fx.rates = cached.rates; fx.date = cached.date; fx.error = false;
          return fx.rates;
        }
      } catch (e) { /* ignore */ }
    }
    fx.loading = true;
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
    return fx.rates;
  }

  // Рыночный курс: сколько единиц валюты b за 1 единицу валюты a (или null)
  function market(a, b) {
    if (a === b) return 1;
    if (!fx.rates || !fx.rates[a] || !fx.rates[b]) return null;
    return fx.rates[b] / fx.rates[a];
  }

  // Красивое число курса: 12,34 или 0,0123
  function fxNum(n) {
    var digits = n >= 100 ? 2 : n >= 1 ? 4 : 6;
    return n.toLocaleString(locale(), { maximumFractionDigits: digits });
  }

  // ---------- Мои курсы ----------
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

  // Запомнить курс a→b (rate — число). Возвращает true, если сохранилось.
  async function saveMyRate(a, b, rate) {
    if (a === b) return false;
    var r = Math.round(Number(rate) * 10000) / 10000;
    if (!(r > 0)) { toast(t("fx_my_bad"), "error"); return false; }
    var rates = Object.assign({}, myRates());
    delete rates[b + "_" + a]; // одна пара — один курс, без путаницы с обратным
    rates[a + "_" + b] = r;
    if (!(await writeMyRates(rates))) return false;
    toast(t("fx_used", { r: "1 " + a + " = " + fxNum(r) + " " + b }), "ok");
    renderList();
    return true;
  }

  // Список «Мои курсы»: нажать на курс — выбрать эту пару в расчёте, ✕ — удалить
  function renderList() {
    var box = $("#my-rates");
    if (!box) return;
    var r = myRates(), keys = Object.keys(r).sort();
    box.innerHTML = keys.length ? keys.map(function (k) {
      var p = k.split("_");
      return '<div class="fx-cell"><button type="button" class="link-btn" data-pick="' + esc(k) + '">1 ' + esc(p[0]) + " = <b>" +
        esc(fxNum(Number(r[k]))) + " " + esc(p[1]) + "</b></button>" +
        (state.readOnly ? "" : '<button type="button" class="icon-btn fx-del" data-del="' + esc(k) + '" aria-label="' + esc(t("remove")) + '">' + U.icon("x", 16) + "</button>") +
        "</div>";
    }).join("") : '<p class="muted">' + esc(t("fx_my_empty")) + "</p>";
  }

  async function onListClick(e) {
    var pick = e.target.closest("[data-pick]"), del = e.target.closest("[data-del]");
    if (pick && U.fx.onPick) {
      var p = pick.dataset.pick.split("_");
      U.fx.onPick(p[0], p[1]);
    } else if (del) {
      var rates = Object.assign({}, myRates());
      delete rates[del.dataset.del];
      if (await writeMyRates(rates)) toast(t("fx_my_deleted"), "ok");
      renderList();
      if (U.fx.onChange) U.fx.onChange();
    }
  }

  function bind() {
    var box = $("#my-rates");
    if (box) box.addEventListener("click", onListClick);
  }

  U.fx = {
    load: loadFxRates, market: market, myRate: myRate, save: saveMyRate,
    renderList: renderList, fxNum: fxNum, bind: bind,
    onPick: null,    // сюда расчёт цены вешает «выбрать пару валют»
    onChange: null   // и «курсы изменились»
  };
})(window.ULA);
