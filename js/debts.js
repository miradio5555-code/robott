// =====================================================
// ULA FACTORY — раздел «Долги»: кто должен, сколько и как давно,
// и готовое напоминание об оплате в один клик (WhatsApp / Telegram / копирование).
//
// Долгом считается остаток по заказу (к оплате − оплачено) только там, где байер
// указал цену для клиента: иначе «к оплате» равно себестоимости, а её клиенту
// называть нельзя. Отменённые заказы не считаются.
// В напоминание попадают только суммы, которые клиент видит на своей странице.
//
// Вынесено из app.js. Общие помощники берутся из window.ULA.core.
// Подключается после app.js и js/notify.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, $$ = c.$$, esc = c.esc, money = c.money, num = c.num, cur = c.cur,
      fmtPhone = c.fmtPhone, state = c.state;

  var OVERDUE_DAYS = 7;       // столько дней без оплаты — «просрочено»
  var FIRM_DAYS = 14;         // дольше — в напоминание добавляем строгую фразу
  var REMIND_KEY = "cc_debt_reminded";   // когда последний раз напоминали (в этом браузере)
  var ui = { filter: "all" };

  // ---------- Когда напоминали (запоминаем в браузере, по кабинетам) ----------
  function reminded() {
    try { return JSON.parse(localStorage.getItem(REMIND_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function remindedAt(key) {
    var r = reminded()[state.ws && state.ws.id];
    return r && r[key] ? r[key] : null;
  }
  function markReminded(key) {
    var all = reminded(), id = state.ws && state.ws.id;
    if (!id) return;
    all[id] = all[id] || {};
    all[id][key] = todayISO();
    try { localStorage.setItem(REMIND_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    render();
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function daysSince(dateOrIso) {
    var d = new Date(String(dateOrIso).length === 10 ? dateOrIso + "T00:00:00" : dateOrIso);
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 864e5));
  }

  // ---------- Сбор должников ----------
  // «Давно не платит» = сколько дней прошло с заказа или с последней оплаты (что позже)
  function orderAge(o) {
    var ref = o.order_date ? new Date(o.order_date + "T00:00:00").getTime() : 0;
    (o.status_history || []).forEach(function (h) {
      if (h.event_type === "payment") ref = Math.max(ref, new Date(h.created_at).getTime());
    });
    return ref ? Math.max(0, Math.floor((Date.now() - ref) / 864e5)) : 0;
  }

  function clientKey(o) {
    var phone = String((o.client && o.client.phone) || o.client_phone || "").replace(/\D/g, "");
    return phone.length >= 9 ? "p" + phone.slice(-9) : "n" + String(o.client_name || "").trim().toLowerCase();
  }

  function collect() {
    var map = {};
    (state.orders || []).forEach(function (o) {
      if (o.status === "cancelled" || o.profit_som == null || num(o.balance_som) <= 0.5) return;
      var k = clientKey(o);
      var g = map[k] || (map[k] = {
        key: k, name: (o.client && o.client.name) || o.client_name || "—",
        phone: String((o.client && o.client.phone) || o.client_phone || "").replace(/[\s().-]/g, ""),
        telegram: String((o.client && o.client.telegram) || "").replace(/^@/, ""),
        orders: [], totals: {}, maxAge: 0, atClient: false
      });
      if (!/^\+\d{9,15}$/.test(g.phone)) g.phoneOk = false; else g.phoneOk = true;
      var age = orderAge(o);
      g.orders.push({ o: o, age: age });
      g.totals[o.client_currency] = (g.totals[o.client_currency] || 0) + num(o.balance_som);
      g.maxAge = Math.max(g.maxAge, age);
      if (o.status === "arrived" || o.status === "delivered") g.atClient = true;   // товар уже у клиента — срочнее
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.forEach(function (g) {
      g.orders.sort(function (a, b) { return b.age - a.age; });
      g.overdue = g.maxAge >= OVERDUE_DAYS;
    });
    // сначала те, у кого товар уже на руках, потом по давности
    list.sort(function (a, b) { return (b.atClient - a.atClient) || (b.maxAge - a.maxAge); });
    return list;
  }

  function totalsText(totals) {
    return Object.keys(totals).map(function (code) { return cur(totals[code], code); }).join(" + ").replace(/&amp;/g, "&");
  }
  function plain(s) { return String(s).replace(/[  ]/g, " "); }

  // ---------- Показ ----------
  function render() {
    var list = collect();
    var overdueN = list.filter(function (g) { return g.overdue; }).length;

    // красная цифра у пункта меню — сколько клиентов просрочили оплату
    var badge = $("#debts-badge");
    if (badge) { badge.textContent = String(overdueN); badge.classList.toggle("hidden", overdueN === 0); }
    var bnBadge = $("#bn-debts-badge");
    if (bnBadge) { bnBadge.textContent = String(overdueN); bnBadge.classList.toggle("hidden", overdueN === 0); }
    var moreBadge = $("#bn-more-badge");   // у байера «Долги» лежат в «Ещё»
    if (moreBadge) { moreBadge.textContent = String(overdueN); moreBadge.classList.toggle("hidden", overdueN === 0); }

    if ($("#tab-debts").classList.contains("hidden")) return;

    // заказы с остатком, но без цены для клиента — в долги не входят, говорим об этом
    var unpriced = (state.orders || []).filter(function (o) {
      return o.status !== "cancelled" && o.profit_som == null && num(o.balance_som) > 0.5 && num(o.paid_amount) >= 0 && num(o.total_som) > 0;
    }).length;
    $("#debts-note").textContent = t("d_note") + (unpriced ? " " + t("d_unpriced", { n: unpriced }) : "");

    var shown = ui.filter === "overdue" ? list.filter(function (g) { return g.overdue; }) : list;
    var grand = {};
    list.forEach(function (g) { Object.keys(g.totals).forEach(function (k) { grand[k] = (grand[k] || 0) + g.totals[k]; }); });

    $("#debts-total").innerHTML = list.length
      ? '<span class="debts-total-label">' + esc(t("d_total")) + "</span><b>" + totalsText(grand) + "</b>" +
        '<span class="debts-total-sub">' + esc(t("d_clients", { n: list.length })) + "</span>"
      : "";
    $("#debts-chips").innerHTML = ["all", "overdue"].map(function (f) {
      var n = f === "all" ? list.length : overdueN;
      return '<button type="button" class="chip' + (ui.filter === f ? " active" : "") + '" data-filter="' + f + '"><span>' +
        esc(t(f === "all" ? "d_filter_all" : "d_filter_overdue")) + "</span><b>" + n + "</b></button>";
    }).join("");
    $("#debts-chips").classList.toggle("hidden", !list.length);

    if (!shown.length) {
      $("#debts").innerHTML = "";
      $("#debts-empty").textContent = t(list.length ? "d_empty_overdue" : "d_empty");
      $("#debts-empty").classList.remove("hidden");
      return;
    }
    $("#debts-empty").classList.add("hidden");
    $("#debts").innerHTML = shown.map(cardHtml).join("");
  }

  function cardHtml(g) {
    var last = remindedAt(g.key);
    var when = last ? (daysSince(last) === 0 ? t("d_today") : t("d_ago", { n: daysSince(last) })) : "";
    var rows = g.orders.map(function (x) {
      var o = x.o;
      return '<button type="button" class="debt-order" data-open="' + esc(o.id) + '"><span class="debt-order-no">№ ' + esc(o.order_number) +
        "</span><span class=\"debt-order-name\">" + esc(o.product_ru) + "</span><b>" + cur(o.balance_som, o.client_currency) +
        '</b><small class="muted">' + esc(t("d_days", { n: x.age })) + "</small></button>";
    }).join("");
    return '<article class="debt-card' + (g.overdue ? " overdue" : "") + '" data-key="' + esc(g.key) + '">' +
      '<div class="debt-head"><div><h3>' + esc(g.name) + "</h3>" +
        '<div class="debt-meta muted">' + (g.phone ? esc(fmtPhone(g.phone)) + " · " : "") + esc(t("d_orders", { n: g.orders.length })) + "</div></div>" +
        '<div class="debt-sum">' + totalsText(g.totals) + "</div></div>" +
      '<div class="debt-flags">' +
        (g.overdue ? '<span class="debt-flag late">' + esc(t("d_overdue", { n: g.maxAge })) + "</span>" : '<span class="debt-flag">' + esc(t("d_days", { n: g.maxAge })) + "</span>") +
        (g.atClient ? '<span class="debt-flag late">' + esc(t("d_at_client")) + "</span>" : "") +
        '<span class="debt-flag muted-flag">' + esc(when ? t("d_reminded", { when: when }) : t("d_never")) + "</span>" +
      "</div>" +
      '<div class="debt-orders">' + rows + "</div>" +
      '<button type="button" class="btn btn-primary" data-remind="' + esc(g.key) + '" data-write>' + esc(t("d_remind")) + "</button>" +
    "</article>";
  }

  // ---------- Текст напоминания ----------
  var TXT = {
    ru: {
      hello: function (n) { return n ? "Здравствуйте, " + n + "!" : "Здравствуйте!"; },
      intro: "Напоминаю об оплате.",
      one: function (no, prod, left, total, paid) {
        return "По заказу № " + no + (prod ? " («" + prod + "»)" : "") + " осталось оплатить " + left +
          (paid ? " (всего " + total + ", оплачено " + paid + ")" : "") + ".";
      },
      many: "К оплате по заказам:",
      line: function (no, prod, left) { return "• № " + no + (prod ? " («" + prod + "»)" : "") + " — " + left; },
      more: function (n) { return "…и ещё заказов: " + n; },
      sum: "Итого к оплате: ",
      firm: "Прошу погасить задолженность в ближайшие дни.",
      ask: "Когда сможете оплатить? Если уже оплатили — пришлите, пожалуйста, чек.",
      link: "Детали заказа:"
    },
    en: {
      hello: function (n) { return n ? "Hello, " + n + "!" : "Hello!"; },
      intro: "A friendly reminder about payment.",
      one: function (no, prod, left, total, paid) {
        return "For order " + no + (prod ? " (\"" + prod + "\")" : "") + " there is " + left + " left to pay" +
          (paid ? " (total " + total + ", paid " + paid + ")" : "") + ".";
      },
      many: "Amounts due by order:",
      line: function (no, prod, left) { return "• " + no + (prod ? " (\"" + prod + "\")" : "") + " — " + left; },
      more: function (n) { return "…and " + n + " more orders"; },
      sum: "Total due: ",
      firm: "Please settle the balance in the next few days.",
      ask: "When can you pay? If you have already paid, please send me the receipt.",
      link: "Order details:"
    },
    zh: {
      hello: function (n) { return n ? "您好，" + n + "！" : "您好！"; },
      intro: "温馨提醒付款。",
      one: function (no, prod, left, total, paid) {
        return "订单 " + no + (prod ? "（" + prod + "）" : "") + " 还需支付 " + left +
          (paid ? "（总计 " + total + "，已付 " + paid + "）" : "") + "。";
      },
      many: "各订单待付金额：",
      line: function (no, prod, left) { return "• " + no + (prod ? "（" + prod + "）" : "") + " — " + left; },
      more: function (n) { return "……还有 " + n + " 个订单"; },
      sum: "合计待付：",
      firm: "请在这几天内结清欠款。",
      ask: "您什么时候方便付款？如已付款，请发我付款凭证。",
      link: "订单详情："
    }
  };

  function buildReminder(g, lang) {
    var T = TXT[lang] || TXT.ru;
    var name = String(g.name || "").trim();
    var lines = [T.hello(name && name.length <= 30 ? name : ""), "", T.intro, ""];
    function prod(o) {
      var p = String(lang === "zh" ? (o.product_zh || o.product_ru) : o.product_ru || "").trim();
      return p.length > 40 ? p.slice(0, 37) + "…" : p;
    }
    var link = "";
    if (g.orders.length === 1) {
      var o = g.orders[0].o, cc = o.client_currency;
      lines.push(T.one(o.order_number, prod(o), plain(cur(o.balance_som, cc)), plain(cur(o.total_som, cc)), num(o.paid_amount) > 0 ? plain(cur(o.paid_amount, cc)) : ""));
      link = c.clientUrl(o);
    } else {
      lines.push(T.many);
      g.orders.slice(0, 5).forEach(function (x) {
        lines.push(T.line(x.o.order_number, prod(x.o), plain(cur(x.o.balance_som, x.o.client_currency))));
      });
      if (g.orders.length > 5) lines.push(T.more(g.orders.length - 5));
      lines.push(T.sum + plain(totalsText(g.totals)));
    }
    if (g.maxAge >= FIRM_DAYS) { lines.push(""); lines.push(T.firm); }
    lines.push(""); lines.push(T.ask);
    if (link) { lines.push(""); lines.push(T.link); lines.push(link); }
    return lines.join("\n");
  }

  function remind(key) {
    var g = collect().filter(function (x) { return x.key === key; })[0];
    if (!g) return;
    c.openNotifyText({
      title: t("d_remind_title"),
      sub: g.name + " · " + plain(totalsText(g.totals)),
      build: function (lang) { return buildReminder(g, lang); },
      phone: g.phoneOk ? g.phone : "",
      tg: /^[A-Za-z0-9_]{3,32}$/.test(g.telegram) ? g.telegram : "",
      onSent: function () { markReminded(key); }
    });
  }

  // ---------- События ----------
  function bind() {
    $("#tab-debts").addEventListener("click", function (e) {
      var f = e.target.closest("[data-filter]");
      if (f) { ui.filter = f.getAttribute("data-filter"); render(); return; }
      var r = e.target.closest("[data-remind]");
      if (r) { remind(r.getAttribute("data-remind")); return; }
      var op = e.target.closest("[data-open]");
      if (op) c.openDetail(op.getAttribute("data-open"));
    });
    // карточка «Долг клиентов» на главной ведёт сюда
    var item = $("#sum-debt") && $("#sum-debt").closest(".summary-item");
    if (item) {
      item.classList.add("summary-link");
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      var go = function () { c.switchTab("debts"); };
      item.addEventListener("click", go);
      item.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    }
  }

  U.debts = { open: render, refresh: render, bind: bind, _collect: collect, _build: buildReminder };
})(window.ULA);
