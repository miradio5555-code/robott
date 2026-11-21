// =====================================================
// ULA FACTORY — главная страница для гостя (#view-home в index.html, стили — блок «ГЛАВНАЯ» в style.css).
//
//   • Кто открыл сайт без входа, сначала видит, что это и кому подходит: байеру — кабинет, клиентам — отслеживание
//     заказа, бизнесу — учёт и прибыль. Кнопки ведут в регистрацию (#/join) и вход (#/login).
//   • Сразу форма входа (без главной): адрес #/login или любой другой #/…, приглашение помощника,
//     приложение на главном экране телефона, и тот, кто уже входил на этом устройстве (ula_signed_in).
//   • «Я клиент»: человек вставляет ссылку от байера — открывается его заказ (?order=…) или кабинет (?c=…)
//     на этом же сайте. Секретная часть ссылки никуда не отправляется, чужие адреса не открываются.
//   • «Так выглядит кабинет»: вкладки с настоящими экранами (снимки — scripts/landing_shots.mjs).
//   • «Курс юаня сегодня»: курс ULA для всех без входа (функция public_fx, файл 75), калькулятор и график;
//     значок с курсом в шапке. Обновляется, когда человек возвращается на вкладку, и раз в 10 минут.
//   • «Остались вопросы?»: WhatsApp, Telegram и почта из config.js (CONTACT_WHATSAPP, CONTACT_TELEGRAM, CONTACT_EMAIL).
// ULA.home: showGuest() → true, если показана главная; rememberSignedIn(); onLang() — перерисовать курс
// =====================================================
(function (U) {
  "use strict";
  var SEEN_KEY = "ula_signed_in";

  function $(s) { return document.querySelector(s); }
  function shown(id) { var el = document.getElementById(id); return !!el && !el.classList.contains("hidden"); }

  function isApp() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
      navigator.standalone === true || !!window.Capacitor;
  }
  function signedInBefore() {
    try { return localStorage.getItem(SEEN_KEY) === "1"; } catch (e) { return false; }
  }
  // главная — только для «#», «#/» и якорей главной (#lp-…); любой другой #/… — это вход или раздел кабинета
  function isHomeHash(h) { return h === "" || h === "#" || h === "#/" || /^#lp-[a-z]+$/.test(h); }

  function loginFirst() {
    if (!isHomeHash(location.hash)) return true;
    if (U.team && U.team.pendingCode && U.team.pendingCode()) return true;
    // явно открыл главную (#/) — показываем её даже вернувшемуся
    if (location.hash === "#/") return false;
    return isApp() || signedInBefore();
  }

  function showLogin() {
    U.core.showView("login");
    if (U.passkey && U.passkey.onLoginView) U.passkey.onLoginView();
    var f = $("#login-email");
    if (f && !f.value && window.matchMedia && window.matchMedia("(pointer: fine)").matches) f.focus({ preventScroll: true });
  }
  function showHome() {
    U.core.showView("home");
    window.scrollTo(0, 0);
    loadRate(false);
  }

  // ---------- «Я клиент»: ссылка от байера → страница заказа на этом сайте ----------
  var TOKEN = /^[A-Za-z0-9-]{16,64}$/;
  function trackUrl(raw) {
    var v = String(raw || "").trim();
    if (!v) return "";
    var kind = "", tok = "";
    if (TOKEN.test(v)) { kind = "order"; tok = v; } // прислали только код
    else {
      var q = "";
      try { q = new URL(/^[a-z]+:\/\//i.test(v) ? v : "https://" + v).search; } catch (e) { return ""; }
      var p = new URLSearchParams(q);
      if (p.get("order")) { kind = "order"; tok = p.get("order"); }
      else if (p.get("c")) { kind = "c"; tok = p.get("c"); }
    }
    if (!kind || !TOKEN.test(tok)) return "";
    // всегда наш адрес: открываем только страницу заказа ULA Factory, а не сайт из вставленной ссылки
    return location.pathname.replace(/index\.html$/, "") + "?" + kind + "=" + encodeURIComponent(tok);
  }

  // ---------- вкладки «Так выглядит кабинет» ----------
  function bindTabs(view) {
    var tabs = Array.prototype.slice.call(view.querySelectorAll("[data-lp-tab]"));
    function select(btn, focus) {
      tabs.forEach(function (b) {
        var on = b === btn;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        var pane = document.getElementById(b.getAttribute("aria-controls"));
        if (pane) pane.hidden = !on;
      });
      if (focus) btn.focus();
    }
    tabs.forEach(function (b, i) {
      b.addEventListener("click", function () { select(b, false); });
      b.addEventListener("keydown", function (e) {
        var j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
        if (j === null) return;
        e.preventDefault();
        select(tabs[(j + tabs.length) % tabs.length], true);
      });
    });
  }

  // ---------- «Курс юаня сегодня»: курс ULA для всех, без входа (public_fx, файл 75) ----------
  // Только цифры курса: ступени, время, срок и история курса первой ступени. Реквизитов здесь нет.
  // Курса нет, база без файла 75 или нет сети — блок и значок в шапке просто не показываются.
  var REFRESH = 10 * 60 * 1000;
  var fx = { data: null, at: 0, busy: false, days: 7 };

  function n(v) { var x = Number(v); return isFinite(x) ? x : 0; }
  function loc() { return U.core && U.core.locale ? U.core.locale() : "ru-RU"; }
  function rateStr(r) { return n(r).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
  function moneyStr(v) { return n(v).toLocaleString(loc(), { maximumFractionDigits: 0 }); }
  function tiersOf(d) {
    return ((d && Array.isArray(d.tiers)) ? d.tiers : []).filter(function (x) { return x && n(x.rate) > 0; })
      .map(function (x) { return { from: n(x.from), rate: n(x.rate) }; }).sort(function (a, b) { return a.from - b.from; });
  }
  // ступень для суммы: самая крупная «от …», до которой сумма дотягивает; меньше минимума — null
  function tierFor(tiers, cny) {
    var r = null;
    tiers.forEach(function (x) { if (x.from <= cny) r = x; });
    return r;
  }
  function etaName(m) {
    if (m >= 1440) return t("fx_eta_d", { n: Math.round(m / 1440) });
    if (m >= 60) return t("fx_eta_h", { n: Math.round(m / 60 * 10) / 10 });
    return t("fx_eta_m", { n: m });
  }
  function sameDay(a, b) { return a.toDateString() === b.toDateString(); }

  // точки графика: курс первой ступени во времени (+ текущий курс «сейчас»)
  function points(d, days) {
    var now = Date.now(), from = now - days * 864e5, pts = [];
    (Array.isArray(d.hist) ? d.hist : []).forEach(function (h) {
      var r = n(h && h.r), at = new Date(h && h.at).getTime();
      if (!(r > 0) || !isFinite(at)) return;
      if (at < from) pts = [{ at: from, r: r }];   // курс на начало периода
      else pts.push({ at: at, r: r });
    });
    var cur = tiersOf(d)[0];
    if (cur) pts.push({ at: now, r: cur.rate });
    return { pts: pts, from: from, now: now };
  }
  // как изменился курс: прошлый курс первой ступени, отличный от нынешнего
  function prevRate(d) {
    var cur = tiersOf(d)[0], h = Array.isArray(d.hist) ? d.hist : [];
    if (!cur) return null;
    for (var i = h.length - 1; i >= 0; i--) { var r = n(h[i] && h[i].r); if (r > 0 && r !== cur.rate) return r; }
    return null;
  }

  function chartHtml(d) {
    var p = points(d, fx.days), pts = p.pts;
    var tabs = '<div class="lp-rate-days" role="group">' + [7, 30].map(function (k) {
      return '<button type="button" data-lp-days="' + k + '" aria-pressed="' + (fx.days === k) + '">' + esc(t("rc_days", { n: k })) + "</button>";
    }).join("") + "</div>";
    var moves = pts.filter(function (x, i) { return i > 0 && x.r !== pts[i - 1].r; }).length;
    if (pts.length < 2 || !moves) return tabs + '<p class="lp-rate-flat">' + esc(t("lp_rate_flat", { n: fx.days })) + "</p>";
    var rs = pts.map(function (x) { return x.r; }), lo = Math.min.apply(null, rs), hi = Math.max.apply(null, rs);
    var W = 320, H = 72, pad = 5, span = (hi - lo) || 1;
    var X = function (at) { return pad + (at - p.from) / (p.now - p.from) * (W - pad * 2); };
    var Y = function (r) { return pad + (hi - r) / span * (H - pad * 2); };
    // ступеньками: курс держится до следующего изменения
    var path = "M" + X(pts[0].at).toFixed(1) + " " + Y(pts[0].r).toFixed(1);
    for (var i = 1; i < pts.length; i++) path += " H" + X(pts[i].at).toFixed(1) + " V" + Y(pts[i].r).toFixed(1);
    var last = pts[pts.length - 1];
    return tabs +
      // точка «сейчас» — отдельным кружком поверх графика (svg растянут по ширине, круг в нём стал бы овалом)
      '<div class="lp-rate-plot" data-x="' + (X(last.at) / W * 100).toFixed(2) + '" data-y="' + (Y(last.r) / H * 100).toFixed(2) + '">' +
      '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(t("lp_rate_chart_a", { lo: rateStr(lo), hi: rateStr(hi) })) + '">' +
        '<path d="' + path + " V" + H + " H" + X(pts[0].at).toFixed(1) + ' Z" class="lp-rate-area"/>' +
        '<path d="' + path + '" class="lp-rate-line" vector-effect="non-scaling-stroke"/></svg><i class="lp-rate-dot" aria-hidden="true"></i></div>' +
      '<div class="lp-rate-range"><span>' + esc(t("rc_min", { n: rateStr(lo) })) + "</span><span>" + esc(t("rc_max", { n: rateStr(hi) })) + "</span></div>";
  }

  function drawChart() {
    var box = $("#lp-rate-chart");
    box.innerHTML = chartHtml(fx.data);
    var plot = box.querySelector(".lp-rate-plot"), dot = plot && plot.querySelector(".lp-rate-dot");
    if (dot) { dot.style.left = plot.getAttribute("data-x") + "%"; dot.style.top = plot.getAttribute("data-y") + "%"; }
  }

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]; }); }

  function renderRate() {
    var sec = $("#lp-rate"), chip = $("#lp-rate-chip"), d = fx.data, tiers = tiersOf(d);
    if (!sec) return;
    var on = tiers.length > 0;
    sec.classList.toggle("hidden", !on);
    if (chip) chip.classList.toggle("hidden", !on);
    if (!on) return;
    var main = tiers[0], upd = new Date(d.updated_at), fresh = isFinite(upd) && sameDay(upd, new Date());
    var prev = prevRate(d), dir = prev == null ? "" : main.rate < prev ? "down" : "up";

    $("#lp-rate-val").textContent = rateStr(main.rate);
    $("#lp-rate-live").classList.toggle("old", !fresh);
    $("#lp-rate-when").textContent = !isFinite(upd) ? "" : fresh
      ? t("lp_rate_today", { t: upd.toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit" }) })
      : t("lp_rate_on", { d: U.core.fmtDate(d.updated_at) });

    var mv = $("#lp-rate-move");
    mv.className = "lp-rate-move" + (dir ? " " + dir : " hidden");
    if (dir) mv.innerHTML = '<span aria-hidden="true">' + (dir === "down" ? "▼" : "▲") + "</span> " +
      esc(t(dir === "down" ? "lp_rate_down" : "lp_rate_up", { n: rateStr(Math.abs(main.rate - prev)), was: rateStr(prev) }));

    $("#lp-rate-tiers").innerHTML = tiers.length > 1 ? tiers.map(function (x) {
      return '<span class="lp-tier" data-from="' + x.from + '"><small>' + esc(t("fx_from", { n: moneyStr(x.from) })) + "</small><b>" + esc(rateStr(x.rate)) + "</b></span>";
    }).join("") : "";
    drawChart();

    var inp = $("#lp-rate-cny");
    inp.placeholder = moneyStr(Math.max(main.from, 1000));
    $("#lp-rate-eta").textContent = d.eta > 0 ? "⏱ " + t("fx_eta_usual", { n: etaName(n(d.eta)) }) : "";

    if (chip) {
      $("#lp-rate-chip-v").textContent = rateStr(main.rate);
      var di = $("#lp-rate-chip-d");
      di.textContent = dir === "down" ? "▼" : dir === "up" ? "▲" : "";
      di.className = dir;
      chip.setAttribute("aria-label", t("lp_rate_chip_a", { n: rateStr(main.rate) }));
    }
    calcRate();
  }

  function calcRate() {
    var inp = $("#lp-rate-cny"), out = $("#lp-rate-som"), at = $("#lp-rate-at");
    if (!inp || !fx.data) return;
    var tiers = tiersOf(fx.data), cny = n(String(inp.value).replace(/[\s ]/g, "").replace(",", "."));
    var tier = cny > 0 ? tierFor(tiers, cny) : null;
    Array.prototype.forEach.call(document.querySelectorAll("#lp-rate-tiers .lp-tier"), function (el) {
      el.classList.toggle("on", !!tier && Number(el.getAttribute("data-from")) === tier.from);
    });
    out.classList.remove("lp-rate-min");
    if (!(cny > 0)) { out.textContent = "—"; at.textContent = t("lp_rate_hint"); return; }
    if (!tier) {
      out.textContent = t("fx_e_min", { n: moneyStr(tiers[0].from) });
      out.classList.add("lp-rate-min");
      at.textContent = "";
      return;
    }
    out.textContent = moneyStr(Math.round(cny * tier.rate)) + " " + t("fx_som_short");
    at.textContent = t("lp_rate_at", { r: rateStr(tier.rate) }) + (tiers.length > 1 ? " · " + t("fx_from", { n: moneyStr(tier.from) }) : "");
  }

  async function loadRate(force) {
    var db = U.core && U.core.db && U.core.db();
    if (!db || fx.busy || (!force && fx.data && Date.now() - fx.at < REFRESH)) return;
    fx.busy = true;
    try {
      var res = await db.rpc("public_fx");
      if (!res.error) { fx.data = res.data && typeof res.data === "object" ? res.data : null; fx.at = Date.now(); }
    } catch (e) { /* нет сети — оставляем прежний курс */ }
    fx.busy = false;
    renderRate();
  }

  function bindRate() {
    var form = $("#lp-rate-form"), inp = $("#lp-rate-cny"), sec = $("#lp-rate");
    if (!form) return;
    form.addEventListener("submit", function (e) { e.preventDefault(); inp.blur(); });
    inp.addEventListener("input", function () {
      var v = inp.value.replace(/[^\d.,\s ]/g, "");
      if (v !== inp.value) inp.value = v;
      calcRate();
    });
    sec.addEventListener("click", function (e) {
      var b = e.target.closest("[data-lp-days]");
      if (!b || !fx.data) return;
      fx.days = Number(b.getAttribute("data-lp-days"));
      drawChart();
    });
    // вкладку держат открытой — свежий курс, когда к ней вернулись, и раз в 10 минут
    document.addEventListener("visibilitychange", function () { if (!document.hidden && shown("view-home")) loadRate(false); });
    setInterval(function () { if (!document.hidden && shown("view-home")) loadRate(true); }, REFRESH);
  }

  // ---------- связь с ULA Factory (config.js) ----------
  function bindContacts() {
    var c = window.CARGO_CONFIG || {};
    var wa = String(c.CONTACT_WHATSAPP || "").replace(/\D/g, "");
    var tg = String(c.CONTACT_TELEGRAM || "").replace(/^@/, "").trim();
    var mail = String(c.CONTACT_EMAIL || "").trim();
    var a;
    if (wa.length >= 8 && (a = $("#lp-c-wa"))) { a.href = "https://wa.me/" + wa; a.classList.remove("hidden"); }
    if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(tg) && (a = $("#lp-c-tg"))) { a.href = "https://t.me/" + tg; a.classList.remove("hidden"); }
    if (/^[^\s@"<>]+@[^\s@"<>]+\.[a-z]{2,}$/i.test(mail) && (a = $("#lp-c-mail"))) a.href = "mailto:" + mail;
  }

  function bind() {
    var view = document.getElementById("view-home");
    if (!view) return;
    bindTabs(view);
    bindContacts();
    bindRate();

    // плавный переход к разделам главной (без смены адреса: #… занят входом и кабинетом)
    view.addEventListener("click", function (e) {
      var go = e.target.closest("[data-lp-go]");
      var top = e.target.closest("[data-lp-top]");
      if (!go && !top) return;
      e.preventDefault();
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (top) { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); return; }
      var target = document.getElementById(go.getAttribute("data-lp-go"));
      if (!target) return;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (go.getAttribute("data-lp-go") === "lp-track") {
        var inp = $("#lp-track-input");
        if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, reduce ? 0 : 450);
      }
    });

    var form = $("#lp-track-form"), input = $("#lp-track-input"), err = $("#lp-track-error");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var url = trackUrl(input.value);
        err.classList.toggle("hidden", !!url || !input.value.trim());
        input.setAttribute("aria-invalid", url || !input.value.trim() ? "false" : "true");
        if (url) location.href = url;
        else input.focus();
      });
      input.addEventListener("input", function () {
        err.classList.add("hidden");
        input.removeAttribute("aria-invalid");
      });
    }

    // тень у шапки, когда страница прокручена
    var nav = view.querySelector(".lp-nav");
    window.addEventListener("scroll", function () {
      if (nav && shown("view-home")) nav.classList.toggle("lp-nav-scrolled", window.scrollY > 8);
    }, { passive: true });

    // главная ↔ вход без перезагрузки — только пока человек не вошёл (виден один из этих экранов)
    window.addEventListener("hashchange", function () {
      if (!shown("view-home") && !shown("view-login")) return;
      var h = location.hash;
      if (h === "#/login" && !shown("view-login")) showLogin();
      else if ((h === "#/" || h === "") && shown("view-login")) showHome();
    });
  }

  U.home = {
    showGuest: function () {
      if (!document.getElementById("view-home") || loginFirst()) return false;
      showHome();
      return true;
    },
    rememberSignedIn: function () {
      try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) { /* ignore */ }
    },
    trackUrl: trackUrl,
    onLang: function () { if (fx.data) renderRate(); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})(window.ULA = window.ULA || {});
