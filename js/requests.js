// =====================================================
// ULA FACTORY — заявки по ссылке.
//
// 1) Страница заявки для клиента (?request=ТОКЕН): без регистрации и без входа.
//    Клиент вписывает ссылку на товар, количество, имя и телефон — у байера
//    сразу создаётся новый заказ. Клиент получает номер заказа и ссылку для слежения.
//    Работает без библиотеки supabase.js (как страница клиента).
// 2) У байера кнопка «Ссылка для заявок»: скопировать, отправить в WhatsApp,
//    заменить ссылку (старая сразу перестаёт работать) или отключить.
//
// Проверки данных и защита от спама выполняются в базе (migration_17_requests.sql):
// здесь те же проверки нужны только для понятных подсказок до отправки.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, parseNum = c.parseNum, state = c.state;

  // ---------- Страница заявки (для клиента) ----------
  var rq = { token: "", name: "", step: "loading", draft: {}, errors: {}, busy: false, result: null, formError: "" };

  async function init(token) {
    c.showView("request");
    rq.token = token;
    rq.step = "loading";
    render();
    bindPage();
    if (!/^[a-f0-9]{32}$/i.test(token)) { rq.step = "notfound"; render(); return; }
    try {
      var res = await c.db().rpc("get_request_form", { p_token: token.toLowerCase() });
      if (res.error) throw res.error;
      rq.name = res.data && res.data.name ? res.data.name : "";
      rq.step = res.data ? "form" : "notfound";
    } catch (err) {
      console.error(err);
      rq.step = "error";
    }
    render();
  }

  // Что клиент уже ввёл не теряется при смене языка
  function readDraft() {
    var f = $("#rq-form");
    if (!f) return;
    ["name", "phone", "telegram", "link", "product", "qty", "comment"].forEach(function (k) {
      var el = $("#rq-" + k);
      if (el) rq.draft[k] = el.value;
    });
  }

  function field(k, label, input, hint) {
    var err = rq.errors[k];
    return '<label class="field' + (err ? " has-error" : "") + '"><span>' + esc(label) + "</span>" + input +
      (hint ? '<p class="field-hint">' + esc(hint) + "</p>" : "") +
      (err ? '<p class="form-error" role="alert">' + esc(t(err)) + "</p>" : "") + "</label>";
  }

  function render() {
    var box = $("#request-content");
    if (!box) return;
    if (rq.step === "form") readDraft();   // перед перерисовкой запоминаем всё, что клиент уже набрал
    var d = rq.draft;
    if (rq.step === "loading") { box.innerHTML = '<div class="state-box">' + esc(t("loading")) + "</div>"; return; }
    if (rq.step === "notfound" || rq.step === "error") {
      box.innerHTML = '<section class="client-block"><h1 class="rq-title">' + esc(t(rq.step === "notfound" ? "rq_nf_title" : "rq_err_title")) +
        "</h1><p>" + esc(t(rq.step === "notfound" ? "rq_nf_text" : "rq_err_load")) + "</p></section>";
      return;
    }
    if (rq.step === "sent") {
      var r = rq.result || {};
      var track = r.token ? location.pathname.replace(/index\.html$/, "") + "?order=" + r.token : "";
      box.innerHTML = '<section class="client-block rq-sent"><div class="rq-check" aria-hidden="true">' + U.icon("check", 30) + '</div>' +
        '<h1 class="rq-title">' + esc(t("rq_sent_title")) + "</h1>" +
        '<p class="rq-num">№ ' + esc(r.order_number || "") + "</p>" +
        "<p>" + esc(t("rq_sent_text", { n: rq.name })) + "</p>" +
        (track ? '<a class="btn btn-primary btn-block" href="' + esc(track) + '">' + esc(t("rq_track")) + "</a>" : "") +
        '<button id="rq-again" class="btn btn-block" type="button">' + esc(t("rq_again")) + "</button>" +
        '<p class="fine-print">' + esc(t("rq_track_hint")) + "</p></section>";
      return;
    }
    box.innerHTML = '<section class="client-block"><h1 class="rq-title">' + esc(t("rq_title")) + "</h1>" +
      (rq.name ? '<p class="rq-to">' + esc(t("rq_to", { n: rq.name })) + "</p>" : "") +
      '<p class="muted">' + esc(t("rq_hint")) + "</p>" +
      '<form id="rq-form" novalidate autocomplete="on">' +
        field("link", t("rq_link"), '<input id="rq-link" type="text" inputmode="url" autocomplete="off" placeholder="https://…" value="' + esc(d.link || "") + '">', t("rq_link_hint")) +
        field("product", t("rq_product"), '<textarea id="rq-product" rows="2" maxlength="300" placeholder="' + esc(t("rq_product_ph")) + '">' + esc(d.product || "") + "</textarea>") +
        field("qty", t("rq_qty"), '<input id="rq-qty" type="text" inputmode="decimal" value="' + esc(d.qty == null ? "1" : d.qty) + '">') +
        field("name", t("rq_name"), '<input id="rq-name" type="text" autocomplete="name" maxlength="120" value="' + esc(d.name || "") + '">') +
        field("phone", t("rq_phone"), '<input id="rq-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+996 555 123 456" value="' + esc(d.phone || "") + '">', t("rq_phone_hint")) +
        field("telegram", t("rq_telegram"), '<input id="rq-telegram" type="text" autocomplete="off" placeholder="@username" value="' + esc(d.telegram || "") + '">') +
        field("comment", t("rq_comment"), '<textarea id="rq-comment" rows="2" maxlength="1000" placeholder="' + esc(t("rq_comment_ph")) + '">' + esc(d.comment || "") + "</textarea>") +
        // поле-ловушка для ботов: человеку не видно
        '<div class="hp" aria-hidden="true"><label>Website<input id="rq-website" type="text" tabindex="-1" autocomplete="off"></label></div>' +
        (rq.formError ? '<p class="form-error" role="alert">' + esc(rq.formError) + "</p>" : "") +
        '<button id="rq-send" class="btn btn-primary btn-block" type="submit"' + (rq.busy ? " disabled" : "") + ">" + esc(t(rq.busy ? "rq_sending" : "rq_send")) + "</button>" +
        '<p class="fine-print">' + esc(t("rq_consent")) + ' <a href="privacy.html">' + esc(t("legal_privacy")) + "</a>.</p>" +
      "</form></section>";
  }

  // Проверки такие же, как в базе (там они главные)
  function validate(d) {
    var e = {}, out = {};
    var name = String(d.name || "").trim();
    var phone = c.cleanPhone(d.phone);
    var tg = String(d.telegram || "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
    var link = String(d.link || "").trim();
    var product = String(d.product || "").trim();
    var qty = parseNum(d.qty);
    if (name.length < 2 || name.length > 120) e.name = "e_name";
    if (!/^\+?[0-9]{9,15}$/.test(phone)) e.phone = "e_phone";
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) e.telegram = "e_telegram";
    if (link) {
      if (!/^https?:\/\//i.test(link)) link = "https://" + link;   // вставили без https://
      if (/\s/.test(link) || link.length > 2048 || !/^https?:\/\/[^\s]+\.[^\s]+/i.test(link)) e.link = "rq_e_link";
    }
    if (!link && !product) { e.product = "rq_e_product"; if (!e.link) e.link = "rq_e_product"; }
    if (!(qty > 0) || qty > 100000) e.qty = "rq_e_qty";
    out = { name: name, phone: phone, tg: tg, link: link, product: product, qty: qty, comment: String(d.comment || "").trim() };
    return { errors: e, values: out };
  }

  async function send() {
    if (rq.busy) return;
    readDraft();
    var v = validate(rq.draft);
    rq.errors = v.errors;
    rq.formError = "";
    if (Object.keys(v.errors).length) {
      rq.formError = t("e_form");
      render();
      var first = ["link", "product", "qty", "name", "phone", "telegram"].filter(function (k) { return v.errors[k]; })[0];
      var el = first && $("#rq-" + first);
      if (el) el.focus();
      return;
    }
    rq.busy = true;
    render();
    try {
      var x = v.values;
      var res = await c.db().rpc("submit_request", {
        p_token: rq.token.toLowerCase(), p_name: x.name, p_phone: x.phone, p_telegram: x.tg || null,
        p_product: x.product, p_link: x.link || null, p_qty: x.qty, p_comment: x.comment || null,
        p_website: ($("#rq-website") && $("#rq-website").value) || null
      });
      if (res.error) throw res.error;
      rq.result = res.data || {};
      rq.step = "sent";
      // сообщить байеру в Telegram (если подключён); ошибка здесь клиенту не видна
      try {
        if (rq.result.token) c.db().functions.invoke("telegram-notify", { body: { action: "request_notify", token: rq.result.token } }).catch(function () {});
      } catch (e) { /* ignore */ }
      rq.draft = {};
    } catch (err) {
      console.error(err);
      var m = String((err && err.message) || "");
      if (/link_not_found/.test(m)) rq.step = "notfound";
      else if (/too_many/.test(m)) rq.formError = t("rq_err_many");
      else if (/invalid_phone/.test(m)) rq.errors.phone = "e_phone";
      else if (/invalid_name/.test(m)) rq.errors.name = "e_name";
      else if (/invalid_link|invalid_product/.test(m)) rq.errors.link = "rq_e_link";
      else if (/invalid_quantity/.test(m)) rq.errors.qty = "rq_e_qty";
      else rq.formError = t("rq_err");
    }
    rq.busy = false;
    render();
  }

  var pageBound = false;
  function bindPage() {
    if (pageBound) return;
    pageBound = true;
    var box = $("#request-content");
    box.addEventListener("submit", function (e) { if (e.target.id === "rq-form") { e.preventDefault(); send(); } });
    box.addEventListener("click", function (e) {
      if (e.target.closest("#rq-again")) { rq.step = "form"; rq.errors = {}; rq.formError = ""; render(); }
    });
    // ошибка поля исчезает, когда клиент начал её править
    box.addEventListener("input", function (e) {
      readDraft();
      var k = String(e.target.id || "").replace("rq-", "");
      if (rq.errors[k]) { delete rq.errors[k]; var p = e.target.closest(".field"); if (p) { p.classList.remove("has-error"); var er = p.querySelector(".form-error"); if (er) er.remove(); } }
    });
  }

  // ---------- Ссылка для заявок (у байера) ----------
  function linkUrl() {
    var tok = state.ws && state.ws.request_token;
    return tok ? location.origin + location.pathname.replace(/index\.html$/, "") + "?request=" + tok : "";
  }

  function renderLink() {
    var url = linkUrl(), active = !!url;
    $("#rl-state").textContent = t(active ? "rl_active" : "rl_disabled");
    $("#rl-input").value = url;
    $("#rl-input").classList.toggle("hidden", !active);
    $("#rl-controls").classList.toggle("hidden", !active);
    $("#rl-create").textContent = t(active ? "rl_rotate" : "rl_create");
    $("#rl-revoke").classList.toggle("hidden", !active || state.readOnly);
    $("#rl-create").classList.toggle("hidden", state.readOnly);
    $("#rl-wa").href = active ? "https://wa.me/?text=" + encodeURIComponent(t("rl_wa_text") + " " + url) : "#";
    $("#rl-open").href = active ? url : "#";
  }

  function setToken(tok) {
    if (!state.ws) return;
    state.ws.request_token = tok;
    if (state.myWs && state.myWs.id === state.ws.id) state.myWs.request_token = tok;
  }

  async function rotate() {
    if (state.readOnly || !state.ws) return;
    if (linkUrl() && !window.confirm(t("rl_confirm_rotate"))) return;
    var btn = $("#rl-create");
    btn.disabled = true;
    var res = await c.db().rpc("request_link_rotate", { p_ws: state.ws.id });
    btn.disabled = false;
    if (res.error) { c.handleError(res.error); return; }
    setToken(res.data);
    renderLink();
    var ok = await c.copyText(linkUrl());
    toast(ok ? t("rl_created_copied") : t("rl_created"), "ok");
  }

  async function revoke() {
    if (state.readOnly || !state.ws || !window.confirm(t("rl_confirm_revoke"))) return;
    var res = await c.db().rpc("request_link_revoke", { p_ws: state.ws.id });
    if (res.error) { c.handleError(res.error); return; }
    setToken(null);
    renderLink();
    toast(t("rl_revoked"), "ok");
  }

  function openLink() {
    renderLink();
    c.openModal("modal-reqlink");
  }

  function bind() {
    $("#req-link-btn").addEventListener("click", openLink);
    $("#rl-create").addEventListener("click", rotate);
    $("#rl-revoke").addEventListener("click", revoke);
    $("#rl-copy").addEventListener("click", async function () {
      var ok = await c.copyText($("#rl-input").value);
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
  }

  U.requests = { init: init, render: render, bind: bind, openLink: openLink, _validate: validate };
})(window.ULA);
