// =====================================================
// ULA FACTORY — раздел «Мои цели» (файл 72): личные цели 5 лет → год → месяц → неделя со стратегией, доска задач
// (Входящие → В плане → В работе → Готово), фокус дня (до трёх дел), таймер фокуса, календарь сроков,
// ежедневное напоминание через календарь телефона (.ics, сервер не нужен).
//
// Всё личное: строки видит только их владелец (правила доступа в базе, файл 72). Кабинет, заказы и деньги
// раздел не трогает. Без файла 72 в базе раздел показывает понятное сообщение, остальной сайт работает как раньше.
// Минуты в фокусе прибавляет только функция базы my_focus_add() — сайт их не пишет напрямую.
// Подключается после app.js. ULA.goals: open()
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;

  var HZ = ["5y", "year", "month", "week"];
  var LEVEL = { "5y": 4, year: 3, month: 2, week: 1 };
  var COLS = ["inbox", "plan", "doing", "done"];
  var FOCUS_MAX = 3;
  var S = { goals: [], tasks: [], days: {}, loaded: false, loading: false, missing: false, view: "today", boardCol: "plan", goalFilter: "", calMonth: null, calSel: null, dlg: null, uid: null, bound: false };

  function db() { return c.db(); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseYmd(s) { var p = String(s).split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function today() { return ymd(new Date()); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function fmtDay(s) { try { return parseYmd(s).toLocaleDateString(c.locale(), { day: "numeric", month: "long" }); } catch (e) { return s; } }
  function hz(h) { return t("gl_hz_" + h); }
  function areas() { return t("gl_areas").split("|"); }
  function goal(id) { return id ? S.goals.filter(function (g) { return g.id === id; })[0] || null : null; }
  function task(id) { return S.tasks.filter(function (x) { return x.id === id; })[0] || null; }
  function byDue(a, b) { return String(a.due || "9999").localeCompare(String(b.due || "9999")) || String(a.created_at || "").localeCompare(String(b.created_at || "")); }
  function focusList(d) { return S.tasks.filter(function (x) { return x.focus_date === d; }).sort(function (a, b) { return (a.focus_order || 0) - (b.focus_order || 0); }); }
  function dayMin(d) { return S.days[d] || 0; }
  function isMissing(e) { var m = String((e && e.message) || ""); return !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "PGRST202" || /could not find the (table|function)|does not exist/i.test(m)); }
  function fail(e) {
    var m = String((e && e.message) || "");
    if (isMissing(e)) { S.missing = true; render(); return; }
    if (/focus_full/.test(m)) toast(t("gl_e_focus_full"), "error");
    else if (/bad_parent/.test(m)) toast(t("gl_e_parent"), "error");
    else if (/too_many_/.test(m)) toast(t("gl_e_limit"), "error");
    else toast(t("gl_e_save"), "error");
  }

  // ---------- загрузка ----------
  async function load() {
    if (!db() || !state.me) return;
    S.loading = true;
    var since = new Date(Date.now() - 90 * 86400000).toISOString(), sinceDay = addDays(today(), -400);
    try {
      var r = await Promise.all([
        db().from("my_goals").select("*").order("created_at", { ascending: true }).limit(500),
        db().from("my_tasks").select("*").or("col.neq.done,done_at.gte." + since).order("created_at", { ascending: true }).limit(3000),
        db().from("my_focus_days").select("day, minutes").gte("day", sinceDay)
      ]);
      var err = r[0].error || r[1].error || r[2].error;
      if (err) { if (isMissing(err)) S.missing = true; else c.handleError(err); }
      else {
        S.missing = false;
        S.goals = r[0].data || []; S.tasks = r[1].data || []; S.days = {};
        (r[2].data || []).forEach(function (d) { S.days[d.day] = d.minutes; });
      }
    } catch (e) { c.handleError(e); }
    S.loading = false; S.loaded = true;
    render();
  }

  // ---------- запись ----------
  async function saveTask(id, patch) {
    var x = id ? task(id) : null, prev = x ? Object.assign({}, x) : null;
    if (x) { Object.assign(x, patch); render(); }
    var q = id ? db().from("my_tasks").update(patch).eq("id", id) : db().from("my_tasks").insert(patch);
    var res = await q.select().single();
    if (res.error) { if (x) Object.assign(x, prev); fail(res.error); render(); return null; }
    var data = res.data || Object.assign({ id: id }, patch);
    if (x) Object.assign(x, data); else S.tasks.push(data);
    render();
    return data;
  }
  async function saveGoal(id, patch) {
    var q = id ? db().from("my_goals").update(patch).eq("id", id) : db().from("my_goals").insert(patch);
    var res = await q.select().single();
    if (res.error) { fail(res.error); return null; }
    var data = res.data || Object.assign({ id: id }, patch);
    var g = goal(data.id); if (g) Object.assign(g, data); else S.goals.push(data);
    render();
    return data;
  }
  async function remove(table, id) {
    var res = await db().from(table).delete().eq("id", id);
    if (res.error) { fail(res.error); return; }
    if (table === "my_tasks") S.tasks = S.tasks.filter(function (x) { return x.id !== id; });
    else {
      S.goals = S.goals.filter(function (g) { return g.id !== id; });
      S.goals.forEach(function (g) { if (g.parent_id === id) g.parent_id = null; });
      S.tasks.forEach(function (x) { if (x.goal_id === id) x.goal_id = null; });
    }
    toast(t("gl_deleted")); render();
  }
  function setCol(id, col) { return saveTask(id, { col: col }); }
  function setFocus(id) {
    var d = today();
    if (focusList(d).filter(function (x) { return x.id !== id; }).length >= FOCUS_MAX) { toast(t("gl_e_focus_full"), "error"); return Promise.resolve(null); }
    var x = task(id), max = 0; focusList(d).forEach(function (y) { max = Math.max(max, y.focus_order || 0); });
    return saveTask(id, { focus_date: d, focus_order: max + 1, col: x && x.col === "inbox" ? "plan" : (x ? x.col : "plan") });
  }

  // ---------- таймер ----------
  var TK = "ula_goals_timer", wake = null, audio = null, RING = 2 * Math.PI * 52;
  var T = (function () { try { var v = JSON.parse(localStorage.getItem(TK)); if (v && v.dur) return v; } catch (e) {} return { dur: 25, left: 1500, running: false, end: 0, taskId: null }; })();
  function saveTimer() { try { localStorage.setItem(TK, JSON.stringify(T)); } catch (e) {} }
  function remaining() { return T.running ? Math.max(0, Math.round((T.end - Date.now()) / 1000)) : T.left; }
  function mmss(s) { return pad(Math.floor(s / 60)) + ":" + pad(s % 60); }
  function ensureAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch (e) { audio = null; } }
  function beep() {
    if (!audio) return;
    try { [0, 0.35, 0.7].forEach(function (s0) { var o = audio.createOscillator(), g = audio.createGain(), s = audio.currentTime + s0; o.frequency.value = 660; o.connect(g); g.connect(audio.destination); g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.25, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25); o.start(s); o.stop(s + 0.3); }); } catch (e) {}
  }
  function lock(on) {
    if (on && navigator.wakeLock && navigator.wakeLock.request) navigator.wakeLock.request("screen").then(function (l) { wake = l; }).catch(function () {});
    if (!on && wake) { try { wake.release(); } catch (e) {} wake = null; }
  }
  function timerStart() { ensureAudio(); T.end = Date.now() + remaining() * 1000; T.running = true; saveTimer(); lock(true); render(); }
  function timerPause() { T.left = remaining(); T.running = false; saveTimer(); lock(false); render(); }
  async function timerDone(mins, early) {
    var taskId = T.taskId;
    T.running = false; T.left = T.dur * 60; T.end = 0; saveTimer(); lock(false);
    if (!early) beep();
    if (mins < 1) { toast(t("gl_t_short")); render(); return; }
    var d = today();
    var res = await db().rpc("my_focus_add", { p_task: taskId || null, p_minutes: Math.min(mins, 240), p_day: d });
    if (res.error) { fail(res.error); render(); return; }
    S.days[d] = (res.data && res.data.day_minutes) || (dayMin(d) + mins);
    var x = taskId && task(taskId); if (x && res.data && res.data.task_minutes != null) x.focus_min = res.data.task_minutes;
    toast(t(early ? "gl_t_credited" : "gl_t_done", { n: mins }));
    render();
  }
  setInterval(function () {
    if (!T.running) return;
    var r = remaining();
    if (r <= 0) { timerDone(T.dur, false); return; }
    var el = document.getElementById("gl-clock"); if (el) el.textContent = mmss(r);
    var f = document.getElementById("gl-ring"); if (f) f.setAttribute("stroke-dashoffset", (RING * (r / (T.dur * 60))).toFixed(1));
  }, 1000);

  // ---------- кусочки разметки ----------
  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function chain(goalId) {
    var out = [], g = goal(goalId), guard = 0;
    while (g && guard++ < 6) { out.push(g); g = goal(g.parent_id); }
    if (!out.length) return "";
    return '<span class="gl-chain">' + out.map(function (x) { return "<span><b>" + esc(hz(x.horizon)) + "</b> " + esc(x.title) + "</span>"; }).join("<i>→</i>") + "</span>";
  }
  function dueChip(x) {
    if (!x.due) return "";
    var d = today();
    if (x.col !== "done" && x.due < d) return '<span class="gl-chip late">' + esc(t("gl_late")) + " · " + esc(fmtDay(x.due)) + "</span>";
    if (x.due === d) return '<span class="gl-chip now">' + esc(t("gl_today_chip")) + "</span>";
    if (x.due === addDays(d, 1)) return '<span class="gl-chip">' + esc(t("gl_tomorrow")) + "</span>";
    return '<span class="gl-chip">' + esc(fmtDay(x.due)) + "</span>";
  }
  function goalChip(x) { var g = goal(x.goal_id); return g ? '<span class="gl-chip goal">' + esc(g.title) + "</span>" : ""; }
  function scale(h) { var lv = LEVEL[h] || 0; return '<span class="gl-scale" aria-hidden="true">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= lv ? "on" : "") + '"></i>'; }).join("") + "</span>"; }
  function checkBtn(x) { return '<button type="button" class="gl-check' + (x.col === "done" ? " on" : "") + '" data-gl="done" data-id="' + x.id + '" aria-label="' + esc(t("gl_mark_done")) + '">' + (x.col === "done" ? CHECK : "") + "</button>"; }
  function row(x, withFocus) {
    var d = today();
    return "<li>" + checkBtn(x) + '<div class="gl-row-main"><button type="button" class="gl-t" data-gl="edit-task" data-id="' + x.id + '">' + esc(x.title) + '</button><div class="gl-chips">' + dueChip(x) + goalChip(x) + "</div></div>" +
      (withFocus && x.focus_date !== d && x.col !== "done" ? '<button type="button" class="gl-ibtn" data-gl="focus" data-id="' + x.id + '" title="' + esc(t("gl_to_focus")) + '" aria-label="' + esc(t("gl_to_focus")) + '">★</button>' : "<span></span>") + "</li>";
  }
  function listBlock(title, arr, empty) {
    return '<div class="gl-panel"><div class="gl-ph"><h3>' + esc(title) + '</h3><span class="gl-meta">' + arr.length + "</span></div>" +
      (arr.length ? '<ul class="gl-list">' + arr.slice(0, 12).map(function (x) { return row(x, true); }).join("") + "</ul>" + (arr.length > 12 ? '<span class="gl-meta">' + esc(t("gl_more", { n: arr.length - 12 })) + "</span>" : "") : '<p class="gl-empty">' + esc(empty) + "</p>") + "</div>";
  }
  function goalOptions(sel, minLevel, exclude) {
    return HZ.filter(function (h) { return LEVEL[h] >= (minLevel || 0); }).map(function (h) {
      var gs = S.goals.filter(function (g) { return g.horizon === h && g.status !== "done" && (!exclude || exclude.indexOf(g.id) === -1); });
      if (!gs.length) return "";
      return '<optgroup label="' + esc(hz(h)) + '">' + gs.map(function (g) { return '<option value="' + g.id + '"' + (g.id === sel ? " selected" : "") + ">" + esc(g.title) + "</option>"; }).join("") + "</optgroup>";
    }).join("");
  }

  // ---------- Сегодня ----------
  function timerHtml() {
    var r = remaining(), total = T.dur * 60, x = T.taskId && task(T.taskId);
    return '<div class="gl-ph"><h2>' + esc(t("gl_timer")) + '</h2><span class="gl-meta">' + esc(t(T.running ? "gl_t_running" : r < total ? "gl_t_paused" : "gl_t_ready")) + "</span></div>" +
      '<div class="gl-timer"><svg viewBox="0 0 120 120" class="gl-ring" aria-hidden="true"><circle cx="60" cy="60" r="52" class="bg"/><circle id="gl-ring" cx="60" cy="60" r="52" class="fg" stroke-dasharray="' + RING.toFixed(1) + '" stroke-dashoffset="' + (RING * (r / total)).toFixed(1) + '"/></svg><div class="gl-clock" id="gl-clock">' + mmss(r) + "</div></div>" +
      '<p class="gl-ttask">' + (x ? esc(t("gl_t_on")) + " <b>" + esc(x.title) + "</b>" : esc(t("gl_t_hint"))) + "</p>" +
      '<div class="gl-presets">' + [25, 50, 90].map(function (m) { return '<button type="button" class="gl-pre' + (T.dur === m ? " on" : "") + '" data-gl="preset" data-m="' + m + '"' + (T.running || r < total ? " disabled" : "") + ">" + esc(t("gl_min", { n: m })) + "</button>"; }).join("") + "</div>" +
      '<div class="gl-presets"><button type="button" class="btn btn-primary" data-gl="timer">' + esc(t(T.running ? "gl_t_pause" : r < total ? "gl_t_resume" : "gl_t_start")) + "</button>" +
      '<button type="button" class="btn" data-gl="timer-finish"' + (r >= total ? " disabled" : "") + ">" + esc(t("gl_t_finish")) + "</button></div>";
  }
  function streak() {
    function active(s) { return dayMin(s) > 0 || S.tasks.some(function (x) { return x.done_at && ymd(new Date(x.done_at)) === s; }); }
    var s = today(), n = 0; if (!active(s)) s = addDays(s, -1);
    while (n < 400 && active(s)) { n++; s = addDays(s, -1); }
    return n;
  }
  function renderToday() {
    var d = today(), focus = focusList(d);
    var open = S.tasks.filter(function (x) { return x.col !== "done" && x.focus_date !== d; });
    var overdue = open.filter(function (x) { return x.due && x.due < d; }).sort(byDue);
    var dueToday = open.filter(function (x) { return x.due === d; });
    var doing = open.filter(function (x) { return x.col === "doing" && !(x.due && x.due <= d); });
    var doneToday = S.tasks.filter(function (x) { return x.done_at && ymd(new Date(x.done_at)) === d; }).length;
    var slots = "";
    for (var i = 0; i < FOCUS_MAX; i++) {
      var x = focus[i];
      if (!x) { slots += '<li class="gl-slot empty"><span class="gl-n">' + (i + 1) + '</span><button type="button" class="gl-add-slot" data-gl="pick">' + esc(t("gl_pick_slot")) + "</button></li>"; continue; }
      slots += '<li class="gl-slot' + (x.col === "done" ? " is-done" : "") + '">' + checkBtn(x) +
        '<div class="gl-row-main"><button type="button" class="gl-st" data-gl="edit-task" data-id="' + x.id + '">' + esc(x.title) + "</button>" + (chain(x.goal_id) || '<span class="gl-meta">' + esc(t("gl_no_goal")) + "</span>") +
        (x.focus_min ? '<span class="gl-meta">' + esc(t("gl_in_focus_min", { n: x.focus_min })) + "</span>" : "") + "</div>" +
        '<div class="gl-acts">' + (x.col !== "done" ? '<button type="button" class="gl-ibtn play" data-gl="timer-task" data-id="' + x.id + '" title="' + esc(t("gl_timer_task")) + '" aria-label="' + esc(t("gl_timer_task")) + '">▶</button>' : "") +
        '<button type="button" class="gl-ibtn" data-gl="unfocus" data-id="' + x.id + '" title="' + esc(t("gl_unfocus")) + '" aria-label="' + esc(t("gl_unfocus")) + '">✕</button></div></li>';
    }
    var st = streak();
    return '<section class="gl-today"><div class="gl-panel"><div class="gl-ph"><h2>' + esc(t("gl_focus")) + '</h2><span class="gl-meta">' + esc(t("gl_focus_done", { n: focus.filter(function (y) { return y.col === "done"; }).length, m: Math.max(focus.length, FOCUS_MAX) })) + "</span></div>" +
      '<p class="gl-lede">' + esc(t("gl_focus_hint")) + '</p><ol class="gl-slots">' + slots + "</ol>" +
      (focus.length > FOCUS_MAX ? '<p class="gl-meta">' + esc(t("gl_more_focus", { list: focus.slice(FOCUS_MAX).map(function (y) { return y.title; }).join(", ") })) + "</p>" : "") +
      '</div><div class="gl-panel">' + timerHtml() + "</div></section>" +
      '<section class="gl-stats"><div class="gl-stat"><b>' + dayMin(d) + "</b><span>" + esc(t("gl_s_min")) + '</span></div><div class="gl-stat"><b>' + doneToday + "</b><span>" + esc(t("gl_s_done")) + '</span></div><div class="gl-stat"><b>' + st + "</b><span>" + esc(t("gl_s_streak")) + "</span></div></section>" +
      '<form class="gl-panel gl-quick" data-gl-form="quick"><div class="gl-ph"><h3>' + esc(t("gl_quick")) + '</h3><span class="gl-meta">' + esc(t("gl_quick_hint")) + '</span></div><div class="gl-rowf"><input id="gl-quick" class="input" maxlength="200" autocomplete="off" placeholder="' + esc(t("gl_quick_ph")) + '"><button class="btn btn-primary" type="submit">' + esc(t("gl_quick_btn")) + "</button></div></form>" +
      '<section class="gl-lists">' + listBlock(t("gl_l_overdue"), overdue, t("gl_e_overdue")) + listBlock(t("gl_l_today"), dueToday, t("gl_e_today")) + listBlock(t("gl_l_doing"), doing, t("gl_e_doing")) + "</section>";
  }

  // ---------- Доска ----------
  function card(x) {
    var d = today(), ck = x.checklist || [], cd = ck.filter(function (i) { return i.d; }).length;
    return '<article class="gl-card' + (x.col === "done" ? " is-done" : "") + '" draggable="true" data-gl="edit-task" data-id="' + x.id + '" tabindex="0">' +
      (x.focus_date === d ? '<span class="gl-star" title="' + esc(t("gl_focus")) + '">★</span>' : "") + '<div class="gl-ct">' + esc(x.title) + '</div><div class="gl-chips">' + dueChip(x) + goalChip(x) +
      (ck.length ? '<span class="gl-chip">☑ ' + cd + "/" + ck.length + "</span>" : "") + (x.focus_min ? '<span class="gl-chip">' + esc(t("gl_min", { n: x.focus_min })) + "</span>" : "") + "</div></article>";
  }
  function renderBoard() {
    var gf = S.goalFilter, list = gf ? S.tasks.filter(function (x) { return x.goal_id === gf; }) : S.tasks.slice();
    var by = {}; COLS.forEach(function (k) { by[k] = []; });
    list.forEach(function (x) { (by[x.col] || by.inbox).push(x); });
    by.done.sort(function (a, b) { return String(b.done_at || "").localeCompare(String(a.done_at || "")); });
    ["inbox", "plan", "doing"].forEach(function (k) { by[k].sort(byDue); });
    return '<div class="gl-bhead"><select id="gl-filter" class="input" data-gl-change="filter" aria-label="' + esc(t("gl_all_goals")) + '"><option value="">' + esc(t("gl_all_goals")) + "</option>" + goalOptions(gf) + '</select><span class="gl-sp"></span><button type="button" class="btn btn-primary btn-sm" data-gl="new-task" data-col="plan">' + esc(t("gl_new_task")) + "</button></div>" +
      '<div class="gl-colswitch">' + COLS.map(function (k) { return '<button type="button" data-gl="boardcol" data-c="' + k + '" aria-pressed="' + (S.boardCol === k) + '">' + esc(t("gl_c_" + k)) + " · " + by[k].length + "</button>"; }).join("") + "</div>" +
      '<div class="gl-board">' + COLS.map(function (k) {
        var arr = by[k], shown = k === "done" ? arr.slice(0, 30) : arr;
        return '<section class="gl-col" data-col="' + k + '"' + (S.boardCol === k ? " data-active" : "") + '><div class="gl-colh"><h3>' + esc(t("gl_c_" + k)) + '</h3><span class="gl-meta">' + arr.length + "</span></div>" +
          (k !== "done" ? '<div class="gl-colhint">' + esc(t("gl_h_" + k)) + "</div>" : "") + shown.map(card).join("") +
          (arr.length > shown.length ? '<span class="gl-meta">' + esc(t("gl_hidden", { n: arr.length - shown.length })) + "</span>" : "") +
          (k !== "done" ? '<button type="button" class="gl-addc" data-gl="new-task" data-col="' + k + '">' + esc(t("gl_add_card")) + "</button>" : "") + "</section>";
      }).join("") + '</div><p class="gl-meta gl-foot">' + esc(t("gl_board_hint")) + "</p>";
  }

  // ---------- Цели ----------
  function progress(g) {
    var linked = S.tasks.filter(function (x) { return x.goal_id === g.id; }), kids = S.goals.filter(function (k) { return k.parent_id === g.id; });
    var dn = linked.filter(function (x) { return x.col === "done"; }).length + kids.filter(function (k) { return k.status === "done"; }).length, total = linked.length + kids.length;
    return { dn: dn, total: total, pct: g.status === "done" ? 100 : total ? Math.round(dn / total * 100) : 0, linked: linked, kids: kids };
  }
  function goalCard(g) {
    var p = progress(g), parent = goal(g.parent_id), d = today(), lower = HZ[HZ.indexOf(g.horizon) + 1];
    var dl = "";
    if (g.due) { var n = daysBetween(d, g.due); dl = n < 0 && g.status !== "done" ? '<span class="gl-chip late">' + esc(t("gl_overdue_goal")) + " · " + esc(fmtDay(g.due)) + "</span>" : '<span class="gl-chip">' + esc(t("gl_until", { d: fmtDay(g.due) })) + (g.status !== "done" && n >= 0 ? " · " + esc(t("gl_days_left", { n: n })) : "") + "</span>"; }
    var open = p.linked.filter(function (x) { return x.col !== "done"; }).slice(0, 4);
    return '<article class="gl-goal' + (g.status === "done" ? " is-done" : "") + '"><div class="gl-chips">' + (g.area ? '<span class="gl-chip goal">' + esc(g.area) + "</span>" : "") + dl + "</div>" +
      '<h3 class="gl-gt">' + esc(g.title) + (g.status === "done" ? " ✓" : "") + "</h3>" + (parent ? '<div class="gl-meta">' + esc(t("gl_leads_to", { name: parent.title })) + "</div>" : "") +
      '<div><div class="gl-bar"><span style="width:' + p.pct + '%"></span></div><div class="gl-meta">' + esc(p.total ? t("gl_steps", { d: p.dn, t: p.total, p: p.pct }) : t("gl_no_steps")) + "</div></div>" +
      (g.why || g.strategy ? "<details><summary>" + esc(t("gl_why_strategy")) + "</summary>" + (g.why ? "<h4>" + esc(t("gl_why")) + '</h4><p class="gl-txt">' + esc(g.why) + "</p>" : "") + (g.strategy ? "<h4>" + esc(t("gl_strategy")) + '</h4><p class="gl-txt">' + esc(g.strategy) + "</p>" : "") + "</details>" : "") +
      (p.kids.length ? '<div class="gl-chips">' + p.kids.map(function (k) { return '<span class="gl-chip">' + esc(hz(k.horizon)) + ": " + esc(k.title) + (k.status === "done" ? " ✓" : "") + "</span>"; }).join("") + "</div>" : "") +
      (open.length ? '<ul class="gl-list">' + open.map(function (x) { return row(x, true); }).join("") + "</ul>" : "") +
      '<div class="gl-gacts"><button type="button" class="btn btn-sm" data-gl="edit-goal" data-id="' + g.id + '">' + esc(t("gl_edit")) + '</button><button type="button" class="btn btn-sm" data-gl="new-task" data-goal="' + g.id + '" data-col="plan">' + esc(t("gl_add_step")) + "</button>" +
      (lower ? '<button type="button" class="btn btn-sm" data-gl="new-goal" data-h="' + lower + '" data-parent="' + g.id + '">+ ' + esc(t("gl_add_" + lower)) + "</button>" : "") +
      (g.due ? '<button type="button" class="btn btn-sm" data-gl="ics-goal" data-id="' + g.id + '">' + esc(t("gl_ics_btn")) + "</button>" : "") +
      '<button type="button" class="btn btn-sm" data-gl="goal-done" data-id="' + g.id + '">' + esc(t(g.status === "done" ? "gl_reopen" : "gl_achieved")) + "</button></div></article>";
  }
  function renderGoals() {
    var html = '<div class="gl-ladder">' + HZ.map(function (h) { return "<span>" + scale(h) + esc(hz(h)) + "</span>"; }).join("<i>→</i>") + "<i>→</i><span>★ " + esc(t("gl_focus")) + "</span></div>";
    HZ.forEach(function (h) {
      var gs = S.goals.filter(function (g) { return g.horizon === h; }).sort(function (a, b) { return (a.status === "done") - (b.status === "done") || byDue(a, b); });
      html += '<section class="gl-hz"><div class="gl-hzh">' + scale(h) + "<h2>" + esc(hz(h)) + '</h2><span class="gl-meta">' + esc(t("gl_active", { n: gs.filter(function (g) { return g.status !== "done"; }).length })) + '</span><span class="gl-sp"></span><button type="button" class="btn btn-sm" data-gl="new-goal" data-h="' + h + '">+ ' + esc(t("gl_add_" + h)) + "</button></div>" +
        (gs.length ? '<div class="gl-ggrid">' + gs.map(goalCard).join("") + "</div>" : '<p class="gl-hzempty">' + esc(t("gl_hint_" + h)) + "</p>") + "</section>";
    });
    return html;
  }

  // ---------- Календарь ----------
  function renderCal() {
    if (!S.calMonth) { var n = new Date(); S.calMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
    if (!S.calSel) S.calSel = today();
    var m = S.calMonth, d0 = today(), off = (m.getDay() + 6) % 7, dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var weeks = Math.ceil((off + dim) / 7), start = new Date(m.getFullYear(), m.getMonth(), 1 - off), dueBy = {}, goalBy = {};
    S.tasks.forEach(function (x) { if (x.due) (dueBy[x.due] = dueBy[x.due] || []).push(x); });
    S.goals.forEach(function (g) { if (g.due) (goalBy[g.due] = goalBy[g.due] || []).push(g); });
    var wd = "";
    for (var w = 0; w < 7; w++) { var dd = new Date(2024, 0, 1 + w); wd += '<div class="gl-wd">' + esc(dd.toLocaleDateString(c.locale(), { weekday: "short" })) + "</div>"; }
    var cells = "";
    for (var i = 0; i < weeks * 7; i++) {
      var day = new Date(start); day.setDate(start.getDate() + i); var s = ymd(day), ts = dueBy[s] || [], gs = goalBy[s] || [];
      var marks = ts.slice(0, 4).map(function (x) { return '<span class="gl-dot' + (x.col !== "done" && s < d0 ? " late" : "") + '"></span>'; }).join("") + gs.slice(0, 2).map(function () { return '<span class="gl-dia"></span>'; }).join("") + (dayMin(s) ? '<span class="gl-fbar"></span>' : "");
      cells += '<button type="button" class="gl-day' + (day.getMonth() !== m.getMonth() ? " out" : "") + (s === d0 ? " is-today" : "") + (s === S.calSel ? " sel" : "") + '" data-gl="calday" data-d="' + s + '" aria-label="' + esc(fmtDay(s)) + '"><span class="gl-dn">' + day.getDate() + '</span><span class="gl-marks">' + marks + "</span></button>";
    }
    var sel = S.calSel, sT = (dueBy[sel] || []).slice().sort(function (a, b) { return (a.col === "done") - (b.col === "done"); }), sG = goalBy[sel] || [];
    var title = m.toLocaleDateString(c.locale(), { month: "long" }) + " " + m.getFullYear();
    var remT = (function () { try { return localStorage.getItem("ula_goals_rem") || "08:00"; } catch (e) { return "08:00"; } })();
    return '<div class="gl-calwrap"><div class="gl-panel"><div class="gl-calnav"><button type="button" class="gl-ibtn" data-gl="calprev" aria-label="‹">‹</button><h2>' + esc(title) + '</h2><button type="button" class="btn btn-sm" data-gl="caltoday">' + esc(t("gl_v_today")) + '</button><button type="button" class="gl-ibtn" data-gl="calnext" aria-label="›">›</button></div>' +
      '<div class="gl-cal">' + wd + cells + '</div><div class="gl-legend"><span><span class="gl-dot"></span>' + esc(t("gl_cal_task")) + '</span><span><span class="gl-dot late"></span>' + esc(t("gl_cal_late")) + '</span><span><span class="gl-dia"></span>' + esc(t("gl_cal_goal")) + '</span><span><span class="gl-fbar"></span>' + esc(t("gl_cal_focus")) + "</span></div></div>" +
      '<div class="gl-stack"><div class="gl-panel"><div class="gl-ph"><h2>' + esc(fmtDay(sel)) + "</h2></div>" +
      (sG.length ? "<div>" + sG.map(function (g) { return '<div class="gl-chain"><span><b>' + esc(hz(g.horizon)) + "</b> " + esc(g.title) + "</span></div>"; }).join("") + "</div>" : "") +
      (sT.length ? '<ul class="gl-list">' + sT.map(function (x) { return row(x, sel === d0); }).join("") + "</ul>" : '<p class="gl-empty">' + esc(t("gl_day_empty")) + "</p>") +
      (dayMin(sel) ? '<p class="gl-meta">' + esc(t("gl_day_focus", { n: dayMin(sel) })) + "</p>" : "") +
      '<div><button type="button" class="btn btn-sm" data-gl="new-task" data-due="' + sel + '" data-col="plan">' + esc(t("gl_day_add")) + "</button></div></div>" +
      '<div class="gl-panel"><h2>' + esc(t("gl_rem_title")) + '</h2><p class="gl-lede">' + esc(t("gl_rem_hint")) + '</p><div class="gl-rowf"><label class="gl-tl" for="gl-rem">' + esc(t("gl_rem_time")) + ' <input id="gl-rem" class="input" type="time" value="' + esc(remT) + '"></label><button type="button" class="btn btn-primary" data-gl="ics-daily">' + esc(t("gl_rem_btn")) + "</button></div></div></div></div>";
  }

  // ---------- календарь телефона (.ics) ----------
  function icsText(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
  function icsStamp() { return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); }
  function icsDownload(name, lines) {
    var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ULA Factory//Goals//RU", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"].concat(lines, ["END:VCALENDAR"]).join("\r\n");
    var a = document.createElement("a");
    a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(body);
    a.download = name + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
    toast(t("gl_rem_ok"));
  }
  function icsDaily() {
    var tm = (($("#gl-rem") || {}).value || "08:00").split(":"), now = new Date(), day = today();
    try { localStorage.setItem("ula_goals_rem", tm.join(":")); } catch (e) {}
    if (now.getHours() * 60 + now.getMinutes() >= Number(tm[0]) * 60 + Number(tm[1])) day = addDays(day, 1);
    icsDownload("ula-focus", ["BEGIN:VEVENT", "UID:ula-focus-" + Date.now() + "@ula.factory", "DTSTAMP:" + icsStamp(), "DTSTART:" + day.replace(/-/g, "") + "T" + pad(tm[0]) + pad(tm[1]) + "00", "DURATION:PT15M", "RRULE:FREQ=DAILY",
      "SUMMARY:" + icsText(t("gl_rem_summary")), "DESCRIPTION:" + icsText(t("gl_rem_desc")), "BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(t("gl_rem_summary")), "END:VALARM", "END:VEVENT"]);
  }
  function icsDeadline(title, due, desc) {
    icsDownload("ula-deadline", ["BEGIN:VEVENT", "UID:ula-due-" + Date.now() + "@ula.factory", "DTSTAMP:" + icsStamp(), "DTSTART;VALUE=DATE:" + due.replace(/-/g, ""), "DTEND;VALUE=DATE:" + addDays(due, 1).replace(/-/g, ""),
      "SUMMARY:" + icsText(title), "DESCRIPTION:" + icsText(desc), "BEGIN:VALARM", "TRIGGER:-PT15H", "ACTION:DISPLAY", "DESCRIPTION:" + icsText(title), "END:VALARM", "END:VEVENT"]);
  }

  // ---------- окна ----------
  function dlg() {
    var d = document.getElementById("gl-dlg");
    if (!d) {
      d = document.createElement("dialog"); d.id = "gl-dlg"; d.className = "gl-dlg";
      d.innerHTML = '<form id="gl-form" novalidate></form>';
      document.body.appendChild(d); bindDialog(d);
    }
    return d;
  }
  function openTask(id, preset) {
    preset = preset || {};
    var x = id ? task(id) : { col: preset.col || "inbox", goal_id: preset.goal || null, due: preset.due || null, title: "", notes: "", checklist: [] };
    if (!x) return;
    var d = dlg(), f = d.querySelector("form");
    S.dlg = { kind: "task", id: id || null, check: (x.checklist || []).map(function (i) { return { t: i.t, d: !!i.d }; }) };
    f.innerHTML = "<h2>" + esc(t(id ? "gl_task" : "gl_task_new")) + "</h2>" +
      '<label class="gl-fld"><span>' + esc(t("gl_f_title")) + '</span><input id="glf-title" class="input" maxlength="200" autocomplete="off" value="' + esc(x.title) + '"></label>' +
      '<div class="gl-fr"><label class="gl-fld"><span>' + esc(t("gl_f_col")) + '</span><select id="glf-col" class="input">' + COLS.map(function (k) { return '<option value="' + k + '"' + (x.col === k ? " selected" : "") + ">" + esc(t("gl_c_" + k)) + "</option>"; }).join("") + "</select></label>" +
      '<label class="gl-fld"><span>' + esc(t("gl_f_due")) + '</span><input id="glf-due" class="input" type="date" value="' + esc(x.due || "") + '"></label></div>' +
      '<label class="gl-fld"><span>' + esc(t("gl_f_goal")) + '</span><select id="glf-goal" class="input"><option value="">' + esc(t("gl_f_nogoal")) + "</option>" + goalOptions(x.goal_id) + "</select></label>" +
      '<label class="gl-cb"><input type="checkbox" id="glf-focus"' + (x.focus_date === today() ? " checked" : "") + "> " + esc(t("gl_f_focus")) + "</label>" +
      '<label class="gl-fld"><span>' + esc(t("gl_f_notes")) + '</span><textarea id="glf-notes" class="input" rows="3" maxlength="4000">' + esc(x.notes || "") + "</textarea></label>" +
      '<div class="gl-fld"><span>' + esc(t("gl_f_check")) + '</span><ul id="glf-check" class="gl-cl"></ul><div class="gl-rowf"><input id="glf-cnew" class="input" maxlength="300" autocomplete="off" placeholder="' + esc(t("gl_f_check_ph")) + '"><button type="button" class="btn btn-sm" data-gd="check-add">' + esc(t("gl_add")) + "</button></div></div>" +
      (x.focus_min ? '<p class="gl-meta">' + esc(t("gl_f_total", { n: x.focus_min })) + "</p>" : "") +
      '<div class="gl-dacts">' + (id ? '<button type="button" class="btn gl-danger" data-gd="delete">' + esc(t("gl_delete")) + "</button>" : "") + (id && x.due ? '<button type="button" class="btn" data-gd="ics">' + esc(t("gl_ics_btn")) + "</button>" : "") +
      '<span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_cancel")) + '</button><button type="submit" class="btn btn-primary">' + esc(t("gl_save")) + '</button></div><p class="gl-msg" id="glf-msg"></p>';
    renderCheck(); d.showModal();
    if (!id) setTimeout(function () { var i = document.getElementById("glf-title"); if (i) i.focus(); }, 30);
  }
  function renderCheck() {
    var ul = document.getElementById("glf-check"); if (!ul) return;
    ul.innerHTML = S.dlg.check.map(function (i, k) { return '<li class="' + (i.d ? "d" : "") + '"><input type="checkbox" data-ci="' + k + '"' + (i.d ? " checked" : "") + '><span>' + esc(i.t) + '</span><button type="button" class="gl-x" data-gd="check-del" data-ci="' + k + '" aria-label="' + esc(t("gl_delete")) + '">✕</button></li>'; }).join("");
  }
  async function submitTask(d) {
    var title = $("#glf-title").value.trim(), msg = $("#glf-msg"), day = today();
    if (!title) { msg.textContent = t("gl_need_title"); msg.className = "gl-msg err"; return; }
    var id = S.dlg.id, old = id ? task(id) : null, wantFocus = $("#glf-focus").checked;
    var pend = $("#glf-cnew").value.trim(); if (pend) S.dlg.check.push({ t: pend.slice(0, 300), d: false });
    var row0 = { title: title, col: $("#glf-col").value, due: $("#glf-due").value || null, goal_id: $("#glf-goal").value || null, notes: $("#glf-notes").value.trim() || null, checklist: S.dlg.check };
    if (wantFocus && (!old || old.focus_date !== day)) {
      if (focusList(day).filter(function (y) { return y.id !== id; }).length >= FOCUS_MAX) { msg.textContent = t("gl_e_focus_full"); msg.className = "gl-msg err"; return; }
      var max = 0; focusList(day).forEach(function (y) { max = Math.max(max, y.focus_order || 0); });
      row0.focus_date = day; row0.focus_order = max + 1;
    } else if (!wantFocus && old && old.focus_date === day) row0.focus_date = null;
    d.close();
    await saveTask(id, row0);
  }
  function descendants(id) { var out = [id], i = 0; while (i < out.length) { var cur = out[i++]; S.goals.forEach(function (g) { if (g.parent_id === cur && out.indexOf(g.id) === -1) out.push(g.id); }); } return out; }
  function fillParent(sel) {
    var h = $("#glg-h").value, ex = S.dlg.id ? descendants(S.dlg.id) : [];
    $("#glg-parent").innerHTML = '<option value="">' + esc(t(LEVEL[h] >= 4 ? "gl_g_top" : "gl_g_none")) + "</option>" + goalOptions(sel, LEVEL[h] + 1, ex);
  }
  function openGoal(id, preset) {
    preset = preset || {};
    var g = id ? goal(id) : { horizon: preset.h || "year", parent_id: preset.parent || null, title: "", area: "", due: null, why: "", strategy: "" };
    if (!g) return;
    var d = dlg(), f = d.querySelector("form");
    S.dlg = { kind: "goal", id: id || null };
    f.innerHTML = "<h2>" + esc(t(id ? "gl_goal" : "gl_goal_new")) + "</h2>" +
      '<label class="gl-fld"><span>' + esc(t("gl_g_title")) + '</span><input id="glg-title" class="input" maxlength="200" autocomplete="off" placeholder="' + esc(t("gl_g_ph")) + '" value="' + esc(g.title) + '"></label>' +
      '<div class="gl-fr"><label class="gl-fld"><span>' + esc(t("gl_g_hz")) + '</span><select id="glg-h" class="input">' + HZ.map(function (h) { return '<option value="' + h + '"' + (g.horizon === h ? " selected" : "") + ">" + esc(hz(h)) + "</option>"; }).join("") + "</select></label>" +
      '<label class="gl-fld"><span>' + esc(t("gl_f_due")) + '</span><input id="glg-due" class="input" type="date" value="' + esc(g.due || "") + '"></label></div>' +
      '<div class="gl-fr"><label class="gl-fld"><span>' + esc(t("gl_g_area")) + '</span><select id="glg-area" class="input"><option value="">' + esc(t("gl_g_noarea")) + "</option>" + areas().map(function (a) { return "<option" + (g.area === a ? " selected" : "") + ">" + esc(a) + "</option>"; }).join("") + "</select></label>" +
      '<label class="gl-fld"><span>' + esc(t("gl_g_parent")) + '</span><select id="glg-parent" class="input"></select></label></div>' +
      '<label class="gl-fld"><span>' + esc(t("gl_why")) + '</span><textarea id="glg-why" class="input" rows="2" maxlength="2000" placeholder="' + esc(t("gl_g_why_ph")) + '">' + esc(g.why || "") + "</textarea></label>" +
      '<label class="gl-fld"><span>' + esc(t("gl_g_strategy")) + '</span><textarea id="glg-strategy" class="input" rows="4" maxlength="4000" placeholder="' + esc(t("gl_g_strategy_ph")) + '">' + esc(g.strategy || "") + "</textarea></label>" +
      '<div class="gl-dacts">' + (id ? '<button type="button" class="btn gl-danger" data-gd="delete">' + esc(t("gl_delete")) + "</button>" : "") +
      '<span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_cancel")) + '</button><button type="submit" class="btn btn-primary">' + esc(t("gl_save")) + '</button></div><p class="gl-msg" id="glf-msg"></p>';
    fillParent(g.parent_id);
    d.showModal();
    if (!id) setTimeout(function () { var i = document.getElementById("glg-title"); if (i) i.focus(); }, 30);
  }
  async function submitGoal(d) {
    var title = $("#glg-title").value.trim(), msg = $("#glf-msg");
    if (!title) { msg.textContent = t("gl_g_need"); msg.className = "gl-msg err"; return; }
    var row0 = { title: title, horizon: $("#glg-h").value, due: $("#glg-due").value || null, area: $("#glg-area").value || null, parent_id: $("#glg-parent").value || null, why: $("#glg-why").value.trim() || null, strategy: $("#glg-strategy").value.trim() || null };
    var r = await saveGoal(S.dlg.id, row0);
    if (r) d.close();
  }
  function openPicker() {
    var day = today();
    if (focusList(day).length >= FOCUS_MAX) { toast(t("gl_e_focus_full"), "error"); return; }
    var open = S.tasks.filter(function (x) { return x.col !== "done" && x.focus_date !== day; });
    var early = function (x) { return x.due && x.due <= day; };
    var groups = [[t("gl_pick_g1"), open.filter(early)], [t("gl_c_doing"), open.filter(function (x) { return x.col === "doing" && !early(x); })], [t("gl_c_plan"), open.filter(function (x) { return x.col === "plan" && !early(x); })], [t("gl_c_inbox"), open.filter(function (x) { return x.col === "inbox" && !early(x); })]];
    var d = dlg(), f = d.querySelector("form");
    S.dlg = { kind: "pick" };
    f.innerHTML = "<h2>" + esc(t("gl_pick_title")) + '</h2><p class="gl-lede">' + esc(t("gl_pick_hint")) + "</p>" +
      '<div class="gl-rowf"><input id="glp-new" class="input" maxlength="200" autocomplete="off" placeholder="' + esc(t("gl_pick_new")) + '"><button type="submit" class="btn btn-primary">' + esc(t("gl_to_focus")) + "</button></div>" +
      groups.map(function (g) { return g[1].length ? '<div class="gl-pg"><h4>' + esc(g[0]) + "</h4>" + g[1].sort(byDue).map(function (x) { return '<button type="button" class="gl-pick" data-gd="pick" data-id="' + x.id + '"><b>' + esc(x.title) + "</b>" + chain(x.goal_id) + "</button>"; }).join("") + "</div>" : ""; }).join("") +
      (open.length ? "" : '<p class="gl-meta">' + esc(t("gl_pick_none")) + "</p>") +
      '<div class="gl-dacts"><span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_close")) + "</button></div>";
    d.showModal();
  }
  function bindDialog(d) {
    var f = d.querySelector("form");
    f.addEventListener("submit", async function (e) {
      e.preventDefault(); if (!S.dlg) return;
      if (S.dlg.kind === "task") return submitTask(d);
      if (S.dlg.kind === "goal") return submitGoal(d);
      if (S.dlg.kind === "pick") {
        var v = $("#glp-new").value.trim(); if (!v) return;
        var day = today(), max = 0; focusList(day).forEach(function (y) { max = Math.max(max, y.focus_order || 0); });
        d.close(); await saveTask(null, { title: v.slice(0, 200), col: "plan", focus_date: day, focus_order: max + 1 });
      }
    });
    f.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-gd]"); if (!b || !S.dlg) return;
      var a = b.getAttribute("data-gd");
      if (a === "cancel") d.close();
      else if (a === "pick") { var r = await setFocus(b.getAttribute("data-id")); if (r) d.close(); }
      else if (a === "check-add") { var i = $("#glf-cnew"), v = i.value.trim(); if (v && S.dlg.check.length < 50) { S.dlg.check.push({ t: v.slice(0, 300), d: false }); i.value = ""; renderCheck(); i.focus(); } }
      else if (a === "check-del") { S.dlg.check.splice(Number(b.getAttribute("data-ci")), 1); renderCheck(); }
      else if (a === "ics") { var x = task(S.dlg.id); if (x && x.due) icsDeadline(x.title, x.due, x.notes || ""); }
      else if (a === "delete") {
        if (!b.hasAttribute("data-armed")) { b.setAttribute("data-armed", "1"); b.textContent = t("gl_delete_sure"); return; }
        var kind = S.dlg.kind, id = S.dlg.id; d.close(); remove(kind === "goal" ? "my_goals" : "my_tasks", id);
      }
    });
    f.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-ci") && el.type === "checkbox") { S.dlg.check[Number(el.getAttribute("data-ci"))].d = el.checked; renderCheck(); }
      if (el.id === "glg-h") fillParent($("#glg-parent").value);
    });
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "glf-cnew") { e.preventDefault(); var b = f.querySelector('[data-gd="check-add"]'); if (b) b.click(); } });
  }

  // ---------- отрисовка и события ----------
  var VIEWS = ["today", "board", "goals", "calendar"];
  function render() {
    var nav = $("#gl-nav"), body = $("#gl-body"); if (!nav || !body || state.tab !== "goals") return;
    nav.innerHTML = VIEWS.map(function (v) { return '<button type="button" class="gl-tab" data-gl="view" data-v="' + v + '" aria-pressed="' + (S.view === v) + '">' + esc(t("gl_v_" + v)) + "</button>"; }).join("");
    var ae = document.activeElement, keep = null;
    if (ae && ae.id && body.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) keep = { id: ae.id, v: ae.value };
    if (S.missing) body.innerHTML = '<p class="state-box">' + esc(t("gl_missing")) + "</p>";
    else if (!S.loaded) body.innerHTML = '<p class="state-box">' + esc(t("loading")) + "</p>";
    else body.innerHTML = S.view === "board" ? renderBoard() : S.view === "goals" ? renderGoals() : S.view === "calendar" ? renderCal() : renderToday();
    if (keep) { var el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); } }
  }
  function bind() {
    if (S.bound) return; S.bound = true;
    var root = $("#tab-goals"); if (!root) return;
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gl]"); if (!b || !root.contains(b)) return;
      var a = b.getAttribute("data-gl"), id = b.getAttribute("data-id"), x;
      if (a === "view") { S.view = b.getAttribute("data-v"); render(); }
      else if (a === "pick") openPicker();
      else if (a === "done") { x = task(id); if (x) setCol(id, x.col === "done" ? "plan" : "done"); }
      else if (a === "focus") setFocus(id).then(function (r) { if (r) toast(t("gl_focused")); });
      else if (a === "unfocus") saveTask(id, { focus_date: null });
      else if (a === "timer-task") { if (T.running && T.taskId !== id) { T.left = remaining(); T.running = false; } T.taskId = id; saveTimer(); timerStart(); }
      else if (a === "preset") { T.dur = Number(b.getAttribute("data-m")); T.left = T.dur * 60; saveTimer(); render(); }
      else if (a === "timer") { if (T.running) timerPause(); else timerStart(); }
      else if (a === "timer-finish") timerDone(Math.floor((T.dur * 60 - remaining()) / 60), true);
      else if (a === "edit-task") openTask(id);
      else if (a === "new-task") openTask(null, { col: b.getAttribute("data-col"), goal: b.getAttribute("data-goal") || S.goalFilter || null, due: b.getAttribute("data-due") });
      else if (a === "edit-goal") openGoal(id);
      else if (a === "new-goal") openGoal(null, { h: b.getAttribute("data-h"), parent: b.getAttribute("data-parent") });
      else if (a === "goal-done") { var g = goal(id); if (g) saveGoal(id, { status: g.status === "done" ? "active" : "done" }); }
      else if (a === "ics-goal") { var gg = goal(id); if (gg && gg.due) icsDeadline(t("gl_hz_" + gg.horizon) + ": " + gg.title, gg.due, [gg.why, gg.strategy].filter(Boolean).join("\n\n")); }
      else if (a === "boardcol") { S.boardCol = b.getAttribute("data-c"); render(); }
      else if (a === "calday") { S.calSel = b.getAttribute("data-d"); var dd = parseYmd(S.calSel); if (dd.getMonth() !== S.calMonth.getMonth()) S.calMonth = new Date(dd.getFullYear(), dd.getMonth(), 1); render(); }
      else if (a === "calprev" || a === "calnext") { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + (a === "calprev" ? -1 : 1), 1); render(); }
      else if (a === "caltoday") { var n = new Date(); S.calMonth = new Date(n.getFullYear(), n.getMonth(), 1); S.calSel = today(); render(); }
      else if (a === "ics-daily") icsDaily();
    });
    root.addEventListener("change", function (e) { if (e.target.getAttribute("data-gl-change") === "filter") { S.goalFilter = e.target.value; render(); } });
    root.addEventListener("submit", function (e) {
      if (e.target.getAttribute("data-gl-form") !== "quick") return; e.preventDefault();
      var i = $("#gl-quick"), v = i.value.trim(); if (!v) return; i.value = "";
      saveTask(null, { title: v.slice(0, 200), col: "inbox" }).then(function (r) { if (r) toast(t("gl_quick_ok")); });
    });
    root.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.classList && e.target.classList.contains("gl-card")) { e.preventDefault(); openTask(e.target.getAttribute("data-id")); } });
    root.addEventListener("dragstart", function (e) { var k = e.target.closest && e.target.closest(".gl-card"); if (!k) return; e.dataTransfer.setData("text/plain", k.getAttribute("data-id")); e.dataTransfer.effectAllowed = "move"; k.classList.add("dragging"); });
    root.addEventListener("dragend", function (e) { var k = e.target.closest && e.target.closest(".gl-card"); if (k) k.classList.remove("dragging"); root.querySelectorAll(".gl-col.over").forEach(function (z) { z.classList.remove("over"); }); });
    root.addEventListener("dragover", function (e) { var col = e.target.closest && e.target.closest(".gl-col"); if (!col) return; e.preventDefault(); root.querySelectorAll(".gl-col.over").forEach(function (z) { if (z !== col) z.classList.remove("over"); }); col.classList.add("over"); });
    root.addEventListener("drop", function (e) { var col = e.target.closest && e.target.closest(".gl-col"); if (!col) return; e.preventDefault(); col.classList.remove("over"); var id = e.dataTransfer.getData("text/plain"), x = task(id); if (x && x.col !== col.getAttribute("data-col")) setCol(id, col.getAttribute("data-col")); });
  }

  function open() {
    bind();
    var uid = state.me && state.me.id;
    if (uid !== S.uid) { S.uid = uid; S.loaded = false; S.goals = []; S.tasks = []; S.days = {}; }   // другой человек на том же устройстве
    render();
    if (!S.loading) load();
  }

  U.goals = { open: open, rerender: render };
})(window.ULA);
