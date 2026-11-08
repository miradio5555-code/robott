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

  // Общая ссылка клиента (?c=токен): список всех его заказов, по нажатию — страница заказа
  var cab = { token: "", data: null, open: false, busy: false, lastOpened: null };

  // Telegram-уведомления клиенту по этому заказу
  var tgc = { loaded: false, bot: null, subscribed: false, opened: false, busy: false, error: "" };

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
      cd.editing = !!(state.client && !dlv(state.client) && !isClosed());
    } catch (err) {
      console.error(err);
      state.clientState = "error";
    }
    renderClient();
    if (state.clientState === "ok") tgLoad();
  }

  async function initCabinet(token) {
    showView("client");
    cab.token = token;
    renderClient();
    bindClientUI();
    if (!/^[a-f0-9]{32}$/i.test(token)) { state.clientState = "notfound"; renderClient(); return; }
    try {
      var res = await c.db().rpc("get_client_cabinet", { p_token: token });
      if (res.error) throw res.error;
      cab.data = res.data || null;
      state.clientState = res.data ? "ok" : "notfound";
    } catch (err) {
      console.error(err);
      state.clientState = "error";
    }
    renderClient();
  }

  // Открыть один заказ из списка / вернуться к списку
  async function openCabOrder(number) {
    if (cab.busy) return;
    cab.busy = true;
    try {
      var res = await c.db().rpc("get_cabinet_order", { p_token: cab.token, p_order_number: number });
      if (res.error) throw res.error;
      if (!res.data) { cabLost(); cab.busy = false; return; }   // ссылка отключена или заказ больше не принадлежит клиенту
      state.client = res.data;
      cab.open = true;
      cab.lastOpened = number;
      cd.editing = false;
      cd.draft = null; cd.errors = {};
      renderClient();
      window.scrollTo(0, 0);
      focusHeading();
    } catch (err) {
      console.error(err);
      toast(t("cab_net_err"), "error");
    }
    cab.busy = false;
  }

  // Сервер больше не подтверждает доступ: показываем «ссылка не работает», данные на экране не оставляем
  function cabLost() {
    cab.data = null; cab.open = false; state.client = null;
    state.clientState = "notfound";
    renderClient();
  }

  function focusHeading() {
    var h = $("#client-content h1");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  // ---------- общие помощники для списка и страницы заказа ----------
  // цена известна? Сервер с файлом 61 отдаёт price_set; без него (старая база) — по старому признаку.
  // Неизвестная цена — «пока не назначена», а не 0; закупочная стоимость сервером не отдаётся.
  function priced(o) { return typeof o.price_set === "boolean" ? o.price_set : (num(o.total_som) > 0 || num(o.paid_amount) > 0); }
  // адрес этого заказа: предложение клиента / принятый байером (файл 61) или старая карточка клиента
  function dlv(o) { return (o && (o.delivery || o.client)) || null; }
  function dlvState(o) { return o && o.delivery ? o.delivery.state : ""; }
  function dlvNew(o) { return !!o && o.delivery !== undefined; }   // сервер с файлом 61
  function isLive(o) { return CLOSED.indexOf(o.status) === -1; }

  // «12.12.2026» или «12.12.2026 – 15.12.2026»; пусто, если срок не задан
  function etaText(o) {
    var a = o.delivery_eta_from, b = o.delivery_eta_to;
    if (!a || !b) return "";
    return a === b ? fmtDate(a) : fmtDate(a) + " – " + fmtDate(b);
  }
  // база без файла 60 срок и контакт не отдаёт: тогда ничего не обещаем и не пишем «срока нет»
  function hasEta(o) { return Object.prototype.hasOwnProperty.call(o, "delivery_eta_from"); }
  function etaLine(o) {
    if (!isLive(o) || !hasEta(o)) return "";
    var e = etaText(o);
    return '<span class="cab-meta">' + esc(t("cab_eta")) + ": " + (e ? esc(e) : esc(t("cab_eta_none"))) + "</span>";
  }

  // способы связи, которые байер указал сам (секретные ссылки никуда не передаются)
  function contactLinks(ct) {
    var out = [];
    if (!ct) return out;
    if (ct.telegram) out.push({ k: "tg", label: t("cab_contact_tg"), href: "https://t.me/" + encodeURIComponent(ct.telegram), ext: true });
    if (ct.phone) {
      out.push({ k: "wa", label: t("cab_contact_wa"), href: "https://wa.me/" + String(ct.phone).replace(/\D/g, ""), ext: true });
      out.push({ k: "tel", label: t("cab_contact_call"), href: "tel:" + ct.phone, ext: false });
    }
    return out;
  }
  function linkAttrs(l) { return ' href="' + esc(l.href) + '"' + (l.ext ? ' target="_blank" rel="noopener"' : ""); }
  function contactBlockHtml(ct, known) {
    if (known === false) return "";
    var ls = contactLinks(ct);
    return '<section class="client-block cab-contact" aria-labelledby="cab-contact-t"><h2 id="cab-contact-t">' + esc(t("cab_contact_title")) + "</h2>" +
      (ls.length ? '<div class="track-actions">' + ls.map(function (l) { return '<a class="btn"' + linkAttrs(l) + ">" + esc(l.label) + "</a>"; }).join("") + "</div>"
                 : '<p class="muted">' + esc(t("cab_contact_none")) + "</p>") +
      "</section>";
  }

  // Следующий шаг: текст и (если есть реально работающее действие) одна главная кнопка
  // в списке карточка общая на всего клиента; сервер без файла 60 про карточку не сообщает — тогда про адрес не спрашиваем
  function hasCard(o) {
    if (o.delivery !== undefined) return !!(o.delivery || o.client);   // файл 61: адрес хранится на заказе
    if (Object.prototype.hasOwnProperty.call(o, "delivery_state")) return !!(o.delivery_state || (cab.data && cab.data.card));
    if (cab.token && !(cab.data && typeof cab.data.card === "boolean")) return true;
    return o.client !== undefined ? !!o.client : !(cab.data && cab.data.card === false);
  }
  function nextStep(o) {
    var bal = num(o.balance_som), ls = contactLinks(o.contact), cc = o.client_currency || "KGS";
    if (o.status === "cancelled") return { text: t("ns_cancelled") };
    if (o.status === "delivered") return { text: t("ns_done") };
    if (!priced(o)) return { text: t("ns_unpriced") };
    if (!hasCard(o)) return { text: t("ns_addr") };   // действие — сама форма адреса ниже
    var contact = ls.length ? { label: t("cab_contact_btn"), link: ls[0] } : null;
    if (bal > 0) return { text: t("ns_pay", { sum: cur(bal, cc) }), btn: contact };
    if (o.status === "arrived") return { text: t("ns_arrived"), btn: contact };
    if (o.status === "in_transit") {
      var n = String(o.tracking_number || "").trim();
      return n ? { text: t("ns_transit"), btn: { label: t("trk_where"), link: { href: trackUrl(n), ext: true } } } : { text: t("ns_transit_notrack"), btn: contact };
    }
    return { text: t("ns_progress") };
  }
  function trackUrl(n) {
    var lang = { ru: "ru", en: "en", zh: "zh-cn" }[typeof getLang === "function" ? getLang() : "ru"] || "ru";
    return "https://t.17track.net/" + lang + "#nums=" + encodeURIComponent(n);
  }
  function nextStepHtml(o) {
    var ns = nextStep(o);
    return '<section class="client-block next-step" aria-labelledby="ns-t"><h2 id="ns-t">' + esc(t("cab_next")) + "</h2><p>" + esc(ns.text) + "</p>" +
      (ns.btn ? '<a class="btn btn-primary"' + linkAttrs(ns.btn.link) + ">" + esc(ns.btn.label) + "</a>" : "") + "</section>";
  }

  function cabCardHtml(o) {
    var cc = o.client_currency || "KGS", bal = num(o.balance_som), ns = nextStep(o);
    var money_line = o.status === "cancelled" ? ""
      : !priced(o) ? '<span class="cab-meta">' + esc(t("cab_unpriced")) + (num(o.paid_amount) > 0 ? " · " + esc(t("l_paid")) + ": " + cur(o.paid_amount, cc) : "") + "</span>"
      : bal > 0 ? '<span class="cab-owe">' + esc(t("cl_left")) + ": " + cur(bal, cc) + "</span>"
      : '<span class="cab-paid">' + esc(t("cl_paid_full")) + "</span>";
    return '<button type="button" class="cab-card" data-cab-open="' + esc(o.order_number) + '">' +
      (o.photo ? '<img class="cab-thumb" src="' + esc(c.thumbUrl(o.photo)) + '" loading="lazy" alt="">'
               : '<span class="cab-thumb cab-nophoto" aria-hidden="true"></span>') +
      '<span class="cab-main">' +
        '<span class="cab-product">' + esc(o.product_ru) + "</span>" +
        '<span class="cab-meta">№ ' + esc(o.order_number) + " · " + esc(fmtDate(o.order_date)) + "</span>" +
        '<span class="cab-status s-' + esc(o.status) + '">' + esc(t("status_" + o.status)) + "</span>" +
        '<span class="cab-meta cab-next">' + esc(ns.text) + "</span>" +
        money_line + etaLine(o) +
        (o.tracking_number ? '<span class="cab-meta">' + esc(t("trk_title")) + ": " + esc(o.tracking_number) + "</span>" : "") +
      "</span></button>";
  }

  function renderCabinetList(box) {
    var d = cab.data || {}, orders = d.orders || [];
    var live = orders.filter(function (o) { return CLOSED.indexOf(o.status) === -1; });
    var done = orders.filter(function (o) { return CLOSED.indexOf(o.status) !== -1; });
    var debt = d.debt || [];
    var unpriced = live.filter(function (o) { return !priced(o); }).length;
    box.innerHTML =
      '<section class="client-hero cab-hero"><h1>' + esc(t("cab_title")) + "</h1>" +
        (d.name ? '<p class="client-hero-date">' + esc(d.name) + "</p>" : "") +
      "</section>" +
      '<section class="client-block cab-debt ' + (debt.length ? "owe" : "clear") + '">' +
        (debt.length
          ? "<h2>" + esc(t("cab_debt")) + "</h2>" + debt.map(function (x) { return '<p class="cab-debt-sum">' + cur(x.amount, x.currency) + "</p>"; }).join("")
          : "<h2>" + esc(t("cab_no_debt")) + "</h2>") +
      "</section>" +
      (unpriced ? '<p class="muted cab-unpriced">' + esc(t("cab_unpriced_note", { n: unpriced })) + "</p>" : "") +
      walletHtml(d) +
      (orders.length ? "" : '<section class="client-block"><p class="muted">' + esc(t("cab_empty")) + "</p></section>") +
      (live.length ? '<section class="client-block"><h2>' + esc(t("cab_active")) + " · " + live.length + '</h2><div class="cab-list">' + live.map(cabCardHtml).join("") + "</div></section>" : "") +
      (done.length ? '<section class="client-block"><details class="cab-done"><summary><h2>' + esc(t("cab_done")) + " · " + done.length +
        '</h2></summary><div class="cab-list">' + done.map(cabCardHtml).join("") + "</div></details></section>" : "") +
      contactBlockHtml(d.contact, "contact" in d) +
      '<div id="fx-pub-slot"></div>';
    mountFx(d.brand);
    if (cab.lastOpened) {
      var back = box.querySelector('[data-cab-open="' + String(cab.lastOpened).replace(/"/g, "") + '"]');
      cab.lastOpened = null;
      if (back) back.focus({ preventScroll: true });
    }
  }

  // Баланс (предоплата, файл 50): сколько денег клиента лежит у байера, и выписка
  function walletHtml(d) {
    var bal = d.wallet || [], ops = d.wallet_ops || [];
    if (!bal.length && !ops.length) return "";
    function signed(n, code) { return (n > 0 ? "+" : n < 0 ? "−" : "") + cur(Math.abs(n), code); }
    return '<section class="client-block cab-wallet">' +
      "<h2>" + esc(t("cab_wallet")) + "</h2>" +
      (bal.length ? bal.map(function (x) {
        return '<p class="cab-wallet-sum ' + (num(x.amount) < 0 ? "neg" : "pos") + '">' + signed(num(x.amount), x.currency) + "</p>";
      }).join("") : '<p class="cab-wallet-sum">' + cur(0, (ops[0] && ops[0].currency) || "KGS") + "</p>") +
      '<p class="muted">' + esc(t("cab_wallet_hint")) + "</p>" +
      (ops.length ? '<details class="cab-done"><summary><h2>' + esc(t("cab_wallet_ops")) + "</h2></summary><ol class=\"wl-list\">" + ops.map(function (r) {
        var a = num(r.amount);
        var title = r.kind === "order" ? t("wl_k_order", { n: r.order_number || "—" })
          : r.kind === "return" ? t("wl_k_return", { n: r.order_number || "—" }) : t("wl_k_" + r.kind);
        return '<li class="wl-row"><div class="wl-row-main"><b>' + esc(title) + '</b><small class="muted">' + esc(fmtDate(r.created_at)) + "</small></div>" +
          '<b class="wl-amt ' + (a > 0 ? "pos" : "neg") + '">' + signed(a, r.currency) + "</b></li>";
      }).join("") + "</ol></details>" : "") +
    "</section>";
  }

  // Обмен сом → юань (если байер включил): курс, калькулятор и заявка
  function mountFx(brand) {
    if (!U.exchange) return;
    U.exchange.mountPublic($("#fx-pub-slot"), brand && brand.fx, cab.token ? "cab" : "order", cab.token || cd.token);
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
      var res;
      if (cab.token && !cab.open) {
        res = await c.db().rpc("get_client_cabinet", { p_token: cab.token });
        if (res.error) throw res.error;
        if (res.data) { cab.data = res.data; state.clientState = "ok"; renderClient(); toast(t("refreshed"), "ok"); }
        else cabLost();
      } else {
        res = cab.token
          ? await c.db().rpc("get_cabinet_order", { p_token: cab.token, p_order_number: state.client.order_number })
          : await c.db().rpc("get_client_order", { p_token: cd.token });
        if (res.error) throw res.error;
        if (res.data) { state.client = res.data; state.clientState = "ok"; renderClient(); toast(t("refreshed"), "ok"); }
        else if (cab.token) cabLost();
        else { state.clientState = "notfound"; renderClient(); }
      }
    } catch (err) {
      console.error(err);
      toast(t("cab_net_err"), "error");
    }
    btn.classList.remove("spinning");
    btn.disabled = false;
  }

  // «Повторить» после ошибки сети: загружаем ту же страницу заново
  function retryLoad() {
    state.clientState = "loading";
    renderClient();
    if (cab.token) {
      c.db().rpc("get_client_cabinet", { p_token: cab.token }).then(function (res) {
        if (res.error) throw res.error;
        cab.data = res.data || null; state.clientState = res.data ? "ok" : "notfound"; renderClient();
      }).catch(function (e) { console.error(e); state.clientState = "error"; renderClient(); });
    } else {
      c.db().rpc("get_client_order", { p_token: cd.token }).then(function (res) {
        if (res.error) throw res.error;
        state.client = res.data || null; state.clientState = res.data ? "ok" : "notfound"; renderClient();
        if (res.data) tgLoad();
      }).catch(function (e) { console.error(e); state.clientState = "error"; renderClient(); });
    }
  }

  var bound = false;
  function bindClientUI() {
    if (bound) return;
    bound = true;
    var box = $("#client-content");
    $("#client-refresh").addEventListener("click", refreshClient);

    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-cab-retry]")) { retryLoad(); return; }
      var co = e.target.closest("[data-cab-open]");
      if (co) { openCabOrder(co.getAttribute("data-cab-open")); return; }
      if (e.target.closest("[data-cab-back]")) { cab.open = false; cd.editing = false; renderClient(); window.scrollTo(0, 0); return; }
      var ph = e.target.closest("[data-photo]");
      if (ph && state.client) {
        openLightbox(clientPhotoUrls(), Number(ph.getAttribute("data-photo")) || 0);
        return;
      }
      var tb = e.target.closest("[data-tgc]");
      if (tb) {
        var act = tb.getAttribute("data-tgc");
        if (act === "open") { tgc.opened = true; tgc.error = ""; setTimeout(renderClient, 300); }   // ссылка открывает Telegram сама
        else if (act === "check") tgCall("client_connect");
        else if (act === "off" && window.confirm(t("tgc_off_confirm"))) tgCall("client_disconnect");
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
      var c = dlv(state.client) || {};
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
      var args = {
        p_token: cd.token,
        p_name: d.name.trim(),
        p_phone: cleanPhone(d.phone),
        p_telegram: cleanTelegram(d.telegram) || null,
        p_city: d.city.trim(),
        p_address: d.method === "address" ? d.place.trim() : null,
        p_pickup_point: d.method === "pickup" ? d.place.trim() : null
      };
      if (cab.token) { args.p_token = cab.token; args.p_order_number = state.client.order_number; }   // общая ссылка: отдельная серверная проверка
      var res = await c.db().rpc(cab.token ? "save_cabinet_client_info" : "save_client_info", args);
      if (res.error) throw res.error;
      if (res.data && res.data.state) {   // файл 61: предложение в этот заказ; клиент и заказ не меняются
        state.client.delivery = res.data;
        if (cab.data) (cab.data.orders || []).forEach(function (x) { if (x.order_number === state.client.order_number) x.delivery_state = res.data.state; });
      } else {
        state.client.client = res.data;
        if (cab.data) cab.data.card = true;
      }
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
      } else if (/delivery_confirmed/.test(msg)) {
        cd.editing = false; cd.draft = null;
        toast(t("dl_confirmed_err"), "error");
        cab.busy = false; await reloadOrderNow();
      } else if (/card_exists/.test(msg)) {
        cd.editing = false; cd.draft = null;
        toast(t("cab_card_exists_err"), "error");
        cab.busy = false; await reloadCabOrder();
      } else if (/order_not_found/.test(msg) && cab.token) {
        cabLost();
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

  // свежий заказ после отказа сервера (для ссылки заказа и для общей ссылки)
  async function reloadOrderNow() {
    if (cab.token) { await reloadCabOrder(); return; }
    try {
      var r = await c.db().rpc("get_client_order", { p_token: cd.token });
      if (!r.error && r.data) state.client = r.data;
    } catch (e) { console.error(e); }
  }

  async function reloadCabOrder() {
    try {
      var r = await c.db().rpc("get_cabinet_order", { p_token: cab.token, p_order_number: state.client.order_number });
      if (r.error) throw r.error;
      if (r.data) state.client = r.data; else cabLost();
    } catch (e) { console.error(e); }
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
    var c = dlv(o);
    var st = dlvState(o);
    var canEdit = !isClosed() && (dlvNew(o) ? st !== "confirmed" : !cab.token);

    // 1) Данные уже есть — показываем их
    if (c && !cd.editing) {
      return '<section class="client-block delivery-block filled" aria-labelledby="cd-title">' +
        '<div class="delivery-head"><h2 id="cd-title">' + esc(t("cd_title")) + "</h2>" +
          (canEdit ? '<button type="button" class="btn" data-cd="edit">' + esc(t("cd_edit")) + "</button>" : "") +
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
        (st === "proposed" ? '<p class="delivery-note delivery-proposed">' + esc(t("dl_proposed")) + "</p>" : "") +
        (st === "confirmed" ? '<p class="delivery-note delivery-confirmed">' + esc(t("dl_confirmed")) + "</p>" : "") +
        (cab.token && !isClosed() && !dlvNew(o) ? '<p class="delivery-note">' + esc(t("cab_addr_ro")) + "</p>" : "") +
      "</section>";
    }

    // 2) Заказ завершён, а данных нет — форму не показываем, но говорим об этом прямо
    if (isClosed()) return '<section class="client-block delivery-block"><h2 id="cd-title">' + esc(t("cd_title")) + '</h2><p class="muted">' + esc(t("cab_addr_none")) + "</p></section>";

    if (cab.token && !(cab.data && typeof cab.data.card === "boolean")) {   // сервер без файла 60: формы адреса в общей ссылке нет
      return '<section class="client-block delivery-block"><h2 id="cd-title">' + esc(t("cd_title")) + '</h2><p class="muted">' + esc(t("cab_addr_none")) + " " + esc(t("cab_addr_ro")) + "</p></section>";
    }

    // 3) Форма
    var d = getDraft();
    var isPickup = d.method === "pickup";
    return '<section class="client-block delivery-block" aria-labelledby="cd-title">' +
      '<h2 id="cd-title">' + esc(t("cd_title")) + "</h2>" +
      '<p class="delivery-intro">' + esc(t("cd_intro")) + "</p>" +
      (dlvNew(o) ? '<p class="delivery-note">' + esc(t("dl_form_note")) + "</p>" : "") +
      '<form id="cd-form" class="delivery-form" novalidate>' +
        cdField("name", t("cd_name"), { attrs: ' type="text" autocomplete="name" maxlength="120"' }) +
        '<div class="grid-2">' +
          cdField("phone", t("cd_phone"), {
            attrs: ' type="tel" inputmode="tel" autocomplete="tel" maxlength="24" placeholder="+__ ___ ___ ____"',
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
      '<a class="btn" target="_blank" rel="noopener" href="https://t.17track.net/' + lang + "#nums=" + encodeURIComponent(n) + '">' +
      esc(t("trk_where")) + "</a></div>" +
      '<p class="fine-print">' + esc(t("trk_hint")) + "</p></section>";
  }

  async function tgLoad() {
    if (tgc.loaded || !cd.token) return;
    tgc.loaded = true;
    try {
      var res = await c.db().functions.invoke("telegram-notify", { body: { action: "client_info", token: cd.token } });
      var d = (res && res.data) || {};
      tgc.bot = d.ok ? d.bot : null;
      tgc.subscribed = !!d.subscribed;
    } catch (e) { tgc.bot = null; }
    renderClient();
  }

  async function tgCall(action) {
    if (tgc.busy) return;
    tgc.busy = true; tgc.error = "";
    renderClient();
    try {
      var res = await c.db().functions.invoke("telegram-notify", { body: { action: action, token: cd.token } });
      var d = (res && res.data) || {};
      if (d.ok) { tgc.subscribed = !!d.subscribed; tgc.opened = false; toast(t(tgc.subscribed ? "tgc_done" : "tgc_off_done"), "ok"); }
      else tgc.error = d.error === "no_start" ? "tgc_e_start" : "tgc_e";
    } catch (e) { tgc.error = "tgc_e"; }
    tgc.busy = false;
    renderClient();
  }

  // Вернулись из Telegram после «Start» — проверяем сами, без лишней кнопки
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && tgc.opened && !tgc.subscribed && !tgc.busy) tgCall("client_connect");
  });

  function tgHtml(o) {
    if (!tgc.bot || CLOSED.indexOf(o.status) !== -1) return "";
    var body;
    if (tgc.subscribed) {
      body = '<p class="tgc-on">' + U.icon("check", 16) + esc(t("tgc_on")) + "</p>" +
        '<p class="fine-print">' + esc(t("tgc_scope", { n: state.client.order_number })) + "</p>" +
        '<button type="button" class="mini-link" data-tgc="off"' + (tgc.busy ? " disabled" : "") + ">" + esc(t("tgc_off")) + "</button>";
    } else {
      var link = "https://t.me/" + encodeURIComponent(tgc.bot) + "?start=o" + encodeURIComponent(cd.token);
      body = '<p class="muted">' + esc(t("tgc_text")) + "</p>" +
        '<div class="track-actions"><a class="btn btn-primary tgc-btn" target="_blank" rel="noopener" data-tgc="open" href="' + esc(link) + '">' + U.icon("send", 16) +
          esc(t("tgc_btn")) + "</a>" +
        (tgc.opened ? '<button type="button" class="btn" data-tgc="check"' + (tgc.busy ? " disabled" : "") + ">" + esc(t(tgc.busy ? "tgc_checking" : "tgc_check")) + "</button>" : "") +
        "</div>" +
        (tgc.opened ? '<p class="fine-print">' + esc(t("tgc_hint")) + "</p>" : "") +
        (tgc.error ? '<p class="im-error">' + esc(t(tgc.error)) + "</p>" : "");
    }
    return '<section class="client-block tgc-block"><h2>' + U.icon("bell", 18) + esc(t("tgc_title")) + "</h2>" + body + "</section>";
  }

  // Оплата: стоимость, оплачено, остаток — в валюте заказа, валюты не складываются. Неизвестная цена — словами, а не «0».
  function paymentHtml(o) {
    var cc = o.client_currency || "KGS", bal = num(o.balance_som);
    if (o.status === "cancelled") {
      return num(o.paid_amount) > 0 ? '<p class="muted">' + esc(t("cab_cancel_paid", { sum: cur(o.paid_amount, cc) })) + "</p>" : '<p class="muted">' + esc(t("ns_cancelled")) + "</p>";
    }
    if (!priced(o)) {
      return '<p class="muted">' + esc(t("cl_price_pending")) + "</p>" +
        (num(o.paid_amount) > 0 ? '<dl class="money"><div><dt>' + esc(t("l_paid")) + "</dt><dd>" + cur(o.paid_amount, cc) + "</dd></div></dl>" : "");
    }
    var pre = 0;
    if (cab.token && cab.data) (cab.data.wallet || []).forEach(function (w) { if (w.currency === cc && num(w.amount) > 0) pre = num(w.amount); });
    return '<dl class="money">' +
      '<div class="money-total"><dt>' + esc(t("cab_cost")) + "</dt><dd>" + cur(o.total_som, cc) + "</dd></div>" +
      "<div><dt>" + esc(t("l_paid")) + "</dt><dd>" + cur(o.paid_amount, cc) + "</dd></div>" +
      '<div class="money-balance ' + (bal > 0 ? "owe" : "clear") + '"><dt>' + esc(t("cl_left")) + "</dt><dd>" +
        (bal > 0 ? cur(bal, cc) : esc(t("cl_paid_full"))) + "</dd></div>" +
      "</dl>" +
      (pre > 0 && bal > 0 && isLive(o) ? '<p class="muted">' + esc(t("cab_pre_have", { sum: cur(pre, cc) })) + "</p>" : "");
  }

  // Доставка: этап, ожидаемый срок (только если байер его назвал)
  function etaBlockHtml(o) {
    if (o.status === "cancelled") return "";
    var e = etaText(o), TK = U.tracking;
    var stage = TK ? t("tk_s_" + TK.STAGES[TK.stageIndex(o)]) : t("status_" + o.status);
    if (!e && TK) {   // груз в пути: тот же ориентировочный срок, что в карточке маршрута (иначе «срок не назначен» противоречит ей)
      var tr = TK.transit(o);
      if (tr.eta && tr.idx >= 5 && tr.idx <= 7) e = tr.eta[0] === tr.eta[1] ? fmtDate(tr.eta[0]) : fmtDate(tr.eta[0]) + " – " + fmtDate(tr.eta[1]);
    }
    return '<section class="client-block cab-eta-block"><h2>' + esc(t("cl_delivery_info")) + "</h2>" +
      '<dl class="specs specs-2"><div><dt>' + esc(t("cl_status")) + "</dt><dd>" + esc(stage) + "</dd></div>" +
      (isLive(o) && hasEta(o) ? "<div><dt>" + esc(t("cab_eta")) + "</dt><dd>" + (e ? esc(e) : '<span class="muted">' + esc(t("cab_eta_none")) + "</span>") + "</dd></div>" : "") +
      "</dl></section>";
  }

  // Общая ссылка: показываем состояние подписки именно на ЭТОТ заказ (подключается по ссылке самого заказа)
  function cabTgHtml(o) {
    if (!isLive(o) || typeof o.tg_on !== "boolean") return "";
    return '<section class="client-block tgc-block"><h2>' + U.icon("bell", 18) + esc(t("tgc_title")) + "</h2>" +
      (o.tg_on ? '<p class="tgc-on">' + U.icon("check", 16) + esc(t("cab_tg_on", { n: o.order_number })) + "</p>"
               : '<p class="muted">' + esc(t("cab_tg_off", { n: o.order_number })) + "</p>") + "</section>";
  }

  function clientPhotoUrls() {
    return ((state.client && state.client.photos) || []).map(photoUrl);
  }

  // Логотип и название компании байера вместо «ULA Factory» (если логотип загружен)
  function applyBrand(b) {
    ["#view-client .brand", "#view-shop .brand"].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      if (el.dataset.orig === undefined) el.dataset.orig = el.innerHTML;
      var url = b && b.logo ? c.db().storage.from("logos").getPublicUrl(b.logo).data.publicUrl : "";
      el.innerHTML = url
        ? '<img class="brand-logo" src="' + esc(url) + '" alt=""><span class="brand-co">' + esc(b.name || "") + "</span>"
        : el.dataset.orig;
    });
  }

  // Приглашение для клиента, который сам торгует: ссылка помнит, с чьей страницы он пришёл
  function promoHtml() {
    var tok = String(cd.token || "").slice(0, 12);
    var href = location.pathname + (tok ? "?ref=o" + tok : "") + "#/join";
    return '<section class="client-block promo-ref"><h2>' + esc(t("ref_promo_t")) + "</h2><p>" + esc(t("ref_promo_b")) + "</p>" +
      '<a class="btn btn-primary" href="' + esc(href) + '">' + esc(t("ref_promo_btn")) + "</a></section>";
  }

  function renderClient() {
    var box = $("#client-content");
    applyBrand(cab.token && !cab.open ? (cab.data && cab.data.brand) : (state.client && state.client.brand));

    if (state.clientState === "loading") {
      box.innerHTML = '<div class="state-box">' + esc(t("loading")) + "</div>";
      return;
    }
    if (state.clientState === "error") {
      box.innerHTML = '<div class="state-box" role="alert"><p>' + esc(t("cab_net_err")) + '</p><button type="button" class="btn btn-primary" data-cab-retry>' + esc(t("cab_retry")) + "</button></div>";
      return;
    }
    if (state.clientState !== "ok") {
      box.innerHTML = '<section class="client-block notfound"><h1>' + esc(t(cab.token ? "cab_nf_title" : "cl_not_found_title")) +
        "</h1><p>" + esc(t(cab.token ? "cab_nf_text" : "cl_not_found_text")) + "</p></section>";
      return;
    }

    if (cab.token && !cab.open) { renderCabinetList(box); return; }

    var o = state.client;
    var urls = clientPhotoUrls();
    var bal = num(o.balance_som);
    var cc = o.client_currency || "KGS"; // валюта клиента
    var flow = STATUSES.filter(function (s) { return s !== "cancelled"; });
    var idx = flow.indexOf(o.status);

    var TK = U.tracking;   // путь заказа из 10 этапов (js/tracking.js); без него — прежняя шкала статусов
    var steps = TK ? TK.clientHtml(o) : o.status === "cancelled"
      ? '<p class="cancelled-note">' + esc(t("cl_cancelled")) + "</p>"
      : '<ol class="steps" aria-label="' + esc(t("cl_status")) + '">' + flow.map(function (s, i) {
          return '<li class="' + (i < idx ? "done" : i === idx ? "current" : "") + '"' +
            (i === idx ? ' aria-current="step"' : "") + '><span class="dot"></span><span>' +
            esc(t("status_" + s)) + "</span></li>";
        }).join("") + "</ol>";
    var clientHistory = TK ? "" : statusHistoryHtml(o.status_history, o);
    var dest = (dlv(o) || {}).city || "";

    // Пока данных нет — форма стоит сразу после статуса (это главное действие).
    // Когда данные есть — уходит вниз, под оплату.
    var delivery = deliveryBlockHtml();
    var deliveryFirst = !dlv(o) || cd.editing;

    // Сохраняем, где стоял курсор, чтобы смена языка не сбивала ввод
    var active = document.activeElement;
    var activeId = active && box.contains(active) && active.id && active.tagName !== "BUTTON" ? active.id : "";

    box.innerHTML =
      (cab.token ? '<button type="button" class="btn cab-back" data-cab-back>← ' + esc(t("cab_back")) + "</button>" : "") +
      '<section class="client-hero' + (TK ? " tk-hero" : "") + '">' +
        // номер заказа не переносим посередине
        "<h1>" + esc(t("cl_order", { n: "\u0000" })).replace("\u0000", '<span class="num">' + esc(o.order_number) + "</span>") + "</h1>" +
        '<p class="client-hero-date">' + fmtDate(o.order_date) + "</p>" +
        (o.status === "cancelled" || TK ? "" : '<p class="client-hero-status">' + esc(t("status_" + o.status)) + "</p>") +
        steps + clientHistory +
      "</section>" +

      (TK ? TK.routeHtml(o, dest) : "") +
      nextStepHtml(o) +
      (deliveryFirst ? delivery : "") +
      etaBlockHtml(o) +
      trackHtml(o) +
      (TK ? TK.historyHtml(o) : "") +
      (cab.token ? cabTgHtml(o) : tgHtml(o)) +

      '<section class="client-block">' +
        "<h2>" + esc(t("cl_product")) + "</h2>" +
        '<div class="card-product"><h3>' + esc(o.product_ru) + "</h3>" +
          (o.product_zh ? '<p lang="zh-CN">' + esc(o.product_zh) + "</p>" : "") + "</div>" +
        (urls.length ? '<div class="thumbs thumbs-large">' + urls.map(function (u, i) {
          return '<button type="button" class="thumb" data-photo="' + i + '"><img src="' + esc(c.thumbUrl(state.client.photos[i])) + '" loading="lazy" alt=""></button>';
        }).join("") + "</div>" : "") +
        '<dl class="specs specs-2">' +
          "<div><dt>" + t("l_qty") + "</dt><dd>" + money(o.quantity) + " " + t("pcs") + "</dd></div>" +
          "<div><dt>" + t("l_weight") + "</dt><dd>" + (num(o.weight_kg) > 0 ? money(o.weight_kg) + " " + t("kg") : "—") + "</dd></div>" +
        "</dl>" +
      "</section>" +

      '<section class="client-block">' +
        "<h2>" + esc(t("cl_payment")) + "</h2>" + paymentHtml(o) +
      "</section>" +

      (deliveryFirst ? "" : delivery) +

      (o.delivery_info ? '<section class="client-block"><h2>' + esc(t("cl_delivery_info")) + '</h2><p class="pre">' + esc(o.delivery_info) + "</p></section>" : "") +
      (o.client_comment ? '<section class="client-block"><h2>' + esc(t("cl_comment")) + '</h2><p class="pre">' + esc(o.client_comment) + "</p></section>" : "") +

      contactBlockHtml(o.contact, "contact" in o) +
      '<div id="fx-pub-slot"></div>' +

      (cab.token ? "" : promoHtml()) +

      '<p class="fine-print">' + esc(t("cl_updated")) + ": " +
        esc(new Date(o.updated_at).toLocaleDateString(locale())) + "</p>";
    mountFx(o.brand);

    if (activeId) {
      var el = document.getElementById(activeId);
      if (el) el.focus();
    }
  }

  U.client = { init: initClient, initCabinet: initCabinet, render: renderClient, applyBrand: applyBrand };
})(window.ULA);
