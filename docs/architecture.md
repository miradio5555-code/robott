# Архитектура сайта ULA Factory и план постепенного перехода к модулям

Решение (ADR, 18.11.2026): **полный переход на Vite / React / TypeScript одним переписыванием не делаем.** Сайт работает
у людей, открывается как приложение без сети (`sw.js`), публикуется на GitHub Pages без сборки и встроен в iOS-приложение.
Переписывание сломало бы всё это разом без регрессионных тестов на каждый экран. Вместо этого — постепенный переход
по одному файлу, под защитой проверок (`npm run check`, `npm run smoke`, `npm run test:db`).

## 1. Как устроено сейчас

- Статические файлы без сборки: `index.html` подключает **53 скрипта** по порядку (порядок — это и есть «сборка»).
- Общий объект `window.ULA`: `app.js` кладёт туда помощников (`ULA.core`), каждый файл из `js/` — свой раздел (`ULA.debts`, `ULA.wallet` …).
- Данные: Supabase (`supabase.js` — готовая библиотека 218 КБ, `config.js` — адрес проекта и публичный ключ). Правила доступа — в базе (RLS и функции).
- Тексты: `i18n.js` + словарь выбранного языка (`i18n.ru.js`, `en`, `zh`, `vi`), функция `t(ключ)`.
- Версия: `?v=` у каждого файла = `APP_VERSION` в `app.js`; меняется только `node scripts/set_version.js`.

### Порядок подключения и зависимости

```
head.js, boot.js            тема, защита от рамки, заставка, «страница не открылась»   (без зависимостей)
config.js                   window.CARGO_CONFIG
errors.js                   сбор ошибок сайта                                          (ULA.core — позже, лениво)
i18n.js                     t(), setLang(), I18N, currentLang                         (глобальные функции)
supabase.js                 window.supabase                                            (библиотека)
app.js                      ULA.core, состояние state, вход, заказы, клиенты, форма, карточка заказа
  └─ все js/*.js ниже       берут U.core при загрузке: var c = U.core
fx, alerts, device, adminedit, live, support, notify, icons, xlsx, analytics, inbox, business, bulk, onboarding,
tgws, notifyq, deadlines, tracking, daily, mfa, passkey, captcha, tour, recovery, shop, broadcast, tools, expenses,
exchange, board, import, requests, team, teamwork, teamtasks, teamorders, teamops, teamreports, shipments, report, debts, wallet, clientlinks, profile, game,
templates, clientcard, formsteps, quote, client
pwa.js                      регистрация sw.js и плашка «Вышло обновление»
```

Связи между разделами (кроме `U.core`): `teamtasks, teamorders, teamops, teamreports → teamwork` (раздел «Команда», файлы 67–71), `debts → notify`, `clientcard → debts, wallet, templates`, `app.js → tracking, deadlines,
wallet, clientlinks, game, templates` (через `ULA.x && ULA.x.fn`, поэтому отсутствие файла не ломает сайт), `tools → qrcode`
(подключается по требованию), `import → xlsx`.

### Глобальные имена

| Имя | Откуда | Кто пользуется |
|---|---|---|
| `t`, `setLang`, `getLang`, `applyI18n`, `I18N`, `LANGS`, `currentLang` | `i18n.js` | почти все файлы |
| `window.ULA` (`ULA.core`, `ULA.<раздел>`) | `app.js`, `js/*.js` | все |
| `window.CARGO_CONFIG` | `config.js` | `app.js` |
| `window.supabase` | `supabase.js` | `app.js` (создаёт клиента один раз) |
| `window.ULA_THEME` | `js/head.js` | `app.js`, `js/profile.js` |
| `window.qrcode` | `js/qrcode.js` (по требованию) | `js/tools.js` |

### Самые тяжёлые части

