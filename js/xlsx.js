// =====================================================
// ULA FACTORY — выгрузка в настоящий Excel (.xlsx) с оформлением.
//
// Вместо серого CSV получается аккуратная таблица: заголовок и подзаголовок,
// тёмная шапка, полосатые строки, правильные ширины колонок, числа с разделителями,
// проценты, даты, итоговая строка, закреплённая шапка и фильтр.
//
// Без внешних библиотек: файл .xlsx — это zip из нескольких XML-файлов, собираем сами
// (без сжатия, этого достаточно). Подключается до остальных модулей, использует только window.ULA.
//
// ULA.xlsx.download(имяФайла, [лист, …]); лист:
//   { name, title, subtitle, columns: [{ h: "Заголовок", w: ширина, type: "text|int|money|pct|date" }],
//     rows: [[значения…]], total: [значения…] | null }
// =====================================================
(function (U) {
  "use strict";

  // ---------- Оформление (стили) ----------
  var TYPES = ["text", "int", "money", "pct", "date"];
  var NUMFMT = { text: 0, int: 3, money: 4, pct: 164, date: 165 };   // 3 = #,##0   4 = #,##0.00
  var ALIGN = { text: "left", int: "right", money: "right", pct: "right", date: "center" };

  // номера форматов ячеек (cellXfs): 0 — по умолчанию, 1 — шапка, 2 — заголовок, 3 — подзаголовок, дальше по типам
  var XF = { header: 1, title: 2, subtitle: 3 };
  function xfOf(type, variant) {          // variant: 0 обычная, 1 полосатая, 2 итог
    return 4 + TYPES.indexOf(type) * 3 + variant;
  }

  function stylesXml() {
    var fonts =
      '<font><sz val="11"/><name val="Calibri"/><color rgb="FF151417"/></font>' +                 // 0 обычный
      '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>' +             // 1 шапка
      '<font><b/><sz val="18"/><name val="Calibri"/><color rgb="FF151417"/></font>' +             // 2 заголовок
      '<font><i/><sz val="10"/><name val="Calibri"/><color rgb="FF5D606A"/></font>' +             // 3 подзаголовок
      '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF151417"/></font>';              // 4 итог
    var fills =
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF151417"/><bgColor indexed="64"/></patternFill></fill>' +   // 2 шапка
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>' +   // 3 полоса
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE1E3E7"/><bgColor indexed="64"/></patternFill></fill>';    // 4 итог
    var line = '<color rgb="FFE1E3E7"/>';
    var borders =
      '<border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin">' + line + '</bottom><diagonal/></border>' +                       // 1 тонкая линия снизу
      '<border><left/><right/><top style="medium"><color rgb="FF151417"/></top><bottom/><diagonal/></border>';             // 2 линия над итогом

    var xfs = [];
    xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');                                              // 0
    xfs.push('<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'); // 1 шапка
    xfs.push('<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>');                                // 2 заголовок
    xfs.push('<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>');                                // 3 подзаголовок
    TYPES.forEach(function (type) {
      [0, 1, 2].forEach(function (v) {
        var font = v === 2 ? 4 : 0, fill = v === 1 ? 3 : v === 2 ? 4 : 0, border = v === 2 ? 2 : 1;
        xfs.push('<xf numFmtId="' + NUMFMT[type] + '" fontId="' + font + '" fillId="' + fill + '" borderId="' + border +
          '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
          '<alignment horizontal="' + ALIGN[type] + '" vertical="center"' + (type === "text" ? ' wrapText="1"' : "") + "/></xf>");
      });
    });

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0&quot; %&quot;"/><numFmt numFmtId="165" formatCode="dd\\.mm\\.yyyy"/></numFmts>' +
      '<fonts count="5">' + fonts + "</fonts>" +
      '<fills count="5">' + fills + "</fills>" +
      '<borders count="3">' + borders + "</borders>" +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";
  }

  // ---------- Помощники ----------
  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function colName(i) {            // 0 → A, 26 → AA
    var s = "";
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
    return s;
  }

  function dateSerial(v) {         // "2026-10-24" → число дней Excel
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    if (!m) return null;
    return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  function cell(ref, type, value, style) {
    if (value === null || value === undefined || value === "") return '<c r="' + ref + '" s="' + style + '"/>';
    if (type === "date") {
      var d = dateSerial(value);
      return d === null ? '<c r="' + ref + '" s="' + style + '"/>' : '<c r="' + ref + '" s="' + style + '"><v>' + d + "</v></c>";
    }
    if (type !== "text") {
      var n = Number(value);
      return isFinite(n) ? '<c r="' + ref + '" s="' + style + '"><v>' + n + "</v></c>" : '<c r="' + ref + '" s="' + style + '"/>';
    }
    return '<c r="' + ref + '" s="' + style + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(value) + "</t></is></c>";
  }

  function sheetXml(sh) {
    var cols = sh.columns, nc = cols.length, rowsXml = [], r = 1;
    var last = colName(nc - 1);

    rowsXml.push('<row r="1" ht="30" customHeight="1">' + cell("A1", "text", sh.title || sh.name, XF.title) + "</row>");
    rowsXml.push('<row r="2" ht="18" customHeight="1">' + cell("A2", "text", sh.subtitle || "", XF.subtitle) + "</row>");
    r = 4;
    var head = cols.map(function (c, i) { return cell(colName(i) + r, "text", c.h, XF.header); }).join("");
    rowsXml.push('<row r="' + r + '" ht="32" customHeight="1">' + head + "</row>");
    var headRow = r;

    sh.rows.forEach(function (row, idx) {
      r++;
      var v = idx % 2 ? 1 : 0;
      rowsXml.push('<row r="' + r + '" ht="20" customHeight="1">' + cols.map(function (c, i) {
        return cell(colName(i) + r, c.type, row[i], xfOf(c.type, v));
      }).join("") + "</row>");
    });
    var lastData = r;

    if (sh.total) {
      r++;
      rowsXml.push('<row r="' + r + '" ht="24" customHeight="1">' + cols.map(function (c, i) {
        return cell(colName(i) + r, c.type, sh.total[i], xfOf(c.type, 2));
      }).join("") + "</row>");
    }

    var widths = '<cols>' + cols.map(function (c, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (c.w || 14) + '" customWidth="1"/>';
    }).join("") + "</cols>";

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView showGridLines="0" workbookViewId="0">' +
      '<pane ySplit="' + headRow + '" topLeftCell="A' + (headRow + 1) + '" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A' + (headRow + 1) + '" sqref="A' + (headRow + 1) + '"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="18"/>' + widths +
      "<sheetData>" + rowsXml.join("") + "</sheetData>" +
      (sh.rows.length ? '<autoFilter ref="A' + headRow + ":" + last + lastData + '"/>' : "") +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape"/>' +
      "</worksheet>";
  }

  function safeSheetName(name, used) {
    var n = String(name || "Sheet").replace(/[\[\]:*?\/\\]/g, " ").trim().slice(0, 31) || "Sheet";
    var base = n, k = 2;
    while (used.indexOf(n.toLowerCase()) !== -1) n = base.slice(0, 28) + " " + (k++);
    used.push(n.toLowerCase());
    return n;
  }

  // ---------- ZIP без сжатия ----------
  var CRC = (function () {
    var t = [], n, k, c;
    for (n = 0; n < 256; n++) {
      c = n;
      for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(files) {                // files: [{ name, text }]
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    function u16(n) { return [n & 255, (n >>> 8) & 255]; }
    function u32(n) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var head = [0x50, 0x4B, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += head.length + name.length + data.length;
    });
    var cdStart = offset, cdSize = 0;
    central.forEach(function (c) {
      var h = [0x50, 0x4B, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size),
        u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset));
      parts.push(new Uint8Array(h), c.name);
      cdSize += h.length + c.name.length;
    });
    parts.push(new Uint8Array([0x50, 0x4B, 5, 6].concat(u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0))));
    return new Blob(parts, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  // Собрать файл .xlsx (Blob)
  function build(sheets) {
    var used = [], names = sheets.map(function (s) { return safeSheetName(s.name, used); });
    var files = [];
    files.push({ name: "[Content_Types].xml", text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") +
      "</Types>" });
    files.push({ name: "_rels/.rels", text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: "xl/workbook.xml", text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map(function (n, i) { return '<sheet name="' + xmlEsc(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>" });
    files.push({ name: "xl/_rels/workbook.xml.rels", text:
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: "xl/styles.xml", text: stylesXml() });
    sheets.forEach(function (s, i) { files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", text: sheetXml(s) }); });
    return zip(files);
  }

  function download(filename, sheets) {
    var blob = build(sheets);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  U.xlsx = { build: build, download: download, _crc32: crc32 };
})(window.ULA = window.ULA || {});
