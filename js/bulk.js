// =====================================================
// ULA FACTORY — массовая смена статуса.
//
// Кнопка «Выбрать» на странице заказов включает режим выбора: на карточках появляются галочки,
// внизу панель «Выбрано: N · Статус · Отмена». Выбрали 10 заказов, поставили «В пути» — готово за один раз.
// После смены (если включено предложение сообщить клиенту) открывается список «Сообщить клиентам»:
// у каждого заказа своя кнопка, которая открывает готовый текст.
//
// Отменённые заказы выпадают из партии — партии пересчитываются, как при обычной смене статуса.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, state = c.state;

  var on = false;
  var sel = {};          // id заказа → true
  var sent = {};         // id заказа → клиенту уже написали (в списке «Сообщить клиентам»)
  var queue = [];        // id заказов, о которых нужно сообщить

  function has(id) { return !!sel[id]; }
  function ids() { return Object.keys(sel); }

  function setMode(v) {
    on = !!v;
    if (!on) sel = {};
    document.body.classList.toggle("selecting", on);
    $("#bulk-btn").textContent = t(on ? "bulk_done_btn" : "bulk_select");
    c.renderAll();
    renderBar();
  }

  function renderBar() {
    var n = ids().length;
    $("#bulk-bar").classList.toggle("hidden", !on);
    $("#bulk-count").textContent = t("bulk_n", { n: n });
    $("#bulk-status").disabled = !n;
    var total = c.filteredOrders().length;
    $("#bulk-all").textContent = n && n >= total ? t("bulk_none") : t("bulk_all", { n: total });
  }

  function toggle(id, force) {
    var want = force === undefined ? !sel[id] : force;
    if (want) sel[id] = true; else delete sel[id];
    var box = document.querySelector('#orders [data-sel="' + id + '"]');
    if (box) {
      box.checked = want;
      var card = box.closest(".card");
      if (card) card.classList.toggle("selected", want);
    }
    renderBar();
  }

  function selectAll() {
    var list = c.filteredOrders();
    var all = ids().length >= list.length;
    sel = {};
    if (!all) list.forEach(function (o) { sel[o.id] = true; });
    c.renderAll();
    renderBar();
  }

  function openStatus() {
    if (!ids().length) return;
    $("#bulk-status-list").innerHTML = c.STATUSES.map(function (s) {
      return '<button type="button" class="status-option st-' + s + '" data-bstatus="' + s + '"><span class="dot"></span>' + esc(t("status_" + s)) + "</button>";
    }).join("");
    $("#bulk-status-title").textContent = t("bulk_set_for", { n: ids().length });
    c.openModal("modal-bulk-status");
  }

  async function apply(status) {
    var db = c.db();
    var orders = state.orders.filter(function (o) { return sel[o.id]; });
    var changed = orders.filter(function (o) { return o.status !== status; });
    c.closeModal("modal-bulk-status");
    if (!changed.length) { toast(t("bulk_same"), "ok"); return; }

    $("#bulk-status").disabled = true;
    try {
      var list = changed.map(function (o) { return o.id; });
      for (var i = 0; i < list.length; i += 100) {
        var res = await db.from("orders").update({ status: status }).in("id", list.slice(i, i + 100));
        if (res.error) throw res.error;
      }
      // отменённый заказ не участвует в делёже партии: пересчитываем затронутые партии
      var ships = {};
      changed.forEach(function (o) { if (o.shipment_id && (status === "cancelled" || o.status === "cancelled")) ships[o.shipment_id] = true; });
      for (var s in ships) { await db.rpc("shipment_recalc", { p_shipment: s }); }
      await c.reloadOrders();
    } catch (err) {
      c.handleError(err);
      $("#bulk-status").disabled = false;
      return;
    }
    var changedIds = changed.map(function (o) { return o.id; });
    setMode(false);
    toast(t("bulk_changed", { n: changedIds.length }), "ok");
    if (U.notify && U.notify.autoEnabled()) openQueue(changedIds);
  }

  // ---------- «Сообщить клиентам» ----------
  function openQueue(list) {
    queue = list; sent = {};
    renderQueue();
    c.openModal("modal-bulk-notify");
  }

  function renderQueue() {
    var rows = queue.map(function (id) {
      var o = state.orders.filter(function (x) { return x.id === id; })[0];
      if (!o) return "";
      return '<div class="bq-row' + (sent[id] ? " done" : "") + '"><div><b>' + esc(o.client_name || "—") + "</b><span>№ " + esc(o.order_number) +
        " · " + esc(t("status_" + o.status)) + '</span></div><button type="button" class="btn btn-sm ' + (sent[id] ? "" : "btn-primary") + '" data-bq="' + esc(id) + '">' +
        esc(sent[id] ? "✓ " + t("bulk_q_again") : t("client_notify")) + "</button></div>";
    }).join("");
    $("#bulk-queue").innerHTML = rows;
    var left = queue.filter(function (id) { return !sent[id]; }).length;
    $("#bq-next").disabled = !left;
    $("#bq-next").textContent = left ? t("bulk_q_next", { n: left }) : t("bulk_q_all");
  }

  function notifyOne(id) {
    var o = state.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    sent[id] = true;
    renderQueue();
    U.notify.open(o, { afterStatus: true });
  }

  function bind() {
    $("#bulk-btn").addEventListener("click", function () { setMode(!on); });
    $("#bulk-cancel").addEventListener("click", function () { setMode(false); });
    $("#bulk-all").addEventListener("click", selectAll);
    $("#bulk-status").addEventListener("click", openStatus);
    $("#bulk-status-list").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bstatus]");
      if (b) apply(b.getAttribute("data-bstatus"));
    });
    // в режиме выбора нажатие на карточку ставит или снимает галочку (вместо открытия заказа)
    $("#orders").addEventListener("click", function (e) {
      if (!on) return;
      var card = e.target.closest(".card[data-id]");
      if (!card || e.target.closest(".card-more, summary")) return;
      e.stopPropagation();
      e.preventDefault();
      toggle(card.getAttribute("data-id"));
    }, true);
    $("#bulk-queue").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bq]");
      if (b) notifyOne(b.getAttribute("data-bq"));
    });
    $("#bq-next").addEventListener("click", function () {
      var next = queue.filter(function (id) { return !sent[id]; })[0];
      if (next) notifyOne(next);
    });
  }

  U.bulk = { bind: bind, has: has, isOn: function () { return on; }, off: function () { setMode(false); }, _apply: apply };
})(window.ULA);
