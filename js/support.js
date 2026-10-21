// =====================================================
// ULA FACTORY — техподдержка: чат байера с админом и уведомления в Telegram.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, toast = c.toast, handleError = c.handleError,
      money = c.money, numStr = c.numStr, parseNum = c.parseNum, locale = c.locale,
      curName = c.curName, fillCurrencySelect = c.fillCurrencySelect, openModal = c.openModal,
      fmtTime = c.fmtTime, state = c.state, WS_FIELDS = c.WS_FIELDS, APP_VERSION = c.APP_VERSION;

  // =====================================================
  //  💬 ТЕХПОДДЕРЖКА
  //  Байер пишет → админ видит во вкладке «Поддержка» и отвечает.
  //  Каждые 30 секунд проверяем, нет ли новых сообщений (красная цифра).
  // =====================================================
  var support = { user: null, threads: [], unread: -1, timer: null, errors: [] };

  // Запоминаем последние ошибки на странице — их увидит поддержка
  function rememberError(msg) {
    support.errors.push(new Date().toTimeString().slice(0, 8) + " " + String(msg).slice(0, 300));
    if (support.errors.length > 5) support.errors.shift();
  }
  window.addEventListener("error", function (e) { rememberError(e.message || "error"); });
  window.addEventListener("unhandledrejection", function (e) {
    rememberError((e.reason && e.reason.message) || e.reason || "promise error");
  });

  // Технические данные к сообщению: без паролей и без данных клиентов
  function supportMeta() {
    return {
      version: APP_VERSION,
      section: state.tab,
      workspace: state.ws ? state.ws.name : null,
      lang: getLang(),
      screen: window.innerWidth + "x" + window.innerHeight,
      browser: navigator.userAgent.slice(0, 300),
      errors: support.errors.slice()
    };
  }

  // userId = null — байер открывает свою переписку; иначе админ открывает переписку байера
  function openSupport(userId, info) {
    support.user = userId;
    var admin = !!userId;
    $("#support-title").textContent = admin ? (info && info.full_name) || (info && info.email) || "—" : t("support_title");
    $("#support-sub").textContent = admin
      ? [info && info.ws_name, info && info.phone, info && info.email].filter(Boolean).join(" · ")
      : t("support_hint");
    $("#support-note").textContent = admin ? "" : t("support_note");
    $("#support-log").innerHTML = '<p class="muted">' + esc(t("loading")) + "</p>";
    openModal("modal-support");
    loadSupportLog(true);
    setTimeout(function () { $("#support-text").focus(); }, 50);
  }

  async function loadSupportLog(scroll) {
    var owner = support.user || (state.me && state.me.id);
    if (!owner) return;
    var res = await c.db().from("support_messages")
      .select("id, from_admin, body, meta, created_at")
      .eq("user_id", owner)
      .order("created_at", { ascending: true })
      .limit(300);
    if (res.error) { handleError(res.error); return; }
    renderSupportLog(res.data || [], scroll);
    // прочитали — убрать красную цифру
    var mark = await c.db().rpc("support_mark_read", { p_user: support.user });
    if (!mark.error) checkSupportUnread();
  }

  function renderSupportLog(rows, scroll) {
    var admin = !!support.user;
    var log = $("#support-log");
    var nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    if (!rows.length) {
      log.innerHTML = '<p class="muted">' + esc(admin ? t("support_none") : t("support_empty")) + "</p>";
      return;
    }
    log.innerHTML = rows.map(function (m) {
      var mine = admin ? m.from_admin : !m.from_admin;
      var who = m.from_admin ? t("support_team") : (admin ? t("support_buyer") : t("support_you"));
      var tech = admin && !m.from_admin && m.meta && Object.keys(m.meta).length
        ? '<details class="support-tech"><summary>' + esc(t("support_tech")) + "</summary><pre>" +
          esc(JSON.stringify(m.meta, null, 2)) + "</pre></details>"
        : "";
      return '<div class="ai-msg ' + (mine ? "ai-me" : "ai-bot") + '"><div class="support-who">' + esc(who) + " · " +
        esc(fmtTime(m.created_at)) + "</div>" + esc(m.body) + tech + "</div>";
    }).join("");
    if (scroll || nearBottom) log.scrollTop = log.scrollHeight;
  }

  async function sendSupport() {
    var box = $("#support-text"), text = box.value.trim();
    if (!text) { box.focus(); return; }
    var btn = $("#support-send");
    btn.disabled = true;
    var res = support.user
      ? await c.db().rpc("admin_support_reply", { p_user: support.user, p_body: text })
      : await c.db().rpc("support_send", { p_body: text, p_meta: supportMeta() });
    btn.disabled = false;
    if (res.error) {
      if (/too_many_messages/.test(res.error.message || "")) toast(t("support_too_many"), "error");
      else handleError(res.error);
      return;
    }
    box.value = "";
    toast(t("support_sent"), "ok");
    // сообщить админу в Telegram (если подключено); ошибка здесь не мешает байеру
    if (!support.user) {
      try { c.db().functions.invoke("telegram-notify", { body: { action: "notify" } }).catch(function () {}); } catch (e) { /* ignore */ }
    }
    await loadSupportLog(true);
    if (support.user && state.tab === "support") loadSupportThreads();
  }

  // ---------- Telegram-уведомления (админ) ----------
  async function tgCall(action) {
    var res = await c.db().functions.invoke("telegram-notify", { body: { action: action } });
    if (res.error) return { error: "server_error" };
    return res.data || {};
  }

  async function loadTgStatus() {
    var el = $("#tg-status");
    el.className = "tg-status";
    el.textContent = t("loading");
    var r = await tgCall("status");
    if (r.ok && r.connected) {
      el.textContent = t("tg_on", { bot: r.bot ? "@" + r.bot : "", name: r.chat_name || "" });
      el.classList.add("on");
    } else if (r.ok) {
      el.textContent = t("tg_off_bot", { bot: "@" + r.bot });
    } else {
      el.textContent = t(r.error === "no_bot_token" ? "tg_no_token" : r.error === "bad_token" ? "tg_bad_token" : "tg_error");
    }
  }

  async function connectTelegram() {
    var btn = $("#tg-connect");
    btn.disabled = true;
    var r = await tgCall("connect");
    btn.disabled = false;
    if (r.ok) toast(t("tg_connected"), "ok");
    else toast(t(r.error === "no_start" ? "tg_no_start" : r.error === "no_bot_token" ? "tg_no_token" :
      r.error === "bad_token" ? "tg_bad_token" : "tg_error"), "error");
    loadTgStatus();
  }

  // Админ: список переписок
  async function loadSupportThreads() {
    if (!state.me || state.me.role !== "admin") return;
    loadTgStatus();
    var res = await c.db().rpc("admin_support_threads");
    if (res.error) { handleError(res.error); return; }
    support.threads = res.data || [];
    $("#support-threads").innerHTML = support.threads.length ? support.threads.map(function (r) {
      var last = (r.last_from_admin ? t("support_team") + ": " : "") + r.last_body;
      return '<button type="button" class="support-thread' + (r.unread > 0 ? " unread" : "") + '" data-user="' + esc(r.user_id) + '">' +
        '<span class="support-thread-top"><b>' + esc(r.full_name || r.email || "—") + "</b>" +
        (r.unread > 0 ? '<span class="badge-inline">' + esc(String(r.unread)) + "</span>" : "") +
        '<small class="muted">' + esc(fmtTime(r.last_at)) + "</small></span>" +
        '<small class="muted">' + esc([r.ws_name, r.phone].filter(Boolean).join(" · ")) + "</small>" +
        '<span class="support-thread-last">' + esc(last.length > 140 ? last.slice(0, 140) + "…" : last) + "</span></button>";
    }).join("") : '<p class="muted">' + esc(t("support_no_threads")) + "</p>";
  }

  // Красная цифра: у байера — на 💬, у админа — на вкладке «Поддержка»
  async function checkSupportUnread() {
    if (!state.me) return;
    var res = await c.db().rpc("support_unread");
    if (res.error) return;
    var n = Number(res.data) || 0;
    var admin = state.me.role === "admin";
    var badge = $(admin ? "#support-tab-badge" : "#support-badge");
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.classList.toggle("hidden", n === 0);
    if (support.unread >= 0 && n > support.unread) {
      toast(t(admin ? "support_new" : "support_reply_new"), "ok");
      if (admin && state.tab === "support") loadSupportThreads();
    }
    support.unread = n;
  }

  function startSupportPolling() {
    stopSupportPolling();
    support.unread = -1;
    checkSupportUnread();
    support.timer = setInterval(function () {
      if (document.hidden) return; // вкладка свёрнута — не тратим запросы
      checkSupportUnread();
      if ($("#modal-support").classList.contains("open")) loadSupportLog(false);
    }, 30000);
  }

  function stopSupportPolling() {
    if (support.timer) clearInterval(support.timer);
    support.timer = null;
    support.unread = -1;
    $("#support-badge").classList.add("hidden");
    $("#support-tab-badge").classList.add("hidden");
  }

  // Кнопки и поля поддержки (вызывается из app.js при входе в кабинет)
  function bind() {
  $("#support-btn").addEventListener("click", function () { openSupport(null, null); });
  $("#support-form").addEventListener("submit", function (e) { e.preventDefault(); sendSupport(); });
  $("#support-text").addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendSupport(); }
  });
  $("#tg-connect").addEventListener("click", connectTelegram);
  $("#support-threads").addEventListener("click", function (e) {
    var b = e.target.closest("[data-user]");
    if (!b) return;
    var row = (support.threads || []).filter(function (r) { return r.user_id === b.dataset.user; })[0];
    openSupport(b.dataset.user, row || null);
  });
  }

  U.support = {
    open: openSupport, loadThreads: loadSupportThreads, checkUnread: checkSupportUnread,
    startPolling: startSupportPolling, stopPolling: stopSupportPolling,
    rememberError: rememberError, bind: bind
  };
})(window.ULA);
