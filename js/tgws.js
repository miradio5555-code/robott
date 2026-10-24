// =====================================================
// ULA FACTORY — Telegram-уведомления байеру о новых заявках клиентов.
//
// В Настройках (у владельца) кнопка «Подключить Telegram»: байер открывает ссылку на бота,
// нажимает Start, возвращается и жмёт «Проверить» — после этого новые заявки приходят в Telegram.
// Саму отправку делает функция telegram-notify, а код подключения одноразовый и живёт 30 минут (migration_20_tg_ws.sql).
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, toast = c.toast, state = c.state;
  var st = { connected: false, name: "", code: "", bot: "" };

  function render() {
    $("#tgw-state").textContent = st.connected ? t("tgw_on", { n: st.name || "Telegram" }) : t("tgw_off");
    var pending = !!st.code && !st.connected;
    $("#tgw-start").classList.toggle("hidden", st.connected || pending);
    $("#tgw-open").classList.toggle("hidden", !pending);
    $("#tgw-check").classList.toggle("hidden", !pending);
    $("#tgw-off").classList.toggle("hidden", !st.connected);
    if (pending) $("#tgw-open").href = "https://t.me/" + st.bot + "?start=w" + st.code;
  }

  async function refresh() {
    if (!state.ws) return;
    var res = await c.db().rpc("tg_status", { p_ws: state.ws.id });
    if (res.error) { $("#tgw-state").textContent = t("tgw_unavailable"); return; }
    st.connected = !!(res.data && res.data.connected);
    st.name = (res.data && res.data.name) || "";
    if (st.connected) st.code = "";
    render();
  }

  async function start() {
    var btn = $("#tgw-start");
    btn.disabled = true;
    try {
      var bot = await c.db().functions.invoke("telegram-notify", { body: { action: "bot" } });
      var name = bot.data && bot.data.bot;
      if (bot.error || !name) { toast(t("tgw_no_bot"), "error"); return; }
      var res = await c.db().rpc("tg_connect_start", { p_ws: state.ws.id });
      if (res.error) { c.handleError(res.error); return; }
      st.bot = name; st.code = res.data;
      render();
    } finally {
      btn.disabled = false;
    }
  }

  async function check() {
    var btn = $("#tgw-check");
    btn.disabled = true;
    try {
      var res = await c.db().functions.invoke("telegram-notify", { body: { action: "connect_ws", ws_id: state.ws.id } });
      var d = res.data || {};
      if (d.ok) { toast(t("tgw_done"), "ok"); st.code = ""; await refresh(); return; }
      if (d.error === "no_start") toast(t("tgw_no_start"), "error");
      else if (d.error === "code_expired") { st.code = ""; render(); toast(t("tgw_expired"), "error"); }
      else toast(t("error_generic"), "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function off() {
    if (!window.confirm(t("tgw_confirm_off"))) return;
    var res = await c.db().rpc("tg_disconnect", { p_ws: state.ws.id });
    if (res.error) { c.handleError(res.error); return; }
    st.connected = false; st.code = "";
    toast(t("tgw_off_done"), "ok");
    render();
  }

  function bind() {
    $("#tgw-start").addEventListener("click", start);
    $("#tgw-check").addEventListener("click", check);
    $("#tgw-off").addEventListener("click", off);
  }

  U.tgws = { bind: bind, refresh: refresh };
})(window.ULA);
