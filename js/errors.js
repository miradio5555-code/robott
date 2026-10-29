// =====================================================
// ULA FACTORY — ошибки у пользователей.
//
// Если у байера или клиента на телефоне сломалась программа сайта, этот файл тихо
// сообщает об этом в базу (report_client_error, файл 38). Админ сразу получает
// сообщение в Telegram и видит список в разделе «Байеры» → «Ошибки у пользователей».
//   • Не отправляем: адреса с секретными частями (?order=…), почту и телефоны в тексте ошибки,
//     ошибки без интернета, ошибки расширений браузера и чужих сайтов.
//   • С одной страницы — не больше 5 разных ошибок.
// Подключается сразу после config.js — до app.js, чтобы поймать и ошибки при запуске.
// =====================================================
(function () {
  "use strict";
  var cfg = window.CARGO_CONFIG || {};
  var BASE = String(cfg.SUPABASE_URL || "").replace(/\/+$/, ""), KEY = cfg.SUPABASE_ANON_KEY || "";
  var VER = (/[?&]v=([0-9A-Za-z]+)/.exec((document.currentScript && document.currentScript.src) || "") || [])[1] || "";
  var sent = {}, count = 0, MAX = 5;

  // убрать из текста то, что нельзя хранить: секретные части адресов, почту, номера телефонов
  function scrub(s) {
    return String(s || "")
      .replace(/[?#][^\s)'"]*/g, "")
      .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
      .replace(/\+?\d[\d\s-]{8,}\d/g, "[num]");
  }

  function token() {
    try {
      var ref = /^https:\/\/([^.]+)\./.exec(BASE)[1];
      var s = JSON.parse(localStorage.getItem("sb-" + ref + "-auth-token") || "null");
      return (s && s.access_token) || "";
    } catch (e) { return ""; }
  }

  function skip(msg, src) {
    if (!msg || /^Script error\.?$/i.test(msg)) return true;                 // ошибка чужого скрипта — подробностей нет
    if (/ResizeObserver loop|Failed to fetch|Load failed|NetworkError|network error|AbortError|aborted/i.test(msg)) return true;  // нет интернета, закрыли страницу
    if (src && src.indexOf(location.origin) !== 0) return true;              // расширения браузера, капча Cloudflare
    return navigator.onLine === false;
  }

  function call(path, body, tok) {
    return fetch(BASE + path, {
      method: "POST",
      keepalive: true,
      headers: { apikey: KEY, Authorization: "Bearer " + (tok || KEY), "Content-Type": "application/json" },
      body: body
    }).then(function (r) {
      if (r.status === 401 && tok) return call(path, body, "");               // вход устарел — отправить как гость
      return r.ok ? r.json().catch(function () { return null; }) : null;
    }).catch(function () { return null; });
  }

  function report(msg, src, line, col, stack) {
    msg = scrub(msg).trim().slice(0, 300);
    src = String(src || "");
    if (!BASE || !KEY || skip(msg, src)) return;
    var fp = msg + "|" + src + "|" + line;
    if (sent[fp] || count >= MAX) return;
    sent[fp] = 1;
    count++;
    var route = (location.hash.split("/")[1] || "").replace(/[^a-z-]/g, "");
    var body = JSON.stringify({
      p_message: msg,
      p_source: scrub(src).slice(0, 200) || null,
      p_line: line | 0 || null,
      p_col: col | 0 || null,
      p_stack: scrub(stack).slice(0, 1500) || null,
      p_page: location.pathname + (route ? "#/" + route : ""),
      p_version: VER,
      p_browser: String(navigator.userAgent || "").slice(0, 160),
      p_lang: typeof getLang === "function" ? getLang() : ""
    });
    call("/rest/v1/rpc/report_client_error", body, token()).then(function (isNew) {
      // новая ошибка — сообщить админу в Telegram (функция сама берёт только ещё не отправленные)
      if (isNew === true) call("/functions/v1/telegram-notify", JSON.stringify({ action: "client_error" }), "");
    });
  }

  window.addEventListener("error", function (e) {
    if (!e.message) return;   // не загрузилась картинка или файл — это не ошибка программы
    report(e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    if (!(r instanceof Error)) return;   // ответы базы с ошибкой (нет прав, нет сети) сайт показывает сам
    report(r.message, "", 0, 0, r.stack);
  });

  // ---------- Админ: список ошибок в разделе «Байеры» ----------
  var list = [], ready = false;

  function browserName(ua) {
    ua = ua || "";
    var dev = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "";
    var br = /Telegram/i.test(ua) ? "Telegram" : /WhatsApp/i.test(ua) ? "WhatsApp" : /Instagram/i.test(ua) ? "Instagram" :
      /YaBrowser/.test(ua) ? "Яндекс" : /Edg\//.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome" :
      /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "";
    return [dev, br].filter(Boolean).join(" · ") || "—";
  }

  async function load() {
    var U = window.ULA, c = U && U.core;
    if (!c || !c.db() || !c.state.me || c.state.me.role !== "admin") return;
    var res = await c.db().from("client_errors")
      .select("id, message, source, line, col, stack, page, app_version, browser, hits, user_ids, anon_hits, last_seen")
      .order("last_seen", { ascending: false }).limit(100);
    ready = !res.error;   // файл 38 ещё не запущен — раздел не показываем
    list = res.data || [];
    render();
  }

  function render() {
    var U = window.ULA, c = U.core, esc = c.esc;
    var box = c.$("#errors-box");
    if (!box) return;
    box.classList.toggle("hidden", !ready);
    if (!ready) return;
    var open = box.querySelector("details") && box.querySelector("details").open;
    var head = '<summary><span class="er-title">' + U.icon("alert", 16) + esc(t("er_title")) + "</span>" +
      (list.length ? '<b class="er-count">' + list.length + "</b>" : '<span class="er-ok">' + esc(t("er_none")) + "</span>") + "</summary>";
    var rows = list.map(function (r) {
      var file = r.source ? String(r.source).split("/").pop() + (r.line ? ":" + r.line : "") : "";
      var people = (r.user_ids || []).length;
      var who = [t("er_hits", { n: r.hits }), people ? t("er_people", { n: people }) : "",
        r.anon_hits ? t("er_clients", { n: r.anon_hits }) : ""].filter(Boolean).join(" · ");
      return '<div class="er-item">' +
        '<p class="er-msg">' + esc(r.message) + "</p>" +
        '<p class="er-meta">' + esc(who) + "</p>" +
        '<p class="er-meta">' + esc([c.fmtTime(r.last_seen), browserName(r.browser), r.page, file, r.app_version ? "v" + r.app_version : ""].filter(Boolean).join(" · ")) + "</p>" +
        (r.stack ? '<details class="er-stack"><summary>' + esc(t("er_details")) + "</summary><pre>" + esc(r.stack) + "</pre></details>" : "") +
        '<button type="button" class="btn btn-sm" data-er="del" data-id="' + r.id + '">' + esc(t("er_fixed")) + "</button>" +
        "</div>";
    }).join("");
    box.innerHTML = '<details class="er-box"' + (open ? " open" : "") + ">" + head +
      (list.length ? '<p class="er-hint">' + esc(t("er_hint")) + "</p>" + rows +
        '<button type="button" class="btn btn-ghost btn-sm" data-er="all">' + esc(t("er_clear_all")) + "</button>" : "") +
      "</details>";
  }

  async function clear(id) {
    var c = window.ULA.core;
    if (id == null && !window.confirm(t("er_clear_q"))) return;
    var res = await c.db().rpc("admin_clear_errors", { p_id: id });
    if (res.error) { c.handleError(res.error); return; }
    list = id == null ? [] : list.filter(function (r) { return r.id !== id; });
    render();
  }

  function bind() {
    var box = window.ULA.core.$("#errors-box");
    if (!box) return;
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-er]");
      if (!b) return;
      clear(b.getAttribute("data-er") === "all" ? null : Number(b.getAttribute("data-id")));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.ULA) return;
    window.ULA.errors = { load: load };
    bind();
  });
})();
