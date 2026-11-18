// =====================================================
// СТЕНД: модель функций файлов 67–68 (команда и задачи) для проверки экранов в браузере.
// Сценарии: team (вошёл владелец), teamstaff (вошёл закупщик). В остальных сценариях функций «нет в базе» —
// так проверяется, что сайт без файлов 67–68 работает по-старому.
// Это МОДЕЛЬ (основные правила), а не база: настоящие правила проверяет tests/team_test.sh.
// =====================================================
const err = (message, code = "P0001") => ({ data: null, error: { message, code } });
const ok = (data) => ({ data, error: null });
const NOW = () => new Date().toISOString();
const days = (n) => new Date(Date.now() + n * 864e5).toISOString();
const CATALOG = ["team.manage", "tasks.create", "tasks.view_all", "tasks.manage", "tasks.review", "orders.all", "orders.assign", "ops.manage", "reports.view"];
const DUTIES = ["lead", "sourcing", "qc", "logistics", "support"];
const OPEN = ["todo", "in_progress", "blocked", "submitted"];

export function teamEnabled(scn) { return scn === "team" || scn === "teamstaff"; }

function build(db) {
  const me = db.me;
  const T = {
    roles: [
      { key: "manager", name: "Менеджер операций", permissions: CATALOG.slice(), is_system: true },
      { key: "sourcing", name: "Закупки", permissions: ["tasks.create"], is_system: true },
      { key: "qc", name: "Контроль качества", permissions: ["tasks.create"], is_system: true },
      { key: "logistics", name: "Логистика", permissions: ["tasks.create"], is_system: true },
      { key: "assistant", name: "Помощник", permissions: ["orders.all", "tasks.create"], is_system: true },
    ],
    departments: [
      { id: "d-src", name: "Закупки", parent_id: null, head_user_id: "u-staff" },
      { id: "d-qc", name: "Контроль качества", parent_id: null, head_user_id: "u-q" },
      { id: "d-log", name: "Логистика", parent_id: null, head_user_id: null },
      { id: "d-cn", name: "Склад в Иу", parent_id: "d-log", head_user_id: "u-l" },
    ],
    members: [
      { user_id: "u-owner", role: "owner", role_key: null, full_name: "Байер Тест", title: "Директор", department_id: null, manager_id: null, phone: "+996555000111", email: "owner@example.test" },
      { user_id: "u-m", role: "staff", role_key: "manager", full_name: "Айгуль Сапарова", title: "Операционный менеджер", department_id: null, manager_id: "u-owner", phone: "+996555000222", email: "m@example.test" },
      { user_id: "u-staff", role: "staff", role_key: "sourcing", full_name: "Помощник", title: "Закупщик", department_id: "d-src", manager_id: "u-m", phone: "+996555000111", email: "test@example.test" },
      { user_id: "u-q", role: "staff", role_key: "qc", full_name: "Чэнь Ли", title: "Контролёр", department_id: "d-qc", manager_id: "u-m", phone: "+8613800000001", email: "q@example.test" },
      { user_id: "u-l", role: "staff", role_key: "logistics", full_name: "Бакыт Алиев", title: "Логист", department_id: "d-cn", manager_id: "u-m", phone: "+996555000333", email: "l@example.test" },
      { user_id: "u-old", role: "staff", role_key: "assistant", full_name: "Эрмек Касымов", title: null, department_id: null, manager_id: null, phone: null, email: "old@example.test",
        deactivated_at: days(-20), deactivation_note: "Перешёл в другую компанию" },
    ],
    invites: [{ code: "a".repeat(32), expires_at: days(2), role_key: "qc", department_id: "d-qc", title: "Контролёр", invitee_name: "Ван Мэй" }],
    audit: [],
    tasks: [], items: [], comments: [], events: [], notifs: [], seq: 1,
    otm: [], ms: [], delays: [], oev: [], incidents: [], ievents: [], sops: [], acks: [], events: [],
    templates: [{ id: "wf-1", name: "Закупка в Китае", is_system: true, steps: [
      { title: "Подтвердить заказ с поставщиком", duty: "sourcing", days: 2 }, { title: "Оплатить поставщику", duty: "sourcing", days: 3 },
      { title: "Товар готов на фабрике", duty: "sourcing", days: 10 }, { title: "Контроль качества", duty: "qc", days: 12 },
      { title: "Упаковка и маркировка", duty: "qc", days: 13 }, { title: "Отправка карго", duty: "logistics", days: 14 },
      { title: "Прибытие в пункт назначения", duty: "logistics", days: 30 }] }],
  };
  // два заказа кабинета с командой и этапами; на втором — открытая задержка поставщика
  const [o1, o2] = db.orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  [[o1, "u-m", "lead"], [o1, "u-staff", "sourcing"], [o1, "u-q", "qc"], [o1, "u-l", "logistics"], [o2, "u-m", "lead"], [o2, "u-staff", "sourcing"]]
    .forEach(([o, u, d]) => T.otm.push({ order_id: o.id, user_id: u, duty: d }));
  [o1, o2].forEach((o, k) => T.templates[0].steps.forEach((s, i) => T.ms.push({ id: o.id + "-m" + i, order_id: o.id, position: i + 1, title: s.title, duty: s.duty,
    due_at: days(s.days - 4 - k * 6), status: i < 2 ? "done" : i === 2 ? (k ? "delayed" : "in_progress") : "pending", note: null })));
  T.incidents.push({ id: "in-1", number: 1, title: "Партия кроссовок: разные оттенки подошвы", description: "12 пар из 300 светлее образца", severity: "high", category: "quality",
    status: "investigating", order_id: o1.id, owner_id: "u-q", reported_by: "u-staff", created_at: days(-1), root_cause: null, resolution: null });
  T.incidents.push({ id: "in-2", number: 2, title: "Карго потеряло 1 коробку", description: null, severity: "critical", category: "logistics",
    status: "open", order_id: o2.id, owner_id: null, reported_by: "u-l", created_at: days(-0.2), root_cause: null, resolution: null });
  T.sops.push({ id: "sop-1", title: "Приёмка товара на складе в Иу", category: "Склад", duty: "qc", status: "published", version: 2, updated_at: days(-3), updated_by_name: "Айгуль Сапарова",
    body: "1. Пересчитать коробки и сверить с накладной.\n2. Сфотографировать маркировку каждой коробки.\n3. Взвесить партию и записать вес в заказ.\n4. Брак — сразу сообщить об инциденте." });
  T.sops.push({ id: "sop-2", title: "Как сообщать о задержке поставщика", category: "Закупки", duty: "sourcing", status: "published", version: 1, updated_at: days(-10), updated_by_name: "Байер Тест",
    body: "1. Узнать новую дату у фабрики письменно.\n2. В заказе: «Сообщить о задержке», выбрать этап, указать новый срок.\n3. Предложить ведущему корректирующее действие." });
  T.sops.push({ id: "sop-3", title: "Проверка фабрики перед первым заказом", category: "Закупки", duty: "sourcing", status: "draft", version: 1, updated_at: days(-1), body: "Черновик." });
  T.acks.push({ sop_id: "sop-1", user_id: "u-q", version: 2 }, { sop_id: "sop-1", user_id: "u-staff", version: 1 }, { sop_id: "sop-2", user_id: "u-staff", version: 1 });
  T.events.push({ id: "ev-1", title: "Планёрка по закупкам", at: days(1), end: null, note: "Онлайн", created_by: "u-m" });
  T.delays.push({ id: "dl-1", order_id: o2.id, milestone_id: o2.id + "-m2", category: "supplier", reason: "Фабрика не успевает: нет подошвы нужного цвета", old_due: days(-2), new_due: days(5),
    status: "open", reported_by: "Помощник", reporter_id: "u-staff", created_at: days(-1), resolution: null });
  T.members.forEach((m, i) => { m.joined_at = days(-60 + i); m.active = !m.deactivated_at; });
  const mk = (o, its = [], done = 0) => {
    const t = { id: "t-" + T.seq, number: T.seq++, description: null, priority: "normal", due_at: null, department_id: null, reviewer_id: null, created_at: days(-3), updated_at: days(-1),
      started_at: null, submitted_at: null, completed_at: null, completed_by: null, status: "todo", ...o };
    T.tasks.push(t);
    its.forEach((x, i) => T.items.push({ id: t.id + "-i" + i, task_id: t.id, text: x, done: i < done, position: i }));
    T.events.push({ id: T.events.length + 1, task_id: t.id, kind: "created", from: null, to: "todo", note: null, actor_id: t.created_by, at: t.created_at });
    return t;
  };
  mk({ title: "Найти 3 фабрики кроссовок в Цзиньцзяне", description: "Размеры 36–45, нужны цены за 300 и 1000 пар, фото образцов.", assignee_id: "u-staff", reviewer_id: "u-q", created_by: "u-m",
    priority: "high", status: "in_progress", due_at: days(1), department_id: "d-src" }, ["Сравнить цены", "Запросить фото образца", "Проверить лицензию фабрики"], 1);
  mk({ title: "Проверить качество партии CN-000412", assignee_id: "u-q", reviewer_id: "u-m", created_by: "u-owner", status: "submitted", due_at: days(-1), department_id: "d-qc" }, ["Фото каждой коробки", "Вес нетто"], 2);
  mk({ title: "Договориться с карго о тарифе на декабрь", assignee_id: "u-l", created_by: "u-owner", priority: "urgent", due_at: days(-2), department_id: "d-log" });
  mk({ title: "Уточнить у поставщика срок отгрузки сумок", assignee_id: "u-staff", created_by: "u-owner", status: "todo", due_at: days(3) });
  mk({ title: "Ответить клиенту Айбеку по замене размера", assignee_id: "u-staff", reviewer_id: "u-m", created_by: "u-staff", status: "submitted" }, ["Согласовать с фабрикой"], 1);
  mk({ title: "Сверка остатков на складе в Иу", assignee_id: "u-l", created_by: "u-m", status: "done", completed_at: days(-2), completed_by: "u-l" });
  T.comments.push({ id: "c1", task_id: "t-1", author_id: "u-m", body: "Приоритет — фабрики с собственным литьём подошвы.", at: days(-2) });
  T.comments.push({ id: "c2", task_id: "t-1", author_id: "u-staff", body: "Две нашёл, третью ищу в Путяне.", at: days(-1) });
  const n = (user, kind, task, actor, note) => T.notifs.push({ id: T.notifs.length + 1, user_id: user, kind, task_id: task, actor_id: actor, note: note || null, at: days(-0.1 * T.notifs.length), read: false });
  n("u-staff", "assigned", "t-4", "u-owner"); n("u-staff", "comment", "t-1", "u-m", "Приоритет — фабрики с собственным литьём подошвы.");
  n("u-owner", "submitted", "t-2", "u-q"); n("u-owner", "blocked", "t-3", "u-l", "Карго не отвечает второй день");
  T.audit.push({ id: "1", action: "member.deactivate", actor_id: "u-owner", target_user: "u-old", detail: { moved: 2, note: "Перешёл в другую компанию" }, at: days(-20) });
  T.audit.push({ id: "2", action: "member.join", actor_id: "u-l", target_user: "u-l", detail: { role_key: "logistics" }, at: days(-30) });
  T.audit.push({ id: "3", action: "department.create", actor_id: "u-owner", target_user: null, detail: { name: "Склад в Иу" }, at: days(-31) });
  return T;
}

