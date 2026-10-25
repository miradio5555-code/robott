// =====================================================
// ULA FACTORY — страница клиента (ссылка ?order=токен).
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js. Работает и без библиотеки supabase.js
// (база здесь — маленький клиент из app.js, см. miniClient).
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, cur = c.cur,
      locale = c.locale, fmtDate = c.fmtDate, fmtPhone = c.fmtPhone, cleanPhone = c.cleanPhone,
      photoUrl = c.photoUrl, openLightbox = c.openLightbox, showView = c.showView,
      statusHistoryHtml = c.statusHistoryHtml, state = c.state, STATUSES = c.STATUSES, CLOSED = c.CLOSED;

  // форма «Данные для доставки» на странице клиента
  var cd = {
    token: "",
    editing: false,   // true — показываем форму, false — показываем сохранённые данные
    draft: null,      // то, что клиент уже ввёл (не теряется при смене языка)
    errors: {},       // ошибки по полям: { phone: "e_phone", ... }
    saving: false
  };

  // =====================================================
  //  СТРАНИЦА КЛИЕНТА (по ссылке ?order=токен)
  // =====================================================
  async function initClient(token) {
    showView("client");
    renderClient();
    cd.token = token;
    bindClientUI();

    if (!/^[a-f0-9]{32}$/i.test(token)) {
      state.clientState = "notfound";
      renderClient();
      return;
    }
    try {
      var res = await c.db().rpc("get_client_order", { p_token: token });
      if (res.error) throw res.error;
      state.client = res.data || null;
      state.clientState = res.data ? "ok" : "notfound";
      // данных ещё нет — сразу показываем форму
      cd.editing = !!(state.client && !state.client.client && !isClosed());
    } catch (err) {
      console.error(err);
      state.clientState = "error";
    }
    renderClient();
  }

  function isClosed() {
    return !!state.client && CLOSED.indexOf(state.client.status) !== -1;
  }

  // Все клики и ввод на странице клиента ловим в одном месте
  // ↻ на странице клиента: заново загрузить заказ (статус, оплата, фото)
  async function refreshClient() {
    var btn = $("#client-refresh");
    if (btn.disabled || cd.editing) return; // не мешаем, пока клиент заполняет форму
    btn.disabled = true;
    btn.classList.add("spinning");
    try {
      var res = await c.db().rpc("get_client_order", { p_token: cd.token });
      if (res.error) throw res.error;
      if (res.data) { state.client = res.data; state.clientState = "ok"; renderClient(); toast(t("refreshed"), "ok"); }
    } catch (err) {
      console.error(err);
      toast(t("error_generic"), "error");
    }
    btn.classList.remove("spinning");
    btn.disabled = false;
  }

  function bindClientUI() {
    var box = $("#client-content");
    $("#client-refresh").addEventListener("click", refreshClient);

    box.addEventListener("click", function (e) {
      var ph = e.target.closest("[data-photo]");
      if (ph && state.client) {
        openLightbox(clientPhotoUrls(), Number(ph.getAttribute("data-photo")) || 0);
        return;
      }
      if (e.target.closest("[data-track-copy]") && state.client) {
        c.copyText(state.client.tracking_number).then(function (ok) { if (ok) toast(t("copied_track"), "ok"); });
        return;
      }
      var b = e.target.closest("[data-cd]");
      if (!b) return;
      if (b.getAttribute("data-cd") === "edit") {
        cd.draft = null;   // начинаем с сохранённых данных
        cd.errors = {};
        cd.editing = true;
        renderClient();
        var first = $("#cd-name");
        if (first) first.focus();
      } else if (b.getAttribute("data-cd") === "cancel") {
        cd.editing = false;
        cd.errors = {};
        renderClient();
      }
    });

    // запоминаем каждое изменение, чтобы ничего не потерять при смене языка
    box.addEventListener("input", function (e) {
      var key = e.target.getAttribute("data-field");
      if (!key) return;
      getDraft()[key] = e.target.value;
      if (cd.errors[key]) {
        delete cd.errors[key];
        e.target.removeAttribute("aria-invalid");
        var err = $("#cd-" + key + "-err");
        if (err) err.remove();
      }
    });

    // переключение «адрес / пункт выдачи»
    box.addEventListener("change", function (e) {
      if (e.target.name !== "cd-method") return;
      getDraft().method = e.target.value;
      delete cd.errors.place;
      renderClient();
      var r = $('input[name="cd-method"]:checked');
      if (r) r.focus();
    });

    box.addEventListener("submit", function (e) {
      if (e.target.id !== "cd-form") return;
      e.preventDefault();
      saveClientInfo();
    });
  }

  // Черновик формы. Если его нет — берём уже сохранённые данные клиента.
  function getDraft() {
    if (!cd.draft) {
      var c = (state.client && state.client.client) || {};
      cd.draft = {
        name: c.name || "",
        phone: c.phone ? fmtPhone(c.phone) : "",
        telegram: c.telegram ? "@" + c.telegram : "",
        city: c.city || "",
        method: c.pickup_point ? "pickup" : "address",
        place: c.pickup_point || c.address || ""
      };
    }
    return cd.draft;
  }

  // ---------- Проверка формы (такая же проверка есть и в базе) ----------
  function cleanTelegram(v) {
    return String(v || "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
  }

  function validateDraft(d) {
    var e = {};
    var name = d.name.trim(), city = d.city.trim(), place = d.place.trim();
    var phone = cleanPhone(d.phone), tg = cleanTelegram(d.telegram);

    if (!name) e.name = "e_required";
    else if (name.length < 2 || name.length > 120) e.name = "e_name";

    if (!phone) e.phone = "e_required";
    else if (!/^\+?\d{9,15}$/.test(phone)) e.phone = "e_phone";

    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) e.telegram = "e_telegram";

    if (!city) e.city = "e_required";
    else if (city.length < 2 || city.length > 80) e.city = "e_city";

    if (!place) e.place = "e_required";
    else if (d.method === "address" && (place.length < 5 || place.length > 300)) e.place = "e_address";
    else if (d.method === "pickup" && (place.length < 2 || place.length > 200)) e.place = "e_pickup";

    return e;
  }

  async function saveClientInfo() {
    if (cd.saving) return;
    var d = getDraft();
    cd.errors = validateDraft(d);
    if (Object.keys(cd.errors).length) {
      renderClient();
      toast(t("e_form"), "error");
      var bad = $('#client-content [aria-invalid="true"]');
      if (bad) bad.focus();
      return;
    }

    cd.saving = true;
    renderClient();
    try {
      var res = await c.db().rpc("save_client_info", {
        p_token: cd.token,
        p_name: d.name.trim(),
        p_phone: cleanPhone(d.phone),
        p_telegram: cleanTelegram(d.telegram) || null,
        p_city: d.city.trim(),
        p_address: d.method === "address" ? d.place.trim() : null,
        p_pickup_point: d.method === "pickup" ? d.place.trim() : null
      });
      if (res.error) throw res.error;
      state.client.client = res.data;
      cd.editing = false;
      cd.draft = null;
      cd.errors = {};
      toast(t("cd_saved"), "ok");
    } catch (err) {
      console.error(err);
      // база вернула понятную причину — показываем её у нужного поля
      var msg = String((err && err.message) || "");
      var m = msg.match(/invalid_(name|phone|telegram|city|place)/);
      if (m) {
        var key = m[1];
        cd.errors[key] = key === "place" ? (d.method === "pickup" ? "e_pickup" : "e_address") : "e_" + key;
        toast(t("e_form"), "error");
      } else if (/order_locked/.test(msg)) {
        state.client.status = "delivered";
        cd.editing = false;
        toast(t("cd_locked"), "error");
      } else {
        toast(t("error_generic"), "error");
      }
    }
    cd.saving = false;
    renderClient();
  }

  // ---------- Отрисовка блока «Данные для доставки» ----------
  function cdField(key, label, opts) {
    opts = opts || {};
    var d = getDraft();
    var err = cd.errors[key];
    var id = "cd-" + key;
    var described = [];
    if (opts.hint) described.push(id + "-hint");
    if (err) described.push(id + "-err");
    var attrs = ' id="' + id + '" data-field="' + key + '"' +
      (opts.attrs || "") +
      (opts.optional ? "" : " required") +
      (err ? ' aria-invalid="true"' : "") +
      (described.length ? ' aria-describedby="' + described.join(" ") + '"' : "");
    var control = opts.textarea
      ? "<textarea" + attrs + ' rows="2">' + esc(d[key]) + "</textarea>"
      : "<input" + attrs + ' value="' + esc(d[key]) + '">';
    return '<div class="field">' +
      '<label class="field-label" for="' + id + '">' + esc(label) +
        (opts.optional ? ' <span class="opt">(' + esc(t("cd_optional")) + ")</span>" : "") + "</label>" +
      control +
      (opts.hint ? '<p class="field-hint" id="' + id + '-hint">' + esc(opts.hint) + "</p>" : "") +
      (err ? '<p class="field-error" id="' + id + '-err">' + esc(t(err)) + "</p>" : "") +
      "</div>";
  }

  function deliveryBlockHtml() {
    var o = state.client;
    var c = o.client;

    // 1) Данные уже есть — показываем их
    if (c && !cd.editing) {
      return '<section class="client-block delivery-block filled" aria-labelledby="cd-title">' +
        '<div class="delivery-head"><h2 id="cd-title">' + esc(t("cd_title")) + "</h2>" +
          (isClosed() ? "" : '<button type="button" class="btn" data-cd="edit">' + esc(t("cd_edit")) + "</button>") +
        "</div>" +
        '<dl class="delivery-view">' +
          "<div><dt>" + esc(t("l_name")) + "</dt><dd>" + esc(c.name) + "</dd></div>" +
          "<div><dt>" + esc(t("l_phone")) + "</dt><dd>" + esc(fmtPhone(c.phone)) + "</dd></div>" +
          (c.telegram ? "<div><dt>" + esc(t("l_telegram")) + "</dt><dd>@" + esc(c.telegram) + "</dd></div>" : "") +
          "<div><dt>" + esc(t("l_city")) + "</dt><dd>" + esc(c.city) + "</dd></div>" +
          (c.address ? "<div><dt>" + esc(t("cd_m_address")) + "</dt><dd>" + esc(c.address) + "</dd></div>" : "") +
          (c.pickup_point ? "<div><dt>" + esc(t("cd_m_pickup")) + "</dt><dd>" + esc(c.pickup_point) + "</dd></div>" : "") +
        "</dl>" +
        (isClosed() ? '<p class="delivery-note">' + esc(t("cd_locked")) + "</p>" : "") +
      "</section>";
    }

    // 2) Заказ завершён, а данных нет — форму не показываем
    if (isClosed()) return "";

    // 3) Форма
    var d = getDraft();
    var isPickup = d.method === "pickup";
    return '<section class="client-block delivery-block" aria-labelledby="cd-title">' +
      '<h2 id="cd-title">' + esc(t("cd_title")) + "</h2>" +
      '<p class="delivery-intro">' + esc(t("cd_intro")) + "</p>" +
      '<form id="cd-form" class="delivery-form" novalidate>' +
        cdField("name", t("cd_name"), { attrs: ' type="text" autocomplete="name" maxlength="120"' }) +
        '<div class="grid-2">' +
          cdField("phone", t("cd_phone"), {
            attrs: ' type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="+996 555 123 456"',
            hint: t("cd_phone_hint")
          }) +
          cdField("telegram", t("cd_telegram"), {
            attrs: ' type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="45" placeholder="@username"',
            optional: true
          }) +
        "</div>" +
        cdField("city", t("cd_city"), { attrs: ' type="text" autocomplete="address-level2" maxlength="80"' }) +
        '<fieldset class="seg"><legend>' + esc(t("cd_method")) + "</legend>" +
          '<div class="seg-options">' +
            '<label><input type="radio" name="cd-method" value="address"' + (isPickup ? "" : " checked") + "><span>" + esc(t("cd_m_address")) + "</span></label>" +
            '<label><input type="radio" name="cd-method" value="pickup"' + (isPickup ? " checked" : "") + "><span>" + esc(t("cd_m_pickup")) + "</span></label>" +
          "</div>" +
        "</fieldset>" +
        cdField("place", t(isPickup ? "cd_pickup" : "cd_address"), {
          textarea: true,
          attrs: (isPickup ? ' autocomplete="off" maxlength="200"' : ' autocomplete="street-address" maxlength="300"')
        }) +
        '<div class="delivery-actions' + (c ? " two" : "") + '">' +
          (c ? '<button type="button" class="btn" data-cd="cancel">' + esc(t("cd_cancel")) + "</button>" : "") +
          '<button type="submit" class="btn btn-primary"' + (cd.saving ? " disabled" : "") + ">" +
            esc(t(cd.saving ? "cd_saving" : "cd_save")) + "</button>" +
        "</div>" +
        '<p class="delivery-privacy">' + esc(t("cd_privacy")) + "</p>" +
      "</form>" +
    "</section>";
  }

  // Трек-номер: крупно, кнопка «Скопировать» и «Где посылка» (сайт 17track сам определяет перевозчика)
  function trackHtml(o) {
    var n = String(o.tracking_number || "").trim();
    if (!n) return "";
    var lang = { ru: "ru", en: "en", zh: "zh-cn" }[typeof getLang === "function" ? getLang() : "ru"] || "ru";
    return '<section class="client-block track-block"><h2>' + esc(t("trk_title")) + "</h2>" +
      '<p class="track-num">' + esc(n) + "</p>" +
      '<div class="track-actions"><button type="button" class="btn" data-track-copy>' + esc(t("copy")) + "</button>" +
      '<a class="btn btn-primary" target="_blank" rel="noopener" href="https://t.17track.net/' + lang + "#nums=" + encodeURIComponent(n) + '">' +
      esc(t("trk_where")) + "</a></div>" +
      '<p class="fine-print">' + esc(t("trk_hint")) + "</p></section>";
  }

  function clientPhotoUrls() {
    return ((state.client && state.client.photos) || []).map(photoUrl);
  }

  function renderClient() {
    var box = $("#client-content");

    if (state.clientState === "loading") {
      box.innerHTML = '<div class="state-box">' + esc(t("loading")) + "</div>";
      return;
    }
    if (state.clientState === "error") {
      box.innerHTML = '<div class="state-box">' + esc(t("error_generic")) + "</div>";
      return;
    }
    if (state.clientState !== "ok") {
      box.innerHTML = '<section class="client-block notfound"><h1>' + esc(t("cl_not_found_title")) +
        "</h1><p>" + esc(t("cl_not_found_text")) + "</p></section>";
      return;
    }

    var o = state.client;
    var urls = clientPhotoUrls();
    var bal = num(o.balance_som);
    var priceKnown = num(o.total_som) > 0 || num(o.paid_amount) > 0;   // цена уже рассчитана?
    var cc = o.client_currency || "KGS"; // валюта клиента
    var flow = STATUSES.filter(function (s) { return s !== "cancelled"; });
    var idx = flow.indexOf(o.status);

    var steps = o.status === "cancelled"
      ? '<p class="cancelled-note">' + esc(t("cl_cancelled")) + "</p>"
      : '<ol class="steps" aria-label="' + esc(t("cl_status")) + '">' + flow.map(function (s, i) {
          return '<li class="' + (i < idx ? "done" : i === idx ? "current" : "") + '"' +
            (i === idx ? ' aria-current="step"' : "") + '><span class="dot"></span><span>' +
            esc(t("status_" + s)) + "</span></li>";
        }).join("") + "</ol>";
    var clientHistory = statusHistoryHtml(o.status_history, o);

    // Пока данных нет — форма стоит сразу после статуса (это главное действие).
    // Когда данные есть — уходит вниз, под оплату.
    var delivery = deliveryBlockHtml();
    var deliveryFirst = !o.client || cd.editing;

    // Сохраняем, где стоял курсор, чтобы смена языка не сбивала ввод
    var active = document.activeElement;
    var activeId = active && box.contains(active) && active.id && active.tagName !== "BUTTON" ? active.id : "";

    box.innerHTML =
      '<section class="client-hero">' +
        // номер заказа не переносим посередине
        "<h1>" + esc(t("cl_order", { n: "\u0000" })).replace("\u0000", '<span class="num">' + esc(o.order_number) + "</span>") + "</h1>" +
        '<p class="client-hero-date">' + fmtDate(o.order_date) + "</p>" +
        (o.status === "cancelled" ? "" : '<p class="client-hero-status">' + esc(t("status_" + o.status)) + "</p>") +
        steps + clientHistory +
      "</section>" +

      trackHtml(o) +
      (deliveryFirst ? delivery : "") +

      '<section class="client-block">' +
        "<h2>" + esc(t("cl_product")) + "</h2>" +
        '<div class="card-product"><h3>' + esc(o.product_ru) + "</h3>" +
          (o.product_zh ? '<p lang="zh-CN">' + esc(o.product_zh) + "</p>" : "") + "</div>" +
        (urls.length ? '<div class="thumbs thumbs-large">' + urls.map(function (u, i) {
          return '<button type="button" class="thumb" data-photo="' + i + '"><img src="' + esc(c.thumbUrl(state.client.photos[i])) + '" loading="lazy" alt=""></button>';
        }).join("") + "</div>" : "") +
        '<dl class="specs specs-2">' +
          "<div><dt>" + t("l_qty") + "</dt><dd>" + money(o.quantity) + " " + t("pcs") + "</dd></div>" +
          "<div><dt>" + t("l_weight") + "</dt><dd>" + money(o.weight_kg) + " " + t("kg") + "</dd></div>" +
        "</dl>" +
      "</section>" +

      '<section class="client-block">' +
        "<h2>" + esc(t("cl_payment")) + "</h2>" +
        // цена ещё не рассчитана (например, новая заявка): вместо «к оплате 0» — пояснение
        (priceKnown ? '<dl class="money">' +
          '<div class="money-total"><dt>' + t("cl_due") + "</dt><dd>" + cur(o.total_som, cc) + "</dd></div>" +
          "<div><dt>" + t("l_paid") + "</dt><dd>" + cur(o.paid_amount, cc) + "</dd></div>" +
          '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + t("cl_left") + "</dt><dd>" +
            (bal > 0 ? cur(bal, cc) : esc(t("cl_paid_full"))) + "</dd></div>" +
        "</dl>" : '<p class="muted">' + esc(t("cl_price_pending")) + "</p>") +
      "</section>" +

      (deliveryFirst ? "" : delivery) +

      (o.delivery_info ? '<section class="client-block"><h2>' + esc(t("cl_delivery_info")) + '</h2><p class="pre">' + esc(o.delivery_info) + "</p></section>" : "") +
      (o.client_comment ? '<section class="client-block"><h2>' + esc(t("cl_comment")) + '</h2><p class="pre">' + esc(o.client_comment) + "</p></section>" : "") +

      '<p class="fine-print">' + esc(t("cl_updated")) + ": " +
        esc(new Date(o.updated_at).toLocaleDateString(locale())) + "</p>";

    if (activeId) {
      var el = document.getElementById(activeId);
      if (el) el.focus();
    }
  }

  U.client = { init: initClient, render: renderClient };
})(window.ULA);
