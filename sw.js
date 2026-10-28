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
          return c.put(PAGE, r).then(function () { return c.addAll(assetsOf(html)).catch(function () {}); });
        });
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

// Старые копии (другое имя CACHE) удалить
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
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

// Файлы прошлых версий (?v=старая) больше не нужны — удалить, чтобы не занимали место
function dropOld(c, html) {
  var v = versionOf(html);
  return c.keys().then(function (reqs) {
    return Promise.all(reqs.filter(function (r) {
      var m = /[?&]v=([0-9a-zA-Z]+)/.exec(r.url);
      return m && m[1] !== v;
    }).map(function (r) { return c.delete(r); }));
  });
}

function versionOf(html) {
  var m = /\?v=([0-9a-zA-Z]+)/.exec(html || "");
  return m ? m[1] : "";
}

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
  return caches.open(CACHE).then(function (c) {
    return c.match(PAGE).then(function (hit) {
      var old = hit ? hit.clone() : null; // копия: сам hit уйдёт на экран
      var fresh = fetch(PAGE, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) return r;
        var copy = r.clone();
        return Promise.all([copy.text(), old ? old.text() : ""]).then(function (t) {
          var nv = versionOf(t[0]);
          return c.put(PAGE, r.clone()).then(function () {
            if (hit && nv && nv !== versionOf(t[1])) {
              // заранее скачать файлы новой версии, потом предложить обновить
              var keep = assetsOf(t[0]);
              return c.addAll(keep).catch(function () {}).then(function () { return dropOld(c, t[0]); }).then(function () {
                return self.clients.get(e.resultingClientId || e.clientId);
              }).then(function (cl) {
                if (cl) cl.postMessage({ type: "ula-update", version: nv });
              });
            }
          }).then(function () { return r; });
        });
      });
      if (hit) {
        e.waitUntil(fresh.catch(function () {}));
        return hit;
      }
      return fresh.catch(function () { return new Response("Offline", { status: 503 }); });
    });
  });
}
