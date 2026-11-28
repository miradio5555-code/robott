# Карта проекта ULA Factory

Это карта, чтобы быстро найти нужное место без чтения больших файлов. Подробности по базе лежат в `DATABASE.md`, по выкладке — в `RELEASE_CHECKLIST.md`, обзор для людей — в `README.md`.

**Как искать.** Номера строк меняются, поэтому ищите не по строке, а по якорю: имени функции, комментарию раздела, `id` или ключу i18n.
Пример: `grep -n "function renderChat" js/exchange.js`. Большие файлы (`app.js`, `index.html`, `style.css`, `i18n.*.js`, `js/exchange.js`) открывайте частями (`offset`/`limit`).

## Устройство одной строкой
Сайт написан на чистом JS без сборщика: страница `index.html`, ядро `app.js` и модули `js/*.js`. Модули — это IIFE вида `(function (U) {...})(window.ULA)`, общие помощники берутся из `U.core`. База — Supabase (Postgres, RLS, RPC с `security definer`). Сайт выкладывается на Cloudflare из папки `dist`, серверные функции живут в `supabase/functions`. Политика безопасности (CSP) задана в `<meta>` в `index.html`: скрипты подключаются только своими файлами, инлайн-скрипты и `onclick=` запрещены; стили `'unsafe-inline'` разрешены. Если сайт обращается к новому внешнему адресу, его нужно добавить в `connect-src`.

## Корень
| Файл | Что в нём | Якоря |
|---|---|---|
| `index.html` (~2.5k строк) | Вся разметка: экраны `view-*`, разделы кабинета `tab-*`, окна `modal-*`. Скрипты подключены внизу с `?v=ВЕРСИЯ`. | `<!-- ============ РАЗДЕЛ: … -->`, `<!-- ============ ОКНО: … -->`, `id="view-home|login|join|admin|client|shop|request"` |
| `app.js` (~4.1k) | Ядро: вход, кабинет, заказы, разбор адреса (`?order` `?c` `?shop` `?xr` `?fx` `?request`), `miniClient` для клиентских страниц, `U.core`. | `function init(`, `function showView(`, `function switchTab(`, `get("xr")`, `APP_VERSION` |
| `style.css` (~5.9k) | Все стили. Цвета задаются токенами в `:root`, тёмная тема — `html[data-theme="dark"]`. | Блоки `/* ===== Название ===== */`; чат обмена — `.xc-`; чат поддержки — `.sp-`; главная — `.lp-` |
| `config.js` | Ключи Supabase (публичные), контакты, `EXCHANGE_LINK` (ссылка обмена ULA для гостей на главной). | `SUPABASE_URL`, `CONTACT_*`, `EXCHANGE_LINK` |
| `i18n.js` + `i18n.{ru,en,zh,vi}.js` | Переводы: функция `t(key, {vars})` и словари. Новые ключи дописываются в конец файла как `I18N.xx.key = "…";`. Каждый ключ должен быть во всех 4 файлах (это проверяет `check_web`). | `grep -n "xc_\|fx_\|lp_" i18n.ru.js` |
| `sw.js` | Service worker: кэш по версии, push (`addEventListener("push"`), клик по уведомлению. | `notificationclick` |
| `supabase.js` | Обёртка над библиотекой Supabase. | |
| `supabase_schema.sql` | Схема базы, номер 0. | |
| `migration_NN_*.sql` | Изменения базы по порядку, сейчас 01–77. Номер следующего файла записан в `DATABASE.md`. | |
| `privacy.html`, `terms.html` | Юридические страницы. Версия в них меняется вместе с сайтом. | |
| `wrangler.jsonc`, `worker/index.js`, `_headers` | Cloudflare: выкладывается только `dist`, воркер собирает новости для «Карты фабрик», `_headers` задаёт срок кэша и `frame-ancestors`. | |
| `manifest.webmanifest` | Настройки PWA. | |

