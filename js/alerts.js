// =====================================================
// ULA FACTORY — сигнал о новом: звук, вибрация, уведомление телефона, цифра в заголовке.
// ULA.alerts.ping({ title, body, tag }) — вызывают чат поддержки и заявки на обмен.
// Звук включается после первого нажатия на экран (так требуют браузеры).
// На главной — карточка «Включить уведомления»: разрешение, подписка на push и проверка звука одной кнопкой.
// =====================================================
(function (U) {
  "use strict";
  var ctx = null, last = 0, unseen = 0, base = document.title, snd = null, sndOk = false;
  var MUTE_KEY = "cc_alert_mute";
  var sub = { ok: false, busy: false, err: "", checked: false };   // подписка на push: получилось ли, ошибка, проверена ли

  function muted() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } }
  function t(k) { return typeof window.t === "function" ? window.t(k) : k; }

  // ---------- Звук ----------
  // Короткий сигнал (два тона) собираем в WAV прямо в браузере: через <audio> на iPhone звук
  // слышен и в беззвучном режиме, в отличие от Web Audio. Web Audio — запасной путь.
  function makeWav() {
    var rate = 22050, len = Math.floor(rate * 0.5), data = new Int16Array(len);
    for (var i = 0; i < len; i++) {
      var tt = i / rate, f = tt < 0.17 ? 880 : 1318, start = tt < 0.17 ? 0 : 0.17, end = tt < 0.17 ? 0.17 : 0.5;
      var env = Math.min(1, (tt - start) / 0.015) * Math.max(0, (end - tt) / (end - start));
      data[i] = Math.round(Math.sin(2 * Math.PI * f * tt) * env * 0.5 * 32767);
    }
    var buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf), p = 0;
    function s(x) { for (var j = 0; j < x.length; j++) v.setUint8(p++, x.charCodeAt(j)); }
    function u32(x) { v.setUint32(p, x, true); p += 4; }
    function u16(x) { v.setUint16(p, x, true); p += 2; }
    s("RIFF"); u32(36 + len * 2); s("WAVE"); s("fmt "); u32(16); u16(1); u16(1); u32(rate); u32(rate * 2); u16(2); u16(16);
    s("data"); u32(len * 2);
    for (var k = 0; k < len; k++) { v.setInt16(p, data[k], true); p += 2; }
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }
  function unlock() {
    try {
      if (!snd) { snd = new Audio(makeWav()); snd.preload = "auto"; }
      if (!sndOk) {
        // «разогреть» звук внутри нажатия — потом браузер разрешит играть его сам
        snd.muted = true;
        var pr = snd.play();
        if (pr && pr.then) pr.then(function () { snd.pause(); snd.currentTime = 0; snd.muted = false; sndOk = true; }).catch(function () { snd.muted = false; });
      }
    } catch (e) { /* ignore */ }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { /* без звука */ }
  }
  function tone(freq, at, len) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + len);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + len + 0.02);
  }
  function sound() {
    try {
      if (snd && sndOk) {
        snd.currentTime = 0;
        var pr = snd.play();
        if (pr && pr.catch) pr.catch(webSound);
        return;
      }
    } catch (e) { /* ниже — запасной путь */ }
    webSound();
  }
  function webSound() {
    try {
      if (!ctx || ctx.state !== "running") return;
      tone(880, 0, 0.18); tone(1318, 0.16, 0.28);   // два коротких тона вверх
    } catch (e) { /* ignore */ }
  }

  function system(o) {
    try {
      if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
      var opts = { body: o.body || "", tag: o.tag || "ula", renotify: true, icon: "img/icon-192.png", badge: "img/icon-192.png" };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(function (r) { return r.showNotification(o.title, opts); }).catch(function () { new Notification(o.title, opts); });
      } else new Notification(o.title, opts);
    } catch (e) { /* ignore */ }
  }

  function mark() {
    if (!document.hidden) return;
    unseen++;
    document.title = "(" + unseen + ") " + base;
    try { if (navigator.setAppBadge) navigator.setAppBadge(unseen); } catch (e) { /* ignore */ }
  }
  function clear() {
    unseen = 0;
    document.title = base;
    try { if (navigator.clearAppBadge) navigator.clearAppBadge(); } catch (e) { /* ignore */ }
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) clear(); });

  function ping(o) {
    o = o || {};
    var now = Date.now();
    if (now - last < 3000) return;   // одно и то же событие приходит двумя путями — сигналим один раз
    last = now;
    if (!muted()) {
      sound();
      try { if (navigator.vibrate) navigator.vibrate([140, 70, 140]); } catch (e) { /* ignore */ }
    }
    system(o);
    mark();
  }

  // ---------- push: подписка телефона (сервер шлёт, даже когда сайт закрыт) ----------
  function b64(s) {
    var p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(r.length);
    for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i);
    return a;
  }
  function canPush() { return "Notification" in window && "PushManager" in window && !!navigator.serviceWorker; }
  function iosNoApp() {
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var app = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    return ios && !app;
  }
  // вернуть Promise: true — подписка записана в базу
  function subscribe() {
    var st = U.core && U.core.state, db = U.core && U.core.db();
    if (!st || !st.me || !db || !canPush() || Notification.permission !== "granted") return Promise.resolve(false);
    // публичный ключ берём из базы; если его ещё нет — просим функцию создать пару и спрашиваем снова
    return db.rpc("push_public_key").then(function (r) {
      if (r.error) throw r.error;
      if (r.data) return r.data;
      return db.functions.invoke("push-notify", { body: { action: "init" } }).then(function () { return db.rpc("push_public_key"); })
        .then(function (r2) { if (!r2.data) throw new Error("no_key"); return r2.data; });
    }).then(function (key) {
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) {
          return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
        });
      });
    }).then(function (s) {
      var j = s.toJSON();
      return db.from("push_subs").upsert({ endpoint: j.endpoint, user_id: st.me.id, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
    }).then(function (r) {
      if (r && r.error) throw r.error;
      sub.ok = true; sub.err = ""; sub.checked = true;
      return true;
    }).catch(function (e) {
      sub.ok = false; sub.err = String((e && e.message) || e || ""); sub.checked = true;
      console.warn("push subscribe", sub.err);
      return false;
    });
  }
  // попросить сервер разослать push (после записи в базу); ошибка не мешает
  function push(body) {
    try { U.core.db().functions.invoke("push-notify", { body: body }).catch(function () {}); } catch (e) { /* ignore */ }
  }

  // ---------- Карточка на главной: включить уведомления ----------
  function cardState() {
    if (iosNoApp()) return "ios";
    if (!canPush()) return "none";
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "default") return "off";
    if (!sub.checked || sub.busy) return "wait";   // подписка ещё проверяется — ничего не показываем
    return sub.ok ? "on" : "fail";
  }
  function renderCard() {
    var box = document.getElementById("home-push");
    if (!box) return;
    var st = U.core && U.core.state;
    var s = st && st.me ? cardState() : "on";
    if (s === "on" || s === "none" || s === "wait") { box.classList.add("hidden"); box.innerHTML = ""; box.removeAttribute("data-s"); return; }
    if (box.getAttribute("data-s") === s && box.innerHTML) return;
    box.setAttribute("data-s", s);
    var btn = s === "off" || s === "fail"
      ? '<button type="button" class="btn btn-primary btn-sm" data-push-on>' + esc(t(s === "fail" ? "push_retry" : "push_on")) + "</button>" : "";
    box.innerHTML = '<div class="push-card push-' + s + '"><span class="push-ico">🔔</span><div><b>' + esc(t("push_t_" + s)) + "</b><p>" + esc(t("push_d_" + s)) + "</p>" + btn + "</div></div>";
    box.classList.remove("hidden");
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }

  // Promise → true, если уведомления включились
  function turnOn() {
    unlock();
    if (sub.busy || !canPush()) return Promise.resolve(false);
    sub.busy = true;
    var ask = Notification.permission === "default" ? Notification.requestPermission() : Promise.resolve(Notification.permission);
    return Promise.resolve(ask).then(function (p) {
      if (p !== "granted") return false;
      return subscribe();
    }).then(function (ok) {
      sub.busy = false;
      renderCard();
      if (!ok) { if (Notification.permission === "granted" && U.core) U.core.toast(t("push_fail_toast"), "error"); return false; }
      // проверка: звук сейчас и пробное уведомление
      sound();
      try { if (navigator.vibrate) navigator.vibrate([140, 70, 140]); } catch (e) { /* ignore */ }
      navigator.serviceWorker.ready.then(function (r) {
        return r.showNotification("ULA Factory", { body: t("push_test_body"), tag: "ula-test", icon: "img/icon-192.png" });
      }).catch(function () {});
      if (U.core) U.core.toast(t("push_ok_toast"), "ok");
      return true;
    });
  }
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-push-on]")) turnOn(); });

  // первое нажатие: включить звук
  ["pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });

  // после входа: если разрешение уже есть — подписаться (обновить подписку); карточку держим в актуальном виде
  var tried = false;
  setInterval(function () {
    if (document.hidden) return;
    var st = U.core && U.core.state;
    if (st && st.me && !tried) { tried = true; subscribe().then(renderCard); }
    renderCard();
  }, 3000);

  // состояние для окна разрешений и для поддержки: on | off | denied | fail | ios | none | wait
  function status() { var s = cardState(); return s === "wait" ? "on" : s; }

  U.alerts = { ping: ping, push: push, subscribe: subscribe, turnOn: turnOn, status: status,
    mute: function (on) { try { localStorage.setItem(MUTE_KEY, on ? "1" : "0"); } catch (e) { /* ignore */ } } };
})(window.ULA);
