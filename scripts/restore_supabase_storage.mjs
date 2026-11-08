// Загружает файлы из распакованной копии (папка storage/) в хранилища Supabase НОВОГО проекта.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/restore_supabase_storage.mjs ПАПКА_storage
// Хранилища (buckets) должны уже существовать: их создаёт файл storage-buckets.sql из архива.
// Уже существующие файлы перезаписываются. Ключ нигде не печатается.
import { readFile } from "node:fs/promises";
import path from "node:path";

const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const root = path.resolve(process.argv[2] || "storage");

if (!baseUrl || !serviceKey) {
  console.error("Нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY нового проекта.");
  process.exit(78);
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
  if (!Array.isArray(manifest.objects)) throw new Error("В manifest.json нет списка файлов.");

  let done = 0;
  for (const object of manifest.objects) {
    const parts = String(object.name || "").split("/");
    if (!object.bucket_id || !/^[A-Za-z0-9_-]+$/.test(object.bucket_id) ||
        parts.some((part) => !part || part === "." || part === "..")) {
      throw new Error("В manifest.json найдено небезопасное имя файла.");
    }
    const file = path.resolve(root, object.bucket_id, ...parts);
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Имя файла выходит за пределы папки.");

    const body = await readFile(file);
    const route = `${encodeURIComponent(object.bucket_id)}/${parts.map(encodeURIComponent).join("/")}`;
    const response = await fetch(`${baseUrl}/storage/v1/object/${route}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        "content-type": object.metadata?.mimetype || "application/octet-stream",
        "x-upsert": "true",
      },
      body,
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Не удалось загрузить файл в хранилище ${object.bucket_id} (код ${response.status}).`);
    }
    done++;
  }
  console.log(`Загружено файлов: ${done} из ${manifest.objects.length}.`);
}

main().catch((error) => {
  console.error(`Ошибка восстановления файлов: ${error?.message || "неизвестная ошибка"}`);
  process.exit(1);
});