export function teamRpc(db, name, a) {
  if (!teamEnabled(db.scn) || !/^(team_|task_|order_|workflow_|my_team_|incident_|sop_|event_|ops_)/.test(name)) return null;
  const T = db.team || (db.team = build(db));
  const me = db.me;
  const mem = (id) => T.members.find((m) => m.user_id === id);
  const self = mem(me);
  const role = (k) => T.roles.find((r) => r.key === k);
  const perms = (id) => { const m = mem(id); if (!m || !m.active) return []; return m.role === "owner" ? CATALOG.slice() : (role(m.role_key) || { permissions: [] }).permissions; };
  const can = (p) => perms(me).includes(p);
  const task = (id) => T.tasks.find((t) => t.id === id);
  const canView = (t) => [t.assignee_id, t.reviewer_id, t.created_by].includes(me) || can("tasks.view_all") || can("tasks.manage") || (t.status === "submitted" && can("tasks.review"))
    || T.departments.some((d) => d.id === t.department_id && d.head_user_id === me) || (mem(t.assignee_id) || {}).manager_id === me;
  const canEdit = (t) => can("tasks.manage") || t.created_by === me;
  const canReview = (t) => me !== t.assignee_id && (t.reviewer_id === me || can("tasks.review"));
  const json = (t) => ({ ...t, items_total: T.items.filter((i) => i.task_id === t.id).length, items_done: T.items.filter((i) => i.task_id === t.id && i.done).length, comments: T.comments.filter((c) => c.task_id === t.id).length });
  const ev = (t, kind, from, to, note) => T.events.push({ id: T.events.length + 1, task_id: t.id, kind, from, to, note: note || null, actor_id: me, at: NOW() });
  const notify = (t, users, kind, note) => [...new Set(users)].filter((u) => u && u !== me && (mem(u) || {}).active).forEach((u) => T.notifs.push({ id: T.notifs.length + 1, user_id: u, kind, task_id: t.id, actor_id: me, note: note || null, at: NOW(), read: false }));
  const itemsOk = (t) => T.items.filter((i) => i.task_id === t.id).every((i) => i.done);
  const nameOf = (id) => (mem(id) || {}).full_name || null;
  const getT = (id) => { const t = task(id); return t && canView(t) ? t : null; };
  db.writes.push("team:" + name);

  // ---- файл 69: заказы ----
  const full = perms(me).includes("orders.all");
  const order = (id) => db.orders.find((o) => o.id === id);
  const duties = (oid) => T.otm.filter((x) => x.order_id === oid && x.user_id === me).map((x) => x.duty);
  const oev = (o, kind, detail) => T.oev.push({ id: T.oev.length + 1, order_id: o.id, kind, detail: detail || {}, actor: nameOf(me), at: NOW() });
  const scoped = (o) => {
    const d = duties(o.id), c = db.clients.find((x) => x.id === o.client_id) || {};
    const r = { id: o.id, order_number: o.order_number, status: o.status, order_date: o.order_date, product_ru: o.product_ru, product_zh: o.product_zh, quantity: o.quantity,
      delivery_eta_from: o.delivery_eta_from, delivery_eta_to: o.delivery_eta_to, ship_to: o.ship_to || null };
    if (full || d.includes("lead")) Object.assign(r, { client_name: o.client_name, client_phone: c.phone || null });
    if (full || d.includes("sourcing")) Object.assign(r, { supplier: o.supplier || "Фабрика Цзиньцзян", supplier_link: o.supplier_link, supplier_wechat: o.supplier_wechat, unit_price_cny: o.unit_price_cny, purchase_currency: o.purchase_currency });
    if (full || d.includes("logistics")) Object.assign(r, { tracking_number: o.tracking_number, weight_kg: o.weight_kg, client_city: c.city || "Бишкек", client_address: c.address, pickup_point: c.pickup_point });
    return r;
  };
  const stateOf = (oid) => T.delays.some((d) => d.order_id === oid && d.status === "open") ? "delayed"
    : T.ms.some((m) => m.order_id === oid && ["pending", "in_progress", "delayed"].includes(m.status) && m.due_at < NOW()) ? "at_risk" : "on_track";
  const access = (oid) => { const o = order(oid); if (!o) return null; if (full) return "full"; return duties(oid).length ? "team" : null; };
  const canLead = (oid) => duties(oid).includes("lead") || perms(me).includes("orders.assign");

  // ---- файл 70: инциденты, регламенты, календарь, сводка; файл 71: аналитика ----
  const opsMan = perms(me).includes("ops.manage");
  function incView(i) { return full || opsMan || [i.reported_by, i.owner_id].includes(me) || (i.order_id && T.otm.some((x) => x.order_id === i.order_id && x.user_id === me)); }
  const incJson = (i) => ({ ...i, order_number: (order(i.order_id) || {}).order_number, actions_open: T.tasks.filter((x) => x.incident_id === i.id && !["done", "cancelled"].includes(x.status)).length });
  const iev = (i, kind, from, to, note) => T.ievents.push({ id: T.ievents.length + 1, incident_id: i.id, kind, from, to, note: note || null, actor: nameOf(me), at: NOW() });
  const getI = (id) => { const i = T.incidents.find((x) => x.id === id); return i && incView(i) ? i : null; };

  switch (name) {
    case "incident_list": return ok(T.incidents.filter((i) => incView(i) && (a.p_scope === "all" || ["open", "investigating"].includes(i.status))).map(incJson));
    case "incident_get": { const i = getI(a.p_id); if (!i) return err("not_found", "P0002");
      return ok({ ...incJson(i), can: { manage: opsMan, work: opsMan || i.owner_id === me, close: opsMan },
        events: [{ id: 0, kind: "created", actor: nameOf(i.reported_by), at: i.created_at }].concat(T.ievents.filter((e) => e.incident_id === i.id)),
        actions: T.tasks.filter((x) => x.incident_id === i.id).map((x) => ({ id: x.id, number: x.number, title: x.title, status: x.status, assignee_id: x.assignee_id })) }); }
    case "incident_create": { const i = { id: "in-" + Date.now(), number: T.incidents.length + 1, title: a.p_title, description: a.p_description, severity: a.p_severity, category: a.p_category,
        status: "open", order_id: a.p_order, owner_id: a.p_owner, reported_by: me, created_at: NOW() }; T.incidents.push(i); return ok(i.id); }
    case "incident_set_status": { const i = getI(a.p_id); if (!i) return err("not_found", "P0002");
      if (a.p_status === "resolved" && !(a.p_root_cause || i.root_cause)) return err("resolution_required");
      if (a.p_status === "resolved" && T.tasks.some((x) => x.incident_id === i.id && !["done", "cancelled"].includes(x.status))) return err("actions_open");
      if (a.p_status === "closed" && !opsMan) return err("forbidden", "42501");
      iev(i, "status", i.status, a.p_status, a.p_resolution); Object.assign(i, { status: a.p_status, root_cause: a.p_root_cause || i.root_cause, resolution: a.p_resolution || i.resolution }); return ok(a.p_status); }
    case "incident_update": { const i = getI(a.p_id); if (!opsMan) return err("forbidden", "42501");
      if (a.p_owner !== i.owner_id) iev(i, "owner", i.owner_id, a.p_owner); if (a.p_severity !== i.severity) iev(i, "severity", i.severity, a.p_severity);
      Object.assign(i, { owner_id: a.p_owner, severity: a.p_severity }); return ok(null); }
    case "incident_comment": { const i = getI(a.p_id); iev(i, "comment", null, null, a.p_note); return ok(null); }
    case "incident_action": { const i = getI(a.p_id); const t = { id: "t-" + T.seq, number: T.seq++, title: a.p_title, description: i.title, status: "todo", priority: "urgent", due_at: a.p_due,
        assignee_id: a.p_assignee, created_by: me, created_at: NOW(), updated_at: NOW(), incident_id: i.id, incident_number: i.number, order_id: i.order_id };
      T.tasks.push(t); iev(i, "action", null, t.id, a.p_title); return ok(t.id); }
    case "sop_list": return ok(T.sops.filter((x) => x.status === "published" || opsMan).map((x) => ({ ...x, my_ack: (T.acks.find((k) => k.sop_id === x.id && k.user_id === me) || {}).version || null,
        acked: opsMan ? T.acks.filter((k) => k.sop_id === x.id && k.version === x.version).length : null, members: opsMan ? T.members.filter((m) => m.active).length : null })));
    case "sop_get": { const x = T.sops.find((y) => y.id === a.p_id); if (!x || (x.status !== "published" && !opsMan)) return err("not_found", "P0002");
      return ok({ ...x, can_edit: opsMan, my_ack: (T.acks.find((k) => k.sop_id === x.id && k.user_id === me) || {}).version || null,
        versions: opsMan && x.version > 1 ? [{ version: 1, body: "1. Пересчитать коробки.\n2. Сфотографировать маркировку.", edited_at: days(-20), by: "Байер Тест" }] : [],
        acks: opsMan ? T.members.filter((m) => m.active).map((m) => { const k = T.acks.find((y) => y.sop_id === x.id && y.user_id === m.user_id); return { user_id: m.user_id, name: m.full_name, version: k ? k.version : null, at: days(-1) }; }) : [] }); }
    case "sop_ack": { const x = T.sops.find((y) => y.id === a.p_id); T.acks = T.acks.filter((k) => !(k.sop_id === x.id && k.user_id === me)); T.acks.push({ sop_id: x.id, user_id: me, version: x.version }); return ok(x.version); }
    case "sop_save": { if (!opsMan) return err("forbidden", "42501");
      if (a.p_id) { const x = T.sops.find((y) => y.id === a.p_id); if (x.body !== a.p_body || x.title !== a.p_title) x.version++; Object.assign(x, { title: a.p_title, category: a.p_category, duty: a.p_duty, body: a.p_body, status: a.p_status, updated_at: NOW() }); return ok(x.id); }
      const x = { id: "sop-" + Date.now(), title: a.p_title, category: a.p_category, duty: a.p_duty, body: a.p_body, status: a.p_status, version: 1, updated_at: NOW() }; T.sops.push(x); return ok(x.id); }
    case "event_save": { if (a.p_id) Object.assign(T.events.find((e) => e.id === a.p_id), { title: a.p_title, at: a.p_starts, end: a.p_ends, note: a.p_note });
      else T.events.push({ id: "ev-" + Date.now(), title: a.p_title, at: a.p_starts, end: a.p_ends, note: a.p_note, created_by: me }); return ok("ev"); }
    case "event_delete": T.events = T.events.filter((e) => e.id !== a.p_id); return ok(null);
    case "ops_calendar": {
      const inR = (x) => x && x >= a.p_from && x < a.p_to;
      return ok([
        ...T.events.filter((e) => inR(e.at)).map((e) => ({ kind: "event", id: e.id, title: e.title, at: e.at, end: e.end, note: e.note, mine: e.created_by === me })),
        ...T.tasks.filter((x) => inR(x.due_at) && canView(x)).map((x) => ({ kind: "task", id: x.id, title: x.title, at: x.due_at, status: x.status, number: x.number, mine: x.assignee_id === me })),
        ...T.ms.filter((m) => inR(m.due_at) && (full || T.otm.some((x) => x.order_id === m.order_id && x.user_id === me))).map((m) => ({ kind: "milestone", id: m.id, order_id: m.order_id, title: m.title,
          at: m.due_at, status: m.status, order_number: (order(m.order_id) || {}).order_number, mine: T.otm.some((x) => x.order_id === m.order_id && x.user_id === me && x.duty === m.duty) })),
        ...T.incidents.filter((i) => inR(i.created_at) && incView(i)).map((i) => ({ kind: "incident", id: i.id, title: i.title, at: i.created_at, status: i.status, number: i.number, mine: i.owner_id === me })),
      ].sort((x, y) => String(x.at).localeCompare(String(y.at)))); }
    case "ops_dashboard": { if (!full) return err("forbidden", "42501");
      const open = db.orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
      const openT = T.tasks.filter((x) => ["todo", "in_progress", "blocked"].includes(x.status));
      return ok({ orders: { open: open.length, with_team: 2, no_lead: open.length - 2, on_track: open.length - 1, at_risk: 0, delayed: 1 },
        milestones: { overdue: T.ms.filter((m) => ["pending", "in_progress", "delayed"].includes(m.status) && m.due_at < NOW()).length, due_7d: 3 },
        delays: { open: 1, by_category: { supplier: 1 } },
        tasks: { open: openT.length + 2, overdue: openT.filter((x) => x.due_at && x.due_at < NOW()).length, blocked: 0, submitted: 2, unassigned: 0, done_7d: 1 },
        incidents: { open: 2, by_severity: { critical: 1, high: 1 } },
        workload: T.members.filter((m) => m.active).map((m) => ({ user_id: m.user_id, name: m.full_name, open: openT.filter((x) => x.assignee_id === m.user_id).length,
          overdue: openT.filter((x) => x.assignee_id === m.user_id && x.due_at && x.due_at < NOW()).length, review: T.tasks.filter((x) => x.reviewer_id === m.user_id && x.status === "submitted").length,
          orders: new Set(T.otm.filter((x) => x.user_id === m.user_id).map((x) => x.order_id)).size, incidents: T.incidents.filter((i) => i.owner_id === m.user_id).length })),
        sops: { published: 2, unread: 7 } }); }
    case "team_analytics": {
      const all = perms(me).includes("reports.view");
      const person = (m, k) => ({ user_id: m.user_id, name: m.full_name, tasks_done: 4 + k, tasks_with_due: 4, tasks_on_time: 3 + (k % 2), avg_cycle_h: 18 + k * 7, submitted: 3, returned: k % 3,
        reviewed: k, milestones_done: 2 + k, milestones_on_time: 2, delays_reported: k % 2, incidents_resolved: 0, open_now: k + 1, overdue_now: k % 2, orders_now: 2 });
      const ppl = T.members.filter((m) => m.active && (all || m.user_id === me)).map(person);
      const wk = []; for (let i = 4; i >= 0; i--) { const d = new Date(Date.now() - i * 7 * 864e5); wk.push({ week: d.toISOString().slice(0, 10), tasks_created: 6 + i, tasks_done: [3, 7, 5, 9, 4][i], delays: i % 2, incidents: i === 0 ? 2 : 0 }); }
      return ok({ from: a.p_from, to: a.p_to, all, people: ppl, totals: all ? {
        tasks: { created: 34, done: 28, with_due: 22, on_time: 17, avg_cycle_h: 26.5, open_now: 9, overdue_now: 2 }, reviews: { submitted: 14, returned: 3, approved: 11 },
        milestones: { done: 19, on_time: 15, qc_done: 4 }, delays: { count: 3, by_category: { supplier: { count: 2, avg_shift_d: 5, avg_resolve_h: 30 }, quality: { count: 1, avg_shift_d: 3, avg_resolve_h: 12 } } },
        incidents: { count: 2, by_category: { quality: 1, logistics: 1 }, by_severity: { high: 1, critical: 1 }, avg_resolve_h: null, open_now: 2 },
        quality: { qc_milestones_done: 4, qc_milestones_delayed: 1, quality_delays: 1, quality_incidents: 1 },
        steps: [{ title: "Товар готов на фабрике", delays: 2 }, { title: "Контроль качества", delays: 1 }], weekly: wk } : null }); }
    case "my_team_workspaces": return ok([{ id: "ws1", name: db.workspaces[0].name, order_prefix: "CN", full, role: self.role }]);
    case "order_ops_list": {
      if (a.p_scope === "attention" && !full) return err("forbidden", "42501");
      const ids = a.p_scope === "mine" ? [...new Set(T.otm.filter((x) => x.user_id === me).map((x) => x.order_id))]
        : [...new Set(T.delays.filter((d) => d.status === "open").map((d) => d.order_id).concat(T.ms.filter((m) => ["pending", "in_progress", "delayed"].includes(m.status) && m.due_at < NOW()).map((m) => m.order_id)))];
      return ok(ids.map(order).filter(Boolean).map((o) => ({ ...scoped(o), my_duties: duties(o.id), state: stateOf(o.id), open_delays: T.delays.filter((d) => d.order_id === o.id && d.status === "open").length,
        next: T.ms.filter((m) => m.order_id === o.id && ["pending", "in_progress", "delayed"].includes(m.status)).sort((x, y) => x.position - y.position)[0] || null,
        lead: nameOf((T.otm.find((x) => x.order_id === o.id && x.duty === "lead") || {}).user_id) })));
    }
    case "order_ops_get": {
      const acc = access(a.p_order); if (!acc) return err("order_not_found", "P0002");
      const o = order(a.p_order), d = duties(o.id), lead = canLead(o.id);
      return ok({ order: scoped(o), access: acc, my_duties: d, state: stateOf(o.id),
        can: { assign: perms(me).includes("orders.assign"), lead, fields: [...(full || d.includes("sourcing") ? ["supplier", "supplier_link", "supplier_wechat"] : []), ...(full || d.includes("logistics") ? ["tracking_number"] : [])] },
        team: T.otm.filter((x) => x.order_id === o.id).map((x) => ({ ...x, name: nameOf(x.user_id), active: (mem(x.user_id) || {}).active })),
        milestones: T.ms.filter((m) => m.order_id === o.id).sort((x, y) => x.position - y.position).map((m) => ({ ...m, can: lead || d.includes(m.duty) })),
        delays: T.delays.filter((x) => x.order_id === o.id).map((x) => ({ ...x, actions: T.tasks.filter((t) => t.delay_id === x.id).map((t) => ({ id: t.id, number: t.number, title: t.title, status: t.status, assignee_id: t.assignee_id })) })),
        events: T.oev.filter((e) => e.order_id === o.id), templates: lead ? T.templates.map((x) => ({ id: x.id, name: x.name })) : [] });
    }
    case "order_team_set": { if (!perms(me).includes("orders.assign")) return err("forbidden", "42501"); const o = order(a.p_order);
      if (a.p_on) { if (a.p_duty === "lead") T.otm = T.otm.filter((x) => !(x.order_id === o.id && x.duty === "lead")); T.otm.push({ order_id: o.id, user_id: a.p_user, duty: a.p_duty }); oev(o, "team.add", { user_id: a.p_user, duty: a.p_duty }); }
      else { T.otm = T.otm.filter((x) => !(x.order_id === o.id && x.user_id === a.p_user && x.duty === a.p_duty)); oev(o, "team.remove", { user_id: a.p_user, duty: a.p_duty }); }
      return ok(null); }
    case "order_milestone_set": { const m = T.ms.find((x) => x.id === a.p_id); if (!access(m.order_id)) return err("order_not_found", "P0002");
      if (!(canLead(m.order_id) || duties(m.order_id).includes(m.duty))) return err("forbidden", "42501");
      if (m.status === "delayed" && T.delays.some((d) => d.milestone_id === m.id && d.status === "open") && a.p_status !== "done") return err("delay_open");
      oev(order(m.order_id), "milestone.status", { title: m.title, from: m.status, to: a.p_status }); m.status = a.p_status; return ok(a.p_status); }
    case "order_milestone_save": { if (!canLead(a.p_order)) return err("forbidden", "42501");
      if (a.p_id) Object.assign(T.ms.find((x) => x.id === a.p_id), { title: a.p_title, duty: a.p_duty, due_at: a.p_due });
      else T.ms.push({ id: "m-" + Date.now(), order_id: a.p_order, position: 99, title: a.p_title, duty: a.p_duty, due_at: a.p_due, status: "pending" });
      return ok("m"); }
    case "order_milestone_delete": T.ms = T.ms.filter((x) => x.id !== a.p_id); return ok(null);
    case "order_apply_template": { const tp = T.templates.find((x) => x.id === a.p_template); T.ms = T.ms.filter((m) => m.order_id !== a.p_order || m.status === "done");
      tp.steps.forEach((s, i) => T.ms.push({ id: a.p_order + "-n" + i + Date.now(), order_id: a.p_order, position: i + 1, title: s.title, duty: s.duty, due_at: days(s.days), status: "pending" }));
      oev(order(a.p_order), "template.apply", { name: tp.name }); return ok(tp.steps.length); }
    case "order_ops_fields": { const o = order(a.p_order); if (!access(o.id)) return err("order_not_found", "P0002"); Object.assign(o, a.p_fields); oev(o, "fields", a.p_fields); return ok(null); }
    case "order_report_delay": { const o = order(a.p_order); if (!access(o.id)) return err("order_not_found", "P0002"); if (!a.p_reason) return err("note_required");
      const m = T.ms.find((x) => x.id === a.p_milestone);
      const id = "dl-" + (T.delays.length + 1); T.delays.push({ id, order_id: o.id, milestone_id: a.p_milestone, category: a.p_category, reason: a.p_reason, old_due: m && m.due_at, new_due: a.p_new_due,
        status: "open", reported_by: nameOf(me), reporter_id: me, created_at: NOW(), resolution: null });
      if (m) { m.status = "delayed"; if (a.p_new_due) m.due_at = a.p_new_due; }
      oev(o, "delay.report", { category: a.p_category }); return ok(id); }
    case "order_delay_action": { const d = T.delays.find((x) => x.id === a.p_delay); if (!canLead(d.order_id)) return err("forbidden", "42501");
      const t = { id: "t-" + T.seq, number: T.seq++, title: a.p_title, description: d.reason, status: "todo", priority: "high", due_at: a.p_due, assignee_id: a.p_assignee, created_by: me,
        created_at: NOW(), updated_at: NOW(), order_id: d.order_id, delay_id: d.id, order_number: order(d.order_id).order_number };
      T.tasks.push(t); oev(order(d.order_id), "delay.action", { title: a.p_title }); return ok(t.id); }
    case "order_delay_resolve": { const d = T.delays.find((x) => x.id === a.p_delay); if (!a.p_note) return err("note_required");
      Object.assign(d, { status: "resolved", resolution: a.p_note }); const m = T.ms.find((x) => x.id === d.milestone_id); if (m && m.status === "delayed") m.status = "in_progress";
      oev(order(d.order_id), "delay.resolve", {}); return ok(null); }
    case "workflow_templates_list": return ok(T.templates);
    case "workflow_template_save": { if (a.p_id) Object.assign(T.templates.find((x) => x.id === a.p_id), { name: a.p_name, steps: a.p_steps });
      else T.templates.push({ id: "wf-" + Date.now(), name: a.p_name, steps: a.p_steps, is_system: false }); return ok("wf"); }
    case "workflow_template_delete": T.templates = T.templates.filter((x) => x.id !== a.p_id || x.is_system); return ok(null);
    case "task_counts": return ok({
      mine: T.tasks.filter((t) => t.assignee_id === me && ["todo", "in_progress", "blocked"].includes(t.status)).length,
      overdue: T.tasks.filter((t) => t.assignee_id === me && ["todo", "in_progress", "blocked"].includes(t.status) && t.due_at && t.due_at < NOW()).length,
      review: T.tasks.filter((t) => t.status === "submitted" && canReview(t)).length,
      unread: T.notifs.filter((x) => x.user_id === me && !x.read).length,
      orders: new Set(T.otm.filter((x) => x.user_id === me).map((x) => x.order_id)).size,
      alerts: perms(me).includes("orders.all") ? T.delays.filter((d) => d.status === "open").length : 0,
      full: perms(me).includes("orders.all"), ops: true,
      incidents: T.incidents.filter((i) => ["open", "investigating"].includes(i.status) && incView(i)).length,
      sops_unread: T.sops.filter((x) => x.status === "published" && !T.acks.some((a) => a.sop_id === x.id && a.user_id === me && a.version === x.version)).length });
    case "team_overview": {
      const manage = can("team.manage");
      return ok({
        me: { user_id: me, is_owner: self.role === "owner", role: self.role, role_key: self.role_key, department_id: self.department_id, title: self.title, manager_id: self.manager_id, permissions: perms(me) },
        catalog: CATALOG,
        members: T.members.filter((m) => manage || m.active).map((m) => ({ ...m, phone: manage ? m.phone : null, email: manage ? m.email : null, deactivated_at: manage ? m.deactivated_at || null : null, deactivation_note: manage ? m.deactivation_note || null : null })),
        departments: T.departments,
        roles: T.roles.map((r) => ({ ...r, members: T.members.filter((m) => m.active && m.role_key === r.key).length })),
        invites: manage ? T.invites : [], audit: manage ? T.audit.slice().sort((x, y) => String(y.at).localeCompare(String(x.at))) : [], limit: 5 });
    }
    case "task_list": {
      const s = a.p_scope;
      const list = T.tasks.filter((t) => canView(t) && (s === "mine" ? t.assignee_id === me : s === "created" ? t.created_by === me : s === "review" ? t.status === "submitted" && canReview(t) : true));
      return ok(list.map(json).sort((x, y) => (["done", "cancelled"].includes(x.status) - ["done", "cancelled"].includes(y.status)) || String(x.due_at || "9").localeCompare(String(y.due_at || "9"))));
    }
    case "task_get": {
      const t = getT(a.p_id); if (!t) return err("task_not_found", "P0002");
      return ok({ ...json(t), items: T.items.filter((i) => i.task_id === t.id),
        comment_list: T.comments.filter((c) => c.task_id === t.id).map((c) => ({ ...c, author: nameOf(c.author_id) })),
        events: T.events.filter((e) => e.task_id === t.id).map((e) => ({ ...e, actor: nameOf(e.actor_id) })),
        can: { edit: canEdit(t), work: t.assignee_id === me, review: t.status === "submitted" && canReview(t), assign_others: can("tasks.create") } });
    }
    case "task_create": {
      if (!can("tasks.create") && a.p_assignee !== me) return err("forbidden", "42501");
      if (a.p_reviewer && a.p_reviewer === a.p_assignee) return err("bad_reviewer");
      const t = { id: "t-" + T.seq, number: T.seq++, title: a.p_title, description: a.p_description, status: "todo", priority: a.p_priority || "normal", due_at: a.p_due, department_id: a.p_department,
        assignee_id: a.p_assignee, reviewer_id: a.p_reviewer, created_by: me, created_at: NOW(), updated_at: NOW() };
      T.tasks.push(t); (a.p_items || []).forEach((x, i) => T.items.push({ id: t.id + "-i" + i, task_id: t.id, text: x, done: false, position: i }));
      ev(t, "created", null, "todo"); notify(t, [t.assignee_id], "assigned"); notify(t, [t.reviewer_id], "reviewer");
      return ok(t.id);
    }
    case "task_update": { const t = getT(a.p_id); if (!t) return err("task_not_found", "P0002"); if (!canEdit(t)) return err("forbidden", "42501");
      Object.assign(t, { title: a.p_title, description: a.p_description, due_at: a.p_due, priority: a.p_priority, department_id: a.p_department, updated_at: NOW() }); ev(t, "edited", null, "title"); return ok(null); }
    case "task_assign": { const t = getT(a.p_id); if (!t) return err("task_not_found", "P0002"); if (!canEdit(t)) return err("forbidden", "42501");
      if (a.p_reviewer && a.p_reviewer === a.p_assignee) return err("bad_reviewer");
      if (a.p_assignee !== t.assignee_id) { ev(t, "assigned", t.assignee_id, a.p_assignee); notify(t, [a.p_assignee], "assigned"); if (["in_progress", "blocked"].includes(t.status)) t.status = "todo"; }
      t.assignee_id = a.p_assignee; t.reviewer_id = a.p_reviewer; return ok(null); }
    case "task_set_status": {
      const t = getT(a.p_id); if (!t) return err("task_not_found", "P0002");
      const to = a.p_status, from = t.status, work = t.assignee_id === me, edit = canEdit(t);
      if ((to === "submitted" || to === "done") && !itemsOk(t)) return err("checklist_incomplete");
      if (to === "submitted" && !t.reviewer_id) return err("no_reviewer");
      if (to === "done" && t.reviewer_id && from !== "done") return err("review_required");
      if ((to === "blocked" || (to === "in_progress" && from === "done")) && !a.p_note) return err("note_required");
      if (!(work || edit)) return err("forbidden", "42501");
      t.status = to; t.updated_at = NOW(); if (to === "done") { t.completed_at = NOW(); t.completed_by = me; }
      ev(t, "status", from, to, a.p_note);
      if (to === "submitted") notify(t, [t.reviewer_id], "submitted"); else if (to === "blocked") notify(t, [t.created_by, t.reviewer_id], "blocked", a.p_note);
      else if (to === "done") notify(t, [t.created_by], "done"); else if (to === "cancelled") notify(t, [t.assignee_id], "cancelled", a.p_note);
      return ok(to);
    }
    case "task_review": {
      const t = getT(a.p_id); if (!t) return err("task_not_found", "P0002");
      if (t.status !== "submitted") return err("not_submitted"); if (!canReview(t)) return err("forbidden", "42501");
      if (!a.p_approve && !a.p_note) return err("note_required");
      t.status = a.p_approve ? "done" : "in_progress"; ev(t, "review", "submitted", t.status, a.p_note);
      if (a.p_note) T.comments.push({ id: "c" + (T.comments.length + 1), task_id: t.id, author_id: me, body: a.p_note, at: NOW() });
      notify(t, [t.assignee_id], a.p_approve ? "approved" : "rejected", a.p_note); return ok(t.status);
    }
    case "task_item_toggle": { const it = T.items.find((i) => i.id === a.p_item); const t = it && getT(it.task_id); if (!t) return err("task_not_found", "P0002");
      if (!["todo", "in_progress", "blocked"].includes(t.status)) return err("task_locked"); it.done = !!a.p_done; ev(t, "item", null, it.done ? "checked" : "unchecked", it.text); return ok(null); }
    case "task_item_add": { const t = getT(a.p_task); if (!t) return err("task_not_found", "P0002"); T.items.push({ id: t.id + "-i" + T.items.length, task_id: t.id, text: a.p_text, done: false }); ev(t, "item", null, "added", a.p_text); return ok("x"); }
    case "task_item_delete": { const i = T.items.findIndex((x) => x.id === a.p_item); if (i >= 0) T.items.splice(i, 1); return ok(null); }
    case "task_comment_add": { const t = getT(a.p_task); if (!t) return err("task_not_found", "P0002");
      T.comments.push({ id: "c" + (T.comments.length + 1), task_id: t.id, author_id: me, body: a.p_body, at: NOW() }); notify(t, [t.assignee_id, t.reviewer_id, t.created_by], "comment", a.p_body); return ok("c"); }
    case "team_notif_list": return ok(T.notifs.filter((x) => x.user_id === me).slice().reverse().map((x) => { const t = task(x.task_id) || {}; return { ...x, task_number: t.number, title: t.title, actor: nameOf(x.actor_id) }; }));
    case "team_notif_read": { let k = 0; T.notifs.forEach((x) => { if (x.user_id === me && !x.read && (!a.p_ids || a.p_ids.includes(x.id))) { x.read = true; k++; } }); return ok(k); }
    case "team_invite_new": { if (!can("team.manage")) return err("forbidden", "42501"); const code = Math.random().toString(16).slice(2).padEnd(32, "0").slice(0, 32);
      T.invites.unshift({ code, expires_at: days(3), role_key: a.p_role_key, department_id: a.p_department, title: a.p_title, invitee_name: a.p_name }); return ok(code); }
    case "team_invite_revoke": T.invites = T.invites.filter((i) => i.code !== a.p_code); return ok(null);
    case "team_member_update": { if (!can("team.manage")) return err("forbidden", "42501"); const m = mem(a.p_user);
      Object.assign(m, { role_key: m.role === "staff" ? a.p_role_key : null, department_id: a.p_department, title: a.p_title, manager_id: a.p_manager }); return ok(null); }
    case "team_deactivate": { if (!can("team.manage")) return err("forbidden", "42501"); if (a.p_user === me) return err("cannot_deactivate_self");
      const m = mem(a.p_user); m.active = false; m.deactivated_at = NOW(); m.deactivation_note = a.p_note; let moved = 0;
      T.tasks.filter((t) => OPEN.includes(t.status) && (t.assignee_id === m.user_id || t.reviewer_id === m.user_id)).forEach((t) => {
        if (t.assignee_id === m.user_id) { t.assignee_id = a.p_reassign_to; if (["in_progress", "blocked"].includes(t.status)) t.status = "todo"; ev(t, "handover", m.user_id, a.p_reassign_to, "assignee"); }
        if (t.reviewer_id === m.user_id) { t.reviewer_id = a.p_reassign_to !== t.assignee_id ? a.p_reassign_to : null; ev(t, "handover", m.user_id, t.reviewer_id, "reviewer"); }
        moved++; });
      T.audit.push({ id: String(T.audit.length + 1), action: "member.deactivate", actor_id: me, target_user: m.user_id, detail: { moved }, at: NOW() });
      return ok({ moved }); }
    case "team_reactivate": { const m = mem(a.p_user); if (T.members.filter((x) => x.active && x.role === "staff").length >= 5) return err("team_full"); m.active = true; m.deactivated_at = null; return ok(null); }
    case "team_department_save": { if (!can("team.manage")) return err("forbidden", "42501");
      if (T.departments.some((d) => d.id !== a.p_id && d.name.toLowerCase() === String(a.p_name).toLowerCase())) return err("duplicate_name");
      if (a.p_id) Object.assign(T.departments.find((d) => d.id === a.p_id), { name: a.p_name, parent_id: a.p_parent, head_user_id: a.p_head });
      else T.departments.push({ id: "d-" + Date.now(), name: a.p_name, parent_id: a.p_parent, head_user_id: a.p_head });
      return ok("d"); }
    case "team_department_delete": { const d = T.departments.find((x) => x.id === a.p_id); T.departments.forEach((x) => { if (x.parent_id === d.id) x.parent_id = d.parent_id; });
      T.members.forEach((m) => { if (m.department_id === d.id) m.department_id = null; }); T.departments = T.departments.filter((x) => x !== d); return ok(null); }
    case "team_role_save": { if (self.role !== "owner") return err("forbidden", "42501");
      if (a.p_key) Object.assign(role(a.p_key), { name: a.p_name, permissions: a.p_permissions }); else T.roles.push({ key: "r_" + Date.now(), name: a.p_name, permissions: a.p_permissions, is_system: false });
      return ok("r"); }
    case "team_role_delete": { const r = role(a.p_key); if (r.is_system) return err("system_role"); T.roles = T.roles.filter((x) => x !== r); return ok(null); }
  }
  return null;
}
