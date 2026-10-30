// =====================================================
// ULA FACTORY — обучение для нового байера: пошаговый тур по кабинету.
//
// Затемняет экран, подсвечивает нужный элемент и коротко объясняет, что это и зачем.
// Запускается сам один раз при первом входе байера. Повторить можно в любой момент:
// меню → «Обучение». Шаги, которых у человека нет (например, у помощника нет «Ссылки для заявок»), пропускаются.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state;

  // Шаги: sel — что подсвечивать (список запасных вариантов через запятую в порядке важности),
  // menu — для показа нужно открыть меню разделов, tab — вкладка, на которой стоит элемент.
  var STEPS = [
    { id: "welcome" },
    { id: "menu", sel: ["#section-menu-btn"] },
    { id: "new", sel: ["#home-new", "#bn-plus"], tab: "home" },
    { id: "link", sel: ["#home-link"], tab: "home" },
    { id: "wh", sel: ["#tab-home .warehouse"], tab: "home" },
    { id: "chips", sel: ["#chips"], tab: "orders" },
    { id: "card", sel: ["#orders .card"], tab: "orders" },
    { id: "bulk", sel: ["#bulk-btn"], tab: "orders" },
    { id: "menu2", sel: ["#section-menu .section-menu-list"], menu: true },
    { id: "fx", sel: ["#section-menu [data-tab=\"exchange\"]"], menu: true },
    { id: "settings", sel: ["#settings-btn"], menu: true },
    { id: "support", sel: ["#support-btn"] },
    { id: "done" }
  ];

  var tr = { list: [], i: 0, on: false, resizeBound: false };

  function userKey() { return "ula_tour_done_" + ((state.me && state.me.id) || ""); }
  function isDone() { try { return localStorage.getItem(userKey()) === "1"; } catch (e) { return true; } }
  function markDone() { try { localStorage.setItem(userKey(), "1"); } catch (e) { /* ignore */ } }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function setMenu(open) {
    var menu = $("#section-menu"), btn = $("#section-menu-btn");
    if (!menu || !btn) return;
    menu.classList.toggle("hidden", !open);
    btn.setAttribute("aria-expanded", String(open));
  }

  // Какие шаги подходят именно этому человеку: без пустых и скрытых элементов
  function buildList() {
    setMenu(false);
    var list = [];
    STEPS.forEach(function (s) {
      if (!s.sel) { list.push(s); return; }
      if (s.tab && state.tab !== s.tab) c.switchTab(s.tab);
      if (s.menu) setMenu(true);
      var el = null;
      for (var k = 0; k < s.sel.length && !el; k++) {
        var cand = document.querySelector(s.sel[k]);
        if (visible(cand)) el = cand;
      }
      if (s.menu) setMenu(false);
      if (el) list.push(s);
    });
    return list;
  }

  function targetOf(s) {
    for (var k = 0; k < s.sel.length; k++) {
      var el = document.querySelector(s.sel[k]);
      if (visible(el)) return el;
    }
    return null;
  }

  function ensureDom() {
    if ($("#tour")) return;
    var d = document.createElement("div");
    d.id = "tour";
    d.className = "tour hidden";
    d.innerHTML = '<div class="tour-shield"></div><div class="tour-hole"></div>' +
      '<div class="tour-card" role="dialog" aria-live="polite">' +
        '<div class="tour-step"></div><h3 class="tour-title"></h3><p class="tour-text"></p>' +
        '<div class="tour-actions"><button type="button" class="btn btn-ghost btn-sm" data-tour="skip"></button>' +
        '<span class="tour-spacer"></span><button type="button" class="btn btn-sm" data-tour="back"></button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-tour="next"></button></div></div>';
    document.body.appendChild(d);
    d.addEventListener("click", function (e) {
      e.stopPropagation();   // чтобы щелчок не закрыл меню разделов, пока тур его показывает
      var b = e.target.closest("[data-tour]");
      if (!b) return;
      var a = b.getAttribute("data-tour");
      if (a === "next") go(tr.i + 1);
      else if (a === "back") go(tr.i - 1);
      else finish();
    });
    document.addEventListener("keydown", function (e) {
      if (!tr.on) return;
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") go(tr.i + 1);
      else if (e.key === "ArrowLeft") go(tr.i - 1);
    });
    window.addEventListener("resize", function () { if (tr.on) place(); });
  }

  function go(i) {
    if (i < 0) return;
    if (i >= tr.list.length) { finish(); return; }
    tr.i = i;
    var s = tr.list[i];
    if (s.tab && state.tab !== s.tab) c.switchTab(s.tab);
    setMenu(!!s.menu);
    var el = s.sel ? targetOf(s) : null;
    if (el && !s.menu) el.scrollIntoView({ block: "center", behavior: "auto" });
    render();
    // дать странице дорисоваться (меню, прокрутка), потом расставить подсветку
    setTimeout(place, 60);
  }

  function render() {
    var s = tr.list[tr.i], last = tr.i === tr.list.length - 1;
    var root = $("#tour");
    root.querySelector(".tour-step").textContent = t("tour_step", { a: tr.i + 1, b: tr.list.length });
    root.querySelector(".tour-title").textContent = t("tour_" + s.id + "_t");
    root.querySelector(".tour-text").textContent = t("tour_" + s.id);
    root.querySelector('[data-tour="skip"]').textContent = t("tour_skip");
    root.querySelector('[data-tour="skip"]').classList.toggle("hidden", last);
    root.querySelector('[data-tour="back"]').textContent = t("tour_back");
    root.querySelector('[data-tour="back"]').classList.toggle("hidden", tr.i === 0);
    root.querySelector('[data-tour="next"]').textContent = t(last ? "tour_finish" : tr.i === 0 ? "tour_start" : "tour_next");
  }

  function place() {
    if (!tr.on) return;
    var s = tr.list[tr.i], root = $("#tour"), hole = root.querySelector(".tour-hole"), card = root.querySelector(".tour-card");
    var el = s.sel ? targetOf(s) : null;
    var vw = window.innerWidth, vh = window.innerHeight, pad = 6;
    card.style.width = Math.min(360, vw - 24) + "px";
    if (!el) {
      // шаг без элемента: всё затемнено, карточка по центру
      hole.style.display = "none";
      root.classList.add("dim");
      card.style.left = Math.max(12, (vw - card.offsetWidth) / 2) + "px";
      card.style.top = Math.max(12, (vh - card.offsetHeight) / 2) + "px";
      return;
    }
    root.classList.remove("dim");
    var r = el.getBoundingClientRect();
    hole.style.display = "block";
    hole.style.left = (r.left - pad) + "px";
    hole.style.top = (r.top - pad) + "px";
    hole.style.width = (r.width + pad * 2) + "px";
    hole.style.height = (r.height + pad * 2) + "px";
    var ch = card.offsetHeight, gap = 14, top;
    if (r.bottom + gap + ch < vh - 8) top = r.bottom + pad + gap;                 // под элементом
    else if (r.top - gap - ch > 8) top = r.top - pad - gap - ch;                   // над элементом
    else top = Math.max(8, vh - ch - 12);                                          // внизу экрана
    var left = Math.min(Math.max(12, r.left + r.width / 2 - card.offsetWidth / 2), vw - card.offsetWidth - 12);
    card.style.left = left + "px";
    card.style.top = top + "px";
  }

  function start(force) {
    if (tr.on) return;
    if (!state.ws) return;
    ensureDom();
    c.switchTab("home");
    document.querySelectorAll(".modal.open").forEach(function (m) { c.closeModal(m.id); });
    window.scrollTo(0, 0);
    // подождать, пока вкладка «Заказы» нарисуется
    setTimeout(function () {
      tr.list = buildList();
      if (state.tab !== "home") c.switchTab("home");
      if (tr.list.length < 3) return;
      tr.on = true;
      $("#tour").classList.remove("hidden");
      document.body.classList.add("touring");
      go(0);
    }, 250);
  }

  function finish() {
    if (!tr.on) return;
    tr.on = false;
    setMenu(false);
    markDone();
    $("#tour").classList.add("hidden");
    document.body.classList.remove("touring");
    window.scrollTo(0, 0);
  }

  // При первом входе байера — запустить само (один раз для каждого человека)
  function maybeStart() {
    if (!state.me || state.me.role === "admin" || !state.myWs || state.readOnly) return;
    if (isDone()) return;
    if (document.querySelector(".modal.open")) return;      // например, окно «укажите телефон» — тур позже
    setTimeout(function () { if (!isDone() && !document.querySelector(".modal.open")) start(false); }, 900);
  }

  function bind() {
    $("#tour-btn").addEventListener("click", function () {
      setMenu(false);
      start(true);
    });
  }

  U.tour = { bind: bind, start: start, maybeStart: maybeStart, _steps: function () { return tr.list.map(function (s) { return s.id; }); } };
})(window.ULA);