## Модули `js/` (все подключаются после `app.js`)
**Кабинет байера**
| Модуль | Раздел |
|---|---|
| `exchange.js` (~2.2k) | «Обмен сом → юань»: курс ULA для байеров, свой курс для клиентов, заявки, P2P-сделка, споры, проверка личности. Здесь же клиентские страницы `?fx=` (форма заявки) и `?xr=` (статус и чат), а также чат по заявке (файлы 76–77). Якоря: `function initPage`, `function initStatus`, `function statusHtml`, `function renderChat`, `function clientChatSend`, `function chatListHtml`, `function rowHtml`, `function openChat`, `function refreshChat`, `function buyerSend`, `function loadCount`, `function homeHtml` (карточка курса на главной кабинета). |
| `board.js` | Главная кабинета: новости платформы и курс ULA. |
| `daily.js` | «Что сделать сегодня», ежедневная работа (файл 59). |
| `deadlines.js` | Сроки, задачи, напоминания (файл 58). |
| `requests.js` | Заявки клиентов по ссылке на товар. |
| `shop.js` | Витрина байера (`?shop=`). |
| `shipments.js` | Партии (несколько заказов одним карго). |
| `debts.js`, `wallet.js` | Долги клиентов и баланс клиента (файл 50). |
| `report.js`, `analytics.js`, `expenses.js` | Отчёт о прибыли, дашборд, расходы. |
| `quote.js`, `fx.js`, `tools.js` | Расчёт цены для клиента, курсы валют, инструменты (объёмный вес, PDF-счёт, этикетки с QR). |
| `clientcard.js`, `clientlinks.js` | Карточка клиента и «Совпадения клиентов» (файл 56). |
| `notify.js`, `notifyq.js`, `broadcast.js`, `tgws.js` | «Сообщить клиенту», очередь уведомлений, рассылка в WhatsApp, Telegram кабинета. |
| `inbox.js` | «Сообщения» WhatsApp: диалоги, расчёт клиенту. Тексты лежат внутри файла (`labels`), а не в `i18n`. |
| `bulk.js`, `templates.js`, `import.js`, `xlsx.js`, `formsteps.js` | Массовая смена статуса, шаблоны заказа, импорт из Excel/CSV, выгрузка в Excel, формы шагами. |
| `team.js`, `teamwork.js`, `teamtasks.js`, `teamorders.js`, `teamops.js`, `teamreports.js` | Раздел «Команда» (файлы 67–71). |
| `goals.js` | «Мои цели» (файл 72). |
| `profile.js`, `onboarding.js`, `tour.js`, `game.js` | Профиль, подсказки новичку, тур по кабинету, игра. |
| `support.js` | Живой чат «байер ↔ админ» (`.sp-`), уведомления в Telegram. |
| `alerts.js` | Звук, вибрация, push-подписка: `U.alerts.ping`, `U.alerts.push`, карточка «Включить уведомления». |
| `live.js` | Живое обновление кабинета. |

**Для администратора:** `adminedit.js` (режим правки чужого кабинета), `business.js` (бизнес-обзор, цифры считает база), `errors.js` (ошибки у пользователей).

**Клиентские страницы и гость:** `client.js` (заказ `?order=`, кабинет клиента `?c=`, в нём блок обмена), `tracking.js` (путь заказа из 10 этапов), `home.js` (главная для гостя: курс, калькулятор, кнопка «Обменять юани» → `?fx=…&cny=`).

**Вход и безопасность:** `captcha.js`, `mfa.js` (2FA), `passkey.js`, `recovery.js`, `device.js`.

**Служебные:** `head.js` (запуск в `<head>`), `boot.js` (сайт не открылся), `pwa.js`, `move.js`, `icons.js` (`U.icon(name, size)`, набор иконок перечислен в файле), `qrcode.js` (сторонняя библиотека).

## Серверные функции `supabase/functions/`
| Функция | Что делает |
|---|---|
| `telegram-notify` | Шлёт в Telegram: поддержку админу, заявки и события обмена байеру (`exchange_notify`, `exchange_paid`, `exchange_event`, в том числе сообщения чата), страницу заказа клиенту. |
| `push-notify` | Web-push. Об обмене (`exchange`, `exchange_paid`, `exchange_msg`) — владельцу кабинета и сотрудникам с правом `orders.all`; также поддержка, проверка личности, заявки на товар. |
| `order-notify-worker` | Очередь уведомлений клиентам о статусах заказов (файл 57). |
| `ai-assistant`, `photo-orders`, `whatsapp-ai` | ИИ-помощник, заказы по фото, ИИ для WhatsApp. |
| `_shared/` | Общий код функций. |

