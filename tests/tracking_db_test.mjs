// =====================================================
// ПРОВЕРКА ФАЙЛА 64 (путь заказа). Запускается из tests/tracking_db_test.sh.
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
const failsWith = async (fn, re, msg) => {
  try { await fn(); } catch (e) { assert.match(String(e.stderr || e.message), re, msg + ": " + (e.stderr || e.message)); return; }
  assert.fail(msg + ": ошибки не было");
};
let n = 0; const pass = (m) => { console.log("   ✓ " + m); n++; };

const O1 = await sql("select v from public._t where k = 'o1'");   // кабинет Б, подписки Telegram: 2 чата
const O2 = await sql("select v from public._t where k = 'o2'");   // чужой кабинет В
const TOK = await sql(`select public_token from public.orders where id = '${O1}'`);
const queue = (id) => sql(`select count(*) from public.order_notify_queue where order_id = '${id}'`);
const events = (id) => sql(`select count(*) from public.order_status_history where order_id = '${id}' and event_type = 'stage'`);
const pub = async () => JSON.parse(await asAnon(`select public.get_client_order('${TOK}')`));

// 1. Старые заказы не меняются: этапа нет, публичный ответ отдаёт пустые поля
assert.equal(await sql("select count(*) from public.orders where track_stage is not null or shipped_at is not null or ship_to is not null"), "0");
let p = await pub();
for (const k of ["track_stage", "shipped_at", "transit_days_min", "transit_days_max", "ship_to"]) assert.ok(k in p && p[k] === null, "поле " + k);
pass("старые заказы: новые поля пустые, этап выводится сайтом из статуса");

// 2. Смена этапа и публичного комментария: событие в истории, уведомлений НЕТ
const q0 = await queue(O1);
await asUser(B, `update public.orders set track_stage = 'accepted', client_comment = 'Приняли заявку' where id = '${O1}'`);
assert.equal(await events(O1), "1");
await asUser(B, `update public.orders set track_stage = 'accepted' where id = '${O1}'`);   // то же самое — без нового события
assert.equal(await events(O1), "1");
await asUser(B, `update public.orders set client_comment = '' where id = '${O1}'`);          // пустой комментарий без смены этапа — без события
assert.equal(await events(O1), "1");
await asUser(B, `update public.orders set client_comment = 'Вес 2 кг' where id = '${O1}'`);  // только комментарий — событие с ним
assert.equal(await events(O1), "2");
assert.equal(await queue(O1), q0, "смена этапа и комментария ничего не ставит в очередь уведомлений");
// а смена статуса — как и раньше (проверка, что тест вообще видит очередь)
await asUser(B, `update public.orders set status = 'in_transit', track_stage = 'shipped', shipped_at = current_date - 3, transit_days_min = 10, transit_days_max = 20, ship_to = 'Бишкек' where id = '${O1}'`);
assert.ok(Number(await queue(O1)) > Number(q0), "смена статуса ставит обычное уведомление (файл 57)");
assert.equal(await events(O1), "3");
const last = await sql(`select stage || '|' || new_status || '|' || coalesce(note, '-') from public.order_status_history where order_id = '${O1}' and event_type = 'stage' order by id desc limit 1`);
assert.equal(last, "shipped|in_transit|-", "комментарий не менялся — в событии его нет");
pass("история: событие «этап» с комментарием; этап сам уведомлений не отправляет, статус — как раньше");

// 3. Ограничения в базе
const bad = (set, re, msg) => failsWith(() => asUser(B, `update public.orders set ${set} where id = '${O1}'`), re, msg);
await bad("track_stage = 'teleport'", /orders_track_stage_chk/, "неизвестный этап");
await bad("transit_days_min = 0", /orders_transit_days_chk/, "0 дней");
await bad("transit_days_max = 181", /orders_transit_days_chk/, "больше 180");
await bad("transit_days_min = 15, transit_days_max = 10", /orders_transit_days_chk/, "от > до");
await bad("ship_to = repeat('x', 121)", /orders_ship_to_chk/, "длинный город");
await bad("ship_to = ''", /orders_ship_to_chk/, "пустая строка вместо null");
await bad("shipped_at = '1999-01-01'", /orders_shipped_at_chk/, "дата из прошлого века");
await asUser(B, `update public.orders set client_comment = repeat('я', 600) where id = '${O1}'`);
assert.equal(await sql(`select char_length(note) from public.order_status_history where order_id = '${O1}' and event_type = 'stage' order by id desc limit 1`), "500", "длинный комментарий в истории обрезается до 500");
await sql(`delete from public.order_status_history where order_id = '${O1}' and event_type = 'stage' and char_length(note) = 500`);
pass("ограничения: этапы, дни 1–180, от ≤ до, город, дата; комментарий в истории ≤ 500");

