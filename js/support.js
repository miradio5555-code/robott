// =====================================================
// ULA FACTORY — техподдержка: живой чат байера с админом и уведомления в Telegram.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js.
//
// Чат работает как мессенджер:
//   • новые сообщения и «прочитано» приходят сразу (Supabase Realtime, файл 39);
//     если Realtime недоступен — проверяем каждые 4 секунды, пока чат открыт;
//   • своё сообщение появляется сразу, не дожидаясь базы (часики → ✓ → ✓✓ прочитано);
//   • «печатает…» и «в сети» — через каналы Realtime, без записи в базу;
//   • у байера в шапке — имя и фото админа (support_agent, файл 39).
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, handleError = c.handleError,
      locale = c.locale, openModal = c.openModal, fmtTime = c.fmtTime, state = c.state, APP_VERSION = c.APP_VERSION;

  var support = {
    user: null,        // админ смотрит переписку этого байера; null — байер смотрит свою
    info: null,        // строка байера из списка обращений (для шапки у админа)
    msgs: [],          // сообщения открытой переписки
    pending: [],       // ещё отправляются (или не отправились)
    shown: {},         // уже показанные сообщения — новые появляются с анимацией
    threads: [], unread: -1, timer: null, fastTimer: null, errors: [],
    agent: null, agentLoaded: false,
    live: false, dbCh: null, onlineCh: null, typingCh: null,
    adminOnline: false, typingUntil: 0, typingTimer: null, typingSentAt: 0,
    readTimer: null, threadsTimer: null, unreadTimer: null,
    draft: [],         // выбранные, но ещё не отправленные файлы
    urls: {},          // подписанные ссылки на файлы: путь → { url, until }
    noFiles: false     // файл 40 ещё не запущен — скрепку не показываем
  };
  var BRAND = '<img src="img/mark-dark.svg?r=8" alt="">';   // знак ULA Factory (тёмная плитка)
  var BUCKET = "support-files", MAX_FILES = 6, MAX_SIZE = 20 * 1024 * 1024;
  var OK_TYPES = /^(image\/(jpeg|png|webp|gif|heic|heif)|video\/(mp4|quicktime|webm)|application\/pdf|text\/(plain|csv)|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|vnd\.ms-excel))$/;

  // Запоминаем последние ошибки на странице — их увидит поддержка
  function rememberError(msg) {
    support.errors.push(new Date().toTimeString().slice(0, 8) + " " + String(msg).slice(0, 300));
    if (support.errors.length > 5) support.errors.shift();
  }
  window.addEventListener("error", function (e) { rememberError(e.message || "error"); });
  window.addEventListener("unhandledrejection", function (e) {
    rememberError((e.reason && e.reason.message) || e.reason || "promise error");
  });

  // Технические данные к сообщению: без паролей и без данных клиентов
  function supportMeta() {
    return {
      version: APP_VERSION,
      section: state.tab,
      workspace: state.ws ? state.ws.name : null,
      lang: getLang(),
      screen: window.innerWidth + "x" + window.innerHeight,
      browser: navigator.userAgent.slice(0, 300),
      errors: support.errors.slice()
    };
  }

  function isAdmin() { return !!(state.me && state.me.role === "admin"); }
  function isOpen() { return $("#modal-support").classList.contains("open"); }
  function owner() { return support.user || (state.me && state.me.id); }   // чья переписка открыта

  function avatarUrl(path) { return c.db().storage.from("avatars").getPublicUrl(path).data.publicUrl; }
  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((p[0] || "?").charAt(0) + (p[1] ? p[1].charAt(0) : "")).toUpperCase();
  }
  function avaHtml(name, path) {
    return path ? '<img src="' + esc(avatarUrl(path)) + '" alt="">' : esc(initials(name));
  }

  // ---------- Профиль поддержки (админ) для байера ----------
  async function loadAgent() {
    if (support.agentLoaded) return;
    var r = await c.db().rpc("support_agent");
    support.agentLoaded = true;
    if (!r.error && r.data && r.data[0]) support.agent = r.data[0];   // файл 39 не запущен — просто без фото
  }

  // Шапка чата: фото, имя и строка состояния («в сети», «печатает…»)
  function renderHead() {
    var admin = !!support.user, info = support.info || {}, a = support.agent || {};
    var name = admin ? info.full_name || info.email || "—" : a.full_name || t("support_title");
    var ava = $("#support-ava");
    // без фото у поддержки — знак ULA Factory
    ava.classList.toggle("sp-brand", !admin && !a.avatar_path);
    ava.innerHTML = admin ? avaHtml(name, null) : a.avatar_path ? avaHtml(name, a.avatar_path) : BRAND;
    $("#support-title").textContent = name;
    var sub = $("#support-sub"), typing = Date.now() < support.typingUntil;
    sub.classList.toggle("on", typing || (!admin && support.adminOnline));
    if (typing) sub.innerHTML = esc(t("sp_typing")) + '<i class="sp-dots"><b></b><b></b><b></b></i>';
    else if (admin) sub.textContent = [info.ws_name, info.phone, info.email].filter(Boolean).join(" · ");
    else sub.textContent = support.adminOnline ? t("sp_online") : t("sp_team");
  }

  // userId = null — байер открывает свою переписку; иначе админ открывает переписку байера
  function openSupport(userId, info) {
    var same = support.user === userId && support.msgs.length;
    support.user = userId;
    support.info = info || null;
    support.typingUntil = 0;
    if (!same) { support.msgs = []; support.pending = []; support.shown = {}; clearDraft(); }
    $("#support-note").textContent = userId ? "" : t("support_note");
    renderHead();
    if (!same) $("#support-log").innerHTML = '<div class="sp-loading"><i class="sp-dots"><b></b><b></b><b></b></i></div>';
    else renderLog(true);
    openModal("modal-support");
    fitScreen();
    if (!userId) loadAgent().then(renderHead);
    joinTyping();
    loadSupportLog(true);
    // на телефоне клавиатура не выскакивает сама — сначала видно переписку
    if (window.matchMedia("(pointer: fine)").matches) setTimeout(function () { $("#support-text").focus(); }, 60);
  }

  async function loadSupportLog(scroll) {
    var who = owner();
    if (!who) return;
    var cols = "id, user_id, from_admin, body, meta, read_at, created_at" + (support.noFiles ? "" : ", files");
    var res = await c.db().from("support_messages").select(cols)
      .eq("user_id", who)
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error && !support.noFiles && /files/.test(res.error.message || "")) {
      support.noFiles = true;   // файл 40 ещё не запущен — чат работает без файлов
      $("#support-attach").classList.add("hidden");
      return loadSupportLog(scroll);
    }
    if (who !== owner()) return;   // пока грузилось, открыли другую переписку
    if (res.error) { handleError(res.error); return; }
    var first = !support.msgs.length;
    support.msgs = (res.data || []).reverse();
    if (first) support.msgs.forEach(function (m) { support.shown[m.id] = 1; });   // при открытии — без анимации
    renderLog(scroll);
    markRead();
  }

  // Прочитали — убрать красную цифру (не чаще раза в секунду)
  function markRead() {
    clearTimeout(support.readTimer);
    support.readTimer = setTimeout(async function () {
      if (!isOpen() || document.hidden) return;
      var mine = !!support.user;   // у админа непрочитанные — от байера, у байера — от админа
      var has = support.msgs.some(function (m) { return !m.read_at && m.from_admin !== mine; });
      if (!has) return;
      var r = await c.db().rpc("support_mark_read", { p_user: support.user });
      if (!r.error) {
        support.msgs.forEach(function (m) { if (m.from_admin !== mine && !m.read_at) m.read_at = new Date().toISOString(); });
        checkUnreadSoon();
        if (support.user) threadsSoon();
      }
    }, 400);
  }

  function dayLabel(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var day = new Date(d); day.setHours(0, 0, 0, 0);
    var diff = Math.round((today - day) / 864e5);
    if (diff === 0) return t("sp_today");
    if (diff === 1) return t("sp_yesterday");
    return day.toLocaleDateString(locale(), { day: "numeric", month: "long", year: day.getFullYear() === today.getFullYear() ? undefined : "numeric" });
  }
  function hhmm(d) { return new Date(d).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" }); }

  function renderLog(scroll) {
    var admin = !!support.user, log = $("#support-log");
    var nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    var all = support.msgs.concat(support.pending);
    $("#support-note").classList.toggle("hidden", all.length > 0);   // подсказку о тех. данных — только в пустом чате
    if (!all.length) {
      var a = support.agent || {};
      log.innerHTML = admin ? '<p class="sp-empty muted">' + esc(t("support_none")) + "</p>" :
        '<div class="sp-hello"><span class="sp-ava sp-ava-lg' + (a.avatar_path ? "" : " sp-brand") + '">' + (a.avatar_path ? avaHtml(a.full_name, a.avatar_path) : BRAND) + "</span>" +
        "<b>" + esc(a.full_name || t("support_title")) + "</b><p>" + esc(t("support_empty")) + "</p></div>";
      return;
    }
    var html = "", lastDay = "";
    all.forEach(function (m, i) {
      var day = dayLabel(m.created_at);
      if (day !== lastDay) { html += '<div class="sp-day"><span>' + esc(day) + "</span></div>"; lastDay = day; }
      var mine = admin ? m.from_admin : !m.from_admin;
      var next = all[i + 1], prev = all[i - 1];
      var tail = !next || next.from_admin !== m.from_admin || dayLabel(next.created_at) !== day;   // последнее в группе
      var head = !prev || prev.from_admin !== m.from_admin || dayLabel(prev.created_at) !== day;   // первое в группе — с «хвостиком», как в WhatsApp
      var key = m.id || m.tmp, fresh = !support.shown[key];
      support.shown[key] = 1;
      var tick = "";
      if (mine) {
        tick = m.failed ? '<i class="sp-tick fail">!</i>'
          : m.tmp ? '<i class="sp-tick wait"></i>'
          : '<i class="sp-tick' + (m.read_at ? " read" : "") + '">' + U.icon("check", 13) + (m.read_at ? U.icon("check", 13) : "") + "</i>";
      }
      var tech = admin && !m.from_admin && m.meta && Object.keys(m.meta).length
        ? '<details class="support-tech"><summary>' + esc(t("support_tech")) + "</summary><pre>" + esc(JSON.stringify(m.meta, null, 2)) + "</pre></details>"
        : "";
      html += '<div class="sp-row ' + (mine ? "mine" : "theirs") + (head ? " head" : "") + (tail ? " tail" : "") + (fresh ? " sp-new" : "") + '"' +
        (m.failed ? ' data-retry="' + esc(m.tmp) + '" title="' + esc(t("sp_retry")) + '"' : "") + ">" +
        '<div class="sp-bubble' + (filesOf(m).length ? " has-files" : "") + (m.body ? "" : " no-text") + '">' + filesHtml(m) + esc(m.body) +
        '<span class="sp-meta">' + esc(hhmm(m.created_at)) + tick + "</span>" + tech + "</div></div>";
    });
    if (Date.now() < support.typingUntil) {
      html += '<div class="sp-row theirs head tail sp-typing-row' + ($("#support-log .sp-typing-row") ? "" : " sp-new") + '">' +
        '<div class="sp-bubble sp-typing"><i class="sp-dots"><b></b><b></b><b></b></i></div></div>';
    }
    log.innerHTML = html;
    if (scroll || nearBottom) {
      log.scrollTop = log.scrollHeight;
      // фото догружаются позже и удлиняют переписку — остаться внизу
      Array.prototype.forEach.call(log.querySelectorAll("img"), function (img) {
        if (!img.complete) img.addEventListener("load", function () { log.scrollTop = log.scrollHeight; }, { once: true });
      });
    }
    signMissing();
  }

  // ---------- Файлы: показ в сообщении ----------
  function filesOf(m) { return Array.isArray(m.files) ? m.files : []; }
  function isImg(f) { return /^image\//.test(f.type || "") && !/hei[cf]/.test(f.type); }
  function isVideo(f) { return /^video\//.test(f.type || ""); }
  function fileUrl(f) {
    if (f.local) return f.local;
    var u = support.urls[f.path];
    return u && u.until > Date.now() ? u.url : "";
  }
  function sizeStr(n) {
    n = Number(n) || 0;
    return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".0", "") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  }
  function extOf(name) { var m = /\.([A-Za-z0-9]{1,5})$/.exec(name || ""); return m ? m[1].toUpperCase() : "FILE"; }

  function filesHtml(m) {
    var list = filesOf(m);
    if (!list.length) return "";
    var key = esc(m.id || m.tmp);
    var imgs = list.filter(isImg), other = list.filter(function (f) { return !isImg(f); });
    var h = "";
    if (imgs.length) {
      h += '<div class="sp-imgs n' + Math.min(imgs.length, 4) + '">' + imgs.map(function (f, i) {
        var u = fileUrl(f), more = i === 3 && imgs.length > 4 ? '<b class="sp-more">+' + (imgs.length - 4) + "</b>" : "";
        if (i > 3) return "";
        return '<button type="button" class="sp-img" data-img="' + key + '" data-i="' + i + '">' +
          (u ? '<img src="' + esc(u) + '" alt="' + esc(f.name) + '" loading="lazy">' : '<i class="sp-img-wait"></i>') +
          (m.tmp && !m.failed ? '<i class="sp-up"></i>' : "") + more + "</button>";
      }).join("") + "</div>";
    }
    other.forEach(function (f) {
      var u = fileUrl(f), vid = isVideo(f);
      if (vid && u) { h += '<video class="sp-video" src="' + esc(u) + '" controls playsinline preload="metadata"></video>'; return; }
      h += '<a class="sp-file' + (u ? "" : " wait") + '"' + (u ? ' href="' + esc(u) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '"' : "") + ">" +
        '<span class="sp-file-ico">' + esc(extOf(f.name)) + "</span>" +
        '<span class="sp-file-t"><b>' + esc(f.name) + "</b><small>" + esc(sizeStr(f.size)) + "</small></span>" +
        (m.tmp && !m.failed ? '<i class="sp-up"></i>' : U.icon("download", 18)) + "</a>";
    });
    return h;
  }

  // Подписанные ссылки на файлы (хранилище закрытое): на 2 часа, все сразу одним запросом
  var signing = false;
  async function signMissing() {
    if (signing) return;
    var need = [];
    support.msgs.forEach(function (m) {
      filesOf(m).forEach(function (f) { if (f.path && !fileUrl(f) && need.indexOf(f.path) < 0) need.push(f.path); });
    });
    if (!need.length) return;
    signing = true;
    var r = await c.db().storage.from(BUCKET).createSignedUrls(need, 7200);
    signing = false;
    if (r.error || !r.data) return;
    var until = Date.now() + 7000 * 1000;
    r.data.forEach(function (x) { if (x.signedUrl && x.path) support.urls[x.path] = { url: x.signedUrl, until: until }; });
    if (isOpen()) renderLog(false);
  }

  // ---------- Файлы: выбор, вставка скриншота, перетаскивание ----------
  function addFiles(list) {
    var bad = 0, big = 0;
    Array.prototype.forEach.call(list || [], function (file) {
      if (support.draft.length >= MAX_FILES) { toast(t("sp_too_many_files"), "error"); return; }
      var type = file.type || "";
      if (!OK_TYPES.test(type)) { bad++; return; }
      if (file.size > MAX_SIZE && !/^image\//.test(type)) { big++; return; }
      support.draft.push({ file: file, name: file.name || (t("sp_photo") + ".png"), type: type, size: file.size,
        local: /^image\/(jpeg|png|webp|gif)$/.test(type) ? URL.createObjectURL(file) : "" });
    });
    if (bad) toast(t("sp_bad_type"), "error");
    if (big) toast(t("sp_too_big"), "error");
    renderDraft();
  }
  function clearDraft() {
    support.draft.forEach(function (d) { if (d.local) URL.revokeObjectURL(d.local); });
    support.draft = [];
    renderDraft();
  }
  function renderDraft() {
    var box = $("#support-draft");
    if (!box) return;
    box.classList.toggle("hidden", !support.draft.length);
    box.innerHTML = support.draft.map(function (d, i) {
      return '<span class="sp-chip">' + (d.local ? '<img src="' + esc(d.local) + '" alt="">' : '<i class="sp-file-ico">' + esc(extOf(d.name)) + "</i>") +
        '<button type="button" class="sp-chip-x" data-undraft="' + i + '" aria-label="×">×</button></span>';
    }).join("");
    $("#support-form").classList.toggle("has-draft", support.draft.length > 0);
  }

  // Загрузить файлы сообщения в хранилище (фото сжимаем, как фото заказов)
  async function uploadFiles(p) {
    var who = p.forUser || state.me.id, out = [];
    for (var i = 0; i < p.files.length; i++) {
      var f = p.files[i];
      if (!f.path) {
        var blob = f.file, type = f.type;
        if (/^image\/(jpeg|png|webp)$/.test(type) && blob.size > 600 * 1024) {
          blob = await c.shrinkImage(blob, 2000, 700 * 1024, true);
          type = blob.type || "image/jpeg";
        }
        if (blob.size > MAX_SIZE) throw new Error("file_too_big");
        var ext = (/\.([A-Za-z0-9]{1,5})$/.exec(f.name) || [])[1] || (type.split("/")[1] || "bin").replace(/[^a-z0-9]/g, "");
        if (/jpeg/.test(type)) ext = "jpg";
        var path = who + "/" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10) + "." + ext.toLowerCase();
        var up = await c.db().storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
        if (up.error) throw up.error;
        f.path = path; f.type = type; f.size = blob.size;
      }
      out.push({ path: f.path, name: f.name, type: f.type, size: f.size });
    }
    return out;
  }

  // ---------- Отправка: сообщение появляется сразу ----------
  function sendSupport() {
    var box = $("#support-text"), text = box.value.trim();
    if (!text && !support.draft.length) { box.focus(); return; }
    var p = { tmp: "t" + Date.now() + Math.random().toString(36).slice(2, 6), body: text, from_admin: !!support.user,
      created_at: new Date().toISOString(), forUser: support.user, files: support.draft.slice() };
    support.draft = [];   // ссылки на превью остаются у черновика сообщения, пока оно отправляется
    renderDraft();
    support.pending.push(p);
    box.value = "";
    growBox();
    renderLog(true);
    deliver(p);
  }

  async function deliver(p) {
    p.failed = false;
    var files = [];
    if (p.files.length) {
      try { files = await uploadFiles(p); }
      catch (e) {
        p.failed = true;
        renderLog(false);
        toast(t(/too_big|exceeded|size/i.test(String(e && (e.message || e.statusCode))) ? "sp_too_big" : "sp_upload_failed"), "error");
        return;
      }
    }
    var args = p.forUser ? { p_user: p.forUser, p_body: p.body } : { p_body: p.body, p_meta: supportMeta() };
    if (files.length) args.p_files = files;   // без файлов — как раньше (работает и до файла 40)
    var res = await c.db().rpc(p.forUser ? "admin_support_reply" : "support_send", args);
    if (res.error) {
      p.failed = true;
      renderLog(false);
      if (/too_many_messages/.test(res.error.message || "")) toast(t("support_too_many"), "error");
      else handleError(res.error);
      return;
    }
    // заменить «черновик» настоящим сообщением (если Realtime его ещё не принёс)
    support.pending = support.pending.filter(function (x) { return x !== p; });
    var id = typeof res.data === "string" ? res.data : null;
    if (id) support.shown[id] = 1;
    if (id && !support.msgs.some(function (m) { return m.id === id; })) {
      support.msgs.push({ id: id, user_id: p.forUser || state.me.id, from_admin: p.from_admin, body: p.body, meta: {}, read_at: null, created_at: p.created_at, files: files });
    }
    // своё фото показываем из памяти телефона, пока не пришла ссылка из хранилища
    p.files.forEach(function (f) { if (f.local && f.path) support.urls[f.path] = { url: f.local, until: Date.now() + 36e5 }; });
    if (owner() === (p.forUser || state.me.id)) renderLog(false);
    if (!id) loadSupportLog(false);
    // сообщить админу в Telegram (если подключено); ошибка здесь не мешает байеру
    if (!p.forUser) {
      try { c.db().functions.invoke("telegram-notify", { body: { action: "notify" } }).catch(function () {}); } catch (e) { /* ignore */ }
      if (U.alerts) U.alerts.push({ action: "support" });
    } else {
      if (U.alerts) U.alerts.push({ action: "support", user: p.forUser });
      threadsSoon();
    }
  }

  // На телефоне окно чата — во весь экран. Когда выезжает клавиатура, окно сжимается до видимой части,
  // чтобы поле ввода и последние сообщения не прятались под клавиатурой (как в WhatsApp)
  function fitScreen() {
    var vv = window.visualViewport, m = $("#modal-support");
    if (!vv || !isOpen()) return;
    var log = $("#support-log"), atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    m.style.setProperty("--sp-vh", Math.round(vv.height) + "px");
    m.style.setProperty("--sp-top", Math.round(vv.offsetTop) + "px");
    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  // Поле ввода растёт вместе с текстом (до 5 строк)
  function growBox() {
    var box = $("#support-text");
    box.style.height = "auto";
    box.style.height = Math.min(box.scrollHeight, 132) + "px";
  }

  // ---------- Realtime: сообщения, «в сети», «печатает…» ----------
  function onRow(payload) {
    var m = payload.new;
    if (!m || !m.id) return;
    if (payload.eventType === "INSERT" && isAdmin()) threadsSoon();
    if (isOpen() && m.user_id === owner()) {
      var i = -1;
      support.msgs.forEach(function (x, k) { if (x.id === m.id) i = k; });
      if (i >= 0) support.msgs[i] = Object.assign({}, support.msgs[i], m);
      else {
        // своё сообщение, которое ещё «отправляется», — убрать черновик
        var mineSide = !!support.user;
        if (m.from_admin === mineSide) {
          var k = support.pending.findIndex(function (p) { return !p.failed && p.body === m.body && p.files.length === filesOf(m).length; });
          if (k >= 0) {
            support.shown[m.id] = 1;
            support.pending[k].files.forEach(function (f) { if (f.local && f.path) support.urls[f.path] = { url: f.local, until: Date.now() + 36e5 }; });
            support.pending.splice(k, 1);
          }
        } else support.typingUntil = 0;   // пришёл ответ — «печатает…» больше не нужно
        support.msgs.push(m);
        support.msgs.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
      }
      renderLog(false);
      renderHead();
      if (m.from_admin !== !!support.user) markRead();
    }
    if (payload.eventType === "INSERT") {
      // пришло сообщение от другой стороны, а на него сейчас не смотрят — звук, вибрация, уведомление
      var incoming = isAdmin() ? !m.from_admin : !!m.from_admin;
      if (incoming && !(isOpen() && !document.hidden && m.user_id === owner()) && U.alerts) {
        U.alerts.ping({ title: t(isAdmin() ? "support_new" : "support_reply_new"), body: m.body ? String(m.body).slice(0, 120) : "", tag: "support" });
      }
      checkUnreadSoon();
    }
  }

  function startLive() {
    var db = c.db();
    if (!db || !db.channel || support.dbCh) return;
    support.dbCh = db.channel("support-db")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, onRow)
      .subscribe(function (status) {
        var was = support.live;
        support.live = status === "SUBSCRIBED";
        if (support.live && !was && isOpen()) loadSupportLog(false);   // переподключились — догнать пропущенное
      });
    // «в сети»: админ отмечается, байеры только слушают
    support.onlineCh = db.channel("support-online");
    support.onlineCh.on("presence", { event: "sync" }, function () {
      var st = support.onlineCh.presenceState();
      support.adminOnline = Object.keys(st).some(function (k) { return (st[k] || []).some(function (p) { return p.admin; }); });
      if (isOpen()) renderHead();
    }).subscribe(function (status) {
      if (status === "SUBSCRIBED" && isAdmin()) support.onlineCh.track({ admin: true });
    });
  }

  function stopLive() {
    var db = c.db();
    [support.dbCh, support.onlineCh, support.typingCh].forEach(function (ch) { if (ch && db) db.removeChannel(ch); });
    support.dbCh = support.onlineCh = support.typingCh = null;
    support.live = false;
    support.adminOnline = false;
  }

  // «печатает…»: свой канал на каждую переписку, пока окно открыто
  function joinTyping() {
    var db = c.db(), who = owner();
    if (!db || !db.channel || !who) return;
    if (support.typingCh && support.typingCh._who === who) return;
    if (support.typingCh) db.removeChannel(support.typingCh);
    var ch = db.channel("support-typing-" + who);
    ch._who = who;
    ch.on("broadcast", { event: "typing" }, function (msg) {
      var p = msg.payload || {};
      if (!!p.admin === !!support.user) return;   // это я сам
      support.typingUntil = Date.now() + 4000;
      renderHead();
      if (!$("#support-log .sp-typing-row")) renderLog(false);
      clearTimeout(support.typingTimer);
      support.typingTimer = setTimeout(function () { renderHead(); renderLog(false); }, 4100);
    }).subscribe();
    support.typingCh = ch;
  }
  function leaveTyping() {
    if (support.typingCh && c.db()) c.db().removeChannel(support.typingCh);
    support.typingCh = null;
    support.typingUntil = 0;
  }
  function sendTyping() {
    if (!support.typingCh || Date.now() - support.typingSentAt < 2500) return;
    support.typingSentAt = Date.now();
    support.typingCh.send({ type: "broadcast", event: "typing", payload: { admin: !!support.user } });
  }

  // ---------- Telegram-уведомления (админ) ----------
  async function tgCall(action) {
    var res = await c.db().functions.invoke("telegram-notify", { body: { action: action } });
    if (res.error) return { error: "server_error" };
    return res.data || {};
  }

  async function loadTgStatus() {
    var el = $("#tg-status");
    el.className = "tg-status";
    el.textContent = t("loading");
    var r = await tgCall("status");
    if (r.ok && r.connected) {
      el.textContent = t("tg_on", { bot: r.bot ? "@" + r.bot : "", name: r.chat_name || "" });
      el.classList.add("on");
    } else if (r.ok) {
      el.textContent = t("tg_off_bot", { bot: "@" + r.bot });
    } else {
      el.textContent = t(r.error === "no_bot_token" ? "tg_no_token" : r.error === "bad_token" ? "tg_bad_token" : "tg_error");
    }
  }

  async function connectTelegram() {
    var btn = $("#tg-connect");
    btn.disabled = true;
    var r = await tgCall("connect");
    btn.disabled = false;
    if (r.ok) toast(t("tg_connected"), "ok");
    else toast(t(r.error === "no_start" ? "tg_no_start" : r.error === "no_bot_token" ? "tg_no_token" :
      r.error === "bad_token" ? "tg_bad_token" : "tg_error"), "error");
    loadTgStatus();
  }

  // Админ: список переписок
  async function loadSupportThreads(quiet) {
    if (!isAdmin()) return;
    if (!quiet) loadTgStatus();
    var res = await c.db().rpc("admin_support_threads");
    if (res.error) { if (!quiet) handleError(res.error); return; }
    support.threads = res.data || [];
    $("#support-threads").innerHTML = support.threads.length ? support.threads.map(function (r) {
      var name = r.full_name || r.email || "—";
      var last = (r.last_from_admin ? t("support_team") + ": " : "") + (r.last_body || "📎 " + t("sp_file"));
      return '<button type="button" class="support-thread' + (r.unread > 0 ? " unread" : "") + '" data-user="' + esc(r.user_id) + '">' +
        '<span class="sp-ava">' + esc(initials(name)) + "</span>" +
        '<span class="support-thread-body"><span class="support-thread-top"><b>' + esc(name) + "</b>" +
        '<small class="muted">' + esc(fmtTime(r.last_at)) + "</small></span>" +
        '<small class="muted">' + esc([r.ws_name, r.phone].filter(Boolean).join(" · ")) + "</small>" +
        '<span class="support-thread-last">' + esc(last.length > 140 ? last.slice(0, 140) + "…" : last) +
        (r.unread > 0 ? '<span class="badge-inline">' + esc(String(r.unread)) + "</span>" : "") + "</span></span></button>";
    }).join("") : '<p class="muted">' + esc(t("support_no_threads")) + "</p>";
  }
  function threadsSoon() {
    if (!isAdmin() || state.tab !== "support") return;
    clearTimeout(support.threadsTimer);
    support.threadsTimer = setTimeout(function () { loadSupportThreads(true); }, 300);
  }

  // Красная цифра: у байера — на 💬, у админа — на вкладке «Поддержка»
  async function checkSupportUnread() {
    if (!state.me) return;
    var res = await c.db().rpc("support_unread");
    if (res.error) return;
    var n = Number(res.data) || 0;
    var admin = isAdmin();
    var badge = $(admin ? "#support-tab-badge" : "#support-badge");
    badge.textContent = n > 99 ? "99+" : String(n);
    badge.classList.toggle("hidden", n === 0);
    // окно с этой перепиской открыто — сообщение и так видно, всплывашка не нужна
    if (support.unread >= 0 && n > support.unread && !(isOpen() && !admin)) {
      toast(t(admin ? "support_new" : "support_reply_new"), "ok");
      if (U.alerts) U.alerts.ping({ title: t(admin ? "support_new" : "support_reply_new"), tag: "support" });
    }
    support.unread = n;
  }
  function checkUnreadSoon() {
    clearTimeout(support.unreadTimer);
    support.unreadTimer = setTimeout(checkSupportUnread, 700);
  }

  // Подстраховка, если Realtime недоступен: открытый чат — каждые 4 секунды, цифра — раз в 20 секунд
  function startSupportPolling() {
    stopSupportPolling();
    support.unread = -1;
    checkSupportUnread();
    startLive();
    var n = 0;
    support.timer = setInterval(function () {
      if (document.hidden) return; // вкладка свёрнута — не тратим запросы
      n++;
      // с Realtime — всё равно раз в 12 секунд (если файл 39 ещё не запущен, события не придут)
      if (isOpen() && (!support.live || n % 3 === 0)) loadSupportLog(false);
      if (!support.live ? n % 2 === 0 : n % 8 === 0) checkSupportUnread();
    }, 4000);
  }

  function stopSupportPolling() {
    if (support.timer) clearInterval(support.timer);
    support.timer = null;
    support.unread = -1;
    stopLive();
    support.typingCh = null;
    support.agent = null;
    support.agentLoaded = false;
    support.msgs = []; support.pending = []; support.shown = {};
    $("#support-badge").classList.add("hidden");
    $("#support-tab-badge").classList.add("hidden");
  }

  // Кнопки и поля поддержки (вызывается из app.js при входе в кабинет)
  function bind() {
    $("#support-btn").addEventListener("click", function () { openSupport(null, null); });
    $("#support-form").addEventListener("submit", function (e) { e.preventDefault(); sendSupport(); $("#support-text").focus(); });
    $("#support-send").setAttribute("aria-label", t("support_send"));
    var box = $("#support-text");
    box.addEventListener("input", function () { growBox(); if (box.value.trim()) sendTyping(); });
    box.addEventListener("keydown", function (e) {
      // на компьютере Enter — отправить, Shift+Enter — новая строка; на телефоне Enter — новая строка
      var desk = window.matchMedia("(pointer: fine)").matches;
      if (e.key === "Enter" && !e.isComposing && ((desk && !e.shiftKey) || e.ctrlKey || e.metaKey)) { e.preventDefault(); sendSupport(); }
    });
    // 📎 скрепка, вставка скриншота (Ctrl+V), перетаскивание файлов в окно
    $("#support-attach").addEventListener("click", function () { $("#support-file").click(); });
    $("#support-file").addEventListener("change", function (e) { addFiles(e.target.files); e.target.value = ""; box.focus(); });
    box.addEventListener("paste", function (e) {
      var files = e.clipboardData && e.clipboardData.files;
      if (files && files.length && !support.noFiles) { e.preventDefault(); addFiles(files); }
    });
    var sheet = $("#modal-support .modal-sheet");
    sheet.addEventListener("dragover", function (e) { if (support.noFiles) return; e.preventDefault(); sheet.classList.add("sp-drop"); });
    sheet.addEventListener("dragleave", function (e) { if (!sheet.contains(e.relatedTarget)) sheet.classList.remove("sp-drop"); });
    sheet.addEventListener("drop", function (e) {
      sheet.classList.remove("sp-drop");
      if (support.noFiles || !e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    });
    $("#support-draft").addEventListener("click", function (e) {
      var x = e.target.closest("[data-undraft]");
      if (!x) return;
      var d = support.draft.splice(Number(x.getAttribute("data-undraft")), 1)[0];
      if (d && d.local) URL.revokeObjectURL(d.local);
      renderDraft();
    });
    $("#support-log").addEventListener("click", function (e) {
      var im = e.target.closest("[data-img]");
      if (im) {
        var key = im.getAttribute("data-img");
        var m = support.msgs.concat(support.pending).filter(function (x) { return (x.id || x.tmp) === key; })[0];
        var urls = m ? filesOf(m).filter(isImg).map(fileUrl).filter(Boolean) : [];
        if (urls.length) c.openLightbox(urls, Number(im.getAttribute("data-i")) || 0);
        return;
      }
      var r = e.target.closest("[data-retry]");
      if (!r) return;
      var p = support.pending.filter(function (x) { return x.tmp === r.getAttribute("data-retry"); })[0];
      if (p) { renderLog(false); deliver(p); }
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", fitScreen);
      window.visualViewport.addEventListener("scroll", fitScreen);
    }
    // окно закрыли — перестать слушать «печатает…»
    new MutationObserver(function () { if (!isOpen()) leaveTyping(); })
      .observe($("#modal-support"), { attributes: true, attributeFilter: ["class"] });
    // вернулись на вкладку — отметить прочитанным и догнать пропущенное
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && isOpen()) loadSupportLog(false);
    });
    $("#tg-connect").addEventListener("click", connectTelegram);
    $("#support-threads").addEventListener("click", function (e) {
      var b = e.target.closest("[data-user]");
      if (!b) return;
      var row = (support.threads || []).filter(function (r) { return r.user_id === b.dataset.user; })[0];
      openSupport(b.dataset.user, row || null);
    });
  }

  U.support = {
    open: openSupport, uploadFiles: uploadFiles, loadThreads: loadSupportThreads, checkUnread: checkSupportUnread,
    startPolling: startSupportPolling, stopPolling: stopSupportPolling,
    rememberError: rememberError, bind: bind
  };
})(window.ULA);
