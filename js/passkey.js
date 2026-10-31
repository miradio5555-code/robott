// =====================================================
// ULA FACTORY — Face ID / Touch ID / отпечаток: вход без пароля и блокировка приложения.
//
// Ключ доступа (passkey) встроен в Supabase Auth: ключ хранится в телефоне, сервер проверяет подпись.
//   • Настройки → «Вход и блокировка» (как в iOS): переключатель «Вход по Face ID» создаёт ключ на этом устройстве.
//   • Блокировка: вышли из ULA и вернулись (или открыли заново) — сессия остаётся, ULA сама просит Face ID,
//     как банковские приложения. «Войти с паролем» — запасной путь.
//   • Нажали «Выйти» — на экране входа Face ID предлагается сам.
// Включается один раз в Supabase: Authentication → Passkeys. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;
  var KEY = "ula_passkey", KEY_ID = "ula_passkey_id", KEY_LOCK = "ula_lock", KEY_AFTER = "ula_lock_after", KEY_AWAY = "ula_away_at";
  var AFTERS = [0, 60, 300, 900];
  var MIN_AWAY = 10 * 1000;   // «Сразу» — но не на секундный выход (выбор фото, звонок)
  var st = { list: [], off: false, busy: false, locked: false, asking: false, autoTried: false };

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, String(v)); } catch (e) { /* ignore */ } }

  // в приложении iPhone Face ID для сайта заработает после настройки домена (associated domains) — пока скрыт
  function app() { return /ULAFactoryApp/.test(navigator.userAgent || ""); }
  function supported() { return !app() && !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get); }
  function has() { return get(KEY) === "1"; }
  function mark(on, id) { put(KEY, on ? "1" : null); if (!on) put(KEY_ID, null); else if (id) put(KEY_ID, id); }
  function lockOn() { return has() && get(KEY_LOCK) !== "0"; }
  function after() { var v = Number(get(KEY_AFTER)); return AFTERS.indexOf(v) !== -1 ? v : 0; }
  function hasSession() {
    try { for (var i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i))) return true; } catch (e) { /* ignore */ }
    return false;
  }

  // как называется биометрия на этом устройстве
  function kind() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Macintosh/.test(ua)) return "apple";
    if (/Android/.test(ua)) return "android";
    if (/Windows/.test(ua)) return "windows";
    return "other";
  }
  // значок Face ID (как в iOS): уголки рамки, глаза, нос, улыбка
  function glyph(size) {
    return '<svg class="fid" viewBox="0 0 48 48" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 15V10a6 6 0 0 1 6-6h5M33 4h5a6 6 0 0 1 6 6v5M44 33v5a6 6 0 0 1-6 6h-5M15 44h-5a6 6 0 0 1-6-6v-5"/>' +
      '<path d="M16 17v4M32 17v4M24 17v10h-2.5M17 33c4 3.5 10 3.5 14 0"/></svg>';
  }

  function isOff(e) { return !!e && (e.code === "passkey_disabled" || /passkey_disabled|passkeys are disabled/i.test(String(e.message || e.msg || ""))); }
  function isCancel(e) { return !!e && /NotAllowed|AbortError|cancel|ceremony failed|timed out/i.test(String((e.name || "") + " " + (e.message || ""))); }

  // ---------- Экран входа ----------
  function renderLogin() {
    var b = $("#pk-login");
    if (!b) return;
    b.classList.toggle("hidden", !supported() || !has());
    $("#pk-login-text").textContent = t("pk_login_" + kind());
    lockTexts();
  }
  function loginError(msg) {
    var el = $("#login-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }
  // auto — сам при показе экрана входа: кнопка остаётся живой; нажатие отменяет этот запрос и спрашивает заново
  async function login(auto) {
    if (st.busy && !(st.ctrl && st.ctrl.auto && !auto)) return;
    if (st.ctrl) { try { st.ctrl.abort(); } catch (e) { /* ignore */ } }
    var ctrl = new AbortController();
    ctrl.auto = !!auto;
    st.ctrl = ctrl;
    st.busy = true;
    var b = $("#pk-login");
    if (!auto) b.disabled = true;
    loginError("");
    try {
      var r = await c.db().auth.signInWithPasskey({ options: { signal: ctrl.signal } });
      if (st.ctrl !== ctrl) return;   // заменён нажатием на кнопку

      if (r.error) {
        if (isOff(r.error)) { mark(false); renderLogin(); if (!auto) loginError(t("pk_err_off")); }
        else if (!isCancel(r.error) && !auto) loginError(t("pk_err_login"));
        return;
      }
      put(KEY_AWAY, null);
      var u = (await c.db().auth.getUser()).data.user;
      if (u) await c.enterAdmin(u);
    } catch (e) {
      if (st.ctrl === ctrl && !isCancel(e) && !auto) { console.error(e); loginError(t("pk_err_login")); }
    } finally {
      if (st.ctrl === ctrl) { st.busy = false; st.ctrl = null; b.disabled = false; }
    }
  }
  // показали экран входа (нажали «Выйти» или сессии нет) — сразу предложить Face ID
  function onLoginView() {
    renderLogin();
    if (!supported() || !has() || st.autoTried) return;
    st.autoTried = true;
    setTimeout(function () { st.autoTried = false; }, 3000);
    setTimeout(function () { if (!$("#pk-login").classList.contains("hidden")) login(true); }, 350);
  }

  // ---------- Блокировка ----------
  function ensureLock() {
    var el = $("#pk-lock");
    if (el) return el;
    el = document.createElement("div");
    el.id = "pk-lock";
    el.className = "pk-lock";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="pk-lock-in">' +
      '<img class="pk-lock-icon" src="img/icon-192.png" alt="" width="76" height="76">' +
      '<h2 class="pk-lock-title">ULA Factory</h2><p class="pk-lock-sub" id="pk-lock-sub"></p>' +
      '<button type="button" class="pk-lock-btn" id="pk-lock-btn">' + glyph(54) + '<span id="pk-lock-use"></span></button>' +
      '</div><button type="button" class="pk-lock-alt" id="pk-lock-alt"></button>';
    document.body.appendChild(el);
    $("#pk-lock-btn").addEventListener("click", unlock);
    $("#pk-lock-alt").addEventListener("click", withPassword);
    return el;
  }
  function lock() {
    if (st.locked || !supported() || !lockOn()) return;
    st.locked = true;
    var el = ensureLock();
    lockTexts();
    el.classList.add("on");
    document.documentElement.classList.add("pk-locked");
    setTimeout(unlock, 400);   // спросить сразу; если телефон требует нажатия — кнопка «Использовать Face ID»
  }
  // словарь языка может ещё грузиться — тогда подписи появятся при renderLogin (после загрузки и смены языка)
  function lockTexts() {
    if (!$("#pk-lock")) return;
    function tx(k) { var v = t(k); return v === k ? "" : v; }
    $("#pk-lock-sub").textContent = tx("pk_locked");
    $("#pk-lock-use").textContent = tx("pk_use_" + kind());
    $("#pk-lock-alt").textContent = tx("pk_with_password");
  }
  function hideLock() {
    st.locked = false;
    put(KEY_AWAY, null);
    var el = $("#pk-lock");
    if (el) el.classList.remove("on");
    document.documentElement.classList.remove("pk-locked", "pk-cover");
  }
  // проверка лица/отпечатка самим телефоном: ключ этого сайта подписывает случайную строку только после Face ID
  async function unlock() {
    if (st.asking || !st.locked) return;
    st.asking = true;
    var btn = $("#pk-lock-btn");
    btn.classList.add("busy");
    try {
      var ch = new Uint8Array(32);
      crypto.getRandomValues(ch);
      var cred = await navigator.credentials.get({ publicKey: { challenge: ch, rpId: location.hostname, userVerification: "required", timeout: 60000 } });
      if (cred) hideLock();
    } catch (e) {
      if (!isCancel(e)) console.warn("unlock", e);
    } finally {
      st.asking = false;
      btn.classList.remove("busy");
    }
  }
  async function withPassword() {
    try { await c.db().auth.signOut(); } catch (e) { /* ignore */ }
    hideLock();
    location.reload();
  }

  // ушли из ULA — спрятать содержимое (в переключателе приложений не видно данных), запомнить время
  document.addEventListener("visibilitychange", function () {
    if (!supported() || !lockOn() || !hasSession()) return;
    if (document.hidden) {
      put(KEY_AWAY, Date.now());
      if (!st.locked) document.documentElement.classList.add("pk-cover");
    } else {
      var away = Date.now() - Number(get(KEY_AWAY) || Date.now());
      document.documentElement.classList.remove("pk-cover");
      if (!st.locked && away >= Math.max(MIN_AWAY, after() * 1000)) lock();
      else if (!st.locked) put(KEY_AWAY, null);
    }
  });
  window.addEventListener("pagehide", function () { if (lockOn() && hasSession()) put(KEY_AWAY, Date.now()); });

  // открыли ULA заново (приложение было закрыто) — сессия есть, значит сначала Face ID
  function lockOnStart() {
    if (!supported() || !lockOn() || !hasSession()) return;
    var at = Number(get(KEY_AWAY) || 0);
    if (!at || Date.now() - at >= Math.max(MIN_AWAY, after() * 1000)) lock();
  }

  // ---------- Настройки (как в iOS: группа строк с переключателями) ----------
  function setError(msg) {
    var el = $("#pk-error");
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  }
  function thisId() {
    var id = get(KEY_ID);
    if (id) return id;
    var name = U.device && U.device.name ? U.device.name() : "";
    var p = st.list.filter(function (x) { return (x.friendly_name || x.name) === name; })[0];
    return p ? p.id : "";
  }
  function render() {
    $("#pk-head").textContent = t("pk_sec");
    var box = $("#pk-box"), k = kind();
    if (!supported() || st.off) {
      var why = !supported() ? (app() ? "pk_app" : "pk_unsupported") : (state.me && state.me.role === "admin" ? "pk_off_admin" : "pk_off");
      box.innerHTML = '<div class="ios-group"><div class="ios-row"><span class="ios-tile">' + glyph(19) + '</span><span class="ios-label">' + esc(t("pk_row_" + k)) +
        '</span></div></div><p class="ios-foot">' + esc(t(why)) + "</p>";
      return;
    }
    var on = has(), mine = thisId();
    var h = '<div class="ios-group">' +
      '<label class="ios-row"><span class="ios-tile">' + glyph(19) + '</span><span class="ios-label">' + esc(t("pk_row_" + k)) + "</span>" +
        '<input type="checkbox" class="ios-switch" id="pk-on"' + (on ? " checked" : "") + "></label>";
    if (on) {
      h += '<label class="ios-row"><span class="ios-tile ios-tile-gray">' + lockGlyph() + '</span><span class="ios-label">' + esc(t("pk_lock_row")) + "</span>" +
          '<input type="checkbox" class="ios-switch" id="pk-lock-on"' + (lockOn() ? " checked" : "") + "></label>";
      if (lockOn()) {
        h += '<label class="ios-row ios-row-sub"><span class="ios-label">' + esc(t("pk_lock_after")) + '</span><span class="ios-value"><select id="pk-after">' +
          AFTERS.map(function (s) { return '<option value="' + s + '"' + (s === after() ? " selected" : "") + ">" + esc(t("pk_after_" + s)) + "</option>"; }).join("") +
          "</select></span></label>";
      }
    }
    h += "</div>";
    h += '<p class="ios-foot">' + esc(t(on ? "pk_foot_on_" + k : "pk_foot_off")) + "</p>";
    var others = st.list.filter(function (p) { return p.id !== mine || !on; });
    if (others.length) {
      h += '<h4 class="ios-head">' + esc(t("pk_other")) + '</h4><div class="ios-group">' + others.map(function (p) {
        var when = p.last_used_at ? t("pk_used", { d: c.fmtTime(p.last_used_at) }) : p.created_at ? t("pk_created", { d: c.fmtDate(p.created_at) }) : "";
        return '<div class="ios-row"><span class="ios-label ios-two"><span>' + esc(p.friendly_name || p.name || t("pk_noname")) + "</span><small>" + esc(when) + "</small></span>" +
          '<button type="button" class="ios-del" data-pk-del="' + esc(p.id) + '">' + esc(t("pk_delete")) + "</button></div>";
      }).join("") + "</div>";
    }
    box.innerHTML = h;
  }
  function lockGlyph() {
    return '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>';
  }
  async function refresh() {
    setError("");
    if (!supported()) { render(); return; }
    try {
      var r = await c.db().auth.passkey.list();
      st.off = isOff(r.error);
      st.list = r.error ? [] : (Array.isArray(r.data) ? r.data : (r.data && (r.data.passkeys || r.data.items)) || []);
      if (r.error && !st.off) setError(t("error_generic"));
      // ключ этого устройства удалили (здесь или с другого телефона) — выключить
      if (!r.error && has() && get(KEY_ID) && !st.list.some(function (p) { return p.id === get(KEY_ID); })) mark(false);
    } catch (e) { st.off = isOff(e); st.list = []; }
    render();
  }
  async function add() {
    if (st.busy) return false;
    st.busy = true;
    setError("");
    try {
      var r = await c.db().auth.registerPasskey();
      if (r.error) {
        if (isOff(r.error)) { st.off = true; render(); }
        else if (/exist|already|excluded|InvalidState/i.test(String((r.error.name || "") + (r.error.message || "")))) { mark(true); toast(t("pk_err_exists"), "ok"); }
        else if (!isCancel(r.error)) setError(t("pk_err_add"));
        return has();
      }
      // имя ключа — устройство, на котором он создан: «iPhone · iOS 18 · Safari»
      var id = r.data && (r.data.id || (r.data.passkey && r.data.passkey.id));
      mark(true, id);
      put(KEY_LOCK, "1");
      var name = U.device && U.device.name ? U.device.name() : "";
      if (id && name) { try { await c.db().auth.passkey.update({ passkeyId: id, friendlyName: name.slice(0, 60) }); } catch (e) { /* без имени */ } }
      toast(t("pk_added"), "ok");
      return true;
    } catch (e) {
      if (!isCancel(e)) { console.error(e); setError(t("pk_err_add")); }
      return false;
    } finally {
      st.busy = false;
    }
  }
  async function del(id, ask) {
    if (ask && !confirm(t("pk_delete_confirm"))) return;
    var r = await c.db().auth.passkey.delete({ passkeyId: id });
    if (r.error) { setError(t("error_generic")); return; }
    if (id === get(KEY_ID)) mark(false);
    toast(t("pk_deleted"), "ok");
  }

  function bind() {
    $("#pk-login").addEventListener("click", function () { login(false); });
    $("#pk-box").addEventListener("change", async function (e) {
      var id = e.target.id;
      if (id === "pk-on") {
        e.target.disabled = true;
        if (e.target.checked) await add();
        else { var mine = thisId(); if (mine) await del(mine, false); mark(false); }
        await refresh();
      } else if (id === "pk-lock-on") { put(KEY_LOCK, e.target.checked ? "1" : "0"); render(); }
      else if (id === "pk-after") put(KEY_AFTER, e.target.value);
    });
    $("#pk-box").addEventListener("click", async function (e) {
      var b = e.target.closest("[data-pk-del]");
      if (b) { await del(b.getAttribute("data-pk-del"), true); await refresh(); }
    });
    renderLogin();
  }

  lockOnStart();   // до того, как кабинет нарисуется
  U.passkey = { bind: bind, refresh: refresh, renderLogin: renderLogin, onLoginView: onLoginView, lock: lock, glyph: glyph };
})(window.ULA);
