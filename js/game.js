// =====================================================
// ULA FACTORY — лёгкая игра для байера: повод возвращаться и заполнять заказы до конца.
//
//   • Заполненность заказа: кольцо на карточке и «Осталось: вес, трек-номер» в заказе (кнопка сразу
//     открывает нужное поле). Считаются только настоящие данные и только то, что нужно на этом этапе:
//     вес — со склада в Китае, трек-номер — с отправки. Отменённые заказы не считаются.
//   • «Всё сделано!»: список «Сегодня» опустел — праздник и огонёк серии «N дней подряд».
//   • Уровни: Новичок → Байер → Опытный → Профи → Мастер ULA. Очки только за полезное:
//     выданный заказ, полностью заполненный заказ, клиент, вернувшийся клиент. Всё считается из заказов кабинета,
//     поэтому уровень одинаковый на любом устройстве.
//   • Значки (достижения) в профиле; закрытые — серые, с подсказкой, как получить.
//   • Награды без денег: рамка аватара за уровень, «Золотой» цвет кнопок с уровня «Профи».
//   • Итог недели на «Сегодня» (понедельник–среда, можно закрыть).
//
// Серия дней хранится в браузере; если запущен файл 66 — ещё и в профиле (все устройства).
// Никаких рассылок и уведомлений: всё видно только в самом приложении. У админа игры нет.
// ULA.game: completeness(o), ringHtml(o), detailHtml(o), ordersSummaryHtml(), level(), onTodayRendered(n),
//           streakHtml(), weekHtml(), profileHtml(), sync(), reward(name), celebrate(text)
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state, num = c.num;

  // ---------- кому показывать ----------
  function on() { return !!(state.me && state.me.role !== "admin" && state.ws); }
  function reduced() { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }

  // ---------- хранилище в браузере (на случай без файла 66) ----------
  function key(k) { return "ula_game_" + k + "_" + ((state.me && state.me.id) || "") + "_" + ((state.ws && state.ws.id) || ""); }
  function load(k, def) { try { var v = localStorage.getItem(key(k)); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function save(k, v) { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch (e) { /* без хранилища — не страшно */ } }

  // ---------- заполненность заказа ----------
  var LATE = ["china_warehouse", "in_transit", "arrived", "delivered"];   // с этого этапа нужен вес
  var SENT = ["in_transit", "arrived", "delivered"];                      // с этого этапа нужен трек-номер
  function phoneOk(o) {
    var p = String(o.client_phone || (o.client && o.client.phone) || "").replace(/\D/g, "");
    return p.length >= 9;
  }
  // список полей: { id, label, ok, field } — field: куда поставить курсор в форме заказа
  function fields(o) {
    var f = [
      { id: "client", label: "gm_f_client", ok: !!String(o.client_name || "").trim() && phoneOk(o), field: "client_phone" },
      { id: "photo", label: "gm_f_photo", ok: (o.order_photos || []).length > 0, field: "photos" },
      { id: "buy", label: "rq_m_buy", ok: num(o.unit_price_cny) > 0, field: "unit_price_cny" },
      { id: "sell", label: "rq_m_sell", ok: num(o.client_price) > 0, field: "client_price" },
      { id: "supplier", label: "rq_m_supplier", ok: !!(o.supplier || o.supplier_link), field: "supplier" }
    ];
    if (LATE.indexOf(o.status) !== -1) f.push({ id: "weight", label: "rq_m_weight", ok: num(o.weight_kg) > 0, field: "weight_kg" });
    if (SENT.indexOf(o.status) !== -1) f.push({ id: "track", label: "gm_f_track", ok: !!String(o.tracking_number || "").trim(), field: "tracking_number" });
    return f;
  }
  function completeness(o) {
    if (!o || o.status === "cancelled") return null;
    var f = fields(o), ok = f.filter(function (x) { return x.ok; }).length;
    return { pct: Math.round(ok / f.length * 100), ok: ok, total: f.length, missing: f.filter(function (x) { return !x.ok; }) };
  }
  function full(o) { var k = completeness(o); return !!k && k.pct === 100; }

  // маленькое кольцо в углу карточки
  function ringHtml(o) {
    if (!on()) return "";
    var k = completeness(o);
    if (!k) return "";
    var title = esc(t("gm_ring", { p: k.pct }));
    if (k.pct === 100) return '<span class="gm-ring done" title="' + title + '" role="img" aria-label="' + title + '">' + U.icon("check", 12) + "</span>";
    var C = 2 * Math.PI * 8, dash = (C * k.pct / 100).toFixed(1);
    return '<span class="gm-ring" title="' + title + '" role="img" aria-label="' + title + '">' +
      '<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true"><circle cx="10" cy="10" r="8" class="gm-ring-bg"/>' +
      '<circle cx="10" cy="10" r="8" class="gm-ring-fg" stroke-dasharray="' + dash + " " + C.toFixed(1) + '"/></svg>' +
      "<b>" + k.pct + "</b></span>";
  }

  // в окне заказа: полоска и кнопки «+ Вес», «+ Трек-номер»
  function detailHtml(o) {
    if (!on()) return "";
    var k = completeness(o);
    if (!k) return "";
    if (k.pct === 100) return '<div class="gm-fill done">' + U.icon("check", 16) + "<span>" + esc(t("gm_full")) + "</span></div>";
    return '<div class="gm-fill">' +
      '<div class="gm-fill-top"><b>' + esc(t("gm_fill_title", { p: k.pct })) + "</b><span>" + esc(t("gm_fill_n", { a: k.ok, b: k.total })) + "</span></div>" +
      '<div class="gm-bar"><i style="width:' + k.pct + '%"></i></div>' +
      '<div class="gm-fill-btns">' + k.missing.map(function (m) {
        return '<button type="button" class="gm-add" data-gm-fill="' + esc(m.field) + '" data-gm-order="' + esc(o.id) + '" data-write>+ ' + esc(t(m.label)) + "</button>";
      }).join("") + "</div></div>";
  }

  // над списком заказов: «Полностью заполнено 34 из 40»
  function ordersSummaryHtml() {
    if (!on()) return "";
    var act = (state.orders || []).filter(function (o) { return c.CLOSED.indexOf(o.status) === -1; });
    if (act.length < 2) return "";
    var ok = act.filter(full).length, pct = Math.round(ok / act.length * 100);
    return '<div class="gm-sum' + (ok === act.length ? " done" : "") + '">' +
      '<span class="gm-sum-t">' + esc(t("gm_sum", { a: ok, b: act.length })) + "</span>" +
      '<div class="gm-bar"><i style="width:' + pct + '%"></i></div></div>';
  }

  // кнопка «+ Вес»: открыть правку заказа и поставить курсор в нужное поле
  function goFill(id, field) {
    var o = (state.orders || []).filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    c.runAction("edit", o);
    setTimeout(function () {
      var el = $("#f-" + field), form = $("#order-form");
      if (!el || !form) return;
      if (!el.offsetParent) { form.classList.add("stage-all"); if (form.classList.contains("form-short") && $("#f-more")) $("#f-more").click(); }
      var d = el.closest("details");
      if (d) d.open = true;
      var box = el.closest(".field, label") || el;
      box.classList.add("gm-focus");
      setTimeout(function () { box.classList.remove("gm-focus"); }, 2400);
      if (el.type !== "file") {   // окно выбора файла открывает только сам человек
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      }
      // окно правки само возвращается наверх, когда открывается, — прокручиваем к полю ещё раз после этого
      el.scrollIntoView({ block: "center" });
      setTimeout(function () { el.scrollIntoView({ block: "center", behavior: reduced() ? "auto" : "smooth" }); }, 350);
    }, 260);
  }

  // ---------- уровни ----------
  var LEVELS = [
    { id: "novice", min: 0 }, { id: "buyer", min: 60 }, { id: "skilled", min: 250 }, { id: "pro", min: 700 }, { id: "master", min: 1500 }
  ];
  function stats() {
    var orders = state.orders || [], clients = {}, delivered = 0, filled = 0;
    orders.forEach(function (o) {
      var k = o.client_id || String(o.client_name || "").trim().toLowerCase();
      if (k && o.status !== "cancelled") clients[k] = (clients[k] || 0) + 1;
      if (o.status === "delivered") delivered++;
      if (full(o)) filled++;
    });
    var names = Object.keys(clients);
    return {
      orders: orders.length, delivered: delivered, filled: filled, clients: names.length,
      repeat: names.filter(function (n) { return clients[n] >= 2; }).length
    };
  }
  function points(s) { return s.delivered * 10 + s.filled * 5 + s.clients * 2 + s.repeat * 10; }
  function level() {
    var s = stats(), p = points(s), i = 0;
    LEVELS.forEach(function (l, k) { if (p >= l.min) i = k; });
    var next = LEVELS[i + 1] || null;
    return {
      i: i, id: LEVELS[i].id, points: p, next: next,
      pct: next ? Math.round((p - LEVELS[i].min) / (next.min - LEVELS[i].min) * 100) : 100,
      left: next ? next.min - p : 0, stats: s
    };
  }
  // награды: что открывает уровень
  var REWARDS = { frame: 1, gold: 3 };
  function reward(name) { return on() && level().i >= (REWARDS[name] || 99); }

  // ---------- серия дней «Всё сделано» ----------
  var game = { days: [], best: 0 };   // days — даты «ГГГГ-ММ-ДД», когда список «Сегодня» был пуст
  var remote = false;
  function today() { return c.todayISO ? c.todayISO() : new Date().toISOString().slice(0, 10); }
  function shift(d, n) { var x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
  function streak() {
    var set = {}; game.days.forEach(function (d) { set[d] = 1; });
    var d = set[today()] ? today() : shift(today(), -1), n = 0;
    while (set[d]) { n++; d = shift(d, -1); }
    return { n: n, todayDone: !!set[today()] };
  }
  function loadGame() {
    var local = load("days", null);
    game = local && Array.isArray(local.days) ? { days: local.days, best: num(local.best) } : { days: [], best: 0 };
    var db = c.db();
    if (!db || !state.me) return Promise.resolve();
    // файл 66: серия в профиле — одинаковая на всех устройствах. Без него работает браузерная копия.
    return Promise.resolve(db.rpc("my_game_get")).then(function (r) {
      if (r.error || !r.data) return;
      remote = true;
      var d = r.data.days || [];
      var all = {}; game.days.concat(d).forEach(function (x) { if (/^\d{4}-\d\d-\d\d$/.test(x)) all[x] = 1; });
      game.days = Object.keys(all).sort().slice(-120);
      game.best = Math.max(game.best, num(r.data.best));
      save("days", game);
    }).catch(function () { /* без файла 66 — только браузер */ });
  }
  function storeGame() {
    save("days", game);
    var db = c.db();
    if (remote && db && !state.readOnly) Promise.resolve(db.rpc("my_game_set", { p_days: game.days.slice(-120), p_best: game.best })).catch(function () { /* повторим в следующий раз */ });
  }
  var hadTasks = false;
  // daily.js сообщает, сколько дел в списке «Сегодня»
  function onTodayRendered(n) {
    if (!on() || !(state.orders || []).length) return;
    if (n > 0) { hadTasks = true; return; }
    var d = today();
    if (game.days.indexOf(d) === -1) {
      game.days.push(d);
      game.best = Math.max(game.best, streak().n);
      storeGame();
    }
    if (hadTasks) { hadTasks = false; celebrate(t("gm_alldone_toast")); }
  }
  function flame() {
    return '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2c1 3.5 5 5.8 5 10.5A5 5 0 0 1 12 18a5 5 0 0 1-5-5.2c0-2 1-3.3 2-4.3.2 1.5 1 2.5 2 2.8C10.6 8.6 11 5 12 2z"/><path d="M12 22a7 7 0 0 1-7-7c0-.7.1-1.3.3-1.9A7 7 0 0 0 12 20a7 7 0 0 0 6.7-6.9c.2.6.3 1.2.3 1.9a7 7 0 0 1-7 7z" opacity=".55"/></svg>';
  }
  // огонёк рядом с «Что сделать сегодня»
  function streakHtml() {
    if (!on()) return "";
    var s = streak();
    if (!s.n) return "";
    return '<span class="gm-streak' + (s.todayDone ? " lit" : "") + '" title="' + esc(t(s.todayDone ? "gm_streak_ok" : "gm_streak_keep", { n: s.n })) + '">' +
      flame() + "<b>" + s.n + "</b></span>";
  }
  // большая карточка «Всё сделано!» вместо пустого списка
  function allDoneHtml() {
    var s = streak();
    return '<div class="gm-alldone">' +
      '<div class="gm-alldone-ico">' + U.icon("check", 30) + "</div>" +
      "<b>" + esc(t("gm_alldone")) + "</b>" +
      "<span>" + esc(s.n > 1 ? t("gm_alldone_streak", { n: s.n }) : t("gm_alldone_first")) + "</span>" +
      (game.best > 1 ? '<small>' + esc(t("gm_best", { n: game.best })) + "</small>" : "") +
      "</div>";
  }

  // ---------- итог недели ----------
  function weekStart(d) { var x = new Date(d + "T12:00:00"), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x.toISOString().slice(0, 10); }
  function weekNums(from, to) {
    var orders = state.orders || [], n = 0, done = 0, firstBy = {};
    orders.forEach(function (o) {
      var d = String(o.order_date || o.created_at || "").slice(0, 10);
      var k = o.client_id || String(o.client_name || "").trim().toLowerCase();
      if (k && (!firstBy[k] || d < firstBy[k])) firstBy[k] = d;
      if (d >= from && d < to) n++;
      (o.status_history || []).forEach(function (h) {
        var hd = String(h.created_at || "").slice(0, 10);
        if (h.new_status === "delivered" && hd >= from && hd < to) done++;
      });
    });
    var nc = Object.keys(firstBy).filter(function (k) { return firstBy[k] >= from && firstBy[k] < to; }).length;
    return { n: n, done: done, clients: nc };
  }
  function weekHtml() {
    if (!on() || !(state.orders || []).length) return "";
    var d = today(), wd = (new Date(d + "T12:00:00").getDay() + 6) % 7;
    if (wd > 2) return "";                             // понедельник–среда
    var cur = weekStart(d), last = shift(cur, -7), prev = shift(cur, -14);
    if (load("week_hide", "") === cur) return "";
    var a = weekNums(last, cur), b = weekNums(prev, last);
    if (!a.n && !a.done) return "";
    var diff = a.n - b.n;
    return '<section class="gm-week" aria-label="' + esc(t("gm_week")) + '">' +
      '<div class="gm-week-head"><b>' + esc(t("gm_week")) + '</b><button type="button" class="gm-x" data-gm-week-hide aria-label="' + esc(t("close")) + '">×</button></div>' +
      '<div class="gm-week-nums">' +
        "<div><b>" + a.n + "</b><span>" + esc(t("gm_w_orders")) + "</span>" +
          (diff ? '<em class="' + (diff > 0 ? "up" : "down") + '">' + (diff > 0 ? "+" : "−") + Math.abs(diff) + "</em>" : "") + "</div>" +
        "<div><b>" + a.done + "</b><span>" + esc(t("gm_w_done")) + "</span></div>" +
        "<div><b>" + a.clients + "</b><span>" + esc(t("gm_w_clients")) + "</span></div>" +
      "</div></section>";
  }

  // ---------- значки ----------
  var BADGES = [
    { id: "first", ico: "package", ok: function (s) { return s.orders >= 1; } },
    { id: "deliv1", ico: "check", ok: function (s) { return s.delivered >= 1; } },
    { id: "deliv10", ico: "truck", ok: function (s) { return s.delivered >= 10; } },
    { id: "deliv50", ico: "box", ok: function (s) { return s.delivered >= 50; } },
    { id: "repeat", ico: "users", ok: function (s) { return s.repeat >= 1; } },
    { id: "clients10", ico: "id", ok: function (s) { return s.clients >= 10; } },
    { id: "full10", ico: "select", ok: function (s) { return s.filled >= 10; } },
    { id: "tracked", ico: "send", ok: function () {
      var sent = (state.orders || []).filter(function (o) { return SENT.indexOf(o.status) !== -1; });
      return sent.length >= 5 && sent.every(function (o) { return !!String(o.tracking_number || "").trim(); });
    } },
    { id: "paid", ico: "wallet", ok: function () {
      var d = (state.orders || []).filter(function (o) { return o.status === "delivered"; });
      return d.length >= 5 && d.every(function (o) { return !(num(o.balance_som) > 0); });
    } },
    { id: "alldone", ico: "bulb", ok: function () { return game.days.length >= 1; } },
    { id: "streak7", ico: "shield", ok: function () { return Math.max(game.best, streak().n) >= 7; } }
  ];
  function badges() { var s = stats(); return BADGES.map(function (b) { return { id: b.id, ico: b.ico, ok: !!b.ok(s) }; }); }

  // ---------- профиль: уровень, награды, значки ----------
  function profileHtml() {
    if (!on()) return "";
    var L = level(), bs = badges(), got = bs.filter(function (b) { return b.ok; }).length;
    var h = '<h3 class="pf-cap">' + esc(t("gm_level")) + "<em>" + esc(t("gm_points", { n: L.points })) + "</em></h3>" +
      '<div class="pf-card gm-level lv-' + L.i + '">' +
        '<div class="gm-lv-badge" aria-hidden="true"><b>' + (L.i + 1) + "</b></div>" +
        '<div class="gm-lv-t"><b>' + esc(t("gm_lv_" + L.id)) + "</b>" +
          "<span>" + esc(L.next ? t("gm_lv_next", { n: L.left, l: t("gm_lv_" + L.next.id) }) : t("gm_lv_max")) + "</span>" +
          '<div class="gm-bar"><i style="width:' + L.pct + '%"></i></div>' +
        "</div></div>" +
      '<details class="gm-how"><summary>' + esc(t("gm_how")) + "</summary>" +
        "<p>" + esc(t("gm_how_text")) + "</p>" +
        '<ul class="gm-rewards">' +
          "<li" + (reward("frame") ? ' class="ok"' : "") + ">" + esc(t("gm_rw_frame")) + "</li>" +
          "<li" + (reward("gold") ? ' class="ok"' : "") + ">" + esc(t("gm_rw_gold")) + "</li>" +
        "</ul></details>";
    h += '<h3 class="pf-cap">' + esc(t("gm_badges")) + "<em>" + esc(t("pf_ready_n", { a: got, b: bs.length })) + "</em></h3>" +
      '<div class="gm-badges">' + bs.map(function (b) {
        return '<div class="gm-badge' + (b.ok ? " ok" : "") + '" title="' + esc(t("gm_b_" + b.id + "_how")) + '">' +
          '<span class="gm-badge-ico">' + U.icon(b.ico, 22) + "</span>" +
          "<b>" + esc(t("gm_b_" + b.id)) + "</b>" +
          (b.ok ? "" : "<small>" + esc(t("gm_b_" + b.id + "_how")) + "</small>") + "</div>";
      }).join("") + "</div>";
    return h;
  }

  // ---------- праздник: конфетти и короткое сообщение ----------
  function celebrate(text, big) {
    if (text) c.toast(text, "ok");
    if (reduced()) return;
    var box = document.createElement("div");
    box.className = "gm-confetti" + (big ? " big" : "");
    box.setAttribute("aria-hidden", "true");
    var colors = ["#B50919", "#27966C", "#DCA43A", "#3478C8", "#A4A7AE"];
    for (var i = 0; i < (big ? 46 : 28); i++) {
      var p = document.createElement("i");
      p.style.left = (Math.random() * 100).toFixed(1) + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * .35).toFixed(2) + "s";
      p.style.setProperty("--dx", ((Math.random() - .5) * 160).toFixed(0) + "px");
      p.style.setProperty("--rot", (Math.random() * 720 - 360).toFixed(0) + "deg");
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 2600);
  }
  // новый уровень — отдельное окно-поздравление
  function levelUp(L) {
    var el = document.createElement("div");
    el.className = "gm-lvup";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = '<div class="gm-lvup-card lv-' + L.i + '">' +
      '<div class="gm-lv-badge big"><b>' + (L.i + 1) + "</b></div>" +
      "<small>" + esc(t("gm_lvup")) + "</small><h2>" + esc(t("gm_lv_" + L.id)) + "</h2>" +
      (L.i === REWARDS.frame ? "<p>" + esc(t("gm_rw_frame")) + "</p>" : "") +
      (L.i === REWARDS.gold ? "<p>" + esc(t("gm_rw_gold")) + "</p>" : "") +
      '<button type="button" class="btn btn-primary btn-block" data-gm-lvup-ok>' + esc(t("gm_lvup_ok")) + "</button></div>";
    document.body.appendChild(el);
    var b = el.querySelector("[data-gm-lvup-ok]");
    function close() { el.remove(); }
    b.addEventListener("click", close);
    el.addEventListener("click", function (e) { if (e.target === el) close(); });
    setTimeout(function () { b.focus(); }, 50);
    celebrate("", true);
  }

  // ---------- после каждой загрузки/изменения заказов ----------
  var lastPct = null;   // заполненность заказов в этом окне: id → процент
  var loadedFor = null;
  function sync() {
    document.body.classList.toggle("gm-frame", reward("frame"));
    document.body.setAttribute("data-gm-lv", on() ? String(level().i) : "");
    if (!on()) return;
    // другой человек или кабинет — подгрузить его серию дней и заново посчитать «Сегодня»
    if (loadedFor !== key("")) {
      loadedFor = key("");
      lastPct = null;
      loadGame().then(function () { if (U.daily) U.daily.render(); });
    }
    if (state.loading || !(state.orders || []).length && !load("seen", null)) return;
    // заказ стал заполненным на 100 % прямо сейчас
    var now = {};
    (state.orders || []).forEach(function (o) { var k = completeness(o); if (k) now[o.id] = k.pct; });
    if (lastPct) {
      var fresh = Object.keys(now).filter(function (id) { return now[id] === 100 && lastPct[id] != null && lastPct[id] < 100; });
      if (fresh.length) celebrate(t("gm_full_toast"));
    }
    lastPct = now;
    // новый уровень и новые значки (в первый раз только запоминаем — без праздника за старое)
    var L = level(), seen = load("seen", null), got = badges().filter(function (b) { return b.ok; }).map(function (b) { return b.id; });
    if (!seen) { save("seen", { lv: L.i, b: got }); return; }
    var nb = got.filter(function (id) { return (seen.b || []).indexOf(id) === -1; });
    if (L.i > num(seen.lv)) levelUp(L);
    else if (nb.length) celebrate(t("gm_badge_new", { b: t("gm_b_" + nb[0]) }));
    if (L.i !== num(seen.lv) || nb.length) save("seen", { lv: Math.max(L.i, num(seen.lv)), b: got.concat((seen.b || []).filter(function (x) { return got.indexOf(x) === -1; })) });
  }

  // ---------- нажатия ----------
  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-gm-fill]");
    if (f) { goFill(f.getAttribute("data-gm-order"), f.getAttribute("data-gm-fill")); return; }
    var w = e.target.closest("[data-gm-week-hide]");
    if (w) { save("week_hide", weekStart(today())); var s = w.closest(".gm-week"); if (s) s.remove(); }
  });

  U.game = {
    completeness: completeness, ringHtml: ringHtml, detailHtml: detailHtml, ordersSummaryHtml: ordersSummaryHtml,
    level: level, reward: reward, onTodayRendered: onTodayRendered, streakHtml: streakHtml, allDoneHtml: allDoneHtml,
    weekHtml: weekHtml, profileHtml: profileHtml, sync: sync, load: loadGame, celebrate: celebrate
  };
})(window.ULA = window.ULA || {});