Настройки входа функций — в `supabase/config.toml`.

## База (подробно — `DATABASE.md`)
**Обмен**
- `exchange_requests`: заявки. Есть столбцы `chat_buyer_seen` и `chat_client_seen`.
- `exchange_events`: события сделки и сообщения чата (`kind = 'msg'`), отметка `push_at`.
- `platform_fx`: курс ULA. История курса — `platform_fx_history`.
- `fx_kyc`: проверка личности байера.
- Хранилища: `fx-proofs` (закрытое: чеки и фото клиента `c-…`/`d-…`), `fx-sent` (открытое: фото обменника).
- RPC:
  - клиентские страницы: `get_shop`, `submit_exchange`, `fx_attach_proof`, `get_exchange_status`;
  - чат: `fx_chat_post`, `fx_chat_seen`, `fx_chat_unread`;
  - споры: `fx_dispute_open`, `fx_dispute_post`;
  - курс на главной для гостя: `public_fx`.

**Права**
- `is_member(ws)` — владелец или сотрудник с правом `orders.all` (`_ws_full`).
- `is_admin()` — администратор платформы.
- `fx_who(ws)` возвращает `'buyer'`, `'admin'` или `'client'`.

## Тесты `tests/`
| Команда | Что проверяет |
|---|---|
| `npm run check` | Быстрые проверки, 10 штук: синтаксис, словари, версия, номера миграций в документах, статический анализ, sw, функции (Deno). |
| `npm run smoke` | Около 142 экранов на 4 ширинах в Chrome. Стенд — `tests/browser/server.mjs` с поддельной базой (`fake_supabase.js`). Сценарий выбирается `?scn=…`. |
| `bash tests/run_db_tests.sh` | Все SQL на временном Postgres в Docker плюс `db_checks.sql` и тесты по файлам (например, `exchange_chat_test.sh`). |

**Стенд** (`npm run stand`, порт 8765). Чат обмена смотрится так:
- `?xr=11111111-2222-4333-8444-555555555555&new=1` — новая заявка без сообщений;
- `…556` — идёт переписка;
- `?scn=fxchat` — кабинет обменника с непрочитанными сообщениями.

**Без Docker** SQL проверяется через PGlite. Во временной папке выполните `npm i @electric-sql/pglite` и напишите скрипт, который по порядку применяет: `tests/supabase_stub.sql`, затем `supabase_schema.sql`, затем `insert into public.admins …` (из `run_db_tests.sh`), затем миграции и SQL-блоки `<<'SQL'` из нужного теста. Строки psql, начинающиеся с `\`, нужно убрать, а `\gset` заменить на `;`. Разделы 1–27 `db_checks.sql` на PGlite проходят, раздел 28 падает из-за временной таблицы — это особенность PGlite, а не ошибка в базе.

## Скрипты `scripts/`
- `set_version.js ВЕРСИЯ` — меняет `?v=` во всех нужных файлах.
- `build_site.sh` — собирает `dist`.
- `release_check.sh` — проверка перед выпуском.
- Копии базы: `make_backup.sh`, `backup_/restore_supabase_storage.mjs`.
- `diagnose_supabase_readonly.sql` — диагностика базы только на чтение.
- `fetch_news.mjs`, `news_core.mjs` — новости для «Карты фабрик».
- `landing_shots.mjs` и `og-card.html` — снимки главной и картинка превью ссылки.

## Прочее
- `factory-map/` — «Карта фабрик», отдельная страница администратора.
- `mobile/` — оболочка iOS на Capacitor (`copy-web.sh` копирует сайт в `www`).
- `integrations/whatsapp/` — Python-шлюз WhatsApp.
- `docs/` — архитектура, модель CRM, финансовая модель, аудит, путь заказа.
- `.github/workflows/checks.yml` — проверки GitHub (джобы Сайт, Приложение, Экраны, База). Запускаются на `pull_request` и `push` в `main`.
