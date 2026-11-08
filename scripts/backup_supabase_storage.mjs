// Ночная копия файлов из всех хранилищ Supabase.
// Запускается GitHub Actions. Ключ берётся только из секрета, в журнал не выводится.
import { createWriteStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const output = path.resolve(process.argv[2] || "storage-backup");

// Коды выхода: 0 — готово, 78 — не настроено (нет секретов), 1 — ошибка. В сообщениях нет ключей и адресов.
if (!baseUrl || !serviceKey) {
  console.error("КОПИРОВАНИЕ НЕ НАСТРОЕНО: нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(78);
}

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Повторяем запросы при временной ошибке сети или перегрузке Supabase.
async function request(route, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/storage/v1${route}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
        signal: AbortSignal.timeout(300_000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        await response.body?.cancel();
        await pause(1000 * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await pause(1000 * (attempt + 1));
    }
  }
  throw lastError || new Error("Не удалось связаться с Supabase Storage.");
}

async function json(route, options) {
  const response = await request(route, options);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Supabase Storage вернул ошибку ${response.status}.`);
  }
  return response.json();
}

function safeFile(bucketId, objectName) {
  const parts = objectName.split("/");
  if (!objectName || objectName.startsWith("/") || objectName.includes("\\") ||
      parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error("В хранилище найдено имя файла, которое нельзя безопасно сохранить.");
  }
  const root = path.resolve(output);
  const target = path.resolve(root, bucketId, ...parts);
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Имя файла выходит за пределы папки копии.");
  }
  return target;
}

let fileCount = 0;
let totalBytes = 0;
const savedObjects = [];

async function walk(bucketId, prefix = "", depth = 0) {
  if (depth > 32) throw new Error("Слишком много уровней папок в Storage.");
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const entries = await json(`/object/list/${encodeURIComponent(bucketId)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
    });
    if (!Array.isArray(entries)) throw new Error("Supabase вернул неожиданный список файлов.");

    for (const entry of entries) {
      if (!entry || typeof entry.name !== "string" || !entry.name) {
        throw new Error("В списке Storage найдено некорректное имя файла.");
      }
      const name = prefix && entry.name.startsWith(`${prefix}/`)
        ? entry.name
        : prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id == null && entry.metadata == null;
      if (isFolder) {
        await walk(bucketId, name, depth + 1);
        continue;
      }

      const destination = safeFile(bucketId, name);
      await mkdir(path.dirname(destination), { recursive: true });
      const objectPath = name.split("/").map(encodeURIComponent).join("/");
      const response = await request(
        `/object/authenticated/${encodeURIComponent(bucketId)}/${objectPath}`,
      );
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error(`Не удалось скачать файл из хранилища (код ${response.status}).`);
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destination, { flags: "wx" }));

      const written = (await stat(destination)).size;
      const expected = Number(entry.metadata?.size);
      if (Number.isFinite(expected) && expected > 0 && written !== expected) {
        throw new Error(`Файл из хранилища скачан не полностью: ${written} из ${expected} байт.`);
      }
      totalBytes += written;
      fileCount++;
      savedObjects.push({ bucket_id: bucketId, name, metadata: entry.metadata || null });
    }

    if (entries.length < limit) break;
  }
}

async function main() {
  await mkdir(output, { recursive: true });
  const buckets = await json("/bucket", { method: "GET" });
  if (!Array.isArray(buckets)) throw new Error("Supabase вернул неожиданный список хранилищ.");

  for (const bucket of buckets) {
    if (!bucket || typeof bucket.id !== "string" || !/^[A-Za-z0-9_-]+$/.test(bucket.id)) {
      throw new Error("В Supabase найдено хранилище с неподдерживаемым именем.");
    }
    await mkdir(path.join(output, bucket.id), { recursive: true });
    await walk(bucket.id);
  }

  await writeFile(path.join(output, "manifest.json"), JSON.stringify({
    created_at: new Date().toISOString(),
    bucket_count: buckets.length,
    file_count: fileCount,
    total_bytes: totalBytes,
    buckets: buckets.map((bucket) => ({
      id: bucket.id,
      name: bucket.name,
      public: bucket.public,
      file_size_limit: bucket.file_size_limit ?? null,
      allowed_mime_types: bucket.allowed_mime_types ?? null,
    })),
    objects: savedObjects,
  }, null, 2));

  console.log(`Копия Storage готова: ${fileCount} файлов из ${buckets.length} хранилищ.`);
}

main().catch((error) => {
  console.error(`Ошибка копирования файлов: ${error?.message || "неизвестная ошибка"}`);
  process.exit(1);
});
