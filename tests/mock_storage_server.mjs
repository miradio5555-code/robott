// Поддельное хранилище Supabase Storage для проверки копии на компьютере (ничего настоящего не трогает).
//   node tests/mock_storage_server.mjs ПАПКА ПОРТ
// Папка: первый уровень — хранилища, дальше файлы. Принимает и загрузку (POST /object/...).
import http from "node:http";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3]);
const KEY = "test-service-key";
mkdirSync(root, { recursive: true });

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "content-type": type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const read = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });

http.createServer(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${KEY}`) return send(res, 401, { error: "bad key" });
  const url = new URL(req.url, "http://x");
  const p = url.pathname.replace(/^\/storage\/v1/, "");
  const parts = p.split("/").filter(Boolean).map(decodeURIComponent);

  if (req.method === "GET" && p === "/bucket") {
    return send(res, 200, readdirSync(root).filter((d) => statSync(path.join(root, d)).isDirectory())
      .map((id) => ({ id, name: id, public: false })));
  }
  if (req.method === "POST" && parts[0] === "object" && parts[1] === "list") {
    const bucket = parts[2];
    const { prefix = "", limit = 100, offset = 0 } = JSON.parse((await read(req)).toString() || "{}");
    const dir = path.join(root, bucket, prefix);
    let names = []; try { names = readdirSync(dir).sort(); } catch {}
    const list = names.map((name) => {
      const st = statSync(path.join(dir, name));
      return st.isDirectory() ? { name, id: null, metadata: null }
        : { name, id: "id-" + name, metadata: { size: st.size, mimetype: "text/plain" } };
    });
    return send(res, 200, list.slice(offset, offset + limit));
  }
  if (req.method === "GET" && parts[0] === "object" && parts[1] === "authenticated") {
    try { return send(res, 200, readFileSync(path.join(root, ...parts.slice(2))), "application/octet-stream"); }
    catch { return send(res, 404, { error: "no" }); }
  }
  if (req.method === "POST" && parts[0] === "object") {
    const target = path.join(root, ...parts.slice(1));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, await read(req));
    return send(res, 200, { Key: parts.slice(1).join("/") });
  }
  send(res, 404, { error: "unknown" });
}).listen(port, "127.0.0.1");
