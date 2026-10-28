// =====================================================
// ULA FACTORY — главная страница: новости платформы и курс ULA на сегодня.
//
// Вверху страницы «Заказы» байер видит:
//   • новости, которые опубликовал админ (за последние 30 дней). «Понятно» прячет новость у этого человека;
//   • курс ULA для обмена валюты (только тем, кому обмен нужен — см. exchange.js).
// Админ видит те же новости с кнопкой «Удалить» и форму «Опубликовать новость».
// Вынесено из app.js. Общие помощники — из window.ULA.core. Подключается после exchange.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;

  var DAYS = 30;
  var bd = { news: [], rate: "", busy: false };

  function isAdmin() { return !!(state.me && state.me.role === "admin"); }
  function seenKey() { return "ula_news_seen_" + ((state.me && state.me.id) || ""); }
  function seen() { try { return JSON.parse(localStorage.getItem(seenKey()) || "[]"); } catch (e) { return []; } }
  function markSeen(id) {
    var list = seen();
    if (list.indexOf(id) === -1) list.push(id);
    try { localStorage.setItem(seenKey(), JSON.stringify(list.slice(-50))); } catch (e) { /* ignore */ }
  }

  async function load() {
    if (!state.me || !c.db()) return;
    var since = new Date(Date.now() - DAYS * 86400000).toISOString();
    var res = await c.db().from("platform_news").select("id, body, created_at").gte("created_at", since)
      .order("created_at", { ascending: false }).limit(20);
    bd.news = res.error ? [] : (res.data || []);
    try { bd.rate = await U.exchange.homeRate(); } catch (e) { bd.rate = ""; }
    render();
  }

  function render() {
    var box = $("#home-board");
    if (!box) return;
    var admin = isAdmin(), mine = seen();
    var list = bd.news.filter(function (n) { return admin || mine.indexOf(n.id) === -1; });
    var html = list.map(function (n) {
      return '<div class="bd-news"><div class="bd-head"><h3>' + U.icon("bell", 16) + esc(t("board_news_title")) + "</h3><span>" + esc(c.fmtDate(n.created_at)) + "</span></div>" +
        '<p class="bd-text">' + esc(n.body) + "</p>" +
        (admin ? '<button type="button" class="btn btn-ghost btn-sm" data-board="del" data-id="' + n.id + '">' + esc(t("board_news_del")) + "</button>"
               : '<button type="button" class="btn btn-sm" data-board="ok" data-id="' + n.id + '">' + esc(t("board_news_ok")) + "</button>") +
        "</div>";
    }).join("");
    html += bd.rate;
    if (admin) {
      html += '<details class="bd-post"><summary>' + esc(t("board_news_add")) + "</summary>" +
        '<textarea id="bd-text" rows="3" maxlength="1000" placeholder="' + esc(t("board_news_ph")) + '"></textarea>' +
        '<button type="button" class="btn btn-primary btn-sm" data-board="post">' + esc(t("board_news_post")) + "</button></details>";
    }
    box.classList.toggle("hidden", !html);
    var keep = $("#bd-text") ? $("#bd-text").value : "", wasOpen = !!box.querySelector("details[open]");
    box.innerHTML = html;
    if ($("#bd-text")) { $("#bd-text").value = keep; if (wasOpen) box.querySelector("details").open = true; }
  }

  async function post() {
    var ta = $("#bd-text"), body = ta.value.trim();
    if (!body || bd.busy) return;
    bd.busy = true;
    var res = await c.db().rpc("admin_post_news", { p_body: body });
    bd.busy = false;
    if (res.error) { toast(t("board_news_err"), "error"); return; }
    ta.value = "";
    toast(t("board_news_posted"), "ok");
    await load();
  }

  async function del(id) {
    if (!window.confirm(t("board_news_del_q"))) return;
    var res = await c.db().rpc("admin_delete_news", { p_id: id });
    if (res.error) { toast(t("board_news_err"), "error"); return; }
    await load();
  }

  function bind() {
    $("#home-board").addEventListener("click", function (e) {
      var b = e.target.closest("[data-board]");
      if (!b) return;
      var a = b.getAttribute("data-board"), id = Number(b.getAttribute("data-id"));
      if (a === "ok") { markSeen(id); render(); }
      else if (a === "post") post();
      else if (a === "del") del(id);
      else if (a === "fx") c.switchTab("exchange");
    });
  }

  U.board = { bind: bind, load: load, refresh: render };
})(window.ULA);
