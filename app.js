// =====================================================
// ULA FACTORY — основная логика
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
    clientState: "loading", // loading | ok | notfound | error

    // кабинет: какая вкладка открыта и список клиентов
    tab: "orders",          // "orders", "clients" или "buyers"

    // кто вошёл и какой кабинет открыт
    me: null,               // { id, email, role: "admin"|"buyer", name }
    myWs: null,             // мой кабинет
    ws: null,               // кабинет, который сейчас на экране (админ может открыть чужой)
    readOnly: false,        // true — смотрим чужой кабинет, менять нельзя
    buyers: [],             // для админа: список кабинетов
    invites: [],            // для админа: действующие приглашения
    clients: [],
    clientsQ: "",
    clientsLoading: false
  };

  // форма «Данные для доставки» на странице клиента
  var cd = {
    token: "",
    editing: false,   // true — показываем форму, false — показываем сохранённые данные
    draft: null,      // то, что клиент уже ввёл (не теряется при смене языка)
    errors: {},       // ошибки по полям: { phone: "e_phone", ... }
    saving: false
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

  function locale() { return { ru: "ru-RU", en: "en-GB", zh: "zh-CN" }[getLang()] || "ru-RU"; }

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

  // ---------- Валюты ----------
  // Байер сам выбирает валюту закупки и валюту для клиента.
  // Названия валют браузер переводит сам (Intl), поэтому список легко дополнить кодом.
  var CURRENCIES = ["CNY", "USD", "EUR", "KGS", "KZT", "UZS", "RUB", "TJS", "TRY", "AED", "AZN", "GEL", "AMD", "BYN", "MNT"];

  function curName(code) {
    try { return new Intl.DisplayNames([locale()], { type: "currency" }).of(code); } catch (e) { return code; }
  }

  function fillCurrencySelect(sel, value) {
    var list = CURRENCIES.indexOf(value) === -1 && /^[A-Z]{3}$/.test(value || "") ? CURRENCIES.concat([value]) : CURRENCIES;
    sel.innerHTML = list.map(function (c) {
      return '<option value="' + c + '">' + c + " — " + esc(curName(c)) + "</option>";
    }).join("");
    sel.value = value || list[0];
  }

  // Сумма с кодом валюты: «12 500 KGS»
  function cur(n, code) { return money(n) + " " + esc(code || ""); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fmtDate(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    if (p.length !== 3) return esc(s);
    if (getLang() === "zh") return p[0] + "-" + p[1] + "-" + p[2];
    if (getLang() === "en") return p[2] + "/" + p[1] + "/" + p[0];
    return p[2] + "." + p[1] + "." + p[0];
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
    ["config", "login", "join", "admin", "client"].forEach(function (v) {
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

    // Какая страница открыта:
    //   ?order=ТОКЕН     — страница клиента
    //   #/join/КОД       — регистрация байера по приглашению
    //   иначе            — вход и кабинет
    var token = new URLSearchParams(location.search).get("order");
    var join = location.hash.match(/^#\/join\/([a-f0-9]{32})$/i);
    if (token) {
      mode = "client";
      initClient(token);
    } else if (join) {
      mode = "join";
      initJoin(join[1].toLowerCase());
    } else {
      mode = "admin";
      initAdmin();
    }
  }

  function setCurrency() { /* валюта теперь своя у каждого заказа */ }

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
      renderClients();
      renderBuyers();
      renderWarehouse();
      renderWsBanner();
      if ($("#modal-detail").classList.contains("open")) renderDetail();
      if ($("#modal-status").classList.contains("open")) renderStatusList();
      if ($("#modal-order").classList.contains("open")) {
        fillStatusSelect($("#f-status").value);
        fillCurrencySelect($("#f-purchase_currency"), $("#f-purchase_currency").value);
        fillCurrencySelect($("#f-client_currency"), $("#f-client_currency").value);
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

  // После входа: узнаём роль (админ / байер) и кабинет пользователя
  async function enterAdmin(user) {
    var prof = await db.from("profiles").select("role, full_name, is_active").eq("user_id", user.id).maybeSingle();
    var p = prof.data;

    // Пришёл по приглашению, но кабинет при регистрации не создался — пробуем ещё раз
    var meta = user.user_metadata || {};
    if (!prof.error && !p && meta.invite_code) {
      var cl = await db.rpc("claim_invite", {
        p_code: meta.invite_code, p_full_name: meta.full_name || null,
        p_ws_name: meta.workspace_name || null, p_phone: meta.phone || null
      });
      if (!cl.error) {
        prof = await db.from("profiles").select("role, full_name, is_active").eq("user_id", user.id).maybeSingle();
        p = prof.data;
      }
    }

    if (prof.error || !p || !p.is_active) {
      await db.auth.signOut();
      showView("login");
      setLoginError(t(p && !p.is_active ? "account_blocked" : "no_access"));
      return;
    }

    var mem = await db.from("workspace_members")
      .select("role, created_at, workspace:workspaces(" + WS_FIELDS + ")")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1);
    var myWs = mem.data && mem.data[0] ? mem.data[0].workspace : null;

    // у байера обязательно должен быть кабинет; админ может работать и без своего
    if (!myWs && p.role !== "admin") {
      await db.auth.signOut();
      showView("login");
      setLoginError(t("no_access"));
      return;
    }

    state.me = { id: user.id, email: user.email, role: p.role, name: p.full_name || user.email };
    state.myWs = myWs;
    document.body.classList.toggle("is-admin", p.role === "admin");
    setLoginError("");
    showView("admin");

    if (myWs) await openWorkspace(myWs);
    else switchTab("buyers");
  }

  var WS_FIELDS = "id, name, order_prefix, warehouse_address, warehouse_contacts, default_purchase_currency, default_client_currency";

  // Открыть кабинет. Свой — можно менять. Чужой (только админ) — только смотреть.
  async function openWorkspace(ws) {
    state.ws = ws;
    state.readOnly = !(state.myWs && state.myWs.id === ws.id);
    document.body.classList.toggle("readonly", state.readOnly);
    state.orders = [];
    state.clients = [];
    state.q = ""; state.status = "all"; state.from = ""; state.to = ""; state.limit = PAGE_SIZE;
    $("#search").value = ""; $("#date-from").value = ""; $("#date-to").value = "";
    renderWsBanner();
    renderWarehouse();
    switchTab("orders");
    await loadOrders();
  }

  function renderWsBanner() {
    var on = !!(state.readOnly && state.ws);
    $("#ws-banner").classList.toggle("hidden", !on);
    $("#ws-back").classList.toggle("hidden", !state.myWs);
    if (on) $("#ws-banner-text").textContent = t("readonly_banner", { n: state.ws.name });
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
      state.clients = [];
      state.me = null; state.myWs = null; state.ws = null;
      document.body.classList.remove("is-admin", "readonly");
      switchTab("orders");
      $("#login-password").value = "";
      showView("login");
    });

    // склад
    // Копируем адрес вместе с контактами — сразу готово для отправки клиенту
    $("#wh-copy").addEventListener("click", async function () {
      var w = state.ws || {};
      var text = [w.warehouse_address, w.warehouse_contacts].filter(Boolean).join("\n");
      var ok = text ? await copyText(text) : false;
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
    $("#wh-edit").addEventListener("click", openSettings);
    $(".warehouse").addEventListener("click", function (e) {
      if (e.target.closest("[data-act='wh-add']")) openSettings();
    });
    $("#settings-form").addEventListener("submit", saveSettings);
    $("#s-prefix").addEventListener("input", function (e) {
      var v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (v !== e.target.value) e.target.value = v;
    });

    // админ: вернуться из чужого кабинета в свой
    $("#ws-back").addEventListener("click", function () { if (state.myWs) openWorkspace(state.myWs); });

    // админ: приглашения и кабинеты
    $("#invite-create").addEventListener("click", createInvite);
    $("#invite-copy").addEventListener("click", async function () {
      var ok = await copyText($("#invite-link").value);
      toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
    });
    $("#invite-link").addEventListener("focus", function (e) { e.target.select(); });
    $("#invites").addEventListener("click", function (e) {
      var b = e.target.closest("[data-invite-del]");
      if (b) deleteInvite(b.getAttribute("data-invite-del"));
    });
    $("#buyers").addEventListener("click", function (e) {
      var o = e.target.closest("[data-ws-open]");
      var bl = e.target.closest("[data-ws-block]");
      if (o) openWorkspaceById(o.getAttribute("data-ws-open"));
      else if (bl) toggleBuyer(bl.getAttribute("data-ws-block"));
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

    // вкладки «Заказы / Клиенты»
    $$(".tab").forEach(function (b) {
      b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
    });

    // клиенты: поиск, выгрузка, клик по номеру заказа
    $("#clients-search").addEventListener("input", function (e) { state.clientsQ = e.target.value; renderClients(); });
    $("#clients-export").addEventListener("click", exportClientsCsv);
    $("#clients").addEventListener("click", function (e) {
      var b = e.target.closest("[data-order-id]");
      if (b) openDetail(b.getAttribute("data-order-id"));
    });

    // список заказов и карточка
    $("#orders").addEventListener("click", onOrdersClick);
    $("#detail-body").addEventListener("click", onOrdersClick);

    // новый заказ
    $("#new-order").addEventListener("click", function () { openOrderForm(null); });
    $("#fab").addEventListener("click", function () { openOrderForm(null); });

    // форма
    $("#order-form").addEventListener("submit", saveOrder);
    $("#f-purchase_currency").addEventListener("change", onCurrencyChange);
    $("#f-client_currency").addEventListener("change", onCurrencyChange);
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
          .select("*, order_photos(id, storage_path, created_at), client:clients(id, name, phone, telegram, city, address, pickup_point)")
          .eq("workspace_id", state.ws.id)
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

  // Блок «Склад в Китае». Адрес хранится в настройках кабинета.
  // Контакты: каждая строка «имя телефон» → кнопка-звонок.
  function renderWarehouse() {
    var w = state.ws || {};
    var has = !!w.warehouse_address;
    $("#wh-address").textContent = has ? w.warehouse_address : "";
    $("#wh-copy").classList.toggle("hidden", !has);
    $("#wh-edit").classList.toggle("hidden", !has);
    var contacts = String(w.warehouse_contacts || "").split(/\n+/).map(function (line) {
      line = line.trim();
      var m = line.match(/^(.*?)[\s:,-]*(\+?[\d][\d\s()-]{4,})$/);
      return m ? { name: m[1].trim(), phone: m[2].replace(/[\s()-]/g, "") } : (line ? { name: line, phone: "" } : null);
    }).filter(Boolean);
    $("#wh-contacts").innerHTML = has ? contacts.map(function (c) {
      return c.phone
        ? '<a class="contact" href="tel:' + esc(c.phone) + '"><span lang="zh-CN">' + esc(c.name) + "</span> " + esc(c.phone) + "</a>"
        : '<span class="contact">' + esc(c.name) + "</span>";
    }).join("") : (
      '<p class="warehouse-empty">' + esc(t("wh_empty")) + "</p>" +
      (state.readOnly ? "" : '<button type="button" class="btn btn-light" data-act="wh-add">' + esc(t("wh_add")) + "</button>")
    );
  }

  // ---------- Настройки кабинета ----------
  function openSettings() {
    if (state.readOnly || !state.ws) return;
    var w = state.ws;
    $("#s-name").value = w.name || "";
    $("#s-prefix").value = w.order_prefix || "CN";
    $("#s-address").value = w.warehouse_address || "";
    $("#s-contacts").value = w.warehouse_contacts || "";
    fillCurrencySelect($("#s-def-purchase"), w.default_purchase_currency || "CNY");
    fillCurrencySelect($("#s-def-client"), w.default_client_currency || "KGS");
    setSettingsError("");
    openModal("modal-settings");
  }

  function setSettingsError(msg) {
    var el = $("#settings-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  async function saveSettings(e) {
    e.preventDefault();
    var v = {
      name: $("#s-name").value.trim(),
      order_prefix: $("#s-prefix").value.trim().toUpperCase(),
      warehouse_address: $("#s-address").value.trim() || null,
      warehouse_contacts: $("#s-contacts").value.trim() || null,
      default_purchase_currency: $("#s-def-purchase").value,
      default_client_currency: $("#s-def-client").value
    };
    if (!v.name) { setSettingsError(t("e_ws_name")); $("#s-name").focus(); return; }
    if (!/^[A-Z]{1,5}$/.test(v.order_prefix)) { setSettingsError(t("e_prefix")); $("#s-prefix").focus(); return; }

    var btn = $("#settings-save");
    btn.disabled = true;
    try {
      var res = await db.from("workspaces").update(v).eq("id", state.ws.id).select(WS_FIELDS).single();
      if (res.error) throw res.error;
      state.ws = res.data;
      if (state.myWs && state.myWs.id === res.data.id) state.myWs = res.data;
      closeModal("modal-settings");
      renderWarehouse();
      toast(t("s_saved"), "ok");
    } catch (err) {
      handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  function renderSummary() {
    var active = state.orders.filter(function (o) { return o.status !== "cancelled"; });
    // Разные валюты не складываем: считаем каждую отдельно
    var total = {}, paid = {}, debt = {};
    active.forEach(function (o) {
      var c = o.client_currency || "KGS";
      total[c] = (total[c] || 0) + num(o.total_som);
      paid[c] = (paid[c] || 0) + num(o.paid_amount);
      debt[c] = (debt[c] || 0) + Math.max(0, num(o.balance_som));
    });
    function lines(map) {
      var codes = Object.keys(map);
      if (!codes.length) return "0";
      return codes.map(function (c) { return money(map[c]) + " <small>" + esc(c) + "</small>"; }).join("<br>");
    }
    $("#sum-orders").textContent = money(state.orders.length);
    $("#sum-total").innerHTML = lines(total);
    $("#sum-paid").innerHTML = lines(paid);
    $("#sum-debt").innerHTML = lines(debt);
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
      var c = o.client || {};
      var hay = [o.order_number, o.client_name, o.client_phone, o.client_wechat, o.product_ru, o.product_zh, o.supplier, o.supplier_wechat,
        c.name, c.phone, c.telegram, c.city]
        .filter(Boolean).join(" ").toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      var phones = String(o.client_phone || "") + " " + String(c.phone || "");
      if (qDigits.length >= 3 && phones.replace(/\D/g, "").indexOf(qDigits) !== -1) return true;
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
      "<div><dt>" + t("l_price") + "</dt><dd>" + cur(o.unit_price_cny, o.purchase_currency) + "</dd></div>" +
      "<div><dt>" + t("l_rate") + "</dt><dd>" + (o.purchase_currency === o.client_currency ? "—"
        : "1 " + esc(o.purchase_currency) + " = " + cur(o.exchange_rate, o.client_currency)) + "</dd></div>" +
      "<div><dt>" + t("l_weight") + "</dt><dd>" + money(o.weight_kg) + " " + t("kg") + "</dd></div>" +
      "</dl>";
  }

  function moneyHtml(o) {
    var bal = num(o.balance_som);
    return '<dl class="money">' +
      "<div><dt>" + t("l_goods_som") + "</dt><dd>" + money(o.goods_som) + "</dd></div>" +
      "<div><dt>" + t("l_delivery") + "</dt><dd>" + money(o.delivery_cost) + "</dd></div>" +
      '<div class="money-total"><dt>' + t("l_total") + "</dt><dd>" + cur(o.total_som, o.client_currency) + "</dd></div>" +
      "<div><dt>" + t("l_paid") + "</dt><dd>" + money(o.paid_amount) + "</dd></div>" +
      '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + t("l_balance") + "</dt><dd>" + cur(bal, o.client_currency) + "</dd></div>" +
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
            '<div class="card-sub"><span>' + esc(o.client_name) + '</span><span class="card-date">' + fmtDate(o.order_date) + "</span>" +
              placeHtml(o) + "</div>" +
          "</div>" +
          '<span class="pill st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span>" +
        "</div>" +
        '<div class="card-product"><h3>' + esc(o.product_ru) + "</h3>" +
          (o.product_zh ? '<p lang="zh-CN">' + esc(o.product_zh) + "</p>" : "") + "</div>" +
        (urls.length ? '<div class="thumbs">' + thumbsHtml(urls, 4) + "</div>" : "") +
        specsHtml(o) +
        moneyHtml(o) +
        '<p class="meta"><span>' + t("l_supplier") + "</span> " + esc(o.supplier || "—") +
          (o.supplier_wechat ? ' <span class="muted">· WeChat</span> ' + esc(o.supplier_wechat) : "") +
          (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener">1688</a>' : "") + "</p>" +
        (o.admin_comment ? '<p class="note">' + esc(o.admin_comment) + "</p>" : "") +
        '<div class="card-actions">' +
          '<button type="button" class="btn btn-primary" data-act="open">' + t("open") + "</button>" +
          '<button type="button" class="btn" data-act="edit" data-write>' + t("edit") + "</button>" +
          '<button type="button" class="btn" data-act="status" data-write>' + t("change_status") + "</button>" +
          '<button type="button" class="btn" data-act="link">' + t("client_link") + "</button>" +
          '<button type="button" class="btn btn-danger" data-act="delete" data-write>' + t("remove") + "</button>" +
        "</div>" +
      "</article>";
  }

  // ---------- Данные клиента в карточке заказа ----------
  var CLOSED = ["delivered", "cancelled"]; // завершённые заказы

  // В строке под номером заказа: город клиента или красная пометка «Нет адреса»
  function placeHtml(o) {
    if (o.client) return '<span class="card-place">' + esc(o.client.city) + "</span>";
    if (CLOSED.indexOf(o.status) !== -1) return "";
    return '<span class="flag-missing">' + esc(t("no_delivery_data")) + "</span>";
  }

  function telegramLink(tg) {
    // логин уже проверен базой: только латиница, цифры и _
    return '<a href="https://t.me/' + encodeURIComponent(tg) + '" target="_blank" rel="noopener">@' + esc(tg) + "</a>";
  }

  // Красивый вид номера: +996555123456 → +996 555 123 456
  function fmtPhone(phone) {
    var p = String(phone || "");
    var m;
    if ((m = p.match(/^\+996(\d{3})(\d{3})(\d{3})$/))) return "+996 " + m[1] + " " + m[2] + " " + m[3];
    if ((m = p.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/))) return "+7 " + m[1] + " " + m[2] + "-" + m[3] + "-" + m[4];
    if ((m = p.match(/^\+86(\d{3})(\d{4})(\d{4})$/))) return "+86 " + m[1] + " " + m[2] + " " + m[3];
    return p;
  }

  function phoneLink(phone) {
    return '<a href="tel:' + esc(phone) + '">' + esc(fmtPhone(phone)) + "</a>";
  }

  // Блок «Данные клиента для доставки» в подробной карточке
  function clientBoxHtml(c) {
    if (!c) {
      return '<div class="client-box empty"><h4>' + esc(t("cb_title")) + "</h4><p>" + esc(t("cb_empty")) + "</p></div>";
    }
    return '<div class="client-box"><h4>' + esc(t("cb_title")) + '</h4><dl class="info">' +
      "<div><dt>" + t("l_name") + "</dt><dd>" + esc(c.name) + "</dd></div>" +
      "<div><dt>" + t("l_phone") + "</dt><dd>" + phoneLink(c.phone) + "</dd></div>" +
      (c.telegram ? "<div><dt>" + t("l_telegram") + "</dt><dd>" + telegramLink(c.telegram) + "</dd></div>" : "") +
      "<div><dt>" + t("l_city") + "</dt><dd>" + esc(c.city) + "</dd></div>" +
      (c.address ? "<div><dt>" + t("l_address") + "</dt><dd>" + esc(c.address) + "</dd></div>" : "") +
      (c.pickup_point ? "<div><dt>" + t("l_pickup") + "</dt><dd>" + esc(c.pickup_point) + "</dd></div>" : "") +
      "</dl></div>";
  }

  // =====================================================
  //  ВКЛАДКА «КЛИЕНТЫ»
  // =====================================================
  function switchTab(name) {
    var isAdmin = state.me && state.me.role === "admin";
    state.tab = name === "clients" || (name === "buyers" && isAdmin) ? name : "orders";
    if (!state.ws && state.tab !== "buyers") state.tab = isAdmin ? "buyers" : "orders";
    $("#tab-orders").classList.toggle("hidden", state.tab !== "orders");
    $("#tab-clients").classList.toggle("hidden", state.tab !== "clients");
    $("#tab-buyers").classList.toggle("hidden", state.tab !== "buyers");
    $("#fab").classList.toggle("hidden", state.tab !== "orders");
    $$(".tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === state.tab;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
    if (state.tab === "clients" && db && state.ws) loadClients();
    if (state.tab === "buyers" && db) loadBuyers();
  }

  // Загружаем всех клиентов вместе с номерами их заказов
  async function loadClients() {
    state.clientsLoading = true;
    $("#clients-loading").classList.remove("hidden");
    var rows = [];
    try {
      for (var from = 0; ; from += 1000) {
        var res = await db.from("clients")
          .select("id, name, phone, telegram, city, address, pickup_point, created_at, orders(id, order_number, status, order_date)")
          .eq("workspace_id", state.ws.id)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (res.error) throw res.error;
        rows = rows.concat(res.data);
        if (res.data.length < 1000) break;
      }
      state.clients = rows;
    } catch (err) {
      handleError(err);
    }
    state.clientsLoading = false;
    $("#clients-loading").classList.add("hidden");
    renderClients();
  }

  // Поиск по имени, телефону (можно вводить только цифры) и Telegram
  function filteredClients() {
    var q = state.clientsQ.trim().toLowerCase();
    if (!q) return state.clients;
    var qDigits = q.replace(/\D/g, "");
    return state.clients.filter(function (c) {
      if (String(c.name).toLowerCase().indexOf(q) !== -1) return true;
      if (c.telegram && c.telegram.toLowerCase().indexOf(q.replace(/^@/, "")) !== -1) return true;
      return qDigits.length >= 3 && String(c.phone).replace(/\D/g, "").indexOf(qDigits) !== -1;
    });
  }

  function renderClients() {
    var box = $("#clients");
    var empty = $("#clients-empty");
    if (state.clientsLoading) return;

    if (!state.clients.length) {
      box.innerHTML = "";
      $("#clients-count").textContent = "";
      empty.innerHTML = "<strong>" + esc(t("clients_empty_title")) + "</strong><br>" + esc(t("clients_empty_text"));
      empty.classList.remove("hidden");
      return;
    }
    var list = filteredClients();
    $("#clients-count").textContent = t("clients_count", { n: list.length });
    if (!list.length) {
      box.innerHTML = "";
      empty.textContent = t("nothing_found");
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    box.innerHTML = list.map(clientRowHtml).join("");
  }

  function clientRowHtml(c) {
    var orders = (c.orders || []).slice().sort(function (a, b) {
      return String(b.order_date).localeCompare(String(a.order_date));
    });
    var place = c.address
      ? "<span>" + esc(t("l_address")) + ":</span> " + esc(c.address)
      : "<span>" + esc(t("l_pickup")) + ":</span> " + esc(c.pickup_point);
    return '' +
      '<article class="client-row">' +
        "<div>" +
          '<div class="client-row-name">' + esc(c.name) + "</div>" +
          '<div class="client-row-date">' + esc(t("l_added")) + ": " + fmtDate(c.created_at) + "</div>" +
        "</div>" +
        '<div class="client-row-contacts">' + phoneLink(c.phone) + (c.telegram ? telegramLink(c.telegram) : "") + "</div>" +
        '<div class="client-row-place"><b>' + esc(c.city) + "</b>" + place + "</div>" +
        '<div class="client-row-orders">' + orders.map(function (o) {
          return '<button type="button" class="order-tag st-' + esc(o.status) + '" data-order-id="' + esc(o.id) + '" title="' +
            esc(t("status_" + o.status)) + '"><span class="dot"></span>№ ' + esc(o.order_number) + "</button>";
        }).join("") + "</div>" +
      "</article>";
  }

  // ---------- Выгрузка клиентов в CSV для Excel ----------
  // Разделитель «;» и метка UTF-8 в начале файла — так русский Excel
  // сразу раскладывает по колонкам и правильно показывает кириллицу и китайский.
  function csvCell(value, isPhone) {
    var s = String(value == null ? "" : value);
    if (isPhone && /^\+?\d+$/.test(s)) {
      // телефон как текст, иначе Excel съест «+» и превратит номер в 9,97E+11
      s = '="' + s + '"';
    } else if (/^[=+\-@\t\r]/.test(s)) {
      // защита: Excel не должен считать текст клиента формулой
      s = "'" + s;
    }
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportClientsCsv() {
    var list = filteredClients();
    if (!list.length) { toast(t("export_empty"), "error"); return; }
    var head = ["l_name", "l_phone", "l_telegram", "l_city", "l_address", "l_pickup", "l_orders", "l_added"]
      .map(function (k) { return csvCell(t(k)); }).join(";");
    var lines = list.map(function (c) {
      return [
        csvCell(c.name),
        csvCell(c.phone, true),
        csvCell(c.telegram || ""), // без @: Excel принял бы @ за начало формулы
        csvCell(c.city),
        csvCell(c.address),
        csvCell(c.pickup_point),
        csvCell((c.orders || []).map(function (o) { return o.order_number; }).join(", ")),
        csvCell(String(c.created_at || "").slice(0, 10))
      ].join(";");
    });
    var blob = new Blob(["﻿" + head + "\r\n" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "ula-clients-" + todayISO() + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast(t("export_done"), "ok");
  }

  // =====================================================
  //  ВКЛАДКА «БАЙЕРЫ» (только админ)
  // =====================================================
  async function loadBuyers() {
    if (!state.me || state.me.role !== "admin") return;
    $("#buyers-loading").classList.remove("hidden");
    try {
      var ws = await db.rpc("admin_list_workspaces");
      if (ws.error) throw ws.error;
      state.buyers = ws.data || [];
      // только действующие приглашения: не использованы и не просрочены
      var inv = await db.from("invites").select("id, code, note, created_at, expires_at")
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (inv.error) throw inv.error;
      state.invites = inv.data || [];
    } catch (err) {
      handleError(err);
    }
    $("#buyers-loading").classList.add("hidden");
    renderBuyers();
  }

  function inviteUrl(code) {
    return location.origin + location.pathname.replace(/index\.html$/, "") + "#/join/" + code;
  }

  function renderBuyers() {
    if (!state.me || state.me.role !== "admin") return;

    $("#invites").innerHTML = state.invites.length
      ? state.invites.map(function (i) {
          return '<div class="invite-item">' +
            "<div><b>" + esc(i.note || "—") + "</b>" +
            '<span class="muted"> · ' + esc(t("b_until", { d: fmtDate(i.expires_at) })) + "</span></div>" +
            '<button type="button" class="btn btn-ghost" data-invite-del="' + esc(i.id) + '">' + esc(t("b_delete_invite")) + "</button>" +
          "</div>";
        }).join("")
      : '<p class="muted">' + esc(t("b_invites_empty")) + "</p>";

    $("#buyers").innerHTML = state.buyers.map(function (w) {
      var mine = state.myWs && state.myWs.id === w.id;
      var canBlock = !mine && w.owner_id && w.owner_role !== "admin";
      return '<article class="client-row buyer-row">' +
        "<div>" +
          '<div class="client-row-name">' + esc(w.name) + "</div>" +
          '<div class="client-row-date">' + [w.owner_name, w.owner_email].filter(Boolean).map(esc).join(" · ") + "</div>" +
        "</div>" +
        '<div class="client-row-contacts">' + (w.owner_phone ? phoneLink(w.owner_phone) : '<span class="muted">—</span>') + "</div>" +
        '<div class="client-row-place">' + esc(t("b_counts", { o: w.orders_count, c: w.clients_count })) +
          '<span class="muted"> · ' + esc(t("l_added")) + ": " + fmtDate(w.created_at) + "</span></div>" +
        "<div>" + (mine
          ? '<span class="pill st-arrived">' + esc(t("b_you")) + "</span>"
          : '<span class="pill ' + (w.owner_active ? "st-arrived" : "st-cancelled") + '">' + esc(t(w.owner_active ? "b_active" : "b_blocked")) + "</span>") +
        "</div>" +
        '<div class="buyer-actions">' +
          '<button type="button" class="btn btn-primary" data-ws-open="' + esc(w.id) + '">' + esc(t("b_open")) + "</button>" +
          (canBlock ? '<button type="button" class="btn ' + (w.owner_active ? "btn-danger" : "") + '" data-ws-block="' + esc(w.id) + '">' +
            esc(t(w.owner_active ? "b_block" : "b_unblock")) + "</button>" : "") +
        "</div>" +
      "</article>";
    }).join("");
  }

  async function createInvite() {
    var btn = $("#invite-create");
    btn.disabled = true;
    try {
      var res = await db.rpc("admin_create_invite", { p_note: $("#invite-note").value.trim() || null });
      if (res.error) throw res.error;
      var url = inviteUrl(res.data);
      $("#invite-link").value = url;
      $("#invite-wa").href = "https://wa.me/?text=" + encodeURIComponent(t("b_wa_text") + " " + url);
      $("#invite-result").classList.remove("hidden");
      $("#invite-note").value = "";
      copyText(url).then(function (ok) { if (ok) toast(t("copied"), "ok"); });
      await loadBuyers();
    } catch (err) {
      handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteInvite(id) {
    var res = await db.from("invites").delete().eq("id", id);
    if (res.error) { handleError(res.error); return; }
    $("#invite-result").classList.add("hidden");
    toast(t("b_invite_deleted"), "ok");
    await loadBuyers();
  }

  async function openWorkspaceById(id) {
    if (state.myWs && state.myWs.id === id) { await openWorkspace(state.myWs); return; }
    var res = await db.from("workspaces").select(WS_FIELDS).eq("id", id).single();
    if (res.error) { handleError(res.error); return; }
    await openWorkspace(res.data);
  }

  async function toggleBuyer(wsId) {
    var w = state.buyers.filter(function (x) { return x.id === wsId; })[0];
    if (!w || !w.owner_id) return;
    if (w.owner_active && !window.confirm(t("b_confirm_block", { n: w.name }))) return;
    var res = await db.rpc("admin_set_user_active", { p_user: w.owner_id, p_active: !w.owner_active });
    if (res.error) { handleError(res.error); return; }
    await loadBuyers();
  }

  // =====================================================
  //  РЕГИСТРАЦИЯ БАЙЕРА ПО ПРИГЛАШЕНИЮ (#/join/КОД)
  // =====================================================
  async function initJoin(code) {
    showView("join");
    var ok = false;
    try {
      var res = await db.rpc("check_invite", { p_code: code });
      ok = !res.error && res.data === true;
    } catch (err) {
      console.error(err);
    }
    $("#join-checking").classList.add("hidden");
    $("#join-invalid").classList.toggle("hidden", ok);
    $("#join-form").classList.toggle("hidden", !ok);
    if (!ok) return;

    $("#join-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = $("#join-name").value.trim();
      var phone = cleanPhone($("#join-phone").value);
      var wsName = $("#join-ws").value.trim();
      var email = $("#join-email").value.trim();
      var pass = $("#join-password").value;
      if (name.length < 2) return setJoinError(t("e_name"), "#join-name");
      // телефон обязателен: от 9 до 15 цифр, можно с + в начале
      if (!/^\+?\d{9,15}$/.test(phone)) return setJoinError(t("e_phone"), "#join-phone");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setJoinError(t("e_email"), "#join-email");
      if (pass.length < 8) return setJoinError(t("e_password"), "#join-password");
      setJoinError("");

      var btn = $("#join-btn");
      btn.disabled = true;
      btn.textContent = t("join_busy");
      try {
        // Код приглашения уходит вместе с регистрацией — база сама создаст кабинет
        var res = await db.auth.signUp({
          email: email,
          password: pass,
          options: {
            data: { invite_code: code, full_name: name, workspace_name: wsName || name, phone: phone },
            emailRedirectTo: location.origin + location.pathname
          }
        });
        if (res.error) {
          setJoinError(/registered|exists/i.test(res.error.message) ? t("join_exists") : t("error_generic"));
          return;
        }
        if (res.data && res.data.session) {
          // подтверждение почты выключено — сразу входим в кабинет
          history.replaceState(null, "", location.pathname);
          mode = "admin";
          await initAdmin();
        } else {
          // нужно подтвердить почту
          $("#join-form").classList.add("hidden");
          $("#join-done-text").textContent = t("join_done_text", { e: email });
          $("#join-done").classList.remove("hidden");
        }
      } catch (err) {
        console.error(err);
        setJoinError(t("error_generic"));
      } finally {
        btn.disabled = false;
        btn.textContent = t("join_btn");
      }
    });
  }

  function setJoinError(msg, focusSel) {
    var el = $("#join-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
    if (focusSel) $(focusSel).focus();
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
    if (state.readOnly && act !== "open" && act !== "link") return;
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
        clientBoxHtml(o.client) +
        specsHtml(o) +
        moneyHtml(o) +
        '<dl class="info">' +
          "<div><dt>" + t("f_client") + "</dt><dd>" + esc(o.client_name) + "</dd></div>" +
          "<div><dt>" + t("l_phone") + "</dt><dd>" + phone + "</dd></div>" +
          "<div><dt>" + t("l_wechat") + "</dt><dd>" + esc(o.client_wechat || "—") + "</dd></div>" +
          "<div><dt>" + t("l_supplier") + "</dt><dd>" + esc(o.supplier || "—") + "</dd></div>" +
          (o.supplier_wechat ? "<div><dt>" + t("l_supplier_wechat") + "</dt><dd>" + esc(o.supplier_wechat) + "</dd></div>" : "") +
          (link ? "<div><dt>" + t("l_link") + '</dt><dd><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(link) + "</a></dd></div>" : "") +
          (o.delivery_info ? "<div><dt>" + t("l_delivery_info") + "</dt><dd>" + esc(o.delivery_info) + "</dd></div>" : "") +
          (o.client_comment ? "<div><dt>" + t("l_comment_client") + "</dt><dd>" + esc(o.client_comment) + "</dd></div>" : "") +
          (o.admin_comment ? "<div><dt>" + t("l_comment_admin") + "</dt><dd>" + esc(o.admin_comment) + "</dd></div>" : "") +
        "</dl>" +
        '<div class="card-actions">' +
          '<button type="button" class="btn btn-primary" data-act="edit" data-write>' + t("edit") + "</button>" +
          '<button type="button" class="btn" data-act="status" data-write>' + t("change_status") + "</button>" +
          '<button type="button" class="btn" data-act="link">' + t("client_link") + "</button>" +
          '<button type="button" class="btn btn-danger" data-act="delete" data-write>' + t("remove") + "</button>" +
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
      set("supplier_wechat", o.supplier_wechat);
      fillCurrencySelect($("#f-purchase_currency"), o.purchase_currency || "CNY");
      fillCurrencySelect($("#f-client_currency"), o.client_currency || "KGS");
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
      // валюты по умолчанию — из настроек кабинета
      var ws = state.ws || {};
      fillCurrencySelect($("#f-purchase_currency"), ws.default_purchase_currency || "CNY");
      fillCurrencySelect($("#f-client_currency"), ws.default_client_currency || "KGS");
      set("order_number", ""); // номер выдаст база после сохранения
      set("order_date", todayISO());
      ["client_name", "client_phone", "client_wechat", "product_ru", "product_zh", "supplier",
        "supplier_link", "supplier_wechat", "unit_price_cny", "weight_kg", "delivery_info", "client_comment", "admin_comment"
      ].forEach(function (id) { set(id, ""); });
      set("quantity", "1");
      set("exchange_rate", lastRateFor($("#f-purchase_currency").value, $("#f-client_currency").value));
      set("delivery_cost", "");
      set("paid_amount", "");
    }
    updateCalc();
    renderPhotoPreviews();
    openModal("modal-order");
    var body = $("#order-form .modal-body");
    if (body) body.scrollTop = 0;
  }

  // Последний курс для пары валют (например CNY→KGS) — подставляется в новый заказ
  function lastRateFor(a, b) {
    if (a === b) return "1";
    try { return localStorage.getItem("cc_rate_" + a + "_" + b) || ""; } catch (e) { return ""; }
  }

  // Подписи полей с кодом валюты: «Цена за единицу, CNY», «Курс: 1 CNY = ? KGS»
  function updateCurrencyLabels() {
    var a = $("#f-purchase_currency").value, b = $("#f-client_currency").value;
    var same = a === b;
    $("#lbl-price").textContent = t("f_price_cur", { c: a });
    $("#lbl-rate").textContent = same ? t("f_rate_same") : t("f_rate_cur", { a: a, b: b });
    $("#lbl-delivery").textContent = t("f_delivery_cur", { c: b });
    $("#lbl-paid").textContent = t("f_paid_cur", { c: b });
    var rate = $("#f-exchange_rate");
    rate.readOnly = same;
    if (same) rate.value = "1";
  }

  // Сменили валюту в заказе — обновить подписи и подставить знакомый курс
  function onCurrencyChange() {
    var a = $("#f-purchase_currency").value, b = $("#f-client_currency").value;
    $("#f-exchange_rate").value = lastRateFor(a, b);
    updateCalc();
  }

  function updateCalc() {
    updateCurrencyLabels();
    var a = $("#f-purchase_currency").value, b = $("#f-client_currency").value;
    var q = parseNum($("#f-quantity").value);
    var p = parseNum($("#f-unit_price_cny").value);
    var r = parseNum($("#f-exchange_rate").value);
    var d = parseNum($("#f-delivery_cost").value);
    var paid = parseNum($("#f-paid_amount").value);
    var goodsCny = q * p;
    var goodsSom = goodsCny * r;
    var total = goodsSom + d;
    var bal = total - paid;
    $("#calc-goods-cny").textContent = money(q) + " × " + money(p) + " " + a + " = " + money(goodsCny) + " " + a;
    $("#calc-goods-som").textContent = a === b
      ? money(goodsSom) + " " + b
      : money(goodsCny) + " " + a + " × " + money(r) + " = " + money(goodsSom) + " " + b;
    $("#calc-delivery").textContent = money(d) + " " + b;
    $("#calc-total").textContent = money(total) + " " + b;
    $("#calc-paid").textContent = money(paid) + " " + b;
    $("#calc-balance").textContent = money(bal) + " " + b;
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
    // номер заказа сюда не входит: его выдаёт база и он не меняется
    return {
      order_date: val("order_date") || todayISO(),
      status: val("status") || "new",
      client_name: val("client_name"),
      client_phone: val("client_phone") || null,
      client_wechat: val("client_wechat") || null,
      product_ru: val("product_ru"),
      product_zh: val("product_zh") || null,
      supplier: val("supplier") || null,
      supplier_link: link || null,
      supplier_wechat: val("supplier_wechat") || null,
      purchase_currency: $("#f-purchase_currency").value,
      client_currency: $("#f-client_currency").value,
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
    if (!v.client_name || !v.product_ru) {
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
        v.workspace_id = state.ws.id;
        var ins = await db.from("orders").insert(v).select("id, order_number").single();
        if (ins.error) throw ins.error;
        orderId = ins.data.id;
      }
      if (v.exchange_rate > 0) {
        try { localStorage.setItem("cc_rate_" + v.purchase_currency + "_" + v.client_currency, String(v.exchange_rate)); } catch (err) { /* ignore */ }
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
      else toast(form.editing ? t("saved") : t("saved") + ": № " + ins.data.order_number, "ok");
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
    cd.token = token;
    bindClientUI();

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
  function bindClientUI() {
    var box = $("#client-content");

    box.addEventListener("click", function (e) {
      var ph = e.target.closest("[data-photo]");
      if (ph && state.client) {
        openLightbox(clientPhotoUrls(), Number(ph.getAttribute("data-photo")) || 0);
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
  function cleanPhone(v) {
    var p = String(v || "").replace(/[\s().\-]/g, "");
    if (p.indexOf("00") === 0) p = "+" + p.slice(2);
    return p;
  }

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
      var res = await db.rpc("save_client_info", {
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
        steps +
      "</section>" +

      (deliveryFirst ? delivery : "") +

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
          (num(o.delivery_cost) > 0 ? "<div><dt>" + t("l_delivery") + "</dt><dd>" + cur(o.delivery_cost, cc) + "</dd></div>" : "") +
          '<div class="money-total"><dt>' + t("l_total") + "</dt><dd>" + cur(o.total_som, cc) + "</dd></div>" +
          "<div><dt>" + t("l_paid") + "</dt><dd>" + cur(o.paid_amount, cc) + "</dd></div>" +
          '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + t("l_balance") + "</dt><dd>" +
            (bal > 0 ? cur(bal, cc) : esc(t("cl_paid_full"))) + "</dd></div>" +
        "</dl>" +
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

})();
