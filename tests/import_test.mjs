// =====================================================
// ПРОВЕРКА ИМПОРТА ИЗ EXCEL/CSV (js/import.js) — разбор и проверка строк без браузера и без базы.
//
//   node tests/import_test.mjs
//
// Проверяет: замечания по каждой строке с номером как в Excel, пропуск строк без клиента, повторы с кабинетом
// и внутри файла, обезвреживание формул Excel, нераспознанные дата/статус/числа/телефон, оплату больше суммы,
// чтение CSV (разделители, кавычки, Windows-1251) и что сайт сам ничего не пишет в базу на шаге проверки.
// =====================================================
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
const ok = (cond, name) => { if (!cond) { console.error("❌ " + name); process.exit(1); } passed++; console.log("   ✓ " + name); };

const STATUSES = ["new", "awaiting_payment", "purchasing", "china_warehouse", "in_transit", "arrived", "delivered", "cancelled"];
let dbCalls = 0;
const core = {
  $: () => null, esc: (s) => String(s), toast: () => {}, money: String, num: (v) => Number(v) || 0,
  state: { ws: { id: "ws1", country: "KG" }, orders: [] },
  todayISO: () => "2026-11-18", lastRateFor: (a, b) => (a === "CNY" && b === "KGS" ? "12.5" : ""), STATUSES,
  db: () => { dbCalls++; return null; },
};
const ctx = { window: { ULA: { core } }, t: (k, o) => k + (o && o.n !== undefined && o.n !== "" ? ":" + o.n : ""), console, TextDecoder, Uint8Array, DataView, Blob, Response, DOMParser: undefined, URL };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js/import.js"), "utf8"), ctx, { filename: "js/import.js" });
const I = ctx.window.ULA.importer;

console.log("▶ Импорт из Excel/CSV");

// ---------- заголовки и колонки ----------
const rows = [
  ["Отчёт за октябрь"],
  [],
  ["Дата", "Клиент", "Телефон", "Товар", "Кол-во", "Сумма", "Оплачено", "Статус", "Комментарий"],
  ["25.10.2026", "Айбек", "0555 123 456", "Кроссовки", "2", "7 000", "3000", "в пути", ""],
  ["", "", "", "Строка без клиента", "1", "100", "", "", ""],
  ["вчера", "Нурлан", "+996700111222", "=HYPERLINK(\"http://evil\",\"Сумка\")", "1", "договорная", "", "что-то непонятное", "@SUM(A1:A9)"],
  ["25.10.2026", "Айбек", "0555 123 456", "Кроссовки", "2", "7000", "0", "выдан", ""],
  ["26.10.2026", "Мария", "12345", "Куртка", "абв", "1000", "1500", "выдан", "-cmd(1)"],
  ["", "", "", "", "", "", "", "", ""],
  ["27.10.2026", "Старый", "+996555000000", "Зонт", "1", "500", "0", "новый", ""],
];
const h = I._findHeader(rows);
ok(h === 2, "строка с заголовками найдена под шапкой отчёта (строка 3)");
const map = I._autoMap(rows[h]);
ok(map.client === 1 && map.phone === 2 && map.product === 3 && map.price === 5 && map.paid === 6 && map.status === 7 && map.comment === 8, "колонки угадываются по заголовкам");

const existing = [{ client_name: "Старый", product_ru: "Зонт", order_date: "2026-10-27", client_price: 500 }];
const r = I._analyze(rows.slice(h + 1), map, { existing, cur: "KGS", status: "delivered", today: "2026-11-18", headerRow: h, workspaceId: "ws1" });
const byLine = Object.fromEntries(r.items.map((x) => [x.line, x]));
ok(r.items.length === 6, "пустые строки не считаются, остальные — каждая со своим номером (6)");
ok(Object.keys(byLine).join(",") === "4,5,6,7,8,10", "номера строк как в Excel: 4, 5, 6, 7, 8, 10");

ok(byLine[4].order && !byLine[4].errors.length && byLine[4].order.client_phone === "+996555123456" && byLine[4].order.client_price === 7000 && byLine[4].order.status === "in_transit",
  "обычная строка: телефон с кодом страны, сумма «7 000», статус «в пути»");
ok(!byLine[5].order && byLine[5].errors.includes("no_client"), "строка 5 без клиента — пропущена с причиной");
const f = byLine[6];
ok(f.order && f.warnings.includes("formula") && !/^[=@+\-]/.test(f.order.product_ru) && !/^[=@+\-]/.test(f.order.admin_comment || ""),
  "формулы Excel обезврежены: знак формулы убран, строка помечена");
