// =====================================================
// ULA FACTORY — инструменты байера: объёмный вес, PDF-счёт клиенту, этикетки с QR-кодом.
//
//   • Объёмный вес: длина × ширина × высота коробки и сколько коробок → объём (м³), объёмный вес,
//     плотность (кг/м³) и вес, за который возьмут деньги. Из формы заказа и «Расчёта цены» —
//     кнопка «Вставить вес» сразу подставляет его в заказ.
//   • PDF-счёт: открывается красивый счёт (один заказ или несколько выбранных) → «Сохранить как PDF»
//     или печать. Если выбраны заказы разных клиентов — у каждого клиента своя страница.
//   • Этикетки: номер заказа крупно, клиент, телефон, город, товар, вес, «место 1 из 3» и QR-код.
//     Размер: термопринтер 58×40 мм, 100×70 мм или лист A4 (8 штук). В QR — те же данные текстом
//     (без ссылки на страницу клиента, чтобы чужие люди на складе не видели его адрес).
//
// Печать идёт в новой вкладке (если браузер её запретил — прямо с этой страницы).
// QR-коды рисует библиотека js/qrcode.js (MIT, Kazuhiko Arase), она загружается только для этикеток.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, cur = c.cur, state = c.state;

  function store(key, v) {
    try { if (v === undefined) return localStorage.getItem(key); localStorage.setItem(key, v); } catch (e) { /* ignore */ }
    return null;
  }
  function wsKey(name) { return "ula_" + name + "_" + ((state.ws && state.ws.id) || ""); }

  // =====================================================
  //  ОБЪЁМНЫЙ ВЕС
  // =====================================================
  var DIVISORS = ["6000", "5000", "cargo"];
  var vol = { target: null, div: store("ula_vol_div") || "6000" };

  function volCalc() {
    var l = c.parseNum($("#vol-l").value), w = c.parseNum($("#vol-w").value), h = c.parseNum($("#vol-h").value);
    var n = Math.max(1, Math.round(c.parseNum($("#vol-n").value)) || 1);
    var kg = c.parseNum($("#vol-kg").value);
    var weightTotal = $("#vol-kg-mode").value === "box" ? kg * n : kg;
    var cm3 = l * w * h * n;
    var m3 = cm3 / 1e6;
    var volKg = vol.div === "cargo" ? 0 : cm3 / Number(vol.div);
    var density = m3 > 0 && weightTotal > 0 ? weightTotal / m3 : 0;
    var pay = Math.max(volKg, weightTotal);
    return { m3: m3, volKg: volKg, weight: weightTotal, density: density, pay: Math.round(pay * 100) / 100, ok: cm3 > 0 };
  }

  function round(x, d) { var k = Math.pow(10, d); return Math.round(x * k) / k; }

  function volRender() {
    $("#vol-divs").innerHTML = DIVISORS.map(function (d) {
      return '<button type="button" class="chip' + (d === vol.div ? " active" : "") + '" data-vol-div="' + d + '"><span>' + esc(t("vol_div_" + d)) + "</span></button>";
    }).join("");
    var r = volCalc(), rows = [];
    if (r.ok) {
      rows.push(["vol_r_m3", money(round(r.m3, 3)) + " м³"]);
      if (vol.div !== "cargo") rows.push(["vol_r_vol", money(round(r.volKg, 2)) + " " + t("kg")]);
      if (r.weight > 0) rows.push(["vol_r_weight", money(round(r.weight, 2)) + " " + t("kg")]);
      if (r.density > 0 && vol.div !== "cargo") rows.push(["vol_r_density", money(Math.round(r.density)) + " " + t("vol_kgm3")]);
    }
    var big = !r.ok ? "" : vol.div === "cargo"
      ? (r.density > 0 ? '<div class="vol-big"><span>' + esc(t("vol_r_density")) + "</span><b>" + money(Math.round(r.density)) + " " + esc(t("vol_kgm3")) + "</b></div>" : "")
      : '<div class="vol-big"><span>' + esc(t("vol_r_pay")) + "</span><b>" + money(r.pay) + " " + esc(t("kg")) + "</b><small>" +
        esc(t(r.volKg > r.weight ? "vol_by_volume" : "vol_by_weight")) + "</small></div>";
    var note = "";
    if (r.ok && r.density > 0) note = t(r.density < 200 ? "vol_light" : "vol_heavy");
    $("#vol-out").innerHTML = big + (rows.length ? '<dl class="vol-rows">' + rows.map(function (x) {
      return "<div><dt>" + esc(t(x[0])) + "</dt><dd>" + esc(x[1]) + "</dd></div>";
    }).join("") + "</dl>" : '<p class="muted">' + esc(t("vol_empty")) + "</p>") +
      (note ? '<p class="fine-print">' + esc(note) + "</p>" : "");
    var useKg = vol.div === "cargo" ? r.weight : r.pay;
    $("#vol-apply").classList.toggle("hidden", !vol.target);
    $("#vol-apply").disabled = !(useKg > 0);
    $("#vol-apply").textContent = t("vol_apply", { n: money(useKg > 0 ? round(useKg, 2) : 0) });
  }

  // target — поле веса, куда вставить результат (необязательно)
  function openVolume(target) {
    vol.target = target || null;
    ["vol-l", "vol-w", "vol-h", "vol-kg"].forEach(function (id) { $("#" + id).value = ""; });
    $("#vol-n").value = "1";
    volRender();
    c.openModal("modal-volume");
    setTimeout(function () { $("#vol-l").focus(); }, 50);
  }

  function applyVolume() {
    var r = volCalc(), kg = vol.div === "cargo" ? r.weight : r.pay;
    if (!vol.target || !(kg > 0)) return;
    // в «Расчёте цены» результат — вес всей партии, поэтому переключаем на «вес за всё»
    var total = vol.target.id === "q-weight" && document.querySelector('#q-wmodes [data-wm="total"]');
    if (total) total.click();
    vol.target.value = String(round(kg, 2));
    vol.target.dispatchEvent(new Event("input", { bubbles: true }));   // пересчитать доставку в заказе
    c.closeModal("modal-volume");
    toast(t("vol_applied"), "ok");
  }

  // =====================================================
  //  ПЕЧАТЬ (новая вкладка или, если запрещено, со страницы)
  // =====================================================
  // win — уже открытая вкладка (необязательно)
  function printDoc(title, css, body, win) {
    var html = '<!doctype html><html lang="' + esc(typeof getLang === "function" ? getLang() : "ru") + '"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + "</title><style>" + css + PRINT_BAR_CSS + "</style></head><body>" +
      '<div class="pbar"><b>' + esc(title) + '</b><button type="button" onclick="window.print()">' + esc(t("pr_print")) + "</button></div>" +
      body + "<script>setTimeout(function(){window.print()},400)<\/script></body></html>";
    var w = win || null;
    if (!w) { try { w = window.open("", "_blank"); } catch (e) { w = null; } }
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      return;
    }
    // вкладку не дали открыть — печатаем через скрытую рамку
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    f.contentDocument.open();
    f.contentDocument.write(html.replace(/<script>[\s\S]*?<\/script>/, ""));
    f.contentDocument.close();
    setTimeout(function () {
      f.contentWindow.focus();
      f.contentWindow.print();
      setTimeout(function () { f.remove(); }, 2000);
    }, 400);
  }

  var PRINT_BAR_CSS =
    ".pbar{position:sticky;top:0;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 16px;background:#0f172a;color:#fff;font:600 14px system-ui,sans-serif;z-index:5}" +
    ".pbar button{font:600 14px system-ui,sans-serif;background:#2f6fde;color:#fff;border:0;border-radius:8px;padding:9px 16px;cursor:pointer}" +
    "@media print{.pbar{display:none}}";

  function clientKey(o) {
    var p = String((o.client && o.client.phone) || o.client_phone || "").replace(/\D/g, "");
    return p.length >= 9 ? "p" + p : "n" + String(o.client_name || "").trim().toLowerCase();
  }
  function clientName(o) { return (o.client && o.client.name) || o.client_name || "—"; }
  function clientPhone(o) { var p = (o.client && o.client.phone) || o.client_phone; return p ? c.fmtPhone(p) : ""; }
  function clientPlace(o) {
    var cl = o.client || {};
    return [cl.city, cl.pickup_point || cl.address].filter(Boolean).join(", ");
  }

  // =====================================================
  //  PDF-СЧЁТ
  // =====================================================
  var inv = { list: [] };

  function openInvoice(orders) {
    // отменённые заказы в счёт не идут
    inv.list = (orders || []).filter(function (o) { return o && o.status !== "cancelled"; });
    if (!inv.list.length) { toast(t("inv_none"), "error"); return; }
    var noPrice = inv.list.filter(function (o) { return !(num(o.total_som) > 0); }).length;
    $("#inv-sum").textContent = t("inv_sum", { n: inv.list.length, c: groups(inv.list).length });
    $("#inv-warn").textContent = noPrice ? t("inv_no_price", { n: noPrice }) : "";
    $("#inv-warn").classList.toggle("hidden", !noPrice);
    $("#inv-pay").value = store(wsKey("inv_pay")) || "";
    c.openModal("modal-invoice");
  }

  function groups(list) {
    var map = {}, out = [];
    list.forEach(function (o) {
      var k = clientKey(o);
      if (!map[k]) { map[k] = []; out.push(map[k]); }
      map[k].push(o);
    });
    return out;
  }

  function invoiceNo(list) {
    var nums = list.map(function (o) { return o.order_number; }).filter(Boolean);
    return nums.length > 1 ? nums[0] + "…" + nums[nums.length - 1] : (nums[0] || "");
  }

  function invoicePage(list, pay) {
    var ws = state.ws || {}, me = state.me || {}, first = list[0];
    var totals = {};
    var rows = list.map(function (o, i) {
      var code = o.client_currency || "KGS", priced = num(o.total_som) > 0;
      var tt = totals[code] || (totals[code] = { total: 0, paid: 0, left: 0 });
      if (priced && o.status !== "cancelled") {
        tt.total += num(o.total_som);
        tt.paid += Math.min(num(o.paid_amount), num(o.total_som));
        tt.left += Math.max(0, num(o.balance_som));
      }
      return "<tr" + (o.status === "cancelled" ? ' class="off"' : "") + "><td>" + (i + 1) + "</td><td>№ " + esc(o.order_number) +
        '<small>' + esc(c.fmtDate(o.order_date)) + "</small></td><td>" + esc(o.product_ru || "") +
        (o.product_zh ? "<small>" + esc(o.product_zh) + "</small>" : "") +
        (o.status === "cancelled" ? "<small>" + esc(t("status_cancelled")) + "</small>" : "") + "</td>" +
        '<td class="r">' + money(o.quantity) + '</td><td class="r">' + (priced ? esc(cur(o.total_som, code)) : "—") +
        '</td><td class="r c-paid">' + (priced ? esc(cur(Math.min(num(o.paid_amount), num(o.total_som)), code)) : "—") +
        '</td><td class="r b">' + (priced && o.status !== "cancelled" ? esc(cur(Math.max(0, num(o.balance_som)), code)) : "—") + "</td></tr>";
    }).join("");
    var tot = Object.keys(totals).map(function (code) {
      var x = totals[code];
      return '<div class="tot"><div><span>' + esc(t("inv_total")) + "</span><b>" + esc(cur(x.total, code)) + "</b></div>" +
        "<div><span>" + esc(t("l_paid")) + "</span><b>" + esc(cur(x.paid, code)) + "</b></div>" +
        '<div class="due' + (x.left > 0 ? "" : " ok") + '"><span>' + esc(t("inv_due")) + "</span><b>" +
        esc(x.left > 0 ? cur(x.left, code) : t("cl_paid_full")) + "</b></div></div>";
    }).join("");
    return '<section class="page">' +
      '<header><div class="brand"><h1>' + esc(ws.name || "ULA Factory") + "</h1>" +
        (me.phone ? "<p>" + esc(c.fmtPhone(me.phone)) + "</p>" : "") + (me.email ? "<p>" + esc(me.email) + "</p>" : "") + "</div>" +
        '<div class="doc"><h2>' + esc(t("inv_title")) + "</h2><p>№ " + esc(invoiceNo(list)) + "</p><p>" + esc(c.fmtDate(c.todayISO())) + "</p></div></header>" +
      '<div class="to"><span>' + esc(t("inv_to")) + "</span><b>" + esc(clientName(first)) + "</b>" +
        (clientPhone(first) ? "<p>" + esc(clientPhone(first)) + "</p>" : "") +
        (clientPlace(first) ? "<p>" + esc(clientPlace(first)) + "</p>" : "") + "</div>" +
      "<table><thead><tr><th>#</th><th>" + esc(t("inv_c_order")) + "</th><th>" + esc(t("inv_c_product")) + '</th><th class="r">' +
        esc(t("inv_c_qty")) + '</th><th class="r">' + esc(t("inv_c_sum")) + '</th><th class="r c-paid">' + esc(t("l_paid")) + '</th><th class="r">' +
        esc(t("inv_c_left")) + "</th></tr></thead><tbody>" + rows + "</tbody></table>" + tot +
      (pay ? '<div class="pay"><span>' + esc(t("inv_pay")) + "</span><p>" + esc(pay) + "</p></div>" : "") +
      '<footer>' + esc(t("inv_thanks")) + "</footer></section>";
  }

  var INVOICE_CSS =
    "*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#0f172a;font:14px/1.45 -apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
    ".page{width:210mm;min-height:297mm;margin:16px auto;background:#fff;padding:18mm 16mm;box-shadow:0 4px 24px rgba(15,23,42,.12);page-break-after:always;position:relative}" +
    ".page:last-child{page-break-after:auto}" +
    "header{display:flex;justify-content:space-between;gap:24px;padding-bottom:14px;border-bottom:3px solid #2f6fde}" +
    "h1{margin:0 0 4px;font-size:22px}h2{margin:0 0 4px;font-size:26px;color:#2f6fde;letter-spacing:.04em;text-transform:uppercase}" +
    "header p{margin:0;color:#475569}.doc{text-align:right}" +
    ".to{margin:18px 0;padding:12px 14px;background:#f5f7fb;border-radius:10px}.to span{display:block;font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.06em}.to b{font-size:17px}.to p{margin:2px 0 0;color:#334155}" +
    "table{width:100%;border-collapse:collapse;margin-top:6px}th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;padding:8px 6px;border-bottom:1.5px solid #cbd5e1}" +
    "td{padding:9px 6px;border-bottom:1px solid #e2e8f0;vertical-align:top}td small{display:block;color:#64748b;font-size:11.5px}.r{text-align:right;white-space:nowrap}.b{font-weight:700}" +
    "tr.off td{color:#94a3b8;text-decoration:line-through}tr.off td small{text-decoration:none}" +
    ".tot{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.tot div{min-width:130px;padding:10px 12px;border-radius:10px;background:#f5f7fb;text-align:right}" +
    ".tot span{display:block;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.tot b{font-size:16px}" +
    ".tot .due{background:#fff4e5;color:#9a5b00}.tot .due.ok{background:#e8f7ef;color:#146c43}.tot .due b{font-size:19px}" +
    ".pay{margin-top:20px;padding:12px 14px;border:1.5px dashed #cbd5e1;border-radius:10px}.pay span{font-size:11px;text-transform:uppercase;color:#64748b;letter-spacing:.06em}.pay p{margin:4px 0 0;white-space:pre-wrap}" +
    "footer{position:absolute;left:16mm;right:16mm;bottom:12mm;text-align:center;color:#64748b;font-size:12px}" +
    "@media screen and (max-width:820px){.page{width:auto;min-height:0;margin:8px;padding:18px 14px 60px}header{flex-direction:column;gap:8px}.doc{text-align:left}.tot{flex-wrap:wrap}.tot div{flex:1}th,td{padding:7px 3px;font-size:12px}.c-paid{display:none}.r{white-space:normal}td:nth-child(2){white-space:nowrap}}" +
    "@page{size:A4;margin:0}@media print{body{background:#fff}.page{margin:0;box-shadow:none}}";

  function printInvoice() {
    var pay = $("#inv-pay").value.trim();
    store(wsKey("inv_pay"), pay);
    var g = groups(inv.list);
    var title = t("inv_title") + " № " + invoiceNo(inv.list) + (g.length === 1 ? " — " + clientName(g[0][0]) : "");
    printDoc(title, INVOICE_CSS, g.map(function (list) { return invoicePage(list, pay); }).join(""));
    c.closeModal("modal-invoice");
  }

  // =====================================================
  //  ЭТИКЕТКИ С QR-КОДОМ
  // =====================================================
  var SIZES = ["58x40", "100x70", "a4"];
  var lab = { list: [], size: store("ula_label_size") || "100x70" };
  var qrLoading = null;

  function loadQr() {
    if (window.qrcode) return Promise.resolve();
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "js/qrcode.js?v=" + c.APP_VERSION;
      s.onload = function () { resolve(); };
      s.onerror = function () { qrLoading = null; reject(new Error("qr")); };
      document.head.appendChild(s);
    });
    return qrLoading;
  }

  // QR как SVG (каждая клетка — квадрат, вокруг белая рамка в 4 клетки — так сканеры читают надёжнее), текст в UTF-8, чтобы кириллица и китайский читались
  function qrSvg(text) {
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    var q = window.qrcode(0, "M");
    q.addData(text, "Byte");
    q.make();
    var n = q.getModuleCount(), d = "";
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += "M" + (x + 4) + " " + (y + 4) + "h1v1h-1z";
    return '<svg viewBox="0 0 ' + (n + 8) + " " + (n + 8) + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  function qrText(o, i, n) {
    return ["ULA № " + o.order_number, clientName(o), clientPhone(o), clientPlace(o),
      (o.product_ru || "") + " × " + money(o.quantity), num(o.weight_kg) > 0 ? money(o.weight_kg) + " " + t("kg") : "",
      n > 1 ? t("lb_place", { a: i, b: n }) : ""].filter(Boolean).join("\n").slice(0, 600);
  }

  function labelHtml(o, i, n) {
    var place = clientPlace(o);
    return '<div class="lb"><div class="lb-l"><div class="lb-no">№ ' + esc(o.order_number) + "</div>" +
      '<div class="lb-name">' + esc(clientName(o)) + "</div>" +
      (clientPhone(o) ? '<div class="lb-ph">' + esc(clientPhone(o)) + "</div>" : "") +
      (place ? '<div class="lb-pl">' + esc(place) + "</div>" : "") +
      '<div class="lb-pr">' + esc(o.product_ru || "") + " × " + money(o.quantity) + (num(o.weight_kg) > 0 ? " · " + money(o.weight_kg) + " " + esc(t("kg")) : "") + "</div>" +
      (n > 1 ? '<div class="lb-place">' + esc(t("lb_place", { a: i, b: n })) + "</div>" : "") +
      '</div><div class="lb-qr">' + qrSvg(qrText(o, i, n)) + "</div></div>";
  }

  var LABEL_BASE =
    "*{box-sizing:border-box}body{margin:0;background:#eef1f6;color:#000;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif}" +
    ".sheet{display:flex;flex-wrap:wrap;gap:6mm;justify-content:center;padding:16px}" +
    ".lb{display:flex;gap:2.5mm;background:#fff;border:1px dashed #9aa3b2;overflow:hidden;page-break-inside:avoid;break-inside:avoid}" +
    ".lb-l{flex:1;min-width:0;display:flex;flex-direction:column}.lb-no{font-weight:800;letter-spacing:-.01em;white-space:nowrap;line-height:1.1}.lb-name{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".lb-ph{font-weight:600}.lb-pl,.lb-pr{color:#111;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
    ".lb-place{margin-top:auto;font-weight:800;border:1.5px solid #000;border-radius:3px;align-self:flex-start;padding:0 2mm}" +
    ".lb-qr{flex:none}.lb-qr svg{display:block;width:100%;height:100%}" +
    "@media print{body{background:#fff}.sheet{padding:0}.lb{border:0}}";

  var LABEL_SIZES = {
    "58x40": "@page{size:58mm 40mm;margin:0}.sheet{gap:4mm}.lb{width:58mm;height:40mm;padding:2.5mm}.lb-no{font-size:11.5pt}.lb-name{font-size:9pt}.lb-ph{font-size:8.5pt}.lb-pl,.lb-pr{font-size:7pt;-webkit-line-clamp:1}.lb-place{font-size:8pt}.lb-qr{width:21mm;height:21mm;align-self:center}" +
      "@media print{.sheet{display:block}.lb{page-break-after:always}}",
    "100x70": "@page{size:100mm 70mm;margin:0}.lb{width:100mm;height:70mm;padding:5mm}.lb-no{font-size:19pt}.lb-name{font-size:14pt}.lb-ph{font-size:12pt}.lb-pl,.lb-pr{font-size:10pt}.lb-place{font-size:12pt}.lb-qr{width:34mm;height:34mm;align-self:center}" +
      "@media print{.sheet{display:block}.lb{page-break-after:always}}",
    "a4": "@page{size:A4;margin:8mm 4mm}.sheet{gap:0}.lb{width:101mm;height:69mm;padding:5mm}.lb-no{font-size:18pt}.lb-name{font-size:13pt}.lb-ph{font-size:11pt}.lb-pl,.lb-pr{font-size:9.5pt}.lb-place{font-size:11pt}.lb-qr{width:31mm;height:31mm;align-self:center}" +
      "@media print{.sheet{width:202mm;margin:0 auto}}"
  };

  function openLabels(orders) {
    lab.list = (orders || []).filter(Boolean);
    if (!lab.list.length) return;
    $("#lb-n").value = "1";
    labRender();
    c.openModal("modal-labels");
  }

  function labRender() {
    $("#lb-sizes").innerHTML = SIZES.map(function (s) {
      return '<button type="button" class="chip' + (s === lab.size ? " active" : "") + '" data-lb-size="' + s + '"><span>' + esc(t("lb_size_" + s)) + "</span></button>";
    }).join("");
    var n = Math.max(1, Math.min(50, Math.round(c.parseNum($("#lb-n").value)) || 1));
    $("#lb-sum").textContent = t("lb_sum", { o: lab.list.length, n: lab.list.length * n });
  }

  async function printLabels() {
    var n = Math.max(1, Math.min(50, Math.round(c.parseNum($("#lb-n").value)) || 1));
    var btn = $("#lb-print");
    btn.disabled = true;
    // вкладку открываем сразу (по нажатию), иначе браузер её заблокирует, пока грузится QR
    var w = null;
    try { w = window.open("", "_blank"); } catch (e) { w = null; }
    if (w && w.document) w.document.write('<p style="font:16px system-ui;padding:20px">' + esc(t("loading")) + "</p>");
    try {
      await loadQr();
    } catch (err) {
      btn.disabled = false;
      if (w) w.close();
      toast(t("error_generic"), "error");
      return;
    }
    var body = '<div class="sheet">';
    lab.list.forEach(function (o) { for (var i = 1; i <= n; i++) body += labelHtml(o, i, n); });
    body += "</div>";
    var title = t("lb_title") + " — " + (lab.list.length === 1 ? "№ " + lab.list[0].order_number : t("lb_sum", { o: lab.list.length, n: lab.list.length * n }));
    printDoc(title, LABEL_BASE + LABEL_SIZES[lab.size], body, w);
    btn.disabled = false;
    c.closeModal("modal-labels");
  }

  // =====================================================
  //  СОБЫТИЯ
  // =====================================================
  function bind() {
    // объёмный вес
    $("#modal-volume").addEventListener("input", volRender);
    $("#modal-volume").addEventListener("change", volRender);
    $("#modal-volume").addEventListener("click", function (e) {
      var d = e.target.closest("[data-vol-div]");
      if (d) { vol.div = d.getAttribute("data-vol-div"); store("ula_vol_div", vol.div); volRender(); }
    });
    $("#vol-apply").addEventListener("click", applyVolume);
    $("#f-weight-calc").addEventListener("click", function () { openVolume($("#f-weight_kg")); });
    $("#q-weight-calc").addEventListener("click", function () { openVolume($("#q-weight")); });
    $("#vol-menu").addEventListener("click", function () { openVolume(null); });

    // счёт
    $("#inv-print").addEventListener("click", printInvoice);

    // этикетки
    $("#modal-labels").addEventListener("click", function (e) {
      var s = e.target.closest("[data-lb-size]");
      if (s) { lab.size = s.getAttribute("data-lb-size"); store("ula_label_size", lab.size); labRender(); }
    });
    $("#lb-n").addEventListener("input", labRender);
    $("#lb-print").addEventListener("click", printLabels);
  }

  U.tools = { bind: bind, volume: openVolume, invoice: openInvoice, labels: openLabels, _vol: volCalc, _qrText: qrText };
})(window.ULA);
