#!/usr/bin/env node
// Свежие новости дня вручную: собрать подборку на компьютере и сохранить в файл (проверить ленты, посмотреть результат).
// На сайте подборку каждый день собирает Cloudflare (worker/index.js); сам сбор — в scripts/news_core.mjs.
//
//   node scripts/fetch_news.mjs <файл.json>
// Если не ответила ни одна лента — выходит с ошибкой и файл не трогает.

import fs from "node:fs";
import { collectNews } from "./news_core.mjs";

const OUT = process.argv[2];
if (!OUT) { console.error("Укажите файл: node scripts/fetch_news.mjs news.json"); process.exit(2); }

const data = await collectNews(console.log);
if (!data.items.length) {
  console.error("Ни одна лента не ответила — файл не изменён.\n" + data.failed.join("\n"));
  process.exit(1);
}
fs.writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n");
console.log(`Сохранено: ${data.items.length} новостей → ${OUT}${data.failed.length ? `\nНе ответили: ${data.failed.length}\n${data.failed.join("\n")}` : ""}`);
