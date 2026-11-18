// =====================================================
// ULA FACTORY — быстрые шаблоны заказа: «Заказ с 1688», «Заказ с Taobao», «Повторить заказ».
//
// Шаблон ничего не сохраняет: он только подставляет значения в ОБЫЧНУЮ форму нового заказа.
// Байер видит форму, может всё изменить и сам нажимает «Сохранить». Базы и миграций шаблоны не требуют.
//
// «Повторить заказ» копирует только то, что безопасно повторять:
//   клиент (по постоянному номеру), товар, количество и цена поставщика, поставщик, валюты, тариф доставки,
//   адрес — только если он подтверждён (у клиента есть карточка с адресом или байер принял адрес заказа).
// И НИКОГДА не копирует: оплату, цену для клиента и наценку, вес и стоимость доставки прошлой отправки,
//   курсы (берутся сегодняшние), трек-номер, этап и срок доставки, статус, историю, фотографии, долги,
//   комментарии, внутренние заметки, ссылку клиента, номер заказа, партию.
// Список полей — в одном месте (COPY ниже), его проверяет tests/templates_test.mjs.
//
// ULA.templates: platform(kind, ctx), repeat(order, ctx), COPY, NEVER, kinds()
// Подключается после app.js (логика не зависит от страницы и запускается в проверках без браузера).
// =====================================================
(function (U) {
  "use strict";

  // Площадки: что подставить в новый заказ
  var PLATFORMS = {
    "1688":   { supplier: "1688",   link: "https://detail.1688.com/offer/", hosts: ["1688.com"], purchase_currency: "CNY" },
    "taobao": { supplier: "Taobao", link: "https://item.taobao.com/item.htm?id=", hosts: ["taobao.com", "tmall.com"], purchase_currency: "CNY" }
  };

  // Поля заказа, которые переносятся в повторный заказ
  var COPY = ["client_id", "client_name", "client_phone", "client_wechat",
    "product_ru", "product_zh", "quantity", "unit_price_cny",
    "supplier", "supplier_link", "supplier_wechat",
    "purchase_currency", "client_currency", "delivery_currency", "delivery_tariff"];

  // Поля, которые в повторный заказ попасть не должны никогда (для проверки и для читающего код)
  var NEVER = ["id", "order_number", "order_date", "status", "public_token", "created_at", "updated_at", "source", "workspace_id",
    "paid_amount", "client_price", "markup", "delivery_cost", "weight_kg",
    "cost_som", "total_som", "balance_som", "profit_som", "goods_som",
    "tracking_number", "track_stage", "shipped_at", "transit_days_min", "transit_days_max", "ship_to", "shipment_id",
    "payment_due_at", "delivery_eta_from", "delivery_eta_to", "reminders_paused_at",
    "client_comment", "admin_comment", "status_history", "photos", "order_photos", "client"];

  // Курсы в повторный заказ ставятся сегодняшние (из «Моих курсов» или последние введённые), а не из старого заказа
  var FRESH = ["exchange_rate", "delivery_rate"];
  // Адрес заказа переносится только подтверждённый (см. addressConfirmed)
  var IF_CONFIRMED = ["delivery_info"];

  function str(v) { return v == null ? "" : String(v).trim(); }
  function posNum(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : null; }

  // Новый заказ с площадки. ctx: { ws, rate(from, to) → строка курса или "" }
  function platform(kind, ctx) {
    var p = PLATFORMS[kind];
    if (!p) return null;
    ctx = ctx || {};
    var ws = ctx.ws || {};
    var clientCur = ws.default_client_currency || "KGS";
    var deliveryCur = ws.default_delivery_currency || "USD";
    var rate = ctx.rate || function () { return ""; };
    return {
      kind: kind,
      supplier: p.supplier,
      supplier_link_placeholder: p.link + "…",
      purchase_currency: p.purchase_currency,
      client_currency: clientCur,
      delivery_currency: deliveryCur,
      delivery_tariff: posNum(ws.default_delivery_tariff),
      exchange_rate: str(rate(p.purchase_currency, clientCur)),
      delivery_rate: str(rate(deliveryCur, clientCur)),
      quantity: 1
    };
  }

  // Какой площадке принадлежит ссылка на товар (чтобы шаблон выбрался сам, когда байер вставил ссылку)
  function kindOfLink(link) {
    var host = "";
    try { host = new URL(str(link)).hostname.toLowerCase(); } catch (e) { return ""; }
    var found = "";
    Object.keys(PLATFORMS).forEach(function (k) {
      if (PLATFORMS[k].hosts.some(function (h) { return host === h || host.slice(-h.length - 1) === "." + h; })) found = k;
    });
    return found;
  }

  // Адрес подтверждён: у клиента есть карточка с городом (её заполняет сам клиент или байер)
  // либо байер принял адрес, который клиент указал для этого заказа (order_delivery.state = confirmed).
  function addressConfirmed(order, client, delivery) {
    if (delivery && delivery.state === "confirmed") return true;
    return !!(client && client.id && order && order.client_id === client.id && str(client.city));
  }

  // Повтор заказа. ctx: { client, delivery, rate(from, to), today }
  // Возвращает { fields, skipped, addressCopied } — только поля из COPY (+ адрес при подтверждении и сегодняшние курсы).
  function repeat(order, ctx) {
    ctx = ctx || {};
    var o = order || {}, out = {}, rate = ctx.rate || function () { return ""; };
    COPY.forEach(function (k) {
      var v = o[k];
      if (v == null || v === "") return;
      out[k] = typeof v === "string" ? v.trim() : v;
    });
    // клиент — только настоящий постоянный номер; заказ без клиента ни к кому не привязывается
    var client = ctx.client && ctx.client.id && ctx.client.id === o.client_id ? ctx.client : null;
    if (!client) delete out.client_id;
    if (client) {
      // имя и телефон берём из карточки клиента: в старом заказе они могли устареть
      if (str(client.name)) out.client_name = str(client.name);
      if (str(client.phone)) out.client_phone = str(client.phone);
    }
    out.quantity = posNum(o.quantity) || 1;
    if (posNum(o.unit_price_cny) == null) delete out.unit_price_cny;
    if (posNum(o.delivery_tariff) == null) delete out.delivery_tariff;
    out.purchase_currency = out.purchase_currency || "CNY";
    out.client_currency = out.client_currency || "KGS";
    out.delivery_currency = out.delivery_currency || out.client_currency;
    // курсы — сегодняшние, а не из старого заказа
    out.exchange_rate = str(rate(out.purchase_currency, out.client_currency));
    out.delivery_rate = str(rate(out.delivery_currency, out.client_currency));
    // адрес заказа — только подтверждённый
    var okAddr = addressConfirmed(o, client, ctx.delivery);
    if (okAddr && str(o.delivery_info)) out.delivery_info = str(o.delivery_info);
    // ссылка поставщика: только http(s), иначе не переносим
    if (out.supplier_link && !/^https?:\/\//i.test(out.supplier_link)) delete out.supplier_link;
    return {
      fields: out,
      from: str(o.order_number),
      addressCopied: !!out.delivery_info,
      addressSkipped: !okAddr && !!str(o.delivery_info),
      clientLinked: !!out.client_id
    };
  }

  U.templates = {
    platform: platform, repeat: repeat, kindOfLink: kindOfLink, addressConfirmed: addressConfirmed,
    kinds: function () { return Object.keys(PLATFORMS); },
    COPY: COPY, NEVER: NEVER, FRESH: FRESH, IF_CONFIRMED: IF_CONFIRMED
  };
})(window.ULA = window.ULA || {});
