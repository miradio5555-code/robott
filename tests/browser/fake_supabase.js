// Поддельный клиент Supabase для проверки сайта (см. tests/browser/server.mjs). Только для проверок.
// Страница клиента ходит по адресу из config.js (настоящая база) — в проверках все такие запросы уходят на сам стенд.
(function () {
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var u = typeof input === "string" ? input : (input && input.url) || "";
    if (/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\//i.test(u)) { init = Object.assign({}, init); init.headers = Object.assign({}, init.headers, { "x-stand-q": location.search }); return realFetch(u.replace(/^https:\/\/[^/]+/i, location.origin), init); }
    return realFetch(input, init);
  };
})();
(function () {
  var scn = new URLSearchParams(location.search).get("scn") || "veteran";
  function call(body) {
    body.scn = scn;
    return fetch("/__api", { method: "POST", body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function Q(table) {
    var q = { op: "q", table: table, filters: [], orders: [], select: "*" }, p = null;
    var b = {
      select: function (cols, opt) { q.select = cols; if (opt && opt.count) q.count = true; if (opt && opt.head) q.head = true; return b; },
      insert: function (payload) { q.method = "insert"; q.payload = payload; return b; },
      update: function (payload) { q.method = "update"; q.payload = payload; return b; },
      upsert: function (payload) { q.method = "insert"; q.payload = payload; return b; },
      delete: function () { q.method = "delete"; return b; },
      eq: function (c, v) { q.filters.push({ op: "eq", col: c, val: v }); return b; },
      neq: function (c, v) { q.filters.push({ op: "neq", col: c, val: v }); return b; },
      in: function (c, v) { q.filters.push({ op: "in", col: c, val: v }); return b; },
      is: function (c, v) { q.filters.push({ op: "is", col: c, val: v }); return b; },
      gte: function (c, v) { q.filters.push({ op: "gte", col: c, val: v }); return b; },
      lte: function (c, v) { q.filters.push({ op: "lte", col: c, val: v }); return b; },
      gt: function (c, v) { q.filters.push({ op: "gt", col: c, val: v }); return b; },
      lt: function (c, v) { q.filters.push({ op: "lt", col: c, val: v }); return b; },
      or: function () { return b; }, not: function () { return b; }, ilike: function () { return b; }, like: function () { return b; }, contains: function () { return b; },
      order: function (c, o) { q.orders.push({ col: c, asc: !(o && o.ascending === false) }); return b; },
      range: function (a, z) { q.range = [a, z]; return b; },
      limit: function (n) { q.limit = n; return b; },
      single: function () { q.single = true; return b; },
      maybeSingle: function () { q.maybe = true; return b; },
      then: function (ok, bad) { if (!p) p = call(q); return p.then(ok, bad); },
      catch: function (f) { return b.then(null, f); }
    };
    return b;
  }
  // обучение по шагам и окно разрешений мешают экрану: по умолчанию считаем их пройденными (?tour=1 — показать обучение)
  try {
    var qs = new URLSearchParams(location.search), uidx = scn === "staff" ? "u-staff" : "u-owner";
    if (!qs.get("tour")) { localStorage.setItem("ula_tour_done_" + uidx, "1"); localStorage.setItem("ula_perm_later", String(Date.now())); }
    if (qs.get("clear")) { localStorage.removeItem("ula_simple_" + uidx); localStorage.removeItem("ula_form_full"); }
  } catch (e) { /* ignore */ }
  // служебный кэш сайта (sw.js) в проверках только мешает: старые файлы вместо свежих
  try {
    if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
    if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
  } catch (e) { /* ignore */ }
  var listeners = [];
  var user = { id: scn === "staff" ? "u-staff" : "u-owner", email: "test@example.test", user_metadata: { full_name: "Тест" }, app_metadata: { providers: ["email"] } };
  var session = scn === "loggedout" ? null : { user: user, access_token: "fake" };
  var chan = { on: function () { return chan; }, subscribe: function () { return chan; }, unsubscribe: function () {} };
  var client = {
    from: Q,
    rpc: function (name, args) { return call({ op: "rpc", name: name, args: args || {} }); },
    auth: {
      getSession: function () { return Promise.resolve({ data: { session: session }, error: null }); },
      getUser: function () { return Promise.resolve({ data: { user: user }, error: null }); },
      onAuthStateChange: function (cb) { listeners.push(cb); return { data: { subscription: { unsubscribe: function () {} } } }; },
      signOut: function () { session = null; return Promise.resolve({ error: null }); },
      signInWithPassword: function () { return Promise.resolve({ data: null, error: { message: "fake" } }); },
      mfa: { listFactors: function () { return Promise.resolve({ data: { totp: [] }, error: null }); }, getAuthenticatorAssuranceLevel: function () { return Promise.resolve({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }); } }
    },
    storage: { from: function () { return {
      upload: function () { return Promise.resolve({ data: {}, error: null }); }, remove: function () { return Promise.resolve({ data: [], error: null }); },
      getPublicUrl: function (p) { return { data: { publicUrl: "/img/" + p } }; }, createSignedUrl: function () { return Promise.resolve({ data: { signedUrl: "" }, error: null }); } }; } },
    functions: { invoke: function () { return Promise.resolve({ data: null, error: null }); } },
    channel: function () { return chan; }, removeChannel: function () {}
  };
  window.supabase = { createClient: function () { return client; } };
  window.__fakeScn = scn;
})();
