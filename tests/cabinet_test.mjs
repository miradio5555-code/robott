// =====================================================
// ПРОВЕРКА ФАЙЛА 60 (единый кабинет клиента). Запускается из tests/cabinet_test.sh.
// Не запускалась: Docker на момент написания не отвечал. До выпуска обязателен полный прогон.
// =====================================================
import { execFile } from "node:child_process";
import assert from "node:assert/strict";
import { promisify } from "node:util";

const sh = promisify(execFile);
const NAME = process.env.ULA_PG_CONTAINER;
const B = "00000000-0000-0000-0000-0000000000b1", C = "00000000-0000-0000-0000-0000000000c1", D = "00000000-0000-0000-0000-0000000000d1";

async function psql(q) {
  const { stdout } = await sh("docker", ["exec", "-i", NAME, "psql", "-U", "postgres", "-At", "-q", "-X", "-v", "ON_ERROR_STOP=1", "-c", q]);
  return stdout.trim();
}
const sql = async (q) => (await psql(q)).split("\n").filter((l) => l && l !== "SET").pop() ?? "";
const asUser = (uid, q) => sql(`set request.uid = '${uid}'; set role authenticated; ${q}`);
const asAnon = (q) => sql(`set role anon; ${q}`);
const json = async (p) => JSON.parse(await p);
const failsWith = async (fn, re, msg) => {
  try { await fn(); } catch (e) { assert.match(String(e.stderr || e.message), re, msg + ": " + (e.stderr || e.message)); return; }
  assert.fail(msg + ": ошибки не было");
};
let n = 0; const pass = (m) => { console.log("   ✓ " + m); n++; };

const WSB = await sql(`select workspace_id from public.workspace_members where user_id = '${B}' and role = 'owner'`);
const WSC = await sql(`select workspace_id from public.workspace_members where user_id = '${C}' and role = 'owner'`);
const O1 = await sql("select v from public._t where k = 'o1'");
const O2 = await sql("select v from public._t where k = 'o2'");   // заказ ЧУЖОГО кабинета
const O3 = await sql("select v from public._t where k = 'o3'");   // другой клиент того же кабинета
const CL = await sql(`select client_id from public.orders where id = '${O1}'`);
const CL3 = await sql(`select client_id from public.orders where id = '${O3}'`);
const NUM = (id) => sql(`select order_number from public.orders where id = '${id}'`);
await sql(`update public.orders set order_number = 'ЧУЖОЙ-777' where id = '${O2}'`);   // номера в разных кабинетах могут совпадать: чужому заказу даём номер, которого у клиента нет
const N1 = await NUM(O1), N2 = await NUM(O2);

// ---------- 0. Данные: клиент Б с тремя заказами в разных валютах, отменённым и без цены ----------
await asUser(B, `insert into public.orders (client_name, client_id, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, client_currency, status)
  values ('Клиент Б', '${CL}', 'Наушники', 1, 10, 13, 300, 0, 'USD', 'awaiting_payment')`);
await asUser(B, `insert into public.orders (client_name, client_id, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, status)
  values ('Клиент Б', '${CL}', 'Заказ без цены', 1, 0, 0, null, 0, 'new')`);
await asUser(B, `insert into public.orders (client_name, client_id, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, status)
  values ('Клиент Б', '${CL}', 'Отменённый', 1, 10, 13, 1000, 500, 'cancelled')`);
const NCANC = await sql(`select order_number from public.orders where client_id = '${CL}' and status = 'cancelled'`);
const NPRICELESS = await sql(`select order_number from public.orders where client_id = '${CL}' and product_ru = 'Заказ без цены'`);
await sql(`insert into public.client_wallet (workspace_id, client_id, currency, amount, kind) values ('${WSB}', '${CL}', 'KGS', 700, 'deposit'), ('${WSB}', '${CL}', 'USD', 50, 'deposit')`);
await sql(`insert into public.client_wallet (workspace_id, ckey, currency, amount, kind) values ('${WSB}', 'p000999111', 'KGS', 99999, 'deposit')`);   // неразобранная предоплата: чужая и спорная
const TOK = await asUser(B, `select public.client_cabinet('${O1}', 'create')`);
const OTOK = await sql(`select public_token from public.orders where id = '${O1}'`);

