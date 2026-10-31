// =====================================================
// ULA FACTORY — разрешения «как в приложении» и устройство пользователя для поддержки.
//
//   • После входа — одно окно «Настройте ULA»: уведомления и местоположение, каждое своей кнопкой.
//     Показывается, пока что-то не включено, и не чаще раза в 3 дня («Не сейчас»).
//   • Сайт записывает в базу, с чего человек заходит (файл 47): система, браузер, модель,
//     приложение или браузер, версия сайта, уведомления, язык, часовой пояс, сеть, экран,
//     и место — только если человек сам разрешил. Обновляется при входе и раз в полчаса.
//   • Админ в чате поддержки видит карточку «Устройство» над перепиской.
// ULA.device.afterLogin() — зовёт app.js после входа; ULA.device.render(userId, box) — чат поддержки.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state;
  var KEY_ID = "ula_device_id", KEY_LATER = "ula_perm_later";
  var EVERY = 30 * 60 * 1000, LATER = 3 * 24 * 3600 * 1000;
  var last = 0, geo = null, geoState = "unknown", hints = null, sheetTried = false, noTable = false;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  function deviceId() {
    var id = get(KEY_ID);
    if (id && /^[A-Za-z0-9_-]{8,64}$/.test(id)) return id;
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    id = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    put(KEY_ID, id);
    return id;
  }

  // ---------- Что за устройство ----------
  function installed() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  }
  function parseUA() {
    var ua = navigator.userAgent || "", m, os = "", br = "", model = "";
    var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    if ((m = ua.match(/(?:iPhone|iPod).*? OS (\d+(?:_\d+)*)/))) os = "iOS " + m[1].replace(/_/g, ".");
    else if ((m = ua.match(/iPad.*? OS (\d+(?:_\d+)*)/))) os = "iPadOS " + m[1].replace(/_/g, ".");
    else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) os = "Android " + m[1];
    else if ((m = ua.match(/Windows NT (\d+\.\d+)/))) os = "Windows " + ({ "10.0": "10", "6.3": "8.1", "6.2": "8", "6.1": "7" }[m[1]] || m[1]);
    else if ((m = ua.match(/Mac OS X (\d+(?:[_.]\d+)*)/))) os = (touchMac ? "iPadOS" : "macOS ") + (touchMac ? "" : m[1].replace(/_/g, "."));
    else if (/CrOS/.test(ua)) os = "ChromeOS";
    else if (/Linux/.test(ua)) os = "Linux";

    if (/Telegram/i.test(ua)) br = "Telegram";
    else if (/Instagram/.test(ua)) br = "Instagram";
    else if (/FBAN|FBAV/.test(ua)) br = "Facebook";
    else if (/WhatsApp/i.test(ua)) br = "WhatsApp";
    else if ((m = ua.match(/YaBrowser\/(\d+)/))) br = "Yandex " + m[1];
    else if ((m = ua.match(/EdgA?\/(\d+)/))) br = "Edge " + m[1];
    else if ((m = ua.match(/OPR\/(\d+)/))) br = "Opera " + m[1];
    else if ((m = ua.match(/SamsungBrowser\/(\d+)/))) br = "Samsung " + m[1];
    else if ((m = ua.match(/CriOS\/(\d+)/))) br = "Chrome " + m[1];
    else if ((m = ua.match(/FxiOS\/(\d+)/))) br = "Firefox " + m[1];
    else if ((m = ua.match(/Firefox\/(\d+)/))) br = "Firefox " + m[1];
    else if ((m = ua.match(/Chrome\/(\d+)/))) br = "Chrome " + m[1];
    else if ((m = ua.match(/Version\/(\d+(?:\.\d+)?).*Safari/))) br = "Safari " + m[1];

    if ((m = ua.match(/Android [^;)]*;\s*(?:[a-z]{2}[-_][a-z]{2};\s*)?([^;)]+?)(?:\s+Build|\))/i))) model = m[1].trim();
    if (model === "K") model = "";   // Chrome скрывает модель — уточним ниже, если браузер скажет
    if (/iPhone/.test(ua)) model = "iPhone";
    else if (/iPad/.test(ua) || touchMac) model = "iPad";

    var kind = /iPad|Tablet/.test(ua) || touchMac || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet"
      : /Mobi|iPhone|Android/.test(ua) ? "phone" : "desktop";
    return { kind: kind, os: os, browser: br, model: model };
  }
  // Chrome/Edge на Android и Windows сами говорят точную модель и версию системы
  function loadHints() {
    if (hints) return Promise.resolve(hints);
    var d = navigator.userAgentData;
    if (!d || !d.getHighEntropyValues) return Promise.resolve(hints = {});
    return d.getHighEntropyValues(["model", "platformVersion"]).then(function (h) {
      hints = { model: h.model || "", platform: d.platform || "", pv: h.platformVersion || "" };
      return hints;
    }).catch(function () { return (hints = {}); });
  }

  function info() {
    var p = parseUA(), h = hints || {}, n = navigator, conn = n.connection || {};
    if (h.model) p.model = h.model;
    if (h.platform === "Windows" && h.pv) p.os = "Windows " + (parseInt(h.pv, 10) >= 13 ? "11" : "10");
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* ignore */ }
    var o = {
      kind: p.kind, model: p.model, os: p.os, browser: p.browser,
      app: installed(),
      v: c.APP_VERSION,
      push: U.alerts && U.alerts.status ? U.alerts.status() : "",
      geo: geoState,
      lang: typeof getLang === "function" ? getLang() : "",
      langs: (n.languages || [n.language]).slice(0, 4).join(", "),
      tz: tz,
      screen: screen.width + "×" + screen.height + " @" + (Math.round((window.devicePixelRatio || 1) * 100) / 100),
      view: window.innerWidth + "×" + window.innerHeight,
      net: conn.effectiveType || "",
      online: n.onLine !== false,
      mem: n.deviceMemory || null,
      cpu: n.hardwareConcurrency || null,
      dark: !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches),
      role: state.me ? state.me.role : "",
      ws: state.ws ? state.ws.name : "",
      tab: state.tab || "",
      ua: String(n.userAgent || "").slice(0, 300)
    };
    Object.keys(o).forEach(function (k) { if (o[k] === "" || o[k] === null) delete o[k]; });
    return o;
  }

  function ping(force) {
    if (noTable || !state.me) return Promise.resolve();
    var now = Date.now();
    if (!force && now - last < EVERY) return Promise.resolve();
    last = now;
    return loadHints().then(function () {
      return c.db().rpc("device_ping", { p_device: deviceId(), p_info: info(), p_geo: geo });
    }).then(function (r) {
      if (r && r.error) {
        if (/device_ping|user_devices|PGRST202/.test((r.error.message || "") + (r.error.code || ""))) noTable = true;   // файл 47 ещё не запущен
        console.warn("device_ping", r.error.message);
      }
    }).catch(function () { /* без сети — в следующий раз */ });
  }

  // ---------- Местоположение ----------
  function geoSupported() { return !!navigator.geolocation; }
  function checkGeo() {
    if (!geoSupported()) { geoState = "none"; return Promise.resolve(geoState); }
    if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(geoState);
    return navigator.permissions.query({ name: "geolocation" }).then(function (p) {
      geoState = p.state;   // granted | prompt | denied
      p.onchange = function () { geoState = p.state; if (p.state === "granted") locate(); };
      return geoState;
    }).catch(function () { return geoState; });
  }
  // спросить (если ещё не спрашивали) и записать место; Promise → true, если место есть
  function locate() {
    if (!geoSupported()) return Promise.resolve(false);
    return new Promise(function (done) {
      navigator.geolocation.getCurrentPosition(function (pos) {
        var k = pos.coords;
        geo = { lat: Math.round(k.latitude * 1e5) / 1e5, lon: Math.round(k.longitude * 1e5) / 1e5, acc: Math.round(k.accuracy || 0), at: new Date().toISOString() };
        geoState = "granted";
        ping(true);
        done(true);
      }, function (err) {
        if (err && err.code === 1) geoState = "denied";
        ping(true);
        done(false);
      }, { enableHighAccuracy: false, timeout: 20000, maximumAge: 10 * 60 * 1000 });
    });
  }

  // ---------- Окно «Настройте ULA» ----------
  function pushNeed() {
    var s = U.alerts && U.alerts.status ? U.alerts.status() : "none";
    return s === "off" || s === "ios";
  }
  function geoNeed() { return geoState === "prompt" || (geoState === "unknown" && geoSupported()); }
  function busy() { return document.querySelector(".modal.open") || document.body.classList.contains("touring"); }

  function ensureSheet() {
    var m = $("#modal-perm");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-perm";
    m.className = "modal modal-small perm-modal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="perm-title">' +
      '<div class="perm-hero"><img src="img/icon-192.png" alt="" width="64" height="64"><h2 id="perm-title"></h2><p id="perm-sub"></p></div>' +
      '<div class="modal-body"><div id="perm-rows" class="perm-rows"></div></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" type="button" data-close id="perm-later"></button>' +
      '<button class="btn btn-primary" type="button" data-close id="perm-done"></button></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", function (e) {
      var b = e.target.closest("[data-perm]");
      if (!b) return;
      b.disabled = true;
      var job = b.getAttribute("data-perm") === "push"
        ? Promise.resolve(U.alerts.turnOn()).then(function () { ping(true); })
        : locate();
      job.then(renderSheet, renderSheet);
    });
    return m;
  }
  function row(ico, title, text, st, kind) {
    var right = st === "on" ? '<span class="perm-ok">' + esc(t("perm_on")) + "</span>"
      : st === "denied" ? '<span class="perm-no">' + esc(t("perm_denied")) + "</span>"
      : st === "ask" ? '<button type="button" class="btn btn-primary btn-sm" data-perm="' + kind + '">' + esc(t("perm_allow")) + "</button>" : "";
    return '<div class="perm-row' + (st === "on" ? " done" : "") + '"><span class="perm-ico" aria-hidden="true">' + ico + "</span>" +
      '<div class="perm-txt"><b>' + esc(title) + "</b><p>" + esc(text) + "</p></div>" + right + "</div>";
  }
  function renderSheet() {
    var m = ensureSheet();
    $("#perm-title").textContent = t("perm_title");
    $("#perm-sub").textContent = t("perm_sub");
    $("#perm-later").textContent = t("perm_later");
    $("#perm-done").textContent = t("perm_done");
    var ps = U.alerts && U.alerts.status ? U.alerts.status() : "none", h = "";
    if (ps !== "none") {
      h += ps === "ios"
        ? row("🔔", t("perm_push"), t("push_d_ios"), "", "push")
        : row("🔔", t("perm_push"), t("perm_push_d"), ps === "on" ? "on" : ps === "denied" ? "denied" : "ask", "push");
    }
    if (geoSupported()) h += row("📍", t("perm_geo"), t("perm_geo_d"), geoState === "granted" ? "on" : geoState === "denied" ? "denied" : "ask", "geo");
    $("#perm-rows").innerHTML = h;
    var all = !pushNeed() && !geoNeed();
    $("#perm-later").classList.toggle("hidden", all);
    return m;
  }
  function maybeSheet() {
    if (sheetTried || !state.me || state.readOnly) return;
    if (busy()) { setTimeout(maybeSheet, 2000); return; }   // сначала обучение и обязательные окна
    sheetTried = true;
    if (!pushNeed() && !geoNeed()) return;
    if (Date.now() - Number(get(KEY_LATER) || 0) < LATER) return;
    put(KEY_LATER, String(Date.now()));
    renderSheet();
    c.openModal("modal-perm");
  }

  function afterLogin() {
    checkGeo().then(function (s) {
      if (s === "granted") locate(); else ping(true);   // уже разрешено — место обновляем без вопросов
    });
    setTimeout(maybeSheet, 2500);   // подписка на push успевает проверить себя
  }

  // раз в полчаса и при возвращении в приложение
  document.addEventListener("visibilitychange", function () { if (!document.hidden) ping(false); });
  setInterval(function () { if (!document.hidden) ping(false); }, EVERY);

  // ---------- Карточка «Устройство» для админа ----------
  function ago(s) {
    var min = Math.round((Date.now() - new Date(s).getTime()) / 60000);
    if (min < 2) return t("dev_now");
    if (min < 60) return t("dev_min", { n: min });
    if (min < 48 * 60) return t("dev_hour", { n: Math.round(min / 60) });
    return c.fmtTime(s);
  }
  function title(i) {
    return [i.model || t("dev_" + (i.kind || "desktop")), i.os, i.browser, i.app ? t("dev_app") : ""].filter(Boolean).join(" · ");
  }
  function line(k, v) { return v || v === 0 ? "<dt>" + esc(t(k)) + "</dt><dd>" + v + "</dd>" : ""; }
  function card(d) {
    var i = d.info || {}, g = d.geo;
    var place = g && g.lat != null
      ? '<a href="https://maps.google.com/?q=' + encodeURIComponent(g.lat + "," + g.lon) + '" target="_blank" rel="noopener">' +
        esc(t("dev_map")) + "</a> <span class=\"muted\">±" + esc(g.acc) + " " + esc(t("dev_m")) + " · " + esc(c.fmtTime(g.at)) + "</span>"
      : esc(t(i.geo === "denied" ? "dev_geo_no" : "dev_geo_none"));
    var push = i.push ? t("push_t_" + i.push) : "";
    return "<details class=\"dev-card\"><summary><b>" + esc(title(i)) + "</b><span>" + esc(ago(d.last_seen)) + "</span></summary><dl>" +
      line("dev_seen", esc(c.fmtTime(d.last_seen)) + " · " + esc(t("dev_first")) + " " + esc(c.fmtTime(d.first_seen))) +
      line("dev_version", esc(i.v ? "v" + i.v : "")) +
      line("dev_push", esc(i.push === "on" ? "✅ " + t("perm_on") : push)) +
      line("dev_place", place) +
      line("dev_ip", esc([d.ip, d.country].filter(Boolean).join(" · "))) +
      line("dev_tz", esc([i.tz, i.langs].filter(Boolean).join(" · "))) +
      line("dev_screen", esc([i.screen, i.view ? t("dev_window", { v: i.view }) : "", i.dark ? t("dev_dark") : ""].filter(Boolean).join(" · "))) +
      line("dev_net", esc([i.online === false ? t("dev_offline") : "", i.net, i.mem ? t("dev_gb", { n: i.mem }) : "", i.cpu ? t("dev_cores", { n: i.cpu }) : ""].filter(Boolean).join(" · "))) +
      line("dev_ua", '<code>' + esc(i.ua || "") + "</code>") +
      "</dl></details>";
  }
  function render(userId, box) {
    if (!box) return;
    box.classList.add("hidden");
    box.innerHTML = "";
    if (!userId) return;
    c.db().from("user_devices").select("info, geo, ip, country, first_seen, last_seen")
      .eq("user_id", userId).order("last_seen", { ascending: false }).limit(5)
      .then(function (r) {
        if (r.error || !r.data || !r.data.length) return;   // файл 47 не запущен или человек ещё не заходил
        box.innerHTML = r.data.map(function (d) { return card(d); }).join("");
        box.classList.remove("hidden");
      });
  }

  U.device = { afterLogin: afterLogin, ping: ping, render: render, sheet: function () { sheetTried = false; put(KEY_LATER, "0"); maybeSheet(); } };
})(window.ULA);
