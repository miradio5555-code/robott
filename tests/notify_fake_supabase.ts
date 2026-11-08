// Поддельный supabase-js для tests/notify_legacy_test.ts: ничего не подключает, отвечает заданными данными.
// deno-lint-ignore-file no-explicit-any
export const fake: any = { queue: "exists", orders: [], subs: [], calls: [] as string[] };

function builder(table: string) {
  const st: any = { table };
  const result = () => {
    if (table === "order_notify_queue") {
      if (fake.queue === "exists") return { data: null, error: null, count: 0 };
      if (fake.queue === "missing") return { data: null, error: { code: "42P01", message: "relation does not exist" } };
      return { data: null, error: { code: "08006", message: "connection failure" } };
    }
    if (table === "orders") return { data: fake.orders, error: null };
    if (table === "order_tg_subs") return { data: st.write ? null : fake.subs, error: null, count: fake.subs.length };
    if (table === "workspaces") return { data: [{ id: "ws1", name: "Кабинет" }], error: null };
    return { data: [], error: null };
  };
  const p: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res: any) => Promise.resolve(result()).then(res);
      if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve({ data: (result().data as any[])?.[0] ?? null, error: null });
      if (prop === "update" || prop === "delete" || prop === "upsert" || prop === "insert") return () => { st.write = true; fake.calls.push(table + "." + String(prop)); return p; };
      return () => p;
    },
  });
  return p;
}

export function createClient(_url: string, _key: string, _opts?: unknown) {
  return {
    from: (t: string) => builder(t),
    rpc: (name: string) => Promise.resolve({ data: name === "is_admin" ? false : name === "notify_claim" ? [] : true, error: null }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  };
}
