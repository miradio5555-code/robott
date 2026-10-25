// =====================================================
// ULA FACTORY — раздел «Расходы»: расходы кабинета и чистая прибыль.
//
// Байер записывает расходы (аренда, зарплата, реклама, транспорт, упаковка, связь, комиссии, другое).
// За выбранный период видно: прибыль с заказов − расходы = чистая прибыль, и на что уходят деньги.
// Чистая прибыль показывается и в «Аналитике».
//
// Расходы видит и меняет только владелец кабинета (помощник — нет), админ только смотрит.
// Прибыль с заказов считается так же, как в «Аналитике»: без отменённых и без заказов без цены.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, cur = c.cur, state = c.state;

  var CATS = ["rent", "salary", "ads", "transport", "packing", "phone", "fees", "other"];
  var CAT_COLORS = { rent: "#2F6FDE", salary: "#7A4FD6", ads: "#D98A00", transport: "#3A8FD6",
    packing: "#2E9E6A", phone: "#8A8F98", fees: "#B3202F", other: "#5B6472" };
  var PERIODS = ["month", "3m", "12m", "all"];
  var ex = { list: [], wsId: null, tried: null, loading: false, period: "month", cur: "", editing: null };

  function iso(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function range(period) {
    if (period === "all") return { from: "", to: "" };
    var n = period === "month" ? 1 : period === "3m" ? 3 : 12, now = new Date();
    return { from: iso(new Date(now.getFullYear(), now.getMonth() - (n - 1), 1)), to: "" };
  }
  function inRange(d, r) { d = String(d || "").slice(0, 10); return !!d && (!r.from || d >= r.from) && (!r.to || d <= r.to); }

  async function load() {
    var db = c.db();
    if (!db || !state.ws) return;
    ex.loading = true;
    var res = await db.from("expenses").select("*").eq("workspace_id", state.ws.id)
      .order("spent_on", { ascending: false }).order("created_at", { ascending: false }).limit(5000);
    ex.loading = false;
    if (res.error) { c.handleError(res.error); return; }
    ex.list = res.data || [];
    ex.wsId = state.ws.id;
  }

  // Загружены ли расходы именно этого кабинета (при смене кабинета — заново)
  function ready() { return !!state.ws && ex.wsId === state.ws.id; }
  // один раз на кабинет (если база ответила ошибкой — не повторяем по кругу, есть кнопка «Обновить»)
  async function ensure() {
    if (ready() || ex.loading || !state.ws || ex.tried === state.ws.id) return;
    ex.tried = state.ws.id;
    await load();
  }

  // Сумма расходов в валюте code за период r ({from, to}; пустые — без границы)
  function sumFor(code, r) {
    if (!ready()) return null;
    var s = 0;
    ex.list.forEach(function (e) { if (e.currency === code && inRange(e.spent_on, r)) s += num(e.amount); });
    return s;
  }

  function ordersProfit(code, r) {
    var s = 0, n = 0;
    (state.orders || []).forEach(function (o) {
      if (o.status === "cancelled" || o.profit_som == null || o.client_currency !== code || !inRange(o.order_date, r)) return;
      s += num(o.profit_som); n++;
    });
    return { profit: s, n: n };
  }

  function currencies(r) {
    var counts = {};
    ex.list.forEach(function (e) { if (inRange(e.spent_on, r)) counts[e.currency] = (counts[e.currency] || 0) + 2; });
    (state.orders || []).forEach(function (o) {
      if (o.status !== "cancelled" && o.profit_som != null && inRange(o.order_date, r)) counts[o.client_currency] = (counts[o.client_currency] || 0) + 1;
    });
    var list = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    if (!list.length) list = [(state.ws && state.ws.default_client_currency) || "KGS"];
    return list;
  }

  function chips(items, active, attr, labelFn) {
    return items.map(function (k) {
      return '<button type="button" class="chip' + (k === active ? " active" : "") + '" data-' + attr + '="' + esc(k) + '"><span>' + esc(labelFn(k)) + "</span></button>";
    }).join("");
  }

  function render() {
    if ($("#tab-expenses").classList.contains("hidden")) return;
    if (!ready()) { $("#ex-body").innerHTML = '<div class="state-box">' + esc(t("loading")) + "</div>"; return; }
    var r = range(ex.period), curs = currencies(r);
    if (curs.indexOf(ex.cur) === -1) ex.cur = curs[0];
    var code = ex.cur;
    $("#ex-periods").innerHTML = chips(PERIODS, ex.period, "ex-period", function (p) { return t("r_p_" + p); });
    $("#ex-curs").innerHTML = chips(curs, code, "ex-cur", function (x) { return x; });
    $("#ex-curs").classList.toggle("hidden", curs.length < 2);

    var items = ex.list.filter(function (e) { return e.currency === code && inRange(e.spent_on, r); });
    var spent = items.reduce(function (s, e) { return s + num(e.amount); }, 0);
    var op = ordersProfit(code, r), net = op.profit - spent;

    var html = '<section class="an-card ex-sum">' +
      '<div class="ex-line"><span>' + esc(t("ex_orders_profit")) + "</span><b>" + esc(cur(op.profit, code)) + "</b></div>" +
      '<div class="ex-line minus"><span>' + esc(t("ex_spent")) + "</span><b>− " + esc(cur(spent, code)) + "</b></div>" +
      '<div class="ex-net ' + (net < 0 ? "neg" : "") + '"><span>' + esc(t("ex_net")) + "</span><b>" + esc(cur(net, code)) + "</b></div>" +
      '<p class="fine-print">' + esc(t("ex_net_hint", { n: op.n })) + "</p></section>";

    if (items.length) {
      var by = {};
      items.forEach(function (e) { by[e.category] = (by[e.category] || 0) + num(e.amount); });
      var cats = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; });
      html += '<section class="an-card"><h3>' + esc(t("ex_by_cat")) + "</h3>" + cats.map(function (k) {
        var pct = spent > 0 ? Math.round(by[k] / spent * 100) : 0;
        return '<div class="ex-cat"><div class="ex-cat-top"><span><i style="background:' + CAT_COLORS[k] + '"></i>' + esc(t("ex_cat_" + k)) +
          "</span><b>" + esc(cur(by[k], code)) + " <small>" + pct + '%</small></b></div><div class="ex-bar"><i style="width:' + Math.max(2, pct) +
          "%;background:" + CAT_COLORS[k] + '"></i></div></div>';
      }).join("") + "</section>";

      html += '<section class="an-card"><h3>' + esc(t("ex_list", { n: items.length })) + '</h3><div class="ex-list">' + items.map(function (e) {
        return '<button type="button" class="ex-row" data-ex-edit="' + esc(e.id) + '"><i style="background:' + CAT_COLORS[e.category] + '"></i><span class="ex-row-main"><b>' +
          esc(t("ex_cat_" + e.category)) + "</b>" + (e.note ? "<small>" + esc(e.note) + "</small>" : "") + '</span><span class="ex-row-side"><b>' +
          esc(cur(e.amount, e.currency)) + "</b><small>" + esc(c.fmtDate(e.spent_on)) + "</small></span></button>";
      }).join("") + "</div></section>";
    } else {
      html += '<div class="state-box">' + esc(t("ex_empty")) + "</div>";
    }
    $("#ex-body").innerHTML = html;
  }

  async function open() {
    render();
    if (!ready()) { ex.tried = null; await ensure(); }
    render();
  }

  // ---------- Добавить / изменить ----------
  function openForm(e) {
    ex.editing = e || null;
    $("#ex-form-title").textContent = t(e ? "ex_edit" : "ex_add");
    $("#ex-cat").innerHTML = CATS.map(function (k) { return '<option value="' + k + '">' + esc(t("ex_cat_" + k)) + "</option>"; }).join("");
    $("#ex-cat").value = e ? e.category : (c.state.lastExCat || "rent");
    $("#ex-date").value = e ? e.spent_on : c.todayISO();
    $("#ex-amount").value = e ? c.numStr(e.amount) : "";
    c.fillCurrencySelect($("#ex-cur"), e ? e.currency : (ex.cur || (state.ws && state.ws.default_client_currency) || "KGS"));
    $("#ex-note").value = e ? (e.note || "") : "";
    $("#ex-delete").classList.toggle("hidden", !e);
    c.openModal("modal-expense");
    setTimeout(function () { $("#ex-amount").focus(); }, 50);
  }

  async function save(ev) {
    ev.preventDefault();
    var amount = c.parseNum($("#ex-amount").value);
    if (!(amount > 0)) { toast(t("ex_e_amount"), "error"); $("#ex-amount").focus(); return; }
    var v = {
      category: $("#ex-cat").value,
      spent_on: $("#ex-date").value || c.todayISO(),
      amount: Math.round(amount * 100) / 100,
      currency: $("#ex-cur").value,
      note: $("#ex-note").value.trim().slice(0, 300) || null
    };
    var btn = $("#ex-save");
    btn.disabled = true;
    try {
      var db = c.db(), res;
      if (ex.editing) res = await db.from("expenses").update(v).eq("id", ex.editing.id);
      else { v.workspace_id = state.ws.id; res = await db.from("expenses").insert(v); }
      if (res.error) throw res.error;
      c.state.lastExCat = v.category;
      ex.cur = v.currency;
      c.closeModal("modal-expense");
      toast(t("ex_saved"), "ok");
      await load();
      render();
      if (U.analytics) U.analytics.refresh();
    } catch (err) {
      c.handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  async function remove() {
    var e = ex.editing;
    if (!e || !window.confirm(t("ex_confirm_del"))) return;
    var res = await c.db().from("expenses").delete().eq("id", e.id);
    if (res.error) { c.handleError(res.error); return; }
    c.closeModal("modal-expense");
    toast(t("ex_deleted"), "ok");
    await load();
    render();
  }

  function bind() {
    $("#ex-add").addEventListener("click", function () { openForm(null); });
    $("#expense-form").addEventListener("submit", save);
    $("#ex-delete").addEventListener("click", remove);
    $("#tab-expenses").addEventListener("click", function (e) {
      var p = e.target.closest("[data-ex-period]"), cu = e.target.closest("[data-ex-cur]"), ed = e.target.closest("[data-ex-edit]");
      if (p) { ex.period = p.getAttribute("data-ex-period"); render(); }
      else if (cu) { ex.cur = cu.getAttribute("data-ex-cur"); render(); }
      else if (ed) {
        if (state.readOnly) return;
        var id = ed.getAttribute("data-ex-edit");
        openForm(ex.list.filter(function (x) { return x.id === id; })[0]);
      }
    });
  }

  U.expenses = { bind: bind, open: open, refresh: render, reload: async function () { await load(); render(); },
    ensure: ensure, sumFor: sumFor, ready: ready };
})(window.ULA);