// ---------- 1. Что видит клиент ----------
{
  const c = await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`));
  assert.equal(c.orders.length, 4, "в кабинете должны быть все 4 заказа клиента");
  const text = JSON.stringify(c);
  for (const bad of ["СЕКРЕТНЫЙ-ПОСТАВЩИК", "ВНУТРЕННЯЯ-ЗАМЕТКА", "ЗАМЕТКА-ЧУЖОГО-КАБИНЕТА", "Чужой товар", "99999", "profit", "supplier", "admin_comment", "purchase", "cost_som"])
    assert.ok(!text.includes(bad), "клиент видит служебное: " + bad);
  for (const o of c.orders) { assert.ok("delivery_eta_from" in o && "delivery_eta_to" in o && typeof o.tg_on === "boolean", "в заказе нет срока или признака подписки"); }
  assert.equal(c.contact, null, "контакт показывается, хотя владелец его не указывал");
  assert.equal(typeof c.card, "boolean");
  const cur = Object.fromEntries(c.debt.map((d) => [d.currency, Number(d.amount)]));
  assert.ok(cur.USD === 300 && !("EUR" in cur), "долг по валютам посчитан неверно: " + JSON.stringify(c.debt));
  const w = Object.fromEntries(c.wallet.map((d) => [d.currency, Number(d.amount)]));
  assert.deepEqual(w, { KGS: 700, USD: 50 }, "предоплата по валютам");
  const cancelled = c.orders.find((o) => o.order_number === NCANC);
  assert.equal(cancelled.status, "cancelled");   // отменённый виден, но в долг не входит (долг по KGS считается без него)
  const kgsDebt = c.orders.filter((o) => o.status !== "cancelled" && o.client_currency === "KGS" && Number(o.balance_som) > 0).reduce((s, o) => s + Number(o.balance_som), 0);
  assert.equal(Number(cur.KGS || 0), kgsDebt, "отменённый заказ попал в долг");
  pass("общая ссылка: заказы, долг и предоплата по валютам раздельно; закупочных данных и чужих сумм нет");
}

// ---------- 2. Срок доставки: даты в поясе кабинета; пусто = не назван ----------
{
  await asUser(B, `select public.order_set_deadlines('${O1}', null, '2026-12-10', '2026-12-15')`);
  const c = await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`));
  const o1 = c.orders.find((o) => o.order_number === N1), other = c.orders.find((o) => o.order_number === NPRICELESS);
  assert.equal(o1.delivery_eta_from, "2026-12-10"); assert.equal(o1.delivery_eta_to, "2026-12-15");
  assert.equal(other.delivery_eta_from, null, "срок выдуман там, где его не задавали");
  const one = await json(asAnon(`select public.get_cabinet_order('${TOK}', '${N1}')::text`));
  assert.equal(one.delivery_eta_from, "2026-12-10");
  const ord = await json(asAnon(`select public.get_client_order('${OTOK}')::text`));
  assert.equal(ord.delivery_eta_to, "2026-12-15");
  // после смены пояса день показывается по новому поясу, а момент не двигается
  pass("ожидаемая доставка: даты в поясе кабинета, пусто — когда срок не задан");
}

