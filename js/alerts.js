// =====================================================
// ULA FACTORY — сигнал о новом: звук, вибрация, уведомление телефона, цифра в заголовке.
// ULA.alerts.ping({ title, body, tag }) — вызывают чат поддержки и заявки на обмен.
// Звук включается после первого нажатия на экран (так требуют браузеры).
// Уведомление телефона показывается, когда сайт свёрнут; разрешение просим один раз после входа.
// =====================================================
(function (U) {
  "use strict";
  var ctx = null, last = 0, unseen = 0, base = document.title, asked = false;
  var MUTE_KEY = "cc_alert_mute", ASK_KEY = "cc_alert_asked";

  function muted() { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; } }

  function unlock() {
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

  // первое нажатие: включить звук и один раз спросить разрешение на уведомления
  function onTap() {
    unlock();
    if (asked) return;
    asked = true;
    try {
      if (!("Notification" in window) || Notification.permission !== "default") return;
      if (localStorage.getItem(ASK_KEY) === "1") return;
      if (!U.core || !U.core.state || !U.core.state.me) { asked = false; return; }   // только после входа
      localStorage.setItem(ASK_KEY, "1");
      Notification.requestPermission();
    } catch (e) { /* ignore */ }
  }
  ["pointerdown", "keydown"].forEach(function (ev) { document.addEventListener(ev, onTap, { passive: true }); });

  U.alerts = { ping: ping, mute: function (on) { try { localStorage.setItem(MUTE_KEY, on ? "1" : "0"); } catch (e) { /* ignore */ } } };
})(window.ULA);
