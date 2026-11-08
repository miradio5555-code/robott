// =====================================================
// ULA FACTORY — путь заказа для клиента: 10 этапов, «в пути N дней», маршрут, история (файл 64).
//
// • Статусы заказа (8 штук) не меняются. Этап — уточнение статуса (orders.track_stage). Если этап не задан
//   или не подходит к статусу (байер сменил статус обычной кнопкой), этап берётся из статуса: так работают
//   все старые заказы и база без файла 64.
// • «В пути» считается по дате отправки и сроку в днях; трек-номер не нужен. Без даты отправки берётся время,
//   когда заказу поставили статус «В пути» (из истории). Прогресс ориентировочный — это не GPS.
// • Клиенту — только публичные поля: этап, дата отправки, срок, город назначения, трек-номер, публичный комментарий.
// • Байеру — блок «Путь заказа для клиента» в карточке заказа (только с файлом 64). Смена этапа ничего
//   не отправляет; уведомление уходит только при смене статуса (как и раньше, файл 57).
//
// ULA.tracking: stageIndex(o), transit(o), clientHtml(o, dest), routeHtml(o, dest), historyHtml(o), buyerHtml(o), historyText(item)
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var esc = c.esc;

  var STAGES = ["accepted", "buying", "bought", "cn_warehouse", "packing", "shipped", "arrived_dest", "local", "ready", "received"];
  // какие этапы относятся к какому статусу [первый, последний]; первый — этап по умолчанию
  var RANGE = { "new": [0, 0], awaiting_payment: [0, 0], purchasing: [1, 2], china_warehouse: [3, 4], in_transit: [5, 5], arrived: [6, 8], delivered: [9, 9] };
  // статус, который ставится, если байер выбрал этап вне текущего статуса
  var STATUS_OF = ["new", "purchasing", "purchasing", "china_warehouse", "china_warehouse", "in_transit", "arrived", "arrived", "arrived", "delivered"];
  var SHIPPED = 5, DEF_MIN = 10, DEF_MAX = 20, DAY = 864e5;

  // ---------- этап ----------
  function rangeOf(status) { return RANGE[status] || RANGE["new"]; }
  function stageIndex(o) {
    if (!o || o.status === "cancelled") return -1;
    var r = rangeOf(o.status), i = STAGES.indexOf(o.track_stage);
    return i >= r[0] && i <= r[1] ? i : r[0];
  }
  function statusFor(idx, current) {
    var r = rangeOf(current);
    return idx >= r[0] && idx <= r[1] && RANGE[current] ? current : STATUS_OF[idx];
  }
  function stageName(i) { return t("tk_s_" + STAGES[i]); }

  // ---------- даты (календарные дни, без часовых поясов) ----------
  function now() { return U.tracking && U.tracking._now ? U.tracking._now() : new Date(); }
  function dayOfIso(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").slice(0, 10));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY : null;
  }
  function dayOfMoment(s) {
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY;
  }
  function today() { var d = now(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY; }
  function isoOfDay(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
  function int(v) { var n = parseInt(v, 10); return isFinite(n) && n > 0 ? n : 0; }

  // день отправки: указанный байером или момент, когда поставили статус «В пути» (последний такой переход)
  function shipDay(o) {
    var d = dayOfIso(o.shipped_at);
    if (d != null) return d;
    var best = null;
    (o.status_history || []).forEach(function (h) {
      var st = h.status || h.new_status;
      var hit = (h.event_type || "status") === "status" ? st === "in_transit" : h.event_type === "stage" && h.stage === "shipped";
      if (hit && (!best || String(h.created_at) > String(best))) best = h.created_at;
    });
    return best ? dayOfMoment(best) : null;
  }

  // «в пути»: сколько дней, обычный срок, ориентировочные даты, «срок увеличен», положение на маршруте (0…1)
  function transit(o) {
    var idx = stageIndex(o), mn = int(o.transit_days_min), mx = int(o.transit_days_max);
    var custom = mn > 0 && mx > 0 && mn <= mx;
    var lo = custom ? mn : DEF_MIN, hi = custom ? mx : DEF_MAX;
    var ship = shipDay(o), td = today();
    var days = ship != null ? Math.max(0, td - ship) : null;
    // даты из блока «Сроки» (файл 58) байер вписал сам — они главнее расчёта; иначе дата отправки + срок в днях
    var eta = null;
    if (o.delivery_eta_from && o.delivery_eta_to) eta = [String(o.delivery_eta_from).slice(0, 10), String(o.delivery_eta_to).slice(0, 10)];
    else if (ship != null) eta = [isoOfDay(ship + lo), isoOfDay(ship + hi)];
    // «срок увеличен» — только по сроку, который назвал байер (даты в «Сроках» или свой срок в днях), не по обычным 10–20
    var etaTo = o.delivery_eta_to ? dayOfIso(String(o.delivery_eta_to).slice(0, 10)) : null;
    var late = idx >= SHIPPED && idx <= 7 &&
      (etaTo != null ? td > etaTo : ship != null && custom && days > hi);
    var p = idx < SHIPPED ? 0 : idx > SHIPPED ? 1 : days == null ? 0.5 : Math.min(0.9, Math.max(0.06, days / hi));
    return { idx: idx, days: days, min: lo, max: hi, custom: custom, eta: eta, late: !!late, p: p, ship: ship != null ? isoOfDay(ship) : null };
  }

  // ---------- иконки (тонкие линии, цвет — от текста) ----------
  var P = {
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    bag: '<path d="M5.5 8h13l-1 12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
    bagok: '<path d="M5.5 8h13l-1 12a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/><path class="tk-draw" pathLength="1" d="m9 14.5 2 2 4-4.5"/>',
    house: '<path d="M2.5 21V9.5L12 4l9.5 5.5V21"/><path d="M6.5 21v-8h11v8"/><path d="M6.5 17h11"/>',
    box: '<path class="tk-lid" d="M3 8.5 12 4l9 4.5-9 4.5z"/><path d="M3 8.5v9l9 4.5 9-4.5v-9"/><path d="M12 13v9"/>',
    truck: '<path d="M2 6.5h12v9.5H2z"/><path d="M14 10h4l3.5 3.5V16H14"/><circle cx="6" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
    flag: '<path d="M5 22V3"/><path class="tk-wave" d="M5 4h12l-2.5 4L17 12H5"/>',
    car: '<path d="M3 16.5V12l2.2-5h9.6l3.2 5H21v4.5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/><path d="M5 12h13"/>',
    boxok: '<path d="M3 8 12 3.5 21 8v9L12 21.5 3 17z"/><path class="tk-draw" pathLength="1" d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    done: '<circle cx="12" cy="12" r="9.5"/><path class="tk-draw" pathLength="1" d="m7.5 12.5 3 3 6-6.5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11s-7-6-7-11a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2.5"/>',
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/><path d="M10 21v-6h4v6"/>',
    smallbox: '<path d="M4 8 12 4l8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4"/><path d="M12 12v8"/>'
  };
  var ICON = ["doc", "bag", "bagok", "house", "box", "truck", "flag", "car", "boxok", "done"];
  function svg(name, size, cls) {
    return '<svg class="tk-ico' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + P[name] + "</svg>";
  }

  // ---------- клиент: текущий этап + шкала ----------
  // большая иконка текущего этапа со своей короткой анимацией (CSS; без анимации — статичная)
  function nowIconHtml(i) {
    var k = STAGES[i], extra = "";
    if (k === "buying") extra = '<span class="tk-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    if (k === "cn_warehouse") extra = '<span class="tk-mover" aria-hidden="true">' + svg("smallbox", 16) + "</span>";
    return '<span class="tk-now-icon tk-a-' + k + '">' + svg(ICON[i], 34) + extra + "</span>";
  }

  function timelineHtml(idx) {
    var last = STAGES.length - 1;
    return '<ol class="tl" aria-label="' + esc(t("tk_path")) + '">' + STAGES.map(function (k, i) {
      // заказ получен — весь путь пройден, последний шаг тоже зелёный с галочкой
      var finished = i < idx || (idx === last && i === last);
      var st = finished ? "done" : i === idx ? "current" : "todo";
      return '<li class="tl-step ' + st + '"' + (i === idx ? ' aria-current="step"' : "") + ">" +
        '<span class="tl-dot">' + svg(finished ? "check" : ICON[i], finished ? 14 : 15) + "</span>" +
        '<span class="tl-label">' + esc(stageName(i)) + '<span class="sr-only"> — ' + esc(t("tk_" + st)) + "</span></span></li>";
    }).join("") + "</ol>";
  }

  // конфетти — только один раз на этом устройстве и только если анимации разрешены
  function confettiOnce(o) {
    var key = "ula_tk_cf_" + String(o.order_number || "");
    try {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "";
      if (localStorage.getItem(key)) return "";
      localStorage.setItem(key, "1");
    } catch (e) { return ""; }
    var colors = ["#4CC38A", "#FFD166", "#FF7A89", "#7FB7FF", "#FFFFFF"], h = "";
    for (var i = 0; i < 14; i++) {
      h += '<i style="left:' + (6 + i * 6.6).toFixed(1) + "%;background:" + colors[i % colors.length] + ";animation-delay:" + ((i % 5) * 0.07).toFixed(2) + "s;--dx:" + ((i % 2 ? 1 : -1) * (8 + (i * 7) % 22)) + 'px"></i>';
    }
    return '<span class="tk-confetti" aria-hidden="true">' + h + "</span>";
  }

  // шапка заказа у клиента: текущий этап, описание, «срок увеличен», шкала из 10 этапов
  function clientHtml(o) {
    if (o.status === "cancelled") return '<p class="cancelled-note">' + esc(t("cl_cancelled")) + "</p>";
    var idx = stageIndex(o), k = STAGES[idx];
    return '<div class="tk-now tk-now-' + k + '">' + nowIconHtml(idx) +
        '<div class="tk-now-text"><p class="tk-now-step">' + esc(t("tk_step_of", { n: idx + 1, total: STAGES.length })) + "</p>" +
        '<p class="client-hero-status">' + esc(stageName(idx)) + "</p>" +
        '<p class="tk-now-desc">' + esc(t("tk_d_" + k)) + "</p></div></div>" +
      timelineHtml(idx) +
      (k === "received" ? confettiOnce(o) : "");
  }

  // «1 день / 3 дня / 12 дней» по правилам языка
  function daysText(n) {
    var f = "other";
    try { f = new Intl.PluralRules(c.locale()).select(n); } catch (e) { /* старый браузер */ }
    var k = "tk_days_" + f, s = t(k, { n: n });
    return s === k ? t("tk_days_other", { n: n }) : s;
  }

  // ---------- клиент: маршрут Китай → город (только этапы «отправлен», «прибыл», «по городу») ----------
  function routeHtml(o, dest) {
    var tr = transit(o), idx = tr.idx;
    if (idx < SHIPPED || idx > 7) return "";
    var local = idx === 7, to = String(o.ship_to || dest || "").trim() || t("tk_dest_you");
    var from = local ? to : t("tk_from_cn"), end = local ? t("tk_to_door") : to;
    var p = local ? 0.6 : tr.p;
    var rows = "";
    if (!local) {
      if (idx === SHIPPED && tr.days != null) rows += "<div><dt>" + esc(t("tk_days_label")) + "</dt><dd>" + esc(daysText(tr.days)) + "</dd></div>";
      rows += "<div><dt>" + esc(t("tk_usual_label")) + "</dt><dd>" + esc(t("tk_usual", { a: tr.min, b: tr.max })) + "</dd></div>";
      if (tr.eta && idx === SHIPPED) rows += "<div><dt>" + esc(t("tk_eta_label")) + "</dt><dd>" + esc(tr.eta[0] === tr.eta[1] ? c.fmtDate(tr.eta[0]) : c.fmtDate(tr.eta[0]) + " – " + c.fmtDate(tr.eta[1])) + "</dd></div>";
      if (tr.ship) rows += "<div><dt>" + esc(t("tk_shipped_label")) + "</dt><dd>" + esc(c.fmtDate(tr.ship)) + "</dd></div>";
    }
    return '<section class="client-block tk-route" aria-labelledby="tk-route-t"><h2 id="tk-route-t">' + esc(t(local ? "tk_route_local" : "tk_route")) + "</h2>" +
      '<div class="tk-map' + (idx === 6 ? " is-arrived" : "") + (local ? " is-local" : "") + '" style="--p:' + p.toFixed(3) + '" role="img" aria-label="' +
        esc(t("tk_route_aria", { a: from, b: end })) + '">' +
        '<span class="tk-end tk-end-a">' + svg(local ? "house" : "pin", 18) + "</span>" +
        '<span class="tk-line"><span class="tk-fill"></span></span>' +
        '<span class="tk-vehicle">' + svg(local ? "car" : "truck", 26) + "</span>" +
        '<span class="tk-end tk-end-b">' + svg(local ? "home" : "flag", 18) + "</span>" +
      "</div>" +
      '<div class="tk-ends"><span>' + esc(from) + "</span><span>" + esc(end) + "</span></div>" +
      (rows ? '<dl class="tk-facts">' + rows + "</dl>" : "") +
      (tr.late ? '<p class="tk-late" role="status">' + esc(t("tk_late")) + "</p>" : "") +
      '<p class="fine-print">' + esc(t("tk_approx")) + "</p></section>";
  }

  // ---------- история заказа (клиент) ----------
  function eventStage(h) {
    var i = STAGES.indexOf(h.stage);
    if (i !== -1) return i;
    var st = h.status || h.new_status;
    return RANGE[st] ? RANGE[st][0] : -1;
  }
  function historyText(h) {
    var st = h.status || h.new_status;
    // в истории байера (app.js) поля stage нет — там просто «этап для клиента обновлён»
    if (h.event_type === "stage") { var i = "stage" in h ? eventStage(h) : -1; return i === -1 ? t("tk_h_stage") : stageName(i); }
    if (st === "awaiting_payment" || st === "cancelled" || !RANGE[st]) return t("status_" + st);
    return stageName(RANGE[st][0]);
  }
  function historyHtml(o) {
    var all = (o.status_history || []).slice();
    var stageAt = all.filter(function (h) { return h.event_type === "stage"; }).map(function (h) { return Date.parse(h.created_at); });
    // смена этапа, которая сменила и статус, даёт две записи почти в одну секунду — показываем одну (с этапом)
    var items = all.filter(function (h) {
      if (h.event_type === "payment") return true;
      if (h.event_type === "stage") return true;
      if ((h.event_type || "status") !== "status") return false;
      var at = Date.parse(h.created_at);
      return !stageAt.some(function (s) { return Math.abs(s - at) < 10000; });
    }).sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
    var list = items.map(function (h) {
      var title = h.event_type === "payment" ? t("history_payment", { amount: c.cur(h.paid_total, o.client_currency) }) : esc(historyText(h));
      var d = new Date(h.created_at);
      var when = isNaN(d.getTime()) ? "" : d.toLocaleString(c.locale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      return '<li class="tk-h' + (h.event_type === "payment" ? " pay" : "") + '"><time datetime="' + esc(h.created_at) + '">' + esc(when) + "</time>" +
        '<span class="tk-h-title">' + title + "</span>" +
        (h.note ? '<span class="tk-h-note pre"><span class="tk-h-who">' + esc(t("tk_h_buyer")) + ":</span> " + esc(h.note) + "</span>" : "") + "</li>";
    }).join("");
    if (!list) {   // старый заказ без истории: хотя бы текущий этап и дата обновления
      var idx = stageIndex(o);
      list = '<li class="tk-h"><time>' + esc(o.updated_at ? new Date(o.updated_at).toLocaleDateString(c.locale()) : "") + "</time>" +
        '<span class="tk-h-title">' + esc(idx === -1 ? t("status_cancelled") : stageName(idx)) + "</span></li>";
    }
    return '<section class="client-block tk-history" aria-labelledby="tk-hist-t"><h2 id="tk-hist-t">' + esc(t("history_title")) + '</h2><ol class="tk-hist">' + list + "</ol></section>";
  }

  // ---------- байер: блок «Путь заказа для клиента» в карточке заказа ----------
  function hasColumns(o) { return !!o && Object.prototype.hasOwnProperty.call(o, "track_stage"); }
  function buyerHtml(o) {
    if (!hasColumns(o) || o.status === "cancelled") return "";
    var idx = stageIndex(o);
    var opts = STAGES.map(function (k, i) { return '<option value="' + i + '"' + (i === idx ? " selected" : "") + ">" + (i + 1) + ". " + esc(stageName(i)) + "</option>"; }).join("");
    var v = function (x) { return x == null ? "" : esc(x); };
    return '<div class="tk-buyer" data-tk-order="' + esc(o.id) + '"><h4>' + esc(t("tk_b_title")) + "</h4>" +
      '<p class="field-hint">' + esc(t("tk_b_hint")) + "</p>" +
      '<label class="field"><span>' + esc(t("tk_b_stage")) + '</span><select data-tk-stage>' + opts + "</select></label>" +
      '<p class="field-hint tk-b-note hidden" data-tk-status-note></p>' +
      '<fieldset class="tk-b-ship"><legend>' + esc(t("tk_b_ship")) + "</legend>" +
        '<label class="field"><span>' + esc(t("tk_b_shipped")) + '</span><input type="date" data-tk-shipped value="' + v(o.shipped_at && String(o.shipped_at).slice(0, 10)) + '"></label>' +
        '<div class="tk-b-grid">' +
          '<label class="field"><span>' + esc(t("tk_b_min")) + '</span><input type="number" inputmode="numeric" min="1" max="180" step="1" placeholder="' + DEF_MIN + '" data-tk-min value="' + v(o.transit_days_min) + '"></label>' +
          '<label class="field"><span>' + esc(t("tk_b_max")) + '</span><input type="number" inputmode="numeric" min="1" max="180" step="1" placeholder="' + DEF_MAX + '" data-tk-max value="' + v(o.transit_days_max) + '"></label>' +
        "</div>" +
        '<label class="field"><span>' + esc(t("tk_b_dest")) + '</span><input type="text" maxlength="120" autocomplete="off" placeholder="' + esc(t("tk_b_dest_ph")) + '" data-tk-dest value="' + v(o.ship_to) + '"></label>' +
        '<label class="field"><span>' + esc(t("tk_b_track")) + ' <span class="opt">(' + esc(t("cd_optional")) + ')</span></span><input type="text" maxlength="100" autocomplete="off" spellcheck="false" data-tk-track value="' + v(o.tracking_number) + '"></label>' +
      "</fieldset>" +
      '<label class="field"><span>' + esc(t("tk_b_comment")) + '</span><textarea rows="2" maxlength="500" data-tk-comment>' + v(o.client_comment) + "</textarea></label>" +
      '<p class="field-hint">' + esc(t("tk_b_comment_hint")) + "</p>" +
      '<div class="dl-acts"><button type="button" class="btn btn-primary" data-tk-save data-write>' + esc(t("tk_b_save")) + "</button></div>" +
      '<details data-tk-hist="' + esc(o.id) + '"><summary>' + esc(t("tk_b_history")) + '</summary><ol class="tk-hist tk-hist-b"><li>…</li></ol></details>' +
      "</div>";
  }

  function orderById(id) { return (c.state.orders || []).filter(function (x) { return x.id === id; })[0]; }

  function statusNote(box) {
    var o = orderById(box.getAttribute("data-tk-order")); if (!o) return;
    var idx = Number(box.querySelector("[data-tk-stage]").value), st = statusFor(idx, o.status);
    var el = box.querySelector("[data-tk-status-note]");
    el.textContent = st !== o.status ? t("tk_b_status_change", { s: t("status_" + st) }) : "";
    el.classList.toggle("hidden", st === o.status);
    var ship = box.querySelector("[data-tk-shipped]");
    if (idx >= SHIPPED && !ship.value) ship.value = c.todayISO();   // видно и можно поменять до сохранения
  }

  // проверка полей; null — всё в порядке, иначе ключ текста ошибки
  function validate(v) {
    if (v.min && !(v.min >= 1 && v.min <= 180)) return "tk_e_days";
    if (v.max && !(v.max >= 1 && v.max <= 180)) return "tk_e_days";
    if ((v.min && !v.max) || (!v.min && v.max)) return "tk_e_both";
    if (v.min && v.max && v.min > v.max) return "tk_e_order";
    if (v.shipped && (dayOfIso(v.shipped) == null || dayOfIso(v.shipped) > today() + 1)) return "tk_e_date";
    return null;
  }

  var saving = false;
  function save(box) {
    var id = box.getAttribute("data-tk-order"), o = orderById(id);
    if (!o || saving) return;
    var q = function (s) { return box.querySelector(s).value.trim(); };
    var idx = Number(q("[data-tk-stage]"));
    var v = { shipped: q("[data-tk-shipped]"), min: q("[data-tk-min]") ? Number(q("[data-tk-min]")) : 0, max: q("[data-tk-max]") ? Number(q("[data-tk-max]")) : 0 };
    var bad = validate(v);
    if (bad) { c.toast(t(bad), "error"); return; }
    var payload = {
      track_stage: STAGES[idx],
      shipped_at: v.shipped || null,
      transit_days_min: v.min || null,
      transit_days_max: v.max || null,
      ship_to: q("[data-tk-dest]").slice(0, 120) || null,
      tracking_number: q("[data-tk-track]").replace(/\s+/g, " ").slice(0, 100) || null,
      client_comment: q("[data-tk-comment]").slice(0, 500) || null
    };
    var st = statusFor(idx, o.status);
    if (st !== o.status) payload.status = st;
    saving = true;
    Promise.resolve(c.db().from("orders").update(payload).eq("id", id)).then(function (r) {
      saving = false;
      if (r && r.error) { c.handleError(r.error); return; }
      c.toast(t("tk_b_saved"), "ok");
      return Promise.resolve(c.reloadOrders ? c.reloadOrders(true) : null).then(function () { if (c.renderAll) c.renderAll(); });
    }).catch(function (e) { saving = false; c.handleError(e); });
  }

  function loadHistory(id, det) {
    Promise.resolve(c.db().from("order_status_history").select("event_type, new_status, stage, note, created_at")
      .eq("order_id", id).eq("event_type", "stage").order("created_at", { ascending: false })).then(function (r) {
      var rows = (r && !r.error ? r.data || [] : []).map(function (h) {
        return '<li class="tk-h"><time>' + esc(new Date(h.created_at).toLocaleString(c.locale())) + '</time><span class="tk-h-title">' + esc(historyText(h)) + "</span>" +
          (h.note ? '<span class="tk-h-note pre">' + esc(h.note) + "</span>" : "") + "</li>";
      }).join("") || '<li class="muted">' + esc(t("history_empty")) + "</li>";
      var ol = det.querySelector("ol"); if (ol) ol.innerHTML = rows;
    });
  }

  document.addEventListener("change", function (e) {
    var s = e.target.closest && e.target.closest("[data-tk-stage]");
    if (s) statusNote(s.closest("[data-tk-order]"));
  });
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-tk-save]");
    if (b) save(b.closest("[data-tk-order]"));
  });
  document.addEventListener("toggle", function (e) {
    var det = e.target;
    if (det && det.matches && det.matches("[data-tk-hist]") && det.open) loadHistory(det.getAttribute("data-tk-hist"), det);
  }, true);

  U.tracking = {
    STAGES: STAGES, stageIndex: stageIndex, statusFor: statusFor, transit: transit, validate: validate,
    clientHtml: clientHtml, routeHtml: routeHtml, historyHtml: historyHtml, buyerHtml: buyerHtml, historyText: historyText,
    _now: null
  };
})(window.ULA);
