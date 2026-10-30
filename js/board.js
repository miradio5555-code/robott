// =====================================================
// ULA FACTORY — главная страница: новости платформы и курс ULA на сегодня.
//
// Вверху страницы «Заказы» байер видит:
//   • новости, которые опубликовал админ (за последние 30 дней). «Понятно» прячет новость у этого человека;
//   • карточку «Курс юаня» (только тем, кому обмен нужен — её рисует exchange.js).
// Админ видит те же новости с кнопкой «Удалить» и форму «Опубликовать новость»;
// новость можно сразу разослать в Telegram всем байерам, у которых подключён бот.
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

  // Ссылка для приглашения друга-байера: в ней записан кабинет того, кто пригласил
  function inviteUrl() {
    return location.origin + location.pathname + "?ref=w" + String(state.myWs.id).replace(/-/g, "") + "#/join";
  }
  function inviteHtml() {
    return '<div class="bd-card bd-invite"><span class="bd-ico" aria-hidden="true">' + U.icon("users", 18) + "</span>" +
      '<div class="bd-main"><h3>' + esc(t("ref_inv_t")) + '</h3><p class="bd-text">' + esc(t("ref_inv_b")) + "</p>" +
      '<div class="bd-actions"><button type="button" class="btn btn-sm" data-board="refcopy">' + esc(t("ref_inv_copy")) + "</button>" +
      '<a class="btn btn-sm btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t("ref_inv_wa_text", { url: inviteUrl() })) + '">' + esc(t("ref_inv_wa")) + "</a></div></div></div>";
  }

  function render() {
    var box = $("#home-board");
    if (!box) return;
    var admin = isAdmin(), mine = seen();
    var list = bd.news.filter(function (n) { return admin || mine.indexOf(n.id) === -1; });
    var html = bd.rate + list.map(function (n) {
      return '<div class="bd-card bd-news"><span class="bd-ico" aria-hidden="true">' + U.icon("bell", 18) + "</span>" +
        '<div class="bd-main"><h3>' + esc(t("board_news_title")) + " <span>" + esc(c.fmtDate(n.created_at)) + "</span></h3>" +
        '<p class="bd-text">' + esc(n.body) + "</p>" +
        (admin ? '<button type="button" class="btn btn-ghost btn-sm" data-board="del" data-id="' + n.id + '">' + esc(t("board_news_del")) + "</button>"
               : '<button type="button" class="btn btn-sm" data-board="ok" data-id="' + n.id + '">' + esc(t("board_news_ok")) + "</button>") +
        "</div></div>";
    }).join("");
    if (!admin && state.myWs && state.myWs.id && state.myRole !== "staff") html += inviteHtml();
    if (admin) {
      html += '<details class="bd-post"><summary>' + esc(t("board_news_add")) + "</summary>" +
        '<textarea id="bd-text" rows="3" maxlength="1000" placeholder="' + esc(t("board_news_ph")) + '"></textarea>' +
        '<label class="check-line"><input id="bd-tg" type="checkbox" checked> <span>' + esc(t("board_news_tg")) + "</span></label>" +
        '<button type="button" class="btn btn-primary btn-sm" data-board="post">' + esc(t("board_news_post")) + "</button></details>";
    }
    box.classList.toggle("hidden", !html);
    var keep = $("#bd-text") ? $("#bd-text").value : "", wasOpen = !!box.querySelector(".bd-post[open]");
    var rcOpen = !!box.querySelector(".rc-more[open]");
    var cny = $("#rc-cny") ? $("#rc-cny").value : "";
    box.innerHTML = html;
    if ($("#bd-text")) { $("#bd-text").value = keep; if (wasOpen) box.querySelector(".bd-post").open = true; }
    if (rcOpen && box.querySelector(".rc-more")) box.querySelector(".rc-more").open = true;
    if (cny && $("#rc-cny")) { $("#rc-cny").value = cny; U.exchange.homeCalc(); }
  }

  // Опубликовать новость (админ); tg — разослать байерам в Telegram. Возвращает true, если новость сохранена.
  async function publish(body, tg) {
    var res = await c.db().rpc("admin_post_news", { p_body: body });
    if (res.error) { toast(t("board_news_err"), "error"); return false; }
    if (tg && res.data) {
      try {
        var r = await c.db().functions.invoke("telegram-notify", { body: { action: "news_broadcast", news_id: res.data } });
        if (r.data && r.data.ok && r.data.sent) toast(t("board_news_sent_tg", { n: r.data.sent }), "ok");
      } catch (e) { /* Telegram не обязателен: новость на сайте уже есть */ }
    }
    await load();
    return true;
  }

  async function post() {
    var ta = $("#bd-text"), body = ta.value.trim();
    if (!body || bd.busy) return;
    bd.busy = true;
    var ok = await publish(body, $("#bd-tg") && $("#bd-tg").checked);
    bd.busy = false;
    if (!ok) return;
    ta.value = "";
    toast(t("board_news_posted"), "ok");
  }

  async function del(id) {
    if (!window.confirm(t("board_news_del_q"))) return;
    var res = await c.db().rpc("admin_delete_news", { p_id: id });
    if (res.error) { toast(t("board_news_err"), "error"); return; }
    await load();
  }

  function bind() {
    var box = $("#home-board");
    box.addEventListener("input", function (e) { if (e.target.id === "rc-cny") U.exchange.homeCalc(); });
    box.addEventListener("click", function (e) {
      if (U.exchange.homeClick(e)) return;   // карточка курса: график 7/30 дней, «Обменять»
      var b = e.target.closest("[data-board]");
      if (!b) return;
      var a = b.getAttribute("data-board"), id = Number(b.getAttribute("data-id"));
      if (a === "ok") { markSeen(id); render(); }
      else if (a === "post") post();
      else if (a === "del") del(id);
      else if (a === "refcopy") c.copyText(inviteUrl()).then(function (ok) { if (ok) toast(t("ref_inv_copied"), "ok"); });
    });
  }

  U.board = { bind: bind, load: load, refresh: render, publish: publish };
})(window.ULA);
