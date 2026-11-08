// =====================================================
// ULA FACTORY — «приложение»: сайт открывается сразу, без ожидания сети.
//
//   • Файлы сайта (скрипты, стили, шрифты, картинки) хранятся в телефоне.
//     У каждого файла в адресе есть версия (?v=…): новая версия — новый адрес,
//     поэтому старый файл никогда не перепутается с новым.
//   • Сама страница (index.html) открывается из памяти мгновенно, а в фоне
//     проверяется свежая. Если вышло обновление — сайт покажет кнопку «Обновить».
//   • Данные (заказы, клиенты) сюда НЕ попадают: запросы к Supabase идут мимо,
//     всегда напрямую и всегда свежие.
//   • Нет интернета — сайт всё равно откроется (данные подгрузятся, когда появится сеть).
// =====================================================
"use strict";

var CACHE = "ula-v1";
var PAGE = "./";

// При установке: сохранить страницу и все файлы, которые она подключает
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return fetch(PAGE, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) return;
        return r.clone().text().then(function (html) {
          // Страницу сохраняем только вместе с её файлами, иначе офлайн она будет без оформления.
          return c.addAll(assetsOf(html)).then(function () { return c.put(PAGE, r); }).catch(function () {});
        });
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

// Старые копии (другое имя CACHE) удалить
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf("ula-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Список файлов из index.html: всё, что подключено с ?v=, плюс шрифты и supabase.js
function assetsOf(html) {
  var out = {}, m, re = /(?:src|href)="([^"]+)"/g;
  while ((m = re.exec(html))) {
    var u = m[1];
    if (/^(https?:|data:|#|mailto:)/.test(u)) continue;
    if (/\?v=|^fonts\/|^img\/|^supabase\.js$|^manifest\.webmanifest$/.test(u)) out[u] = 1;
  }
  return Object.keys(out);
}

function versionOf(html) {
  var m = /\?v=([0-9a-zA-Z]+)/.exec(html || "");
  return m ? m[1] : "";
}

// Пришло push-уведомление от сервера (сайт может быть закрыт)
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { /* ignore */ }
  e.waitUntil(self.registration.showNotification(d.title || "ULA Factory", {
    body: d.body || "", tag: d.tag || "ula", renotify: true, icon: "img/icon-192.png", badge: "img/icon-192.png"
  }));
});

// Нажали на уведомление — открыть сайт (или вернуться в уже открытый)
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
    return self.clients.openWindow("./");
  }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, курс валют, капча — мимо

  var base = new URL(self.registration.scope).pathname;
  var path = url.pathname.indexOf(base) === 0 ? url.pathname.slice(base.length) : url.pathname;

  // Страница сайта (любые ссылки: ?o=…, ?xr=… — это тот же index.html).
  // terms.html, privacy.html и прочие страницы — как обычно, из сети.
  if (req.mode === "navigate") {
    if (path === "" || path === "index.html") e.respondWith(openPage(e));
    return;
  }

  // Файлы с версией, шрифты, картинки: из памяти, а если нет — из сети и запомнить
  if (url.search.indexOf("v=") !== -1 || /^(fonts|img)\//.test(path) || path === "supabase.js") {
    e.respondWith(
      caches.open(CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          return hit || fetch(req).then(function (r) {
            if (r.ok) c.put(req, r.clone());
            return r;
          });
        });
      })
    );
  }
});

// Страница: сразу из памяти; в фоне — свежая. Вышла новая версия — сообщить вкладке.
function openPage(e) {
  var cache = caches.open(CACHE);
  var hit = cache.then(function (c) { return c.match(PAGE); }).then(function (r) {
    // Отдельная копия нужна, пока открытая вкладка читает прежнюю страницу.
    return r ? { response: r, copy: r.clone() } : null;
  });
  var fresh = fetch(PAGE, { cache: "no-cache" }).then(function (r) {
    return { response: r, page: r.clone(), html: r.clone() };
  });
  // Обновление кеша идёт в фоне; старые файлы остаются для уже открытых вкладок.
  var update = Promise.all([cache, hit, fresh]).then(function (items) {
    var c = items[0], old = items[1], f = items[2];
    if (!f.response.ok) return;
    return Promise.all([f.html.text(), old ? old.copy.text() : ""]).then(function (texts) {
      var nv = versionOf(texts[0]), ov = versionOf(texts[1]);
      if (old && nv === ov) return c.put(PAGE, f.page);
      // Сначала скачиваем все файлы, только потом меняем сохранённую страницу.
      return c.addAll(assetsOf(texts[0])).then(function () { return c.put(PAGE, f.page); }).then(function () {
        if (!old || !nv || nv === ov) return;
        return self.clients.get(e.resultingClientId || e.clientId).then(function (cl) {
          if (cl) cl.postMessage({ type: "ula-update", version: nv });
        });
      });
    });
  });
  e.waitUntil(update.catch(function () {}));
  return hit.then(function (old) {
    if (old) return old.response;
    return fresh.then(function (f) { return f.response; }).catch(function () { return new Response("Offline", { status: 503 }); });
  });
}
