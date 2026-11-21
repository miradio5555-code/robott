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
//   • «Остались вопросы?»: WhatsApp, Telegram и почта из config.js (CONTACT_WHATSAPP, CONTACT_TELEGRAM, CONTACT_EMAIL).
// ULA.home: showGuest() → true, если показана главная; rememberSignedIn()
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
    trackUrl: trackUrl
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})(window.ULA = window.ULA || {});
