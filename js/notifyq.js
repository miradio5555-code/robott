// =====================================================
// ULA FACTORY — состояние уведомлений клиентам о статусах заказов (очередь, файл 57).
//
// Сообщение клиенту ставится в очередь вместе со сменой статуса и уходит с сервера (order-notify-worker), сайт для этого
// не нужен. Здесь владелец кабинета видит: ожидает / отправлено / ошибка — и может повторить отправку после ошибки
// (строка возвращается в ту же очередь, действие остаётся в истории). Другим ролям раздел не показывается.
// Без файла 57 раздела нет.
//
// ULA.notifyq: refresh()
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, state = c.state, toast = c.toast;
  var data = null, busy = false;

  function owner() { return state.myRole === "owner"; }
  function wsId() { return state.ws && state.ws.id; }

  // понятное описание причины (код приходит с сервера, личных данных в нём нет)
  function errText(code) {
    if (!code) return "";
    var key = "nq_e_" + String(code).split(" ")[0];
    var tx = t(key);
    return tx === key ? String(code) : tx;
  }
  function fmtTime(s) {
    if (!s) return "";
    var d = new Date(s);
    return isNaN(d) ? "" : d.toLocaleString(c.locale ? c.locale() : undefined, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function fetchList() {
    var db = c.db(), ws = wsId();
    if (!db || !ws || !owner()) return Promise.resolve(null);
    return Promise.resolve(db.rpc("notify_queue_list", { p_ws: ws, p_limit: 50 })).then(function (r) {
      if (!state.ws || state.ws.id !== ws) return null;
      return r.error ? { error: r.error } : { data: r.data };
    }).catch(function (e) { return { error: e }; });
  }

  function refresh() {
    var sec = $("#nq-section");
    if (!sec) return Promise.resolve();
    return fetchList().then(function (r) {
      if (!r) { sec.classList.add("hidden"); return; }
      if (r.error) { sec.classList.add("hidden"); return; }   // файл 57 не запущен
      data = r.data;
      sec.classList.remove("hidden");
      var k = data.counts || {};
      $("#nq-summary").innerHTML = esc(t("nq_pending", { n: k.pending || 0 })) + " · " + esc(t("nq_sent", { n: k.sent_7d || 0 })) + " · " +
        '<span class="' + (k.failed ? "nq-bad" : "") + '">' + esc(t("nq_failed", { n: k.failed || 0 })) + "</span>";
      if (isOpen()) render();
    });
  }

  function ensureModal() {
    var m = $("#modal-nq");
    if (m) return m;
    m = document.createElement("div");
    m.id = "modal-nq";
    m.className = "modal";
    m.setAttribute("aria-hidden", "true");
    m.innerHTML = '<div class="modal-backdrop" data-close></div><div class="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="nq-ttl">' +
      '<div class="modal-head"><h2 id="nq-ttl"></h2><button class="icon-btn" type="button" data-close aria-label="Close">×</button></div>' +
      '<div class="modal-body" id="nq-body"></div></div>';
    document.body.appendChild(m);
    return m;
  }
  function isOpen() { var m = $("#modal-nq"); return !!(m && m.classList.contains("open")); }

  function render() {
    var body = $("#nq-body");
    if (!body || !data) return;
    var items = data.items || [];
    var h = '<p class="muted">' + esc(t("nq_modal_hint")) + '</p><div class="nq-actions"><button type="button" class="btn btn-light" data-nq-refresh>' + esc(t("nq_refresh")) + "</button></div>";
    if (!items.length) h += '<p class="muted">' + esc(t("nq_none")) + "</p>";
    else h += '<ol class="nq-list">' + items.map(function (i) {
      var hist = (i.history || []).map(function (x) {
        return "<li>" + esc(fmtTime(x.at)) + " · " + esc(t("nq_a_" + x.action) === "nq_a_" + x.action ? x.action : t("nq_a_" + x.action)) + (x.detail ? " — " + esc(x.detail) : "") + "</li>";
      }).join("");
      return '<li class="nq-item nq-' + esc(i.status) + '"><div class="nq-head"><b>№ ' + esc(i.order_number) + "</b> · " + esc(i.kind === "payment_reminder" ? t("nq_k_payment_reminder") : t("status_" + i.to_status)) +
        ' <span class="nq-chip nq-chip-' + esc(i.status) + '">' + esc(t("nq_s_" + i.status)) + "</span></div>" +
        '<div class="muted nq-meta">' + esc(fmtTime(i.sent_at || i.created_at)) +
        (i.status === "pending" && i.attempts ? " · " + esc(t("nq_next", { t: fmtTime(i.next_attempt_at), n: i.attempts, m: i.max_attempts })) : "") +
        (i.last_error ? " · " + esc(errText(i.last_error)) : "") + "</div>" +
        (i.status === "failed" ? '<div class="nq-acts"><button type="button" class="btn btn-light" data-nq-retry="' + esc(i.id) + '">' + esc(t("nq_retry")) + "</button></div>" : "") +
        (hist ? "<details><summary>" + esc(t("nq_history")) + "</summary><ul>" + hist + "</ul></details>" : "") + "</li>";
    }).join("") + "</ol>";
    body.innerHTML = h;
  }

  function open() {
    ensureModal();
    $("#nq-ttl").textContent = t("nq_title");
    render();
    c.openModal("modal-nq");
    refresh();
  }

  function retry(id) {
    if (busy) return;
    if (!window.confirm(t("nq_retry_q"))) return;
    busy = true;
    Promise.resolve(c.db().rpc("notify_retry", { p_id: id })).then(function (r) {
      busy = false;
      if (r.error) {
        if (/not_failed/.test(String(r.error.message || ""))) { toast(t("nq_err_state"), "error"); refresh(); }
        else c.handleError(r.error);
        return;
      }
      toast(t("nq_retried"), "ok");
      refresh();
    });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#nq-open,[data-nq-retry],[data-nq-refresh]");
    if (!b) return;
    if (b.id === "nq-open") open();
    else if (b.hasAttribute("data-nq-retry")) retry(b.getAttribute("data-nq-retry"));
    else refresh();
  });

  U.notifyq = { refresh: refresh };
})(window.ULA);
