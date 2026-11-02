// Бизнес-обзор: значения считает база, интерфейс только показывает результат.
(function (U) {
  "use strict";
  var c = U.core, $ = c.$, esc = c.esc, state = c.state;
  var requestNumber = 0;

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function setPeriod() {
    var n = Number($("#bi-period").value);
    if (!n) return;
    var end = new Date(), start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    start.setDate(start.getDate() - n + 1);
    $("#bi-from").value = iso(start);
    $("#bi-to").value = iso(end);
  }

  // Суммы приходят из Postgres строками: не переводим их в неточное число JavaScript.
  function formatAmount(value, code) {
    if (value == null) return esc(t("bi_insufficient"));
    var s = String(value), negative = s.charAt(0) === "-";
    if (negative) s = s.slice(1);
    var parts = s.split("."), whole = parts[0] || "0", fraction = (parts[1] || "").padEnd(2, "0").slice(0, 2);
    try { whole = new Intl.NumberFormat(c.locale()).format(BigInt(whole)); } catch (e) { /* Оставляем цифры как прислала база. */ }
    var separator = new Intl.NumberFormat(c.locale()).formatToParts(1.1).filter(function (p) { return p.type === "decimal"; })[0];
    return esc((negative ? "−" : "") + whole + (separator ? separator.value : ".") + fraction + " " + code);
  }
  function card(title, value, detail) {
    return '<article class="bi-card"><span>' + esc(title) + '</span><strong>' + value + '</strong>' +
      (detail ? '<p>' + esc(detail) + '</p>' : "") + '</article>';
  }
  function financial(group) {
    var noOrders = Number(group.orders_count) === 0;
    var missingPrice = group.order_value == null ? t(noOrders ? "bi_no_orders" : "bi_missing_price") : t("bi_order_value_note");
    var missingCost = group.order_profit == null ? t(noOrders ? "bi_no_orders" : "bi_missing_cost") : t("bi_profit_note");
    return '<section class="bi-currency"><h2>' + esc(group.code) + '</h2><div class="bi-grid">' +
      card(t("bi_order_value"), formatAmount(group.order_value, group.code), missingPrice) +
      card(t("bi_expenses"), formatAmount(group.expenses, group.code), group.expenses == null ? t("bi_missing_expenses") : t("bi_recorded_expenses")) +
      card(t("bi_order_profit"), formatAmount(group.order_profit, group.code), missingCost) +
      card(t("bi_net"), esc(t("bi_insufficient")), t("bi_net_missing")) +
      card(t("bi_average"), formatAmount(group.average_value, group.code), group.average_value == null ? t(noOrders ? "bi_no_orders" : "bi_missing_price") : "") +
      card(t("bi_average_profit"), formatAmount(group.average_profit, group.code), group.average_profit == null ? t(noOrders ? "bi_no_orders" : "bi_missing_cost") : t("bi_profit_note")) +
      '</div></section>';
  }
  function render(data) {
    var body = '<p class="bi-note">' + esc(t("bi_scope")) + '</p><div class="bi-grid">' +
      card(t("bi_active"), esc(data.active), t("bi_status_note")) +
      card(t("bi_completed"), esc(data.completed), t("bi_status_note")) +
      card(t("bi_delayed"), esc(t("bi_insufficient")), t("bi_missing_deadline")) + '</div>';
    body += '<p class="bi-note">' + esc(t("bi_currency_note")) + '</p>';
    body += data.currencies && data.currencies.length ? data.currencies.map(financial).join("") : '<p class="state-box">' + esc(t("bi_empty")) + '</p>';
    body += '<h2 class="bi-section-title">' + esc(t("bi_more_metrics")) + '</h2><div class="bi-grid">' +
      card(t("bi_suppliers"), esc(t("bi_insufficient")), t("bi_suppliers_missing")) +
      card(t("bi_retention"), esc(t("bi_insufficient")), t("bi_retention_missing")) +
      card(t("bi_logistics"), esc(t("bi_insufficient")), t("bi_logistics_missing")) + '</div>';
    $("#bi-body").innerHTML = body;
  }
  // Показываем понятную причину и безопасный код ошибки без данных клиента.
  function showError(error, status) {
    var code = String(error && error.code || "");
    var key = "bi_load_error";
    if (status === 401 || code === "PGRST301") key = "bi_login_error";
    else if (code === "42501" || status === 403) key = "bi_access_error";
    else if (code === "PGRST202" || code === "42883") key = "bi_migration_error";
    else if (typeof navigator !== "undefined" && navigator.onLine === false) key = "bi_network_error";
    var safeCode = /^[A-Z0-9]{3,12}$/i.test(code) ? code : "";
    var suffix = safeCode || (status >= 400 && status <= 599 ? "HTTP " + status : "");
    $("#bi-body").textContent = t(key) + (suffix ? " (" + suffix + ")" : "");
  }
  async function load() {
    if (!state.me || state.me.role !== "admin" || !state.ws || !c.db()) return;
    var from = $("#bi-from").value, to = $("#bi-to").value;
    if (!from || !to || from > to) { $("#bi-body").textContent = t("bi_bad_dates"); return; }
    var requestId = ++requestNumber, workspaceId = state.ws.id;
    $("#bi-body").textContent = t("loading");
    var result;
    try {
      result = await c.db().rpc("admin_business_overview", { p_workspace: workspaceId, p_from: from, p_to: to });
    } catch (e) {
      if (requestId === requestNumber) showError(null, 0);
      return;
    }
    if (requestId !== requestNumber || !state.ws || state.ws.id !== workspaceId || state.tab !== "business") return;
    if (result.error || !result.data) { showError(result.error, result.status || 0); return; }
    try { render(result.data); }
    catch (e) { $("#bi-body").textContent = t("bi_render_error"); }
  }
  function open() {
    if (!state.me || state.me.role !== "admin") return;
    $("#bi-no-workspace").classList.toggle("hidden", !!state.ws);
    $("#bi-content").classList.toggle("hidden", !state.ws);
    if (!state.ws) { requestNumber++; return; }
    $("#bi-workspace").textContent = t("bi_workspace", { name: state.ws.name });
    if (!$("#bi-from").value) { $("#bi-period").value = "30"; setPeriod(); }
    load();
  }
  function bind() {
    $("#bi-buyers").addEventListener("click", function () { c.switchTab("buyers"); });
    $("#bi-period").addEventListener("change", function () { setPeriod(); if (this.value !== "custom") load(); });
    $("#bi-from").addEventListener("change", function () { $("#bi-period").value = "custom"; });
    $("#bi-to").addEventListener("change", function () { $("#bi-period").value = "custom"; });
    $("#bi-apply").addEventListener("click", load);
  }
  U.business = { bind: bind, open: open };
})(window.ULA);