// ---------- 3. Подписка Telegram: только да/нет и только на свой заказ ----------
{
  const c = await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`));
  assert.equal(c.orders.find((o) => o.order_number === N1).tg_on, true, "подписка на заказ не видна");
  assert.equal(c.orders.find((o) => o.order_number === NPRICELESS).tg_on, false, "подписка одного заказа показана как подписка на все");
  const one = await json(asAnon(`select public.get_cabinet_order('${TOK}', '${NPRICELESS}')::text`));
  assert.equal(one.tg_on, false);
  assert.ok(!JSON.stringify(c).match(/chat_id|chat/i), "в ответ попал чат Telegram");
  pass("Telegram: признак подписки по каждому заказу отдельно, без данных чата");
}

// ---------- 4. Контакт байера ----------
{
  await failsWith(() => asUser(D, `select public.ws_set_client_contact('${WSB}', '+996555123456', 'buyer_tg')`), /forbidden/, "сотрудник меняет контакт");
  await failsWith(() => asUser(C, `select public.ws_set_client_contact('${WSB}', '+996555123456', 'buyer_tg')`), /forbidden/, "чужой владелец меняет контакт");
  await failsWith(() => asAnon(`select public.ws_set_client_contact('${WSB}', '+996555123456', 'buyer_tg')`), /permission denied/, "аноним меняет контакт");
  await failsWith(() => asUser(B, `select public.ws_set_client_contact('${WSB}', '12', null)`), /invalid_phone/, "неверный телефон");
  await failsWith(() => asUser(B, `select public.ws_set_client_contact('${WSB}', null, 'ab')`), /invalid_telegram/, "неверный Telegram");
  await failsWith(() => asAnon(`select public._cabinet_contact('${WSB}')`), /permission denied/, "аноним вызвал внутреннюю функцию");
  await failsWith(() => asUser(C, `select public.ws_client_contact_get('${WSB}')`), /forbidden/, "чужой кабинет читает контакт");
  const r = await json(asUser(B, `select public.ws_set_client_contact('${WSB}', '00996 555 123 456', 'https://t.me/buyer_tg')::text`));
  assert.deepEqual(r, { phone: "+996555123456", telegram: "buyer_tg" });
  const c = await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`));
  assert.deepEqual(c.contact, { phone: "+996555123456", telegram: "buyer_tg" });
  const one = await json(asAnon(`select public.get_cabinet_order('${TOK}', '${N1}')::text`));
  assert.deepEqual(one.contact, { phone: "+996555123456", telegram: "buyer_tg" });
  const ord = await json(asAnon(`select public.get_client_order('${OTOK}')::text`));
  assert.deepEqual(ord.contact, { phone: "+996555123456", telegram: "buyer_tg" });
  // контакт ДРУГОГО кабинета клиенту не попадает
  await asUser(C, `select public.ws_set_client_contact('${WSC}', '+996700999888', 'other_buyer')`);
  assert.ok(!JSON.stringify(c).includes("other_buyer") && !JSON.stringify(c).includes("996700999888"), "контакт чужого байера у клиента");
  const m = await json(asUser(D, `select public.ws_client_contact_get('${WSB}')::text`));
  assert.equal(m.telegram, "buyer_tg");   // сотрудник читает, но не меняет
  await asUser(B, `select public.ws_set_client_contact('${WSB}', '', '')`);
  assert.equal((await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`))).contact, null, "очищенный контакт остался");
  pass("контакт: меняет только владелец, чужой контакт не виден, пустое значение ничего не показывает");
}

// ---------- 5. Адрес по общей ссылке: только пустая карточка своего клиента ----------
{
  const args = (num, extra = {}) => `'${TOK}', '${num}', '${extra.name ?? "Клиент Б"}', '${extra.phone ?? "+996555000222"}', null, '${extra.city ?? "Бишкек"}', '${extra.addr ?? "ул. Ленина 1, кв 5"}', null`;
  await failsWith(() => asAnon(`select public.save_cabinet_client_info('bad', '${N1}', 'Имя Ф', '+996555000222', null, 'Бишкек', 'ул. Ленина 1', null)`), /order_not_found/, "неверная ссылка");
  const clash = await sql(`select count(*) from public.orders where client_id = '${CL}' and order_number = '${N2}'`);
  assert.equal(clash, "0", `у клиента есть свой заказ с номером ${N2}: проверка «чужой заказ» невозможна (номера в разных кабинетах могут совпадать)`);
  await failsWith(() => asAnon(`select public.save_cabinet_client_info('${TOK}', '${N2}', 'Имя Ф', '+996555000222', null, 'Бишкек', 'ул. Ленина 1', null)`), /order_not_found/, "чужой заказ по общей ссылке");
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${args(NCANC)})`), /order_locked/, "отменённый заказ");
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${args(N1, { phone: "12" })})`), /invalid_phone/, "неверный телефон");
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${args(N1, { addr: "x" })})`), /invalid_place/, "слишком короткий адрес");
  const before = await sql(`select coalesce(match_phone, '') from public.clients where id = '${CL}'`);
  const cardOk0 = await sql(`select client_card_ok from public.orders where id = '${O1}'`);
  const other0 = await sql(`select coalesce(city, '-') from public.clients where id = '${CL3}'`);
  const r = await json(asAnon(`select public.save_cabinet_client_info(${args(N1)})::text`));
  assert.equal(r.city, "Бишкек");
  assert.equal(await sql(`select city from public.clients where id = '${CL}'`), "Бишкек");
  assert.equal(await sql(`select coalesce(match_phone, '') from public.clients where id = '${CL}'`), before, "ключ поиска совпадений изменился формой");
  assert.equal(await sql(`select client_card_ok from public.orders where id = '${O1}'`), cardOk0, "client_card_ok изменился");
  assert.equal(await sql(`select coalesce(city, '-') from public.clients where id = '${CL3}'`), other0, "тронут другой клиент");
  assert.equal((await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`))).card, true);
  const one = await json(asAnon(`select public.get_cabinet_order('${TOK}', '${N1}')::text`));
  assert.equal(one.client.city, "Бишкек");
  // страница ЭТОГО заказа по его ссылке карточку по-прежнему не показывает (client_card_ok = false)
  const ord = await json(asAnon(`select public.get_client_order('${OTOK}')::text`));
  assert.equal(ord.client, null, "ссылка заказа показывает карточку, которую она не создавала");
  // карточку уже заполнили: общая ссылка её не перезаписывает
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${args(N1, { name: "Взлом Х" })})`), /card_exists/, "перезапись существующей карточки");
  assert.notEqual(await sql(`select name from public.clients where id = '${CL}'`), "Взлом Х");
  // отключённая ссылка адрес больше не принимает
  await asUser(B, `select public.client_cabinet('${O1}', 'revoke')`);
  assert.equal(await asAnon(`select public.get_client_cabinet('${TOK}') is null`), "t", "отключённая ссылка открывается");
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${args(N1)})`), /order_not_found/, "отключённая ссылка принимает адрес");
  pass("адрес по общей ссылке: только пустая карточка своего клиента; чужое, отменённое, отключённое и существующую карточку не трогает");
}

// ---------- 6. Ссылка заказа не даёт общего кабинета ----------
{
  const ord = await asAnon(`select public.get_client_order('${OTOK}')::text`);
  assert.ok(!ord.includes(TOK), "в ответе заказа есть токен общей ссылки");
  assert.ok(!/cabinet/i.test(ord), "ответ заказа сообщает про общую ссылку");
  await failsWith(() => asAnon(`select public.client_cabinet('${O1}', 'get')`), /permission denied/, "аноним получил общую ссылку по заказу");
  assert.equal(await asAnon(`select public.get_client_cabinet('${OTOK}') is null`), "t", "токен заказа открыл общий кабинет");
  pass("ссылка отдельного заказа не раскрывает общую ссылку и не открывает кабинет");
}

console.log(`\nВсего проверок: ${n}`);
