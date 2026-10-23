// =====================================================
// ULA FACTORY — раздел «Партии»: несколько заказов одним карго.
// Вы объединяете заказы в партию, указываете вес по весам карго и тариф
// (или сумму по счёту) — стоимость доставки делится между заказами
// пропорционально их весу, а себестоимость и прибыль заказов пересчитываются сами.
//
// Само деление выполняет база (функция shipment_recalc, migration_16): так цифры
// не расходятся даже при сбое. Здесь тот же расчёт нужен только для «живого»
// предпросмотра в окне партии, пока вы вводите данные.
//
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js и js/fx.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, cur = c.cur,
      state = c.state, openModal = c.openModal, closeModal = c.closeModal, handleError = c.handleError,
      fillCurrencySelect = c.fillCurrencySelect;

  var sh = { list: [], error: false };   // партии открытого кабинета
  // редактируемая партия: id (пусто = новая), ids — заказы в ней, picker — открыт ли выбор заказов
  var cd = { id: null, ids: [], picker: false, q: "", picked: {}, busy: false };

  // ---------- Загрузка ----------
  async function load(silent) {
    if (!state.ws) return;
    var res = await c.db().from("shipments").select("*").eq("workspace_id", state.ws.id).order("created_at", { ascending: false });
    if (res.error) {
      // таблицы ещё может не быть (миграция не запущена): не пугаем, пока раздел не открыт
      console.error(res.error);
      sh.list = []; sh.error = true;
      if (!silent) toast(t("sh_err_db"), "error");
    } else {
      sh.list = res.data || []; sh.error = false;
    }
    refresh();
    c.renderAll();   // подписи «Партия: …» на карточках заказов
  }

  function find(id) { return sh.list.filter(function (s) { return s.id === id; })[0]; }
  function name(id) { var s = find(id); return s ? s.name : ""; }
  function ordersOf(id) { return (state.orders || []).filter(function (o) { return o.shipment_id === id; }); }

  // ---------- Расчёт (тот же, что в базе) ----------
  function r2(x) { return Math.round(x * 100) / 100; }
  function opt(v) {   // пустое поле = null, иначе число ≥ 0
    var s = String(v == null ? "" : v).trim().replace(/\s/g, "").replace(",", ".");
    if (s === "") return null;
    var n = Number(s);
    return isFinite(n) && n >= 0 ? n : null;
  }
  function rateFor(a, b) {
    if (a === b) return 1;
    var r = U.fx.myRate(a, b);
    return r ? Math.round(r * 10000) / 10000 : null;
  }

  // f: {currency, tariff, weight, total}; orders — заказы партии
  function calc(f, orders) {
    var act = orders.filter(function (o) { return o.status !== "cancelled"; })
      .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)); });
    var sum = act.reduce(function (s, o) { return s + num(o.weight_kg); }, 0);
    var zero = act.filter(function (o) { return !(num(o.weight_kg) > 0); }).length;
    var res = { rows: [], sum: sum, zero: zero, ok: false, error: "", missing: [], total: 0, totalWeight: 0, tariff: 0 };
    if (!act.length) { res.error = "empty"; return res; }
    if (!(sum > 0)) { res.error = "no_weight"; return res; }
    var tw = f.weight > 0 ? f.weight : sum;
    var total = f.total != null ? f.total : (f.tariff != null ? f.tariff * tw : null);
    res.totalWeight = tw;
    if (total == null) { res.error = "no_cost"; return res; }
    res.total = total;
    res.tariff = f.tariff != null ? f.tariff : r2(total / tw);

    var left = total, rem = act.length - zero;
    act.forEach(function (o) {
      var w = num(o.weight_kg), cost = 0;
      if (w > 0) {
        rem--;
        cost = rem === 0 ? left : Math.min(left, r2(total * w / sum));
        left = r2(left - cost);
      }
      var rate = rateFor(f.currency, o.client_currency), missing = false;
      if (rate == null) {
        rate = num(o.delivery_rate);
        if (rate <= 0 || rate === 1) { missing = true; if (res.missing.indexOf(o.client_currency) === -1) res.missing.push(o.client_currency); }
      }
      res.rows.push({ o: o, weight: w, share: w / sum, cost: r2(cost), rate: rate, som: r2(cost * rate) });
    });
    res.ok = true;
    return res;
  }

  function fieldsFromForm() {
    return {
      name: $("#sh-name").value.trim(), cargo: $("#sh-cargo").value.trim(),
      sent_at: $("#sh-date").value || null, delivery_currency: $("#sh-cur").value,
      tariff: opt($("#sh-tariff").value), actual_weight: opt($("#sh-weight").value),
      total_cost: opt($("#sh-total").value), notes: $("#sh-notes").value.trim()
    };
  }
  function calcFromFields(fl, orders) {
    return calc({ currency: fl.delivery_currency, tariff: fl.tariff, weight: fl.actual_weight, total: fl.total_cost }, orders);
  }

  // ---------- Список партий ----------
  function statusMix(orders) {
    var m = {};
    orders.forEach(function (o) { if (o.status !== "cancelled") m[o.status] = (m[o.status] || 0) + 1; });
    return Object.keys(m).map(function (s) {
      return '<span class="pill st-' + s + '">' + esc(t("status_" + s)) + " · " + m[s] + "</span>";
    }).join(" ");
  }

  // Совпадает ли то, что записано в заказах, с расчётом по партии
  function inSync(s, orders) {
    var r = calcFromFields(s, orders);
    if (!r.ok) return true;   // делить пока нечего — не ругаемся
    return r.rows.every(function (x) {
      return Math.abs(num(x.o.delivery_cost) - x.cost) < 0.006 && x.o.delivery_currency === s.delivery_currency;
    });
  }

  function refresh() {
    var box = $("#sh-list");
    if (!box) return;
    $("#sh-empty").classList.toggle("hidden", sh.list.length > 0);
    $("#sh-empty").textContent = t(sh.error ? "sh_err_db" : "sh_empty");
    box.innerHTML = sh.list.map(function (s) {
      var os = ordersOf(s.id), act = os.filter(function (o) { return o.status !== "cancelled"; });
      var r = calcFromFields(s, os);
      var weight = act.reduce(function (x, o) { return x + num(o.weight_kg); }, 0);
      var flags = [];
      if (r.zero) flags.push('<span class="debt-flag late">' + esc(t("sh_flag_noweight", { n: r.zero })) + "</span>");
      if (r.ok && !inSync(s, os)) flags.push('<span class="debt-flag late">' + esc(t("sh_flag_recalc")) + "</span>");
      else if (r.ok) flags.push('<span class="debt-flag">' + esc(t("sh_flag_ok")) + "</span>");
      return '<article class="sh-card" data-id="' + esc(s.id) + '">' +
        '<div class="sh-head"><div><h3>' + esc(s.name) + '</h3><div class="muted sh-sub">' +
          esc([s.cargo, s.sent_at ? c.fmtDate(s.sent_at) : ""].filter(Boolean).join(" · ") || "—") + "</div></div>" +
          '<div class="sh-sum">' + (r.ok ? cur(r.total, s.delivery_currency) : "—") + "</div></div>" +
        '<div class="sh-mix">' + (statusMix(os) || '<span class="muted">' + esc(t("sh_no_orders")) + "</span>") + "</div>" +
        '<div class="muted sh-meta">' + esc(t("sh_orders", { n: act.length })) + " · " + esc(t("sh_weight", { w: money(weight) })) +
          (r.ok ? " · " + esc(t("sh_per_kg", { x: cur(r.tariff, s.delivery_currency) })) : "") + "</div>" +
        (flags.length ? '<div class="debt-flags">' + flags.join("") + "</div>" : "") +
        '<button type="button" class="btn btn-primary" data-open="' + esc(s.id) + '">' + esc(t("sh_open")) + "</button></article>";
    }).join("");
  }

  // ---------- Окно партии ----------
  function setReadOnly() {
    var ro = !!state.readOnly;
    $$("#sh-body input, #sh-body select, #sh-body textarea").forEach(function (el) { el.disabled = ro && !el.hasAttribute("data-always"); });
  }

  function openNew() {
    var ws = state.ws || {};
    cd = { id: null, ids: [], picker: false, q: "", picked: {}, busy: false };
    fillForm({ name: "", cargo: "", sent_at: "", delivery_currency: ws.default_delivery_currency || "USD",
      tariff: ws.default_delivery_tariff > 0 ? ws.default_delivery_tariff : null, actual_weight: null, total_cost: null, notes: "" });
    $("#sh-title").textContent = t("sh_title_new");
    show();
  }

  function openExisting(id) {
    var s = find(id);
    if (!s) return;
    cd = { id: id, ids: ordersOf(id).map(function (o) { return o.id; }), picker: false, q: "", picked: {}, busy: false };
    fillForm(s);
    $("#sh-title").textContent = s.name;
    show();
  }

  function show() {
    $("#sh-notify").classList.add("hidden");
    $("#sh-picker").classList.add("hidden");
    $("#sh-delete").classList.toggle("hidden", !cd.id);
    $("#sh-status-box").classList.toggle("hidden", !cd.id);
    renderStatusSelect();
    renderModal();
    setReadOnly();
    openModal("modal-shipment");
    var b = $("#sh-body"); if (b) b.scrollTop = 0;
  }

  function fillForm(s) {
    var ws = state.ws || {};
    $("#sh-name").value = s.name || "";
    $("#sh-cargo").value = s.cargo || "";
    $("#sh-date").value = s.sent_at || "";
    fillCurrencySelect($("#sh-cur"), s.delivery_currency || ws.default_delivery_currency || "USD", ["USD", "CNY", "KGS", "RUB", "KZT", "UZS"]);
    $("#sh-tariff").value = s.tariff == null ? "" : String(num(s.tariff));
    $("#sh-weight").value = s.actual_weight == null ? "" : String(num(s.actual_weight));
    $("#sh-total").value = s.total_cost == null ? "" : String(num(s.total_cost));
    $("#sh-notes").value = s.notes || "";
  }

  function cdOrders() {
    return cd.ids.map(function (id) { return (state.orders || []).filter(function (o) { return o.id === id; })[0]; }).filter(Boolean);
  }

  function renderModal() {
    var fl = fieldsFromForm(), code = fl.delivery_currency, os = cdOrders();
    var r = calcFromFields(fl, os);
    $("#sh-lbl-tariff").textContent = t("sh_f_tariff", { c: code });
    $("#sh-lbl-total").textContent = t("sh_f_total", { c: code });

    // сводка и предупреждения
    var warns = [];
    if (!os.length) { $("#sh-summary").innerHTML = '<span class="muted">' + esc(t("sh_sum_empty")) + "</span>"; }
    else if (r.error === "no_weight") { $("#sh-summary").innerHTML = ""; warns.push({ t: t("sh_w_allnoweight") }); }
    else if (r.error === "no_cost") {
      $("#sh-summary").innerHTML = '<span class="muted">' + esc(t("sh_sum_none")) + "</span>";
    } else if (r.ok) {
      $("#sh-summary").innerHTML =
        "<div>" + esc(t("sh_sum_weights", { a: money(r.sum), b: money(r.totalWeight) })) + "</div>" +
        '<div class="sh-sum-big">' + esc(t("sh_sum_total", { x: cur(r.total, code).replace(/&amp;/g, "&"), t: cur(r.tariff, code).replace(/&amp;/g, "&") })) + "</div>";
      if (Math.abs(r.totalWeight - r.sum) > 0.005) warns.push({ t: t("sh_w_diff", { d: money(Math.abs(r.totalWeight - r.sum)) }), info: true });
    }
    if (r.zero && r.error !== "no_weight") warns.push({ t: t("sh_w_noweight", { n: r.zero }) });
    (r.missing || []).forEach(function (cc) { warns.push({ t: t("sh_w_rate", { a: code, b: cc }) }); });
    $("#sh-warns").innerHTML = warns.map(function (w) {
      return '<p class="sh-warn' + (w.info ? " info" : "") + '">' + (w.info ? "ℹ " : "⚠ ") + esc(w.t) + "</p>";
    }).join("");

    // заказы партии: вес, доля, доставка
    var byId = {};
    (r.rows || []).forEach(function (x) { byId[x.o.id] = x; });
    $("#sh-orders").innerHTML = os.length ? os.map(function (o) {
      var x = byId[o.id], cancelled = o.status === "cancelled";
      return '<div class="sh-order' + (cancelled ? " off" : "") + '">' +
        '<div class="sh-order-main"><b>№ ' + esc(o.order_number) + "</b><span class=\"muted\"> " + esc(o.client_name) + "</span></div>" +
        '<div class="sh-order-nums"><span>' + esc(money(num(o.weight_kg))) + " " + esc(t("kg")) + "</span>" +
          (x && x.weight > 0 ? "<span>" + esc(money(Math.round(x.share * 1000) / 10)) + "%</span><b>" + cur(x.cost, code) +
            (code !== o.client_currency ? ' <small class="muted">≈ ' + cur(x.som, o.client_currency) + "</small>" : "") + "</b>"
            : "<span class=\"flag-missing\">" + esc(cancelled ? t("status_cancelled") : t("sh_no_weight")) + "</span>") + "</div>" +
        (state.readOnly ? "" : '<button type="button" class="icon-btn sh-x" data-remove="' + esc(o.id) + '" aria-label="' + esc(t("sh_remove")) + '">✕</button>') +
        "</div>";
    }).join("") : "";
    renderPicker();
  }

  // ---------- Выбор заказов ----------
  function candidates() {
    var q = cd.q.trim().toLowerCase();
    return (state.orders || []).filter(function (o) {
      if (o.shipment_id && o.shipment_id !== cd.id) return false;   // уже в другой партии
      if (cd.ids.indexOf(o.id) !== -1) return false;                // уже в этой
      if (o.status === "cancelled" || o.status === "delivered") return false;
      if (!q) return true;
      return [o.order_number, o.client_name, o.product_ru].filter(Boolean).join(" ").toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderPicker() {
    $("#sh-picker").classList.toggle("hidden", !cd.picker);
    if (!cd.picker) return;
    var list = candidates();
    var n = Object.keys(cd.picked).filter(function (k) { return cd.picked[k]; }).length;
    $("#sh-pick-list").innerHTML = list.length ? list.slice(0, 80).map(function (o) {
      return '<label class="sh-pick"><input type="checkbox" data-pick="' + esc(o.id) + '"' + (cd.picked[o.id] ? " checked" : "") + '>' +
        '<span class="sh-pick-main"><b>№ ' + esc(o.order_number) + "</b> " + esc(o.client_name) +
        '<small class="muted"> · ' + esc(o.product_ru) + "</small></span>" +
        '<span class="sh-pick-w">' + (num(o.weight_kg) > 0 ? esc(money(num(o.weight_kg))) + " " + esc(t("kg")) : '<span class="flag-missing">' + esc(t("sh_no_weight")) + "</span>") + "</span>" +
        '<span class="pill st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span></label>";
    }).join("") : '<p class="muted">' + esc(t("sh_add_none")) + "</p>";
    $("#sh-pick-apply").textContent = t("sh_add_apply", { n: n });
    $("#sh-pick-apply").disabled = n === 0;
  }

  // ---------- Статус и «Сообщить клиентам» ----------
  function renderStatusSelect() {
    var sel = $("#sh-status");
    var keep = sel.value || "in_transit";
    sel.innerHTML = c.STATUSES.filter(function (s) { return s !== "cancelled"; }).map(function (s) {
      return '<option value="' + s + '">' + esc(t("status_" + s)) + "</option>";
    }).join("");
    sel.value = keep;
  }

  function renderNotify() {
    var os = ordersOf(cd.id).filter(function (o) { return o.status !== "cancelled"; });
    $("#sh-notify-list").innerHTML = os.map(function (o) {
      return '<div class="sh-notify-row"><span><b>№ ' + esc(o.order_number) + "</b> " + esc(o.client_name) + "</span>" +
        '<span class="pill st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span>" +
        '<button type="button" class="btn" data-notify="' + esc(o.id) + '">' + esc(t("sh_notify_btn")) + "</button></div>";
    }).join("");
    $("#sh-notify").classList.remove("hidden");
  }

  async function applyStatus() {
    if (!cd.id || cd.busy || state.readOnly) return;
    cd.busy = true;
    $("#sh-status-apply").disabled = true;
    try {
      var res = await c.db().rpc("shipment_set_status", { p_shipment: cd.id, p_status: $("#sh-status").value });
      if (res.error) throw res.error;
      await c.reloadOrders();
      toast(t("sh_status_done", { n: res.data }), "ok");
      renderNotify();
      renderModal();
    } catch (err) { handleError(err); }
    cd.busy = false;
    $("#sh-status-apply").disabled = false;
  }

  // ---------- Сохранение ----------
  async function save() {
    if (cd.busy || state.readOnly) return;
    var fl = fieldsFromForm();
    if (!fl.name) { toast(t("sh_err_name"), "error"); $("#sh-name").focus(); return; }
    cd.busy = true;
    $("#sh-save").disabled = true;
    var db = c.db();
    try {
      var id = cd.id;
      if (!id) {
        var ins = await db.from("shipments").insert(Object.assign({ workspace_id: state.ws.id }, fl)).select("id").single();
        if (ins.error) throw ins.error;
        id = ins.data.id;
      } else {
        var upd = await db.from("shipments").update(fl).eq("id", id);
        if (upd.error) throw upd.error;
      }
      // кто добавлен в партию, а кто убран
      var before = ordersOf(id).map(function (o) { return o.id; });
      var added = cd.ids.filter(function (x) { return before.indexOf(x) === -1; });
      var removed = before.filter(function (x) { return cd.ids.indexOf(x) === -1; });
      if (added.length) { var a = await db.from("orders").update({ shipment_id: id }).in("id", added); if (a.error) throw a.error; }
      if (removed.length) { var d = await db.from("orders").update({ shipment_id: null }).in("id", removed); if (d.error) throw d.error; }

      var rc = await db.rpc("shipment_recalc", { p_shipment: id });
      if (rc.error) throw rc.error;
      await c.reloadOrders();
      await load(true);
      closeModal("modal-shipment");
      var info = rc.data || {};
      var msg = info.ok === false ? t(info.error === "no_cost" ? "sh_saved_nocost" : "sh_saved_noweight") : t("sh_saved");
      // убранный из партии заказ сохраняет прежнюю стоимость доставки (его могут везти отдельно)
      if (removed.length) msg += " " + t("sh_removed_note", { n: removed.length });
      toast(msg, "ok");
    } catch (err) { handleError(err); }
    cd.busy = false;
    $("#sh-save").disabled = false;
  }

  async function remove() {
    if (!cd.id || cd.busy || state.readOnly) return;
    if (!window.confirm(t("sh_delete_confirm", { n: name(cd.id) }))) return;
    cd.busy = true;
    try {
      var res = await c.db().from("shipments").delete().eq("id", cd.id);
      if (res.error) throw res.error;
      await c.reloadOrders();
      await load(true);
      closeModal("modal-shipment");
      toast(t("deleted"), "ok");
    } catch (err) { handleError(err); }
    cd.busy = false;
  }

  // ---------- События ----------
  function bind() {
    $("#sh-new").addEventListener("click", openNew);
    $("#sh-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-open]");
      if (b) openExisting(b.getAttribute("data-open"));
    });
    ["sh-name", "sh-cargo", "sh-date", "sh-cur", "sh-tariff", "sh-weight", "sh-total", "sh-notes"].forEach(function (id) {
      $("#" + id).addEventListener("input", renderModal);
      $("#" + id).addEventListener("change", renderModal);
    });
    $("#sh-orders").addEventListener("click", function (e) {
      var x = e.target.closest("[data-remove]");
      if (!x) return;
      cd.ids = cd.ids.filter(function (i) { return i !== x.getAttribute("data-remove"); });
      renderModal();
    });
    $("#sh-add-toggle").addEventListener("click", function () { cd.picker = !cd.picker; cd.q = ""; $("#sh-pick-q").value = ""; renderPicker(); });
    $("#sh-pick-q").addEventListener("input", function () { cd.q = this.value; renderPicker(); });
    $("#sh-pick-list").addEventListener("change", function (e) {
      var p = e.target.closest("[data-pick]");
      if (!p) return;
      cd.picked[p.getAttribute("data-pick")] = p.checked;
      var n = Object.keys(cd.picked).filter(function (k) { return cd.picked[k]; }).length;
      $("#sh-pick-apply").textContent = t("sh_add_apply", { n: n });
      $("#sh-pick-apply").disabled = n === 0;
    });
    $("#sh-pick-apply").addEventListener("click", function () {
      Object.keys(cd.picked).forEach(function (k) { if (cd.picked[k] && cd.ids.indexOf(k) === -1) cd.ids.push(k); });
      cd.picked = {}; cd.picker = false;
      renderModal();
    });
    $("#sh-save").addEventListener("click", save);
    $("#sh-delete").addEventListener("click", remove);
    $("#sh-status-apply").addEventListener("click", applyStatus);
    $("#sh-notify-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-notify]");
      if (!b) return;
      var o = (state.orders || []).filter(function (x) { return x.id === b.getAttribute("data-notify"); })[0];
      if (o) U.notify.open(o);
    });
  }

  function open() {
    refresh();
    load(false);   // свежие партии при открытии раздела
  }

  U.shipments = { open: open, refresh: refresh, load: load, bind: bind, name: name, _calc: calc };
})(window.ULA);
