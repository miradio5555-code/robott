// =====================================================
// ULA FACTORY — загрузка старых заказов из Excel (.xlsx) или CSV.
//
// Байер выбирает файл → сайт сам находит строку с заголовками и угадывает колонки
// (Дата, Клиент, Телефон, Товар, Сумма, Оплачено, Статус… на русском, английском, китайском) →
// байер проверяет, что куда попадёт, и видит первые строки → «Загрузить». Можно сразу отменить загрузку.
//
//   • Строки без имени клиента пропускаются (с причиной), полностью пустые — молча.
//   • Заказ, который уже есть в кабинете (тот же клиент, товар, дата и сумма), второй раз не добавляется.
//   • Номер заказа выдаёт база, номер из файла сохраняется во внутреннюю заметку.
//   • «Себестоимость» записывается как закупка в юанях по курсу байера («Мой курс» или последний в заказах),
//     чтобы считалась прибыль; если курса нет — как стоимость доставки (с пометкой в заметке).
//   • Статус берётся из текста («в пути», «выдан», «оплачен»…); если колонки нет — выбранный по умолчанию.
//
// Файл .xlsx — это zip из XML-файлов: распаковываем встроенным в браузер DecompressionStream,
// без сторонних библиотек. Старый формат .xls не читаем — просим сохранить как .xlsx.
// Вынесено из app.js. Общие помощники берутся из window.ULA.core. Подключается после app.js.
// =====================================================
(function (U) {
  "use strict";
  var c = U.core;
  var $ = c.$, esc = c.esc, toast = c.toast, money = c.money, num = c.num, state = c.state;

  var MAX_ROWS = 5000;

  // Поля заказа и как их узнать по заголовку колонки (порядок важен: телефон раньше номера, оплата раньше суммы)
  var FIELDS = [
    { k: "phone",    words: ["телефон", "тел.", "тел ", "моб", "whatsapp", "ватсап", "phone", "mobile", "电话", "手机"] },
    { k: "paid",     words: ["оплачено", "оплатил", "оплата", "предоплат", "аванс", "внесено", "paid", "prepay", "已付", "付款"] },
    { k: "cost",     words: ["себестоим", "закуп", "расход", "cost", "成本", "进价"] },
    { k: "tracking", words: ["трек", "track", "单号", "运单"] },
    { k: "date",     words: ["дата", "date", "日期", "число"] },
    { k: "product",  words: ["товар", "наименован", "продукт", "что заказ", "product", "item", "goods", "商品", "产品", "货物"] },
    { k: "client",   words: ["клиент", "фио", "имя", "покупател", "заказчик", "client", "customer", "buyer", "name", "客户", "姓名"] },
    { k: "qty",      words: ["кол-во", "количеств", "кол.", "шт", "qty", "quantity", "pcs", "数量", "件数"] },
    { k: "price",    words: ["сумма", "к оплате", "итого", "стоимость", "цена для клиента", "цена", "total", "amount", "price", "sum", "金额", "总价", "价格"] },
    { k: "weight",   words: ["вес", "кг", "weight", "kg", "重量"] },
    { k: "status",   words: ["статус", "состояние", "status", "状态"] },
    { k: "number",   words: ["№", "номер", "order", "no.", "订单号", "编号"] },
    { k: "supplier", words: ["поставщик", "supplier", "vendor", "供应商"] },
    { k: "currency", words: ["валюта", "currency", "货币", "币种"] },
    { k: "comment",  words: ["коммент", "примеч", "заметк", "note", "comment", "remark", "备注"] }
  ];
  var REQUIRED = ["client"];
  // В окне поля идут в понятном порядке (а не в порядке угадывания)
  var SHOW = ["client", "phone", "date", "product", "qty", "price", "paid", "status", "cost", "weight", "tracking", "number", "supplier", "currency", "comment"];

  var im = { file: "", rows: [], header: [], map: {}, cur: "KGS", status: "delivered", parsed: null, inserted: [], busy: false, photo: false, unsure: [] };

  // Фото тетради: ИИ возвращает строки с этими колонками; байер правит их прямо в окне
  var PHOTO_HEADER = ["Дата", "Клиент", "Телефон", "Товар", "Кол-во", "Сумма", "Оплачено", "Статус", "Комментарий"];
  var PC = { date: 0, client: 1, phone: 2, product: 3, qty: 4, price: 5, paid: 6, status: 7, comment: 8 };
  var MAX_PHOTOS = 5;

  // =====================================================
  //  ЧТЕНИЕ ФАЙЛА
  // =====================================================
  async function inflate(bytes) {
    var ds = new DecompressionStream("deflate-raw");
    var out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }

  // zip: оглавление в конце файла → список файлов с началом данных и способом сжатия
  async function unzip(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), eocd = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("not_zip");
    var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), files = {};
    var dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      var nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      var off = dv.getUint32(p + 42, true);
      var name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      files[name] = { method: method, csize: csize, off: off };
      p += 46 + nlen + xlen + clen;
    }
    return {
      has: function (name) { return !!files[name]; },
      text: async function (name) {
        var f = files[name];
        if (!f) return null;
        var start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
        var data = u8.subarray(start, start + f.csize);
        return dec.decode(f.method === 8 ? await inflate(data) : data);
      }
    };
  }

  function xml(text) { return new DOMParser().parseFromString(text, "application/xml"); }
  function tags(node, name) { return Array.prototype.slice.call(node.getElementsByTagNameNS("*", name)); }
  function colIndex(ref) {
    var m = /^([A-Z]+)/.exec(ref || ""), n = 0;
    if (!m) return -1;
    for (var i = 0; i < m[1].length; i++) n = n * 26 + (m[1].charCodeAt(i) - 64);
    return n - 1;
  }

  async function readXlsx(buf) {
    var z = await unzip(buf);
    // первый лист книги
    var path = "xl/worksheets/sheet1.xml";
    var wb = await z.text("xl/workbook.xml"), rels = await z.text("xl/_rels/workbook.xml.rels");
    if (wb && rels) {
      var sheet = tags(xml(wb), "sheet")[0];
      var rid = sheet && (sheet.getAttribute("r:id") || sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
      tags(xml(rels), "Relationship").forEach(function (r) {
        if (r.getAttribute("Id") === rid) {
          var target = r.getAttribute("Target").replace(/^\//, "");
          path = target.indexOf("xl/") === 0 ? target : "xl/" + target;
        }
      });
    }
    var shared = [];
    var ss = await z.text("xl/sharedStrings.xml");
    if (ss) shared = tags(xml(ss), "si").map(function (si) { return tags(si, "t").map(function (x) { return x.textContent; }).join(""); });
    var sx = await z.text(path);
    if (!sx) throw new Error("no_sheet");
    var rows = [];
    tags(xml(sx), "row").forEach(function (r) {
      var row = [];
      tags(r, "c").forEach(function (cell, k) {
        var idx = colIndex(cell.getAttribute("r"));
        if (idx < 0) idx = row.length;
        var t = cell.getAttribute("t"), v = tags(cell, "v")[0], val = "";
        if (t === "s") val = shared[Number(v && v.textContent)] || "";
        else if (t === "inlineStr") val = tags(cell, "t").map(function (x) { return x.textContent; }).join("");
        else if (t === "b") val = v && v.textContent === "1" ? "TRUE" : "FALSE";
        else if (v) val = t === "str" || t === "e" ? v.textContent : Number(v.textContent);
        if (idx < 300) row[idx] = val;
      });
      rows.push(row);
    });
    return rows;
  }

  // CSV: разделитель «;», «,» или табуляция; кавычки; кодировка UTF-8 или Windows-1251 (так сохраняет Excel)
  function readCsv(buf) {
    var text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
    catch (e) { text = new TextDecoder("windows-1251").decode(buf); }
    text = text.replace(/^﻿/, "");
    var first = text.split(/\r?\n/)[0] || "";
    var sep = [";", "\t", ","].sort(function (a, b) { return first.split(b).length - first.split(a).length; })[0];
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row); row = []; cell = "";
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // =====================================================
  //  РАЗБОР: заголовки, колонки, значения
  // =====================================================
  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " "); }
  // Побеждает слово, которое стоит в заголовке раньше: «Цена за шт» → цена, «Телефон клиента» → телефон.
  // «Номер» — только если больше ничего не подошло («Номер телефона» → телефон).
  function matchField(h) {
    h = norm(h);
    if (!h) return null;
    // цена за одну штуку — это не сумма для клиента (её сайт посчитает сам из «Суммы»)
    if (/за\s*(1\s*)?(шт|ед)|\/\s*шт|per\s*(unit|pc)|unit\s*price|单价/.test(h)) return null;
    var best = null, pos = 1e9;
    FIELDS.forEach(function (f) {
      if (f.k === "number") return;
      f.words.forEach(function (w) { var i = h.indexOf(w); if (i !== -1 && i < pos) { pos = i; best = f.k; } });
    });
    if (best) return best;
    var nf = FIELDS.filter(function (f) { return f.k === "number"; })[0];
    return nf.words.some(function (w) { return h.indexOf(w) !== -1; }) ? "number" : null;
  }

  // Строка с заголовками — та (среди первых 15), где больше всего узнаваемых названий
  function findHeader(rows) {
    var best = -1, score = 0;
    for (var i = 0; i < Math.min(15, rows.length); i++) {
      var s = (rows[i] || []).filter(function (h) { return matchField(h); }).length;
      if (s > score) { score = s; best = i; }
    }
    if (best < 0) best = rows.findIndex(function (r) { return (r || []).filter(function (x) { return String(x).trim(); }).length >= 2; });
    return Math.max(0, best);
  }

  function autoMap(header) {
    var map = {}, used = {};
    FIELDS.forEach(function (f) { map[f.k] = -1; });
    header.forEach(function (h, i) {
      var k = matchField(h);
      if (k && map[k] === -1 && !used[i]) { map[k] = i; used[i] = true; }
    });
    return map;
  }

  function cellStr(v) { return v == null ? "" : String(v).trim(); }

  // «12 500», «12,5», «$1 200.50», «3 000 сом» → число
  function toNum(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v == null ? "" : v).replace(/[\s ]/g, "").replace(/[^\d.,-]/g, "");
    if (!s) return 0;
    if (s.indexOf(",") !== -1 && s.indexOf(".") !== -1) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if ((s.match(/,/g) || []).length === 1 && !/,\d{3}$/.test(s)) s = s.replace(",", ".");
    else s = s.replace(/,/g, "");
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function pad(n) { return ("0" + n).slice(-2); }
  function isoOf(y, m, d) {
    if (y < 100) y += 2000;
    var dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || y < 2000 || y > 2100) return "";
    return y + "-" + pad(m) + "-" + pad(d);
  }
  // Число из Excel (дни с 30.12.1899) или «25.10.2026», «25/10/26», «2026-10-25»
  function toDate(v) {
    if (typeof v === "number" && v > 20000 && v < 80000) {
      var d = new Date(Math.round((v - 25569) * 86400000));
      return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
    }
    var s = cellStr(v), m;
    if ((m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/.exec(s))) return isoOf(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})/.exec(s))) return isoOf(+m[3], +m[2], +m[1]);
    return "";
  }

  var STATUS_WORDS = [
    ["cancelled", ["отмен", "cancel", "取消"]],
    ["delivered", ["выдан", "вручен", "получил", "забрал", "доставлен", "заверш", "закрыт", "delivered", "done", "completed", "已交付", "完成"]],
    ["arrived", ["прибыл", "пришел", "на месте", "в бишкеке", "arrived", "到货"]],
    ["in_transit", ["в пути", "едет", "отправлен", "transit", "shipped", "运输", "已发"]],
    ["china_warehouse", ["склад", "warehouse", "仓库"]],
    ["purchasing", ["закуп", "выкуп", "purchas", "采购"]],
    ["awaiting_payment", ["ожида", "не оплач", "ждет оплат", "awaiting", "unpaid", "待付"]],
    ["new", ["нов", "new", "新"]]
  ];
  function toStatus(v) {
    var s = norm(v);
    if (!s) return "";
    if (c.STATUSES.indexOf(s) !== -1) return s;
    for (var i = 0; i < STATUS_WORDS.length; i++) {
      for (var j = 0; j < STATUS_WORDS[i][1].length; j++) if (s.indexOf(STATUS_WORDS[i][1][j]) !== -1) return STATUS_WORDS[i][0];
    }
    return "";
  }

  function toPhone(v) {
    var s = typeof v === "number" ? String(Math.round(v)) : cellStr(v);
    if (!s) return "";
    var d = s.replace(/\D/g, "");
    if (/^996\d{9}$/.test(d) || /^86\d{11}$/.test(d) || /^7\d{10}$/.test(d)) return "+" + d;
    // номер без кода страны (0555 123 456): код берём из страны кабинета, иначе оставляем как есть
    var code = { KG: "996", KZ: "7", UZ: "998", TJ: "992", RU: "7", CN: "86", AE: "971", TR: "90" }[(state.ws && state.ws.country) || ""];
    if (code && /^0\d{9}$/.test(d)) return "+" + code + d.slice(1);
    return s.slice(0, 40);
  }

  function dupKey(name, product, date, price) {
    return [norm(name), norm(product), date, Math.round(num(price))].join("|");
  }

  // Строки файла → заказы для базы + сколько и почему пропущено
  function build() {
    var m = im.map, out = [], skipped = 0, dups = 0, today = c.todayISO();
    var existing = {};
    (state.orders || []).forEach(function (o) { existing[dupKey(o.client_name, o.product_ru, o.order_date, o.client_price)] = true; });
    var get = function (row, k) { return m[k] >= 0 ? row[m[k]] : ""; };
    im.rows.forEach(function (row) {
      if (!(row || []).some(function (x) { return cellStr(x); })) return;   // пустая строка
      var name = cellStr(get(row, "client")).slice(0, 200);
      if (!name) { skipped++; return; }
      var product = cellStr(get(row, "product")).slice(0, 300) || t("im_no_product");
      var qty = toNum(get(row, "qty")); if (!(qty > 0)) qty = 1;
      var price = toNum(get(row, "price")), paid = toNum(get(row, "paid")), cost = toNum(get(row, "cost"));
      var date = toDate(get(row, "date")) || today;
      var curCell = cellStr(get(row, "currency")).toUpperCase();
      var cur = /^[A-Z]{3}$/.test(curCell) ? curCell : im.cur;
      var status = toStatus(get(row, "status")) || im.status;
      var notes = [];
      // себестоимость: закупка в юанях по курсу байера; валюта закупки в базе — только CNY или USD
      var buy = { cur: "CNY", unit: 0, rate: 1, dcost: 0 };
      if (cost > 0) {
        if (cur === "CNY" || cur === "USD") buy = { cur: cur, unit: Math.round(cost / qty * 100) / 100, rate: 1, dcost: 0 };
        else {
          var r = num(c.lastRateFor("CNY", cur));
          if (r > 0) buy = { cur: "CNY", unit: Math.round(cost / r / qty * 100) / 100, rate: r, dcost: 0 };
          else { buy.dcost = Math.round(cost * 100) / 100; notes.push(t("im_note_cost")); }
        }
      }
      var ref = cellStr(get(row, "number"));
      if (ref) notes.push(t("im_note_ref", { n: ref.slice(0, 40) }));
      var com = cellStr(get(row, "comment"));
      if (com) notes.push(com.slice(0, 900));
      var o = {
        workspace_id: state.ws.id,
        order_date: date,
        status: status,
        client_name: name,
        client_phone: toPhone(get(row, "phone")) || null,
        product_ru: product,
        supplier: cellStr(get(row, "supplier")).slice(0, 200) || null,
        quantity: Math.round(qty * 100) / 100,
        purchase_currency: buy.cur,
        client_currency: cur,
        delivery_currency: cur,
        unit_price_cny: buy.unit,
        exchange_rate: buy.rate,
        delivery_cost: buy.dcost,
        delivery_rate: 1,
        weight_kg: Math.max(0, Math.round(toNum(get(row, "weight")) * 100) / 100),
        client_price: price > 0 ? Math.round(price * 100) / 100 : null,
        paid_amount: Math.max(0, Math.round(paid * 100) / 100),
        tracking_number: cellStr(get(row, "tracking")).replace(/\s+/g, " ").slice(0, 100) || null,
        admin_comment: notes.length ? notes.join("\n") : null
      };
      var k = dupKey(o.client_name, o.product_ru, o.order_date, o.client_price);
      if (existing[k]) { dups++; return; }
      out.push(o);
    });
    return { orders: out.slice(0, MAX_ROWS), skipped: skipped, dups: dups, cut: Math.max(0, out.length - MAX_ROWS) };
  }

  // =====================================================
  //  ОКНО
  // =====================================================
  function show(step) {
    ["file", "map", "done"].forEach(function (s) { $("#im-" + s).classList.toggle("hidden", s !== step); });
  }

  function open() {
    if (state.readOnly || !state.ws) return;
    im.rows = []; im.header = []; im.inserted = []; im.photo = false; im.unsure = [];
    $("#im-input").value = "";
    $("#im-photo-input").value = "";
    $("#im-error").classList.add("hidden");
    reading(false);
    show("file");
    c.openModal("modal-import");
  }

  async function onFile(file) {
    if (!file) return;
    var err = $("#im-error");
    err.classList.add("hidden");
    var name = file.name.toLowerCase();
    try {
      if (/\.xls$/.test(name)) throw new Error("xls");
      if (file.size > 15 * 1024 * 1024) throw new Error("big");
      var buf = await file.arrayBuffer();
      var all = /\.(csv|txt|tsv)$/.test(name) ? readCsv(buf) : await readXlsx(buf);
      var h = findHeader(all);
      im.header = (all[h] || []).map(cellStr);
      im.rows = all.slice(h + 1);
      if (!im.rows.some(function (r) { return (r || []).some(function (x) { return cellStr(x); }); })) throw new Error("empty");
      im.file = file.name;
      im.photo = false; im.unsure = [];
      im.map = autoMap(im.header);
      im.cur = (state.ws && state.ws.default_client_currency) || "KGS";
      im.status = "delivered";   // старые заказы обычно уже выданы; выданные и оплаченные не мешают на главном экране
      renderMap();
      show("map");
    } catch (e) {
      console.warn("import", e);
      var code = e && e.message;
      err.textContent = t(code === "xls" ? "im_e_xls" : code === "big" ? "im_e_big" : code === "empty" ? "im_e_empty" : "im_e_read");
      err.classList.remove("hidden");
    }
  }

  // ---------- Фото тетради ----------
  function reading(on) {
    $("#im-reading").classList.toggle("hidden", !on);
    $("#im-drop").classList.toggle("hidden", on);
    $("#im-photo-box").classList.toggle("hidden", on);
  }

  // Уменьшаем фото до 1600 px по длинной стороне (почерк читается, а отправка быстрая)
  async function photoData(file) {
    var bmp = await createImageBitmap(file);
    var scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    var cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
    cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    var url = cv.toDataURL("image/jpeg", 0.85);
    return { mime: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
  }

  async function errorCode(err) {
    try { var body = err && err.context && (await err.context.json()); if (body && body.error) return body.error; } catch (e) { /* ignore */ }
    return "";
  }

  async function onPhotos(list) {
    var files = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name); });
    if (!files.length) return;
    var err = $("#im-error");
    err.classList.add("hidden");
    if (files.length > MAX_PHOTOS) { toast(t("im_photo_max", { n: MAX_PHOTOS }), "error"); files = files.slice(0, MAX_PHOTOS); }
    reading(true);
    try {
      var images = [];
      for (var i = 0; i < files.length; i++) images.push(await photoData(files[i]));
      var res = await c.db().functions.invoke("photo-orders", { body: { images: images } });
      if (res.error) throw new Error((await errorCode(res.error)) || "ai_failed");
      var data = res.data || {};
      if (data.error) throw new Error(data.error);
      var rows = data.rows || [];
      if (!rows.length) throw new Error("photo_empty");
      im.header = PHOTO_HEADER.slice();
      im.rows = rows.map(function (r) {
        return [r.date || "", r.client || "", r.phone || "", r.product || "", r.qty == null ? "" : r.qty, r.price == null ? "" : r.price,
          r.paid == null ? "" : r.paid, toStatus(r.status) || "", r.comment || ""];
      });
      im.unsure = rows.map(function (r) { return !!r.unsure; });
      im.photo = true;
      im.file = t("im_photo_file", { n: files.length });
      im.remaining = data.remaining;
      im.map = autoMap(im.header);
      im.cur = (state.ws && state.ws.default_client_currency) || "KGS";
      im.status = "delivered";
      renderMap();
      show("map");
    } catch (e) {
      console.warn("photo import", e);
      var code = e && e.message;
      err.textContent = t(code === "quota_exceeded" ? "im_e_quota" : code === "rate_limited" ? "im_e_busy" : code === "photo_empty" ? "im_e_photo_empty" : "im_e_photo");
      err.classList.remove("hidden");
    } finally {
      reading(false);
      $("#im-photo-input").value = "";
    }
  }

  // Строки с фото: всё можно поправить, лишнее — удалить
  function photoRowsHtml() {
    var opt = '<option value="">' + esc(t("im_st_default")) + "</option>" + c.STATUSES.map(function (s) {
      return '<option value="' + s + '">' + esc(t("status_" + s)) + "</option>";
    }).join("");
    return im.rows.map(function (row, r) {
      var inp = function (col, cls, type, ph) {
        var v = row[col] == null ? "" : String(row[col]);
        if (type === "date") v = toDate(v) || "";
        return '<label class="' + cls + '"><span>' + esc(ph) + '</span><input data-r="' + r + '" data-c="' + col + '" type="' + (type || "text") + '"' +
          (type === "text" && (col === PC.qty || col === PC.price || col === PC.paid) ? ' inputmode="decimal"' : "") +
          ' value="' + esc(v) + '"></label>';
      };
      return '<div class="im-edit' + (im.unsure[r] ? " unsure" : "") + (cellStr(row[PC.client]) ? "" : " bad") + '">' +
        '<div class="im-edit-top"><b>' + (r + 1) + "</b>" + (im.unsure[r] ? '<span class="im-unsure">' + esc(t("im_unsure")) + "</span>" : "") +
        '<button type="button" class="icon-btn im-del" data-del="' + r + '" aria-label="' + esc(t("remove")) + '">×</button></div>' +
        '<div class="im-edit-grid">' +
          inp(PC.client, "w2", "text", t("im_f_client")) + inp(PC.phone, "", "text", t("im_f_phone")) +
          inp(PC.product, "w2", "text", t("im_f_product")) + inp(PC.qty, "", "text", t("im_f_qty")) +
          inp(PC.price, "", "text", t("im_sum")) + inp(PC.paid, "", "text", t("im_f_paid")) + inp(PC.date, "", "date", t("im_f_date")) +
          '<label class="w2"><span>' + esc(t("im_f_status")) + '</span><select data-r="' + r + '" data-c="' + PC.status + '">' +
            opt.replace('value="' + (row[PC.status] || "") + '"', 'value="' + (row[PC.status] || "") + '" selected') + "</select></label>" +
          inp(PC.comment, "w3", "text", t("im_f_comment")) +
        "</div></div>";
    }).join("");
  }

  // Пример из файла — уже в том виде, как его поймёт сайт (дата, телефон, статус)
  function example(i, k) {
    for (var r = 0; r < Math.min(im.rows.length, 30); r++) {
      var raw = (im.rows[r] || [])[i], v = cellStr(raw);
      if (!v) continue;
      if (k === "date") v = toDate(raw) ? c.fmtDate(toDate(raw)) : v;
      else if (k === "phone") v = toPhone(raw);
      else if (k === "status") v = toStatus(raw) ? t("status_" + toStatus(raw)) : v;
      return v.length > 28 ? v.slice(0, 27) + "…" : v;
    }
    return "";
  }

  function renderMap() {
    var opts = function (sel) {
      return '<option value="-1">' + esc(t("im_none")) + "</option>" + im.header.map(function (h, i) {
        return '<option value="' + i + '"' + (i === sel ? " selected" : "") + ">" + esc(h || t("im_col", { n: i + 1 })) + "</option>";
      }).join("");
    };
    $("#im-fname").textContent = im.photo
      ? t("im_photo_found", { n: im.rows.length }) + (im.remaining != null ? " · " + t("im_photo_left", { n: im.remaining }) : "")
      : t("im_file", { f: im.file, n: im.rows.filter(function (r) { return (r || []).some(function (x) { return cellStr(x); }); }).length });
    $("#im-mapbox").classList.toggle("hidden", im.photo);
    var field = function (k) {
      var i = im.map[k], req = REQUIRED.indexOf(k) !== -1;
      return '<label class="im-field' + (req ? " req" : "") + (i >= 0 ? " on" : "") + '"><span>' + esc(t("im_f_" + k)) + (req ? " *" : "") +
        '</span><select data-im-field="' + k + '">' + opts(i) + "</select>" + "<small>" + (i >= 0 ? esc(example(i, k)) : "") + "</small></label>";
    };
    // найденные и обязательные — сразу видно; остальные свёрнуты, чтобы не пугать длинным списком
    var main = SHOW.filter(function (k) { return im.map[k] >= 0 || REQUIRED.indexOf(k) !== -1; });
    var rest = SHOW.filter(function (k) { return main.indexOf(k) === -1; });
    var wasOpen = $("#im-fields .im-more") && $("#im-fields .im-more").open;
    $("#im-fields").innerHTML = '<div class="im-grid">' + main.map(field).join("") + "</div>" +
      (rest.length ? '<details class="im-more"' + (wasOpen ? " open" : "") + "><summary>" + esc(t("im_more", { n: rest.length })) + '</summary><div class="im-grid">' +
        rest.map(field).join("") + "</div></details>" : "");
    c.fillCurrencySelect($("#im-cur"), im.cur);
    $("#im-status").innerHTML = c.STATUSES.map(function (s) { return '<option value="' + s + '">' + esc(t("status_" + s)) + "</option>"; }).join("");
    $("#im-status").value = im.status;
    renderPreview();
  }

  function renderPreview() {
    if (im.photo) {
      $("#im-preview").innerHTML = '<p class="fine-print im-photo-hint">' + esc(t("im_photo_check")) + "</p>" + photoRowsHtml();
      summary();
      return;
    }
    var p = im.parsed = build();
    var n = p.orders.length;
    var rows = p.orders.slice(0, 4).map(function (o) {
      var sum = o.client_price != null ? c.cur(o.client_price, o.client_currency) : "—";
      return '<div class="im-row"><div class="im-row-main"><b>' + esc(o.product_ru) + " × " + money(o.quantity) + "</b><span>" +
        esc(o.client_name) + (o.client_phone ? " · " + esc(o.client_phone) : "") + " · " + esc(c.fmtDate(o.order_date)) + "</span></div>" +
        '<div class="im-row-side"><b>' + esc(sum) + "</b>" + (o.paid_amount ? "<small>" + esc(t("l_paid")) + ": " + esc(c.cur(o.paid_amount, o.client_currency)) + "</small>" : "") +
        '<span class="pill pill-dot st-' + o.status + '">' + esc(t("status_" + o.status)) + "</span></div></div>";
    }).join("");
    $("#im-preview").innerHTML = n ? '<div class="im-list">' + rows + (n > 4 ? '<p class="fine-print">' + esc(t("im_more_rows", { n: n - 4 })) + "</p>" : "") + "</div>" : "";
    summary();
  }

  // Предупреждения и кнопка «Загрузить» (без перерисовки строк — чтобы не сбивать ввод)
  function summary() {
    var p = im.parsed = build();
    var n = p.orders.length;
    var notes = [];
    if (p.skipped) notes.push(t("im_skip", { n: p.skipped }));
    if (p.dups) notes.push(t("im_dups", { n: p.dups }));
    if (p.cut) notes.push(t("im_cut", { n: MAX_ROWS }));
    if (im.map.client < 0) notes.unshift(t("im_need_client"));
    $("#im-notes").innerHTML = notes.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("");
    $("#im-go").disabled = !n || im.map.client < 0 || im.busy;
    $("#im-go").textContent = n ? t("im_go", { n: n }) : t("im_go_none");
  }

  async function go() {
    var p = im.parsed;
    if (!p || !p.orders.length || im.busy) return;
    im.busy = true;
    var btn = $("#im-go"), db = c.db(), done = 0;
    btn.disabled = true;
    im.inserted = [];
    try {
      for (var i = 0; i < p.orders.length; i += 100) {
        var res = await db.from("orders").insert(p.orders.slice(i, i + 100)).select("id");
        if (res.error) throw res.error;
        (res.data || []).forEach(function (r) { im.inserted.push(r.id); });
        done += (res.data || []).length;
        btn.textContent = t("im_progress", { a: done, b: p.orders.length });
      }
      $("#im-done-text").textContent = t("im_done", { n: done });
      $("#im-undo").classList.toggle("hidden", state.myRole === "staff");
      show("done");
      await c.reloadOrders();
    } catch (err) {
      c.handleError(err);
      if (done) {   // часть уже загрузилась — показываем, сколько, чтобы можно было отменить
        $("#im-done-text").textContent = t("im_partial", { n: done, b: p.orders.length });
        $("#im-undo").classList.toggle("hidden", state.myRole === "staff");
        show("done");
        await c.reloadOrders();
      }
    } finally {
      im.busy = false;
      if (!$("#im-map").classList.contains("hidden")) renderPreview();
    }
  }

  async function undo() {
    if (!im.inserted.length || !window.confirm(t("im_undo_confirm", { n: im.inserted.length }))) return;
    var db = c.db(), btn = $("#im-undo");
    btn.disabled = true;
    try {
      for (var i = 0; i < im.inserted.length; i += 100) {
        var res = await db.from("orders").delete().in("id", im.inserted.slice(i, i + 100));
        if (res.error) throw res.error;
      }
      im.inserted = [];
      c.closeModal("modal-import");
      toast(t("im_undone"), "ok");
      await c.reloadOrders();
    } catch (err) {
      c.handleError(err);
    } finally {
      btn.disabled = false;
    }
  }

  // Образец: те же колонки, которые сайт узнаёт сам
  function template() {
    var cur = (state.ws && state.ws.default_client_currency) || "KGS";
    U.xlsx.download("ula-obrazec-zakazov.xlsx", [{
      name: t("im_tpl_sheet"),
      title: t("im_tpl_title"),
      subtitle: t("im_tpl_sub"),
      columns: [
        { h: t("im_f_date"), w: 12, type: "date" }, { h: t("im_f_client"), w: 22, type: "text" }, { h: t("im_f_phone"), w: 18, type: "text" },
        { h: t("im_f_product"), w: 30, type: "text" }, { h: t("im_f_qty"), w: 9, type: "int" }, { h: t("im_f_price") + ", " + cur, w: 16, type: "money" },
        { h: t("im_f_paid") + ", " + cur, w: 14, type: "money" }, { h: t("im_f_cost") + ", " + cur, w: 16, type: "money" }, { h: t("im_f_weight"), w: 10, type: "money" },
        { h: t("im_f_status"), w: 16, type: "text" }, { h: t("im_f_tracking"), w: 18, type: "text" }, { h: t("im_f_comment"), w: 28, type: "text" }
      ],
      rows: [
        [c.todayISO(), "Alex", "+1 202 555 0100", "Sneakers", 2, 7000, 3000, 5200, 2.5, t("status_in_transit"), "YT1234567890", ""],
        [c.todayISO(), "Maria", "+44 20 7946 0000", "Bag", 1, 4500, 4500, 3000, 1, t("status_delivered"), "", t("im_tpl_note")]
      ],
      total: null
    }]);
  }

  function bind() {
    $("#im-input").addEventListener("change", function (e) { onFile(e.target.files && e.target.files[0]); });
    $("#im-pick").addEventListener("click", function () { $("#im-input").click(); });
    var drop = $("#im-drop");
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { onFile(e.dataTransfer.files && e.dataTransfer.files[0]); });
    $("#im-template").addEventListener("click", template);
    $("#im-fields").addEventListener("change", function (e) {
      var s = e.target.closest("[data-im-field]");
      if (!s) return;
      var k = s.getAttribute("data-im-field"), v = Number(s.value);
      // одна колонка — одно поле: если её уже выбрали для другого поля, там снимаем
      if (v >= 0) Object.keys(im.map).forEach(function (x) { if (x !== k && im.map[x] === v) im.map[x] = -1; });
      im.map[k] = v;
      renderMap();
    });
    $("#im-cur").addEventListener("change", function (e) { im.cur = e.target.value; renderPreview(); });
    $("#im-status").addEventListener("change", function (e) { im.status = e.target.value; renderPreview(); });
    $("#im-back").addEventListener("click", function () { $("#im-input").value = ""; im.photo = false; show("file"); });
    // фото тетради
    $("#im-photo-pick").addEventListener("click", function () { $("#im-photo-input").click(); });
    $("#im-photo-input").addEventListener("change", function (e) { onPhotos(e.target.files); });
    $("#im-preview").addEventListener("input", onEdit);
    $("#im-preview").addEventListener("change", onEdit);
    $("#im-preview").addEventListener("click", function (e) {
      var d = e.target.closest("[data-del]");
      if (!d) return;
      var r = Number(d.getAttribute("data-del"));
      im.rows.splice(r, 1); im.unsure.splice(r, 1);
      renderPreview();
    });
    $("#im-go").addEventListener("click", go);
    $("#im-undo").addEventListener("click", undo);
    $("#im-finish").addEventListener("click", function () { c.closeModal("modal-import"); });
    $$("[data-import-open]").forEach(function (b) { b.addEventListener("click", open); });
  }
  function onEdit(e) {
    var el = e.target, r = el.getAttribute("data-r"), col = el.getAttribute("data-c");
    if (r == null || col == null || !im.rows[r]) return;
    im.rows[r][Number(col)] = el.value;
    var card = el.closest(".im-edit");
    if (card && Number(col) === PC.client) card.classList.toggle("bad", !el.value.trim());
    summary();
  }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  U.importer = { bind: bind, open: open, _readXlsx: readXlsx, _readCsv: readCsv, _findHeader: findHeader, _autoMap: autoMap,
    _toNum: toNum, _toDate: toDate, _toStatus: toStatus, _toPhone: toPhone };
})(window.ULA);
