// =====================================================
// ULA FACTORY — сайт на Cloudflare (ulafactory.com).
//
// Страницы, скрипты, стили и картинки Cloudflare отдаёт сам из папки dist (wrangler.jsonc → assets):
// этот файл для них не запускается и ничего в них не меняет.
// Здесь только «Свежие новости дня» для «Карты фабрик» (раздел видит лишь администратор):
//
//   • Каждое утро в 07:00–07:54 по Бишкеку (01:00–01:54 UTC) — 10 коротких запусков раз в 6 минут,
//     в каждом одна лента «тема / регион» (scripts/news_core.mjs). Так каждый запуск укладывается
//     в лимит бесплатного тарифа Cloudflare. Результат ленты хранится в KV (NEWS) под ключом group:<номер>.
//   • После каждого запуска подборка собирается заново из последних результатов всех 10 лент
//     и кладётся в KV под ключом news. Лента не ответила — остаются её прошлые новости (не старше 3 дней).
//   • GET /news.json — эта подборка. Только заголовки, источники и ссылки из открытых лент Google Новостей:
//     ничего из базы, заказов и данных команды здесь нет. Ключи и пароли не нужны.
//
// Проверить вручную: node scripts/fetch_news.mjs news.json (то же самое на компьютере).
// =====================================================
import { GROUPS, fetchGroup, assemble } from "../scripts/news_core.mjs";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=300",
  // Приложение iPhone до пересборки открывает карту со старого адреса (github.io) — ему тоже нужно прочитать подборку.
  "access-control-allow-origin": "*",
  "x-content-type-options": "nosniff"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/news.json" && (request.method === "GET" || request.method === "HEAD")) {
      const body = await env.NEWS.get("news");
      if (!body) return new Response('{"error":"Подборки пока нет"}', { status: 404, headers: { ...JSON_HEADERS, "cache-control": "no-store" } });
      return new Response(request.method === "HEAD" ? null : body, { headers: JSON_HEADERS });
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env) {
    const at = new Date(event.scheduledTime);
    const n = Math.floor(at.getUTCMinutes() / 6);
    if (n >= GROUPS.length) return;
    const [theme, region] = GROUPS[n];
    const result = await fetchGroup(theme, region, at.getTime());
    if (result.error) {
      // лента не ответила: прошлые новости этой ленты остаются, отмечаем ошибку
      const old = JSON.parse((await env.NEWS.get("group:" + n)) || "null");
      result.items = old ? old.items : [];
    }
    await env.NEWS.put("group:" + n, JSON.stringify({ ...result, at: at.toISOString() }));

    const stored = await Promise.all(GROUPS.map((_, i) => env.NEWS.get("group:" + i)));
    // Пока не собраны все 10 лент (первое утро после включения) — подборку не трогаем.
    if (stored.some((s) => !s)) return;
    const news = assemble(stored.map((s) => JSON.parse(s)), at.getTime());
    if (news.items.length) await env.NEWS.put("news", JSON.stringify(news));
  }
};
