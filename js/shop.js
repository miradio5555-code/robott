// =====================================================
// ULA FACTORY — витрина байера.
//
// 1) Страница для клиента (?shop=ТОКЕН): товары с фото и ценой, «Заказать» → имя, телефон, количество →
//    у байера сразу новый заказ (с ценой из базы). Работает без входа и без supabase.js.
// 2) Раздел «Витрина» в кабинете: добавить / изменить / скрыть / удалить товар, фото, ссылка на витрину.
// Ссылка витрины использует тот же секрет, что и «Ссылка для заявок» (одна заменяется — меняется и другая).
// Проверки и защита — в базе (migration_22_shop.sql). Фото сжимаются до 1000 px (~100–150 КБ).
// Вынесено из app.js. Общие помощники — из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, money = c.money, parseNum = c.parseNum, state = c.state;
  var BUCKET = "shop-photos";

  function photoUrl(path) {
    return path ? c.db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl : "";
  }
  function priceText(p) {
    return p.price != null && Number(p.price) > 0 ? money(p.price) + " " + p.currency : t("sh2_price_ask");
  }
  function shopUrl(tok) {
    return tok ? location.origin + location.pathname.replace(/index\.html$/, "") + "?shop=" + tok : "";
  }
  function photoBox(p, cls) {
    var u = photoUrl(p.photo || p.photo_path);
    return '<div class="sp-photo ' + (cls || "") + '">' + (u ? '<img src="' + esc(u) + '" alt="" loading="lazy">' : U.icon("package", 34)) + "</div>";
  }

  // =====================================================
  //  СТРАНИЦА ДЛЯ КЛИЕНТА
  // =====================================================
  var sp = { token: "", name: "", items: [], step: "loading", cur: null, qty: 1, draft: {}, error: "", busy: false, result: null };

  async function initPublic(token) {
    c.showView("shop");
    sp.token = String(token || "").toLowerCase();
    sp.step = "loading";
    renderPublic();
    bindPublic();
    if (!/^[a-f0-9]{32}$/.test(sp.token)) { sp.step = "notfound"; renderPublic(); return; }
    try {
      var res = await c.db().rpc("get_shop", { p_token: sp.token });
      if (res.error) throw res.error;
      if (!res.data) { sp.step = "notfound"; }
      else { sp.name = res.data.name || ""; sp.items = res.data.products || []; sp.step = "list"; }
    } catch (err) {
      console.error(err);
      sp.step = "error";
    }
    renderPublic();
  }

  function readDraft() {
    ["name", "phone", "telegram", "comment"].forEach(function (k) {
      var el = $("#sp-" + k);
      if (el) sp.draft[k] = el.value;
    });
  }

  function renderPublic() {
    var box = $("#shop-content");
    if (!box) return;
    if (sp.step === "item") readDraft();
    if (sp.step === "loading") { box.innerHTML = '<div id="sp-loading" class="state-box">' + esc(t("loading")) + "</div>"; return; }
    if (sp.step === "notfound" || sp.step === "error") {
      box.innerHTML = '<section class="client-block"><h1 class="rq-title">' + esc(t(sp.step === "notfound" ? "sh2_nf_title" : "rq_err_title")) +
        "</h1><p>" + esc(t(sp.step === "notfound" ? "sh2_nf_text" : "rq_err_load")) + "</p></section>";
      return;
    }
    if (sp.step === "sent") {
      var r = sp.result || {};
      var track = r.token ? location.pathname.replace(/index\.html$/, "") + "?order=" + r.token : "";
      box.innerHTML = '<section class="client-block rq-sent"><div class="rq-check" aria-hidden="true">' + U.icon("check", 30) + "</div>" +
        '<h1 class="rq-title">' + esc(t("rq_sent_title")) + "</h1>" +
        (r.order_number && r.order_number !== "—" ? '<p class="rq-num">№ ' + esc(r.order_number) + "</p>" : "") +
        "<p>" + esc(t("sh2_sent_text", { n: sp.name })) + "</p>" +
        (track ? '<a class="btn btn-primary btn-block" href="' + esc(track) + '">' + esc(t("rq_track")) + "</a>" : "") +
        '<button type="button" class="btn btn-block" data-sp="back">' + esc(t("sh2_back")) + "</button>" +
        '<p class="fine-print">' + esc(t("rq_track_hint")) + "</p></section>";
      return;
    }
    if (sp.step === "item" && sp.cur) {
      var p = sp.cur, d = sp.draft;
      box.innerHTML = '<button type="button" class="btn btn-ghost btn-sm sp-back" data-sp="back">← ' + esc(t("sh2_all")) + "</button>" +
        '<section class="client-block sp-item">' + photoBox(p, "big") +
        '<h1 class="sp-item-title">' + esc(p.title) + "</h1>" +
        '<p class="sp-item-price">' + esc(priceText(p)) + "</p>" +
        (p.description ? '<p class="sp-item-desc">' + esc(p.description) + "</p>" : "") +
        '<form id="sp-form" novalidate autocomplete="on">' +
          '<div class="field"><span>' + esc(t("rq_qty")) + '</span><div class="sp-qty">' +
            '<button type="button" class="btn" data-sp="minus" aria-label="−">−</button><b id="sp-qty">' + sp.qty + "</b>" +
            '<button type="button" class="btn" data-sp="plus" aria-label="+">+</button></div></div>' +
          '<label class="field"><span>' + esc(t("rq_name")) + '</span><input id="sp-name" type="text" autocomplete="name" maxlength="120" value="' + esc(d.name || "") + '"></label>' +
          '<label class="field"><span>' + esc(t("rq_phone")) + '</span><input id="sp-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+996 555 123 456" value="' + esc(d.phone || "") + '">' +
            '<p class="field-hint">' + esc(t("rq_phone_hint")) + "</p></label>" +
          '<label class="field"><span>' + esc(t("rq_telegram")) + '</span><input id="sp-telegram" type="text" autocomplete="off" placeholder="@username" value="' + esc(d.telegram || "") + '"></label>' +
          '<label class="field"><span>' + esc(t("rq_comment")) + '</span><textarea id="sp-comment" rows="2" maxlength="900" placeholder="' + esc(t("rq_comment_ph")) + '">' + esc(d.comment || "") + "</textarea></label>" +
          '<div class="hp" aria-hidden="true"><label>Website<input id="sp-website" type="text" tabindex="-1" autocomplete="off"></label></div>' +
          (sp.error ? '<p class="form-error" role="alert">' + esc(sp.error) + "</p>" : "") +
          '<button class="btn btn-primary btn-block" type="submit"' + (sp.busy ? " disabled" : "") + ">" + esc(t(sp.busy ? "rq_sending" : "sh2_order")) + "</button>" +
          '<p class="fine-print">' + esc(t("rq_consent")) + ' <a href="privacy.html">' + esc(t("legal_privacy")) + "</a>.</p>" +
        "</form></section>";
      return;
    }
    // список товаров
    box.innerHTML = '<section class="sp-head"><h1 class="rq-title">' + esc(sp.name || t("sh2_title")) + "</h1>" +
      '<p class="muted">' + esc(t("sh2_hint")) + "</p></section>" +
      (sp.items.length
        ? '<div class="sp-grid">' + sp.items.map(function (p, i) {
            return '<button type="button" class="sp-card" data-sp-i="' + i + '">' + photoBox(p) +
              '<span class="sp-card-title">' + esc(p.title) + '</span><b class="sp-card-price">' + esc(priceText(p)) + "</b></button>";
          }).join("") + "</div>"
        : '<div id="sp-empty" class="state-box">' + esc(t("sh2_empty")) + "</div>");
  }

  async function sendOrder() {
    if (sp.busy) return;
    readDraft();
    var d = sp.draft, name = String(d.name || "").trim(), phone = c.cleanPhone(d.phone);
    var tg = String(d.telegram || "").trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
    if (name.length < 2) { sp.error = t("e_name"); return renderPublic(); }
    if (!/^\+?\d{9,15}$/.test(phone)) { sp.error = t("e_phone"); return renderPublic(); }
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) { sp.error = t("rq_e_tg"); return renderPublic(); }
    sp.error = ""; sp.busy = true; renderPublic();
    try {
      var res = await c.db().rpc("shop_order", {
        p_token: sp.token, p_product: sp.cur.id, p_qty: sp.qty, p_name: name, p_phone: phone,
        p_telegram: tg || null, p_comment: String(d.comment || "").trim() || null,
        p_website: ($("#sp-website") && $("#sp-website").value) || null
      });
      if (res.error) throw res.error;
      sp.result = res.data || {};
      sp.step = "sent";
      sp.draft.comment = "";
      // сообщить байеру в Telegram (если подключён)
      try {
        if (sp.result.token) c.db().functions.invoke("telegram-notify", { body: { action: "request_notify", token: sp.result.token } }).catch(function () {});
      } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      var m = String((err && err.message) || "");
      if (/link_not_found|product_not_found/.test(m)) sp.error = t("sh2_gone");
      else if (/too_many/.test(m)) sp.error = t("rq_err_many");
      else if (/invalid_phone/.test(m)) sp.error = t("e_phone");
      else if (/invalid_name/.test(m)) sp.error = t("e_name");
      else sp.error = t("rq_err");
    }
    sp.busy = false;
    renderPublic();
  }

  var publicBound = false;
  function bindPublic() {
    if (publicBound) return;
    publicBound = true;
    var box = $("#shop-content");
    box.addEventListener("click", function (e) {
      var card = e.target.closest("[data-sp-i]");
      if (card) {
        sp.cur = sp.items[Number(card.getAttribute("data-sp-i"))];
        sp.qty = 1; sp.error = ""; sp.step = "item";
        renderPublic(); window.scrollTo(0, 0); return;
      }
      var b = e.target.closest("[data-sp]");
      if (!b) return;
      var a = b.getAttribute("data-sp");
      if (a === "back") { readDraft(); sp.step = "list"; sp.cur = null; renderPublic(); window.scrollTo(0, 0); }
      else if (a === "plus" || a === "minus") {
        sp.qty = Math.max(1, Math.min(9999, sp.qty + (a === "plus" ? 1 : -1)));
        $("#sp-qty").textContent = sp.qty;
      }
    });
    box.addEventListener("submit", function (e) {
      if (e.target.id === "sp-form") { e.preventDefault(); sendOrder(); }
    });
  }

  // =====================================================
  //  РАЗДЕЛ «ВИТРИНА» В КАБИНЕТЕ
  // =====================================================
  var sh = { list: [], loaded: false, edit: null, file: null, removePhoto: false };

  function canOwn() { return !state.readOnly && state.myRole !== "staff"; }

  async function load() {
    if (!state.ws) return;
    $("#shop-list").innerHTML = '<div id="shop-loading" class="state-box">' + esc(t("loading")) + "</div>";
    var res = await c.db().from("shop_products").select("*").eq("workspace_id", state.ws.id)
      .order("sort", { ascending: true }).order("created_at", { ascending: false });
    if (res.error) { console.error(res.error); sh.list = []; $("#shop-list").innerHTML = '<div class="state-box">' + esc(t("sh2_err_db")) + "</div>"; return; }
    sh.list = res.data || [];
    sh.loaded = true;
    render();
  }

  function renderLink() {
    var tok = state.ws && state.ws.request_token, url = shopUrl(tok);
    var box = $("#shop-link");
    if (!url) {
      box.innerHTML = '<p class="muted">' + esc(t("sh2_link_off")) + "</p>" +
        (canOwn() ? '<button type="button" class="btn btn-primary" data-shop="mklink">' + esc(t("sh2_link_make")) + "</button>" : "");
      return;
    }
    box.innerHTML = '<div class="shop-link-row"><input class="link-input" type="text" readonly value="' + esc(url) + '">' +
      '<button type="button" class="btn btn-primary" data-shop="copy">' + esc(t("copy")) + "</button></div>" +
      '<div class="stack"><a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t("sh2_wa_text") + " " + url) + '">WhatsApp</a>' +
      '<a class="btn" target="_blank" rel="noopener" href="' + esc(url) + '">' + esc(t("link_open")) + "</a></div>";
  }

  function render() {
    if ($("#tab-shop").classList.contains("hidden")) return;
    renderLink();
    var list = $("#shop-list");
    if (!sh.loaded) return;
    if (!sh.list.length) {
      list.innerHTML = '<div id="shop-empty" class="state-box">' + esc(t("sh2_none")) + "</div>";
      return;
    }
    list.innerHTML = '<div class="sp-grid">' + sh.list.map(function (p) {
      return '<button type="button" class="sp-card' + (p.is_active ? "" : " off") + '" data-shop-edit="' + esc(p.id) + '">' + photoBox(p) +
        '<span class="sp-card-title">' + esc(p.title) + '</span><b class="sp-card-price">' + esc(priceText(p)) + "</b>" +
        (p.is_active ? "" : '<span class="sp-off">' + esc(t("sh2_hidden")) + "</span>") + "</button>";
    }).join("") + "</div>";
  }

  // ---------- Окно товара ----------
  function openEdit(p) {
    sh.edit = p || null; sh.file = null; sh.removePhoto = false;
    $("#pr-title").value = p ? p.title : "";
    $("#pr-price").value = p && p.price != null ? c.numStr(p.price) : "";
    c.fillCurrencySelect($("#pr-currency"), p ? p.currency : ((state.ws && state.ws.default_client_currency) || "KGS"));
    $("#pr-desc").value = p ? (p.description || "") : "";
    $("#pr-active").checked = p ? !!p.is_active : true;
    $("#pr-file").value = "";
    $("#pr-error").classList.add("hidden");
    $("#pr-heading").textContent = t(p ? "sh2_edit" : "sh2_add");
    $("#pr-delete").classList.toggle("hidden", !p || state.myRole === "staff");
    preview(p ? photoUrl(p.photo_path) : "");
    c.openModal("modal-product");
    if (!p) $("#pr-title").focus();
  }

  function preview(url) {
    $("#pr-preview").innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : U.icon("package", 34);
    $("#pr-photo-del").classList.toggle("hidden", !url);
  }

  async function compress(file) {
    try {
      var bmp = await createImageBitmap(file);
      var scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
      var cv = document.createElement("canvas");
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      var blob = await new Promise(function (r) { cv.toBlob(r, "image/jpeg", 0.8); });
      if (blob) return blob;
    } catch (e) { console.warn(e); }
    return file;
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  async function save(e) {
    e.preventDefault();
    var title = $("#pr-title").value.trim(), err = $("#pr-error");
    function bad(k) { err.textContent = t(k); err.classList.remove("hidden"); }
    if (!title) return bad("sh2_e_title");
    var priceRaw = $("#pr-price").value.trim(), price = priceRaw ? parseNum(priceRaw) : null;
    if (priceRaw && !(price >= 0)) return bad("sh2_e_price");
    var btn = $("#pr-save");
    btn.disabled = true;
    var db = c.db(), oldPath = sh.edit ? sh.edit.photo_path : null, newPath = oldPath, uploaded = null;
    try {
      if (sh.file) {
        var blob = await compress(sh.file);
        uploaded = state.ws.id + "/" + uid() + ".jpg";
        var up = await db.storage.from(BUCKET).upload(uploaded, blob, { contentType: "image/jpeg", upsert: false });
        if (up.error) throw up.error;
        newPath = uploaded;
      } else if (sh.removePhoto) {
        newPath = null;
      }
      var row = {
        title: title.slice(0, 160), price: price, currency: $("#pr-currency").value,
        description: $("#pr-desc").value.trim().slice(0, 1500) || null,
        is_active: $("#pr-active").checked, photo_path: newPath
      };
      var res = sh.edit
        ? await db.from("shop_products").update(row).eq("id", sh.edit.id)
        : await db.from("shop_products").insert(Object.assign({ workspace_id: state.ws.id }, row));
      if (res.error) throw res.error;
      // старое фото больше не нужно — удаляем, чтобы не занимало место
      if (oldPath && oldPath !== newPath) await db.storage.from(BUCKET).remove([oldPath]);
      c.closeModal("modal-product");
      toast(t("sh2_saved"), "ok");
      await load();
    } catch (x) {
      if (uploaded) { try { await db.storage.from(BUCKET).remove([uploaded]); } catch (y) { /* ignore */ } }
      c.handleError(x);
    } finally {
      btn.disabled = false;
    }
  }

  async function remove() {
    var p = sh.edit;
    if (!p || !window.confirm(t("sh2_confirm_del", { n: p.title }))) return;
    var res = await c.db().from("shop_products").delete().eq("id", p.id);
    if (res.error) { c.handleError(res.error); return; }
    if (p.photo_path) { try { await c.db().storage.from(BUCKET).remove([p.photo_path]); } catch (e) { /* ignore */ } }
    c.closeModal("modal-product");
    toast(t("deleted"), "ok");
    load();
  }

  async function makeLink() {
    var res = await c.db().rpc("request_link_rotate", { p_ws: state.ws.id });
    if (res.error) { c.handleError(res.error); return; }
    state.ws.request_token = res.data;
    if (state.myWs && state.myWs.id === state.ws.id) state.myWs.request_token = res.data;
    renderLink();
    var ok = await c.copyText(shopUrl(res.data));
    toast(ok ? t("rl_created_copied") : t("rl_created"), "ok");
  }

  function bind() {
    $("#shop-add").addEventListener("click", function () { openEdit(null); });
    $("#tab-shop").addEventListener("click", async function (e) {
      var ed = e.target.closest("[data-shop-edit]");
      if (ed) { if (state.readOnly) return; openEdit(sh.list.filter(function (p) { return p.id === ed.getAttribute("data-shop-edit"); })[0]); return; }
      var b = e.target.closest("[data-shop]");
      if (!b) return;
      var a = b.getAttribute("data-shop");
      if (a === "mklink") makeLink();
      else if (a === "copy") {
        var ok = await c.copyText(shopUrl(state.ws.request_token));
        toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
      }
    });
    $("#product-form").addEventListener("submit", save);
    $("#pr-delete").addEventListener("click", remove);
    $("#pr-pick").addEventListener("click", function () { $("#pr-file").click(); });
    $("#pr-file").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type)) { toast(t("sh2_e_photo"), "error"); return; }
      sh.file = f; sh.removePhoto = false;
      preview(URL.createObjectURL(f));
    });
    $("#pr-photo-del").addEventListener("click", function () { sh.file = null; sh.removePhoto = true; $("#pr-file").value = ""; preview(""); });
  }

  function open() { render(); load(); }

  U.shop = { initPublic: initPublic, renderPublic: renderPublic, bind: bind, open: open, refresh: render };
})(window.ULA);
