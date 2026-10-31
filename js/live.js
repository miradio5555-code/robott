// =====================================================
// ULA FACTORY — живое обновление кабинета: новое появляется само, без кнопки «Обновить».
//
//   • База сообщает об изменениях заказов, клиентов, партий и заявок на обмен (Supabase Realtime, файл 49):
//     заявка клиента по ссылке, оплата, правка помощника или с другого телефона.
//     Несколько изменений подряд — одно обновление через секунду.
//   • Вернулись в приложение (телефон был в кармане) — обновляем, если прошло больше 30 секунд.
//   • Realtime недоступен (файл 49 не запущен, плохая сеть) — раз в минуту, пока страница открыта.
// ULA.live.watch(id кабинета) — зовёт openWorkspace; watch(null) — при выходе.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core, state = c.state;
  var ch = null, wsId = null, live = false, timer = null;
  var QUIET = 2000, BACK = 30 * 1000, POLL = 60 * 1000;

  function since() { return Date.now() - (state.loadedAt || 0); }

  function soon() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!wsId || document.hidden) return;
      if (since() < QUIET) return;   // только что загрузили сами (своё действие)
      c.refresh(true);
    }, 1000);
  }

  function watch(id) {
    if (id === wsId && ch) return;
    var db = c.db();
    if (ch && db) { try { db.removeChannel(ch); } catch (e) { /* ignore */ } }
    ch = null; live = false; wsId = id;
    if (!id || !db || !db.channel) return;
    var f = "workspace_id=eq." + id;
    ch = db.channel("ws-live-" + id);
    ["orders", "clients", "shipments", "exchange_requests"].forEach(function (tbl) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: tbl, filter: f }, soon);
    });
    ch.subscribe(function (status) {
      var was = live;
      live = status === "SUBSCRIBED";
      if (live && !was && since() > BACK) soon();   // переподключились — догнать пропущенное
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && wsId && since() > BACK) soon();
  });
  setInterval(function () {
    if (wsId && !live && !document.hidden && since() > POLL) soon();
  }, POLL);

  U.live = { watch: watch };
})(window.ULA);