| Файл | Строк | Что внутри | Риск правки |
|---|---|---|---|
| `style.css` | ~5 000 | все стили, несколько слоёв дизайн-системы поверх старых правил | высокий: правило в конце перекрывает начало |
| `app.js` | ~4 000 | вход, состояние, заказы, клиенты, форма заказа, карточка, меню | высокий |
| `js/qrcode.js` | 2 297 | сторонняя библиотека (MIT) | не трогать |
| `index.html` | ~2 050 | вся разметка всех экранов и окон | средний |
| `js/exchange.js` | 1 696 | обмен валют: заявки, оплата, споры | высокий (деньги) |
| `js/client.js` | 861 | страница и кабинет клиента по ссылке | высокий (публичные данные) |
| `js/support.js`, `js/import.js` | ~700 | чат поддержки; загрузка из Excel | средний |

## 2. Что нельзя трогать без регрессионных тестов

| Часть | Почему | Какая проверка уже есть |
|---|---|---|
| Страница и кабинет клиента (`js/client.js`, публичные функции базы) | клиент не должен видеть себестоимость, прибыль, поставщика, заметки | `tests/db_checks.sql`, `cabinet_test`, `price_delivery_test`, smoke |
| Деньги: `moneyHtml`, `debts.js`, `wallet.js`, `exchange.js` | ошибка = неверный долг или баланс | SQL-тесты файлов 50, 56; `clientcard_test` |
| Форма заказа (`openOrderForm`, `readForm`, сохранение) | старые заказы, скрытые поля не должны стираться | `templates_test` (поля формы), smoke |
| `sw.js` | сломанный кеш = сайт не открывается у всех | `tests/sw_test.mjs` |
| Очередь уведомлений, `order_notify.js` | двойные сообщения клиентам | `notify_queue_test`, `notify_worker_test` |
| Порядок скриптов в `index.html` | файл раньше `app.js` не найдёт `U.core` | `check_static` (подключён ровно один раз), smoke (ошибки скриптов) |

## 3. План перехода (по шагам, каждый — отдельный PR)

1. **Готово:** единая проверка `npm run check`, статический анализ (`tests/check_static.js`), экраны (`npm run smoke`), CI.
2. **JSDoc и `// @ts-check` по одному файлу**, начиная с чистых функций без страницы: `js/templates.js`, `js/clientcard.js`
   (`summarize`), `import.analyze`, `tracking.transit`. Проверка типов — `deno check` или `tsc --noEmit --allowJs` в CI
   без изменения файлов, которые выкладываются. Описать тип заказа (`Order`) один раз в `docs/types.d.ts`.
3. **Вынести чистую логику из `app.js`** в отдельные файлы с тестами: расчёт денег формы (`updateCalc`), `missingFields`,
   фильтры списка заказов. `app.js` только вызывает их.
4. **ES-модули без сборщика:** `<script type="module">` для новых файлов; старые остаются как есть. `ULA.core` остаётся мостом.
   Перед этим — проверка в Safari iOS 15+ и в WebView приложения.
5. **Сборка (Vite) — только когда** ≥ 70 % логики покрыто тестами и модулями. Сборка должна выдавать те же имена файлов
   с `?v=` (или манифест для `sw.js`) и не ломать `mobile/copy-web.sh`.
6. **CSS:** не переписывать целиком. Новые правила — в конце блоками с комментарием; со временем свести слои в токены (`--…`).

## 4. Правила для новых файлов

- Файл — один раздел: `(function (U) { … U.имя = { … }; })(window.ULA)`; подключить в `index.html` после `app.js`.
- Логику, которую можно проверить без страницы, писать отдельной функцией и экспортировать (`summarize`, `analyze`, `repeat`) — для теста в `tests/`.
- Тексты — только через `t("ключ")`, ключ во всех четырёх словарях (проверяет `check_web` и `check_static`).
- Новый файл в корне сайта — добавить в `mobile/copy-web.sh` (иначе `--check` и CI упадут).
- Версию не менять руками: `node scripts/set_version.js`.

## 5. iOS-приложение

`mobile/capacitor.config.json` → `server.url` = адрес сайта: приложение открывает **живой сайт**, а копия в `mobile/www`
нужна для экрана «нет интернета» и как запасной вариант. Цепочка: файлы сайта → `bash mobile/copy-web.sh` → `mobile/www`
→ `npx cap copy ios` → `mobile/ios/App/App/public` (папка записана в проект Xcode как ресурс, поэтому **нужна**, но в git не хранится).
Всё сразу: `npm run ios:prepare`. Проверка без записи: `npm run mobile:check`.
