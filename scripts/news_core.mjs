// Сбор «Свежих новостей дня» для карты фабрик (только администратор). Общая часть для двух мест:
//   • worker/index.js — каждое утро на Cloudflare (07:00–07:54 по Бишкеку, по одной ленте), подборка — ulafactory.com/news.json;
//   • scripts/fetch_news.mjs — то же вручную на компьютере (проверить ленты, посмотреть результат).
// Берёт открытые ленты Google Новостей на русском по двум темам (электронная торговля, экономика) и пяти регионам,
// убирает повторы и рекламные «прогнозы рынка», сохраняет заголовок, источник, дату и ссылку.
// Текст статей не копируется — только ссылка на источник. Ключи и пароли не нужны. В рабочую базу ничего не пишет.

export const REGIONS = { china: "Китай", europe: "Европа", usa: "США", "central-asia": "Средняя Азия", sea: "Юго-Восточная Азия" };
export const THEMES = { ecommerce: "Электронная торговля", economy: "Экономика" };

const QUERIES = {
  ecommerce: {
    china: "маркетплейсы Китая OR электронная коммерция Китай OR Temu OR AliExpress OR Pinduoduo OR Taobao OR 1688",
    europe: "электронная торговля Европа OR маркетплейсы ЕС OR посылки из Китая Евросоюз OR пошлины на посылки ЕС",
    usa: "электронная коммерция США OR Amazon маркетплейс OR посылки из Китая США OR пошлины на посылки США",
    "central-asia": "маркетплейс Кыргызстан OR маркетплейс Казахстан OR маркетплейс Узбекистан OR Wildberries Кыргызстан OR Kaspi OR Uzum OR электронная торговля Центральная Азия",
    sea: "Shopee OR Lazada OR TikTok Shop OR электронная коммерция Вьетнам OR электронная коммерция Индонезия OR электронная коммерция Юго-Восточная Азия"
  },
  economy: {
    china: "экономика Китая OR экономика КНР OR внешняя торговля Китая OR юань",
    europe: "экономика Европы OR экономика Евросоюза OR еврозона OR ЕЦБ",
    usa: "экономика США OR ФРС OR пошлины США",
    "central-asia": "экономика Кыргызстана OR экономика Казахстана OR экономика Узбекистана OR экономика Таджикистана OR экономика Центральной Азии",
    sea: "экономика Вьетнама OR экономика Индонезии OR экономика Таиланда OR экономика Малайзии OR АСЕАН"
  }
};

const PER_GROUP = 15; // не больше 15 новостей на тему и регион
const MAX_AGE_DAYS = 3;
// Платные отчёты «рынок … до 2035 года» и подобное — не новости.
const SKIP_SOURCES = /indexbox/i;
const SKIP_TITLES = /до 20[3-9]\d года|прогноз рынка|обзор рынка|анализ рынка|размер рынка/i;

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };
const key = (t) => t.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, " ").trim().slice(0, 90);

async function feed(query) {
  const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(`${query} when:2d`) + "&hl=ru&gl=RU&ceid=RU:ru";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (news digest)" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw Error("HTTP " + res.status);
      const xml = await res.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
        const source = tag(m[1], "source");
        let title = tag(m[1], "title");
        if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3)).trim();
        const date = new Date(tag(m[1], "pubDate"));
        return { title, source, url: tag(m[1], "link"), date };
      });
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