// 4. Публичный ответ: только публичное
p = await pub();
assert.equal(p.track_stage, "shipped"); assert.equal(p.transit_days_min, 10); assert.equal(p.transit_days_max, 20); assert.equal(p.ship_to, "Бишкек");
assert.match(p.shipped_at, /^\d{4}-\d{2}-\d{2}$/);
const st = p.status_history.filter((h) => h.event_type === "stage");
assert.equal(st.length, 3); assert.ok(st.some((h) => h.note === "Вес 2 кг" && h.stage === "accepted"));
const txt = JSON.stringify(p);
for (const s of ["СЕКРЕТНЫЙ-ПОСТАВЩИК", "ВНУТРЕННЯЯ-ЗАМЕТКА", "changed_by", "profit", "cost_som", "unit_price", "exchange_rate", B])
  assert.ok(!txt.includes(s), "в публичном ответе нет: " + s);
assert.ok(!p.status_history.some((h) => h.event_type === "address"), "служебные события не отдаются");
const cab = JSON.parse(await sql(`select public.client_order_json('${O1}')`));
assert.equal(cab.track_stage, "shipped"); assert.ok(cab.status_history.some((h) => h.event_type === "stage"));
assert.ok(!JSON.stringify(cab).includes("ВНУТРЕННЯЯ-ЗАМЕТКА"));
pass("get_client_order и client_order_json: этап, срок, город и история без закрытых данных");

// 5. Права: историю пишет только триггер; чужой кабинет не меняет этап; помощник кабинета — меняет
await failsWith(() => asUser(B, `insert into public.order_status_history (order_id, workspace_id, event_type, stage, note) select id, workspace_id, 'stage', 'received', 'подделка' from public.orders where id = '${O1}'`), /permission denied/, "байер не пишет историю напрямую");
await failsWith(() => asAnon(`insert into public.order_status_history (order_id, workspace_id, event_type) values ('${O1}', gen_random_uuid(), 'stage')`), /permission denied/, "аноним не пишет историю");
await asUser(C, `update public.orders set track_stage = 'received', client_comment = 'взлом' where id = '${O1}'`);
assert.equal(await sql(`select track_stage from public.orders where id = '${O1}'`), "shipped", "чужой кабинет не меняет этап");
await asUser(D, `update public.orders set track_stage = 'shipped', client_comment = 'Помощник: груз в пути' where id = '${O1}'`);
assert.equal(await sql(`select client_comment from public.orders where id = '${O1}'`), "Помощник: груз в пути");
await asUser(B, `update public.orders set track_stage = 'bought' where id = '${O2}'`);
assert.equal(await sql(`select coalesce(track_stage, '-') from public.orders where id = '${O2}'`), "-", "байер Б не меняет заказ кабинета В");
assert.equal(await asUser(B, `select count(*) from public.order_status_history where order_id = '${O2}'`), "0", "байер Б не читает историю чужого заказа");
pass("права: история только через триггер, изоляция кабинетов, помощник работает");

// 7. Файл 65: обычный срок кабинета — меняет только владелец; публичный ответ подставляет его, если у заказа своего срока нет
const WSB = await sql(`select workspace_id from public.orders where id = '${O1}'`);
await asUser(B, `update public.orders set transit_days_min = null, transit_days_max = null where id = '${O1}'`);
p = await pub();
assert.equal(p.transit_days_min, null); assert.equal(p.transit_days_max, null);
await asUser(B, `update public.workspaces set default_transit_min = 12, default_transit_max = 18 where id = '${WSB}'`);
p = await pub();
assert.equal(p.transit_days_min, 12); assert.equal(p.transit_days_max, 18, "срок кабинета подставляется");
await asUser(B, `update public.orders set transit_days_min = 15, transit_days_max = 25 where id = '${O1}'`);
p = await pub();
assert.equal(p.transit_days_min, 15); assert.equal(p.transit_days_max, 25, "свой срок заказа главнее");
const cj = JSON.parse(await sql(`select public.client_order_json('${O1}')`));
assert.equal(cj.transit_days_max, 25);
await asUser(D, `update public.workspaces set default_transit_min = 1, default_transit_max = 2 where id = '${WSB}'`);
assert.equal(await sql(`select default_transit_max from public.workspaces where id = '${WSB}'`), "18", "помощник не меняет срок кабинета");
await asUser(C, `update public.workspaces set default_transit_min = 1, default_transit_max = 2 where id = '${WSB}'`);
assert.equal(await sql(`select default_transit_max from public.workspaces where id = '${WSB}'`), "18", "чужой кабинет не меняет срок");
await failsWith(() => asUser(B, `update public.workspaces set default_transit_min = 20, default_transit_max = 10 where id = '${WSB}'`), /workspaces_default_transit_chk/, "от > до");
await failsWith(() => asUser(B, `update public.workspaces set default_transit_max = 0 where id = '${WSB}'`), /workspaces_default_transit_chk/, "0 дней");
pass("файл 65: срок кабинета подставляется клиенту, свой срок заказа главнее, менять может только владелец");

// 6. Защита от старых файлов
const { stdout: out63 } = await sh("bash", ["-c", `docker exec -i ${NAME} psql -U postgres -q -X < migration_63_restore_45_46.sql 2>&1 || true`]);
assert.match(out63, /СТОП: файл 63 старше/, "файл 63 не запускается поверх 64/65");
assert.equal(await sql("select count(*) from public.schema_migrations where version in (64, 65)"), "2");
pass("файл 63 поверх 64 останавливается, отметка 64 на месте");

console.log(`🎉 Файлы 64 и 65: ${n} групп проверок пройдено`);
