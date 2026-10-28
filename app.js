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

  // Общий объект для частей сайта в отдельных файлах (js/fx.js, js/support.js)
  var ULA = window.ULA = window.ULA || {};

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
    linkOrderId: null,
    client: null,
    clientState: "loading", // loading | ok | notfound | error

    // кабинет: открытая вкладка
    tab: "orders",

    // кто вошёл и какой кабинет открыт
    me: null,               // { id, email, role: "admin"|"buyer", name }
    myWs: null,             // мой кабинет
    ws: null,               // кабинет, который сейчас на экране (админ может открыть чужой)
    readOnly: false,        // true — смотрим чужой кабинет, менять нельзя
    buyers: [],             // для админа: список кабинетов
    invites: [],            // для админа: действующие приглашения
    clients: [],
    clientsQ: "",
    clientsLoading: false,
    suppliers: [],
    suppliersQ: "",
    suppliersLoading: false,
    supplierEditing: null
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

  function locale() { return { ru: "ru-RU", en: "en-GB", zh: "zh-CN", vi: "vi-VN" }[getLang()] || "ru-RU"; }

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

  // Валюта закупки у поставщика — только юань или доллар
  var PURCHASE_CURRENCIES = ["CNY", "USD"];

  // Валюта доставки: доллар, юань или валюта клиента
  function deliveryCurrencies(clientCur) {
    return PURCHASE_CURRENCIES.indexOf(clientCur) === -1 ? ["USD", "CNY", clientCur] : ["USD", "CNY"];
  }

  function fillCurrencySelect(sel, value, base) {
    base = base || CURRENCIES;
    var list = base.indexOf(value) === -1 && /^[A-Z]{3}$/.test(value || "") ? base.concat([value]) : base;
    sel.innerHTML = list.map(function (c) {
      return '<option value="' + c + '">' + c + " — " + esc(curName(c)) + "</option>";
    }).join("");
    sel.value = value || list[0];
  }

  // Сумма с кодом валюты: «12 500 KGS»
  function cur(n, code) { return money(n) + " " + esc(code || ""); }

  // Доставка: «120 USD ≈ 10 440 KGS» (или просто «3 500 KGS», если валюта одна)
  function deliveryText(o) {
    var dc = o.delivery_currency || o.client_currency;
    if (dc === o.client_currency) return cur(o.delivery_som != null ? o.delivery_som : o.delivery_cost, o.client_currency);
    return cur(o.delivery_cost, dc) + " ≈ " + cur(o.delivery_som, o.client_currency);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function fmtDate(s) {
    if (!s) return "";
    var p = String(s).slice(0, 10).split("-");
    if (p.length !== 3) return esc(s);
    if (getLang() === "zh") return p[0] + "-" + p[1] + "-" + p[2];
    if (getLang() === "en" || getLang() === "vi") return p[2] + "/" + p[1] + "/" + p[0];
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
    if (ULA.support) ULA.support.rememberError(msg || (err && err.code) || "error");
    if (err && err.code === "23505") toast(t("dup_number"), "error");
    else if (err && (err.status === 401 || err.code === "42501" || /JWT|not authenticated/i.test(msg))) toast(t("error_session"), "error");
    else toast(t("error_generic"), "error");
  }

  function isStaff() { return !!state.myRole && state.myRole === "staff"; }

  function showView(name) {
    var boot = document.getElementById("boot");
    if (boot) boot.parentNode.removeChild(boot); // страница ожила — убрать «Загрузка…»
    ["config", "login", "join", "admin", "client", "request", "shop"].forEach(function (v) {
      $("#view-" + v).classList.toggle("hidden", v !== name);
    });
    // пришёл по приглашению помощника — подсказать, что делать
    if (name === "login" && ULA.team) $("#login-team-note").classList.toggle("hidden", !ULA.team.pendingCode());
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
  // Клиенты, подписанные на заказ в Telegram, получают новый статус сами (функция telegram-notify).
  // Зовём только для заказов, где кто-то подписан; ответ — сколько сообщений ушло.
  function tgNotify(ids) {
    var list = (ids || []).filter(function (id) {
      var o = state.orders.filter(function (x) { return x.id === id; })[0];
      return o && o.tg_subs && o.tg_subs.length;
    });
    if (!list.length || !db || state.readOnly) return;
    db.functions.invoke("telegram-notify", { body: { action: "order_status", ids: list } }).then(function (res) {
      var n = res && res.data && res.data.sent;
      if (n > 0) toast(t("tgc_sent", { n: n }), "ok");
    }).catch(function () { /* не получилось — байер всё равно может написать вручную */ });
  }

  // маленькие копии для карточек и превью (у старых фото — само фото)
  function photoThumbs(o) {
    return sortedPhotos(o).map(function (p) { return thumbUrl(p.storage_path); });
  }

  function clientUrl(o) {
    if (!o || !o.public_token) return "";
    var base = location.origin + location.pathname.replace(/index\.html$/, "");
    return base + "?order=" + o.public_token;
  }

  // ---------- Тема: светлая / тёмная / авто ----------
  function getTheme() {
    try { var th = localStorage.getItem("cc_theme"); return th === "light" || th === "dark" ? th : "auto"; }
    catch (e) { return "auto"; }
  }

  function applyTheme(th) {
    try { localStorage.setItem("cc_theme", th); } catch (e) { /* ignore */ }
    if (th === "light" || th === "dark") document.documentElement.setAttribute("data-theme", th);
    else document.documentElement.removeAttribute("data-theme");
    var dark = th === "dark" || (th === "auto" && window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#18171B" : "#151417");
  }

  // ---------- Вход через Google ----------
  // Кнопку показываем, только если Google включён в настройках Supabase
  async function showGoogleIfEnabled(url, key) {
    try {
      var r = await fetch(url.replace(/\/$/, "") + "/auth/v1/settings", { headers: { apikey: key } });
      var j = await r.json();
      var on = !!(j && j.external && j.external.google);
      $$("[data-oauth]").forEach(function (el) { el.classList.toggle("hidden", !on); });
    } catch (e) { /* нет сети — кнопку не показываем */ }
  }

  // глазок «показать пароль»
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pw-eye]");
    if (!b) return;
    e.preventDefault();
    var inp = b.parentNode.querySelector("input");
    var show = inp.type === "password";
    inp.type = show ? "text" : "password";
    b.classList.toggle("on", show);
    inp.focus();
  });

  async function signInWithGoogle() {
    var res = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: location.origin + location.pathname }
    });
    if (res.error) toast(t("google_failed"), "error");
  }

  // ---------- Запуск ----------
  var APP_VERSION = "20261118l"; // та же версия, что в ?v= у файлов
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

    // Ссылка-приглашение помощника (?team=КОД): запоминаем код, он примется после входа
    ULA.team.captureFromUrl();

    // Страница клиента работает без библиотеки supabase.js —
    // так она открывается и на старых телефонах, и во встроенных браузерах WhatsApp / Telegram.
    var clientToken = new URLSearchParams(location.search).get("order");
    if (clientToken) {
      db = miniClient(url, key);
      mode = "client";
      ULA.client.init(clientToken);
      return;
    }

    // Общая ссылка клиента (?c=ТОКЕН): все его заказы в одном месте
    var cabToken = new URLSearchParams(location.search).get("c");
    if (cabToken) {
      db = miniClient(url, key);
      mode = "client";
      ULA.client.initCabinet(cabToken);
      return;
    }

    // Витрина байера для клиента (?shop=ТОКЕН): без входа и без библиотеки supabase.js
    var shopToken = new URLSearchParams(location.search).get("shop");
    if (shopToken) {
      db = miniClient(url, key);
      mode = "shop";
      ULA.shop.initPublic(shopToken);
      return;
    }

    // Статус заявки на обмен для клиента (?xr=НОМЕР): что происходит и сколько ждать
    var xrId = new URLSearchParams(location.search).get("xr");
    if (xrId) {
      db = miniClient(url, key);
      mode = "fx";
      ULA.exchange.initStatus(xrId);
      return;
    }

    // Обмен сом → юань для клиента байера (?fx=ТОКЕН): курс, заявка, скриншот оплаты
    var fxToken = new URLSearchParams(location.search).get("fx");
    if (fxToken) {
      db = miniClient(url, key);
      mode = "fx";
      ULA.exchange.initPage(fxToken);
      return;
    }

    // Страница заявки для клиента (?request=ТОКЕН): тоже без библиотеки supabase.js
    var requestToken = new URLSearchParams(location.search).get("request");
    if (requestToken) {
      db = miniClient(url, key);
      mode = "request";
      ULA.requests.init(requestToken);
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      $("#config-text").textContent = t("lib_missing");
      showView("config");
      return;
    }

    // ошибка входа, которую Supabase вернул в адресе (Google не пустил, ссылка из письма устарела…)
    var authErr = readAuthError();
    db = window.supabase.createClient(url, key);
    $$("[data-google]").forEach(function (b) { b.addEventListener("click", signInWithGoogle); });

    // Какая страница открыта:
    //   ?order=ТОКЕН     — страница клиента
    //   #/join/КОД       — регистрация байера по приглашению
    //   иначе            — вход и кабинет
    var token = new URLSearchParams(location.search).get("order");
    var join = location.hash.match(/^#\/join(?:\/([a-f0-9]{32}))?$/i);
    // переход «Регистрация» ↔ «Вход» перерисовываем перезагрузкой.
    // ВАЖНО: не перезагружать, когда библиотека входа сама очищает адрес после Google или ссылки из письма
    // (иначе вход через Google и «Забыли пароль» терялись и снова показывался вход).
    window.addEventListener("hashchange", function (e) {
      var wasJoin = String(e.oldURL || "").indexOf("#/join") !== -1;
      if (/^#\/join/.test(location.hash) || (location.hash === "" && wasJoin)) location.reload();
    });
    showGoogleIfEnabled(url, key);

    if (token) {
      mode = "client";
      ULA.client.init(token);
    } else if (join) {
      mode = "join";
      initJoin(join[1] ? join[1].toLowerCase() : null);
    } else {
      mode = "admin";
      initAdmin().then(function () { if (authErr) setLoginError(authErr); });
    }
  }

  // ?error=…&error_description=… или #error=… в адресе после входа через Google / ссылки из письма
  function readAuthError() {
    var raw = (location.hash || "").replace(/^#/, "") + "&" + (location.search || "").replace(/^\?/, "");
    var p = new URLSearchParams(raw);
    var code = p.get("error_code") || "", err = p.get("error") || "", desc = p.get("error_description") || "";
    if (!err && !code) return "";
    history.replaceState(null, "", location.pathname);
    if (/otp_expired|expired/i.test(code + " " + desc)) return t("auth_err_expired");
    if (/exchange external code|provider/i.test(desc)) return t("auth_err_google");
    return t("auth_err_generic") + (desc ? " (" + desc.replace(/\+/g, " ").slice(0, 120) + ")" : "");
  }

  function setCurrency() { /* валюта теперь своя у каждого заказа */ }

  // Маленький «клиент» базы для страницы клиента: только вызов функций (rpc) и ссылки на фото.
  // Обычные запросы через интернет (fetch), без новых возможностей браузера.
  function miniClient(url, key) {
    var base = url.replace(/\/$/, "");
    return {
      rpc: function (name, args) {
        return fetch(base + "/rest/v1/rpc/" + name, {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify(args || {})
        }).then(function (r) {
          return r.text().then(function (txt) {
            var d = null;
            try { d = txt ? JSON.parse(txt) : null; } catch (e) { d = { message: txt }; }
            return r.ok ? { data: d, error: null } : { data: null, error: d || { message: "HTTP " + r.status } };
          });
        });
      },
      // как в supabase.js: functions.invoke(имя, { body }) — нужно странице заявки, чтобы сообщить байеру в Telegram
      functions: {
        invoke: function (name, opts) {
          return fetch(base + "/functions/v1/" + name, {
            method: "POST",
            headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
            body: JSON.stringify((opts && opts.body) || {})
          }).then(function (r) {
            return r.json().catch(function () { return null; }).then(function (d) { return { data: d, error: r.ok ? null : { message: "HTTP " + r.status } }; });
          });
        }
      },
      storage: {
        from: function (bucket) {
          return {
            getPublicUrl: function (path) {
              return { data: { publicUrl: base + "/storage/v1/object/public/" + bucket + "/" + path } };
            },
            // загрузка файла (скриншот оплаты обмена); права проверяет база
            upload: function (path, blob, opts) {
              return fetch(base + "/storage/v1/object/" + bucket + "/" + path, {
                method: "POST",
                headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": (opts && opts.contentType) || blob.type || "application/octet-stream", "x-upsert": "false" },
                body: blob
              }).then(function (r) {
                return r.json().catch(function () { return null; }).then(function (d) { return { data: r.ok ? d : null, error: r.ok ? null : (d || { message: "HTTP " + r.status }) }; });
              });
            }
          };
        }
      }
    };
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
        var open = $$(".modal.open").filter(function (m) { return m.id !== "modal-onboard"; });
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
      ULA.client.render();
      return;
    }
    if (mode === "request") {
      ULA.requests.render();
      return;
    }
    if (mode === "shop") {
      ULA.shop.renderPublic();
      return;
    }
    if (mode === "fx") {
      ULA.exchange.renderPage();
      return;
    }
    applySimpleMode();
    if (!$("#view-admin").classList.contains("hidden")) {
      updateSectionMenuLabel();
      renderAll();
      renderClients();
      renderSuppliers();
      renderBuyers();
      renderWarehouse();
      if (state.tab === "quote") ULA.quote.render();
      renderWsBanner();
      if ($("#modal-detail").classList.contains("open")) renderDetail();
      if ($("#modal-status").classList.contains("open")) renderStatusList();
      if ($("#modal-order").classList.contains("open")) {
        fillStatusSelect($("#f-status").value);
        fillCurrencySelect($("#f-purchase_currency"), $("#f-purchase_currency").value, PURCHASE_CURRENCIES);
        fillCurrencySelect($("#f-client_currency"), $("#f-client_currency").value);
        fillCurrencySelect($("#f-delivery_currency"), $("#f-delivery_currency").value, deliveryCurrencies($("#f-client_currency").value));
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
  var adminEntryUserId = "";
  var adminEntryPromise = null;

  // Google сообщает о входе отдельным событием; объединяем его с обычной проверкой сессии.
  function enterAdminOnce(user) {
    if (!user || !user.id) return Promise.resolve();
    if (adminEntryUserId === user.id) return adminEntryPromise || Promise.resolve();
    adminEntryUserId = user.id;
    var promise = enterAdmin(user);
    adminEntryPromise = promise;
    function clearEntry() {
      if (adminEntryUserId === user.id && adminEntryPromise === promise) adminEntryPromise = null;
    }
    promise.then(clearEntry, clearEntry);
    return promise;
  }

  async function initAdmin() {
    bindAdminUI();
    var recovering = false;
    // Перешли по ссылке «забыли пароль» из письма: сначала новый пароль, потом вход
    async function recover(session) {
      if (recovering) return;
      recovering = true;
      showView("login");
      await ULA.recovery.newPassword();
      recovering = false;
      await enterAdminOnce(session.user);
    }
    db.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT" && mode === "admin") {
        adminEntryUserId = "";
        adminEntryPromise = null;
        state.orders = [];
        showView("login");
      } else if (event === "PASSWORD_RECOVERY" && session) {
        // Сначала покажем форму нового пароля, а код MFA спросим при сохранении.
        recover(session);
      } else if (event === "SIGNED_IN" && session && session.user && mode === "admin") {
        if (ULA.recovery.isRecoveryLink()) {
          // Ссылка восстановления — не обычный вход в кабинет.
          recover(session);
        } else {
          // Откладываем запросы к базе, чтобы не блокировать обработчик Supabase Auth.
          setTimeout(function () {
            enterAdminOnce(session.user).catch(function (err) { console.error("Не удалось открыть кабинет после входа", err); });
          }, 0);
        }
      }
    });
    var res = await db.auth.getSession();
    var session = res && res.data && res.data.session;
    if (session && ULA.recovery.isRecoveryLink()) recover(session);
    else if (session && !recovering) await enterAdminOnce(session.user);
    else if (!session) showView("login");
  }

  // После входа: узнаём роль (админ / байер) и кабинет пользователя
  async function enterAdmin(user) {
    // включён вход с кодом — сначала просим код (без него базе нельзя доверять, что это тот же человек)
    if (!(await ULA.mfa.gate())) { showView("login"); return; }
    var PROFILE = "role, full_name, phone, is_active";
    var prof = await db.from("profiles").select(PROFILE).eq("user_id", user.id).maybeSingle();
    var p = prof.data;

    // Профиля нет (кабинет при регистрации не создался) — создаём сейчас.
    // Регистрация свободная: любой вошедший получает свой кабинет байера.
    var meta = user.user_metadata || {};
    if (!prof.error && !p) {
      var name = meta.full_name || meta.name || null;
      var cl = meta.invite_code
        ? await db.rpc("claim_invite", { p_code: meta.invite_code, p_full_name: name, p_ws_name: meta.workspace_name || null, p_phone: meta.phone || null })
        : { error: true };
      if (cl.error) {
        cl = await db.rpc("register_me", { p_full_name: name, p_ws_name: meta.workspace_name || null, p_phone: meta.phone || null });
      }
      if (!cl.error) {
        prof = await db.from("profiles").select(PROFILE).eq("user_id", user.id).maybeSingle();
        p = prof.data;
      }
    }

    if (prof.error || !p || !p.is_active) {
      await db.auth.signOut();
      showView("login");
      setLoginError(t(p && !p.is_active ? "account_blocked" : "no_access"));
      return;
    }

    // Пришёл по приглашению помощника — вступаем в команду до выбора кабинета
    var teamMsg = "";
    if (p.role === "buyer") {
      var tj = await ULA.team.acceptPending();
      if (tj === "ok") teamMsg = "tm_joined";
      else if (tj !== "none") teamMsg = tj;
    }

    var mem = await db.from("workspace_members")
      .select("role, created_at, workspace:workspaces(" + WS_FIELDS + ")")
      .eq("user_id", user.id)
      .order("created_at");
    var memRows = mem.data || [];
    var memRow = memRows.filter(function (m) { return m.role === "staff"; })[0] || memRows[0] || null;
    var myWs = memRow ? memRow.workspace : null;
    state.myRole = memRow ? memRow.role : null;
    document.body.classList.toggle("is-staff", state.myRole === "staff");

    // у байера обязательно должен быть кабинет; админ может работать и без своего
    if (!myWs && p.role !== "admin") {
      await db.auth.signOut();
      showView("login");
      setLoginError(t("no_access"));
      return;
    }

    state.me = { id: user.id, email: user.email, role: p.role, name: p.full_name || "", phone: p.phone || "",
      // вход через Google без пароля: текущего пароля нет, проверять нечего
      hasPassword: ((user.app_metadata && user.app_metadata.providers) || ["email"]).indexOf("email") !== -1 };
    state.myWs = myWs;
    document.body.classList.toggle("is-admin", p.role === "admin");
    setLoginError("");
    showView("admin");

    ULA.support.startPolling();
    ULA.mfa.refresh();   // для администратора: напоминание «включите вход с кодом»
    if (myWs) await openWorkspace(myWs);
    else switchTab("buyers");
    // ссылка из Telegram «Ответить: …#/support» — сразу открыть поддержку
    if (location.hash === "#/support") {
      history.replaceState(null, "", location.pathname + location.search);
      if (p.role === "admin") switchTab("support"); else ULA.support.open(null, null);
    }

    if (teamMsg) toast(t(teamMsg), teamMsg === "tm_joined" ? "ok" : "error");

    // нет телефона (например, вход через Google) — попросить указать
    // и нет данных компании (адрес склада) — тоже обязательно заполнить
    if (p.role === "buyer" && needsOnboard()) openOnboard();

    // новому байеру один раз показываем обучение по шагам
    ULA.tour.maybeStart();
  }

  // ---------- Завершение регистрации: телефон обязателен ----------
  function needsOnboard() {
    return !state.me.phone || (state.myRole === "owner" && state.myWs && !state.myWs.warehouse_address);
  }

  function openOnboard() {
    var ownWs = state.myRole === "owner" && !!state.myWs;
    $("#o-phone").value = state.me.phone || "";
    $("#o-phone-field").classList.toggle("hidden", !!state.me.phone);
    $("#o-ws").closest(".field").classList.toggle("hidden", !ownWs);
    $("#o-address").closest(".field").classList.toggle("hidden", !ownWs);
    $("#o-contacts").closest(".field").classList.toggle("hidden", !ownWs);
    $("#o-ws").value = state.myWs ? state.myWs.name : "";
    $("#o-address").value = (state.myWs && state.myWs.warehouse_address) || "";
    $("#o-contacts").value = (state.myWs && state.myWs.warehouse_contacts) || "";
    setFormError("#onboard-error", "");
    openModal("modal-onboard");
    (state.me.phone && ownWs ? $("#o-ws") : $("#o-phone")).focus();
  }

  async function saveOnboard(e) {
    e.preventDefault();
    var phone = cleanPhone($("#o-phone").value);
    if (!/^\+?\d{9,15}$/.test(phone)) { setFormError("#onboard-error", t("e_phone")); $("#o-phone").focus(); return; }
    var ownWs = state.myRole === "owner" && !!state.myWs;
    var wsName = $("#o-ws").value.trim();
    var address = $("#o-address").value.trim();
    if (ownWs && !wsName) { setFormError("#onboard-error", t("e_ws_name")); $("#o-ws").focus(); return; }
    if (ownWs && !address) { setFormError("#onboard-error", t("e_ob_addr")); $("#o-address").focus(); return; }
    var btn = $("#onboard-save");
    btn.disabled = true;
    try {
      var res = await db.from("profiles").update({ phone: phone }).eq("user_id", state.me.id);
      if (res.error) throw res.error;
      state.me.phone = phone;
      if (ownWs) {
        var w = await db.from("workspaces").update({
          name: wsName, warehouse_address: address, warehouse_contacts: $("#o-contacts").value.trim() || null
        }).eq("id", state.myWs.id).select(WS_FIELDS).single();
        if (w.error) throw w.error;
        state.myWs = w.data;
        if (state.ws && state.ws.id === w.data.id) { state.ws = w.data; renderWsBanner(); renderWarehouse(); }
      }
      closeModal("modal-onboard");
      toast(t("s_saved"), "ok");
    } catch (err) {
      handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  function setFormError(sel, msg) {
    var el = $(sel);
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  var WS_FIELDS = "id, name, order_prefix, warehouse_address, warehouse_contacts, logo_path, fx_on, fx_tiers, fx_note, fx_updated_at, fx_eta, " +
    "default_purchase_currency, default_client_currency, default_delivery_currency, default_delivery_tariff, custom_rates, request_token, profit_goals";

  // Открыть кабинет. Свой — можно менять. Чужой (только админ) — только смотреть.
  async function openWorkspace(ws) {
    state.ws = ws;
    state.readOnly = !(state.myWs && state.myWs.id === ws.id);
    document.body.classList.toggle("readonly", state.readOnly);
    state.orders = [];
    state.clients = [];
    state.q = ""; state.status = "all"; state.from = ""; state.to = ""; state.limit = PAGE_SIZE; state.hintFilter = null;
    $("#search").value = ""; $("#date-from").value = ""; $("#date-to").value = "";
    renderWsBanner();
    renderWarehouse();
    switchTab("orders");
    await Promise.all([loadOrders(), loadSuppliers()]);
    ULA.board.load();           // новости и курс ULA на главной
    ULA.exchange.loadCount();   // значок новых заявок на обмен в меню
    decideSimple();
    applySimpleMode();
    ULA.shipments.load(true).then(applyOptionalTabs);   // названия партий для меток на карточках заказов; показать «Партии», если они есть
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
        var cTok = await ULA.captcha.get("cf-login");
        var res = await db.auth.signInWithPassword({
          email: $("#login-email").value.trim(),
          password: $("#login-password").value,
          options: cTok ? { captchaToken: cTok } : undefined
        });
        if (res.error) setLoginError(/captcha/i.test(res.error.message || "") ? t("captcha_err") : t("login_error"));
        else await enterAdminOnce(res.data.user);
      } catch (err) {
        console.error(err);
        setLoginError(/captcha/i.test(String(err && err.message)) ? t("captcha_err") : t("error_generic"));
      } finally {
        btn.disabled = false;
        btn.textContent = t("login_btn");
      }
    });

    $("#logout-btn").addEventListener("click", async function () {
      closeSectionMenu();
      await db.auth.signOut();
      state.orders = [];
      state.clients = [];
      ULA.support.stopPolling();
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
    // 💡 помощник: свернуть / развернуть, кнопки в подсказках
    // значки у разделов меню (группы «Главное», «Деньги», «Инструменты» всегда раскрыты)
    $$(".section-menu .tab-ico[data-ico]").forEach(function (i) { i.innerHTML = ULA.icon(i.getAttribute("data-ico"), 19); });

    // склад: на телефоне свёрнут в одну строку, нажатие на заголовок раскрывает контакты
    $("#wh-title").addEventListener("click", function () { $("#tab-orders .warehouse").classList.toggle("open"); });
    $("#as-toggle").addEventListener("click", function () {
      var box = $("#assistant");
      var collapsed = !box.classList.contains("collapsed");
      box.classList.toggle("collapsed", collapsed);
      $("#as-toggle").setAttribute("aria-expanded", String(!collapsed));
      try { localStorage.setItem("cc_as_collapsed", collapsed ? "1" : ""); } catch (e) { /* ignore */ }
    });
    try {
      var asc = localStorage.getItem("cc_as_collapsed");
      if (asc === null || asc === "1") { $("#assistant").classList.add("collapsed"); $("#as-toggle").setAttribute("aria-expanded", "false"); }
    } catch (e) { /* ignore */ }
    $("#as-list").addEventListener("click", onHintClick);
    $("#hint-filter-clear").addEventListener("click", function () { setHintFilter(null); });

    // 🤖 ИИ-помощник (только админ)
    $("#ai-form").addEventListener("submit", function (e) { e.preventDefault(); askAi($("#ai-input").value); });
    $("#ai-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askAi($("#ai-input").value); }
    });
    $("#ai-examples").addEventListener("click", function (e) {
      var b = e.target.closest("[data-ai-ex]");
      if (b) askAi(t(b.getAttribute("data-ai-ex")));
    });

    // 💱 раздел «Курс» — js/fx.js
    ULA.fx.bind();
    ULA.quote.bind();
    ULA.shipments.bind();
    ULA.requests.bind();
    ULA.team.bind();
    ULA.debts.bind();
    ULA.report.bind();
    ULA.analytics.bind();
    ULA.bulk.bind();
    ULA.onboarding.bind();
    ULA.tgws.bind();
    ULA.mfa.bind();
    ULA.recovery.bind();
    ULA.tour.bind();
    ULA.shop.bind();
    ULA.broadcast.bind();
    ULA.tools.bind();
    ULA.expenses.bind();
    ULA.exchange.bind();
    ULA.board.bind();
    ULA.importer.bind();
    $("#vol-menu").addEventListener("click", closeSectionMenu);
    $("#import-menu").addEventListener("click", closeSectionMenu);
    // пустой кабинет: кнопка «Загрузить из Excel» прямо в подсказке
    $("#empty").addEventListener("click", function (e) { if (e.target.closest("[data-import-open]")) ULA.importer.open(); });
    $("#refresh-menu-btn").addEventListener("click", function () { closeSectionMenu(); $("#refresh-btn").click(); });
    $("#simple-btn").addEventListener("click", function (e) {
      e.stopPropagation();   // меню не закрываем: пусть сразу видно, что появилось
      setSimple(!isSimple());
      toast(t(isSimple() ? "sm_on" : "sm_off"), "ok");
    });
    $("#s-simple").addEventListener("change", function (e) { setSimple(e.target.checked); });
    bindInstall();
    // видео-инструкция: ссылка из config.js (VIDEO_URL); нет ссылки — нет пункта
    var video = safeUrl((window.CARGO_CONFIG || {}).VIDEO_URL || "");
    if (video) { $("#video-btn").href = video; $("#video-btn").classList.remove("hidden"); }
    $("#video-btn").addEventListener("click", closeSectionMenu);

    // ↻ обновить данные открытой вкладки
    $("#refresh-btn").addEventListener("click", refreshData);

    // 💬 техподдержка — js/support.js
    ULA.support.bind();
    ULA.notify.bind();

    // ⚙️ настройки; «Изменить» у склада открывает их сразу на разделе склада
    $("#settings-btn").addEventListener("click", function () { closeSectionMenu(); openSettings(); });
    $("#wh-edit").addEventListener("click", function () { openSettings("s-warehouse"); });
    $("#logo-pick").addEventListener("click", function () { $("#logo-file").click(); });
    $("#logo-file").addEventListener("change", function () { uploadLogo(this.files && this.files[0]); });
    $("#logo-remove").addEventListener("click", async function () {
      setLogoError("");
      try { await setLogo(null); toast(t("s_saved"), "ok"); } catch (err) { console.error(err); setLogoError(t("error_generic")); }
    });
    $(".warehouse").addEventListener("click", function (e) {
      if (e.target.closest("[data-act='wh-add']")) openSettings("s-warehouse");
    });
    // тема и язык меняются сразу, без кнопки «Сохранить»
    $("#settings-form").addEventListener("change", function (e) {
      if (e.target.name === "theme") applyTheme(e.target.value);
      if (e.target.name === "s-lang") { setLang(e.target.value); onLangChange(); }
    });
    $("#onboard-form").addEventListener("submit", saveOnboard);
    $("[data-onboard-logout]").addEventListener("click", function () { $("#logout-btn").click(); closeModal("modal-onboard"); });
    $("#settings-form").addEventListener("submit", saveSettings);
    ["shipments", "suppliers"].forEach(function (k) {
      $("#s-show-" + k).addEventListener("change", function (e) {
        try { localStorage.setItem("ula_show_" + k, e.target.checked ? "1" : "0"); } catch (err) { /* без хранилища — не страшно */ }
        applyOptionalTabs();
        if (!e.target.checked && state.tab === k) switchTab("orders");
      });
    });
    // «Забыли текущий пароль?» в настройках: письмо со ссылкой уходит на вашу почту
    $("#p-forgot").addEventListener("click", async function (e) {
      e.preventDefault();
      if (!state.me || !state.me.email) return;
      try {
        var fTok = await ULA.captcha.get("cf-settings");
        var fr = await db.auth.resetPasswordForEmail(state.me.email, { redirectTo: location.origin + location.pathname, captchaToken: fTok || undefined });
        if (fr.error && /rate|seconds|limit/i.test(fr.error.message || "")) { toast(t("reset_wait"), "error"); return; }
        toast(t("reset_sent", { e: state.me.email }), "ok");
      } catch (err) {
        console.error(err);
        toast(t("error_generic"), "error");
      }
    });
    $("#r-back").addEventListener("click", function () { switchTab("analytics"); });
    // в настройках: валюта клиента изменилась — обновить список валют доставки
    $("#s-def-client").addEventListener("change", function () {
      var dSel = $("#s-def-delivery");
      var list = deliveryCurrencies($("#s-def-client").value);
      fillCurrencySelect(dSel, list.indexOf(dSel.value) !== -1 ? dSel.value : "USD", list);
    });
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
      state.q = ""; state.from = ""; state.to = ""; state.status = "all"; state.limit = PAGE_SIZE; state.hintFilter = null;
      renderHintFilter();
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
      centerChip(true);
    });

    // Открываем одно меню со всеми разделами кабинета.
    var sectionMenu = $("#section-menu");
    var sectionMenuBtn = $("#section-menu-btn");
    sectionMenuBtn.addEventListener("click", function () {
      var open = sectionMenuBtn.getAttribute("aria-expanded") !== "true";
      sectionMenu.classList.toggle("hidden", !open);
      sectionMenuBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".section-menu-wrap")) closeSectionMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeSectionMenu();
    });

    // Разделы кабинета
    $$(".tab[data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { switchTab(b.getAttribute("data-tab")); });
    });

    // клиенты: поиск, выгрузка, клик по номеру заказа
    $("#clients-search").addEventListener("input", function (e) { state.clientsQ = e.target.value; renderClients(); });
    $("#clients-export").addEventListener("click", exportClientsCsv);
    $("#clients").addEventListener("click", function (e) {
      var b = e.target.closest("[data-order-id]");
      if (b) openDetail(b.getAttribute("data-order-id"));
    });

    // Поставщики: поиск, добавление, изменение и удаление.
    $("#suppliers-search").addEventListener("input", function (e) { state.suppliersQ = e.target.value; renderSuppliers(); });
    $("#supplier-add").addEventListener("click", function () { openSupplierForm(null); });
    $("#supplier-form").addEventListener("submit", saveSupplier);
    $("#f-supplier").addEventListener("change", function () {
      var name = $("#f-supplier").value.trim().toLowerCase();
      var supplier = state.suppliers.filter(function (item) { return item.name.toLowerCase() === name; })[0];
      if (!supplier) return;
      if (supplier.wechat) $("#f-supplier_wechat").value = supplier.wechat;
      if (supplier.supplier_link) $("#f-supplier_link").value = supplier.supplier_link;
    });
    $("#suppliers").addEventListener("click", function (e) {
      var edit = e.target.closest("[data-supplier-edit]");
      var del = e.target.closest("[data-supplier-delete]");
      if (edit) openSupplierForm(edit.getAttribute("data-supplier-edit"));
      if (del) deleteSupplier(del.getAttribute("data-supplier-delete"));
    });

    // список заказов и карточка
    $("#orders").addEventListener("click", onOrdersClick);
    document.addEventListener("click", function (e) {
      $$(".card-more[open]").forEach(function (d) {
        if (!d.contains(e.target) || e.target.closest(".card-more-menu")) d.removeAttribute("open");
      });
    });

    // «Даты»: показать / спрятать фильтр по датам
    $("#dates-toggle").addEventListener("click", function () {
      var box = $("#date-filters"), open = box.classList.contains("hidden");
      box.classList.toggle("hidden", !open);
      this.setAttribute("aria-expanded", String(open));
    });
    $("#detail-body").addEventListener("click", onOrdersClick);

    // новый заказ
    $("#new-order").addEventListener("click", function () { openOrderForm(null); });
    $("#fab").addEventListener("click", function () { openOrderForm(null); });

    // форма
    $("#order-form").addEventListener("submit", saveOrder);
    $("#f-more").addEventListener("click", function () {
      var short = !$("#order-form").classList.contains("form-short");
      try { localStorage.setItem("ula_form_full", short ? "0" : "1"); } catch (e) { /* ignore */ }
      setFormShort(short);
    });
    $("#f-purchase_currency").addEventListener("change", onCurrencyChange);
    $("#f-client_currency").addEventListener("change", onCurrencyChange);
    $("#f-delivery_currency").addEventListener("change", onDeliveryCurrencyChange);
    // наценка в % → цена для клиента = себестоимость × (1 + %)
    $("#f-markup").addEventListener("input", function () {
      var m = $("#f-markup").value.trim();
      var cost = currentCost();
      if (m !== "" && cost > 0) $("#f-client_price").value = String(Math.round(cost * (1 + parseNum(m) / 100)));
      updateCalc();
    });
    // цену вписали вручную → показать, какая это наценка
    $("#f-client_price").addEventListener("input", function () {
      var cost = currentCost(), cp = parseNum($("#f-client_price").value);
      $("#f-markup").value = cost > 0 && cp > 0 ? String(Math.round((cp / cost - 1) * 1000) / 10) : "";
      updateCalc();
    });
    // вес или тариф поменялись — сумма доставки = вес × тариф
    ["weight_kg", "delivery_tariff"].forEach(function (id) {
      $("#f-" + id).addEventListener("input", function () {
        var w = parseNum($("#f-weight_kg").value), tr = parseNum($("#f-delivery_tariff").value);
        if (tr > 0) $("#f-delivery_cost").value = String(Math.round(w * tr * 100) / 100);
        updateCalc();
      });
    });
    ["quantity", "unit_price_cny", "exchange_rate", "delivery_cost", "delivery_rate", "paid_amount"].forEach(function (id) {
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
    $("#link-rotate").addEventListener("click", rotateClientLink);
    $("#link-revoke").addEventListener("click", revokeClientLink);
    $("#cab-create").addEventListener("click", function () { cabAction("create"); });
    $("#cab-revoke").addEventListener("click", function () { cabAction("revoke"); });
    $("#cab-copy").addEventListener("click", async function () {
      if (await copyText($("#cab-input").value)) toast(t("copied"), "ok");
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
          .select("*, order_photos(id, storage_path, created_at), status_history:order_status_history(event_type, new_status, paid_total, created_at), client:clients(id, name, phone, telegram, city, address, pickup_point), tg_subs:order_tg_subs(chat_id)")
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
  // Под названием сайта в шапке: название открытого кабинета
  function renderBrandWs() {
    var el = $("#brand-ws");
    if (el) el.textContent = (state.ws && state.ws.name) || "";
  }

  function renderAll() {
    renderBrandWs();
    renderSummary();
    renderAssistant();
    renderChips();
    renderOrders();
    if (ULA.shipments) ULA.shipments.refresh();   // список партий (если открыт)
    if (ULA.debts) ULA.debts.refresh();   // список должников и красная цифра у «Долги»
    if (ULA.report) ULA.report.refresh(); // отчёт по прибыли (если открыт)
    if (ULA.analytics) ULA.analytics.refresh(); // дашборд (если открыт)
    if (ULA.onboarding) ULA.onboarding.refresh(); // подсказка «Начните с 4 шагов»
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
  // Кабинет можно менять, только если открыт свой (а не чужой — у админа)
  function canEditWs() {
    return !!(state.myWs && state.ws && state.myWs.id === state.ws.id);
  }

  function openSettings(scrollTo) {
    // разделы меню
    var ot = optionalTabs();
    $("#s-show-shipments").checked = ot.shipments;
    $("#s-simple").checked = isSimple();
    $("#s-show-suppliers").checked = ot.suppliers;
    // внешний вид
    $$('input[name="theme"]').forEach(function (r) { r.checked = r.value === getTheme(); });
    $$('input[name="s-lang"]').forEach(function (r) { r.checked = r.value === getLang(); });
    // профиль
    $("#p-name").value = (state.me && state.me.name) || "";
    $("#p-phone").value = state.me && state.me.phone ? fmtPhone(state.me.phone) : "";
    $("#p-password").value = "";
    $("#p-current").value = "";
    $("#p-current-error").classList.add("hidden");
    $("#p-password2").value = "";
    $("#p-current-wrap").classList.toggle("hidden", !(state.me && state.me.hasPassword));
    // разделы кабинета — только для своего кабинета
    var ws = canEditWs();
    $$("[data-ws-section]").forEach(function (el) { el.classList.toggle("hidden", !ws); });
    setSettingsError("");
    ULA.mfa.refresh();
    if (ws) { fillWsSettings(state.ws); ULA.tgws.refresh(); }
    openModal("modal-settings");
    var body = $("#settings-form .modal-body");
    var target = scrollTo && document.getElementById(scrollTo);
    if (body) body.scrollTop = target ? target.offsetTop - 12 : 0;
  }

  function fillWsSettings(w) {
    $("#s-name").value = w.name || "";
    $("#s-prefix").value = w.order_prefix || "CN";
    $("#s-address").value = w.warehouse_address || "";
    $("#s-contacts").value = w.warehouse_contacts || "";
    fillCurrencySelect($("#s-def-purchase"), w.default_purchase_currency || "CNY", PURCHASE_CURRENCIES);
    fillCurrencySelect($("#s-def-client"), w.default_client_currency || "KGS");
    fillCurrencySelect($("#s-def-delivery"), w.default_delivery_currency || "USD", deliveryCurrencies(w.default_client_currency || "KGS"));
    $("#s-def-tariff").value = numStr(w.default_delivery_tariff);
    renderLogo();
  }

  // ---------- Логотип кабинета ----------
  function renderLogo() {
    var path = state.ws && state.ws.logo_path;
    $("#logo-preview").innerHTML = path
      ? '<img src="' + esc(db.storage.from("logos").getPublicUrl(path).data.publicUrl) + '" alt="">'
      : "";
    $("#logo-remove").classList.toggle("hidden", !path);
    $("#logo-pick").textContent = t(path ? "logo_change" : "logo_upload");
  }

  function setLogoError(msg) {
    var el = $("#logo-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }

  async function setLogo(path) {
    var old = state.ws.logo_path;
    var res = await db.from("workspaces").update({ logo_path: path }).eq("id", state.ws.id).select(WS_FIELDS).single();
    if (res.error) throw res.error;
    state.ws = res.data;
    if (state.myWs && state.myWs.id === res.data.id) state.myWs = res.data;
    if (old && old !== path) db.storage.from("logos").remove([old]);   // старый файл больше не нужен
    renderLogo();
  }

  async function uploadLogo(file) {
    setLogoError("");
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) { setLogoError(t("logo_err_type")); return; }
    var btn = $("#logo-pick");
    btn.disabled = true;
    try {
      var blob = await shrinkImage(file, 320, 80 * 1024);
      if (blob.size > 1024 * 1024) { setLogoError(t("logo_err_size")); return; }
      var ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
      var path = state.ws.id + "/" + uid() + "." + ext;
      var up = await db.storage.from("logos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (up.error) throw up.error;
      try { await setLogo(path); }
      catch (err) { await db.storage.from("logos").remove([path]); throw err; }
      toast(t("s_saved"), "ok");
    } catch (err) {
      console.error(err);
      setLogoError(t("error_generic"));
    } finally {
      btn.disabled = false;
      $("#logo-file").value = "";
    }
  }

  function setSettingsError(msg) {
    var el = $("#settings-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
    // ошибка внизу окна на телефоне не видна — показываем ещё и всплывающим сообщением
    if (msg) toast(msg, "error");
    var pe = $("#p-current-error");
    if (pe) pe.classList.add("hidden");
  }

  // Ошибка прямо под полем «Текущий пароль» (видно сразу)
  function setCurrentPasswordError(key) {
    var el = $("#p-current-error");
    el.textContent = t(key);
    el.classList.remove("hidden");
    toast(t(key), "error");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    $("#p-current").focus();
  }

  async function saveSettings(e) {
    e.preventDefault();
    var btn = $("#settings-save");

    // 1) профиль: имя, телефон, пароль
    var pName = $("#p-name").value.trim();
    var pPhone = cleanPhone($("#p-phone").value);
    var pPass = $("#p-password").value;
    if (pPhone && !/^\+?\d{9,15}$/.test(pPhone)) { setSettingsError(t("e_phone")); $("#p-phone").focus(); return; }
    if (!pPhone && state.me.role === "buyer") { setSettingsError(t("e_phone")); $("#p-phone").focus(); return; }
    if (pPass && pPass.length < 8) { setSettingsError(t("e_password")); $("#p-password").focus(); return; }
    if (pPass && pPass !== $("#p-password2").value) { setSettingsError(t("e_password_match")); $("#p-password2").focus(); return; }
    // смена пароля только при вводе текущего пароля (если кто-то получит ваш открытый телефон, пароль он не сменит)
    var pCurrent = $("#p-current").value;
    if (pPass && state.me.hasPassword && !pCurrent) { setCurrentPasswordError("e_current_password"); return; }

    btn.disabled = true;
    try {
      if (pPass && state.me.hasPassword) {
        // Текущий пароль проверяем в отдельном временном «входе», чтобы не сбросить вашу сессию
        // (иначе при включённом входе с кодом пришлось бы вводить код ещё раз).
        var sTok = await ULA.captcha.get("cf-settings");
        var cfg = window.CARGO_CONFIG || {};
        var tmp = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY,
          { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        var chk = await tmp.auth.signInWithPassword({ email: state.me.email, password: pCurrent, options: sTok ? { captchaToken: sTok } : undefined });
        try { await tmp.auth.signOut({ scope: "local" }); } catch (e) { /* ignore */ }
        if (chk.error) { btn.disabled = false; setCurrentPasswordError("e_current_wrong"); return; }
      }
      if (pName !== state.me.name || pPhone !== state.me.phone) {
        var pr = await db.from("profiles").update({ full_name: pName || null, phone: pPhone || null }).eq("user_id", state.me.id);
        if (pr.error) throw pr.error;
        state.me.name = pName;
        state.me.phone = pPhone;
      }
      if (pPass) {
        var pw = await ULA.mfa.updatePassword(pPass);
        if (pw.error && pw.error.message === "cancelled") { btn.disabled = false; return; }
        if (pw.error) throw pw.error;
        toast(t("password_changed"), "ok");
      }
    } catch (err) {
      btn.disabled = false;
      handleError(err);
      return;
    }

    // 2) кабинет — только свой
    if (!canEditWs()) {
      btn.disabled = false;
      closeModal("modal-settings");
      if (!pPass) toast(t("s_saved"), "ok");
      return;
    }
    btn.disabled = false;
    var v = {
      name: $("#s-name").value.trim(),
      order_prefix: $("#s-prefix").value.trim().toUpperCase(),
      warehouse_address: $("#s-address").value.trim() || null,
      warehouse_contacts: $("#s-contacts").value.trim() || null,
      default_purchase_currency: $("#s-def-purchase").value,
      default_client_currency: $("#s-def-client").value,
      default_delivery_currency: $("#s-def-delivery").value,
      default_delivery_tariff: parseNum($("#s-def-tariff").value)
    };
    if (!v.name) { setSettingsError(t("e_ws_name")); $("#s-name").focus(); return; }
    if (!/^[A-Z]{1,5}$/.test(v.order_prefix)) { setSettingsError(t("e_prefix")); $("#s-prefix").focus(); return; }

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
    var total = {}, paid = {}, debt = {}, profit = {};
    active.forEach(function (o) {
      var c = o.client_currency || "KGS";
      total[c] = (total[c] || 0) + num(o.total_som);
      paid[c] = (paid[c] || 0) + num(o.paid_amount);
      debt[c] = (debt[c] || 0) + Math.max(0, num(o.balance_som));
      // прибыль считаем только по заказам, где указана цена для клиента
      if (o.profit_som != null) profit[c] = (profit[c] || 0) + num(o.profit_som);
    });
    function lines(map) {
      var codes = Object.keys(map);
      if (!codes.length) return "0";
      return codes.map(function (c) {
        return '<span class="' + (map[c] ? "" : "zero") + '">' + money(map[c]) + " <small>" + esc(c) + "</small></span>";
      }).join("<br>");
    }
    $("#sum-orders").textContent = money(state.orders.length);
    $("#sum-total").innerHTML = lines(total);
    $("#sum-paid").innerHTML = lines(paid);
    $("#sum-debt").innerHTML = lines(debt);
    $("#sum-profit").innerHTML = lines(profit);
  }

  // Заказ закрыт: выдан клиенту и долга нет. На главном экране («В работе») его не показываем,
  // он лежит в «Выданы». Выданный, но не оплаченный заказ остаётся на виду — чтобы не забыть про деньги.
  function isDone(o) {
    return o.status === "delivered" && !(num(o.total_som) > 0 && num(o.balance_som) > 0);
  }
  // Прятать закрытые, только когда байер ничего не ищет и не фильтрует
  function hidesDone() {
    return state.status === "all" && !state.q.trim() && !state.hintFilter && !state.from && !state.to;
  }

  // Значки статусов для круглых кнопок-фильтров
  var CHIP_ICONS = {
    all: '<circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/>',
    "new": '<path d="M12 4v16M4 12h16"/>',
    awaiting_payment: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
    purchasing: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    china_warehouse: '<path d="M3 10l9-6 9 6v10H3z"/><path d="M8 20v-6h8v6"/>',
    in_transit: '<path d="M2 7h12v9H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    arrived: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
    delivered: '<path d="M5 12l5 5 9-10"/>',
    cancelled: '<path d="M6 6l12 12M18 6L6 18"/>'
  };

  function renderChips() {
    var counts = {}, active = 0;
    STATUSES.forEach(function (s) { counts[s] = 0; });
    state.orders.forEach(function (o) {
      if (counts[o.status] !== undefined) counts[o.status]++;
      if (!isDone(o)) active++;
    });
    var items = [["all", active]].concat(STATUSES.map(function (s) { return [s, counts[s]]; }));
    var box = $("#chips");
    var cur = 0;
    items.forEach(function (it, i) { if (it[0] === state.status) cur = i; });
    box.classList.add("chips-ico");
    // Кнопки уже есть — меняем их на месте, чтобы переход был плавным
    if (box.children.length !== items.length) {
      box.innerHTML = items.map(function (it) {
        var key = it[0];
        return '<button type="button" class="chip chip-' + key + " st-" + key + '" data-status="' + key + '" role="tab">' +
          '<span class="ci"><svg viewBox="0 0 24 24" aria-hidden="true">' + CHIP_ICONS[key] + "</svg><b></b></span>" +
          '<span class="cl">' + esc(t(key === "all" ? "filter_active" : "filter_" + key)) + "</span></button>";
      }).join("");
    }
    items.forEach(function (it, i) {
      var b = box.children[i], on = i === cur;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
      b.style.setProperty("--d", Math.min(Math.abs(i - cur), 3));
      b.querySelector("b").textContent = it[1];
      b.classList.toggle("zero", !it[1] && !on);
    });
  }
  function centerChip(smooth) {
    var b = $("#chips .chip.active");
    if (!b) return;
    var box = $("#chips");
    var left = b.offsetLeft - (box.clientWidth - b.offsetWidth) / 2;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: Math.max(0, left), behavior: smooth && !calm ? "smooth" : "auto" });
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var qDigits = q.replace(/\D/g, "");
    var hint = state.hintFilter && HINT_FILTERS[state.hintFilter];
    var hideDone = hidesDone();
    return state.orders.filter(function (o) {
      if (hideDone && isDone(o)) return false;
      if (hint && !hint(o)) return false;
      if (state.status !== "all" && o.status !== state.status) return false;
      if (state.from && o.order_date < state.from) return false;
      if (state.to && o.order_date > state.to) return false;
      if (!q) return true;
      var c = o.client || {};
      var hay = [o.order_number, o.client_name, o.client_phone, o.client_wechat, o.product_ru, o.product_zh, o.supplier, o.supplier_wechat, o.tracking_number,
        c.name, c.phone, c.telegram, c.city]
        .filter(Boolean).join(" ").toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      var phones = String(o.client_phone || "") + " " + String(c.phone || "");
      if (qDigits.length >= 3 && phones.replace(/\D/g, "").indexOf(qDigits) !== -1) return true;
      return false;
    });
  }

  function renderOrders() {
    // точка на кнопке «Даты», если выбран период
    $("#dates-dot").classList.toggle("hidden", !(state.from || state.to));
    var box = $("#orders");
    var empty = $("#empty");
    if (state.loading) return;

    if (!state.orders.length) {
      box.innerHTML = "";
      empty.innerHTML = "<strong>" + esc(t("empty_title")) + "</strong><br>" + esc(t("empty_text")) +
        (state.readOnly ? "" : '<br><button type="button" class="btn empty-import" data-import-open>' + esc(t("im_empty_btn")) + "</button>");
      empty.classList.remove("hidden");
      return;
    }
    var list = filtered();
    // сколько выданных и оплаченных убрано с главного экрана — ссылка, чтобы их открыть
    var done = hidesDone() ? state.orders.filter(isDone).length : 0;
    var doneLink = done ? '<button type="button" class="done-link" data-act="show-done">' + ULA.icon("check", 16) +
      "<span>" + esc(t("done_hidden", { n: done })) + "</span><b>→</b></button>" : "";
    if (!list.length) {
      box.innerHTML = done ? doneLink : "";
      empty.innerHTML = done ? "<strong>" + esc(t("done_all_title")) + "</strong><br>" + esc(t("done_all_text")) : esc(t("nothing_found"));
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    var shown = list.slice(0, state.limit);
    box.innerHTML = shown.map(cardHtml).join("") +
      (list.length > shown.length
        ? '<button type="button" class="btn btn-block more" data-act="more">' + esc(t("show_more")) + " (" + (list.length - shown.length) + ")</button>"
        : "") + doneLink;
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

  // Деньги в карточке (видит только байер).
  // full = true — в подробной карточке ещё товар и доставка отдельно.
  function moneyHtml(o, full) {
    var c = o.client_currency;
    var bal = num(o.balance_som);
    var hasPrice = o.profit_som != null;
    var pr = num(o.profit_som);
    return '<dl class="money">' +
      (full ? "<div><dt>" + t("l_goods_som") + "</dt><dd>" + cur(o.goods_som, c) + "</dd></div>" +
              "<div><dt>" + t("l_delivery") + "</dt><dd>" + deliveryText(o) + "</dd></div>" : "") +
      '<div class="money-cost"><dt>' + t("l_cost") + "</dt><dd>" + cur(o.cost_som, c) + "</dd></div>" +
      '<div class="money-total"><dt>' + t("l_client_price") + "</dt><dd>" + cur(o.total_som, c) + "</dd></div>" +
      '<div class="money-profit owner-only' + (pr < 0 ? " loss" : "") + '"><dt>' + t("l_profit") + "</dt><dd>" +
        (hasPrice ? cur(pr, c) : '<span class="flag-missing">' + esc(t("no_price")) + "</span>") + "</dd></div>" +
      "<div><dt>" + t("l_paid") + "</dt><dd>" + cur(o.paid_amount, c) + "</dd></div>" +
      '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + t("l_balance") + "</dt><dd>" + cur(bal, c) + "</dd></div>" +
      "</dl>";
  }

  function thumbsHtml(urls, max, smalls) {
    var shown = max ? urls.slice(0, max) : urls;
    var html = shown.map(function (u, i) {
      return '<button type="button" class="thumb" data-act="photo" data-i="' + i + '"><img src="' + esc((smalls && smalls[i]) || u) + '" loading="lazy" alt=""></button>';
    }).join("");
    if (max && urls.length > max) {
      html += '<button type="button" class="thumb thumb-more" data-act="open">+' + (urls.length - max) + "</button>";
    }
    return html;
  }

  // Короткая карточка заказа: фото, товар, клиент, деньги и 2 кнопки.
  // Всё остальное (характеристики, поставщик, история) — в «Открыть».
  function cardHtml(o) {
    var urls = photoThumbs(o);
    var c = o.client_currency;
    var bal = num(o.balance_som);
    var hasPrice = o.profit_som != null;
    var pr = num(o.profit_som);
    var photo = urls.length
      ? '<button type="button" class="card-photo" data-act="photo" data-i="0"><img src="' + esc(urls[0]) + '" loading="lazy" alt="">' +
        (urls.length > 1 ? "<span>+" + (urls.length - 1) + "</span>" : "") + "</button>"
      : '<div class="card-photo card-photo-empty" aria-hidden="true">' + ULA.icon("package", 24) + "</div>";
    return '' +
      '<article class="card st-' + o.status + (ULA.bulk && ULA.bulk.has(o.id) ? " selected" : "") + '" data-id="' + esc(o.id) + '">' +
        '<div class="card-top">' +
          '<label class="sel-box"><input type="checkbox" data-sel="' + esc(o.id) + '"' + (ULA.bulk && ULA.bulk.has(o.id) ? " checked" : "") + '><span></span></label>' +
          '<span class="order-no">№ ' + esc(o.order_number) + "</span>" +
          '<span class="pill pill-dot st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span>" +
        "</div>" +
        progressHtml(o) +
        '<div class="card-main" data-act="open">' + photo +
          '<div class="card-info">' +
            "<h3>" + esc(o.product_ru) + "</h3>" +
            '<div class="card-sub"><span>' + esc(o.client_name) + "</span>" + placeHtml(o) + reqTag(o) + shipTag(o) + trackTag(o) + tgTag(o) +
              '<span class="card-date">' + fmtDate(o.order_date) + "</span></div>" +
          "</div>" +
        "</div>" +
        payHtml(o) +
        cardHistoryHtml(o) +
        (o.admin_comment ? '<p class="note">' + esc(o.admin_comment) + "</p>" : "") +
        '<div class="card-actions">' +
          (o.source === "request" && o.status === "new"
            ? '<button type="button" class="btn btn-primary" data-act="quote" data-write>' + t("rq_calc") + "</button>"
            : '<button type="button" class="btn btn-primary" data-act="open">' + t("open") + "</button>") +
          '<button type="button" class="btn btn-notify" data-act="notify" data-write>' + t("client_notify") + "</button>" +
          // «⋯» — редкие действия, чтобы не загромождать карточку
          '<details class="card-more">' +
            '<summary class="btn card-more-btn" aria-label="' + esc(t("more_actions")) + '">⋯</summary>' +
            '<div class="card-more-menu">' +
              '<button type="button" class="menu-action" data-act="link">' + t("client_link") + "</button>" +
              '<button type="button" class="menu-action" data-act="invoice">' + t("inv_btn") + "</button>" +
              '<button type="button" class="menu-action" data-act="labels">' + t("lb_btn") + "</button>" +
              '<button type="button" class="menu-action" data-act="edit" data-write>' + t("edit") + "</button>" +
              '<button type="button" class="menu-action" data-act="status" data-write>' + t("change_status") + "</button>" +
              '<button type="button" class="menu-action menu-logout owner-only" data-act="delete" data-write>' + t("remove") + "</button>" +
            "</div>" +
          "</details>" +
        "</div>" +
      "</article>";
  }

  // Оплата в карточке: сумма, полоска «сколько оплачено», остаток и прибыль одной строкой
  function payHtml(o) {
    var c = o.client_currency, total = num(o.total_som), paid = num(o.paid_amount), bal = num(o.balance_som);
    if (!(total > 0)) {
      return '<div class="card-pay none"><span class="flag-missing">' + esc(t("no_price")) + "</span>" +
        (paid > 0 ? '<span class="pay-paid">' + esc(t("l_paid")) + " " + cur(paid, c) + "</span>" : "") + "</div>";
    }
    var pct = Math.max(0, Math.min(100, Math.round(paid / total * 100)));
    var pr = num(o.profit_som);
    return '<div class="card-pay">' +
      '<div class="pay-line"><b>' + cur(total, c) + "</b>" +
        (bal > 0 ? '<span class="pay-owe">' + esc(t("pay_owe", { s: cur(bal, c) })) + "</span>"
                 : '<span class="pay-ok">' + ULA.icon("check", 14) + esc(t("pay_full")) + "</span>") + "</div>" +
      '<div class="pay-bar' + (pct >= 100 ? " full" : "") + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="pay-meta"><span>' + esc(t("l_paid")) + " " + cur(paid, c) + "</span>" +
        (o.profit_som != null ? '<span class="owner-only pay-profit' + (pr < 0 ? " loss" : "") + '">' + esc(t("l_profit")) + " " + cur(pr, c) + "</span>" : "") +
      "</div></div>";
  }

  // ---------- Данные клиента в карточке заказа ----------
  var CLOSED = ["delivered", "cancelled"]; // завершённые заказы

  // В строке под номером заказа: город клиента или красная пометка «Нет адреса»
  // Метка «📥 Заявка»: заказ создал клиент по ссылке, ещё не обработан
  function reqTag(o) {
    return o.source === "request" && o.status === "new" ? '<span class="batch-tag req-tag">' + ULA.icon("inbox", 13) + esc(t("rq_tag")) + "</span>" : "";
  }

  // Метка «📦 Партия» на карточке заказа
  // Полоска-шкала: на каком шаге заказ (Новый → … → Выдан). У отменённого шкалы нет.
  function progressHtml(o) {
    var flow = STATUSES.filter(function (s) { return s !== "cancelled"; });
    var i = flow.indexOf(o.status);
    if (i === -1) return "";
    return '<div class="card-progress st-' + o.status + '" role="img" aria-label="' + esc(t("progress_step", { a: i + 1, b: flow.length })) + '">' +
      flow.map(function (s, k) { return '<i class="' + (k < i ? "done" : k === i ? "now" : "") + '"></i>'; }).join("") +
      '<span>' + esc(t("progress_step", { a: i + 1, b: flow.length })) + "</span></div>";
  }

  // клиент подписан на этот заказ в Telegram — статусы он получает сам
  function tgTag(o) {
    return o.tg_subs && o.tg_subs.length ? '<span class="batch-tag tg-tag" title="' + esc(t("tgc_tag_title")) + '">' + U.icon("send", 12) + 'Telegram</span>' : "";
  }

  function trackTag(o) {
    return o.tracking_number ? '<span class="batch-tag track-tag">' + ULA.icon("truck", 13) + esc(t("trk_short")) + "</span>" : "";
  }

  function shipTag(o) {
    if (!o.shipment_id) return "";
    var n = ULA.shipments ? ULA.shipments.name(o.shipment_id) : "";
    return '<span class="batch-tag">' + ULA.icon("truck", 13) + esc(n || t("sh_tag_short")) + "</span>";
  }

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
    state.tab = name === "clients" || name === "shop" || name === "expenses" || name === "shipments" || name === "debts" || name === "report" || name === "analytics" || name === "suppliers" || name === "quote" || name === "exchange" || ((name === "buyers" || name === "support") && isAdmin) ? name : "orders";
    if (!state.ws && state.tab !== "buyers" && state.tab !== "quote" && state.tab !== "exchange" && state.tab !== "support") state.tab = isAdmin ? "buyers" : "orders";
    $("#tab-orders").classList.toggle("hidden", state.tab !== "orders");
    $("#tab-clients").classList.toggle("hidden", state.tab !== "clients");
    $("#tab-shop").classList.toggle("hidden", state.tab !== "shop");
    $("#tab-shipments").classList.toggle("hidden", state.tab !== "shipments");
    $("#tab-debts").classList.toggle("hidden", state.tab !== "debts");
    $("#tab-report").classList.toggle("hidden", state.tab !== "report");
    $("#tab-analytics").classList.toggle("hidden", state.tab !== "analytics");
    $("#tab-expenses").classList.toggle("hidden", state.tab !== "expenses");
    $("#tab-suppliers").classList.toggle("hidden", state.tab !== "suppliers");
    $("#tab-buyers").classList.toggle("hidden", state.tab !== "buyers");
    $("#tab-quote").classList.toggle("hidden", state.tab !== "quote");
    $("#tab-exchange").classList.toggle("hidden", state.tab !== "exchange");
    $("#tab-support").classList.toggle("hidden", state.tab !== "support");
    $("#fab").classList.toggle("hidden", state.tab !== "orders");
    $$(".tab").forEach(function (b) {
      // «Отчёт» открывается из «Аналитики», в меню подсвечиваем «Аналитику»
      var on = b.getAttribute("data-tab") === (state.tab === "report" ? "analytics" : state.tab);
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    closeSectionMenu();
    if (state.tab !== "orders" && ULA.bulk && ULA.bulk.isOn()) ULA.bulk.off();
    window.scrollTo(0, 0);
    if (state.tab === "clients" && db && state.ws) loadClients();
    if (state.tab === "suppliers" && db && state.ws) loadSuppliers();
    if (state.tab === "buyers" && db) loadBuyers();
    if (state.tab === "quote") ULA.quote.open();
    if (state.tab === "exchange" && db) ULA.exchange.open();
    if (state.tab === "shop" && db && state.ws) ULA.shop.open();
    if (state.tab === "shipments") ULA.shipments.open();
    if (state.tab === "debts") ULA.debts.open();
    if (state.tab === "report") ULA.report.open();
    if (state.tab === "analytics") ULA.analytics.open();
    if (state.tab === "expenses" && db && state.ws) ULA.expenses.open();
    if (state.tab === "support" && db) ULA.support.loadThreads();
    updateSectionMenuLabel();
  }

  // Подпись на кнопке меню = название открытого раздела
  function updateSectionMenuLabel() {
    var label = $("#section-menu-label"), active = $(".section-menu .tab.active");
    // название раздела без красной цифры (она лежит в отдельном <span>)
    var name = active && (active.querySelector("[data-i18n]") || active);
    if (label) label.textContent = name ? name.textContent.trim() : t("nav_menu");
    // значок открытого раздела в цвете его группы (Главное — синий, Деньги — зелёный, Ещё — фиолетовый)
    var ico = $("#section-menu-ico");
    if (ico && ULA.icon) {
      var tab = state.tab === "report" ? "analytics" : state.tab;
      var ICONS = { exchange: "wallet", orders: "package", clients: "users", shop: "store", debts: "wallet", analytics: "chart", expenses: "receipt", quote: "calc",
        suppliers: "factory", shipments: "truck", buyers: "users", support: "message" };
      ico.innerHTML = ULA.icon(ICONS[tab] || "package", 17);
      ico.className = "section-menu-ico g-" + ((active && active.getAttribute("data-group")) || "main");
    }
  }

  // Необязательные разделы меню («Партии», «Поставщики»): по умолчанию «Партии» спрятаны, пока ими не пользуются
  function optionalTabs() {
    function stored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
    var hasShipments = !!(ULA.shipments && ULA.shipments.count && ULA.shipments.count() > 0);
    var sh = stored("ula_show_shipments");
    return { shipments: sh === "1" || (sh === null && hasShipments), suppliers: stored("ula_show_suppliers") !== "0" };
  }
  // ---------- Установить на телефон (как приложение) ----------
  // Android/Chrome: браузер сам предлагает установку — показываем его окно по нашей кнопке.
  // iPhone: такого окна нет — показываем, куда нажать («Поделиться» → «На экран Домой»).
  // Уже установлено (открыто с иконки) — кнопки нет.
  var installEvt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; updateInstallBtn(); });
  window.addEventListener("appinstalled", function () { installEvt = null; updateInstallBtn(); toast(t("pwa_done"), "ok"); });
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function isPhone() { return (navigator.maxTouchPoints || 0) > 0 || /Android|iPhone|iPad/.test(navigator.userAgent || ""); }
  function updateInstallBtn() {
    var b = $("#install-btn");
    if (b) b.classList.toggle("hidden", isStandalone() || !(installEvt || isPhone()));
  }
  function bindInstall() {
    updateInstallBtn();
    $("#install-btn").addEventListener("click", async function () {
      closeSectionMenu();
      if (installEvt) {
        installEvt.prompt();
        try { await installEvt.userChoice; } catch (e) { /* ignore */ }
        installEvt = null;
        updateInstallBtn();
        return;
      }
      var steps = isIOS() ? ["pwa_ios1", "pwa_ios2", "pwa_ios3"] : ["pwa_and1", "pwa_and2", "pwa_and3"];
      $("#pwa-steps").innerHTML = steps.map(function (k) { return "<li>" + esc(t(k)) + "</li>"; }).join("");
      openModal("modal-install");
    });
  }

  // ---------- Простой режим ----------
  // Новичку в меню только главное: Заказы, Клиенты, Витрина, Долги. На странице заказов
  // «Что сделать сегодня» стоит первым и раскрыт, лишние кнопки (Выбрать, Из Excel) спрятаны. Остальное — кнопкой «Показать все разделы»
  // в меню или галочкой в настройках. Решение запоминается для каждого человека на этом устройстве.
  // Кто уже работает (15+ заказов), у того меню не меняется. У админа простого режима нет.
  var SIMPLE_TABS = ["orders", "clients", "shop", "debts"];
  function simpleKey() { return "ula_simple_" + ((state.me && state.me.id) || ""); }
  function isSimple() {
    if (!state.me || state.me.role === "admin") return false;
    try { return localStorage.getItem(simpleKey()) === "1"; } catch (e) { return false; }
  }
  function setSimple(on) {
    try { localStorage.setItem(simpleKey(), on ? "1" : "0"); } catch (e) { /* без хранилища — не страшно */ }
    applySimpleMode();
  }
  function decideSimple() {
    if (!state.me || state.me.role === "admin" || state.readOnly) return;
    try {
      if (localStorage.getItem(simpleKey()) === null) localStorage.setItem(simpleKey(), state.orders.length < 15 ? "1" : "0");
    } catch (e) { /* ignore */ }
  }
  function applySimpleMode() {
    var on = isSimple();
    document.body.classList.toggle("simple-mode", on);
    $$(".section-menu .tab").forEach(function (b) {
      b.classList.toggle("simple-hidden", on && SIMPLE_TABS.indexOf(b.getAttribute("data-tab")) === -1);
    });
    // заголовок группы прячем, если в ней не осталось видимых разделов
    $$("[data-group-toggle]").forEach(function (g) {
      var k = g.getAttribute("data-group-toggle");
      var any = $$('.section-menu .tab[data-group="' + k + '"]').some(function (b) {
        return !b.classList.contains("simple-hidden") && !b.classList.contains("hidden") && getComputedStyle(b).display !== "none";
      });
      g.classList.toggle("simple-hidden", on && !any);
    });
    var btn = $("#simple-btn");
    if (btn) {
      btn.classList.toggle("hidden", !state.me || state.me.role === "admin");
      btn.querySelector("span").textContent = t(on ? "sm_show_all" : "sm_simple");
    }
    var cb = $("#s-simple");
    if (cb) cb.checked = on;
    var as = $("#assistant"), sum = $("#tab-orders .summary"), wh = $("#tab-orders .warehouse");
    if (as && sum && wh) {
      if (on) sum.parentNode.insertBefore(as, sum); else wh.parentNode.insertBefore(as, wh.nextSibling);
      var asc = null;
      try { asc = localStorage.getItem("cc_as_collapsed"); } catch (e) { /* ignore */ }
      if (asc === null) { as.classList.toggle("collapsed", !on); $("#as-toggle").setAttribute("aria-expanded", String(on)); }
    }
    if (on && SIMPLE_TABS.indexOf(state.tab) === -1 && state.tab !== "report") switchTab("orders");
  }

  function applyOptionalTabs() {
    var o = optionalTabs();
    var a = $('.section-menu .tab[data-tab="shipments"]'), b = $('.section-menu .tab[data-tab="suppliers"]');
    if (a) a.classList.toggle("hidden", !o.shipments);
    if (b) b.classList.toggle("hidden", !o.suppliers);
  }

  function closeSectionMenu() {
    var menu = $("#section-menu"), button = $("#section-menu-btn");
    if (!menu || !button) return;
    menu.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
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

  // Загружаем только поставщиков текущего кабинета.
  async function loadSuppliers() {
    state.suppliersLoading = true;
    $("#suppliers-loading").classList.remove("hidden");
    try {
      var res = await db.from("suppliers")
        .select("id, name, contact_person, phone, wechat, supplier_link, city, category, address, notes, created_at")
        .eq("workspace_id", state.ws.id)
        .order("name", { ascending: true });
      if (res.error) throw res.error;
      state.suppliers = res.data || [];
    } catch (err) {
      handleError(err);
    }
    state.suppliersLoading = false;
    $("#suppliers-loading").classList.add("hidden");
    $("#supplier-options").innerHTML = state.suppliers.map(function (s) {
      return '<option value="' + esc(s.name) + '"></option>';
    }).join("");
    renderSuppliers();
  }

  function renderSuppliers() {
    var box = $("#suppliers");
    var empty = $("#suppliers-empty");
    if (state.suppliersLoading) return;
    var q = state.suppliersQ.trim().toLowerCase();
    var list = state.suppliers.filter(function (s) {
      return !q || [s.name, s.contact_person, s.phone, s.wechat, s.city, s.category]
        .filter(Boolean).join(" ").toLowerCase().indexOf(q) !== -1;
    });
    $("#suppliers-count").textContent = state.suppliers.length ? t("suppliers_count", { n: list.length }) : "";
    if (!state.suppliers.length) {
      box.innerHTML = "";
      empty.innerHTML = "<strong>" + esc(t("suppliers_empty_title")) + "</strong><br>" + esc(t("suppliers_empty_text"));
      empty.classList.remove("hidden");
      return;
    }
    if (!list.length) {
      box.innerHTML = "";
      empty.textContent = t("nothing_found");
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    box.innerHTML = list.map(function (s) {
      var link = safeUrl(s.supplier_link);
      return '<article class="client-row supplier-row"><div><div class="client-row-name">' + esc(s.name) +
        '</div><div class="client-row-date">' + esc([s.category, s.city].filter(Boolean).join(" · ") || "—") + '</div></div>' +
        '<div class="client-row-contacts">' + (s.contact_person ? '<span>' + esc(s.contact_person) + '</span>' : '') +
        (s.phone ? phoneLink(s.phone) : '') + (s.wechat ? '<span>WeChat: ' + esc(s.wechat) + '</span>' : '') + '</div>' +
        '<div class="client-row-place">' + (s.address ? '<span>' + esc(s.address) + '</span>' : '') +
        (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(t("l_link")) + '</a>' : '') +
        (s.notes ? '<p class="fine-print">' + esc(s.notes) + '</p>' : '') + '</div>' +
        '<div class="client-row-orders"><button type="button" class="btn" data-write data-supplier-edit="' + esc(s.id) + '">' + esc(t("edit")) + '</button>' +
        '<button type="button" class="btn btn-danger owner-only" data-write data-supplier-delete="' + esc(s.id) + '">' + esc(t("remove")) + '</button></div></article>';
    }).join("");
  }

  function openSupplierForm(id) {
    var s = id ? state.suppliers.filter(function (item) { return item.id === id; })[0] : null;
    state.supplierEditing = s || null;
    $("#supplier-form-title").textContent = t(s ? "edit" : "supplier_add");
    $("#sp-name").value = s ? s.name || "" : "";
    $("#sp-contact").value = s ? s.contact_person || "" : "";
    $("#sp-phone").value = s ? s.phone || "" : "";
    $("#sp-wechat").value = s ? s.wechat || "" : "";
    $("#sp-city").value = s ? s.city || "" : "";
    $("#sp-category").value = s ? s.category || "" : "";
    $("#sp-link").value = s ? s.supplier_link || "" : "";
    $("#sp-address").value = s ? s.address || "" : "";
    $("#sp-notes").value = s ? s.notes || "" : "";
    openModal("modal-supplier");
  }

  async function saveSupplier(e) {
    e.preventDefault();
    if (state.readOnly || !state.ws) return;
    var name = $("#sp-name").value.trim();
    if (!name) return $("#sp-name").focus();
    var record = {
      workspace_id: state.ws.id,
      name: name,
      contact_person: $("#sp-contact").value.trim() || null,
      phone: $("#sp-phone").value.trim() || null,
      wechat: $("#sp-wechat").value.trim() || null,
      supplier_link: $("#sp-link").value.trim() || null,
      city: $("#sp-city").value.trim() || null,
      category: $("#sp-category").value.trim() || null,
      address: $("#sp-address").value.trim() || null,
      notes: $("#sp-notes").value.trim() || null
    };
    var button = $("#supplier-save");
    button.disabled = true;
    try {
      var res = state.supplierEditing
        ? await db.from("suppliers").update(record).eq("id", state.supplierEditing.id)
        : await db.from("suppliers").insert(record);
      if (res.error) throw res.error;
      closeModal("modal-supplier");
      toast(t("supplier_saved"), "ok");
      await loadSuppliers();
    } catch (err) {
      handleError(err);
    } finally {
      button.disabled = false;
    }
  }

  async function deleteSupplier(id) {
    if (state.readOnly) return;
    var s = state.suppliers.filter(function (item) { return item.id === id; })[0];
    if (!s || !window.confirm(t("supplier_confirm_delete", { name: s.name }))) return;
    try {
      var res = await db.from("suppliers").delete().eq("id", id);
      if (res.error) throw res.error;
      toast(t("supplier_deleted"), "ok");
      await loadSuppliers();
    } catch (err) {
      handleError(err);
    }
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
    ULA.xlsx.download("ula-clients-" + todayISO() + ".xlsx", [{
      name: t("nav_clients"),
      title: (state.ws ? state.ws.name + " — " : "") + t("nav_clients"),
      subtitle: t("x_made", { d: fmtDate(todayISO()) }) + " · " + t("x_count", { n: list.length }),
      columns: [
        { h: t("l_name"), w: 26, type: "text" }, { h: t("l_phone"), w: 18, type: "text" },
        { h: t("l_telegram"), w: 18, type: "text" }, { h: t("l_city"), w: 18, type: "text" },
        { h: t("l_address"), w: 36, type: "text" }, { h: t("l_pickup"), w: 28, type: "text" },
        { h: t("l_orders"), w: 30, type: "text" }, { h: t("l_added"), w: 14, type: "date" }
      ],
      rows: list.map(function (c) {
        return [c.name, c.phone ? fmtPhone(c.phone) : "", c.telegram ? "@" + String(c.telegram).replace(/^@/, "") : "", c.city, c.address, c.pickup_point,
          (c.orders || []).map(function (o) { return o.order_number; }).join(", "), String(c.created_at || "").slice(0, 10)];
      }),
      total: null
    }]);
    toast(t("export_done"), "ok");
  }

  // =====================================================
  //  УМНЫЙ ПОМОЩНИК (бесплатный, без ИИ)
  //  Сам смотрит заказы и подсказывает, что требует внимания.
  // =====================================================
  function isActive(o) { return CLOSED.indexOf(o.status) === -1; }

  // Подсказки, которые можно «Показать» — это фильтры списка заказов
  var HINT_FILTERS = {
    requests: function (o) { return o.source === "request" && o.status === "new"; },
    no_price: function (o) { return isActive(o) && o.client_price == null; },
    no_address: function (o) { return isActive(o) && !o.client; },
    no_rate: function (o) {
      var goodsNoRate = o.purchase_currency !== o.client_currency && num(o.unit_price_cny) > 0 && num(o.exchange_rate) === 0;
      var dlvNoRate = o.delivery_currency && o.delivery_currency !== o.client_currency && num(o.delivery_cost) > 0 && num(o.delivery_rate) === 0;
      return isActive(o) && (goodsNoRate || dlvNoRate);
    }
  };

  function daysSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 86400000); }

  function buildHints() {
    var list = state.orders;
    var hints = [];
    function add(level, text, action) { hints.push({ level: level, text: text, action: action }); }

    // нет адреса склада
    if (state.ws && !state.ws.warehouse_address && !state.readOnly) {
      add("warn", t("h_no_wh"), { type: "settings" });
    }
    // группы заказов
    ["requests", "no_price", "no_address", "no_rate"].forEach(function (k) {
      var n = list.filter(HINT_FILTERS[k]).length;
      if (n) add(k === "no_rate" ? "bad" : "warn", t("h_" + k, { n: n }), { type: "filter", key: k });
    });
    // заказы в убытке
    list.filter(function (o) { return !isStaff() && o.profit_som != null && num(o.profit_som) < 0; }).slice(0, 3).forEach(function (o) {
      add("bad", t("h_loss", { num: o.order_number, sum: money(o.profit_som) + " " + (o.client_currency || "") }), { type: "order", id: o.id });
    });
    // клиент должен, а товар уже прибыл
    list.filter(function (o) { return (o.status === "arrived" || o.status === "delivered") && num(o.balance_som) > 0; })
      .sort(function (a, b) { return num(b.balance_som) - num(a.balance_som); }).slice(0, 3).forEach(function (o) {
        add("bad", t("h_debt", { name: (o.client && o.client.name) || o.client_name, sum: money(o.balance_som) + " " + (o.client_currency || ""), num: o.order_number }),
          { type: "order", id: o.id });
      });
    // «застрявшие» заказы: больше 10 дней без изменений
    list.filter(function (o) { return isActive(o) && o.updated_at && daysSince(o.updated_at) >= 10; })
      .sort(function (a, b) { return String(a.updated_at).localeCompare(String(b.updated_at)); }).slice(0, 3).forEach(function (o) {
        add("warn", t("h_stuck", { num: o.order_number, days: daysSince(o.updated_at) }), { type: "order", id: o.id });
      });
    // прибыль за текущий месяц (хорошая новость — в конце)
    var month = todayISO().slice(0, 7), profit = {};
    list.forEach(function (o) {
      if (!isStaff() && o.status !== "cancelled" && o.profit_som != null && String(o.order_date).slice(0, 7) === month) {
        var c = o.client_currency || "";
        profit[c] = (profit[c] || 0) + num(o.profit_som);
      }
    });
    var pCodes = Object.keys(profit);
    if (pCodes.length) {
      add("good", t("h_profit_month", { sum: pCodes.map(function (c) { return money(profit[c]) + " " + c; }).join(", ") }), null);
    }
    return hints;
  }

  function hintHtml(h, i) {
    var btn = "";
    if (h.action && h.action.type === "filter") btn = '<button type="button" class="btn" data-hint="' + i + '">' + esc(t("as_show")) + "</button>";
    else if (h.action) btn = '<button type="button" class="btn" data-hint="' + i + '">' + esc(t("as_open")) + "</button>";
    return '<div class="hint ' + h.level + '"><span class="hint-text">' + esc(h.text) + "</span>" + btn + "</div>";
  }

  var currentHints = [];
  function renderAssistant() {
    if (!state.ws) return;
    currentHints = buildHints();
    var problems = currentHints.filter(function (h) { return h.level !== "good"; }).length;
    $("#as-count").textContent = problems ? String(problems) : "";
    $("#as-list").innerHTML = currentHints.length
      ? currentHints.map(hintHtml).join("") + (problems ? "" : '<div class="hint-ok">' + esc(t("as_all_good")) + "</div>")
      : '<div class="hint-ok">' + esc(t("as_all_good")) + "</div>";
    renderHintFilter();
  }

  function onHintClick(e) {
    var b = e.target.closest("[data-hint]");
    if (!b) return;
    var h = currentHints[Number(b.getAttribute("data-hint"))];
    if (!h || !h.action) return;
    if (h.action.type === "filter") setHintFilter(h.action.key);
    else if (h.action.type === "order") openDetail(h.action.id);
    else if (h.action.type === "settings") openSettings("s-warehouse");
  }

  function setHintFilter(key) {
    state.hintFilter = key;
    state.status = "all";
    state.limit = PAGE_SIZE;
    renderChips();
    renderOrders();
    renderHintFilter();
    if (key) $("#orders").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderHintFilter() {
    var key = state.hintFilter;
    $("#hint-filter").classList.toggle("hidden", !key);
    if (key) {
      var n = state.orders.filter(HINT_FILTERS[key]).length;
      $("#hint-filter-text").textContent = t("as_filter", { t: t("h_" + key, { n: n }) });
    }
  }

  // Помощник администратора — по списку кабинетов
  function renderAdminAssistant() {
    var ws = state.buyers || [];
    var hints = [];
    var buyers = ws.filter(function (w) { return w.owner_role === "buyer"; });
    var fresh = buyers.filter(function (w) { return daysSince(w.created_at) <= 7; }).length;
    if (fresh) hints.push({ level: "good", text: t("ha_new", { n: fresh }) });
    buyers.filter(function (w) { return w.owner_active && Number(w.orders_count) === 0 && daysSince(w.created_at) >= 3; })
      .slice(0, 5).forEach(function (w) {
        hints.push({ level: "warn", text: t("ha_idle", { name: w.owner_name || w.owner_email || w.name, days: daysSince(w.created_at) }) });
      });
    var blocked = buyers.filter(function (w) { return !w.owner_active; }).length;
    if (blocked) hints.push({ level: "bad", text: t("ha_blocked", { n: blocked }) });
    var orders = ws.reduce(function (sum, w) { return sum + Number(w.orders_count || 0); }, 0);
    hints.push({ level: "info", text: t("ha_total", { n: ws.length, o: orders }) });
    $("#as-admin-list").innerHTML = hints.map(function (h) {
      return '<div class="hint ' + h.level + '"><span class="hint-text">' + esc(h.text) + "</span></div>";
    }).join("");
  }

  function fmtTime(s) {
    var d = new Date(s);
    return d.toLocaleString(locale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // ---------- ↻ Обновить данные ----------
  // Подтягивает свежие данные из базы, не перезагружая страницу.
  var refreshing = false;
  async function refreshData() {
    if (refreshing) return;
    refreshing = true;
    var btn = $("#refresh-btn");
    btn.classList.add("spinning");
    btn.disabled = true;
    try {
      if (state.ws) {
        // настройки кабинета тоже могли измениться (адрес склада, валюты)
        var w = await db.from("workspaces").select(WS_FIELDS).eq("id", state.ws.id).single();
        if (!w.error) {
          state.ws = w.data;
          if (state.myWs && state.myWs.id === w.data.id) state.myWs = w.data;
          renderWarehouse();
        }
      }
      if (state.tab === "quote") { await ULA.fx.load(true); ULA.quote.open(); }
      else if (state.tab === "shipments") { await loadOrders(); await ULA.shipments.load(false); }
      else if (state.tab === "support") { await ULA.support.loadThreads(); await ULA.support.checkUnread(); }
      else if (state.tab === "clients") await loadClients();
      else if (state.tab === "buyers") await loadBuyers();
      else if (state.tab === "expenses") { await loadOrders(); await ULA.expenses.reload(); }
      else if (state.tab === "exchange") await ULA.exchange.open();
      else await loadOrders();
      // открытая карточка заказа — перерисовать со свежими данными
      if ($("#modal-detail").classList.contains("open")) renderDetail();
      toast(t("refreshed"), "ok");
    } catch (err) {
      handleError(err);
    }
    btn.classList.remove("spinning");
    btn.disabled = false;
    refreshing = false;
  }

  // =====================================================
  //  🤖 ИИ-ПОМОЩНИК АДМИНИСТРАТОРА
  //  Вопрос уходит в функцию Supabase «ai-assistant», она проверяет,
  //  что спрашивает админ, и обращается к Google Gemini.
  // =====================================================
  var ai = { history: [], busy: false };

  function renderAiExamples() {
    $("#ai-examples").innerHTML = ai.history.length ? "" : ["ai_ex1", "ai_ex2", "ai_ex3", "ai_ex4"].map(function (k) {
      return '<button type="button" class="chip" data-ai-ex="' + k + '">' + esc(t(k)) + "</button>";
    }).join("");
  }

  function renderAiLog() {
    $("#ai-log").innerHTML = ai.history.map(function (m) {
      // **жирный** от ИИ показываем жирным, «# » в начале строки убираем
      var html = m.role === "user" ? esc(m.text)
        : esc(m.text).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^#{1,6}\s*/gm, "");
      return '<div class="ai-msg ' + (m.role === "user" ? "ai-me" : "ai-bot") + (m.error ? " ai-error" : "") + '">' + html + "</div>";
    }).join("") + (ai.busy ? '<div class="ai-msg ai-bot ai-wait">' + esc(t("ai_thinking")) + "</div>" : "");
    var log = $("#ai-log");
    log.scrollTop = log.scrollHeight;
    renderAiExamples();
  }

  async function askAi(question) {
    question = String(question || "").trim();
    if (!question || ai.busy) return;
    var history = ai.history.filter(function (m) { return !m.error; }).map(function (m) { return { role: m.role, text: m.text }; });
    ai.history.push({ role: "user", text: question });
    ai.busy = true;
    $("#ai-input").value = "";
    $("#ai-send").disabled = true;
    renderAiLog();
    try {
      var res = await db.functions.invoke("ai-assistant", { body: { question: question, history: history, lang: getLang() } });
      var data = res.data || {};
      if (res.error || data.error) {
        var code = data.error || "";
        try { if (res.error && res.error.context) code = (await res.error.context.json()).error || code; } catch (e) { /* ignore */ }
        throw new Error(code || "ai_failed");
      }
      ai.history.push({ role: "model", text: data.answer });
    } catch (err) {
      console.error(err);
      var msg = /no_api_key|not found|404|Failed to send/i.test(err.message) ? "ai_err_key" : /rate_limited/.test(err.message) ? "ai_err_limit" : "ai_err";
      ai.history.push({ role: "model", text: t(msg), error: true });
    }
    ai.busy = false;
    $("#ai-send").disabled = false;
    renderAiLog();
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
    renderAdminAssistant();
    renderAiLog();

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
  // code = код приглашения или null (свободная регистрация)
  async function initJoin(code) {
    showView("join");
    var ok = !code;
    if (code) {
      try {
        var res = await db.rpc("check_invite", { p_code: code });
        ok = !res.error && res.data === true;
      } catch (err) {
        console.error(err);
      }
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
      if (pass !== $("#join-password2").value) return setJoinError(t("e_password_match"), "#join-password2");
      setJoinError("");

      var btn = $("#join-btn");
      btn.disabled = true;
      btn.textContent = t("join_busy");
      try {
        // Код приглашения уходит вместе с регистрацией — база сама создаст кабинет
        var jTok = await ULA.captcha.get("cf-join");
        var refRaw = new URLSearchParams(location.search).get("ref") || "";
        var refCode = /^[A-Za-z0-9_-]{1,40}$/.test(refRaw) ? refRaw : "";
        var res = await db.auth.signUp({
          email: email,
          password: pass,
          options: {
            captchaToken: jTok || undefined,
            data: code
              ? { invite_code: code, full_name: name, workspace_name: wsName || name, phone: phone, ref: refCode || undefined }
              : { full_name: name, workspace_name: wsName || name, phone: phone, ref: refCode || undefined },
            emailRedirectTo: location.origin + location.pathname
          }
        });
        if (res.error) {
          setJoinError(/registered|exists/i.test(res.error.message) ? t("join_exists") : /captcha/i.test(res.error.message) ? t("captcha_err") : t("error_generic"));
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
    if (act === "show-done") {
      state.status = "delivered";
      state.limit = PAGE_SIZE;
      renderChips();
      renderOrders();
      window.scrollTo(0, $("#chips").getBoundingClientRect().top + window.scrollY - 80);
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
    if (state.readOnly && act !== "open" && act !== "link" && act !== "invoice" && act !== "labels") return;
    if (act === "open") openDetail(o.id);
    else if (act === "edit") { closeModal("modal-detail"); openOrderForm(o); }
    else if (act === "status") openStatus(o);
    else if (act === "link") openLink(o);
    else if (act === "quote") ULA.quote.forOrder(o);
    else if (act === "notify") ULA.notify.open(o);
    else if (act === "invoice") ULA.tools.invoice([o]);
    else if (act === "labels") ULA.tools.labels([o]);
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
        (urls.length ? '<div class="thumbs thumbs-large">' + thumbsHtml(urls, 0, photoThumbs(o)) + "</div>" : "") +
        clientBoxHtml(o.client) +
        specsHtml(o) +
        moneyHtml(o, true) +
        '<dl class="info">' +
          "<div><dt>" + t("f_client") + "</dt><dd>" + esc(o.client_name) + "</dd></div>" +
          (o.shipment_id ? "<div><dt>" + t("sh_tag") + "</dt><dd>" + esc((ULA.shipments && ULA.shipments.name(o.shipment_id)) || "—") + "</dd></div>" : "") +
          "<div><dt>" + t("l_phone") + "</dt><dd>" + phone + "</dd></div>" +
          "<div><dt>" + t("l_wechat") + "</dt><dd>" + esc(o.client_wechat || "—") + "</dd></div>" +
          "<div><dt>" + t("l_supplier") + "</dt><dd>" + esc(o.supplier || "—") + "</dd></div>" +
          (o.supplier_wechat ? "<div><dt>" + t("l_supplier_wechat") + "</dt><dd>" + esc(o.supplier_wechat) + "</dd></div>" : "") +
          (link ? "<div><dt>" + t("l_link") + '</dt><dd><a href="' + esc(link) + '" target="_blank" rel="noopener">' + esc(link) + "</a></dd></div>" : "") +
          (o.tracking_number ? "<div><dt>" + t("trk_title") + '</dt><dd class="trk-dd">' + esc(o.tracking_number) + "</dd></div>" : "") +
          (o.delivery_info ? "<div><dt>" + t("l_delivery_info") + "</dt><dd>" + esc(o.delivery_info) + "</dd></div>" : "") +
          (o.client_comment ? "<div><dt>" + t("l_comment_client") + "</dt><dd>" + esc(o.client_comment) + "</dd></div>" : "") +
          (o.admin_comment ? "<div><dt>" + t("l_comment_admin") + "</dt><dd>" + esc(o.admin_comment) + "</dd></div>" : "") +
        "</dl>" +
        statusHistoryHtml(o.status_history, o) +
        '<div class="card-actions">' +
          '<button type="button" class="btn btn-primary" data-act="edit" data-write>' + t("edit") + "</button>" +
          '<button type="button" class="btn" data-act="status" data-write>' + t("change_status") + "</button>" +
          '<button type="button" class="btn" data-act="notify" data-write>' + t("client_notify") + "</button>" +
          '<button type="button" class="btn" data-act="link">' + t("client_link") + "</button>" +
          '<button type="button" class="btn" data-act="invoice">' + t("inv_btn") + "</button>" +
          '<button type="button" class="btn" data-act="labels">' + t("lb_btn") + "</button>" +
          '<button type="button" class="btn btn-danger owner-only" data-act="delete" data-write>' + t("remove") + "</button>" +
        "</div>" +
      "</div>";
  }

  // Здесь только история статусов, без внутренних заметок и расчётов.
  function historyEventText(item, order) {
    if (item.event_type === "payment") {
      return t("history_payment", { amount: cur(item.paid_total, order && order.client_currency) });
    }
    if (item.event_type === "address") return t("history_address");
    return t("status_" + (item.new_status || item.status));
  }

  function cardHistoryHtml(order) {
    var items = order.status_history || [];
    // У старых заказов истории ещё нет, поэтому показываем их статус и дату обновления.
    if (!items.length) {
      if (!order.status || !order.updated_at) return "";
      return '<p class="card-history"><span class="card-history-label">' + esc(t("history_last")) +
        '</span><strong>' + esc(t("status_" + order.status)) + '</strong><time>' + esc(fmtTime(order.updated_at)) +
        '</time></p>';
    }
    var last = items.slice().sort(function (a, b) {
      return String(b.created_at).localeCompare(String(a.created_at));
    })[0];
    return '<p class="card-history"><span class="card-history-label">' + esc(t("history_last")) +
      '</span><strong>' + esc(historyEventText(last, order)) + '</strong><time>' + esc(fmtTime(last.created_at)) +
      '</time></p>';
  }

  function statusHistoryHtml(history, order) {
    var items = (history || []).slice().sort(function (a, b) {
      return String(a.created_at).localeCompare(String(b.created_at));
    });
    return '<section class="status-history"><h3>' + esc(t("history_title")) + '</h3>' +
      (items.length ? '<ol>' + items.map(function (item) {
        return '<li><span class="status-history-name">' + esc(historyEventText(item, order)) +
          '</span><time>' + esc(new Date(item.created_at).toLocaleString(locale())) + '</time></li>';
      }).join("") + '</ol>' : '<p class="muted">' + esc(t("history_empty")) + '</p>') + '</section>';
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
    var prev = (state.orders.filter(function (x) { return x.id === id; })[0] || {}).status;
    var res = await db.from("orders").update({ status: status }).eq("id", id);
    if (res.error) { handleError(res.error); return; }
    var o = state.orders.filter(function (x) { return x.id === id; })[0];
    if (o) {
      o.status = status;
      var historyRes = await db.from("order_status_history")
        .select("event_type, new_status, paid_total, created_at").eq("order_id", id).order("created_at", { ascending: true });
      if (!historyRes.error) o.status_history = historyRes.data;
    }
    closeModal("modal-status");
    renderAll();
    if ($("#modal-detail").classList.contains("open")) renderDetail();
    toast(t("status_changed"), "ok");
    if (prev !== status) tgNotify([id]);
    // отменённый заказ не участвует в делёже партии: пересчитываем
    if (o && o.shipment_id && (status === "cancelled" || prev === "cancelled")) {
      await db.rpc("shipment_recalc", { p_shipment: o.shipment_id });
      await loadOrders();
    }
    // предлагаем сразу сообщить клиенту (можно отключить галочкой в самом окне)
    if (o && prev !== status && ULA.notify.autoEnabled()) ULA.notify.open(o, { afterStatus: true });
  }

  // ---------- Ссылка клиенту ----------
  function openLink(o) {
    state.linkOrderId = o.id;
    renderLinkModal(o);
    openModal("modal-link");
    cabLoad(o);
    var url = clientUrl(o);
    if (url) copyText(url).then(function (ok) { if (ok) toast(t("copied"), "ok"); });
  }

  // Показываем только те кнопки ссылки, которые сейчас доступны.
  function renderLinkModal(o) {
    var url = clientUrl(o), active = !!url;
    $("#link-state").textContent = t(active ? "link_active" : "link_disabled");
    $("#link-input").value = url;
    $("#link-input").classList.toggle("hidden", !active);
    $("#link-active-controls").classList.toggle("hidden", !active);
    $("#link-rotate").textContent = t(active ? "link_rotate" : "link_create");
    $("#link-rotate").classList.toggle("hidden", state.readOnly);
    $("#link-revoke").classList.toggle("hidden", !active || state.readOnly);
    $("#link-wa").href = active
      ? "https://wa.me/?text=" + encodeURIComponent(t("wa_text", { n: o.order_number }) + " " + url)
      : "#";
    $("#link-open").href = active ? url : "#";
  }

  // ---------- Общая ссылка клиента (все его заказы) ----------
  function cabUrl(token) {
    var base = location.origin + location.pathname.replace(/index\.html$/, "");
    return base + "?c=" + token;
  }

  function renderCabBox(token) {
    var url = token ? cabUrl(token) : "";
    $("#cab-input").value = url;
    $("#cab-input").classList.toggle("hidden", !token);
    $("#cab-copy").classList.toggle("hidden", !token);
    $("#cab-wa").classList.toggle("hidden", !token);
    $("#cab-wa").href = token ? "https://wa.me/?text=" + encodeURIComponent(t("lk_all_wa") + " " + url) : "#";
    $("#cab-create").classList.toggle("hidden", !!token || state.readOnly);
    $("#cab-revoke").classList.toggle("hidden", !token || state.readOnly);
  }

  async function cabLoad(o) {
    renderCabBox("");
    $("#cab-create").classList.add("hidden");
    try {
      var res = await db.rpc("client_cabinet", { p_order_id: o.id, p_action: "get" });
      if (res.error) throw res.error;
      if (state.linkOrderId === o.id) renderCabBox(res.data || "");
    } catch (err) {
      console.error(err);
      if (state.linkOrderId === o.id) renderCabBox("");
    }
  }

  async function cabAction(action) {
    var o = state.orders.find(function (x) { return x.id === state.linkOrderId; });
    if (!o || state.readOnly) return;
    if (action === "revoke" && !window.confirm(t("lk_all_confirm_revoke"))) return;
    var btn = $(action === "create" ? "#cab-create" : "#cab-revoke");
    btn.disabled = true;
    try {
      var res = await db.rpc("client_cabinet", { p_order_id: o.id, p_action: action });
      if (res.error) throw res.error;
      renderCabBox(res.data || "");
      if (action === "create") {
        await copyText(cabUrl(res.data));
        toast(t("lk_all_created"), "ok");
      } else {
        toast(t("lk_all_revoked"), "ok");
      }
    } catch (err) {
      handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  async function rotateClientLink() {
    var o = state.orders.find(function (x) { return x.id === state.linkOrderId; });
    if (!o || state.readOnly) return;
    if (o.public_token && !window.confirm(t("link_confirm_rotate", { n: o.order_number }))) return;
    var button = $("#link-rotate");
    button.disabled = true;
    try {
      var res = await db.rpc("rotate_client_link", { p_order_id: o.id });
      if (res.error) throw res.error;
      o.public_token = res.data;
      renderLinkModal(o);
      await copyText(clientUrl(o));
      toast(t("link_created"), "ok");
    } catch (err) {
      handleError(err);
    } finally {
      button.disabled = false;
    }
  }

  async function revokeClientLink() {
    var o = state.orders.find(function (x) { return x.id === state.linkOrderId; });
    if (!o || !o.public_token || state.readOnly) return;
    if (!window.confirm(t("link_confirm_revoke", { n: o.order_number }))) return;
    var button = $("#link-revoke");
    button.disabled = true;
    try {
      var res = await db.rpc("revoke_client_link", { p_order_id: o.id });
      if (res.error) throw res.error;
      o.public_token = null;
      renderLinkModal(o);
      toast(t("link_revoked"), "ok");
    } catch (err) {
      handleError(err);
    } finally {
      button.disabled = false;
    }
  }

  // ---------- Удаление ----------
  async function deleteOrder(o) {
    if (!window.confirm(t("confirm_delete", { n: o.order_number }))) return;
    try {
      var paths = (o.order_photos || []).map(function (p) { return p.storage_path; });
      if (paths.length) await db.storage.from(BUCKET).remove(withThumbs(paths));
      var res = await db.from("orders").delete().eq("id", o.id);
      if (res.error) throw res.error;
      closeModal("modal-detail");
      if (o.shipment_id) {
        // остальные заказы партии делят её доставку заново
        await db.rpc("shipment_recalc", { p_shipment: o.shipment_id });
        await loadOrders();
      } else {
        state.orders = state.orders.filter(function (x) { return x.id !== o.id; });
        renderAll();
      }
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

  // Короткая форма: у нового заказа видно только главное (клиент, товар, цена, вес, оплата, фото).
  // Валюты, тариф, поставщик и прочее берутся из настроек и прячутся под «Показать все поля».
  // Выбор «показывать всё» запоминается на этом устройстве. Изменение заказа — всегда полная форма.
  function formFullPref() { try { return localStorage.getItem("ula_form_full") === "1"; } catch (e) { return false; } }
  function setFormShort(on) {
    $("#order-form").classList.toggle("form-short", on);
    $("#f-more").textContent = t(on ? "f_more_show" : "f_more_hide");
    $("#f-more").classList.toggle("hidden", !!form.editing);
  }

  function openOrderForm(o) {
    releasePending();
    form.editing = o || null;
    form.existing = o ? sortedPhotos(o) : [];
    form.removed = [];

    var set = function (id, v) { $("#f-" + id).value = v == null ? "" : v; };
    $("#order-form-title").textContent = t(o ? "edit_order" : "new_order");
    setFormShort(!o && !formFullPref());
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
      fillCurrencySelect($("#f-purchase_currency"), o.purchase_currency || "CNY", PURCHASE_CURRENCIES);
      fillCurrencySelect($("#f-client_currency"), o.client_currency || "KGS");
      fillCurrencySelect($("#f-delivery_currency"), o.delivery_currency || o.client_currency || "USD", deliveryCurrencies(o.client_currency || "KGS"));
      set("delivery_tariff", numStr(o.delivery_tariff));
      set("delivery_rate", numStr(o.delivery_rate));
      set("quantity", numStr(o.quantity));
      set("unit_price_cny", numStr(o.unit_price_cny));
      set("exchange_rate", numStr(o.exchange_rate));
      set("weight_kg", numStr(o.weight_kg));
      set("delivery_cost", numStr(o.delivery_cost));
      set("paid_amount", numStr(o.paid_amount));
      set("client_price", o.client_price == null ? "" : String(num(o.client_price)));
      set("markup", o.client_price != null && num(o.cost_som) > 0
        ? String(Math.round((num(o.client_price) / num(o.cost_som) - 1) * 1000) / 10) : "");
      set("tracking_number", o.tracking_number);
      set("delivery_info", o.delivery_info);
      set("client_comment", o.client_comment);
      set("admin_comment", o.admin_comment);
    } else {
      // валюты по умолчанию — из настроек кабинета
      var ws = state.ws || {};
      fillCurrencySelect($("#f-purchase_currency"), ws.default_purchase_currency || "CNY", PURCHASE_CURRENCIES);
      fillCurrencySelect($("#f-client_currency"), ws.default_client_currency || "KGS");
      fillCurrencySelect($("#f-delivery_currency"), ws.default_delivery_currency || "USD", deliveryCurrencies($("#f-client_currency").value));
      set("delivery_tariff", numStr(ws.default_delivery_tariff));
      set("order_number", ""); // номер выдаст база после сохранения
      set("order_date", todayISO());
      ["client_name", "client_phone", "client_wechat", "product_ru", "product_zh", "supplier",
        "supplier_link", "supplier_wechat", "unit_price_cny", "weight_kg", "tracking_number", "delivery_info", "client_comment", "admin_comment"
      ].forEach(function (id) { set(id, ""); });
      set("quantity", "1");
      set("exchange_rate", lastRateFor($("#f-purchase_currency").value, $("#f-client_currency").value));
      set("delivery_cost", "");
      set("delivery_rate", lastRateFor($("#f-delivery_currency").value, $("#f-client_currency").value));
      set("paid_amount", "");
      set("client_price", "");
      set("markup", "");
    }
    var sn = $("#f-ship-note");
    if (o && o.shipment_id) {
      sn.textContent = t("sh_order_note", { n: (ULA.shipments && ULA.shipments.name(o.shipment_id)) || "" });
      sn.classList.remove("hidden");
    } else sn.classList.add("hidden");
    updateCalc();
    renderPhotoPreviews();
    openModal("modal-order");
    var body = $("#order-form .modal-body");
    if (body) body.scrollTop = 0;
  }

  // Открыть форму нового заказа, уже заполненную из «Расчёта цены» (js/quote.js)
  function openOrderPrefill(d) {
    openOrderForm(null);
    var set = function (id, v) { $("#f-" + id).value = v == null || v === 0 ? "" : String(v); };
    fillCurrencySelect($("#f-purchase_currency"), d.purchase_currency, PURCHASE_CURRENCIES);
    fillCurrencySelect($("#f-client_currency"), d.client_currency);
    fillCurrencySelect($("#f-delivery_currency"), d.delivery_currency, deliveryCurrencies(d.client_currency));
    set("quantity", d.quantity);
    set("unit_price_cny", d.unit_price);
    set("exchange_rate", d.exchange_rate);
    set("weight_kg", d.weight);
    set("delivery_tariff", d.tariff);
    set("delivery_cost", d.delivery_cost);
    set("delivery_rate", d.delivery_rate);
    set("client_price", d.client_price);
    set("markup", d.markup);
    set("product_ru", d.product_ru);
    set("supplier_link", d.supplier_link);
    updateCalc();
  }

  // Цена из «Расчёта» для уже существующего заказа (заявки клиента): открываем заказ и подставляем цифры
  function openOrderApply(o, d) {
    openOrderForm(o);
    var set = function (id, v) { $("#f-" + id).value = v == null || v === 0 ? "" : String(v); };
    fillCurrencySelect($("#f-purchase_currency"), d.purchase_currency, PURCHASE_CURRENCIES);
    fillCurrencySelect($("#f-client_currency"), d.client_currency);
    fillCurrencySelect($("#f-delivery_currency"), d.delivery_currency, deliveryCurrencies(d.client_currency));
    set("quantity", d.quantity);
    set("unit_price_cny", d.unit_price);
    set("exchange_rate", d.exchange_rate);
    set("weight_kg", d.weight);
    set("delivery_tariff", d.tariff);
    set("delivery_cost", d.delivery_cost);
    set("delivery_rate", d.delivery_rate);
    set("client_price", d.client_price);
    set("markup", d.markup);
    if (o.status === "new") $("#f-status").value = "awaiting_payment";   // цена названа — ждём оплату
    updateCalc();
  }

  // Себестоимость по тому, что сейчас вписано в форме (в валюте клиента)
  function currentCost() {
    return parseNum($("#f-quantity").value) * parseNum($("#f-unit_price_cny").value) * parseNum($("#f-exchange_rate").value) +
      parseNum($("#f-delivery_cost").value) * parseNum($("#f-delivery_rate").value);
  }

  // Курс для нового заказа: сначала «Мой курс» байера, иначе последний введённый в заказе
  function lastRateFor(a, b) {
    if (a === b) return "1";
    var mine = ULA.fx.myRate(a, b);
    if (mine != null) return numStr(Math.round(mine * 10000) / 10000);
    try { return localStorage.getItem("cc_rate_" + a + "_" + b) || ""; } catch (e) { return ""; }
  }

  // Подписи полей с кодом валюты: «Цена за единицу, CNY», «Курс: 1 CNY = ? KGS»
  function updateCurrencyLabels() {
    var a = $("#f-purchase_currency").value, b = $("#f-client_currency").value;
    var same = a === b;
    $("#lbl-price").textContent = t("f_price_cur", { c: a });
    $("#lbl-rate").textContent = same ? t("f_rate_same") : t("f_rate_cur", { a: a, b: b });
    $("#lbl-paid").textContent = t("f_paid_cur", { c: b });
    $("#lbl-client-price").textContent = t("f_client_price_cur", { c: b });
    var rate = $("#f-exchange_rate");
    rate.readOnly = same;
    if (same) rate.value = "1";

    // доставка
    var dc = $("#f-delivery_currency").value;
    var dSame = dc === b;
    $("#lbl-tariff").textContent = t("f_tariff_cur", { c: dc });
    $("#lbl-delivery").textContent = t("f_delivery_cur", { c: dc });
    $("#lbl-delivery-rate").textContent = dSame ? t("f_rate_same") : t("f_delivery_rate_cur", { a: dc, b: b });
    var dRate = $("#f-delivery_rate");
    dRate.readOnly = dSame;
    if (dSame) dRate.value = "1";
  }

  // Сменили валюту в заказе — обновить подписи и подставить знакомый курс
  function onCurrencyChange() {
    var a = $("#f-purchase_currency").value, b = $("#f-client_currency").value;
    $("#f-exchange_rate").value = lastRateFor(a, b);
    // список валют доставки зависит от валюты клиента
    var dSel = $("#f-delivery_currency");
    var dc = deliveryCurrencies(b).indexOf(dSel.value) !== -1 ? dSel.value : "USD";
    fillCurrencySelect(dSel, dc, deliveryCurrencies(b));
    $("#f-delivery_rate").value = lastRateFor(dc, b);
    updateCalc();
  }

  function onDeliveryCurrencyChange() {
    $("#f-delivery_rate").value = lastRateFor($("#f-delivery_currency").value, $("#f-client_currency").value);
    updateCalc();
  }

  function updateCalc() {
    updateCurrencyLabels();
    var a = $("#f-purchase_currency").value, b = $("#f-client_currency").value;
    var q = parseNum($("#f-quantity").value);
    var p = parseNum($("#f-unit_price_cny").value);
    var r = parseNum($("#f-exchange_rate").value);
    var dc = $("#f-delivery_currency").value;
    var dAmount = parseNum($("#f-delivery_cost").value);   // в валюте доставки
    var dRate = parseNum($("#f-delivery_rate").value);
    var d = dAmount * dRate;                               // в валюте клиента
    var paid = parseNum($("#f-paid_amount").value);
    var goodsCny = q * p;
    var goodsSom = goodsCny * r;
    var cost = goodsSom + d;                                  // себестоимость
    var cp = $("#f-client_price").value.trim() ? parseNum($("#f-client_price").value) : null; // цена для клиента
    var total = cp != null ? cp : cost;                       // к оплате клиентом
    var profit = cp != null ? cp - cost : null;
    var bal = total - paid;
    $("#calc-goods-cny").textContent = money(q) + " × " + money(p) + " " + a + " = " + money(goodsCny) + " " + a;
    $("#calc-goods-som").textContent = a === b
      ? money(goodsSom) + " " + b
      : money(goodsCny) + " " + a + " × " + money(r) + " = " + money(goodsSom) + " " + b;
    $("#calc-delivery").textContent = dc === b
      ? money(d) + " " + b
      : money(dAmount) + " " + dc + " × " + money(dRate) + " = " + money(d) + " " + b;
    $("#calc-cost").textContent = money(cost) + " " + b;
    $("#calc-total").textContent = money(total) + " " + b;
    $("#calc-profit").textContent = profit == null ? "—"
      : money(profit) + " " + b + (cost > 0 ? " (" + money(Math.round(profit / cost * 1000) / 10) + "%)" : "");
    $(".calc-profit").classList.toggle("loss", profit != null && profit < 0);
    $("#calc-paid").textContent = money(paid) + " " + b;
    $("#calc-balance").textContent = money(bal) + " " + b;
    $(".calc-balance").classList.toggle("owe", bal > 0);
    $(".calc-balance").classList.toggle("clear", bal <= 0);
  }

  function renderPhotoPreviews() {
    var html = "";
    form.existing.forEach(function (p) {
      html += '<div class="pv"><img src="' + esc(thumbUrl(p.storage_path)) + '" alt="">' +
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
      delivery_currency: $("#f-delivery_currency").value,
      delivery_tariff: parseNum(val("delivery_tariff")),
      delivery_rate: parseNum(val("delivery_rate")),
      client_price: val("client_price") ? parseNum(val("client_price")) : null,
      paid_amount: parseNum(val("paid_amount")),
      tracking_number: val("tracking_number").replace(/\s+/g, " ").slice(0, 100) || null,
      delivery_info: val("delivery_info") || null,
      client_comment: val("client_comment") || null,
      admin_comment: val("admin_comment") || null
    };
  }

  // ---------- Сжатие фото ----------
  // Фото с телефона (3–8 МБ) уменьшаем прямо в браузере, до загрузки:
  //   • заказ: до 1280 px и ~250 КБ, в WebP (если браузер умеет) — иначе JPEG;
  //   • маленькая копия для списков: 360 px, ~30 КБ, всегда JPEG («…_t.jpg» рядом с основным файлом).
  // Качество снижается по шагам, пока файл не станет меньше нужного размера. Данные о месте съёмки (EXIF) не сохраняются.
  var WEBP = (function () {
    try { return document.createElement("canvas").toDataURL("image/webp").indexOf("data:image/webp") === 0; } catch (e) { return false; }
  })();

  async function shrinkImage(file, maxSide, maxBytes, forceJpeg) {
    var QUALITY = [0.82, 0.74, 0.66, 0.58, 0.5];
    var best = null;
    try {
      var bmp = await createImageBitmap(file);
      var type = WEBP && !forceJpeg ? "image/webp" : "image/jpeg";
      var side = Math.min(maxSide, Math.max(bmp.width, bmp.height));
      for (var round = 0; round < 4; round++) {
        var scale = side / Math.max(bmp.width, bmp.height);
        var canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bmp.width * scale));
        canvas.height = Math.max(1, Math.round(bmp.height * scale));
        var g = canvas.getContext("2d");
        g.fillStyle = "#fff";                        // прозрачный PNG → белый фон, а не чёрный
        g.fillRect(0, 0, canvas.width, canvas.height);
        g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        for (var i = 0; i < QUALITY.length; i++) {
          var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, type, QUALITY[i]); });
          if (!blob) continue;
          if (!best || blob.size < best.size) best = blob;
          if (blob.size <= maxBytes) return blob;
        }
        side = Math.round(side * 0.8);                // всё ещё большой — уменьшаем размер
      }
    } catch (e) {
      console.warn("Не удалось сжать фото, загружаем как есть", e);
    }
    return best && best.size < file.size ? best : (best || file);
  }

  // Маленькая копия есть только у фото, загруженных после сжатия (имя «…_m.webp/jpg»)
  function thumbPath(path) {
    return /_m\.(webp|jpg)$/.test(path || "") ? path.replace(/_m\.(webp|jpg)$/, "_t.jpg") : "";
  }
  function thumbUrl(path) { return photoUrl(thumbPath(path) || path); }
  function withThumbs(paths) {
    var all = [];
    paths.forEach(function (p) { all.push(p); var t = thumbPath(p); if (t) all.push(t); });
    return all;
  }

  async function uploadPhoto(orderId, file) {
    var blob = await shrinkImage(file, 1280, 260 * 1024);
    var small = await shrinkImage(file, 360, 32 * 1024, true);
    var type = blob.type || "image/jpeg";
    var name = orderId + "/" + uid();
    var path = name + "_m." + (type === "image/webp" ? "webp" : "jpg");
    if (type !== "image/webp" && type !== "image/jpeg") path = name + "." + (type.split("/")[1] || "jpg");   // не получилось сжать
    var up = await db.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (up.error) throw up.error;
    var tp = thumbPath(path);
    if (tp && small && small.type === "image/jpeg") {
      var upT = await db.storage.from(BUCKET).upload(tp, small, { contentType: "image/jpeg", upsert: false });
      if (upT.error) console.warn("thumb", upT.error);   // без маленькой копии фото всё равно работает
    }
    var ins = await db.from("order_photos").insert({ order_id: orderId, storage_path: path });
    if (ins.error) {
      await db.storage.from(BUCKET).remove(withThumbs([path]));
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
      var orderId, statusChanged = false;
      if (form.editing) {
        var upd = await db.from("orders").update(v).eq("id", form.editing.id);
        if (upd.error) throw upd.error;
        orderId = form.editing.id;
        statusChanged = form.editing.status !== v.status;
      } else {
        v.workspace_id = state.ws.id;
        var ins = await db.from("orders").insert(v).select("id, order_number").single();
        if (ins.error) throw ins.error;
        orderId = ins.data.id;
      }
      if (v.exchange_rate > 0) {
        try { localStorage.setItem("cc_rate_" + v.purchase_currency + "_" + v.client_currency, String(v.exchange_rate)); } catch (err) { /* ignore */ }
      }
      if (v.delivery_rate > 0 && v.delivery_currency !== v.client_currency) {
        try { localStorage.setItem("cc_rate_" + v.delivery_currency + "_" + v.client_currency, String(v.delivery_rate)); } catch (err) { /* ignore */ }
      }

      if (form.removed.length) {
        await db.storage.from(BUCKET).remove(withThumbs(form.removed.map(function (p) { return p.storage_path; })));
        await db.from("order_photos").delete().in("id", form.removed.map(function (p) { return p.id; }));
      }

      var failed = 0;
      for (var i = 0; i < form.pending.length; i++) {
        try { await uploadPhoto(orderId, form.pending[i].file); }
        catch (err) { console.error(err); failed++; }
      }

      // заказ лежит в партии: вес или статус мог измениться — делим доставку партии заново
      var shipId = form.editing && form.editing.shipment_id;
      if (shipId) await db.rpc("shipment_recalc", { p_shipment: shipId });

      closeModal("modal-order");
      if (failed) toast(t("photo_failed", { n: failed }), "error");
      else toast(form.editing ? t("saved") : t("saved") + ": № " + ins.data.order_number, "ok");
      await loadOrders();
      if (statusChanged) tgNotify([orderId]);   // клиенту в Telegram — новый статус
    } catch (err) {
      handleError(err);
    } finally {
      form.saving = false;
      btn.disabled = false;
      btn.textContent = t("save");
    }
  }

  function cleanPhone(v) {
    var p = String(v || "").replace(/[\s().\-]/g, "");
    if (p.indexOf("00") === 0) p = "+" + p.slice(2);
    return p;
  }

  // ---------- Помощники для частей сайта в отдельных файлах ----------
  ULA.core = {
    $: $, $$: $$, esc: esc, toast: toast, handleError: handleError,
    money: money, numStr: numStr, parseNum: parseNum, locale: locale,
    curName: curName, fillCurrencySelect: fillCurrencySelect, openModal: openModal,
    fmtTime: fmtTime, state: state, WS_FIELDS: WS_FIELDS, APP_VERSION: APP_VERSION,
    num: num, cur: cur, fmtDate: fmtDate, fmtPhone: fmtPhone, cleanPhone: cleanPhone,
    photoUrl: photoUrl, thumbUrl: thumbUrl, shrinkImage: shrinkImage, openLightbox: openLightbox, showView: showView,
    clientUrl: clientUrl, copyText: copyText, closeModal: closeModal,
    switchTab: switchTab, deliveryCurrencies: deliveryCurrencies, PURCHASE_CURRENCIES: PURCHASE_CURRENCIES,
    lastRateFor: lastRateFor, openOrderPrefill: openOrderPrefill, openOrderApply: openOrderApply, openDetail: openDetail,
    filteredOrders: function () { return filtered(); },
    tgNotify: tgNotify,
    openNotifyText: function (cfg) { ULA.notify.openText(cfg); },
    csvCell: csvCell, todayISO: todayISO, reloadOrders: loadOrders, renderAll: renderAll,
    statusHistoryHtml: statusHistoryHtml, STATUSES: STATUSES, CLOSED: CLOSED,
    db: function () { return db; } // база появляется позже, при запуске
  };

})();
