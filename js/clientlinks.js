// =====================================================
// ULA FACTORY — «Совпадения клиентов» (файл 56).
//
// Клиента определяет его постоянный номер в базе (clients.id), а не «последние 9 цифр телефона или имя».
// Если у двух клиентов совпал телефон, 9 цифр или имя, программа ТОЛЬКО предлагает: «возможно, один человек».
// Ничего не объединяется само: владелец кабинета решает по одной паре и подтверждает действие.
// Здесь же — «неразобранная» предоплата из старых данных: деньги, ключ которых был общим у нескольких людей.
// Они не входят ни в чей баланс, но видны в сверке. Владелец решает по КАЖДОЙ операции отдельно (клиент выбирается
// вручную, ничего не предлагается «по умолчанию»); каждое решение пишется в журнал и сверяется с итогами.
// Здесь же правка имени/телефона/Telegram клиента, в том числе клиента без адреса.
//
// ULA.clientlinks: refreshBadge(), open(), editClient(id), deliveryHtml(order)  — адрес заказа от клиента: принять / отклонить (файл 61)
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state, toast = c.toast, cur = c.cur, num = c.num;

  var ui = { pairs: [], wallet: [], recon: [], loaded: false, busy: false, ready: false };

  function owner() { return !state.myRole || state.myRole === "owner"; }
  function wsId() { return state.ws && state.ws.id; }

  function fetchAll() {
    var db = c.db(), ws = wsId();
    if (!db || !ws) return Promise.resolve(null);
    return Promise.all([
      db.rpc("client_link_candidates", { p_ws: ws }),
      db.rpc("client_wallet_review", { p_ws: ws }),
      db.rpc("wallet_reconcile", { p_ws: ws })
    ]).then(function (r) {
      if (!state.ws || state.ws.id !== ws) return null;
      if (r[0].error || r[1].error || r[2].error) return { error: r[0].error || r[1].error || r[2].error };
      return { pairs: r[0].data || [], wallet: r[1].data || [], recon: r[2].data || [] };
    }).catch(function (e) { return { error: e }; });
  }

  // кнопка «Совпадения (N)» в разделе «Клиенты»; без файла 56 кнопки нет
  function refreshBadge() {
    var btn = $("#cl-links-btn");
    if (!btn) return Promise.resolve();
    return fetchAll().then(function (d) {
      if (!d) return;
      ui.ready = !d.error;
      btn.classList.toggle("hidden", !ui.ready);
      if (!ui.ready) return;
      ui.pairs = d.pairs; ui.wallet = d.wallet; ui.recon = d.recon; ui.loaded = true;
      var n = d.pairs.length + ui.wallet.length;
      btn.textContent = t("cl_links_btn") + (n ? " (" + n + ")" : "");
      if (isOpen()) render();
    });
  }

  function ensureModal() {
    var m = $("#modal-clinks");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-clinks";
    m.className = "modal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="cll-title">' +
      '<div class="modal-head"><h2 id="cll-title"></h2><button class="icon-btn" type="button" data-close aria-label="Close">×</button></div>' +
      '<div class="modal-body" id="cll-body"></div></div>';
    document.body.appendChild(m);
    return m;
  }
  function isOpen() { var m = $("#modal-clinks"); return !!(m && m.classList.contains("open")); }

  function open() {
    ensureModal();
    $("#cll-title").textContent = t("cl_links_title");
    render();
    c.openModal("modal-clinks");
    refreshBadge();
  }

  function person(id, name, phone, orders) {
    return '<div class="cll-person"><b>' + esc(name || "—") + "</b>" +
      (phone ? "<span>" + esc(c.fmtPhone ? c.fmtPhone(phone) : phone) + "</span>" : "<span class=\"muted\">—</span>") +
      '<small class="muted">' + esc(t("cl_links_orders", { n: orders })) + "</small></div>";
  }

  function render() {
    var body = $("#cll-body");
    if (!body) return;
    var own = owner(), h = '<p class="muted">' + esc(t("cl_links_hint")) + "</p>";
    if (!own) h += '<p class="muted">' + esc(t("cl_links_owner_only")) + "</p>";

    h += '<h3 class="wl-h">' + esc(t("cl_links_pairs")) + "</h3>";
    if (!ui.loaded) h += '<p class="muted">…</p>';
    else if (!ui.pairs.length) h += '<p class="muted">' + esc(t("cl_links_none")) + "</p>";
    else h += '<ol class="cll-list">' + ui.pairs.map(function (p) {
      return '<li class="cll-item">' +
        '<div class="cll-pair">' + person(p.a_id, p.a_name, p.a_phone, p.a_orders) + person(p.b_id, p.b_name, p.b_phone, p.b_orders) + "</div>" +
        '<p class="cll-reason' + (p.reason === "same_phone" ? "" : " warn") + '">' + esc(t("cl_links_r_" + p.reason)) + "</p>" +
        (own ? '<div class="cll-acts">' +
          '<button type="button" class="btn btn-primary" data-cll-merge="' + esc(p.a_id) + "|" + esc(p.b_id) + '">' + esc(t("cl_links_same")) + "</button>" +
          '<button type="button" class="btn btn-light" data-cll-diff="' + esc(p.a_id) + "|" + esc(p.b_id) + '">' + esc(t("cl_links_diff")) + "</button></div>" : "") +
      "</li>";
    }).join("") + "</ol>";

    var unres = (ui.recon || []).filter(function (x) { return Math.abs(num(x.unassigned)) > 0.004 || x.unassigned_rows > 0; });
    if (ui.loaded && (ui.wallet.length || unres.length)) {
      h += '<h3 class="wl-h">' + esc(t("cl_links_wallet")) + '</h3><p class="muted">' + esc(t("cl_links_wallet_hint")) + "</p>";
      h += '<h4 class="wl-h">' + esc(t("cl_links_recon")) + "</h4><ul class=\"cll-recon\">" + ui.recon.map(function (x) {
        return "<li" + (x.unassigned_rows > 0 ? ' class="warn"' : "") + ">" + esc(t("cl_links_recon_line", {
          c: x.currency, t: cur(x.total, x.currency), a: cur(x.assigned, x.currency), u: cur(x.unassigned, x.currency), k: x.unassigned_rows })) + "</li>";
      }).join("") + "</ul>";
      h += '<ol class="cll-list">' + ui.wallet.map(function (w, i) {
        var cands = w.candidates || [];
        var kind = kindLabel(w);
        var nm = String(w.client_name || "").trim();
        return '<li class="cll-item"><div class="cll-pair"><div class="cll-person"><b>' + cur(w.amount, w.currency) + "</b>" +
          "<span>" + esc(kind) + "</span>" +
          '<small class="muted">' + esc(c.fmtDate ? c.fmtDate(String(w.created_at).slice(0, 10)) : String(w.created_at).slice(0, 10)) +
          (nm ? " · " + esc(nm) : "") + (w.note ? " · " + esc(w.note) : "") + "</small></div></div>" +
          (own ? '<div class="cll-acts"><select data-cll-sel="' + i + '" aria-label="' + esc(t("cl_links_pick")) + '"><option value="">' + esc(t("cl_links_pick")) + "</option>" +
            cands.map(function (k) { return '<option value="' + esc(k.id) + '">' + esc(k.name + (k.phone ? " · " + (c.fmtPhone ? c.fmtPhone(k.phone) : k.phone) : "")) + "</option>"; }).join("") +
            (nm.length >= 2 && !w.order_number ? '<option value="new">' + esc(t("cl_links_new_opt", { n: nm })) + "</option>" : "") +
            '</select><button type="button" class="btn btn-light" data-cll-assign="' + i + '">' + esc(t("cl_links_assign")) + "</button></div>" : "") +
          "</li>";
      }).join("") + "</ol>";
    }
    body.innerHTML = h;
  }

  function kindLabel(w) {
    return w.kind === "order" ? t("wl_k_order", { n: w.order_number || "—" })
      : w.kind === "return" ? t("wl_k_return", { n: w.order_number || "—" }) : t("wl_k_" + w.kind);
  }

  function find(id) {
    for (var i = 0; i < ui.pairs.length; i++) {
      var p = ui.pairs[i];
      if (p.a_id === id) return { id: p.a_id, name: p.a_name };
      if (p.b_id === id) return { id: p.b_id, name: p.b_name };
    }
    return { id: id, name: "" };
  }

  function run(promise, okText) {
    if (ui.busy) return;
    ui.busy = true;
    promise.then(function (r) {
      ui.busy = false;
      if (r.error) {
        var em = String(r.error.message || "");
        if (/negative_balance/.test(em)) toast(t("cl_links_err_neg"), "error");
        else if (/already_assigned/.test(em)) { toast(t("cl_links_err_done"), "error"); refreshBadge(); }
        else if (/order_client_mismatch/.test(em)) toast(t("cl_links_err_order"), "error");
        else c.handleError(r.error);
        return;
      }
      toast(okText(r.data), "ok");
      return Promise.resolve(c.reloadOrders ? c.reloadOrders(true) : null).then(function () {
        return Promise.resolve(U.wallet && U.wallet.load ? U.wallet.load() : null).then(function () {
          if (c.renderAll) c.renderAll();
          return refreshBadge();
        });
      });
    });
  }

  function merge(pair) {
    var ids = pair.split("|"), a = find(ids[0]), b = find(ids[1]);
    if (!window.confirm(t("cl_links_merge_q", { a: a.name, b: b.name }))) return;
    run(c.db().rpc("client_merge", { p_keep: ids[0], p_drop: ids[1] }), function (d) {
      d = d || {};
      return t("cl_links_merged", { o: d.orders || 0, w: d.wallet_rows || 0, l: d.links_revoked || 0 });
    });
  }
  function dismiss(pair) {
    var ids = pair.split("|");
    run(c.db().rpc("client_link_dismiss", { p_a: ids[0], p_b: ids[1] }), function () { return t("cl_links_dismissed"); });
  }
  // одна операция — одно подтверждённое решение
  function assign(i) {
    var w = ui.wallet[i], sel = document.querySelector('[data-cll-sel="' + i + '"]');
    if (!w || !sel) return;
    var v = sel.value;
    if (!v) { toast(t("cl_links_pick"), "error"); return; }
    var name = v === "new" ? String(w.client_name || "").trim()
      : ((w.candidates || []).filter(function (k) { return k.id === v; })[0] || {}).name;
    var sum = cur(w.amount, w.currency).replace(/&amp;/g, "&");
    if (!window.confirm(t("cl_links_assign_q", { s: sum, k: kindLabel(w), n: name || "—" }))) return;
    var row = v === "new" ? { id: w.id, new_name: name } : { id: w.id, client: v };
    run(c.db().rpc("client_wallet_assign_rows", { p_ws: wsId(), p_rows: [row] }), function () { return t("cl_links_assigned"); });
  }

  // ---------- Правка клиента (в том числе без адреса) ----------
  function ensureEdit() {
    var m = $("#modal-cledit");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-cledit";
    m.className = "modal modal-small";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="cle-title">' +
      '<div class="modal-head"><h2 id="cle-title"></h2><button class="icon-btn" type="button" data-close aria-label="Close">×</button></div>' +
      '<form class="modal-body" id="cle-form" novalidate>' +
      '<label class="field"><span id="cle-l-name"></span><input id="cle-name" maxlength="120" autocomplete="off"></label>' +
      '<label class="field"><span id="cle-l-phone"></span><input id="cle-phone" type="tel" maxlength="30" autocomplete="off"></label>' +
      '<label class="field"><span id="cle-l-tg"></span><input id="cle-tg" maxlength="40" autocomplete="off"></label>' +
      '<p class="field-hint" id="cle-hint"></p><p class="field-error" id="cle-err" role="alert"></p>' +
      '<div class="modal-actions"><button class="btn btn-primary" type="submit" id="cle-save"></button></div></form></div>';
    document.body.appendChild(m);
    m.addEventListener("submit", function (e) { e.preventDefault(); saveEdit(); });
    return m;
  }
  var editing = null;
  function editClient(id) {
    var cl = (state.clients || []).filter(function (x) { return x.id === id; })[0];
    if (!cl) return;
    editing = cl;
    ensureEdit();
    $("#cle-title").textContent = t("cl_edit_title");
    $("#cle-l-name").textContent = t("l_name"); $("#cle-l-phone").textContent = t("l_phone"); $("#cle-l-tg").textContent = t("l_telegram");
    $("#cle-hint").textContent = t("cl_edit_hint"); $("#cle-save").textContent = t("cl_edit_save"); $("#cle-err").textContent = "";
    $("#cle-name").value = cl.name || ""; $("#cle-phone").value = cl.phone || ""; $("#cle-tg").value = cl.telegram ? "@" + String(cl.telegram).replace(/^@/, "") : "";
    c.openModal("modal-cledit");
  }
  function saveEdit() {
    if (!editing || ui.busy || state.readOnly) return;
    var name = $("#cle-name").value.trim(), err = $("#cle-err");
    var phone = $("#cle-phone").value.replace(/[\s().-]/g, "");
    if (/^00/.test(phone)) phone = "+" + phone.slice(2);
    var tg = $("#cle-tg").value.trim().replace(/^(https?:\/\/)?(t\.me\/)?@?/i, "");
    if (name.length < 2 || name.length > 120) { err.textContent = t("cl_edit_err_name"); return; }
    if (phone && !/^\+?[0-9]{9,15}$/.test(phone)) { err.textContent = t("cl_edit_err_phone"); return; }
    if (tg && !/^[A-Za-z0-9_]{5,32}$/.test(tg)) { err.textContent = t("cl_edit_err_tg"); return; }
    ui.busy = true;
    c.db().from("clients").update({ name: name, phone: phone || null, telegram: tg || null })
      .eq("id", editing.id).eq("workspace_id", state.ws.id).select("id").then(function (r) {
        ui.busy = false;
        if (r.error || !r.data || !r.data.length) { c.handleError(r.error || new Error("not saved")); return; }
        toast(t("cl_edit_ok"), "ok");
        c.closeModal("modal-cledit");
        return Promise.resolve(c.loadClients ? c.loadClients() : null).then(function () { return c.reloadOrders ? c.reloadOrders(true) : null; });
      });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#cl-links-btn,[data-cll-open],[data-cll-merge],[data-cll-diff],[data-cll-assign],[data-client-edit]");
    if (!b) return;
    if (b.id === "cl-links-btn" || b.hasAttribute("data-cll-open")) open();
    else if (b.hasAttribute("data-cll-merge")) merge(b.getAttribute("data-cll-merge"));
    else if (b.hasAttribute("data-cll-diff")) dismiss(b.getAttribute("data-cll-diff"));
    else if (b.hasAttribute("data-cll-assign")) assign(Number(b.getAttribute("data-cll-assign")));
    else if (b.hasAttribute("data-client-edit")) editClient(b.getAttribute("data-client-edit"));
  });


  // ---------- адрес заказа, указанный клиентом по ссылке (файл 61) ----------
  // Это ПРЕДЛОЖЕНИЕ клиента, пока байер не принял его. Карточку клиента и владельца заказа форма не меняет.
  var dlv = {};   // id заказа → строка адреса или null (нет / нет доступа / база без файла 61)

  function dlvInner(id) {
    var d = dlv[id];
    if (!d) return "";
    var rows = [[t("l_name"), d.name], [t("l_phone"), d.phone], [t("l_telegram"), d.telegram ? "@" + d.telegram : ""],
                [t("l_city"), d.city], [t("l_address"), d.address], [t("l_pickup"), d.pickup_point]]
      .filter(function (r) { return r[1]; })
      .map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("");
    var proposed = d.state === "proposed";
    return "<h4>" + esc(t("dl_staff_title")) + '</h4><dl class="info">' + rows + "</dl>" +
      '<p class="muted">' + esc(t(proposed ? "dl_staff_proposed" : "dl_staff_confirmed")) + " " +
        esc(t(d.source === "cabinet" ? "dl_staff_source_cab" : "dl_staff_source_link")) + "</p>" +
      (proposed && state.myRole !== "admin"
        ? '<div class="card-actions"><button type="button" class="btn btn-primary" data-odlv-act="confirm" data-order="' + esc(id) + '">' + esc(t("dl_confirm")) + "</button>" +
          '<button type="button" class="btn" data-odlv-act="reject" data-order="' + esc(id) + '">' + esc(t("dl_reject")) + "</button></div>" : "");
  }
  function dlvPaint(id) {
    var el = document.querySelector('[data-odlv="' + id + '"]');
    if (el) { el.innerHTML = dlvInner(id); el.classList.toggle("hidden", !dlv[id]); }
  }
  // место в подробной карточке заказа; данные подгружаются отдельно, ошибки (старая база, нет прав) молча скрывают блок
  function deliveryHtml(o) {
    var id = o.id;
    setTimeout(function () {
      var db = c.db();
      if (!db) return;
      db.rpc("order_delivery_get", { p_order: id }).then(function (r) {
        dlv[id] = r.error ? null : (r.data || null);
        dlvPaint(id);
      }, function () { dlv[id] = null; dlvPaint(id); });
    }, 0);
    return '<div class="client-box' + (dlv[id] ? "" : " hidden") + '" data-odlv="' + esc(id) + '">' + dlvInner(id) + "</div>";
  }
  function reviewDelivery(id, action) {
    if (ui.busy) return;
    ui.busy = true;
    c.db().rpc("order_delivery_review", { p_order: id, p_action: action }).then(function (r) {
      ui.busy = false;
      if (r.error) { c.handleError(r.error); return; }
      if (action === "confirm" && dlv[id]) dlv[id].state = "confirmed"; else delete dlv[id];
      dlvPaint(id);
      toast(t(action === "confirm" ? "dl_done_confirm" : "dl_done_reject"), "ok");
    }, function (e) { ui.busy = false; c.handleError(e); });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-odlv-act]");
    if (b) reviewDelivery(b.getAttribute("data-order"), b.getAttribute("data-odlv-act"));
  });

  U.clientlinks = { refreshBadge: refreshBadge, open: open, editClient: editClient, deliveryHtml: deliveryHtml };
})(window.ULA);
