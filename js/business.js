// Бизнес-обзор: значения считает база, интерфейс только показывает результат.
(function (U) {
  "use strict";
  var c = U.core, $ = c.$, esc = c.esc, state = c.state;
  var requestNumber = 0, workspaceRequest = 0, selectedWorkspace = "", retryWorkspaces = false;

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
    body += '<details class="bi-unavailable"><summary>' + esc(t("bi_more_metrics")) + '</summary><div class="bi-grid">' +
      card(t("bi_suppliers"), esc(t("bi_insufficient")), t("bi_suppliers_missing")) +
      card(t("bi_retention"), esc(t("bi_insufficient")), t("bi_retention_missing")) +
      card(t("bi_logistics"), esc(t("bi_insufficient")), t("bi_logistics_missing")) + '</div></details>';
    $("#bi-body").innerHTML = body;
  }
  // Показываем понятную причину и безопасный код ошибки без данных клиента.
  function showError(error, status, target) {
    var code = String(error && error.code || "");
    var key = "bi_load_error";
    if (status === 401 || code === "PGRST301") key = "bi_login_error";
    else if (code === "42501" || status === 403) key = "bi_access_error";
    else if (code === "PGRST202" || code === "42883") key = "bi_migration_error";
    else if (typeof navigator !== "undefined" && navigator.onLine === false) key = "bi_network_error";
    var safeCode = /^[A-Z0-9]{3,12}$/i.test(code) ? code : "";
    var suffix = safeCode || (status >= 400 && status <= 599 ? "HTTP " + status : "");
    $(target || "#bi-body").textContent = t(key) + (suffix ? " (" + suffix + ")" : "");
    retryWorkspaces = target === "#bi-status";
    $("#bi-retry").classList.remove("hidden");
  }
  async function load() {
    if (!state.me || state.me.role !== "admin" || !selectedWorkspace || !c.db()) return;
    var from = $("#bi-from").value, to = $("#bi-to").value;
    if (!from || !to || from > to) { $("#bi-body").textContent = t("bi_bad_dates"); return; }
    var requestId = ++requestNumber, workspaceId = selectedWorkspace;
    $("#bi-retry").classList.add("hidden");
    $("#bi-body").textContent = t("loading");
    var result;
    try {
      result = await c.db().rpc("admin_business_overview", { p_workspace: workspaceId, p_from: from, p_to: to });
    } catch (e) {
      if (requestId === requestNumber) showError(null, 0);
      return;
    }
    if (requestId !== requestNumber || selectedWorkspace !== workspaceId || state.tab !== "business") return;
    if (result.error || !result.data) { showError(result.error, result.status || 0); return; }
    try { render(result.data); }
    catch (e) { $("#bi-body").textContent = t("bi_render_error"); retryWorkspaces = false; $("#bi-retry").classList.remove("hidden"); }
  }
  async function open() {
    if (!state.me || state.me.role !== "admin") return;
    if (!$("#bi-from").value) { $("#bi-period").value = "30"; setPeriod(); }
    var current = ++workspaceRequest, select = $("#bi-workspace-select"), list = [];
    requestNumber++;
    $("#bi-retry").classList.add("hidden");
    select.disabled = true;
    $("#bi-content").classList.add("hidden");
    $("#bi-no-workspace").classList.add("hidden");
    $("#bi-status").textContent = t("loading");
    try {
      for (var from = 0; ; from += 1000) {
        // Только название и ID: личные контакты байеров здесь не нужны.
        var result = await c.db().from("workspaces").select("id,name").order("name").order("id").range(from, from + 999);
        if (current !== workspaceRequest || state.tab !== "business") return;
        if (result.error) { showError(result.error, result.status || 0, "#bi-status"); return; }
        var page = result.data || [];
        list = list.concat(page);
        if (page.length < 1000) break;
      }
      var preferred = selectedWorkspace || (state.ws && state.ws.id) || "";
      if (!list.some(function (item) { return item.id === preferred; })) preferred = "";
      select.innerHTML = '<option value="">' + esc(t("bi_select_workspace")) + '</option>' + list.map(function (item) {
        return '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>';
      }).join("");
      select.value = preferred;
      select.disabled = !list.length;
      selectedWorkspace = preferred;
      $("#bi-status").textContent = list.length ? "" : t("bi_no_workspaces");
      $("#bi-content").classList.toggle("hidden", !preferred);
      $("#bi-no-workspace").classList.toggle("hidden", !!preferred || !list.length);
      if (preferred) load();
    } catch (e) {
      if (current === workspaceRequest && state.tab === "business") showError(null, 0, "#bi-status");
    }
  }
  function bind() {
    $("#bi-workspace-select").addEventListener("change", function () {
      selectedWorkspace = this.value;
      requestNumber++;
      $("#bi-retry").classList.add("hidden");
      $("#bi-content").classList.toggle("hidden", !selectedWorkspace);
      $("#bi-no-workspace").classList.toggle("hidden", !!selectedWorkspace);
      if (selectedWorkspace) load();
    });
    $("#bi-period").addEventListener("change", function () {
      $("#bi-custom-dates").classList.toggle("hidden", this.value !== "custom");
      setPeriod();
      if (this.value !== "custom") load();
    });
    $("#bi-from").addEventListener("change", function () { $("#bi-period").value = "custom"; });
    $("#bi-to").addEventListener("change", function () { $("#bi-period").value = "custom"; });
    $("#bi-apply").addEventListener("click", load);
    $("#bi-retry").addEventListener("click", function () { if (retryWorkspaces) open(); else load(); });
  }
  U.business = { bind: bind, open: open };
})(window.ULA);
