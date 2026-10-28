// =====================================================
// ULA FACTORY — раздел «Обмен»: сом → юань.
//
// Два курса, каждый сам по себе:
//   • Курс ULA для байеров (таблица platform_fx) — ставит админ каждый день.
//     Байер видит его, считает сумму и отправляет админу заявку (через «Поддержку»).
//   • Мой курс для клиентов (workspaces.fx_*) — байер ставит сам.
//     Клиент открывает ссылку обмена (?fx=…), витрину, страницу заказа или общую ссылку,
//     вводит, сколько юаней ему нужно, видит сумму в сомах и реквизиты, оставляет заявку,
//     оплачивает и загружает скриншот. Заявки приходят байеру сюда и в Telegram.
//
// Курс ступенчатый: [{from: 1000, rate: 12.6}, {from: 10000, rate: 12.4}] —
// «от 1 000 ¥ — 12,6 сом за 1 ¥, от 10 000 ¥ — 12,4». Меньшая ступень — минимальная сумма.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, parseNum = c.parseNum, state = c.state;

  var MAX_TIERS = 10;
  var fx = { platform: null, list: [], filter: "active", loading: false };

  function isAdmin() { return !!(state.me && state.me.role === "admin"); }
  function canOwn() { return !state.readOnly && state.myRole === "owner"; }
  function rateStr(r) { return Number(r).toLocaleString(c.locale(), { minimumFractionDigits: 2, maximumFractionDigits: 4 }); }
  function isToday(d) { return !!d && new Date(d).toDateString() === new Date().toDateString(); }
  function dateLine(d) {
    if (!d) return "";
    return isToday(d) ? t("fx_date", { d: c.fmtDate(d) }) : t("fx_old", { d: c.fmtDate(d) });
  }
  var ETAS = [15, 30, 60, 120, 180, 360, 1440];
  function etaName(m) {
    m = Number(m);
    if (m >= 1440) return t("fx_eta_d", { n: Math.round(m / 1440) });
    if (m >= 60) return t("fx_eta_h", { n: Math.round(m / 60 * 10) / 10 });
    return t("fx_eta_m", { n: m });
  }
  function hhmm(d) { return new Date(d).toLocaleTimeString(c.locale(), { hour: "2-digit", minute: "2-digit" }); }
  function untilText(d) {
    var dt = new Date(d), left = Math.round((dt - Date.now()) / 60000);
    var day = dt.toDateString() === new Date().toDateString() ? "" : c.fmtDate(d) + " ";
    return t("fx_wait_until", { t: day + hhmm(d) }) + (left > 0 ? " · " + t("fx_left", { n: etaName(left) }) : "");
  }
  function statusUrl(id) { return location.origin + location.pathname.replace(/index\.html$/, "") + "?xr=" + id; }
  // запомнить заявку в браузере клиента, чтобы он мог вернуться к статусу
  function rememberReq(id) {
    try {
      var list = JSON.parse(localStorage.getItem("ula_fx_reqs") || "[]").filter(function (x) { return x && x.id !== id; });
      list.unshift({ id: id, at: Date.now() });
      localStorage.setItem("ula_fx_reqs", JSON.stringify(list.slice(0, 5)));
    } catch (e) { /* ignore */ }
  }
  function myReqs() {
    try {
      return JSON.parse(localStorage.getItem("ula_fx_reqs") || "[]").filter(function (x) { return x && x.id && Date.now() - x.at < 14 * 864e5; });
    } catch (e) { return []; }
  }

  // Обмен «только для Кыргызстана»: курс ULA показываем байерам с сомами или киргизским телефоном
  function kgBuyer() {
    var p = (state.me && state.me.phone) || "";
    return isAdmin() || /^\+?996/.test(p) || (state.ws && state.ws.default_client_currency === "KGS");
  }

  // ---------- Ступени курса ----------
  function sortTiers(tiers) {
    return (Array.isArray(tiers) ? tiers : []).filter(function (x) { return x && num(x.rate) > 0; })
      .slice().sort(function (a, b) { return num(a.from) - num(b.from); });
  }
  function rateFor(tiers, cny) {
    var r = null;
    sortTiers(tiers).forEach(function (x) { if (num(x.from) <= cny) r = num(x.rate); });
    return r;
  }
  function minOf(tiers) { var s = sortTiers(tiers); return s.length ? num(s[0].from) : 0; }
  function bestRate(tiers) {
    var s = sortTiers(tiers);
    return s.length ? Math.min.apply(null, s.map(function (x) { return num(x.rate); })) : null;
  }
  // таблица «от … ¥ — курс», текущая ступень подсвечена
  function tiersHtml(tiers, cny) {
    var s = sortTiers(tiers), cur = rateFor(tiers, cny || 0), curFrom = null;
    s.forEach(function (x) { if (num(x.from) <= (cny || 0)) curFrom = num(x.from); });
    return '<div class="fx-tiers">' + s.map(function (x) {
      var on = cny > 0 && cur != null && num(x.from) === curFrom;
      return '<div class="fx-tier' + (on ? " on" : "") + '"><span>' + esc(t("fx_from", { n: money(x.from) })) + "</span><b>" +
        esc(rateStr(x.rate)) + " " + esc(t("fx_som_short")) + "</b></div>";
    }).join("") + "</div>";
  }
  function somFor(tiers, cny) {
    var r = rateFor(tiers, cny);
    return r ? Math.round(cny * r * 100) / 100 : null;
  }

  // ---------- Редактор ступеней (байер и админ) ----------
  function editorHtml(prefix, tiers, disabled) {
    var rows = sortTiers(tiers);
    if (!rows.length) rows = [{ from: 1000, rate: "" }];
    var dis = disabled ? " disabled" : "";
    return '<div class="fx-ed" id="' + prefix + '-ed">' +
      '<div class="fx-ed-head"><span>' + esc(t("fx_ed_from")) + "</span><span>" + esc(t("fx_ed_rate")) + "</span><span></span></div>" +
      rows.map(function (x) { return edRowHtml(x, dis); }).join("") + "</div>" +
      (disabled ? "" : '<button type="button" class="btn btn-ghost btn-sm" data-fx-addrow="' + prefix + '">+ ' + esc(t("fx_ed_add")) + "</button>");
  }
  function edRowHtml(x, dis) {
    return '<div class="fx-ed-row">' +
      '<input type="text" inputmode="decimal" data-fx-from value="' + esc(x.from === "" || x.from == null ? "" : String(Number(x.from))) + '"' + (dis || "") + ">" +
      '<input type="text" inputmode="decimal" placeholder="12.50" data-fx-rate value="' + esc(x.rate === "" || x.rate == null ? "" : String(Number(x.rate))) + '"' + (dis || "") + ">" +
      (dis ? "<span></span>" : '<button type="button" class="icon-btn fx-ed-del" data-fx-delrow aria-label="×">×</button>') +
      "</div>";
  }
  // прочитать ступени из редактора; null — ошибка (сообщение уже показано), [] — пусто
  function readEditor(prefix) {
    var out = [], seen = {}, bad = false;
    Array.prototype.forEach.call(document.querySelectorAll("#" + prefix + "-ed .fx-ed-row"), function (row) {
      var fs = row.querySelector("[data-fx-from]").value.trim(), rs = row.querySelector("[data-fx-rate]").value.trim();
      if (!fs && !rs) return;
      var f = fs ? parseNum(fs) : 0, r = parseNum(rs);
      if (!(f >= 0) || !(r > 0 && r < 1000) || seen[f]) { bad = true; return; }
      seen[f] = true;
      out.push({ from: Math.round(f * 100) / 100, rate: Math.round(r * 10000) / 10000 });
    });
    if (bad) { toast(t("fx_e_rate"), "error"); return null; }
    if (out.length > MAX_TIERS) { toast(t("fx_e_many", { n: MAX_TIERS }), "error"); return null; }
    return sortTiers(out);
  }

  // ---------- Загрузка ----------
  async function loadPlatform() {
    var res = await c.db().from("platform_fx").select("tiers, note, updated_at").eq("id", 1).maybeSingle();
    fx.platform = res.error ? null : res.data;
  }
  async function loadRequests() {
    if (!state.ws) { fx.list = []; return; }
    fx.loading = true;
    var res = await c.db().from("exchange_requests").select("*").eq("workspace_id", state.ws.id)
      .order("created_at", { ascending: false }).limit(300);
    fx.loading = false;
    fx.list = res.error ? [] : (res.data || []);
    setBadge(countActive());
  }
  function countActive() { return fx.list.filter(function (r) { return r.status === "new" || r.status === "paid" || r.status === "confirmed"; }).length; }
  function setBadge(n) {
    var b = $("#fx-badge");
    if (!b) return;
    b.textContent = n > 99 ? "99+" : String(n);
    b.classList.toggle("hidden", !n);
  }
  // для значка в меню: сколько заявок ждут (без загрузки всего списка)
  async function loadCount() {
    if (!state.ws || !c.db()) return;
    var res = await c.db().from("exchange_requests").select("id", { count: "exact", head: true })
      .eq("workspace_id", state.ws.id).in("status", ["new", "paid", "confirmed"]);
    if (!res.error) setBadge(res.count || 0);
  }

  // ---------- Раздел в кабинете ----------
  function fxUrl(tok) { return tok ? location.origin + location.pathname.replace(/index\.html$/, "") + "?fx=" + tok : ""; }

  function platformHtml() {
    var p = fx.platform || {}, tiers = p.tiers;
    var html = '<section class="an-card fx-card"><h3>' + esc(t("fx_platform_title")) + "</h3>";
    if (sortTiers(tiers).length) {
      html += '<p class="fx-date ' + (isToday(p.updated_at) ? "" : "old") + '">' + esc(dateLine(p.updated_at)) + "</p>" +
        '<div id="fxp-tiers">' + tiersHtml(tiers, 0) + "</div>" +
        (p.note ? '<p class="fx-note">' + esc(p.note) + "</p>" : "");
      if (!isAdmin()) {
        html += calcHtml("fxp", minOf(tiers)) +
          '<button id="fxp-send" class="btn btn-primary btn-block" type="button">' + esc(t("fx_ask_admin")) + "</button>";
      }
    } else {
      html += '<p class="muted">' + esc(t("fx_platform_none")) + "</p>";
    }
    if (isAdmin()) {
      html += '<form id="fxa-form" class="fx-form" novalidate><h4>' + esc(t("fx_admin_set")) + "</h4>" +
        editorHtml("fxa", tiers, false) +
        '<label class="field"><span>' + esc(t("fx_note_label")) + '</span><textarea id="fxa-note" rows="2" maxlength="500">' + esc(p.note || "") + "</textarea></label>" +
        '<button class="btn btn-primary btn-block" type="submit">' + esc(t("fx_save")) + "</button></form>";
    }
    return html + "</section>";
  }

  function calcHtml(id, min) {
    return '<div class="fx-calc">' +
      '<label class="field"><span>' + esc(t("fx_cny")) + '</span><input id="' + id + '-cny" type="text" inputmode="decimal" autocomplete="off" placeholder="' + esc(money(min || 1000)) + '"></label>' +
      '<div class="fx-out"><span>' + esc(t("fx_pay")) + '</span><b id="' + id + '-som">0 ' + esc(t("fx_som_short")) + "</b></div>" +
      "</div>";
  }

  function linkHtml() {
    var tok = state.ws && state.ws.request_token, url = fxUrl(tok);
    return '<div class="fx-link">' +
      "<h4>" + esc(t("fx_link_title")) + "</h4>" +
      '<p class="muted">' + esc(t("fx_link_hint")) + "</p>" +
      (url
        ? '<input id="fx-link-input" class="fx-link-input" type="text" readonly value="' + esc(url) + '">' +
          '<div class="fx-row-act"><button id="fx-link-copy" class="btn btn-sm" type="button">' + esc(t("fx_copy")) + "</button>" +
          '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t("fx_wa_text", { url: url })) + '">WhatsApp</a></div>'
        : (canOwn() ? '<button id="fx-link-make" class="btn btn-sm" type="button">' + esc(t("fx_link_make")) + "</button>" : "")) +
      "</div>";
  }

  function myHtml() {
    var w = state.ws || {}, own = canOwn();
    return '<section class="an-card fx-card"><h3>' + esc(t("fx_my_title")) + "</h3>" +
      '<p class="muted">' + esc(t("fx_my_hint")) + "</p>" +
      (w.fx_tiers ? '<p class="fx-date ' + (isToday(w.fx_updated_at) ? "" : "old") + '">' + esc(dateLine(w.fx_updated_at)) + "</p>" : "") +
      '<form id="fxm-form" class="fx-form" novalidate>' +
        '<label class="check-line"><input id="fxm-on" type="checkbox"' + (w.fx_on ? " checked" : "") + (own ? "" : " disabled") + "> <span>" + esc(t("fx_on_label")) + "</span></label>" +
        editorHtml("fxm", w.fx_tiers, !own) +
        '<p class="fine-print">' + esc(t("fx_ed_hint")) + "</p>" +
        '<label class="field"><span>' + esc(t("fx_eta_label")) + '</span><select id="fxm-eta"' + (own ? "" : " disabled") + '><option value="">—</option>' +
          ETAS.map(function (m) { return '<option value="' + m + '"' + (Number(w.fx_eta) === m ? " selected" : "") + ">" + esc(etaName(m)) + "</option>"; }).join("") +
        "</select></label>" +
        '<label class="field"><span>' + esc(t("fx_note_label")) + '</span><textarea id="fxm-note" rows="3" maxlength="500" placeholder="' + esc(t("fx_note_ph")) + '"' + (own ? "" : " disabled") + ">" + esc(w.fx_note || "") + "</textarea></label>" +
        (own ? '<button class="btn btn-primary btn-block" type="submit">' + esc(t("fx_save")) + "</button>" : '<p class="fine-print">' + esc(t("fx_readonly")) + "</p>") +
      "</form>" + linkHtml() + "</section>";
  }

  function requestsHtml() {
    var list = fx.list.filter(function (r) { return fx.filter === "all" || r.status === "new" || r.status === "paid" || r.status === "confirmed"; });
    var html = '<section class="an-card fx-card"><h3>' + esc(t("fx_req_title")) + "</h3>" +
      '<div class="chips">' +
        '<button type="button" class="chip' + (fx.filter === "active" ? " active" : "") + '" data-fx-filter="active">' + esc(t("fx_active")) + " · " + countActive() + "</button>" +
        '<button type="button" class="chip' + (fx.filter === "all" ? " active" : "") + '" data-fx-filter="all">' + esc(t("fx_all")) + " · " + fx.list.length + "</button>" +
      "</div>";
    if (fx.loading && !fx.list.length) return html + '<div class="state-box">' + esc(t("loading")) + "</div></section>";
    if (!list.length) return html + '<div class="state-box">' + esc(t("fx_req_empty")) + "</div></section>";
    return html + '<div class="fx-list">' + list.map(function (r) {
      var phone = String(r.client_phone || ""), wa = phone.replace(/\D/g, "");
      var open = r.status === "new" || r.status === "paid" || r.status === "confirmed";
      var waText = t("fx_wa_status", { name: r.client_name, url: statusUrl(r.id) });
      return '<div class="fx-row st-' + esc(r.status) + '">' +
        '<div class="fx-row-top"><b>' + esc(r.client_name) + '</b><span class="fx-st">' + esc(t("fx_st_" + r.status)) + "</span></div>" +
        '<div class="fx-row-sum"><b>¥ ' + esc(money(r.cny)) + "</b> = " + esc(money(r.som)) + " " + esc(t("fx_som_short")) + " <small>(" + esc(rateStr(r.rate)) + ")</small></div>" +
        '<div class="fx-row-meta">' + esc(c.fmtDate(r.created_at)) + " · " + esc(c.fmtTime(r.created_at)) + "</div>" +
        (r.comment ? '<div class="fx-row-note">' + esc(r.comment) + "</div>" : "") +
        (r.status === "confirmed" && r.eta_until ? '<div class="fx-row-eta">' + esc(untilText(r.eta_until)) + "</div>" : "") +
        (r.buyer_note && open ? '<div class="fx-row-note">💬 ' + esc(r.buyer_note) + "</div>" : "") +
        (fx.confirming === r.id ? confirmHtml(r) : "") +
        '<div class="fx-row-act">' +
          (r.proof_path ? '<button type="button" class="btn btn-sm btn-primary" data-fx-proof="' + esc(r.proof_path) + '">' + esc(t("fx_proof_btn")) + "</button>" : "") +
          '<a class="btn btn-sm" href="tel:' + esc(phone) + '">' + esc(c.fmtPhone(phone)) + "</a>" +
          (wa ? '<a class="btn btn-sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + "?text=" + encodeURIComponent(waText) + '">WhatsApp</a>' : "") +
          (open && !state.readOnly && fx.confirming !== r.id
            ? (r.status === "confirmed"
                ? '<button type="button" class="btn btn-sm btn-primary" data-fx-st="done" data-fx-id="' + esc(r.id) + '">' + esc(t("fx_sent_btn")) + "</button>" +
                  '<button type="button" class="btn btn-sm" data-fx-confirm="' + esc(r.id) + '">' + esc(t("fx_eta_change")) + "</button>"
                : '<button type="button" class="btn btn-sm' + (r.status === "paid" ? " btn-primary" : "") + '" data-fx-confirm="' + esc(r.id) + '">' + esc(t("fx_confirm_btn")) + "</button>") +
              '<button type="button" class="btn btn-sm btn-ghost" data-fx-st="cancelled" data-fx-id="' + esc(r.id) + '">' + esc(t("fx_cancel_btn")) + "</button>"
            : "") +
        "</div></div>";
    }).join("") + "</div></section>";
  }

  // «Оплата получена»: байер выбирает, сколько ждать, и пишет клиенту (необязательно)
  function confirmHtml(r) {
    var def = Number(state.ws && state.ws.fx_eta) || 30;
    if (!fx.etaPick) fx.etaPick = def;
    return '<div class="fx-confirm">' +
      "<b>" + esc(t("fx_eta_q")) + "</b>" +
      '<div class="chips">' + ETAS.map(function (m) {
        return '<button type="button" class="chip' + (fx.etaPick === m ? " active" : "") + '" data-fx-eta="' + m + '">' + esc(etaName(m)) + "</button>";
      }).join("") + "</div>" +
      '<label class="field"><span>' + esc(t("fx_msg_label")) + '</span><input id="fx-msg" type="text" maxlength="300" placeholder="' + esc(t("fx_msg_ph")) + '" value="' + esc(r.buyer_note || "") + '"></label>' +
      '<div class="fx-row-act"><button type="button" class="btn btn-sm btn-primary" data-fx-confirm-go="' + esc(r.id) + '">' + esc(t("fx_confirm_go")) + "</button>" +
      '<button type="button" class="btn btn-sm btn-ghost" data-fx-confirm-x>' + esc(t("cancel")) + "</button></div></div>";
  }

  async function confirmPay(id) {
    var mins = fx.etaPick || 30, msg = ($("#fx-msg") && $("#fx-msg").value.trim()) || null;
    var v = { status: "confirmed", eta_until: new Date(Date.now() + mins * 60000).toISOString(), buyer_note: msg };
    var res = await c.db().from("exchange_requests").update(v).eq("id", id);
    if (res.error) { c.handleError(res.error); return; }
    fx.list.forEach(function (r) { if (r.id === id) Object.assign(r, v); });
    fx.confirming = null; fx.etaPick = null;
    toast(t("fx_confirmed"), "ok");
    render();
  }

  function render() {
    var box = $("#fx-body");
    if (!box) return;
    box.innerHTML = (state.ws ? requestsHtml() + myHtml() : "") + (kgBuyer() ? platformHtml() : "");
    updateCalc();
  }

  function updateCalc() {
    var inp = $("#fxp-cny"), out = $("#fxp-som"), tiers = fx.platform && fx.platform.tiers;
    if (!inp || !out) return;
    var cny = parseNum(inp.value) || 0, som = somFor(tiers, cny);
    out.textContent = (som == null ? "—" : money(som)) + " " + t("fx_som_short");
    var tb = $("#fxp-tiers");
    if (tb) tb.innerHTML = tiersHtml(tiers, cny);
  }

  async function open() {
    render();
    await Promise.all([loadPlatform(), state.ws ? loadRequests() : Promise.resolve()]);
    render();
  }

  // ---------- Действия ----------
  async function saveMine(e) {
    e.preventDefault();
    if (!canOwn()) return;
    var tiers = readEditor("fxm");
    if (!tiers) return;
    var on = $("#fxm-on").checked;
    if (on && !tiers.length) { toast(t("fx_e_rate"), "error"); return; }
    var v = { fx_on: on, fx_tiers: tiers.length ? tiers : null, fx_note: $("#fxm-note").value.trim().slice(0, 500) || null,
      fx_eta: Number($("#fxm-eta").value) || null };
    try {
      var res = await c.db().from("workspaces").update(v).eq("id", state.ws.id).select(c.WS_FIELDS).single();
      if (res.error) throw res.error;
      state.ws = res.data;
      if (state.myWs && state.myWs.id === res.data.id) state.myWs = res.data;
      toast(t("fx_saved"), "ok");
      render();
    } catch (err) { c.handleError(err); }
  }

  async function saveAdmin(e) {
    e.preventDefault();
    var tiers = readEditor("fxa");
    if (!tiers) return;
    var res = await c.db().rpc("admin_set_platform_fx", { p_tiers: tiers.length ? tiers : null, p_note: $("#fxa-note").value.trim() || null });
    if (res.error) { c.handleError(res.error); return; }
    toast(t("fx_saved"), "ok");
    await loadPlatform();
    render();
  }

  async function makeLink() {
    var res = await c.db().rpc("request_link_rotate", { p_ws: state.ws.id });
    if (res.error) { c.handleError(res.error); return; }
    state.ws.request_token = res.data;
    if (state.myWs && state.myWs.id === state.ws.id) state.myWs.request_token = res.data;
    render();
  }

  async function askAdmin() {
    var tiers = fx.platform && fx.platform.tiers, cny = parseNum($("#fxp-cny").value) || 0;
    if (!(cny > 0)) { toast(t("fx_e_amount"), "error"); $("#fxp-cny").focus(); return; }
    var rate = rateFor(tiers, cny);
    if (!rate) { toast(t("fx_e_min", { n: money(minOf(tiers)) }), "error"); return; }
    var som = somFor(tiers, cny);
    var text = t("fx_admin_msg", { cny: money(cny), som: money(som), r: rateStr(rate) });
    var btn = $("#fxp-send");
    btn.disabled = true;
    var res = await c.db().rpc("support_send", { p_body: text, p_meta: { kind: "fx", cny: cny, som: som, rate: rate } });
    btn.disabled = false;
    if (res.error) {
      if (/too_many_messages/.test(res.error.message || "")) toast(t("support_too_many"), "error");
      else c.handleError(res.error);
      return;
    }
    try { c.db().functions.invoke("telegram-notify", { body: { action: "notify" } }).catch(function () {}); } catch (e) { /* ignore */ }
    $("#fxp-cny").value = "";
    updateCalc();
    toast(t("fx_sent_admin"), "ok");
  }

  async function setStatus(id, status) {
    var res = await c.db().from("exchange_requests").update({ status: status }).eq("id", id);
    if (res.error) { c.handleError(res.error); return; }
    fx.list.forEach(function (r) { if (r.id === id) r.status = status; });
    setBadge(countActive());
    render();
  }

  async function showProof(path) {
    var res = await c.db().storage.from("fx-proofs").createSignedUrl(path, 3600);
    if (res.error || !res.data) { toast(t("error_generic"), "error"); return; }
    c.openLightbox([res.data.signedUrl], 0);
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var box = $("#fx-body");
    box.addEventListener("input", function (e) {
      if (e.target.id === "fxp-cny") updateCalc();
    });
    box.addEventListener("submit", function (e) {
      if (e.target.id === "fxm-form") saveMine(e);
      else if (e.target.id === "fxa-form") saveAdmin(e);
    });
    box.addEventListener("click", async function (e) {
      if (e.target.closest("#fxp-send")) { askAdmin(); return; }
      if (e.target.closest("#fx-link-make")) { makeLink(); return; }
      if (e.target.closest("#fx-link-copy")) {
        var ok = await c.copyText($("#fx-link-input").value);
        toast(ok ? t("copied") : t("error_generic"), ok ? "ok" : "error");
        return;
      }
      var add = e.target.closest("[data-fx-addrow]");
      if (add) {
        var ed = $("#" + add.getAttribute("data-fx-addrow") + "-ed");
        if (ed.querySelectorAll(".fx-ed-row").length >= MAX_TIERS) { toast(t("fx_e_many", { n: MAX_TIERS }), "error"); return; }
        ed.insertAdjacentHTML("beforeend", edRowHtml({ from: "", rate: "" }, ""));
        ed.lastElementChild.querySelector("input").focus();
        return;
      }
      var del = e.target.closest("[data-fx-delrow]");
      if (del) {
        var row = del.closest(".fx-ed-row");
        if (row.parentNode.querySelectorAll(".fx-ed-row").length > 1) row.remove();
        else row.querySelectorAll("input").forEach(function (i) { i.value = ""; });
        return;
      }
      var cf = e.target.closest("[data-fx-confirm]");
      if (cf) { fx.confirming = cf.getAttribute("data-fx-confirm"); fx.etaPick = null; render(); return; }
      var et = e.target.closest("[data-fx-eta]");
      if (et) { fx.etaPick = Number(et.getAttribute("data-fx-eta")); var keep = $("#fx-msg") && $("#fx-msg").value; render(); if (keep != null && $("#fx-msg")) $("#fx-msg").value = keep; return; }
      if (e.target.closest("[data-fx-confirm-x]")) { fx.confirming = null; render(); return; }
      var go = e.target.closest("[data-fx-confirm-go]");
      if (go) { confirmPay(go.getAttribute("data-fx-confirm-go")); return; }
      var pr = e.target.closest("[data-fx-proof]");
      if (pr) { showProof(pr.getAttribute("data-fx-proof")); return; }
      var f = e.target.closest("[data-fx-filter]");
      if (f) { fx.filter = f.getAttribute("data-fx-filter"); render(); return; }
      var s = e.target.closest("[data-fx-st]");
      if (s) setStatus(s.getAttribute("data-fx-id"), s.getAttribute("data-fx-st"));
    });
  }

  // =====================================================
  //  ДЛЯ КЛИЕНТА: курс, калькулятор, заявка, оплата и скриншот
  //  (страница ?fx=…, витрина, страница заказа, общая ссылка)
  // =====================================================
  // step: calc → form → pay (реквизиты, загрузка скриншота) → done
  var pub = { kind: "", token: "", fx: null, cny: "", name: "", phone: "", comment: "", step: "calc", error: "", busy: false, req: null };

  // kind: 'shop' | 'order' | 'cab'; slot — пустой <div>, куда рисуется блок
  function mountPublic(slot, data, kind, token) {
    if (!slot) return;
    if (!data || !sortTiers(data.tiers).length) { slot.innerHTML = ""; return; }
    if (pub.token !== token || pub.kind !== kind) { pub.step = "calc"; pub.error = ""; pub.req = null; }
    pub.fx = data; pub.kind = kind; pub.token = token;
    renderPublic(slot);
    slot.oninput = function (e) {
      if (e.target.id === "fxc-cny") { pub.cny = e.target.value; showSom(slot); }
      else if (e.target.id === "fxc-name") pub.name = e.target.value;
      else if (e.target.id === "fxc-phone") pub.phone = e.target.value;
      else if (e.target.id === "fxc-comment") pub.comment = e.target.value;
    };
    slot.onchange = function (e) {
      if (e.target.id === "fxc-file" && e.target.files && e.target.files[0]) uploadProof(slot, e.target.files[0]);
    };
    slot.onclick = function (e) {
      var b = e.target.closest("[data-fxc]");
      if (!b) return;
      var a = b.getAttribute("data-fxc");
      if (a === "form") {
        var cny = parseNum(pub.cny) || 0;
        if (!(cny > 0)) { pub.error = t("fx_e_amount"); renderPublic(slot); return; }
        if (!rateFor(pub.fx.tiers, cny)) { pub.error = t("fx_e_min", { n: money(minOf(pub.fx.tiers)) }); renderPublic(slot); return; }
        pub.error = ""; pub.step = "form"; renderPublic(slot);
        var n = slot.querySelector("#fxc-name"); if (n) n.focus();
      } else if (a === "back") { pub.step = "calc"; pub.error = ""; renderPublic(slot); }
      else if (a === "pick") { var f = slot.querySelector("#fxc-file"); if (f) f.click(); }
      else if (a === "again") { pub.step = "calc"; pub.cny = ""; pub.comment = ""; pub.req = null; renderPublic(slot); }
    };
    slot.onsubmit = function (e) {
      if (e.target.id === "fxc-form") { e.preventDefault(); sendPublic(slot); }
    };
  }

  function showSom(slot) {
    var out = slot.querySelector("#fxc-som"), cny = parseNum(pub.cny) || 0, som = somFor(pub.fx.tiers, cny);
    if (out) out.textContent = (som == null ? "—" : money(som)) + " " + t("fx_som_short");
    var tb = slot.querySelector(".fx-tiers-wrap");
    if (tb) tb.innerHTML = tiersHtml(pub.fx.tiers, cny);
  }

  function renderPublic(slot) {
    var f = pub.fx, req = pub.req;
    var html = '<section class="client-block fx-pub"><h2 class="fx-pub-title">' + esc(t("fx_pub_title")) + "</h2>";
    if (pub.step === "pay" || pub.step === "done") {
      html += '<div class="fx-sumbox"><span>' + esc(t("fx_to_pay")) + "</span><b>" + esc(money(req.som)) + " " + esc(t("fx_som_short")) + "</b>" +
        "<small>¥ " + esc(money(req.cny)) + " · " + esc(t("fx_rate_line", { r: rateStr(req.rate) })) + "</small></div>";
      var trackBtn = req.id ? '<a class="btn btn-block" href="' + esc(statusUrl(req.id)) + '">' + esc(t("fx_track")) + "</a>" : "";
      if (pub.step === "done") {
        html += '<p class="fx-ok">' + esc(t("fx_pub_done")) + "</p>" +
          (f.eta ? '<p class="muted">' + esc(t("fx_eta_usual", { n: etaName(f.eta) })) + "</p>" : "") +
          trackBtn +
          '<button type="button" class="btn btn-ghost btn-block" data-fxc="again">' + esc(t("fx_pub_again")) + "</button>";
      } else {
        html += (req.note ? '<div class="fx-req"><h3>' + esc(t("fx_requisites")) + '</h3><p class="fx-note">' + esc(req.note) + "</p></div>" : "") +
          '<p class="muted">' + esc(t("fx_pay_hint")) + "</p>" +
          '<input id="fxc-file" type="file" accept="image/*" hidden>' +
          (pub.error ? '<p class="form-error" role="alert">' + esc(pub.error) + "</p>" : "") +
          '<button type="button" class="btn btn-primary btn-block" data-fxc="pick"' + (pub.busy ? " disabled" : "") + ">" +
            esc(t(pub.busy ? "fx_uploading" : "fx_upload")) + "</button>" +
          (f.eta ? '<p class="muted">' + esc(t("fx_eta_usual", { n: etaName(f.eta) })) + "</p>" : "") +
          trackBtn +
          '<p class="fine-print">' + esc(t("fx_pay_later")) + "</p>";
      }
      slot.innerHTML = html + "</section>";
      return;
    }
    html += (f.updated_at ? '<p class="fx-date ' + (isToday(f.updated_at) ? "" : "old") + '">' + esc(dateLine(f.updated_at)) + "</p>" : "") +
      (f.eta ? '<p class="fx-eta-usual">⏱ ' + esc(t("fx_eta_usual", { n: etaName(f.eta) })) + "</p>" : "") +
      '<div class="fx-tiers-wrap">' + tiersHtml(f.tiers, parseNum(pub.cny) || 0) + "</div>";
    if (pub.step === "form") {
      var cny = parseNum(pub.cny);
      html += '<div class="fx-sumbox"><span>' + esc(t("fx_to_pay")) + "</span><b>" + esc(money(somFor(f.tiers, cny))) + " " + esc(t("fx_som_short")) + "</b>" +
          "<small>¥ " + esc(money(cny)) + "</small></div>" +
        '<form id="fxc-form" novalidate autocomplete="on">' +
        '<label class="field"><span>' + esc(t("rq_name")) + '</span><input id="fxc-name" type="text" autocomplete="name" maxlength="120" value="' + esc(pub.name) + '"></label>' +
        '<label class="field"><span>' + esc(t("rq_phone")) + '</span><input id="fxc-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+996 555 123 456" value="' + esc(pub.phone) + '"></label>' +
        '<label class="field"><span>' + esc(t("rq_comment")) + '</span><textarea id="fxc-comment" rows="2" maxlength="500" placeholder="' + esc(t("fx_comment_ph")) + '">' + esc(pub.comment) + "</textarea></label>" +
        '<div class="hp" aria-hidden="true"><label>Website<input id="fxc-website" type="text" tabindex="-1" autocomplete="off"></label></div>' +
        (pub.error ? '<p class="form-error" role="alert">' + esc(pub.error) + "</p>" : "") +
        '<button class="btn btn-primary btn-block" type="submit"' + (pub.busy ? " disabled" : "") + ">" + esc(t(pub.busy ? "rq_sending" : "fx_pub_send")) + "</button>" +
        '<button type="button" class="btn btn-ghost btn-block" data-fxc="back">← ' + esc(t("fx_back")) + "</button>" +
        '<p class="fine-print">' + esc(t("rq_consent")) + ' <a href="privacy.html">' + esc(t("legal_privacy")) + "</a>.</p>" +
        "</form>";
    } else {
      html += '<div class="fx-calc">' +
        '<label class="field"><span>' + esc(t("fx_cny")) + '</span><input id="fxc-cny" type="text" inputmode="decimal" autocomplete="off" placeholder="' + esc(money(minOf(f.tiers) || 1000)) + '" value="' + esc(pub.cny) + '"></label>' +
        '<div class="fx-out"><span>' + esc(t("fx_pay")) + '</span><b id="fxc-som">0</b></div></div>' +
        (pub.error ? '<p class="form-error" role="alert">' + esc(pub.error) + "</p>" : "") +
        '<button type="button" class="btn btn-primary btn-block" data-fxc="form">' + esc(t("fx_pub_btn")) + "</button>";
    }
    slot.innerHTML = html + "</section>";
    if (pub.step === "calc") showSom(slot);
  }

  async function sendPublic(slot) {
    if (pub.busy) return;
    var name = pub.name.trim(), phone = c.cleanPhone(pub.phone);
    if (name.length < 2) { pub.error = t("e_name"); return renderPublic(slot); }
    if (!/^\+?\d{9,15}$/.test(phone)) { pub.error = t("e_phone"); return renderPublic(slot); }
    pub.error = ""; pub.busy = true; renderPublic(slot);
    try {
      var hp = slot.querySelector("#fxc-website");
      var res = await c.db().rpc("submit_exchange", {
        p_kind: pub.kind, p_token: pub.token, p_name: name, p_phone: phone,
        p_cny: parseNum(pub.cny), p_comment: pub.comment.trim() || null, p_website: (hp && hp.value) || null
      });
      if (res.error) throw res.error;
      var r = res.data || {};
      pub.req = { id: r.id, cny: num(r.cny), som: num(r.som), rate: num(r.rate), note: r.note || "" };
      if (r.id) rememberReq(r.id);
      pub.step = "pay";
      // сообщить байеру в Telegram (если подключён)
      try { if (r.id) c.db().functions.invoke("telegram-notify", { body: { action: "exchange_notify", id: r.id } }).catch(function () {}); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error(err);
      pub.error = errText(err);
    }
    pub.busy = false;
    renderPublic(slot);
    slot.scrollIntoView({ block: "start" });
  }

  function errText(err) {
    var m = String((err && err.message) || "");
    if (/below_min/.test(m)) return t("fx_e_min", { n: money(minOf(pub.fx.tiers)) });
    if (/fx_off|link_not_found/.test(m)) return t("fx_e_off");
    if (/too_many/.test(m)) return t("rq_err_many");
    if (/invalid_phone/.test(m)) return t("e_phone");
    if (/invalid_name/.test(m)) return t("e_name");
    return t("rq_err");
  }

  // загрузить скриншот к заявке и отметить «оплачено» (общая часть для блока и страницы статуса)
  async function sendProof(id, file) {
    if (!/^image\//.test(file.type || "")) throw new Error("bad_type");
    var blob = await c.shrinkImage(file, 1600, 400 * 1024, true);
    if (blob.size > 5 * 1024 * 1024) throw new Error("too_big");
    var ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
    var path = id + "/" + Date.now().toString(36) + "." + ext;
    var up = await c.db().storage.from("fx-proofs").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (up.error) throw up.error;
    var at = await c.db().rpc("fx_attach_proof", { p_id: id, p_path: path });
    if (at.error) throw at.error;
    try { c.db().functions.invoke("telegram-notify", { body: { action: "exchange_paid", id: id } }).catch(function () {}); } catch (e) { /* ignore */ }
  }
  function proofErr(err) {
    var m = String((err && err.message) || "");
    return /bad_type/.test(m) ? t("logo_err_type") : /too_big/.test(m) ? t("logo_err_size") : t("fx_e_upload");
  }

  async function uploadProof(slot, file) {
    if (pub.busy || !pub.req || !pub.req.id) return;
    pub.error = ""; pub.busy = true; renderPublic(slot);
    try {
      await sendProof(pub.req.id, file);
      pub.step = "done";
    } catch (err) {
      console.error(err);
      pub.error = proofErr(err);
    }
    pub.busy = false;
    renderPublic(slot);
  }

  // ---------- Отдельная страница обмена (?fx=ТОКЕН) ----------
  var page = { mode: "fx", token: "", data: null, state: "loading", id: "", st: null, busy: false, error: "", timer: null };

  async function initPage(token) {
    c.showView("shop");
    page.token = String(token || "").toLowerCase();
    page.state = "loading";
    renderPage();
    if (!/^[a-f0-9]{32}$/.test(page.token)) { page.state = "notfound"; renderPage(); return; }
    try {
      var res = await c.db().rpc("get_shop", { p_token: page.token });
      if (res.error) throw res.error;
      page.data = res.data;
      page.state = res.data && res.data.fx ? "ok" : "notfound";
    } catch (err) {
      console.error(err);
      page.state = "error";
    }
    renderPage();
  }

  // ---------- Страница статуса заявки (?xr=НОМЕР) ----------
  var FINAL = ["done", "cancelled"];

  async function initStatus(id) {
    c.showView("shop");
    page.mode = "status";
    page.id = String(id || "").toLowerCase();
    page.state = "loading";
    renderPage();
    bindStatus();
    await loadStatus();
  }

  async function loadStatus() {
    if (!/^[0-9a-f-]{36}$/.test(page.id)) { page.state = "notfound"; renderPage(); return; }
    try {
      var res = await c.db().rpc("get_exchange_status", { p_id: page.id });
      if (res.error) throw res.error;
      page.st = res.data;
      page.state = res.data ? "ok" : "notfound";
    } catch (err) {
      console.error(err);
      if (!page.st) page.state = "error";
    }
    renderPage();
    // пока заявка не завершена — обновляем сами каждые 30 секунд
    clearTimeout(page.timer);
    if (page.st && FINAL.indexOf(page.st.status) === -1) page.timer = setTimeout(loadStatus, 30000);
  }

  var STEPS = ["new", "paid", "confirmed", "done"];
  function statusHtml() {
    var s = page.st, i = STEPS.indexOf(s.status), cancelled = s.status === "cancelled";
    var html = '<section class="client-block fx-status st-' + esc(s.status) + '">' +
      '<p class="fx-status-label">' + esc(t("fx_status_title")) + "</p>" +
      "<h1>" + esc(t("fx_s_" + s.status)) + "</h1>" +
      '<div class="fx-sumbox"><span>¥ ' + esc(money(s.cny)) + "</span><b>" + esc(money(s.som)) + " " + esc(t("fx_som_short")) + "</b>" +
        "<small>" + esc(t("fx_rate_line", { r: rateStr(s.rate) })) + "</small></div>";
    if (s.status === "confirmed" && s.eta_until) {
      var late = new Date(s.eta_until) < new Date();
      html += '<div class="fx-eta-big' + (late ? " late" : "") + '">' + esc(late ? t("fx_late") : untilText(s.eta_until)) + "</div>";
    } else if (s.status === "paid") {
      html += '<p class="muted">' + esc(s.eta ? t("fx_paid_wait", { n: etaName(s.eta) }) : t("fx_paid_wait0")) + "</p>";
    }
    if (s.buyer_note && !cancelled) html += '<div class="fx-msg">💬 ' + esc(s.buyer_note) + "</div>";
    if (!cancelled) {
      html += '<ol class="fx-steps">' + STEPS.map(function (k, n) {
        return '<li class="' + (n < i ? "ok" : n === i ? "cur" : "") + '">' + esc(t("fx_step_" + k)) + "</li>";
      }).join("") + "</ol>";
    }
    if (s.status === "new") {
      html += (s.note ? '<div class="fx-req"><h3>' + esc(t("fx_requisites")) + '</h3><p class="fx-note">' + esc(s.note) + "</p></div>" : "") +
        (s.can_upload
          ? '<p class="muted">' + esc(t("fx_pay_hint")) + "</p>" +
            '<input id="fxs-file" type="file" accept="image/*" hidden>' +
            (page.error ? '<p class="form-error" role="alert">' + esc(page.error) + "</p>" : "") +
            '<button type="button" class="btn btn-primary btn-block" id="fxs-pick"' + (page.busy ? " disabled" : "") + ">" + esc(t(page.busy ? "fx_uploading" : "fx_upload")) + "</button>"
          : "");
    }
    html += '<p class="fine-print">' + esc(t("fx_created", { d: c.fmtDate(s.created_at) + " " + hhmm(s.created_at) })) +
      (FINAL.indexOf(s.status) === -1 ? " · " + esc(t("fx_auto")) : "") + "</p>" +
      '<button type="button" class="btn btn-ghost btn-block" id="fxs-refresh">' + esc(t("refresh")) + "</button>";
    return html + "</section>";
  }

  var statusBound = false;
  function bindStatus() {
    if (statusBound) return;
    statusBound = true;
    var box = $("#shop-content");
    box.addEventListener("click", function (e) {
      if (page.mode !== "status") return;
      if (e.target.closest("#fxs-refresh")) { loadStatus(); return; }
      if (e.target.closest("#fxs-pick")) { var f = $("#fxs-file"); if (f) f.click(); }
    });
    box.addEventListener("change", async function (e) {
      if (page.mode !== "status" || e.target.id !== "fxs-file" || !e.target.files || !e.target.files[0]) return;
      page.busy = true; page.error = ""; renderPage();
      try { await sendProof(page.id, e.target.files[0]); rememberReq(page.id); }
      catch (err) { console.error(err); page.error = proofErr(err); }
      page.busy = false;
      await loadStatus();
    });
  }

  function myReqsHtml() {
    var list = myReqs();
    if (!list.length) return "";
    return '<section class="client-block"><h2>' + esc(t("fx_my_reqs")) + '</h2><div class="fx-my-list">' + list.map(function (x) {
      return '<a class="btn btn-block" href="' + esc(statusUrl(x.id)) + '">' + esc(t("fx_req_from", { d: c.fmtDate(new Date(x.at)) + " " + hhmm(new Date(x.at)) })) + "</a>";
    }).join("") + "</div></section>";
  }

  function renderPage() {
    var box = $("#shop-content");
    if (!box) return;
    if (page.mode === "status") {
      var b = page.st && page.st.brand;
      if (U.client) U.client.applyBrand(b && b.logo ? b : null);
      if (page.state === "loading") { box.innerHTML = '<div class="state-box">' + esc(t("loading")) + "</div>"; return; }
      if (page.state !== "ok") {
        box.innerHTML = '<section class="client-block notfound"><h1>' + esc(t(page.state === "error" ? "rq_err_title" : "fx_st_none")) + "</h1>" +
          '<p class="muted">' + esc(t(page.state === "error" ? "rq_err_load" : "fx_st_none_hint")) + "</p></section>";
        return;
      }
      box.innerHTML = (b && b.name ? '<section class="sp-head"><h1 class="rq-title">' + esc(b.name) + "</h1></section>" : "") + statusHtml();
      return;
    }
    var d = page.data || {};
    if (U.client) U.client.applyBrand(d.logo ? { name: d.name, logo: d.logo } : null);
    if (page.state === "loading") { box.innerHTML = '<div class="state-box">' + esc(t("loading")) + "</div>"; return; }
    if (page.state !== "ok") {
      box.innerHTML = '<section class="client-block notfound"><h1>' + esc(t(page.state === "error" ? "rq_err_title" : "fx_page_none")) + "</h1>" +
        '<p class="muted">' + esc(t(page.state === "error" ? "rq_err_load" : "fx_e_off")) + "</p></section>";
      return;
    }
    box.innerHTML = '<section class="sp-head"><h1 class="rq-title">' + esc(d.name || t("fx_pub_title")) + "</h1>" +
      '<p class="muted">' + esc(t("fx_page_hint")) + '</p></section><div id="fx-pub-slot-page"></div>' + myReqsHtml();
    mountPublic($("#fx-pub-slot-page"), d.fx, "shop", page.token);
  }

  U.exchange = { bind: bind, open: open, render: render, loadCount: loadCount, mountPublic: mountPublic,
    initPage: initPage, initStatus: initStatus, renderPage: renderPage, bestRate: bestRate };
})(window.ULA);
