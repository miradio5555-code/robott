// =====================================================
// ULA FACTORY — заявки по ссылке.
//
// 1) Страница заявки для клиента (?request=ТОКЕН): без регистрации и без входа.
//    Клиент прикладывает фото товара (до 5), ссылку или описание, количество, имя и телефон —
//    у байера сразу создаётся новый заказ с этими фото. Клиент получает номер заказа и ссылку для слежения.
//    Фото загружаются после создания заказа (migration_44_request_photos.sql).
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
  // Клиент добавляет несколько карточек товаров (у каждой свои фото, ссылка, описание, количество).
  // Контакты и пожелания общие. Каждая карточка становится отдельным заказом у байера.
  var MAX_PHOTOS = 5, MAX_ITEMS = 5;
  function newItem() { return { files: [], link: "", product: "", qty: "1" }; }
  var rq = { token: "", name: "", step: "loading", draft: {}, errors: {}, ierr: {}, busy: false, result: [], formError: "", items: [newItem()], photoFail: false, left: 0 };

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

  // Что клиент уже ввёл не теряется при смене языка и добавлении карточек
  function readDraft() {
    var f = $("#rq-form");
    if (!f) return;
    ["name", "phone", "telegram", "comment"].forEach(function (k) {
      var el = $("#rq-" + k);
      if (el) rq.draft[k] = el.value;
    });
    rq.items.forEach(function (it, i) {
      ["link", "product", "qty"].forEach(function (k) {
        var el = $("#rq-" + k + "-" + i);
        if (el) it[k] = el.value;
      });
    });
  }

  function field(k, label, input, hint, errKey) {
    var err = errKey === undefined ? rq.errors[k] : errKey;
    return '<label class="field' + (err ? " has-error" : "") + '"><span>' + esc(label) + "</span>" + input +
      (hint ? '<p class="field-hint">' + esc(hint) + "</p>" : "") +
      (err ? '<p class="form-error" role="alert">' + esc(t(err)) + "</p>" : "") + "</label>";
  }

  // Карточка одного товара
  function itemHtml(it, i) {
    var er = rq.ierr[i] || {};
    var many = rq.items.length > 1;
    return '<div class="rq-item" data-rq-item="' + i + '">' +
      '<div class="rq-item-head"><b>' + esc(t("rq_item_n", { n: i + 1 })) + "</b>" +
        (many ? '<button type="button" class="rq-item-del" data-rq-item-del="' + i + '">' + esc(t("remove")) + "</button>" : "") + "</div>" +
      photosField(it, i, er.photos) +
      field("link", t("rq_link"), '<input id="rq-link-' + i + '" type="text" inputmode="url" autocomplete="off" placeholder="https://…" value="' + esc(it.link || "") + '">', t("rq_link_hint"), er.link) +
      field("product", t("rq_product"), '<textarea id="rq-product-' + i + '" rows="2" maxlength="300" placeholder="' + esc(t("rq_product_ph")) + '">' + esc(it.product || "") + "</textarea>", "", er.product) +
      field("qty", t("rq_qty"), '<input id="rq-qty-' + i + '" type="text" inputmode="decimal" value="' + esc(it.qty == null ? "1" : it.qty) + '">', "", er.qty) +
      "</div>";
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
      var base = location.pathname.replace(/index\.html$/, "");
      var rs = rq.result || [];
      var list = rs.map(function (r) {
        var track = r.token ? base + "?order=" + r.token : "";
        return '<div class="rq-res"><span class="rq-num">№ ' + esc(r.order_number || "") + "</span>" +
          (track ? '<a class="btn btn-sm" href="' + esc(track) + '">' + esc(t("rq_track")) + "</a>" : "") + "</div>";
      }).join("");
      box.innerHTML = '<section class="client-block rq-sent"><div class="rq-check" aria-hidden="true">' + U.icon("check", 30) + '</div>' +
        '<h1 class="rq-title">' + esc(t("rq_sent_title")) + "</h1>" + list +
        "<p>" + esc(t(rs.length > 1 ? "rq_sent_many" : "rq_sent_text", { n: rq.name })) + "</p>" +
        (rq.left ? '<p class="form-error" role="alert">' + esc(t("rq_left", { n: rq.left })) + "</p>" : "") +
        (rq.photoFail ? '<p class="form-error" role="alert">' + esc(t("rq_photo_fail")) + "</p>" : "") +
        '<button id="rq-again" class="btn btn-block" type="button">' + esc(t(rq.left ? "rq_finish" : "rq_again")) + "</button>" +
        '<p class="fine-print">' + esc(t("rq_track_hint")) + "</p></section>";
      return;
    }
    box.innerHTML = '<section class="client-block"><h1 class="rq-title">' + esc(t("rq_title")) + "</h1>" +
      (rq.name ? '<p class="rq-to">' + esc(t("rq_to", { n: rq.name })) + "</p>" : "") +
      '<p class="muted">' + esc(t("rq_hint")) + "</p>" +
      '<form id="rq-form" novalidate autocomplete="on">' +
        rq.items.map(itemHtml).join("") +
        (rq.items.length < MAX_ITEMS
          ? '<button id="rq-add-item" class="btn btn-block rq-add-item" type="button">＋ ' + esc(t("rq_add_item")) + "</button>"
          : '<p class="field-hint">' + esc(t("rq_items_max", { n: MAX_ITEMS })) + "</p>") +
        '<h2 class="rq-sub">' + esc(t("rq_you")) + "</h2>" +
        field("name", t("rq_name"), '<input id="rq-name" type="text" autocomplete="name" maxlength="120" value="' + esc(d.name || "") + '">') +
        field("phone", t("rq_phone"), '<input id="rq-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+__ ___ ___ ____" value="' + esc(d.phone || "") + '">', t("rq_phone_hint")) +
        field("telegram", t("rq_telegram"), '<input id="rq-telegram" type="text" autocomplete="off" placeholder="@username" value="' + esc(d.telegram || "") + '">') +
        field("comment", t("rq_comment"), '<textarea id="rq-comment" rows="2" maxlength="1000" placeholder="' + esc(t("rq_comment_ph")) + '">' + esc(d.comment || "") + "</textarea>") +
        // поле-ловушка для ботов: человеку не видно
        '<div class="hp" aria-hidden="true"><label>Website<input id="rq-website" type="text" tabindex="-1" autocomplete="off"></label></div>' +
        (rq.formError ? '<p class="form-error" role="alert">' + esc(rq.formError) + "</p>" : "") +
        '<button id="rq-send" class="btn btn-primary btn-block" type="submit"' + (rq.busy ? " disabled" : "") + ">" +
          esc(rq.busy ? t("rq_sending") : t(rq.items.length > 1 ? "rq_send_n" : "rq_send", { n: rq.items.length })) + "</button>" +
        '<p class="fine-print">' + esc(t("rq_consent")) + ' <a href="privacy.html">' + esc(t("legal_privacy")) + "</a>.</p>" +
      "</form></section>";
  }

  // Фото товара: превью с крестиком и кнопка «Добавить фото»
  function photosField(it, i, err) {
    var html = it.files.map(function (f, j) {
      return '<div class="rq-ph"><img src="' + esc(f.url) + '" alt=""><button type="button" class="rq-ph-x" data-rq-del="' + i + ":" + j + '" aria-label="' + esc(t("remove")) + '">×</button></div>';
    }).join("");
    if (it.files.length < MAX_PHOTOS) {
      html += '<label class="rq-ph rq-ph-add"><input id="rq-photos-' + i + '" data-rq-i="' + i + '" type="file" accept="image/*" multiple hidden>' +
        '<span aria-hidden="true">＋</span><small>' + esc(t("rq_photo_add")) + "</small></label>";
    }
    return '<div class="field' + (err ? " has-error" : "") + '"><span>' + esc(t("rq_photos")) + "</span>" +
      '<div class="rq-phs">' + html + "</div>" +
      '<p class="field-hint">' + esc(t("rq_photos_hint", { n: MAX_PHOTOS })) + "</p>" +
      (err ? '<p class="form-error" role="alert">' + esc(t(err)) + "</p>" : "") + "</div>";
  }
  function addFiles(i, list) {
    var it = rq.items[i], skipped = false;
    if (!it) return;
    Array.prototype.forEach.call(list || [], function (f) {
      if (!/^image\//.test(f.type || "")) { skipped = true; return; }
      if (it.files.length >= MAX_PHOTOS) { skipped = true; return; }
      it.files.push({ file: f, url: URL.createObjectURL(f) });
    });
    if (skipped) toast(t("rq_photos_max", { n: MAX_PHOTOS }), "error");
    if (rq.ierr[i]) { delete rq.ierr[i].photos; delete rq.ierr[i].link; delete rq.ierr[i].product; }
    render();
  }
  function clearFiles(it) {
    it.files.forEach(function (f) { try { URL.revokeObjectURL(f.url); } catch (e) { /* ignore */ } });
    it.files = [];
  }

  // Загрузить фото к только что созданному заказу (как у байера: большое фото + маленькая копия)
  async function uploadPhotos(otoken, files) {
    if (!files.length || !otoken) return true;
    var db = c.db();
    var dir = await db.rpc("request_photo_dir", { p_otoken: otoken });
    if (dir.error || !dir.data) throw dir.error || new Error("no_dir");
    var paths = [];
    for (var i = 0; i < files.length; i++) {
      try {
        var file = files[i].file;
        var blob = await c.shrinkImage(file, 1280, 260 * 1024);
        var small = await c.shrinkImage(file, 360, 32 * 1024, true);
        var type = blob.type || "image/jpeg";
        var name = dir.data + "/" + c.uid();
        var path = name + "_m." + (type === "image/webp" ? "webp" : "jpg");
        if (type !== "image/webp" && type !== "image/jpeg") path = name + "." + (type === "image/png" ? "png" : "jpg");
        var up = await db.storage.from("order-photos").upload(path, blob, { contentType: type, upsert: false });
        if (up.error) throw up.error;
        if (/_m\.(webp|jpg)$/.test(path) && small && small.type === "image/jpeg") {
          await db.storage.from("order-photos").upload(path.replace(/_m\.(webp|jpg)$/, "_t.jpg"), small, { contentType: "image/jpeg", upsert: false });
        }
        paths.push(path);
      } catch (e) { console.warn("request photo", e); }
    }
    if (!paths.length) return false;
    var at = await db.rpc("request_attach_photos", { p_otoken: otoken, p_paths: paths });
    if (at.error) throw at.error;
    return paths.length === files.length;
  }

  // Проверки такие же, как в базе (там они главные)
  function validate(d, items) {
    var e = {}, ie = {};
    var name = String(d.name || "").trim();
    var phone = c.cleanPhone(d.phone);
    var tg = String(d.telegram || "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
    if (name.length < 2 || name.length > 120) e.name = "e_name";
    if (!/^\+?[0-9]{9,15}$/.test(phone)) e.phone = "e_phone";
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) e.telegram = "e_telegram";
    var list = items.map(function (it, i) {
      var x = {}, link = String(it.link || "").trim(), product = String(it.product || "").trim(), qty = parseNum(it.qty);
      if (link) {
        if (!/^https?:\/\//i.test(link)) link = "https://" + link;   // вставили без https://
        if (/\s/.test(link) || link.length > 2048 || !/^https?:\/\/[^\s]+\.[^\s]+/i.test(link)) x.link = "rq_e_link";
      }
      if (!link && !product && !it.files.length) { x.photos = "rq_e_product"; x.product = "rq_e_product"; }
      if (!(qty > 0) || qty > 100000) x.qty = "rq_e_qty";
      if (Object.keys(x).length) ie[i] = x;
      return { link: link, product: product, qty: qty };
    });
    return { errors: e, itemErrors: ie, values: { name: name, phone: phone, tg: tg, comment: String(d.comment || "").trim() }, list: list };
  }

  function errText(err) {
    var m = String((err && err.message) || "");
    if (/link_not_found/.test(m)) return "notfound";
    if (/too_many/.test(m)) return "many";
    return "other";
  }

  async function send() {
    if (rq.busy) return;
    readDraft();
    var v = validate(rq.draft, rq.items);
    rq.errors = v.errors;
    rq.ierr = v.itemErrors;
    rq.formError = "";
    if (Object.keys(v.errors).length || Object.keys(v.itemErrors).length) {
      rq.formError = t("e_form");
      render();
      var bad = Object.keys(v.itemErrors)[0], el = null;
      if (bad !== undefined) {
        var ie = v.itemErrors[bad];
        el = $("#rq-" + (ie.link ? "link" : ie.product ? "product" : "qty") + "-" + bad);
      } else {
        var first = ["name", "phone", "telegram"].filter(function (k) { return v.errors[k]; })[0];
        el = first && $("#rq-" + first);
      }
      if (el) el.focus();
      return;
    }
    rq.busy = true;
    render();
    var x = v.values, done = [], failed = [], stop = "";
    var website = ($("#rq-website") && $("#rq-website").value) || null;
    for (var i = 0; i < rq.items.length; i++) {
      var it = rq.items[i], vi = v.list[i];
      try {
        var res = await c.db().rpc("submit_request", {
          p_token: rq.token.toLowerCase(), p_name: x.name, p_phone: x.phone, p_telegram: x.tg || null,
          p_product: vi.product || (it.files.length ? t("rq_by_photo") : ""), p_link: vi.link || null, p_qty: vi.qty, p_comment: x.comment || null,
          p_website: website
        });
        if (res.error) throw res.error;
        var r = res.data || {};
        done.push(r);
        // заказ создан — теперь фото; если не вышло, заявка всё равно принята
        try { if (!(await uploadPhotos(r.token, it.files))) rq.photoFail = true; } catch (e) { console.warn(e); rq.photoFail = true; }
        try {
          if (r.token) {
            c.db().functions.invoke("telegram-notify", { body: { action: "request_notify", token: r.token } }).catch(function () {});
            c.db().functions.invoke("push-notify", { body: { action: "request", token: r.token } }).catch(function () {});
          }
        } catch (e) { /* ignore */ }
      } catch (err) {
        console.error(err);
        stop = errText(err);
        failed = rq.items.slice(i);
        break;
      }
    }
    // отправленные карточки убираем из формы, неотправленные остаются
    rq.items.slice(0, done.length).forEach(clearFiles);
    rq.items = failed.length ? failed : [newItem()];
    rq.busy = false;
    if (!done.length) {
      if (stop === "notfound") rq.step = "notfound";
      else rq.formError = t(stop === "many" ? "rq_err_many" : "rq_err");
      render();
      return;
    }
    rq.result = done;
    rq.left = failed.length;
    if (!failed.length) rq.draft = {};
    rq.step = "sent";
    render();
  }

  var pageBound = false;
  function bindPage() {
    if (pageBound) return;
    pageBound = true;
    var box = $("#request-content");
    box.addEventListener("submit", function (e) { if (e.target.id === "rq-form") { e.preventDefault(); send(); } });
    box.addEventListener("change", function (e) {
      if (/^rq-photos-/.test(e.target.id || "")) { readDraft(); addFiles(+e.target.getAttribute("data-rq-i"), e.target.files); }
    });
    box.addEventListener("click", function (e) {
      var del = e.target.closest("[data-rq-del]");
      if (del) {
        readDraft();
        var ij = del.getAttribute("data-rq-del").split(":"), it = rq.items[+ij[0]];
        var f = it && it.files.splice(+ij[1], 1)[0];
        if (f) try { URL.revokeObjectURL(f.url); } catch (er) { /* ignore */ }
        render();
        return;
      }
      var di = e.target.closest("[data-rq-item-del]");
      if (di) {
        readDraft();
        var rm = rq.items.splice(+di.getAttribute("data-rq-item-del"), 1)[0];
        if (rm) clearFiles(rm);
        if (!rq.items.length) rq.items.push(newItem());
        rq.ierr = {};
        render();
        return;
      }
      if (e.target.closest("#rq-add-item")) {
        readDraft();
        if (rq.items.length < MAX_ITEMS) rq.items.push(newItem());
        render();
        var last = $("#rq-link-" + (rq.items.length - 1));
        if (last && last.scrollIntoView) last.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      if (e.target.closest("#rq-again")) { rq.step = "form"; rq.errors = {}; rq.ierr = {}; rq.formError = ""; rq.left = 0; rq.photoFail = false; render(); }
    });
    // ошибка поля исчезает, когда клиент начал её править
    box.addEventListener("input", function (e) {
      if (e.target.type === "file") return;
      readDraft();
      var id = String(e.target.id || "").replace("rq-", ""), m = id.match(/^(link|product|qty)-(\d+)$/);
      var holder = m ? rq.ierr[+m[2]] : rq.errors, k = m ? m[1] : id;
      if (holder && holder[k]) {
        delete holder[k];
        if (m && k !== "qty" && holder.photos) delete holder.photos;
        var p = e.target.closest(".field");
        if (p) { p.classList.remove("has-error"); var er = p.querySelector(".form-error"); if (er) er.remove(); }
      }
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

  // ---------- Новая заявка пришла, пока байер в кабинете: сигнал и подсказка «дополните заказ» ----------
  // Раз в 30 секунд смотрим, нет ли заявок новее последней известной. Первая проверка только запоминает точку отсчёта.
  var watch = { ws: null, since: null, busy: false };
  async function checkNew() {
    var db = c.db();
    if (watch.busy || document.hidden || !db || !state.me || !state.ws) return;
    if (watch.ws !== state.ws.id) { watch.ws = state.ws.id; watch.since = null; }
    watch.busy = true;
    try {
      var q = db.from("orders").select("id, order_number, client_name, product_ru, created_at")
        .eq("workspace_id", state.ws.id).eq("source", "request").order("created_at", { ascending: false });
      var res = watch.since ? await q.gt("created_at", watch.since).limit(20) : await q.limit(1);
      if (res.error) return;
      var rows = res.data || [];
      if (!watch.since) { watch.since = rows[0] ? rows[0].created_at : new Date(Date.now() - 60000).toISOString(); return; }
      if (!rows.length) return;
      watch.since = rows[0].created_at;
      var known = {};
      (state.orders || []).forEach(function (o) { known[o.id] = 1; });
      var fresh = rows.filter(function (r) { return !known[r.id]; });
      if (!fresh.length) return;
      var r0 = fresh[0];
      if (U.alerts) U.alerts.ping({ title: t("rq_new_title", { n: r0.order_number }), body: (r0.client_name || "") + " · " + (r0.product_ru || ""), tag: "request" });
      toast(fresh.length > 1 ? t("rq_new_many", { n: fresh.length }) : t("rq_new_toast", { n: r0.order_number }), "ok");
      if (c.reloadOrders) await c.reloadOrders();
    } catch (e) { /* сеть — попробуем в следующий раз */ }
    finally { watch.busy = false; }
  }
  setInterval(checkNew, 30000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) checkNew(); });

  U.requests = { init: init, render: render, bind: bind, openLink: openLink, _validate: validate };
})(window.ULA);