// Тема и регион определяются по заголовку, а не по запросу: лента Google отдаёт и случайные совпадения.
// Новость без признаков темы и региона в подборку не попадает.
// Каждое слово ищется с начала слова (иначе «ставк» находится в «выставке», «евро» — в «Европе»);
// «>» в конце — слово должно и закончиться здесь («ес>» — это ЕС, а не «если»).
const words = (list) => new RegExp(list.map((w) => `(?<![\\p{L}\\p{N}])(?:${w.replace(/>$/, "")})${w.endsWith(">") ? "(?![\\p{L}\\p{N}])" : ""}`).join("|"), "iu");
const BRANDS = ["temu", "aliexpress", "pinduoduo", "taobao", "1688", "alibaba", "shein", "jd\\.com", "wildberries", "ozon", "kaspi", "uzum", "amazon", "walmart", "ebay", "shopee", "lazada", "tokopedia", "tiktok shop", "grab>"];
const THEME_WORDS = {
  ecommerce: words(["маркетплейс", "электронн\\S* (торгов|коммерц)", "e-?commerce", "онлайн-?(торгов|продаж|покуп|ритейл|магазин)", "интернет-?(торгов|магазин|продаж)", "посылк", "трансграничн\\S* (торгов|электрон)", "кросс-?бордер", ...BRANDS]),
  economy: words(["экономик", "экономическ", "ввп>", "инфляц", "ставк", "пошлин", "тариф", "торгов", "внешнеторгов", "экспорт", "импорт", "инвестиц", "бюджет", "валют", "юан", "доллар", "евро>", "рубл", "тенге>", "рын(ок|ка|ке|ки|ков)>", "промышлен", "производств", "банк", "налог", "санкц", "кредит", "цен(а|ы|у|ах|ам)?>", "нефт", "логистик", "фрс>", "ецб>", "мвф>", "вто>"])
};
const REGION_WORDS = {
  "central-asia": words(["кыргыз", "киргиз", "казах", "узбек", "таджик", "туркмен", "центральн\\S* ази", "ца>", "бишкек", "алмат", "астан", "ташкент", "душанбе", "еаэс>", "kaspi", "uzum"]),
  china: words(["кита", "кнр>", "пекин", "шанхай", "гуандун", "шэньчжэн", "гонконг", "юан", "temu", "aliexpress", "pinduoduo", "taobao", "1688", "alibaba", "shein", "jd\\.com"]),
  sea: words(["вьетнам", "индонез", "таиланд", "малайз", "филиппин", "сингапур", "камбодж", "лаос", "мьянм", "асеан", "юго-восточн", "shopee", "lazada", "tokopedia", "grab>"]),
  europe: words(["европ", "ес>", "евросоюз", "еврозон", "ецб>", "брюссел", "герман", "франц", "итал", "испан", "польш", "нидерланд", "британ", "великобрит"]),
  usa: words(["сша>", "америк", "вашингтон", "фрс>", "трамп", "amazon", "walmart", "ebay"])
};
const classify = (title, region) => {
  const theme = THEME_WORDS.ecommerce.test(title) ? "ecommerce" : THEME_WORDS.economy.test(title) ? "economy" : null;
  const found = REGION_WORDS[region].test(title) ? region : Object.keys(REGION_WORDS).find((r) => REGION_WORDS[r].test(title));
  return theme && found ? { theme, region: found } : null;
};

// Все пары «тема / регион» по порядку: Cloudflare собирает по одной паре за запуск (см. worker/index.js).
export const GROUPS = Object.keys(QUERIES).flatMap((theme) => Object.keys(QUERIES[theme]).map((region) => [theme, region]));

// Одна лента: подходящие новости (уже с темой и регионом) или ошибка. Повторы убирает assemble().
export async function fetchGroup(theme, region, now = Date.now()) {
  let list;
  try { list = await feed(QUERIES[theme][region]); } catch (e) { return { items: [], error: `${THEMES[theme]} / ${REGIONS[region]}: ${e.message}` }; }
  const items = [];
  for (const n of list) {
    if (!n.title || !/^https:\/\//.test(n.url) || isNaN(n.date) || now - n.date > MAX_AGE_DAYS * 864e5) continue;
    if (SKIP_SOURCES.test(n.source) || SKIP_TITLES.test(n.title)) continue;
    const kind = classify(n.title, region);
    if (!kind) continue;
    items.push({ title: n.title.slice(0, 300), source: n.source.slice(0, 80), url: n.url, publishedAt: n.date.toISOString(), ...kind });
  }
  return { items };
}

// Подборка из результатов лент (в порядке GROUPS): без повторов, не старше MAX_AGE_DAYS, до PER_GROUP на тему и регион.
// Возвращает { updatedAt, regions, themes, failed, items }; items пустой — не ответила ни одна лента.
export function assemble(results, now = Date.now(), log = () => {}) {
  const seen = new Set();
  const pool = [];
  const failed = [];
  for (const r of results) {
    if (r.error) failed.push(r.error);
    for (const n of r.items || []) {
      if (now - new Date(n.publishedAt) > MAX_AGE_DAYS * 864e5) continue;
      const k = key(n.title);
      if (seen.has(k)) continue;
      seen.add(k);
      pool.push(n);
    }
  }
  pool.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const items = [];
  for (const theme of Object.keys(THEMES)) for (const region of Object.keys(REGIONS)) {
    const group = pool.filter((n) => n.theme === theme && n.region === region).slice(0, PER_GROUP);
    items.push(...group);
    log(`${THEMES[theme]} / ${REGIONS[region]}: ${group.length}`);
  }
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return { updatedAt: new Date(now).toISOString(), regions: REGIONS, themes: THEMES, failed, items };
}

// Вся подборка за один раз (для запуска на компьютере).
export async function collectNews(log = () => {}) {
  const now = Date.now();
  const results = [];
  for (const [theme, region] of GROUPS) results.push(await fetchGroup(theme, region, now));
  return assemble(results, now, log);
}
