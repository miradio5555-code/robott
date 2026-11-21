// =====================================================
// ULA FACTORY — сайт переехал на https://ulafactory.com.
//
// Старый адрес miradio5555-code.github.io/robott/… сам открывает ту же страницу на новом: путь, ?order=, ?c=,
// #/join и остальные части ссылки сохраняются, поэтому ссылки, которые уже есть у клиентов, продолжают работать.
// www.ulafactory.com → ulafactory.com: один адрес — один вход (вход хранится отдельно для каждого адреса).
//
// На старом адресе перед переходом отключаются его уведомления и офлайн-копия: иначе после включения уведомлений
// на новом адресе они приходили бы дважды. Уведомления включаются заново один раз — уже на ulafactory.com.
//
// Приложение iPhone (ULAFactoryApp) не перекидываем: оно открывает старый адрес, пока его не пересоберут
// с новым (mobile/capacitor.config.json), а переход на другой домен открыл бы Safari.
// Подключается первым в <head> всех страниц; встроенных скриптов нет (CSP).
// =====================================================
(function () {
  "use strict";
  var NEW = "https://ulafactory.com";
  var host = location.hostname, path;
  if (host === "www.ulafactory.com") path = location.pathname;
  else if (host === "miradio5555-code.github.io" && !/ULAFactoryApp/.test(navigator.userAgent || "")) path = location.pathname.replace(/^\/robott(?=\/|$)/, "") || "/";
  else return;
  var to = NEW + path + location.search + location.hash;
  try { document.documentElement.style.visibility = "hidden"; } catch (e) { /* ignore */ }
  var gone = false;
  function go() { if (!gone) { gone = true; location.replace(to); } }
  if (host === "www.ulafactory.com") return go();
  setTimeout(go, 1500);
  try {
    navigator.serviceWorker.getRegistrations().then(function (list) {
      return Promise.all(list.map(function (r) {
        return Promise.resolve(r.pushManager ? r.pushManager.getSubscription() : null)
          .then(function (s) { return s && s.unsubscribe(); })
          .catch(function () { /* ignore */ })
          .then(function () { return r.unregister(); });
      }));
    }).then(go, go);
  } catch (e) { go(); }
})();
