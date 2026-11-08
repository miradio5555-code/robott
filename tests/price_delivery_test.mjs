// =====================================================
// ПРОВЕРКА ФАЙЛОВ 61 и 62 (цена для клиента, адрес заказа, WhatsApp-расчёт). Запускается из tests/price_delivery_test.sh.
// НЕ ЗАПУСКАЛАСЬ: Docker на момент написания не отвечал. До выпуска обязателен полный прогон на настоящем Postgres.
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
const asService = (q) => sql(`set role service_role; ${q}`);
const json = async (p) => JSON.parse(await p);
const failsWith = async (fn, re, msg) => {
  try { await fn(); } catch (e) { assert.match(String(e.stderr || e.message), re, msg + ": " + (e.stderr || e.message)); return; }
  assert.fail(msg + ": ошибки не было");
};
let n = 0; const pass = (m) => { console.log("   ✓ " + m); n++; };
const lit = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : "'" + String(v).replace(/'/g, "''") + "'");

const WSB = await sql(`select workspace_id from public.workspace_members where user_id = '${B}' and role = 'owner'`);
const O1 = await sql("select v from public._t where k = 'o1'");   // цена 3000, оплачено 1000, себестоимость 2888.86
const O2 = await sql("select v from public._t where k = 'o2'");   // заказ ЧУЖОГО кабинета
await sql(`update public.orders set order_number = 'ЧУЖОЙ-777' where id = '${O2}'`);   // номера в разных кабинетах могут совпадать: чужому заказу даём номер, которого у клиента нет
const O3 = await sql("select v from public._t where k = 'o3'");   // другой клиент того же кабинета
const CL = await sql(`select client_id from public.orders where id = '${O1}'`);
const NUM = (id) => sql(`select order_number from public.orders where id = '${id}'`);
const tokenOf = (id) => sql(`update public.orders set public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', '')) where id = '${id}' returning public_token`);
const wallet = () => sql("select coalesce(sum(amount), 0) || '/' || count(*) from public.client_wallet");
const WALLET0 = await wallet();

// ---------- 0. Данные: два заказа БЕЗ цены (разные валюты), один с ценой в USD ----------
const mk = async (product, extra) => sql(`insert into public.orders (workspace_id, client_name, client_id, product_ru, quantity, unit_price_cny, exchange_rate, delivery_cost, delivery_rate, client_price, paid_amount, client_currency, status)
  values ('${WSB}', 'Клиент Б', '${CL}', '${product}', ${extra.q}, ${extra.u}, ${extra.r}, 0, 0, ${lit(extra.price)}, ${extra.paid}, '${extra.cur}', 'new') returning id`);
const P = await mk("Без цены KGS", { q: 2, u: 111.11, r: 13, price: null, paid: 500, cur: "KGS" });      // себестоимость 2888.86
const PU = await mk("Без цены USD", { q: 1, u: 50, r: 13, price: null, paid: 100, cur: "USD" });        // себестоимость 650
const U = await mk("С ценой USD", { q: 1, u: 10, r: 13, price: 300, paid: 0, cur: "USD" });
const NP = await NUM(P), NPU = await NUM(PU), N1 = await NUM(O1), NU = await NUM(U);
const TOK = await asUser(B, `select public.client_cabinet('${O1}', 'create')`);
const PTOK = await tokenOf(P), OTOK = await tokenOf(O1);
const COST_STRINGS = ["2888", "2388", "profit", "cost_som", "unit_price_cny", "exchange_rate", "supplier", "admin_comment"];
const leaks = (text) => COST_STRINGS.filter((s) => text.includes(s)).concat(/(^|[^0-9.])650([^0-9]|$)/.test(text) ? ["650"] : []).concat(/(^|[^0-9.])550([^0-9]|$)/.test(text) ? ["550"] : []);

// ---------- 1. Заказ без цены: себестоимость и «долг» не попадают в публичные ответы ----------
{
  // внутренний расчёт у байера не изменился
  const internal = await sql(`select round(total_som, 2) || '/' || round(balance_som, 2) from public.orders where id = '${P}'`);
  assert.equal(internal, "2888.86/2388.86", "внутренний расчёт изменился: " + internal);
  const cab = await asAnon(`select public.get_client_cabinet('${TOK}')::text`);
  const one = await asAnon(`select public.get_cabinet_order('${TOK}', '${NP}')::text`);
  const ord = await asAnon(`select public.get_client_order('${PTOK}')::text`);
  for (const [name, text] of [["кабинет", cab], ["заказ в кабинете", one], ["ссылка заказа", ord]]) assert.deepEqual(leaks(text), [], name + " раскрывает закупочные данные: " + leaks(text));
  const c = JSON.parse(cab);
  for (const num of [NP, NPU]) {
    const o = c.orders.find((x) => x.order_number === num);
    assert.equal(o.price_set, false); assert.equal(o.total_som, null, "сумма заказа без цены не null"); assert.equal(o.balance_som, null, "остаток без цены не null");
  }
  assert.equal(Number(c.orders.find((x) => x.order_number === NP).paid_amount), 500, "известный платёж потерян");
  assert.equal(Number(c.orders.find((x) => x.order_number === NPU).paid_amount), 100);
  const o1 = c.orders.find((x) => x.order_number === N1);
  assert.equal(o1.price_set, true); assert.equal(Number(o1.total_som), 3000); assert.equal(Number(o1.balance_som), 2000);
  for (const j of [JSON.parse(one), JSON.parse(ord)]) { assert.equal(j.price_set, false); assert.equal(j.total_som, null); assert.equal(j.balance_som, null); assert.equal(Number(j.paid_amount), 500); }
  // долг по валютам: заказы без цены не входят; USD — только заказ с ценой
  const debt = Object.fromEntries(c.debt.map((d) => [d.currency, Number(d.amount)]));
  assert.deepEqual(debt, { KGS: 2000, USD: 300 }, "долг по валютам: " + JSON.stringify(c.debt));
  pass("заказ без цены: сумма и остаток = null, платёж виден, себестоимости и курса нет ни в одном ответе, в долг не входит");
}

// ---------- 2. Назначение, изменение и снятие цены, частичная оплата ----------
{
  const hist = () => sql(`select count(*) from public.order_status_history where order_id = '${P}'`);
  const get = async () => (await json(asAnon(`select public.get_cabinet_order('${TOK}', '${NP}')::text`)));
  await asUser(B, `update public.orders set client_price = 4000 where id = '${P}'`);
  let j = await get();
  assert.equal(j.price_set, true); assert.equal(Number(j.total_som), 4000); assert.equal(Number(j.balance_som), 3500, "остаток после назначения цены");
  await asUser(B, `update public.orders set client_price = 4500 where id = '${P}'`);
  j = await get(); assert.equal(Number(j.total_som), 4500); assert.equal(Number(j.balance_som), 4000);
  await asUser(B, `update public.orders set paid_amount = 4000 where id = '${P}'`);
  j = await get(); assert.equal(Number(j.balance_som), 500, "частичная оплата");
  const before = await hist();
  await asUser(B, `update public.orders set client_price = null where id = '${P}'`);
  j = await get();
  assert.equal(j.price_set, false); assert.equal(j.total_som, null); assert.equal(j.balance_som, null, "после снятия цены остаток выдумывается");
  assert.equal(Number(j.paid_amount), 4000, "платежи потеряны при снятии цены");
  assert.equal(await hist(), before, "снятие цены изменило историю платежей и статусов");
  assert.ok(j.status_history.some((h) => h.event_type === "payment"), "история платежей пропала");
  assert.deepEqual(leaks(JSON.stringify(j)), [], "после снятия цены виден расчёт: " + leaks(JSON.stringify(j)));
  assert.equal(await wallet(), WALLET0, "предоплата изменилась");
  // вернуть как было
  await asUser(B, `update public.orders set client_price = null, paid_amount = 500 where id = '${P}'`);
  pass("цена: назначение → изменение → оплата → снятие; публичный ответ следует за сервером, история и предоплата не тронуты");
}

// ---------- 3. Уведомления: напоминание об оплате не уходит по заказу без цены и не несёт суммы ----------
{
  const DUE = "2099-03-10T03:00:00Z", NOW = "2099-03-10T06:00:00Z";
  await sql("truncate public.order_notify_queue, public.order_tasks, public.ws_reminder_settings, public.ws_reminder_log, public.order_deadline_history cascade");
  await sql(`insert into public.order_tg_subs (order_id, chat_id, lang, last_status) values ('${P}', '5001', 'ru', 'new') on conflict do nothing`);
  await asUser(B, `select public.reminder_settings_set('${WSB}', true, 9, 20, 0, 72, 3, 50)`);
  await sql(`update public.orders set payment_due_at = '${DUE}' where id = '${P}'`);
  await asService(`select public.deadlines_scan('${NOW}')`);
  assert.equal(await sql(`select count(*) from public.order_notify_queue where order_id = '${P}' and kind = 'payment_reminder'`), "0", "напоминание по заказу без цены поставлено в очередь");
  assert.equal(await sql(`select count(*) from public.order_tasks where order_id = '${P}' and kind = 'payment_overdue'`), "0", "просрочка оплаты у заказа без цены");
  // цена есть → напоминание ставится; цену сняли до отправки → при выдаче обработчику пропускается, суммы нет
  await asUser(B, `update public.orders set client_price = 4000 where id = '${P}'`);
  await asService(`select public.deadlines_scan('${NOW}')`);
  assert.equal(await sql(`select count(*) from public.order_notify_queue where order_id = '${P}' and kind = 'payment_reminder'`), "1", "с ценой напоминание не создалось");
  await asUser(B, `update public.orders set client_price = null where id = '${P}'`);
  const claimed = await asService(`select public.notify_claim('w-price', 50, 60, '${NOW}')::text`);
  const items = JSON.parse(claimed || "[]");
  assert.ok(!items.some((x) => x.order_number === NP && x.kind === "payment_reminder"), "обработчику отдано напоминание по заказу без цены");
  assert.deepEqual(leaks(claimed), [], "в выдаче обработчику есть закупочные данные: " + leaks(claimed));
  assert.ok(items.every((x) => !("cost_som" in x) && !("profit_som" in x) && !("client_price" in x)), "в выдаче лишние поля");
  await sql("truncate public.order_notify_queue, public.order_tasks, public.ws_reminder_settings cascade");
  await sql(`update public.orders set payment_due_at = null where id = '${P}'`);
  pass("уведомления: без цены напоминание не создаётся и не выдаётся; в выдаче нет себестоимости");
}

// ---------- 4. Заявка с чужим телефоном и адрес по ссылке заказа ----------
const VICTIM_PHONE = "+996555777000";
await sql(`update public.clients set phone = '${VICTIM_PHONE}', match_phone = public.phone_norm('${VICTIM_PHONE}'), name = 'Жертва Карточкина', city = 'Ош', address = 'ул. Жертвы 1' where id = '${CL}'`);
const card0 = await sql(`select name || '|' || phone || '|' || coalesce(city, '') || '|' || coalesce(address, '') || '|' || coalesce(match_phone, '') from public.clients where id = '${CL}'`);
const ordersOfCl0 = await sql(`select string_agg(id::text, ',' order by id) from public.orders where client_id = '${CL}'`);
const REQ = await asUser(B, `select public.request_link_rotate('${WSB}')`);
let STR, STOK, STRCLIENT;
{
  const r = await json(asAnon(`select public.submit_request('${REQ}', 'Посторонний', '${VICTIM_PHONE}', null, 'Чужая заявка', null, 1, null)::text`));
  STOK = r.token;
  STR = await sql(`select id from public.orders where public_token = '${STOK}'`);
  STRCLIENT = await sql(`select client_id from public.orders where id = '${STR}'`);
  assert.notEqual(STRCLIENT, CL, "заявка с чужим номером присоединилась к чужому клиенту");
  const before = await asAnon(`select public.get_client_order('${STOK}')::text`);
  assert.ok(!before.includes("Жертва Карточкина") && !before.includes("ул. Жертвы"), "ссылка заявки показывает чужую карточку");
  const r2 = await json(asAnon(`select public.save_client_info('${STOK}', 'Посторонний Адрес', '+996700111222', null, 'Талас', 'ул. Нового 5', null)::text`));
  assert.equal(r2.state, "proposed");
  assert.equal(await sql(`select client_id from public.orders where id = '${STR}'`), STRCLIENT, "заполнение адреса перепривязало заказ");
  assert.equal(await sql(`select client_card_ok from public.orders where id = '${STR}'`), "f", "client_card_ok изменился формой");
  assert.equal(await sql(`select name || '|' || phone || '|' || coalesce(city, '') || '|' || coalesce(address, '') || '|' || coalesce(match_phone, '') from public.clients where id = '${CL}'`), card0, "чужая карточка изменена");
  assert.equal(await sql(`select string_agg(id::text, ',' order by id) from public.orders where client_id = '${CL}'`), ordersOfCl0, "заказы чужого клиента изменились");
  assert.equal(await wallet(), WALLET0, "предоплата изменилась");
  assert.equal(await sql(`select count(*) from public.order_delivery where order_id <> '${STR}'`), "0", "адрес записан в чужой заказ");
  const after = await json(asAnon(`select public.get_client_order('${STOK}')::text`));
  assert.equal(after.delivery.city, "Талас"); assert.equal(after.delivery.state, "proposed");
  assert.ok(!JSON.stringify(after).includes("Жертва Карточкина"), "после формы видна чужая карточка");
  // чужие ссылки не видят этот адрес
  const o1 = await asAnon(`select public.get_client_order('${OTOK}')::text`);
  assert.ok(!o1.includes("ул. Нового 5") && !o1.includes("Посторонний Адрес"), "адрес из одной ссылки виден по другой");
  const cab = await asAnon(`select public.get_client_cabinet('${TOK}')::text`);
  assert.ok(!cab.includes("ул. Нового 5") && !cab.includes(STOK), "адрес/токен заявки виден в кабинете жертвы");
  await failsWith(() => asAnon(`select public.save_client_info('00000000000000000000000000000000', 'Имя Ф', '+996555000222', null, 'Бишкек', 'ул. Ленина 1', null)`), /order_not_found/, "неверный токен");
  await failsWith(() => asAnon(`select public.save_client_info('${STOK}', 'Имя Ф', '12', null, 'Бишкек', 'ул. Ленина 1', null)`), /invalid_phone/, "неверный телефон");
  await failsWith(() => asAnon(`select public.save_client_info('${STOK}', 'Имя Ф', '+996555000222', null, 'Бишкек', null, null)`), /invalid_place/, "нет адреса и пункта");
  // доступ к таблице напрямую закрыт
  await failsWith(() => asAnon("select * from public.order_delivery"), /permission denied/, "аноним читает таблицу адресов");
  await failsWith(() => asUser(B, "select * from public.order_delivery"), /permission denied/, "пользователь читает таблицу адресов напрямую");
  await failsWith(() => asAnon(`select public._order_delivery_put('${STR}', 'Имя Ф', '+996555000222', null, 'Бишкек', 'ул. Ленина 1', null, 'cabinet')`), /permission denied/, "аноним вызвал внутреннюю запись");
  pass("заявка с чужим телефоном: к жертве не присоединяется; адрес по её ссылке — предложение в её заказ; карточка, клиенты, заказы и предоплата не тронуты");
}

// ---------- 5. Адрес по общей ссылке: только свой заказ; принятый адрес не перезаписывается ----------
{
  const a = (num, extra = {}) => `'${TOK}', '${num}', '${extra.name ?? "Клиент Б"}', '${extra.phone ?? "+996555000222"}', null, '${extra.city ?? "Бишкек"}', '${extra.addr ?? "ул. Ленина 1, кв 5"}', null`;
  await failsWith(() => asAnon(`select public.save_cabinet_client_info('bad', '${N1}', 'Имя Ф', '+996555000222', null, 'Бишкек', 'ул. Ленина 1', null)`), /order_not_found/, "неверная ссылка");
  const n2 = await NUM(O2);
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${a(n2)})`), /order_not_found/, "чужой заказ по общей ссылке");
  const strNum = await NUM(STR);
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${a(strNum)})`), /order_not_found/, "заказ заявки (другой клиент) по общей ссылке жертвы");
  await asUser(B, `update public.orders set status = 'cancelled' where id = '${U}'`);
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${a(NU)})`), /order_locked/, "отменённый заказ");
  await asUser(B, `update public.orders set status = 'new' where id = '${U}'`);
  const r = await json(asAnon(`select public.save_cabinet_client_info(${a(N1)})::text`));
  assert.equal(r.state, "proposed");
  assert.equal(await sql(`select name || '|' || phone || '|' || coalesce(city, '') || '|' || coalesce(address, '') || '|' || coalesce(match_phone, '') from public.clients where id = '${CL}'`), card0, "общая ссылка изменила карточку клиента");
  const one = await json(asAnon(`select public.get_cabinet_order('${TOK}', '${N1}')::text`));
  assert.equal(one.delivery.city, "Бишкек"); assert.equal(one.delivery.state, "proposed");
  assert.equal((await json(asAnon(`select public.get_client_cabinet('${TOK}')::text`))).orders.find((o) => o.order_number === N1).delivery_state, "proposed");
  // ссылка заказа видит адрес своего заказа, но не общую ссылку
  const ord = await asAnon(`select public.get_client_order('${OTOK}')::text`);
  assert.equal(JSON.parse(ord).delivery.city, "Бишкек"); assert.ok(!ord.includes(TOK), "в ответе заказа есть общая ссылка");
  // уточнение клиентом, пока байер не принял
  await asAnon(`select public.save_cabinet_client_info(${a(N1, { addr: "ул. Ленина 2, кв 6" })})`);
  assert.equal((await json(asAnon(`select public.get_cabinet_order('${TOK}', '${N1}')::text`))).delivery.address, "ул. Ленина 2, кв 6");
  // байер: чужой кабинет и помощник-читатель
  await failsWith(() => asUser(C, `select public.order_delivery_get('${O1}')`), /forbidden/, "чужой байер читает адрес");
  await failsWith(() => asUser(C, `select public.order_delivery_review('${O1}', 'confirm')`), /forbidden/, "чужой байер принимает адрес");
  await failsWith(() => asAnon(`select public.order_delivery_review('${O1}', 'confirm')`), /permission denied/, "аноним принимает адрес");
  await failsWith(() => asUser(B, `select public.order_delivery_review('${O1}', 'erase')`), /invalid_action/, "неизвестное действие");
  assert.equal((await json(asUser(D, `select public.order_delivery_get('${O1}')::text`))).state, "proposed", "сотрудник кабинета не видит предложение");
  const ok = await json(asUser(B, `select public.order_delivery_review('${O1}', 'confirm')::text`));
  assert.equal(ok.state, "confirmed");
  await failsWith(() => asAnon(`select public.save_cabinet_client_info(${a(N1, { addr: "ул. Взлома 9" })})`), /delivery_confirmed/, "принятый адрес перезаписан по общей ссылке");
  await failsWith(() => asAnon(`select public.save_client_info('${OTOK}', 'Взлом Х', '+996555000222', null, 'Бишкек', 'ул. Взлома 9', null)`), /delivery_confirmed/, "принятый адрес перезаписан по ссылке заказа");
  assert.equal((await json(asAnon(`select public.get_client_order('${OTOK}')::text`))).delivery.address, "ул. Ленина 2, кв 6");
  // отклонение убирает предложение, клиент может подать новое
  const rej = await json(asUser(B, `select public.order_delivery_review('${STR}', 'reject')::text`));
  assert.equal(rej.state, null);
  assert.equal((await json(asAnon(`select public.get_client_order('${STOK}')::text`))).delivery, null);
  await failsWith(() => asUser(B, `select public.order_delivery_review('${STR}', 'confirm')`), /no_delivery/, "принят несуществующий адрес");
  pass("адрес по общей ссылке: только заказ своего клиента; байер принимает/отклоняет; принятый адрес клиент не перезаписывает; чужой байер и аноним ничего не делают");
}

// ---------- 6. Отзыв ссылки и изоляция кабинетов ----------
{
  const cabC = await asUser(C, `select public.client_cabinet('${O2}', 'create')`);
  const text = await asAnon(`select public.get_client_cabinet('${TOK}')::text`);
  assert.ok(!text.includes(await NUM(O2)) && !text.includes("Чужой товар") && !text.includes("ЗАМЕТКА-ЧУЖОГО-КАБИНЕТА"), "в кабинете клиента Б есть данные кабинета В");
  const textC = await asAnon(`select public.get_client_cabinet('${cabC}')::text`);
  assert.ok(!textC.includes(await NUM(O1)), "заказ Б виден в кабинете В");
  assert.equal(await asAnon(`select public.get_cabinet_order('${cabC}', '${N1}') is null`), "t", "чужой номер заказа открывается чужой ссылкой");
  await asUser(B, `select public.client_cabinet('${O1}', 'revoke')`);
  assert.equal(await asAnon(`select public.get_client_cabinet('${TOK}') is null`), "t", "отозванная ссылка открывается");
  assert.equal(await asAnon(`select public.get_cabinet_order('${TOK}', '${N1}') is null`), "t");
  await failsWith(() => asAnon(`select public.save_cabinet_client_info('${TOK}', '${N1}', 'Имя Ф', '+996555000222', null, 'Бишкек', 'ул. Ленина 1', null)`), /order_not_found/, "отозванная ссылка принимает адрес");
  assert.ok(await asAnon(`select public.get_client_order('${OTOK}') is not null`), "ссылка заказа не должна гаснуть вместе с общей");
  assert.equal(await asAnon(`select public.get_client_cabinet('${OTOK}') is null`), "t", "токен заказа открыл общий кабинет");
  pass("отзыв ссылки: кабинет, заказ и форма адреса перестают работать; ссылка заказа жива; кабинеты изолированы");
}

// ---------- 7. Объединение клиентов в обе стороны: заказ, адрес и деньги остаются на месте ----------
{
  const mkClientOrder = async (phone, name, product) => {
    const id = await sql(`insert into public.orders (workspace_id, client_name, client_phone, product_ru, quantity, unit_price_cny, exchange_rate, client_price, paid_amount, status)
      values ('${WSB}', '${name}', '${phone}', '${product}', 1, 10, 13, 1000, 0, 'new') returning id`);
    return { id, cl: await sql(`select client_id from public.orders where id = '${id}'`), tok: await tokenOf(id) };
  };
  const propose = (tok, city) => asAnon(`select public.save_client_info('${tok}', 'Клиент Merge', '+996555900100', null, '${city}', 'ул. Адресная 10', null)`);
  for (const dir of ["keep-first", "keep-second"]) {
    const x = await mkClientOrder("+996555910" + (dir === "keep-first" ? "001" : "003"), "Мерж Один", "Мерж товар 1");
    const y = await mkClientOrder("+996555910" + (dir === "keep-first" ? "002" : "004"), "Мерж Два", "Мерж товар 2");
    assert.notEqual(x.cl, y.cl);
    await propose(x.tok, "Бишкек-" + dir); await propose(y.tok, "Ош-" + dir);
    await sql(`insert into public.client_wallet (workspace_id, client_id, currency, amount, kind) values ('${WSB}', '${x.cl}', 'KGS', 100, 'deposit'), ('${WSB}', '${y.cl}', 'USD', 7, 'deposit')`);
    const sumBefore = await sql(`select coalesce(sum(amount), 0) from public.client_wallet where client_id in ('${x.cl}', '${y.cl}')`);
    const keep = dir === "keep-first" ? x : y, drop = dir === "keep-first" ? y : x;
    await asUser(B, `select public.client_merge('${keep.cl}', '${drop.cl}')`);
    for (const o of [x, y]) {
      assert.equal(await sql(`select client_id from public.orders where id = '${o.id}'`), keep.cl, "после объединения заказ не у оставшегося клиента");
      assert.equal(await sql(`select state from public.order_delivery where order_id = '${o.id}'`), "proposed", "объединение потеряло адрес заказа");
      const j = await json(asAnon(`select public.get_client_order('${o.tok}')::text`));
      assert.equal(j.delivery.address, "ул. Адресная 10"); assert.equal(j.client, null, "после объединения ссылка заказа получила карточку");
    }
    assert.equal(await sql(`select city from public.order_delivery where order_id = '${x.id}'`), "Бишкек-" + dir);
    assert.equal(await sql(`select city from public.order_delivery where order_id = '${y.id}'`), "Ош-" + dir);
    assert.equal(await sql(`select coalesce(sum(amount), 0) from public.client_wallet where client_id = '${keep.cl}'`), sumBefore, "деньги при объединении изменились");
    const cabTok = await asUser(B, `select public.client_cabinet('${keep.id}', 'create')`);
    const cab = await json(asAnon(`select public.get_client_cabinet('${cabTok}')::text`));
    assert.equal(cab.orders.length, 2, "в общем кабинете после объединения не два заказа");
    assert.deepEqual(cab.orders.map((o) => o.delivery_state), ["proposed", "proposed"]);
    await sql(`delete from public.client_wallet where client_id = '${keep.cl}' and workspace_id = '${WSB}'`);
  }
  pass("ручное объединение в обе стороны: заказы в общем кабинете оставшегося клиента, адреса заказов и деньги целы, карточка по ссылке заказа не выдаётся");
}

// ---------- 8. Старые сайты: ответ сервера по-прежнему не содержит служебных полей ----------
{
  const ord = JSON.parse(await asAnon(`select public.get_client_order('${OTOK}')::text`));
  for (const f of ["cost_som", "profit_som", "unit_price_cny", "exchange_rate", "delivery_cost", "delivery_rate", "goods_som", "goods_cny", "supplier", "supplier_link", "admin_comment", "client_price", "public_token", "workspace_id", "id", "client_id"])
    assert.ok(!(f in ord), "ответ заказа содержит " + f);
  const idx = await sql("select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('_order_delivery_put') and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))");
  assert.equal(idx, "0", "внутренняя запись адреса доступна снаружи");
  assert.equal(await sql("select count(*) from pg_tables where schemaname = 'public' and tablename = 'order_delivery' and rowsecurity"), "1", "у order_delivery нет RLS");
  pass("служебных полей в ответе нет; внутренняя запись адреса закрыта; у таблицы адресов включён RLS");
}

// ---------- 9. WhatsApp-расчёт (файл 62): без цены для клиента расчёт не создаётся ----------
{
  const PH = "996700" + String(Date.now()).slice(-6);
  await sql(`insert into public.wa_settings (workspace_id, enabled) values ('${WSB}', true) on conflict (workspace_id) do update set enabled = true`);
  const TH = await sql(`insert into public.wa_threads (workspace_id, phone) values ('${WSB}', '${PH}') returning id`);
  for (const id of [P, PU, U]) await sql(`insert into public.wa_thread_orders (thread_id, order_id) values ('${TH}', '${id}') on conflict do nothing`);
  await failsWith(() => asUser(B, `select public.wa_publish_quote('${TH}', '${P}')`), /price_not_set/, "расчёт по заказу без цены (KGS) создан");
  await failsWith(() => asUser(B, `select public.wa_publish_quote('${TH}', '${PU}')`), /price_not_set/, "расчёт по заказу без цены (USD) создан");
  assert.equal(await sql(`select count(*) from public.wa_quotes where thread_id = '${TH}'`), "0", "в базе остался расчёт без цены");
  const okQ = await asUser(B, `select public.wa_publish_quote('${TH}', '${U}')`);
  const msg = await sql(`select replace(body, E'\\n', ' | ') from public.wa_messages where thread_id = '${TH}' and kind = 'quote' order by created_at desc limit 1`);
  assert.ok(/300/.test(msg), "в сообщении нет цены для клиента: " + msg);
  assert.deepEqual(leaks(msg), [], "расчёт раскрывает закупочные данные: " + msg);
  // цену сняли — принять расчёт уже нельзя
  await sql(`update public.orders set client_price = null where id = '${U}'`);
  const code = await sql(`select code from public.wa_quotes where id = '${okQ}'`);
  assert.equal(await asService(`select public.wa_decide_quote('${WSB}', '${PH}', '${code}', true)`), "expired", "расчёт принят после снятия цены");
  await sql(`update public.orders set client_price = 300 where id = '${U}'`);
  pass("WhatsApp: расчёт без цены не создаётся и не раскрывает себестоимость; после снятия цены принять расчёт нельзя");
}

console.log(`\nВсего проверок: ${n}`);
