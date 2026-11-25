# ULA Factory — памятка для Claude

**Сначала откройте `INDEX.md`.** Это карта проекта: где лежат файлы, модули, функции, тесты и какие у них якоря для поиска. Большие файлы (`app.js`, `index.html`, `style.css`, `i18n.*.js`, `js/exchange.js`) целиком не читать: ищите `grep -n` по якорю и открывайте нужный кусок через `offset`/`limit`.

Пользователь пишет по-русски, отвечать тоже по-русски, просто и без жаргона. Если можете сделать сами, делайте сами.

## Как вносить изменения
1. Работать в отдельной ветке `feat/…` от `main`. Коммит и push, затем PR. В описании PR в конце строка «🤖 Generated with [Claude Code](https://claude.com/claude-code)». `gh` не установлен, поэтому PR создаётся и вливается через GitHub в Chrome пользователя.
2. Меняется сайт (js, css, html, i18n) — поднять версию: `node scripts/set_version.js 2026MMDDx`. Без новой версии браузер и service worker покажут старое.
3. Новый текст на экране — ключ во всех четырёх `i18n.{ru,en,zh,vi}.js`.
4. Изменение базы делается только новым файлом `migration_NN_….sql` со следующим номером. Образец — `migration_76_exchange_chat.sql`: `begin`, защита «СТОП», `revoke`/`grant`, у каждой функции `set search_path`, в конце `schema_migrations`, `commit`. Затем обновить «Последний файл / следующий номер» в `DATABASE.md`, строку в таблице `README.md` и `RELEASE_CHECKLIST.md`. Тест — `tests/*_test.sh`, подключённый в `tests/run_db_tests.sh`.
5. Перед коммитом: `npm run check`, это 10 проверок. Если менялся интерфейс, ещё `npm run smoke` и экран на стенде (`ula-test-stand`, порт 8765, сценарий `?scn=`).

## Выкладка (продакшн)
- **Сайт.** Только одной командой, иначе уйдёт старая сборка `dist`:
  ```bash
  bash scripts/build_site.sh && npx wrangler@4 deploy
  ```
  Классификатор обычно блокирует выкладку, поэтому команду запускает пользователь. На вопрос npx «Ok to proceed? (y)» он отвечает `y`.
- **Миграция в рабочую базу.** Вставить текст в Supabase SQL Editor (вкладка Chrome, через Monaco `setValue`) и сверить хэш. **Run** нажимает пользователь.
- **Проверить рабочую базу только на чтение:**
  ```bash
  npx --yes supabase@3.2.0 db query --remote=gjybwrvllxlafkxybstg --read-only "select …"
  ```
- **Функция.** `npx supabase functions deploy <имя> --project-ref gjybwrvllxlafkxybstg`. В интерактивном вопросе по умолчанию выбрано **No**: нужно нажать ←, затем Enter. Вместо этого можно добавить `--yes`.
- **Проверки GitHub.** Публичный API `actions/runs?head_sha=` опрашивать не чаще раза в 2 минуты, иначе кончится лимит в 60 запросов в час.

## Ловушки
- В SQL `x = 'open'` при `x = null` даёт `null`, а `not null` в `if` не срабатывает. В условиях доступа используйте `coalesce`.
- Клиентские страницы (`?xr` `?fx` `?order` `?c` `?shop` `?request`) работают без входа через `miniClient`. Всё, что видит гость, — только `security definer` RPC; прямой доступ анонима к таблицам закрыт (это проверяет `db_checks.sql`).
- Стенд кэширует страницу через service worker. После правок открывайте адрес с новым параметром, например `&r=2`, или удалите регистрации SW.
- Изменили `tests/browser/server.mjs` — перезапустите стенд (`preview_stop`, затем `preview_start`).
- Docker локально не установлен, поэтому SQL проверяется через PGlite (см. `INDEX.md` → Тесты). Полный `run_db_tests.sh` прогоняет GitHub в джобе «База».