ok(f.warnings.includes("date") && f.order.order_date === "2026-11-18", "«вчера» — дата не распознана: сегодняшняя и замечание");
ok(f.warnings.includes("status") && f.order.status === "delivered", "непонятный статус — статус по умолчанию и замечание");
ok(f.warnings.includes("price") && f.order.client_price === null, "«договорная» — сумма не выдумывается (пусто) и замечание");
ok(!byLine[7].order && byLine[7].errors.includes("dup_file") && byLine[7].dupOf === 4, "повтор строки 4 внутри файла — пропущен, указано с какой строкой");
const m = byLine[8];
ok(m.order && m.warnings.includes("qty") && m.order.quantity === 1, "количество «абв» — 1 шт. и замечание");
ok(m.warnings.includes("overpaid") && m.order.paid_amount === 1500, "оплачено больше суммы — загружается как есть, но с замечанием");
ok(m.warnings.includes("phone") && m.order.client_phone === "12345", "телефон без кода страны — сохраняется как есть, с замечанием");
ok(m.warnings.includes("formula") && m.order.admin_comment === "cmd(1)", "«-cmd(1)» в комментарии тоже обезврежен");
ok(!byLine[10].order && byLine[10].errors.includes("dup_cabinet"), "заказ, который уже есть в кабинете, второй раз не добавляется");
ok(r.orders.length === 3 && r.skipped === 1 && r.dups === 1 && r.fileDups === 1 && r.warned === 2, "итог: 3 к загрузке, 1 без клиента, 1 повтор с кабинетом, 1 повтор в файле, 2 с замечаниями");
ok(r.orders.every((o) => o.workspace_id === "ws1" && !("id" in o) && !("order_number" in o)), "номер заказа выдаёт база; в запись попадает только свой кабинет");
ok(dbCalls === 0, "на шаге проверки сайт к базе не обращается");

// ---------- обычный текст не портится ----------
const st = (v) => { const w = []; return [I._safeText(v, 100, (c) => w.push(c)), w.length]; };
ok(JSON.stringify(st("-5% скидка")) === JSON.stringify(["-5% скидка", 0]) && JSON.stringify(st("+1 пара в подарок")) === JSON.stringify(["+1 пара в подарок", 0]) &&
   JSON.stringify(st("Кроссовки (42)")) === JSON.stringify(["Кроссовки (42)", 0]), "обычный текст с «-», «+» и скобками не меняется");
ok(st("=1+1")[0] === "1+1" && st("@cmd")[0] === "cmd" && st("+SUM(A1)")[0] === "SUM(A1)" && st("\t=x")[0] === "x", "=…, @…, +SUM(…), табуляция в начале — знак формулы убран");

// ---------- фото тетради: «не уверен» ----------
const pr = I._analyze([["", "Азиз", "", "Сумка", "", "", "", "", ""]], I._autoMap(["Дата", "Клиент", "Телефон", "Товар", "Кол-во", "Сумма", "Оплачено", "Статус", "Комментарий"]),
  { today: "2026-11-18", unsure: [true], headerRow: -1 });
ok(pr.items[0].line === 1 && pr.items[0].warnings.includes("unsure") && pr.orders.length === 1, "фото тетради: неразборчивая строка помечена, номер записи с 1");

// ---------- CSV ----------
const enc = (s) => new TextEncoder().encode(s).buffer;
let csv = I._readCsv(enc("﻿Клиент;Товар;Сумма\r\n\"Иванов; Пётр\";\"Сумка \"\"большая\"\"\";1 500\r\n"));
ok(csv[1][0] === "Иванов; Пётр" && csv[1][1] === 'Сумка "большая"' && csv[1][2] === "1 500", "CSV: разделитель «;», кавычки внутри и «;» в имени");
csv = I._readCsv(enc("Client,Product\nA,B\n"));
ok(csv[1][0] === "A" && csv[1][1] === "B", "CSV: разделитель «,»");
const cp1251 = new Uint8Array([0xca, 0xeb, 0xe8, 0xe5, 0xed, 0xf2, 0x3b, 0x54, 0x0a, 0xc0, 0xe9, 0xe1, 0xe5, 0xea, 0x3b, 0x31]);   // «Клиент;T\nАйбек;1» в Windows-1251
csv = I._readCsv(cp1251.buffer);
ok(csv[0][0] === "Клиент" && csv[1][0] === "Айбек", "CSV из Excel в кодировке Windows-1251 читается");

// ---------- числа и даты ----------
ok(I._toNum("1 200,50") === 1200.5 && I._toNum("$1,200.50") === 1200.5 && I._toNum("3 000 сом") === 3000 && I._toNum("") === 0, "числа: «1 200,50», «$1,200.50», «3 000 сом»");
ok(I._toDate(46000) === "2025-12-09" && I._toDate("2026-10-25") === "2026-10-25" && I._toDate("25/10/26") === "2026-10-25" && I._toDate("31.02.2026") === "", "даты: число Excel, ГГГГ-ММ-ДД, дд/мм/гг; 31 февраля — нет");
ok(I.ONE_SHOT === 1000, "до 1000 заказов уходят одним запросом (всё или ничего)");

console.log("🎉 Импорт: проверок пройдено — " + passed);
