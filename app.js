// =====================================================
// CARGO CHINA — основная логика
// Работает вместе с Supabase (база, вход, фото).
// =====================================================
(function () {
  "use strict";

  var STATUSES = [
    "new", "awaiting_payment", "purchasing", "china_warehouse",
    "in_transit", "arrived", "delivered", "cancelled"
  ];
  var BUCKET = "order-photos";
  var PAGE_SIZE = 60;

  var db = null;            // клиент Supabase
  var mode = "admin";       // "admin" или "client"
  var state = {
    orders: [],
    status: "all",
    q: "",
    from: "",
    to: "",
    limit: PAGE_SIZE,
    loading: false,
    detailId: null,
    statusId: null,
    client: null,
    clientState: "loading"  // loading | ok | notfound | error
  };
  var form = { editing: null, existing: [], removed: [], pending: [], saving: false };
  var lb = { urls: [], i: 0 };
  var toastTimer = null;

  // ---------- Помощники ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function safeUrl(u) {
    u = String(u || "").trim();
    return /^https?:\/\//i.test(u) ? u : "";
  }

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function locale() { return getLang() === "zh" ? "zh-CN" : "ru-RU"; }

  function money(n) {
    return num(n).toLocaleString(locale(), { maximumFractionDigits: 2 });
  }

  function parseNum(v) {
    var n = Number(String(v == null ? "" : v).replace(/\s/g, "").replace(",", "."));
    return isFinite(n) && n > 0 ? n : 0;
  }

  function numStr(v) {
    var n = num(v);
    return n === 0 ? "" : String(n);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fmtDate(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    if (p.length !== 3) return esc(s);
    return getLang() === "zh" ? p[0] + "-" + p[1] + "-" + p[2] : p[2] + "." + p[1] + "." + p[0];
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function toast(msg, kind) {
    var el = $("#toast");
    el.textContent = msg;
    el.className = "toast show " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "toast"; }, 3200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  function handleError(err) {
    console.error(err);
    var msg = String((err && err.message) || "");
    if (err && err.code === "23505") toast(t("dup_number"), "error");
    else if (err && (err.status === 401 || err.code === "42501" || /JWT|not authenticated/i.test(msg))) toast(t("error_session"), "error");
    else toast(t("error_generic"), "error");
  }

  function showView(name) {
    ["config", "login", "admin", "client"].forEach(function (v) {
      $("#view-" + v).classList.toggle("hidden", v !== name);
    });
  }

  function photoUrl(path) {
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function sortedPhotos(o) {
    return (o.order_photos || []).slice().sort(function (a, b) {
      return String(a.created_at).localeCompare(String(b.created_at));
    });
  }

  function photoUrls(o) {
    return sortedPhotos(o).map(function (p) { return photoUrl(p.storage_path); });
  }

  function clientUrl(o) {
    var base = location.origin + location.pathname.replace(/index\.html$/, "");
    return base + "?order=" + o.public_token;
  }

  // ---------- Запуск ----------
  var started = false;
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    if (started) return;
    started = true;
    applyI18n();
    setCurrency();
    bindCommon();

    var cfg = window.CARGO_CONFIG || {};
    var url = String(cfg.SUPABASE_URL || "").trim();
    var key = String(cfg.SUPABASE_ANON_KEY || "").trim();
    var urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url);

    if (!urlOk || key.length < 20 || key.indexOf("ВСТАВЬТЕ") !== -1) {
      showView("config");
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      $("#config-text").textContent = t("lib_missing");
      showView("config");
      return;
    }

    db = window.supabase.createClient(url, key);

    var token = new URLSearchParams(location.search).get("order");
    if (token) {
      mode = "client";
      initClient(token);
    } else {
      mode = "admin";
      initAdmin();
    }
  }

  function setCurrency() {
    $$(".cur").forEach(function (el) { el.textContent = t("som"); });
  }

  // ---------- Общие обработчики ----------
  function bindCommon() {
    // переключатель языка
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lang]");
      if (!b) return;
      setLang(b.getAttribute("data-lang"));
      onLangChange();
    });

    // закрытие окон
    document.addEventListener("click", function (e) {
      var c = e.target.closest("[data-close]");
      if (c) {
        var m = c.closest(".modal");
        if (m) closeModal(m.id);
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if ($("#lightbox").classList.contains("open")) { closeLightbox(); return; }
        var open = $$(".modal.open");
        if (open.length) closeModal(open[open.length - 1].id);
      } else if ($("#lightbox").classList.contains("open")) {
        if (e.key === "ArrowLeft") lbStep(-1);
        if (e.key === "ArrowRight") lbStep(1);
      }
    });

    // просмотр фото
    $("#lightbox").addEventListener("click", function (e) {
      if (e.target.closest("[data-lb-prev]")) return lbStep(-1);
      if (e.target.closest("[data-lb-next]")) return lbStep(1);
      if (e.target.closest("[data-lb-close]") || e.target.id === "lightbox") closeLightbox();
    });
    var touchX = null;
    $("#lightbox").addEventListener("touchstart", function (e) { touchX = e.changedTouches[0].clientX; }, { passive: true });
    $("#lightbox").addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function onLangChange() {
    setCurrency();
    if (mode === "client") {
      renderClient();
      return;
    }
    if (!$("#view-admin").classList.contains("hidden")) {
      renderAll();
      if ($("#modal-detail").classList.contains("open")) renderDetail();
      if ($("#modal-status").classList.contains("open")) renderStatusList();
      if ($("#modal-order").classList.contains("open")) {
        fillStatusSelect($("#f-status").value);
        $("#order-form-title").textContent = t(form.editing ? "edit_order" : "new_order");
        updateCalc();
      }
    }
  }

  // ---------- Окна ----------
  function updateScrollLock() {
    var any = $$(".modal.open").length > 0 || $("#lightbox").classList.contains("open");
    document.body.classList.toggle("no-scroll", any);
  }

  function openModal(id) {
    var m = $("#" + id);
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    updateScrollLock();
  }

  function closeModal(id) {
    var m = $("#" + id);
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
    if (id === "modal-detail") state.detailId = null;
    if (id === "modal-order") releasePending();
    updateScrollLock();
  }

  function openLightbox(urls, i) {
    if (!urls.length) return;
    lb.urls = urls;
    lb.i = Math.max(0, Math.min(i, urls.length - 1));
    lbShow();
    $("#lightbox").classList.add("open");
    $("#lightbox").setAttribute("aria-hidden", "false");
    updateScrollLock();
  }

  function closeLightbox() {
    $("#lightbox").classList.remove("open");
    $("#lightbox").setAttribute("aria-hidden", "true");
    $("#lb-img").removeAttribute("src");
    updateScrollLock();
  }

  function lbShow() {
    $("#lb-img").src = lb.urls[lb.i];
    $("#lb-count").textContent = lb.urls.length > 1 ? (lb.i + 1) + " / " + lb.urls.length : "";
    $$(".lb-nav").forEach(function (b) { b.style.display = lb.urls.length > 1 ? "" : "none"; });
  }

  function lbStep(d) {
    if (lb.urls.length < 2) return;
    lb.i = (lb.i + d + lb.urls.length) % lb.urls.length;
    lbShow();
  }

  // =====================================================
  //  АДМИНКА
  // =====================================================
  var adminBound = false;

  async function initAdmin() {
    bindAdminUI();
    db.auth.onAuthStateChange(function (event) {
      if (event === "SIGNED_OUT" && mode === "admin") {
        state.orders = [];
        showView("login");
      }
    });
    var res = await db.auth.getSession();
    var session = res && res.data && res.data.session;
    if (session) await enterAdmin(session.user);
    else showView("login");
  }

  async function enterAdmin(user) {
    var res = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (res.error || !res.data) {
      await db.auth.signOut();
      showView("login");
      setLoginError(t("no_access"));
      return;
    }
    setLoginError("");
    showView("admin");
    renderWarehouse();
    await loadOrders();
  }

  function setLoginError(msg) {
    var el = $("#login-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  function bindAdminUI() {
    if (adminBound) return;
    adminBound = true;

    // вход
    $("#login-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = $("#login-btn");
      btn.disabled = true;
      btn.textContent = t("logging_in");
      setLoginError("");
      try {
        var res = await db.auth.signInWithPassword({
          email: $("#login-email").value.trim(),
          password: $("#login-password").value
        });
        if (res.error) setLoginError(t("login_error"));
        else await enterAdmin(res.data.user);
      } catch (err) {
        console.error(err);
        setLoginError(t("error_generic"));
      } finally {
        btn.disabled = false;
        btn.textContent = t("login_btn");
      }
    });

    $("#logout-btn").addEventListener("click", async function () {
      await db.auth.signOut();
      state.orders = [];
      $("#login-password").value = "";
      showView("login");
    });

    // склад
    $("#wh-copy").addEventListener("click", async function () {
      var ok = await copyText(((window.CARGO_CONFIG || {}).WAREHOUSE || {}).address || "");
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });

    // поиск и фильтры
    $("#search").addEventListener("input", function (e) { state.q = e.target.value; state.limit = PAGE_SIZE; renderOrders(); });
    $("#date-from").addEventListener("change", function (e) { state.from = e.target.value; state.limit = PAGE_SIZE; renderOrders(); });
    $("#date-to").addEventListener("change", function (e) { state.to = e.target.value; state.limit = PAGE_SIZE; renderOrders(); });
    $("#reset-filters").addEventListener("click", function () {
      state.q = ""; state.from = ""; state.to = ""; state.status = "all"; state.limit = PAGE_SIZE;
      $("#search").value = ""; $("#date-from").value = ""; $("#date-to").value = "";
      renderChips(); renderOrders();
    });
    $("#chips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-status]");
      if (!b) return;
      state.status = b.getAttribute("data-status");
      state.limit = PAGE_SIZE;
      renderChips();
      renderOrders();
    });

    // список заказов и карточка
    $("#orders").addEventListener("click", onOrdersClick);
    $("#detail-body").addEventListener("click", onOrdersClick);

    // новый заказ
    $("#new-order").addEventListener("click", function () { openOrderForm(null); });
    $("#fab").addEventListener("click", function () { openOrderForm(null); });

    // форма
    $("#order-form").addEventListener("submit", saveOrder);
    ["quantity", "unit_price_cny", "exchange_rate", "delivery_cost", "paid_amount"].forEach(function (id) {
      $("#f-" + id).addEventListener("input", updateCalc);
    });
    $("#f-photos").addEventListener("change", function (e) {
      Array.prototype.slice.call(e.target.files).forEach(function (file) {
        if (file.type && file.type.indexOf("image/") === 0) {
          form.pending.push({ file: file, preview: URL.createObjectURL(file) });
        }
      });
      e.target.value = "";
      renderPhotoPreviews();
    });
    $("#photo-previews").addEventListener("click", function (e) {
      var ex = e.target.closest("[data-rm-existing]");
      var pe = e.target.closest("[data-rm-pending]");
      if (ex) {
        var id = ex.getAttribute("data-rm-existing");
        var found = form.existing.filter(function (p) { return p.id === id; })[0];
        if (found) {
          form.removed.push(found);
          form.existing = form.existing.filter(function (p) { return p.id !== id; });
        }
      } else if (pe) {
        var idx = Number(pe.getAttribute("data-rm-pending"));
        URL.revokeObjectURL(form.pending[idx].preview);
        form.pending.splice(idx, 1);
      } else {
        return;
      }
      renderPhotoPreviews();
    });

    // статус
    $("#status-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-status]");
      if (b && state.statusId) setStatus(state.statusId, b.getAttribute("data-status"));
    });

    // ссылка клиенту
    $("#link-copy").addEventListener("click", async function () {
      var ok = await copyText($("#link-input").value);
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
    $("#link-input").addEventListener("focus", function (e) { e.target.select(); });
  }

  // ---------- Загрузка заказов ----------
  async function loadOrders() {
    state.loading = true;
    $("#loading").classList.remove("hidden");
    var rows = [];
    try {
      for (var from = 0; ; from += 1000) {
        var res = await db.from("orders")
          .select("*, order_photos(id, storage_path, created_at)")
          .order("order_date", { ascending: false })
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (res.error) throw res.error;
        rows = rows.concat(res.data);
        if (res.data.length < 1000) break;
      }
      state.orders = rows;
    } catch (err) {
      handleError(err);
    }
    state.loading = false;
    $("#loading").classList.add("hidden");
    renderAll();
  }

  // ---------- Отрисовка админки ----------
  function renderAll() {
    renderSummary();
    renderChips();
    renderOrders();
  }

  function renderWarehouse() {
    var w = (window.CARGO_CONFIG || {}).WAREHOUSE || {};
    $("#wh-address").textContent = w.address || "";
    $("#wh-contacts").innerHTML = (w.contacts || []).map(function (c) {
      return '<a class="contact" href="tel:' + esc(c.phone) + '"><span lang="zh-CN">' + esc(c.name) + "</span> " + esc(c.phone) + "</a>";
    }).join("");
  }

  function renderSummary() {
    var active = state.orders.filter(function (o) { return o.status !== "cancelled"; });
    var total = 0, paid = 0, debt = 0;
    active.forEach(function (o) {
      total += num(o.total_som);
      paid += num(o.paid_amount);
      debt += Math.max(0, num(o.balance_som));
    });
    $("#sum-orders").textContent = money(state.orders.length);
    $("#sum-total").textContent = money(total);
    $("#sum-paid").textContent = money(paid);
    $("#sum-debt").textContent = money(debt);
  }

  function renderChips() {
    var counts = {};
    STATUSES.forEach(function (s) { counts[s] = 0; });
    state.orders.forEach(function (o) { if (counts[o.status] !== undefined) counts[o.status]++; });
    var items = [["all", state.orders.length]].concat(STATUSES.map(function (s) { return [s, counts[s]]; }));
    $("#chips").innerHTML = items.map(function (it) {
      var key = it[0];
      return '<button type="button" class="chip chip-' + key + (state.status === key ? " active" : "") +
        '" data-status="' + key + '" role="tab" aria-selected="' + (state.status === key) + '">' +
        "<span>" + esc(t("filter_" + key)) + "</span><b>" + it[1] + "</b></button>";
    }).join("");
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var qDigits = q.replace(/\D/g, "");
    return state.orders.filter(function (o) {
      if (state.status !== "all" && o.status !== state.status) return false;
      if (state.from && o.order_date < state.from) return false;
      if (state.to && o.order_date > state.to) return false;
      if (!q) return true;
      var hay = [o.order_number, o.client_name, o.client_phone, o.client_wechat, o.product_ru, o.product_zh, o.supplier]
        .filter(Boolean).join(" ").toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      if (qDigits.length >= 3 && String(o.client_phone || "").replace(/\D/g, "").indexOf(qDigits) !== -1) return true;
      return false;
    });
  }

  function renderOrders() {
    var box = $("#orders");
    var empty = $("#empty");
    if (state.loading) return;

    if (!state.orders.length) {
      box.innerHTML = "";
      empty.innerHTML = "<strong>" + esc(t("empty_title")) + "</strong><br>" + esc(t("empty_text"));
      empty.classList.remove("hidden");
      return;
    }
    var list = filtered();
    if (!list.length) {
      box.innerHTML = "";
      empty.textContent = t("nothing_found");
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    var shown = list.slice(0, state.limit);
    box.innerHTML = shown.map(cardHtml).join("") +
      (list.length > shown.length
        ? '<button type="button" class="btn btn-block more" data-act="more">' + esc(t("show_more")) + " (" + (list.length - shown.length) + ")</button>"
        : "");
  }

  function specsHtml(o) {
    return '<dl class="specs">' +
      "<div><dt>" + t("l_qty") + "</dt><dd>" + money(o.quantity) + " " + t("pcs") + "</dd></div>" +
      "<div><dt>" + t("l_price") + "</dt><dd>¥ " + money(o.unit_price_cny) + "</dd></div>" +
      "<div><dt>" + t("l_rate") + "</dt><dd>" + money(o.exchange_rate) + "</dd></div>" +
      "<div><dt>" + t("l_weight") + "</dt><dd>" + money(o.weight_kg) + " " + t("kg") + "</dd></div>" +
      "</dl>";
  }

  function moneyHtml(o) {
    var bal = num(o.balance_som);
    return '<dl class="money">' +
      "<div><dt>" + t("l_goods_som") + "</dt><dd>" + money(o.goods_som) + "</dd></div>" +
      "<div><dt>" + t("l_delivery") + "</dt><dd>" + money(o.delivery_cost) + "</dd></div>" +
      '<div class="money-total"><dt>' + t("l_total") + "</dt><dd>" + money(o.total_som) + " " + t("som") + "</dd></div>" +
      "<div><dt>" + t("l_paid") + "</dt><dd>" + money(o.paid_amount) + "</dd></div>" +
      '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + t("l_balance") + "</dt><dd>" + money(bal) + " " + t("som") + "</dd></div>" +
      "</dl>";
  }

  function thumbsHtml(urls, max) {
    var shown = max ? urls.slice(0, max) : urls;
    var html = shown.map(function (u, i) {
      return '<button type="button" class="thumb" data-act="photo" data-i="' + i + '"><img src="' + esc(u) + '" loading="lazy" alt=""></button>';
    }).join("");
    if (max && urls.length > max) {
      html += '<button type="button" class="thumb thumb-more" data-act="open">+' + (urls.length - max) + "</button>";
    }
    return html;
  }

  function cardHtml(o) {
    var urls = photoUrls(o);
    var link = safeUrl(o.supplier_link);
    return '' +
      '<article class="card st-' + o.status + '" data-id="' + esc(o.id) + '">' +
        '<div class="card-head">' +
          "<div>" +
            '<div class="order-no">№ ' + esc(o.order_number) + "</div>" +
            '<div class="card-sub"><span>' + esc(o.client_name) + '</span><span class="card-date">' + fmtDate(o.order_date) + "</span></div>" +
          "</div>" +
          '<span class="pill st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span>" +
        "</div>" +
        '<div class="card-product"><h3>' + esc(o.product_ru) + "</h3>" +
          (o.product_zh ? '<p lang="zh-CN">' + esc(o.product_zh) + "</p>" : "") + "</div>" +
        (urls.length ? '<div class="thumbs">' + thumbsHtml(urls, 4) + "</div>" : "") +
        specsHtml(o) +
        moneyHtml(o) +
        '<p class="meta"><span>' + t("l_supplier") + "</span> " + esc(o.supplier || "—") +
          (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener">1688</a>' : "") + "</p>" +
        (o.admin_comment ? '<p class="note">' + esc(o.admin_comment) + "</p>" : "") +
        '<div class="card-actions">' +
          '<button type="button" class="btn btn-primary" data-act="open">' + t("open") + "</button>" +
          '<button type="button" class="btn" data-act="edit">' + t("edit") + "</button>" +
          '<button type="button" class="btn" data-act="status">' + t("change_status") + "</button>" +
          '<button type="button" class="btn" data-act="link">' + t("client_link") + "</button>" +
          '<button type="button" class="btn btn-danger" data-act="delete">' + t("remove") + "</button>" +
        "</div>" +
      "</article>";
  }

  // ---------- Клики по карточкам ----------
  function onOrdersClick(e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var act = btn.getAttribute("data-act");
    if (act === "more") {
      state.limit += PAGE_SIZE;
      renderOrders();
      return;
    }
    var holder = btn.closest("[data-id]");
    var o = holder && state.orders.filter(function (x) { return x.id === holder.getAttribute("data-id"); })[0];
    if (!o) return;
    if (act === "photo") {
      openLightbox(photoUrls(o), Number(btn.getAttribute("data-i")) || 0);
      return;
    }
    runAction(act, o);
  }

  function runAction(act, o) {
    if (act === "open") openDetail(o.id);
    else if (act === "edit") { closeModal("modal-detail"); openOrderForm(o); }
    else if (act === "status") openStatus(o);
    else if (act === "link") openLink(o);
    else if (act === "delete") deleteOrder(o);
  }

  // ---------- Подробная карточка ----------
  function openDetail(id) {
    state.detailId = id;
    renderDetail();
    openModal("modal-detail");
  }

  function renderDetail() {
    var o = state.orders.filter(function (x) { return x.id === state.detailId; })[0];
    if (!o) { closeModal("modal-detail"); return; }
    var urls = photoUrls(o);
    var link = safeUrl(o.supplier_link);
    var phone = o.client_phone ? '<a href="tel:' + esc(o.client_phone) + '">' + esc(o.client_phone) + "</a>" : "—";

    $("#detail-title").textContent = t("detail_title", { n: o.order_number });
    $("#detail-body").innerHTML =
      '<div data-id="' + esc(o.id) + '" class="detail">' +
        '<div class="detail-top"><span class="pill st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span>" +
          '<span class="muted">' + fmtDate(o.order_date) + "</span></div>" +
        '<div class="card-product"><h3>' + esc(o.product_ru) + "</h3>" +
          (o.product_zh ? '<p lang="zh-CN">' + esc(o.product_zh) + "</p>" : "") + "</div>" +
        (urls.length ? '<div class="thumbs thumbs-large">' + thumbsHtml(urls, 0) + "</div>" : "") +
        specsHtml(o) +
        moneyHtml(o) +
        '<dl class="info">' +
          "<div><dt>" + t("f_client") + "</dt><dd>" + esc(o.client_name) + "</dd></div>" +
          "<div><dt>" + t("l_phone") + "</dt><dd>" + phone + "</dd></div>" +
          "<div><dt>" + t("l_wechat") + "</dt><dd>" + esc(o.client_wechat || "—") + "</dd></div>" +
          "<div><dt>" + t("l_supplier") + "</dt><dd>" + esc(o.supplier || "—") + "</dd></div>" +
          (link ? "<div><dt>" + t("l_link") + '</dt><dd><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(link) + "</a></dd></div>" : "") +
          (o.delivery_info ? "<div><dt>" + t("l_delivery_info") + "</dt><dd>" + esc(o.delivery_info) + "</dd></div>" : "") +
          (o.client_comment ? "<div><dt>" + t("l_comment_client") + "</dt><dd>" + esc(o.client_comment) + "</dd></div>" : "") +
          (o.admin_comment ? "<div><dt>" + t("l_comment_admin") + "</dt><dd>" + esc(o.admin_comment) + "</dd></div>" : "") +
        "</dl>" +
        '<div class="card-actions">' +
          '<button type="button" class="btn btn-primary" data-act="edit">' + t("edit") + "</button>" +
          '<button type="button" class="btn" data-act="status">' + t("change_status") + "</button>" +
          '<button type="button" class="btn" data-act="link">' + t("client_link") + "</button>" +
          '<button type="button" class="btn btn-danger" data-act="delete">' + t("remove") + "</button>" +
        "</div>" +
      "</div>";
  }

  // ---------- Статус ----------
  function openStatus(o) {
    state.statusId = o.id;
    renderStatusList();
    openModal("modal-status");
  }

  function renderStatusList() {
    var o = state.orders.filter(function (x) { return x.id === state.statusId; })[0];
    if (!o) return;
    $("#status-list").innerHTML = STATUSES.map(function (s) {
      return '<button type="button" class="status-option st-' + s + (o.status === s ? " current" : "") +
        '" data-status="' + s + '"><span class="dot"></span>' + esc(t("status_" + s)) + "</button>";
    }).join("");
  }

  async function setStatus(id, status) {
    var res = await db.from("orders").update({ status: status }).eq("id", id);
    if (res.error) { handleError(res.error); return; }
    var o = state.orders.filter(function (x) { return x.id === id; })[0];
    if (o) o.status = status;
    closeModal("modal-status");
    renderAll();
    if ($("#modal-detail").classList.contains("open")) renderDetail();
    toast(t("status_changed"), "ok");
  }

  // ---------- Ссылка клиенту ----------
  function openLink(o) {
    var url = clientUrl(o);
    $("#link-input").value = url;
    $("#link-wa").href = "https://wa.me/?text=" + encodeURIComponent(t("wa_text", { n: o.order_number }) + " " + url);
    $("#link-open").href = url;
    openModal("modal-link");
    copyText(url).then(function (ok) { if (ok) toast(t("copied"), "ok"); });
  }

  // ---------- Удаление ----------
  async function deleteOrder(o) {
    if (!window.confirm(t("confirm_delete", { n: o.order_number }))) return;
    try {
      var paths = (o.order_photos || []).map(function (p) { return p.storage_path; });
      if (paths.length) await db.storage.from(BUCKET).remove(paths);
      var res = await db.from("orders").delete().eq("id", o.id);
      if (res.error) throw res.error;
      closeModal("modal-detail");
      state.orders = state.orders.filter(function (x) { return x.id !== o.id; });
      renderAll();
      toast(t("deleted"), "ok");
    } catch (err) {
      handleError(err);
    }
  }

  // ---------- Форма заказа ----------
  function nextOrderNumber() {
    var d = new Date();
    var prefix = "CC-" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + "-";
    var used = {};
    state.orders.forEach(function (o) { used[o.order_number] = true; });
    var n = 1;
    while (used[prefix + pad(n)]) n++;
    return prefix + pad(n);
  }

  function fillStatusSelect(value) {
    $("#f-status").innerHTML = STATUSES.map(function (s) {
      return '<option value="' + s + '">' + esc(t("status_" + s)) + "</option>";
    }).join("");
    $("#f-status").value = value || "new";
  }

  function releasePending() {
    form.pending.forEach(function (p) { URL.revokeObjectURL(p.preview); });
    form.pending = [];
  }

  function openOrderForm(o) {
    releasePending();
    form.editing = o || null;
    form.existing = o ? sortedPhotos(o) : [];
    form.removed = [];

    var set = function (id, v) { $("#f-" + id).value = v == null ? "" : v; };
    $("#order-form-title").textContent = t(o ? "edit_order" : "new_order");
    fillStatusSelect(o ? o.status : "new");

    if (o) {
      set("order_number", o.order_number);
      set("order_date", o.order_date);
      set("client_name", o.client_name);
      set("client_phone", o.client_phone);
      set("client_wechat", o.client_wechat);
      set("product_ru", o.product_ru);
      set("product_zh", o.product_zh);
      set("supplier", o.supplier);
      set("supplier_link", o.supplier_link);
      set("quantity", numStr(o.quantity));
      set("unit_price_cny", numStr(o.unit_price_cny));
      set("exchange_rate", numStr(o.exchange_rate));
      set("weight_kg", numStr(o.weight_kg));
      set("delivery_cost", numStr(o.delivery_cost));
      set("paid_amount", numStr(o.paid_amount));
      set("delivery_info", o.delivery_info);
      set("client_comment", o.client_comment);
      set("admin_comment", o.admin_comment);
    } else {
      var lastRate = "";
      try { lastRate = localStorage.getItem("cc_rate") || ""; } catch (e) { /* ignore */ }
      set("order_number", nextOrderNumber());
      set("order_date", todayISO());
      ["client_name", "client_phone", "client_wechat", "product_ru", "product_zh", "supplier",
        "supplier_link", "unit_price_cny", "weight_kg", "delivery_info", "client_comment", "admin_comment"
      ].forEach(function (id) { set(id, ""); });
      set("quantity", "1");
      set("exchange_rate", lastRate);
      set("delivery_cost", "");
      set("paid_amount", "");
    }
    updateCalc();
    renderPhotoPreviews();
    openModal("modal-order");
    var body = $("#order-form .modal-body");
    if (body) body.scrollTop = 0;
  }

  function updateCalc() {
    var q = parseNum($("#f-quantity").value);
    var p = parseNum($("#f-unit_price_cny").value);
    var r = parseNum($("#f-exchange_rate").value);
    var d = parseNum($("#f-delivery_cost").value);
    var paid = parseNum($("#f-paid_amount").value);
    var goodsCny = q * p;
    var goodsSom = goodsCny * r;
    var total = goodsSom + d;
    var bal = total - paid;
    $("#calc-goods-cny").textContent = money(q) + " × ¥ " + money(p) + " = ¥ " + money(goodsCny);
    $("#calc-goods-som").textContent = money(goodsCny) + " × " + money(r) + " = " + money(goodsSom) + " " + t("som");
    $("#calc-delivery").textContent = money(d) + " " + t("som");
    $("#calc-total").textContent = money(total) + " " + t("som");
    $("#calc-paid").textContent = money(paid) + " " + t("som");
    $("#calc-balance").textContent = money(bal) + " " + t("som");
    $(".calc-balance").classList.toggle("owe", bal > 0);
    $(".calc-balance").classList.toggle("clear", bal <= 0);
  }

  function renderPhotoPreviews() {
    var html = "";
    form.existing.forEach(function (p) {
      html += '<div class="pv"><img src="' + esc(photoUrl(p.storage_path)) + '" alt="">' +
        '<button type="button" class="pv-x" data-rm-existing="' + esc(p.id) + '" aria-label="×">×</button></div>';
    });
    form.pending.forEach(function (p, i) {
      html += '<div class="pv"><img src="' + esc(p.preview) + '" alt="">' +
        '<button type="button" class="pv-x" data-rm-pending="' + i + '" aria-label="×">×</button></div>';
    });
    $("#photo-previews").innerHTML = html;
  }

  function readForm() {
    var val = function (id) { return $("#f-" + id).value.trim(); };
    var link = val("supplier_link");
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    return {
      order_number: val("order_number"),
      order_date: val("order_date") || todayISO(),
      status: val("status") || "new",
      client_name: val("client_name"),
      client_phone: val("client_phone") || null,
      client_wechat: val("client_wechat") || null,
      product_ru: val("product_ru"),
      product_zh: val("product_zh") || null,
      supplier: val("supplier") || null,
      supplier_link: link || null,
      quantity: parseNum(val("quantity")),
      unit_price_cny: parseNum(val("unit_price_cny")),
      exchange_rate: parseNum(val("exchange_rate")),
      weight_kg: parseNum(val("weight_kg")),
      delivery_cost: parseNum(val("delivery_cost")),
      paid_amount: parseNum(val("paid_amount")),
      delivery_info: val("delivery_info") || null,
      client_comment: val("client_comment") || null,
      admin_comment: val("admin_comment") || null
    };
  }

  async function compressImage(file) {
    try {
      var bmp = await createImageBitmap(file);
      var maxSide = 1600;
      var scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      var w = Math.round(bmp.width * scale);
      var h = Math.round(bmp.height * scale);
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", 0.82); });
      if (blob) return blob;
    } catch (e) {
      console.warn("Не удалось сжать фото, загружаем как есть", e);
    }
    return file;
  }

  async function uploadPhoto(orderId, file) {
    var blob = await compressImage(file);
    var type = blob.type || "image/jpeg";
    var ext = type === "image/jpeg" ? "jpg" : (type.split("/")[1] || "jpg");
    var path = orderId + "/" + uid() + "." + ext;
    var up = await db.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (up.error) throw up.error;
    var ins = await db.from("order_photos").insert({ order_id: orderId, storage_path: path });
    if (ins.error) {
      await db.storage.from(BUCKET).remove([path]);
      throw ins.error;
    }
  }

  async function saveOrder(e) {
    e.preventDefault();
    if (form.saving) return;
    var v = readForm();
    if (!v.order_number || !v.client_name || !v.product_ru) {
      toast(t("req_fields"), "error");
      return;
    }
    var btn = $("#order-save");
    form.saving = true;
    btn.disabled = true;
    btn.textContent = t("saving");

    try {
      var orderId;
      if (form.editing) {
        var upd = await db.from("orders").update(v).eq("id", form.editing.id);
        if (upd.error) throw upd.error;
        orderId = form.editing.id;
      } else {
        var ins = await db.from("orders").insert(v).select("id").single();
        if (ins.error) throw ins.error;
        orderId = ins.data.id;
      }
      if (v.exchange_rate > 0) {
        try { localStorage.setItem("cc_rate", String(v.exchange_rate)); } catch (err) { /* ignore */ }
      }

      if (form.removed.length) {
        await db.storage.from(BUCKET).remove(form.removed.map(function (p) { return p.storage_path; }));
        await db.from("order_photos").delete().in("id", form.removed.map(function (p) { return p.id; }));
      }

      var failed = 0;
      for (var i = 0; i < form.pending.length; i++) {
        try { await uploadPhoto(orderId, form.pending[i].file); }
        catch (err) { console.error(err); failed++; }
      }

      closeModal("modal-order");
      if (failed) toast(t("photo_failed", { n: failed }), "error");
      else toast(t("saved"), "ok");
      await loadOrders();
    } catch (err) {
      handleError(err);
    } finally {
      form.saving = false;
      btn.disabled = false;
      btn.textContent = t("save");
    }
  }

  // =====================================================
  //  СТРАНИЦА КЛИЕНТА (по ссылке ?order=токен)
  // =====================================================
  async function initClient(token) {
    showView("client");
    renderClient();
    $("#client-content").addEventListener("click", function (e) {
      var b = e.target.closest("[data-photo]");
      if (b && state.client) {
        openLightbox(clientPhotoUrls(), Number(b.getAttribute("data-photo")) || 0);
      }
    });

    if (!/^[a-f0-9]{32}$/i.test(token)) {
      state.clientState = "notfound";
      renderClient();
      return;
    }
    try {
      var res = await db.rpc("get_client_order", { p_token: token });
      if (res.error) throw res.error;
      state.client = res.data || null;
      state.clientState = res.data ? "ok" : "notfound";
    } catch (err) {
      console.error(err);
      state.clientState = "error";
    }
    renderClient();
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
    var flow = STATUSES.filter(function (s) { return s !== "cancelled"; });
    var idx = flow.indexOf(o.status);

    var steps = o.status === "cancelled"
      ? '<p class="cancelled-note">' + esc(t("cl_cancelled")) + "</p>"
      : '<ol class="steps">' + flow.map(function (s, i) {
          return '<li class="' + (i < idx ? "done" : i === idx ? "current" : "") + '"><span class="dot"></span><span>' +
            esc(t("status_" + s)) + "</span></li>";
        }).join("") + "</ol>";

    box.innerHTML =
      '<section class="client-head">' +
        "<h1>" + esc(t("cl_order", { n: o.order_number })) + "</h1>" +
        '<p class="muted">' + fmtDate(o.order_date) + "</p>" +
      "</section>" +

      '<section class="client-block">' +
        '<div class="client-status"><h2>' + esc(t("cl_status")) + '</h2><span class="pill st-' + o.status + '">' +
          esc(t("status_" + o.status)) + "</span></div>" + steps +
      "</section>" +

      '<section class="client-block">' +
        "<h2>" + esc(t("cl_product")) + "</h2>" +
        '<div class="card-product"><h3>' + esc(o.product_ru) + "</h3>" +
          (o.product_zh ? '<p lang="zh-CN">' + esc(o.product_zh) + "</p>" : "") + "</div>" +
        (urls.length ? '<div class="thumbs thumbs-large">' + urls.map(function (u, i) {
          return '<button type="button" class="thumb" data-photo="' + i + '"><img src="' + esc(u) + '" loading="lazy" alt=""></button>';
        }).join("") + "</div>" : "") +
        '<dl class="specs specs-2">' +
          "<div><dt>" + t("l_qty") + "</dt><dd>" + money(o.quantity) + " " + t("pcs") + "</dd></div>" +
          "<div><dt>" + t("l_weight") + "</dt><dd>" + money(o.weight_kg) + " " + t("kg") + "</dd></div>" +
        "</dl>" +
      "</section>" +

      '<section class="client-block">' +
        "<h2>" + esc(t("cl_payment")) + "</h2>" +
        '<dl class="money">' +
          (num(o.delivery_cost) > 0 ? "<div><dt>" + t("l_delivery") + "</dt><dd>" + money(o.delivery_cost) + " " + t("som") + "</dd></div>" : "") +
          '<div class="money-total"><dt>' + t("l_total") + "</dt><dd>" + money(o.total_som) + " " + t("som") + "</dd></div>" +
          "<div><dt>" + t("l_paid") + "</dt><dd>" + money(o.paid_amount) + " " + t("som") + "</dd></div>" +
          '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + t("l_balance") + "</dt><dd>" +
            (bal > 0 ? money(bal) + " " + t("som") : esc(t("cl_paid_full"))) + "</dd></div>" +
        "</dl>" +
      "</section>" +

      (o.delivery_info ? '<section class="client-block"><h2>' + esc(t("cl_delivery_info")) + '</h2><p class="pre">' + esc(o.delivery_info) + "</p></section>" : "") +
      (o.client_comment ? '<section class="client-block"><h2>' + esc(t("cl_comment")) + '</h2><p class="pre">' + esc(o.client_comment) + "</p></section>" : "") +

      '<p class="fine-print">' + esc(t("cl_updated")) + ": " +
        esc(new Date(o.updated_at).toLocaleDateString(locale())) + "</p>";
  }

})();
