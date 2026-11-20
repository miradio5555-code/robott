// =====================================================
// ULA FACTORY — раздел «Мои цели» (файл 72): личные цели 5 лет → год → месяц → неделя со стратегией, доски задач
// как в Trello (основная «Мои задачи» + свои доски со своими списками, ★ отмеченные, недавние, шаблоны, поиск, архив),
// фокус дня (до трёх дел с любой доски), таймер фокуса, итог недели, календарь сроков, ежедневное напоминание через
// календарь телефона (.ics, сервер не нужен). На Главной — карточка «Фокус дня».
//
// Всё личное: строки видит только их владелец (правила доступа в базе, файл 72). Кабинет, заказы и деньги
// раздел не трогает. Без файла 72 в базе раздел показывает понятное сообщение, остальной сайт работает как раньше.
// Минуты в фокусе прибавляет только функция базы my_focus_add() — сайт их не пишет напрямую.
// Удаление карточки, цели или доски можно отменить 8 секунд («Вернуть»); доска сначала уходит в архив.
// Подключается после app.js. ULA.goals: open(), home()
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;

  var HZ = ["5y", "year", "month", "week"];
  var LEVEL = { "5y": 4, year: 3, month: 2, week: 1 };
  var COLS = ["inbox", "plan", "doing", "done"];
  var COLORS = ["blue", "green", "orange", "red", "purple", "pink", "teal", "gray"];
  var TPL = [["goal", "green"], ["kanban", "blue"], ["day", "orange"], ["study", "purple"], ["kaizen", "teal"], ["year", "red"]];
  var FOCUS_MAX = 3, UNDO_MS = 8000;
  var S = { goals: [], tasks: [], boards: [], lists: [], days: {}, loaded: false, loading: false, missing: false, view: "today", board: null, q: "",
    boardCol: "plan", goalFilter: "", calMonth: null, calSel: null, dlg: null, uid: null, bound: false };

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
  function byId(arr, id) { return id ? arr.filter(function (r) { return r.id === id; })[0] || null : null; }
  function goal(id) { return byId(S.goals, id); }
  function task(id) { return byId(S.tasks, id); }
  function brd(id) { return byId(S.boards, id); }
  function lst(id) { return byId(S.lists, id); }
  function boardLists(bid) { return S.lists.filter(function (l) { return l.board_id === bid; }).sort(function (a, b) { return (a.pos || 0) - (b.pos || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")); }); }
  function boardCards(bid) { return S.tasks.filter(function (x) { return bid === "main" ? !x.board_id : x.board_id === bid; }); }
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
    else if ((e && e.code === "23503") || /foreign key/i.test(m)) toast(t("gl_list_nonempty"), "error");
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
        db().from("my_focus_days").select("day, minutes").gte("day", sinceDay),
        db().from("my_boards").select("*").order("created_at", { ascending: true }).limit(100),
        db().from("my_lists").select("*").order("pos", { ascending: true }).limit(3000)
      ]);
      var err = r[0].error || r[1].error || r[2].error || r[3].error || r[4].error;
      if (err) { if (isMissing(err)) S.missing = true; else c.handleError(err); }
      else {
        S.missing = false;
        S.goals = r[0].data || []; S.tasks = r[1].data || []; S.boards = r[3].data || []; S.lists = r[4].data || []; S.days = {};
        (r[2].data || []).forEach(function (d) { S.days[d.day] = d.minutes; });
        if (S.board && S.board !== "main" && !brd(S.board)) S.board = null;
      }
    } catch (e) { c.handleError(e); }
    S.loading = false; S.loaded = true;
    render();
  }

  // ---------- запись ----------
  async function saveRow(table, key, id, patch, quiet) {
    var q = id ? db().from(table).update(patch).eq("id", id) : db().from(table).insert(patch);
    var res = await q.select().single();
    if (res.error) { fail(res.error); return null; }
    var data = res.data || Object.assign({ id: id }, patch);
    var o = byId(S[key], data.id); if (o) Object.assign(o, data); else S[key].push(data);
    if (!quiet) render();
    return data;
  }
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
  function saveGoal(id, patch) { return saveRow("my_goals", "goals", id, patch); }
  function saveBoard(id, patch, quiet) { return saveRow("my_boards", "boards", id, patch, quiet); }
  function setCol(id, col) { return saveTask(id, { col: col }); }
  function toggleDone(id) { var x = task(id); if (x) return setCol(id, x.col === "done" ? "plan" : "done"); }
  function setFocus(id) {
    var d = today();
    if (focusList(d).filter(function (x) { return x.id !== id; }).length >= FOCUS_MAX) { toast(t("gl_e_focus_full"), "error"); return Promise.resolve(null); }
    var x = task(id), max = 0; focusList(d).forEach(function (y) { max = Math.max(max, y.focus_order || 0); });
    return saveTask(id, { focus_date: d, focus_order: max + 1, col: x && x.col === "inbox" ? "plan" : (x ? x.col : "plan") });
  }

  // ---------- удаление с «Вернуть» ----------
  // Строка сразу пропадает с экрана, а из базы удаляется через 8 секунд. «Вернуть» — и ничего не удаляется.
  var P = null;
  function undoBar() {
    var el = document.getElementById("gl-undo");
    if (!el) {
      el = document.createElement("div"); el.id = "gl-undo"; el.className = "gl-undo hidden"; el.setAttribute("role", "status");
      el.innerHTML = '<span></span><button type="button" class="btn btn-sm"></button>';
      el.querySelector("button").addEventListener("click", undoNow);
      document.body.appendChild(el);
    }
    return el;
  }
  function later(label, run, undo) {
    flush();
    P = { run: run, undo: undo, timer: setTimeout(flush, UNDO_MS) };
    var el = undoBar(); el.querySelector("span").textContent = label; el.querySelector("button").textContent = t("gl_undo"); el.classList.remove("hidden");
  }
  function flush() { if (!P) return; var p = P; P = null; clearTimeout(p.timer); undoBar().classList.add("hidden"); p.run(); }
  function undoNow() { if (!P) return; var p = P; P = null; clearTimeout(p.timer); undoBar().classList.add("hidden"); p.undo(); render(); toast(t("gl_restored")); }
  window.addEventListener("pagehide", flush);
  function dbDelete(table, id, restore) {
    db().from(table).delete().eq("id", id).then(function (r) { if (r.error) { restore(); fail(r.error); render(); } });
  }
  function deleteTask(id) {
    var x = task(id); if (!x) return;
    S.tasks = S.tasks.filter(function (y) { return y !== x; }); render();
    var back = function () { if (!task(x.id)) S.tasks.push(x); };
    later(t("gl_del_item", { name: x.title }), function () { dbDelete("my_tasks", x.id, back); }, back);
  }
  function deleteGoal(id) {
    var g = goal(id); if (!g) return;
    var kids = S.goals.filter(function (k) { return k.parent_id === id; }), ts = S.tasks.filter(function (x) { return x.goal_id === id; }), bs = S.boards.filter(function (b) { return b.goal_id === id; });
    S.goals = S.goals.filter(function (k) { return k !== g; });
    kids.forEach(function (k) { k.parent_id = null; }); ts.forEach(function (x) { x.goal_id = null; }); bs.forEach(function (b) { b.goal_id = null; });
    render();
    var back = function () { if (!goal(g.id)) S.goals.push(g); kids.forEach(function (k) { k.parent_id = g.id; }); ts.forEach(function (x) { x.goal_id = g.id; }); bs.forEach(function (b) { b.goal_id = g.id; }); };
    later(t("gl_del_item", { name: g.title }), function () { dbDelete("my_goals", g.id, back); }, back);
  }
  function deleteBoard(id) {
    var b = brd(id); if (!b) return;
    var ls = S.lists.filter(function (l) { return l.board_id === id; }), ts = S.tasks.filter(function (x) { return x.board_id === id; });
    S.boards = S.boards.filter(function (y) { return y !== b; }); S.lists = S.lists.filter(function (l) { return ls.indexOf(l) === -1; }); S.tasks = S.tasks.filter(function (x) { return ts.indexOf(x) === -1; });
    if (S.board === id) S.board = null;
    render();
    var back = function () { if (!brd(b.id)) { S.boards.push(b); S.lists = S.lists.concat(ls); S.tasks = S.tasks.concat(ts); } };
    later(t("gl_del_item", { name: b.title }), function () { dbDelete("my_boards", b.id, back); }, back);
  }

  // ---------- доски ----------
  async function createBoard(row, tpl) {
    var b = await saveBoard(null, Object.assign({ viewed_at: new Date().toISOString() }, row), true);
    if (!b) return null;
    var names = t(tpl ? "gl_tpl_" + tpl + "_lists" : "gl_tpl_empty_lists").split("|").filter(Boolean).slice(0, 30);
    var res = await db().from("my_lists").insert(names.map(function (n, i) { return { board_id: b.id, title: n.slice(0, 100), pos: i + 1 }; })).select();
    if (res.error) fail(res.error);
    else if (Array.isArray(res.data) && res.data.length) S.lists = S.lists.concat(res.data);
    else await load();
    openBoard(b.id);
    return b;
  }
  function openBoard(id) {
    S.view = "boards"; S.board = id; S.q = "";
    var b = brd(id);
    if (b) { b.viewed_at = new Date().toISOString(); db().from("my_boards").update({ viewed_at: b.viewed_at }).eq("id", id).then(function () {}); }
    render(); window.scrollTo(0, 0);
  }
  async function addList(bid, title) {
    var max = 0; boardLists(bid).forEach(function (l) { max = Math.max(max, l.pos || 0); });
    return saveRow("my_lists", "lists", null, { board_id: bid, title: title.slice(0, 100), pos: max + 1 });
  }
  async function moveList(id, dir) {
    var l = lst(id); if (!l) return;
    var ls = boardLists(l.board_id), i = ls.indexOf(l), j = i + dir; if (j < 0 || j >= ls.length) return;
    var o = ls[j], a = l.pos || i + 1, b = o.pos || j + 1; if (a === b) b = a + dir;
    l.pos = b; o.pos = a; render();
    var r = await Promise.all([db().from("my_lists").update({ pos: b }).eq("id", l.id), db().from("my_lists").update({ pos: a }).eq("id", o.id)]);
    if (r[0].error || r[1].error) { fail(r[0].error || r[1].error); load(); }
  }
  async function deleteList(id) {
    var l = lst(id); if (!l) return;
    if (S.tasks.some(function (x) { return x.list_id === id; })) { toast(t("gl_list_nonempty"), "error"); return; }
    var res = await db().from("my_lists").delete().eq("id", id);
    if (res.error) { fail(res.error); return; }
    S.lists = S.lists.filter(function (y) { return y !== l; }); render();
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
  function boardChip(x) { var b = x.board_id && brd(x.board_id); return b ? '<span class="gl-chip brd"><i class="gl-sw gl-c-' + esc(b.color) + '"></i>' + esc(b.title) + "</span>" : ""; }
  function scale(h) { var lv = LEVEL[h] || 0; return '<span class="gl-scale" aria-hidden="true">' + [1, 2, 3, 4].map(function (i) { return '<i class="' + (i <= lv ? "on" : "") + '"></i>'; }).join("") + "</span>"; }
  function checkBtn(x, sm) { return '<button type="button" class="gl-check' + (sm ? " sm" : "") + (x.col === "done" ? " on" : "") + '" data-gl="done" data-id="' + x.id + '" aria-label="' + esc(t("gl_mark_done")) + '" aria-pressed="' + (x.col === "done") + '">' + (x.col === "done" ? CHECK : "") + "</button>"; }
  function row(x, withFocus) {
    var d = today();
    return "<li>" + checkBtn(x) + '<div class="gl-row-main"><button type="button" class="gl-t" data-gl="edit-task" data-id="' + x.id + '">' + esc(x.title) + '</button><div class="gl-chips">' + dueChip(x) + boardChip(x) + goalChip(x) + "</div></div>" +
      (withFocus && x.focus_date !== d && x.col !== "done" ? '<button type="button" class="gl-ibtn" data-gl="focus" data-id="' + x.id + '" title="' + esc(t("gl_to_focus")) + '" aria-label="' + esc(t("gl_to_focus")) + '">★</button>' : "<span></span>") + "</li>";
  }
  function listBlock(title, arr, empty) {
    return '<div class="gl-panel"><div class="gl-ph"><h3>' + esc(title) + '</h3><span class="gl-meta">' + arr.length + "</span></div>" +
      (arr.length ? '<ul class="gl-list">' + arr.slice(0, 12).map(function (x) { return row(x, true); }).join("") + "</ul>" + (arr.length > 12 ? '<span class="gl-meta">' + esc(t("gl_more", { n: arr.length - 12 })) + "</span>" : "") : '<p class="gl-empty">' + esc(empty) + "</p>") + "</div>";
  }
  function goalOptions(sel, minLevel, exclude) {
    return HZ.filter(function (h) { return LEVEL[h] >= (minLevel || 0); }).map(function (h) {
      var gs = S.goals.filter(function (g) { return g.horizon === h && (g.status !== "done" || g.id === sel) && (!exclude || exclude.indexOf(g.id) === -1); });
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
  function doneOn(x, s) { return x.done_at && ymd(new Date(x.done_at)) === s; }
  function streak() {
    function active(s) { return dayMin(s) > 0 || S.tasks.some(function (x) { return doneOn(x, s); }); }
    var s = today(), n = 0; if (!active(s)) s = addDays(s, -1);
    while (n < 400 && active(s)) { n++; s = addDays(s, -1); }
    return n;
  }
  // последние 7 дней: минуты фокуса по дням (одна величина — один цвет), сделанное и достигнутые цели
  function weekHtml() {
    var d = today(), days = [];
    for (var i = 6; i >= 0; i--) days.push(addDays(d, -i));
    var mins = days.map(dayMin), max = Math.max(60, Math.max.apply(null, mins)), total = mins.reduce(function (a, b) { return a + b; }, 0);
    var done = S.tasks.filter(function (x) { return x.done_at && ymd(new Date(x.done_at)) >= days[0]; }).length;
    var gd = S.goals.filter(function (g) { return g.done_at && ymd(new Date(g.done_at)) >= days[0]; }).length;
    return '<div class="gl-panel gl-week"><div class="gl-ph"><h3>' + esc(t("gl_week")) + '</h3><span class="gl-meta">' + esc(t("gl_week_meta", { m: total, d: done, g: gd })) + "</span></div>" +
      '<div class="gl-wbars">' + days.map(function (s, k) {
        var lab = t("gl_week_bar", { d: fmtDay(s), n: mins[k] });
        return '<div class="gl-wb' + (s === d ? " now" : "") + '" title="' + esc(lab) + '" aria-label="' + esc(lab) + '" role="img"><span class="gl-wv">' + (mins[k] || "") + '</span><span class="gl-wcol"><i style="height:' + Math.round(mins[k] / max * 100) + '%"></i></span><small>' + esc(parseYmd(s).toLocaleDateString(c.locale(), { weekday: "short" })) + "</small></div>";
      }).join("") + "</div></div>";
  }
  function renderToday() {
    var d = today(), focus = focusList(d);
    var open = S.tasks.filter(function (x) { return x.col !== "done" && x.focus_date !== d; });
    var overdue = open.filter(function (x) { return x.due && x.due < d; }).sort(byDue);
    var dueToday = open.filter(function (x) { return x.due === d; });
    var doing = open.filter(function (x) { return x.col === "doing" && !(x.due && x.due <= d); });
    var doneToday = S.tasks.filter(function (x) { return doneOn(x, d); }).length;
    var slots = "";
    for (var i = 0; i < FOCUS_MAX; i++) {
      var x = focus[i];
      if (!x) { slots += '<li class="gl-slot empty"><span class="gl-n">' + (i + 1) + '</span><button type="button" class="gl-add-slot" data-gl="pick">' + esc(t("gl_pick_slot")) + "</button></li>"; continue; }
      slots += '<li class="gl-slot' + (x.col === "done" ? " is-done" : "") + '">' + checkBtn(x) +
        '<div class="gl-row-main"><button type="button" class="gl-st" data-gl="edit-task" data-id="' + x.id + '">' + esc(x.title) + "</button>" + (chain(x.goal_id) || '<span class="gl-meta">' + esc(t("gl_no_goal")) + "</span>") +
        (boardChip(x) || x.focus_min ? '<div class="gl-chips">' + boardChip(x) + (x.focus_min ? '<span class="gl-chip">' + esc(t("gl_in_focus_min", { n: x.focus_min })) + "</span>" : "") + "</div>" : "") + "</div>" +
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
      '<section class="gl-lists">' + listBlock(t("gl_l_overdue"), overdue, t("gl_e_overdue")) + listBlock(t("gl_l_today"), dueToday, t("gl_e_today")) + listBlock(t("gl_l_doing"), doing, t("gl_e_doing")) + "</section>" +
      weekHtml();
  }

  // ---------- Доски: главная страница досок ----------
  function mainBoard() { return { id: "main", title: t("gl_main_board"), color: "gray", main: true }; }
  function tile(b) {
    var cards = boardCards(b.id), open = cards.filter(function (x) { return x.col !== "done"; }).length, g = goal(b.goal_id), p = g ? progress(g) : null;
    return '<article class="gl-btile"><button type="button" class="gl-bopen" data-gl="open-board" data-id="' + b.id + '"><span class="gl-cover gl-c-' + esc(b.color) + '"></span>' +
      '<span class="gl-btitle">' + esc(b.title) + '</span><span class="gl-meta">' + esc(t("gl_b_count", { n: open, d: cards.length - open })) + "</span>" +
      (g ? '<span class="gl-bgoal"><span class="gl-chip goal">' + esc(g.title) + '</span><span class="gl-bar"><span style="width:' + p.pct + '%"></span></span></span>' : "") + "</button>" +
      (b.main ? "" : '<button type="button" class="gl-bstar' + (b.starred ? " on" : "") + '" data-gl="star" data-id="' + b.id + '" aria-pressed="' + !!b.starred + '" title="' + esc(t(b.starred ? "gl_unstar" : "gl_star")) + '" aria-label="' + esc(t(b.starred ? "gl_unstar" : "gl_star")) + '">★</button>') + "</article>";
  }
  function bsec(title, inner, icon) { return '<section class="gl-bsec"><h2 class="gl-bsh">' + (icon || "") + esc(title) + '</h2><div class="gl-bgrid">' + inner + "</div></section>"; }
  function searchHtml() {
    var q = S.q.trim().toLowerCase();
    function has(s) { return String(s || "").toLowerCase().indexOf(q) !== -1; }
    var bs = S.boards.filter(function (b) { return has(b.title); });
    var cs = S.tasks.filter(function (x) { return has(x.title) || has(x.notes) || (x.checklist || []).some(function (i) { return has(i.t); }); }).sort(function (a, b) { return (a.col === "done") - (b.col === "done") || byDue(a, b); });
    var gs = S.goals.filter(function (g) { return has(g.title) || has(g.why) || has(g.strategy); });
    if (!bs.length && !cs.length && !gs.length) return '<p class="gl-hzempty">' + esc(t("gl_sr_none")) + "</p>";
    var out = "";
    if (bs.length) out += bsec(t("gl_sr_boards"), bs.map(tile).join(""));
    if (cs.length) out += '<section class="gl-bsec"><h2 class="gl-bsh">' + esc(t("gl_sr_cards")) + ' <span class="gl-meta">' + cs.length + '</span></h2><div class="gl-panel"><ul class="gl-list">' + cs.slice(0, 40).map(function (x) {
      return "<li>" + checkBtn(x) + '<div class="gl-row-main"><button type="button" class="gl-t" data-gl="edit-task" data-id="' + x.id + '">' + esc(x.title) + '</button><div class="gl-chips">' + (boardChip(x) || '<span class="gl-chip brd">' + esc(t("gl_main_board")) + "</span>") + dueChip(x) + goalChip(x) + "</div></div><span></span></li>";
    }).join("") + "</ul></div></section>";
    if (gs.length) out += '<section class="gl-bsec"><h2 class="gl-bsh">' + esc(t("gl_sr_goals")) + '</h2><div class="gl-panel"><ul class="gl-list gl-glist">' + gs.map(function (g) {
      return '<li><span>' + scale(g.horizon) + '</span><div class="gl-row-main"><button type="button" class="gl-t" data-gl="edit-goal" data-id="' + g.id + '">' + esc(g.title) + (g.status === "done" ? " ✓" : "") + '</button><span class="gl-meta">' + esc(hz(g.horizon)) + "</span></div><span></span></li>";
    }).join("") + "</ul></div></section>";
    return out;
  }
  function renderBoardsHome() {
    var act = S.boards.filter(function (b) { return !b.archived; }), arch = S.boards.filter(function (b) { return b.archived; });
    var starred = act.filter(function (b) { return b.starred; });
    var recent = act.filter(function (b) { return b.viewed_at; }).sort(function (a, b) { return String(b.viewed_at).localeCompare(String(a.viewed_at)); }).slice(0, 4);
    var html = '<div class="gl-search"><input id="gl-q" class="input" type="search" maxlength="100" autocomplete="off" data-gl-input="q" placeholder="' + esc(t("gl_b_search_ph")) + '" aria-label="' + esc(t("gl_b_search_ph")) + '" value="' + esc(S.q) + '"></div>';
    if (S.q.trim()) return html + searchHtml();
    if (starred.length) html += bsec(t("gl_b_starred"), starred.map(tile).join(""), '<span class="gl-bsi">★</span>');
    if (recent.length) html += bsec(t("gl_b_recent"), recent.map(tile).join(""));
    html += bsec(t("gl_b_mine"), tile(mainBoard()) + act.map(tile).join("") + '<button type="button" class="gl-bnew" data-gl="new-board">+ ' + esc(t("gl_b_new")) + "</button>");
    html += '<section class="gl-bsec"><h2 class="gl-bsh">' + esc(t("gl_b_templates")) + '</h2><p class="gl-meta">' + esc(t("gl_b_tpl_hint")) + '</p><div class="gl-bgrid">' + TPL.map(function (p) {
      return '<button type="button" class="gl-tpl" data-gl="tpl" data-k="' + p[0] + '"><span class="gl-cover gl-c-' + p[1] + '"></span><span class="gl-btitle">' + esc(t("gl_tpl_" + p[0])) + '</span><span class="gl-meta">' + esc(t("gl_tpl_" + p[0] + "_d")) + "</span></button>";
    }).join("") + "</div></section>";
    if (arch.length) html += '<details class="gl-arch"><summary>' + esc(t("gl_b_archive", { n: arch.length })) + '</summary><ul class="gl-list">' + arch.map(function (b) {
      return '<li><i class="gl-sw gl-c-' + esc(b.color) + '"></i><div class="gl-row-main"><button type="button" class="gl-t" data-gl="open-board" data-id="' + b.id + '">' + esc(b.title) + '</button></div><div class="gl-acts"><button type="button" class="btn btn-sm" data-gl="unarchive" data-id="' + b.id + '">' + esc(t("gl_b_restore")) + '</button><button type="button" class="btn btn-sm gl-danger" data-gl="board-delete" data-id="' + b.id + '">' + esc(t("gl_b_delete")) + "</button></div></li>";
    }).join("") + "</ul></details>";
    return html;
  }

  // ---------- Основная доска «Мои задачи» (колонки = статус) ----------
  function card(x, withCheck) {
    var d = today(), ck = x.checklist || [], cd = ck.filter(function (i) { return i.d; }).length;
    return '<article class="gl-card' + (x.col === "done" ? " is-done" : "") + '" draggable="true" data-gl="edit-task" data-id="' + x.id + '" tabindex="0">' +
      (x.focus_date === d ? '<span class="gl-star" title="' + esc(t("gl_focus")) + '">★</span>' : "") +
      '<div class="gl-ctr">' + (withCheck ? checkBtn(x, true) : "") + '<div class="gl-ct">' + esc(x.title) + '</div></div><div class="gl-chips">' + dueChip(x) + goalChip(x) +
      (ck.length ? '<span class="gl-chip">☑ ' + cd + "/" + ck.length + "</span>" : "") + (x.focus_min ? '<span class="gl-chip">' + esc(t("gl_min", { n: x.focus_min })) + "</span>" : "") + "</div></article>";
  }
  function boardHead(b) {
    var g = !b.main && goal(b.goal_id);
    return '<div class="gl-bhead"><button type="button" class="btn btn-sm" data-gl="home">' + esc(t("gl_back")) + '</button><i class="gl-sw lg gl-c-' + esc(b.color) + '"></i><h2 class="gl-bname">' + esc(b.title) + "</h2>" +
      (b.main ? "" : '<button type="button" class="gl-bstar inline' + (b.starred ? " on" : "") + '" data-gl="star" data-id="' + b.id + '" aria-pressed="' + !!b.starred + '" title="' + esc(t(b.starred ? "gl_unstar" : "gl_star")) + '" aria-label="' + esc(t(b.starred ? "gl_unstar" : "gl_star")) + '">★</button>') +
      (g ? '<span class="gl-chip goal">' + esc(g.title) + " · " + progress(g).pct + "%</span>" : "") + '<span class="gl-sp"></span>' +
      (b.main ? '<select id="gl-filter" class="input" data-gl-change="filter" aria-label="' + esc(t("gl_all_goals")) + '"><option value="">' + esc(t("gl_all_goals")) + "</option>" + goalOptions(S.goalFilter) + "</select>" : '<button type="button" class="btn btn-sm" data-gl="edit-board" data-id="' + b.id + '">' + esc(t("gl_board_settings")) + "</button>") +
      '<button type="button" class="btn btn-primary btn-sm" data-gl="new-task" data-col="plan"' + (b.main ? "" : ' data-board="' + b.id + '"') + ">" + esc(t("gl_new_task")) + "</button></div>";
  }
  function renderMainBoard() {
    var gf = S.goalFilter, list = boardCards("main").filter(function (x) { return !gf || x.goal_id === gf; });
    var by = {}; COLS.forEach(function (k) { by[k] = []; });
    list.forEach(function (x) { (by[x.col] || by.inbox).push(x); });
    by.done.sort(function (a, b) { return String(b.done_at || "").localeCompare(String(a.done_at || "")); });
    ["inbox", "plan", "doing"].forEach(function (k) { by[k].sort(byDue); });
    return boardHead(mainBoard()) +
      '<div class="gl-colswitch">' + COLS.map(function (k) { return '<button type="button" data-gl="boardcol" data-c="' + k + '" aria-pressed="' + (S.boardCol === k) + '">' + esc(t("gl_c_" + k)) + " · " + by[k].length + "</button>"; }).join("") + "</div>" +
      '<div class="gl-board">' + COLS.map(function (k) {
        var arr = by[k], shown = k === "done" ? arr.slice(0, 30) : arr;
        return '<section class="gl-col" data-col="' + k + '"' + (S.boardCol === k ? " data-active" : "") + '><div class="gl-colh"><h3>' + esc(t("gl_c_" + k)) + '</h3><span class="gl-meta">' + arr.length + "</span></div>" +
          (k !== "done" ? '<div class="gl-colhint">' + esc(t("gl_h_" + k)) + "</div>" : "") + shown.map(function (x) { return card(x); }).join("") +
          (arr.length > shown.length ? '<span class="gl-meta">' + esc(t("gl_hidden", { n: arr.length - shown.length })) + "</span>" : "") +
          (k !== "done" ? '<button type="button" class="gl-addc" data-gl="new-task" data-col="' + k + '">' + esc(t("gl_add_card")) + "</button>" : "") + "</section>";
      }).join("") + '</div><p class="gl-meta gl-foot">' + esc(t("gl_board_hint")) + "</p>";
  }

  // ---------- Своя доска (свои списки) ----------
  function renderCustomBoard(b) {
    var ls = boardLists(b.id);
    var html = boardHead(b);
    if (b.archived) html += '<div class="gl-banner"><span>' + esc(t("gl_b_in_archive")) + '</span><button type="button" class="btn btn-sm" data-gl="unarchive" data-id="' + b.id + '">' + esc(t("gl_b_restore")) + "</button></div>";
    html += '<div class="gl-lrow">' + ls.map(function (l) {
      var cs = S.tasks.filter(function (x) { return x.list_id === l.id; });
      var open = cs.filter(function (x) { return x.col !== "done"; }).sort(byDue), done = cs.filter(function (x) { return x.col === "done"; }).sort(function (a, z) { return String(z.done_at || "").localeCompare(String(a.done_at || "")); });
      return '<section class="gl-col gl-lcol" data-list="' + l.id + '"><div class="gl-colh"><button type="button" class="gl-lt" data-gl="edit-list" data-id="' + l.id + '" title="' + esc(t("gl_list")) + '">' + esc(l.title) + '</button><span class="gl-meta">' + cs.length + "</span></div>" +
        open.concat(done).map(function (x) { return card(x, true); }).join("") +
        '<form class="gl-addf" data-gl-form="addcard" data-list="' + l.id + '"><input id="gl-ac-' + l.id + '" class="input" maxlength="200" autocomplete="off" placeholder="' + esc(t("gl_add_card_ph")) + '" aria-label="' + esc(t("gl_add_card_ph")) + '"></form></section>';
    }).join("") +
      '<form class="gl-col gl-newlist" data-gl-form="addlist"><input id="gl-al" class="input" maxlength="100" autocomplete="off" placeholder="' + esc(t("gl_add_list_ph")) + '" aria-label="' + esc(t("gl_add_list_ph")) + '"><button type="submit" class="btn btn-sm">' + esc(t("gl_add")) + "</button></form></div>" +
      '<p class="gl-meta gl-foot">' + esc(t("gl_cboard_hint")) + "</p>";
    return html;
  }
  function renderBoards() {
    if (S.board === "main") return renderMainBoard();
    var b = brd(S.board);
    return b ? renderCustomBoard(b) : renderBoardsHome();
  }

  // ---------- Цели ----------
  function progress(g) {
    var linked = S.tasks.filter(function (x) { return x.goal_id === g.id; }), kids = S.goals.filter(function (k) { return k.parent_id === g.id; });
    var dn = linked.filter(function (x) { return x.col === "done"; }).length + kids.filter(function (k) { return k.status === "done"; }).length, total = linked.length + kids.length;
    return { dn: dn, total: total, pct: g.status === "done" ? 100 : total ? Math.round(dn / total * 100) : 0, linked: linked, kids: kids };
  }
  function goalCard(g) {
    var p = progress(g), parent = goal(g.parent_id), d = today(), lower = HZ[HZ.indexOf(g.horizon) + 1];
    var bs = S.boards.filter(function (b) { return b.goal_id === g.id && !b.archived; });
    var dl = "";
    if (g.due) { var n = daysBetween(d, g.due); dl = n < 0 && g.status !== "done" ? '<span class="gl-chip late">' + esc(t("gl_overdue_goal")) + " · " + esc(fmtDay(g.due)) + "</span>" : '<span class="gl-chip">' + esc(t("gl_until", { d: fmtDay(g.due) })) + (g.status !== "done" && n >= 0 ? " · " + esc(t("gl_days_left", { n: n })) : "") + "</span>"; }
    var open = p.linked.filter(function (x) { return x.col !== "done"; }).slice(0, 4);
    return '<article class="gl-goal' + (g.status === "done" ? " is-done" : "") + '"><div class="gl-chips">' + (g.area ? '<span class="gl-chip goal">' + esc(g.area) + "</span>" : "") + dl + "</div>" +
      '<h3 class="gl-gt">' + esc(g.title) + (g.status === "done" ? " ✓" : "") + "</h3>" + (parent ? '<div class="gl-meta">' + esc(t("gl_leads_to", { name: parent.title })) + "</div>" : "") +
      '<div><div class="gl-bar"><span style="width:' + p.pct + '%"></span></div><div class="gl-meta">' + esc(p.total ? t("gl_steps", { d: p.dn, t: p.total, p: p.pct }) : t("gl_no_steps")) + "</div></div>" +
      (g.why || g.strategy ? "<details><summary>" + esc(t("gl_why_strategy")) + "</summary>" + (g.why ? "<h4>" + esc(t("gl_why")) + '</h4><p class="gl-txt">' + esc(g.why) + "</p>" : "") + (g.strategy ? "<h4>" + esc(t("gl_strategy")) + '</h4><p class="gl-txt">' + esc(g.strategy) + "</p>" : "") + "</details>" : "") +
      (p.kids.length ? '<div class="gl-chips">' + p.kids.map(function (k) { return '<span class="gl-chip">' + esc(hz(k.horizon)) + ": " + esc(k.title) + (k.status === "done" ? " ✓" : "") + "</span>"; }).join("") + "</div>" : "") +
      (bs.length ? '<div class="gl-chips">' + bs.map(function (b) { return '<button type="button" class="gl-chip brd" data-gl="open-board" data-id="' + b.id + '"><i class="gl-sw gl-c-' + esc(b.color) + '"></i>' + esc(b.title) + "</button>"; }).join("") + "</div>" : "") +
      (open.length ? '<ul class="gl-list">' + open.map(function (x) { return row(x, true); }).join("") + "</ul>" : "") +
      '<div class="gl-gacts"><button type="button" class="btn btn-sm" data-gl="edit-goal" data-id="' + g.id + '">' + esc(t("gl_edit")) + '</button><button type="button" class="btn btn-sm" data-gl="new-task" data-goal="' + g.id + '" data-col="plan">' + esc(t("gl_add_step")) + "</button>" +
      (lower ? '<button type="button" class="btn btn-sm" data-gl="new-goal" data-h="' + lower + '" data-parent="' + g.id + '">+ ' + esc(t("gl_add_" + lower)) + "</button>" : "") +
      (bs.length ? "" : '<button type="button" class="btn btn-sm" data-gl="new-board" data-goal="' + g.id + '">' + esc(t("gl_board_for_goal")) + "</button>") +
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
  function boardOptions(sel) {
    return '<option value="">' + esc(t("gl_main_board")) + "</option>" + S.boards.filter(function (b) { return !b.archived || b.id === sel; }).map(function (b) { return '<option value="' + b.id + '"' + (b.id === sel ? " selected" : "") + ">" + esc(b.title) + "</option>"; }).join("");
  }
  function fillCols() {
    var bid = $("#glf-board").value, sel = $("#glf-col"), x = S.dlg.x, lab = $("#glf-col-l");
    if (!bid) {
      lab.textContent = t("gl_f_col");
      sel.innerHTML = COLS.map(function (k) { return '<option value="' + k + '"' + ((x.board_id ? "plan" : x.col) === k ? " selected" : "") + ">" + esc(t("gl_c_" + k)) + "</option>"; }).join("");
    } else {
      lab.textContent = t("gl_f_list");
      var ls = boardLists(bid), want = x.board_id === bid ? x.list_id : (S.dlg.list || "");
      sel.innerHTML = ls.map(function (l) { return '<option value="' + l.id + '"' + (l.id === want ? " selected" : "") + ">" + esc(l.title) + "</option>"; }).join("");
    }
    $("#glf-done-w").classList.toggle("hidden", !bid);
  }
  function openTask(id, preset) {
    preset = preset || {};
    var pb = preset.board && brd(preset.board);
    var x = id ? task(id) : { col: preset.col || "inbox", goal_id: preset.goal || (pb && pb.goal_id) || null, due: preset.due || null, title: "", notes: "", checklist: [], board_id: pb ? pb.id : null, list_id: preset.list || null };
    if (!x) return;
    if (!x.list_id && pb) { var l0 = boardLists(pb.id)[0]; x.list_id = l0 ? l0.id : null; }
    var d = dlg(), f = d.querySelector("form");
    S.dlg = { kind: "task", id: id || null, x: x, list: x.list_id, check: (x.checklist || []).map(function (i) { return { t: i.t, d: !!i.d }; }) };
    f.innerHTML = "<h2>" + esc(t(id ? "gl_task" : "gl_task_new")) + "</h2>" +
      '<label class="gl-fld"><span>' + esc(t("gl_f_title")) + '</span><input id="glf-title" class="input" maxlength="200" autocomplete="off" value="' + esc(x.title) + '"></label>' +
      '<div class="gl-fr"><label class="gl-fld"><span>' + esc(t("gl_f_board")) + '</span><select id="glf-board" class="input">' + boardOptions(x.board_id) + "</select></label>" +
      '<label class="gl-fld"><span id="glf-col-l"></span><select id="glf-col" class="input"></select></label></div>' +
      '<div class="gl-fr"><label class="gl-fld"><span>' + esc(t("gl_f_due")) + '</span><input id="glf-due" class="input" type="date" value="' + esc(x.due || "") + '"></label>' +
      '<label class="gl-fld"><span>' + esc(t("gl_f_goal")) + '</span><select id="glf-goal" class="input"><option value="">' + esc(t("gl_f_nogoal")) + "</option>" + goalOptions(x.goal_id) + "</select></label></div>" +
      '<label class="gl-cb" id="glf-done-w"><input type="checkbox" id="glf-done"' + (x.col === "done" ? " checked" : "") + "> " + esc(t("gl_f_done")) + "</label>" +
      '<label class="gl-cb"><input type="checkbox" id="glf-focus"' + (x.focus_date === today() ? " checked" : "") + "> " + esc(t("gl_f_focus")) + "</label>" +
      '<label class="gl-fld"><span>' + esc(t("gl_f_notes")) + '</span><textarea id="glf-notes" class="input" rows="3" maxlength="4000">' + esc(x.notes || "") + "</textarea></label>" +
      '<div class="gl-fld"><span>' + esc(t("gl_f_check")) + '</span><ul id="glf-check" class="gl-cl"></ul><div class="gl-rowf"><input id="glf-cnew" class="input" maxlength="300" autocomplete="off" placeholder="' + esc(t("gl_f_check_ph")) + '"><button type="button" class="btn btn-sm" data-gd="check-add">' + esc(t("gl_add")) + "</button></div></div>" +
      (x.focus_min ? '<p class="gl-meta">' + esc(t("gl_f_total", { n: x.focus_min })) + "</p>" : "") +
      '<div class="gl-dacts">' + (id ? '<button type="button" class="btn gl-danger" data-gd="delete">' + esc(t("gl_delete")) + "</button>" : "") + (id && x.due ? '<button type="button" class="btn" data-gd="ics">' + esc(t("gl_ics_btn")) + "</button>" : "") +
      '<span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_cancel")) + '</button><button type="submit" class="btn btn-primary">' + esc(t("gl_save")) + '</button></div><p class="gl-msg" id="glf-msg"></p>';
    fillCols(); renderCheck(); d.showModal();
    if (!id) setTimeout(function () { var i = document.getElementById("glf-title"); if (i) i.focus(); }, 30);
  }
  function renderCheck() {
    var ul = document.getElementById("glf-check"); if (!ul) return;
    ul.innerHTML = S.dlg.check.map(function (i, k) { return '<li class="' + (i.d ? "d" : "") + '"><input type="checkbox" data-ci="' + k + '"' + (i.d ? " checked" : "") + '><span>' + esc(i.t) + '</span><button type="button" class="gl-x" data-gd="check-del" data-ci="' + k + '" aria-label="' + esc(t("gl_delete")) + '">✕</button></li>'; }).join("");
  }
  function err(msg) { var m = $("#glf-msg"); m.textContent = msg; m.className = "gl-msg err"; }
  async function submitTask(d) {
    var title = $("#glf-title").value.trim(), day = today();
    if (!title) { err(t("gl_need_title")); return; }
    var id = S.dlg.id, old = id ? task(id) : null, wantFocus = $("#glf-focus").checked, bid = $("#glf-board").value || null, cv = $("#glf-col").value;
    if (bid && !cv) { err(t("gl_no_lists")); return; }
    var pend = $("#glf-cnew").value.trim(); if (pend) S.dlg.check.push({ t: pend.slice(0, 300), d: false });
    var row0 = { title: title, due: $("#glf-due").value || null, goal_id: $("#glf-goal").value || null, notes: $("#glf-notes").value.trim() || null, checklist: S.dlg.check };
    if (bid) { row0.board_id = bid; row0.list_id = cv; row0.col = $("#glf-done").checked ? "done" : (old && old.board_id && old.col !== "done" ? old.col : "plan"); }
    else { row0.board_id = null; row0.list_id = null; row0.col = cv; }
    if (wantFocus && (!old || old.focus_date !== day)) {
      if (focusList(day).filter(function (y) { return y.id !== id; }).length >= FOCUS_MAX) { err(t("gl_e_focus_full")); return; }
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
    var title = $("#glg-title").value.trim();
    if (!title) { err(t("gl_g_need")); return; }
    var row0 = { title: title, horizon: $("#glg-h").value, due: $("#glg-due").value || null, area: $("#glg-area").value || null, parent_id: $("#glg-parent").value || null, why: $("#glg-why").value.trim() || null, strategy: $("#glg-strategy").value.trim() || null };
    var r = await saveGoal(S.dlg.id, row0);
    if (r) d.close();
  }
  function openBoardDlg(id, preset) {
    preset = preset || {};
    var b = id ? brd(id) : { title: preset.tpl ? t("gl_tpl_" + preset.tpl) : "", color: preset.color || "blue", goal_id: preset.goal || null };
    if (!b) return;
    var d = dlg(), f = d.querySelector("form");
    S.dlg = { kind: "board", id: id || null };
    f.innerHTML = "<h2>" + esc(t(id ? "gl_board" : "gl_board_new")) + "</h2>" +
      '<label class="gl-fld"><span>' + esc(t("gl_b_title")) + '</span><input id="glb-title" class="input" maxlength="100" autocomplete="off" placeholder="' + esc(t("gl_b_title_ph")) + '" value="' + esc(b.title) + '"></label>' +
      '<fieldset class="gl-fld gl-colors"><legend>' + esc(t("gl_b_color")) + "</legend><div>" + COLORS.map(function (k) { return '<label class="gl-swl"><input type="radio" name="glb-color" value="' + k + '"' + (b.color === k ? " checked" : "") + '><i class="gl-sw lg gl-c-' + k + '"></i><span class="sr-only">' + k + "</span></label>"; }).join("") + "</div></fieldset>" +
      '<label class="gl-fld"><span>' + esc(t("gl_b_goal")) + '</span><select id="glb-goal" class="input"><option value="">' + esc(t("gl_f_nogoal")) + "</option>" + goalOptions(b.goal_id) + "</select></label>" +
      (id ? "" : '<label class="gl-fld"><span>' + esc(t("gl_b_tpl")) + '</span><select id="glb-tpl" class="input"><option value="">' + esc(t("gl_b_tpl_empty")) + "</option>" + TPL.map(function (p) { return '<option value="' + p[0] + '"' + (preset.tpl === p[0] ? " selected" : "") + ">" + esc(t("gl_tpl_" + p[0])) + " — " + esc(t("gl_tpl_" + p[0] + "_lists").split("|").join(" · ")) + "</option>"; }).join("") + "</select></label>") +
      '<div class="gl-dacts">' + (id ? (b.archived ? '<button type="button" class="btn" data-gd="board-unarchive">' + esc(t("gl_b_restore")) + '</button><button type="button" class="btn gl-danger" data-gd="board-delete">' + esc(t("gl_b_delete")) + "</button>" : '<button type="button" class="btn" data-gd="board-archive">' + esc(t("gl_b_archive_btn")) + "</button>") : "") +
      '<span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_cancel")) + '</button><button type="submit" class="btn btn-primary">' + esc(t(id ? "gl_save" : "gl_b_create")) + '</button></div><p class="gl-msg" id="glf-msg"></p>';
    d.showModal();
    if (!id) setTimeout(function () { var i = document.getElementById("glb-title"); if (i) { i.focus(); i.select(); } }, 30);
  }
  async function submitBoard(d) {
    var title = $("#glb-title").value.trim();
    if (!title) { err(t("gl_b_need")); return; }
    var ck = d.querySelector('input[name="glb-color"]:checked');
    var row0 = { title: title, color: ck ? ck.value : "blue", goal_id: $("#glb-goal").value || null };
    if (S.dlg.id) { var r = await saveBoard(S.dlg.id, row0); if (r) d.close(); return; }
    var tpl = $("#glb-tpl").value || null;
    d.close();
    await createBoard(row0, tpl);
  }
  function openListDlg(id) {
    var l = lst(id); if (!l) return;
    var ls = boardLists(l.board_id), i = ls.indexOf(l), n = S.tasks.filter(function (x) { return x.list_id === id; }).length;
    var d = dlg(), f = d.querySelector("form");
    S.dlg = { kind: "list", id: id };
    f.innerHTML = "<h2>" + esc(t("gl_list")) + "</h2>" +
      '<label class="gl-fld"><span>' + esc(t("gl_list_title")) + '</span><input id="gll-title" class="input" maxlength="100" autocomplete="off" value="' + esc(l.title) + '"></label>' +
      '<div class="gl-rowf"><button type="button" class="btn btn-sm" data-gd="list-left"' + (i <= 0 ? " disabled" : "") + ">" + esc(t("gl_list_left")) + '</button><button type="button" class="btn btn-sm" data-gd="list-right"' + (i >= ls.length - 1 ? " disabled" : "") + ">" + esc(t("gl_list_right")) + "</button></div>" +
      (n ? '<p class="gl-meta">' + esc(t("gl_list_nonempty")) + "</p>" : "") +
      '<div class="gl-dacts"><button type="button" class="btn gl-danger" data-gd="list-delete"' + (n ? " disabled" : "") + ">" + esc(t("gl_list_delete")) + '</button><span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_cancel")) + '</button><button type="submit" class="btn btn-primary">' + esc(t("gl_save")) + '</button></div><p class="gl-msg" id="glf-msg"></p>';
    d.showModal();
  }
  async function submitList(d) {
    var title = $("#gll-title").value.trim();
    if (!title) { err(t("gl_b_need")); return; }
    var r = await saveRow("my_lists", "lists", S.dlg.id, { title: title });
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
      groups.map(function (g) { return g[1].length ? '<div class="gl-pg"><h4>' + esc(g[0]) + "</h4>" + g[1].sort(byDue).map(function (x) { return '<button type="button" class="gl-pick" data-gd="pick" data-id="' + x.id + '"><b>' + esc(x.title) + "</b>" + chain(x.goal_id) + (boardChip(x) ? '<span class="gl-chips">' + boardChip(x) + "</span>" : "") + "</button>"; }).join("") + "</div>" : ""; }).join("") +
      (open.length ? "" : '<p class="gl-meta">' + esc(t("gl_pick_none")) + "</p>") +
      '<div class="gl-dacts"><span class="gl-sp"></span><button type="button" class="btn" data-gd="cancel">' + esc(t("gl_close")) + "</button></div>";
    d.showModal();
  }
  function armed(b, text) { if (b.hasAttribute("data-armed")) return true; b.setAttribute("data-armed", "1"); b.textContent = text; return false; }
  function bindDialog(d) {
    var f = d.querySelector("form");
    f.addEventListener("submit", async function (e) {
      e.preventDefault(); if (!S.dlg) return;
      if (S.dlg.kind === "task") return submitTask(d);
      if (S.dlg.kind === "goal") return submitGoal(d);
      if (S.dlg.kind === "board") return submitBoard(d);
      if (S.dlg.kind === "list") return submitList(d);
      if (S.dlg.kind === "pick") {
        var v = $("#glp-new").value.trim(); if (!v) return;
        var day = today(), max = 0; focusList(day).forEach(function (y) { max = Math.max(max, y.focus_order || 0); });
        d.close(); await saveTask(null, { title: v.slice(0, 200), col: "plan", focus_date: day, focus_order: max + 1 });
      }
    });
    f.addEventListener("click", async function (e) {
      var b = e.target.closest("[data-gd]"); if (!b || !S.dlg) return;
      var a = b.getAttribute("data-gd"), id = S.dlg.id;
      if (a === "cancel") d.close();
      else if (a === "pick") { var r = await setFocus(b.getAttribute("data-id")); if (r) d.close(); }
      else if (a === "check-add") { var i = $("#glf-cnew"), v = i.value.trim(); if (v && S.dlg.check.length < 50) { S.dlg.check.push({ t: v.slice(0, 300), d: false }); i.value = ""; renderCheck(); i.focus(); } }
      else if (a === "check-del") { S.dlg.check.splice(Number(b.getAttribute("data-ci")), 1); renderCheck(); }
      else if (a === "ics") { var x = task(id); if (x && x.due) icsDeadline(x.title, x.due, x.notes || ""); }
      else if (a === "delete") { if (!armed(b, t("gl_delete_sure"))) return; d.close(); if (S.dlg.kind === "goal") deleteGoal(id); else deleteTask(id); }
      else if (a === "board-archive") { d.close(); if (await saveBoard(id, { archived: true, starred: false }, true)) { S.board = null; render(); toast(t("gl_b_archived")); } }
      else if (a === "board-unarchive") { d.close(); saveBoard(id, { archived: false }); }
      else if (a === "board-delete") { if (!armed(b, t("gl_b_delete_sure"))) return; d.close(); deleteBoard(id); }
      else if (a === "list-left" || a === "list-right") { await moveList(id, a === "list-left" ? -1 : 1); openListDlg(id); }
      else if (a === "list-delete") { if (!armed(b, t("gl_delete_sure"))) return; d.close(); deleteList(id); }
    });
    f.addEventListener("change", function (e) {
      var el = e.target;
      if (el.hasAttribute("data-ci") && el.type === "checkbox") { S.dlg.check[Number(el.getAttribute("data-ci"))].d = el.checked; renderCheck(); }
      if (el.id === "glg-h") fillParent($("#glg-parent").value);
      if (el.id === "glf-board") { S.dlg.list = null; fillCols(); }
    });
    f.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "glf-cnew") { e.preventDefault(); var b = f.querySelector('[data-gd="check-add"]'); if (b) b.click(); } });
  }

  // ---------- Главная платформы: «Фокус дня» ----------
  function homeRender() {
    var el = document.getElementById("home-focus"); if (!el) return;
    if (S.missing || !S.loaded || !state.me) { el.innerHTML = ""; return; }
    var f = focusList(today()).slice(0, FOCUS_MAX), dn = f.filter(function (x) { return x.col === "done"; }).length;
    el.innerHTML = '<section class="gl-home" aria-labelledby="gl-home-h"><div class="gl-ph"><h2 id="gl-home-h" class="home-h"><span class="gl-bsi">★</span>' + esc(t("gl_home_title")) + "</h2>" +
      (f.length ? '<span class="gl-meta">' + esc(t("gl_focus_done", { n: dn, m: Math.max(f.length, FOCUS_MAX) })) + "</span>" : "") + "</div>" +
      (f.length ? '<ul class="gl-list">' + f.map(function (x) { return "<li>" + checkBtn(x) + '<div class="gl-row-main"><span class="gl-t' + (x.col === "done" ? " is-done" : "") + '">' + esc(x.title) + "</span>" + chain(x.goal_id) + "</div><span></span></li>"; }).join("") + "</ul>" : '<p class="gl-empty">' + esc(t("gl_home_empty")) + "</p>") +
      '<div><button type="button" class="btn btn-sm" data-go-tab="goals">' + esc(t(f.length ? "gl_home_open" : "gl_home_pick")) + "</button></div></section>";
  }
  var homeBound = false;
  async function home() {
    var el = document.getElementById("home-focus"); if (!el || !db() || !state.me) return;
    if (!homeBound) {
      homeBound = true;
      el.addEventListener("click", function (e) { var b = e.target.closest('[data-gl="done"]'); if (b) toggleDone(b.getAttribute("data-id")); });
    }
    if (state.me.id !== S.uid) { S.uid = state.me.id; S.loaded = false; S.goals = []; S.tasks = []; S.boards = []; S.lists = []; S.days = {}; }
    homeRender();
    if (!S.loading) await load();
  }

  // ---------- отрисовка и события ----------
  var VIEWS = ["today", "boards", "goals", "calendar"];
  function render() {
    homeRender();
    var nav = $("#gl-nav"), body = $("#gl-body"); if (!nav || !body || state.tab !== "goals") return;
    nav.innerHTML = VIEWS.map(function (v) { return '<button type="button" class="gl-tab" data-gl="view" data-v="' + v + '" aria-pressed="' + (S.view === v) + '">' + esc(t("gl_v_" + v)) + "</button>"; }).join("");
    var ae = document.activeElement, keep = null;
    if (ae && ae.id && body.contains(ae) && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) keep = { id: ae.id, v: ae.value };
    if (S.missing) body.innerHTML = '<p class="state-box">' + esc(t("gl_missing")) + "</p>";
    else if (!S.loaded) body.innerHTML = '<p class="state-box">' + esc(t("loading")) + "</p>";
    else body.innerHTML = S.view === "boards" ? renderBoards() : S.view === "goals" ? renderGoals() : S.view === "calendar" ? renderCal() : renderToday();
    if (keep) { var el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus(); } }
  }
  function bind() {
    if (S.bound) return; S.bound = true;
    var root = $("#tab-goals"); if (!root) return;
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gl]"); if (!b || !root.contains(b)) return;
      var a = b.getAttribute("data-gl"), id = b.getAttribute("data-id"), x;
      if (a === "view") { var v = b.getAttribute("data-v"); if (v === "boards" && S.view === "boards") S.board = null; S.view = v; render(); }
      else if (a === "pick") openPicker();
      else if (a === "done") toggleDone(id);
      else if (a === "focus") setFocus(id).then(function (r) { if (r) toast(t("gl_focused")); });
      else if (a === "unfocus") saveTask(id, { focus_date: null });
      else if (a === "timer-task") { if (T.running && T.taskId !== id) { T.left = remaining(); T.running = false; } T.taskId = id; saveTimer(); timerStart(); }
      else if (a === "preset") { T.dur = Number(b.getAttribute("data-m")); T.left = T.dur * 60; saveTimer(); render(); }
      else if (a === "timer") { if (T.running) timerPause(); else timerStart(); }
      else if (a === "timer-finish") timerDone(Math.floor((T.dur * 60 - remaining()) / 60), true);
      else if (a === "edit-task") openTask(id);
      else if (a === "new-task") openTask(null, { col: b.getAttribute("data-col"), goal: b.getAttribute("data-goal") || (S.board === "main" ? S.goalFilter : "") || null, due: b.getAttribute("data-due"), board: b.getAttribute("data-board") });
      else if (a === "edit-goal") openGoal(id);
      else if (a === "new-goal") openGoal(null, { h: b.getAttribute("data-h"), parent: b.getAttribute("data-parent") });
      else if (a === "goal-done") { var g = goal(id); if (g) saveGoal(id, { status: g.status === "done" ? "active" : "done" }); }
      else if (a === "ics-goal") { var gg = goal(id); if (gg && gg.due) icsDeadline(t("gl_hz_" + gg.horizon) + ": " + gg.title, gg.due, [gg.why, gg.strategy].filter(Boolean).join("\n\n")); }
      else if (a === "boardcol") { S.boardCol = b.getAttribute("data-c"); render(); }
      else if (a === "home") { S.board = null; render(); }
      else if (a === "open-board") openBoard(id);
      else if (a === "new-board") openBoardDlg(null, { goal: b.getAttribute("data-goal") });
      else if (a === "tpl") { var k = b.getAttribute("data-k"), p = TPL.filter(function (z) { return z[0] === k; })[0]; openBoardDlg(null, { tpl: k, color: p && p[1] }); }
      else if (a === "edit-board") openBoardDlg(id);
      else if (a === "star") { x = brd(id); if (x) saveBoard(id, { starred: !x.starred }); }
      else if (a === "unarchive") saveBoard(id, { archived: false });
      else if (a === "board-delete") { if (armed(b, t("gl_b_delete_sure"))) deleteBoard(id); }
      else if (a === "edit-list") openListDlg(id);
      else if (a === "calday") { S.calSel = b.getAttribute("data-d"); var dd = parseYmd(S.calSel); if (dd.getMonth() !== S.calMonth.getMonth()) S.calMonth = new Date(dd.getFullYear(), dd.getMonth(), 1); render(); }
      else if (a === "calprev" || a === "calnext") { S.calMonth = new Date(S.calMonth.getFullYear(), S.calMonth.getMonth() + (a === "calprev" ? -1 : 1), 1); render(); }
      else if (a === "caltoday") { var n = new Date(); S.calMonth = new Date(n.getFullYear(), n.getMonth(), 1); S.calSel = today(); render(); }
      else if (a === "ics-daily") icsDaily();
    });
    root.addEventListener("change", function (e) { if (e.target.getAttribute("data-gl-change") === "filter") { S.goalFilter = e.target.value; render(); } });
    root.addEventListener("input", function (e) { if (e.target.getAttribute("data-gl-input") === "q") { S.q = e.target.value; render(); } });
    root.addEventListener("submit", function (e) {
      var kind = e.target.getAttribute("data-gl-form"); if (!kind) return; e.preventDefault();
      var i = e.target.querySelector("input"), v = i.value.trim(); if (!v) return; i.value = "";
      if (kind === "quick") saveTask(null, { title: v.slice(0, 200), col: "inbox" }).then(function (r) { if (r) toast(t("gl_quick_ok")); });
      else if (kind === "addcard") { var l = lst(e.target.getAttribute("data-list")), b = l && brd(l.board_id); if (l) saveTask(null, { title: v.slice(0, 200), col: "plan", board_id: l.board_id, list_id: l.id, goal_id: (b && b.goal_id) || null }); }
      else if (kind === "addlist" && S.board && S.board !== "main") addList(S.board, v);
    });
    root.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.classList && e.target.classList.contains("gl-card")) { e.preventDefault(); openTask(e.target.getAttribute("data-id")); } });
    function dropZone(e) { return e.target.closest && e.target.closest(".gl-col[data-col], .gl-col[data-list]"); }
    root.addEventListener("dragstart", function (e) { var k = e.target.closest && e.target.closest(".gl-card"); if (!k) return; e.dataTransfer.setData("text/plain", k.getAttribute("data-id")); e.dataTransfer.effectAllowed = "move"; k.classList.add("dragging"); });
    root.addEventListener("dragend", function (e) { var k = e.target.closest && e.target.closest(".gl-card"); if (k) k.classList.remove("dragging"); root.querySelectorAll(".gl-col.over").forEach(function (z) { z.classList.remove("over"); }); });
    root.addEventListener("dragover", function (e) { var col = dropZone(e); if (!col) return; e.preventDefault(); root.querySelectorAll(".gl-col.over").forEach(function (z) { if (z !== col) z.classList.remove("over"); }); col.classList.add("over"); });
    root.addEventListener("drop", function (e) {
      var col = dropZone(e); if (!col) return; e.preventDefault(); col.classList.remove("over");
      var id = e.dataTransfer.getData("text/plain"), x = task(id), lid = col.getAttribute("data-list"); if (!x) return;
      if (lid) { var l = lst(lid); if (l && x.list_id !== lid) saveTask(id, { board_id: l.board_id, list_id: lid }); }
      else if (x.col !== col.getAttribute("data-col")) setCol(id, col.getAttribute("data-col"));
    });
  }

  function open() {
    bind();
    var uid = state.me && state.me.id;
    if (uid !== S.uid) { S.uid = uid; S.loaded = false; S.goals = []; S.tasks = []; S.boards = []; S.lists = []; S.days = {}; S.board = null; }   // другой человек на том же устройстве
    render();
    if (!S.loading) load();
  }

  U.goals = { open: open, home: home, rerender: render };
})(window.ULA);
