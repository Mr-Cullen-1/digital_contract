# Подключение GitHub и Vercel

Подготовка: 10 ноября 2026. GitHub-репозиторий и Vercel-проект подключает пользователь. Удалённый репозиторий, commit/push и деплой агентом не создавались.

## Supabase

Проект из локального `.env`: `bytcciqblqjdcvjsacog`. Auth и ключи проверены; после выполнения пользователем `artifacts/supabase-bootstrap.sql` подтверждены 10 таблиц и 4 приватных bucket. Исходная миграция: `supabase/migrations/20261110061126_vertex_contract.sql`.

Проверка подключения без чтения клиентских записей: `node scripts/check-supabase.mjs`.

Для реальных Auth/RLS/Storage предусмотрен `node scripts/verify-supabase-live.mjs --write-test`. Он создаёт два временных аккаунта без отправки писем, черновик и файл, проверяет ограничения доступа и удаляет тестовые объекты. Это ручная проверка, не часть CI. При ошибке очистки выводятся идентификаторы оставшихся тестовых объектов.

`node scripts/prepare-migration.mjs` создаёт SQL-пакет в игнорируемой папке `artifacts`. Он предназначен **только для пустой базы**: включает транзакцию и запись исходной версии в историю миграций. Повторно на этом проекте его выполнять не нужно. Следующие изменения оформляются новыми миграциями; `db reset` для облачной базы не использовать.

## GitHub

Загрузите исходники и `package-lock.json` в свой репозиторий. `.gitignore` исключает `.env*` (кроме пустого `.env.example`), `.next`, `node_modules`, `.vercel`, временные файлы Supabase и `artifacts`.

Если создаёте локальный репозиторий через терминал:

```powershell
git init -b main
git add .
git diff --cached --stat
git status --short
# После просмотра списка файлов:
git commit -m "Prepare Vertex Contract for deployment"
# Затем подключите созданный вами GitHub-репозиторий и выполните push.
```

`git ls-files .env .env.local` не должен ничего вывести. Не добавляйте секреты через `git add -f`.

Workflow `.github/workflows/ci.yml` запускает `npm ci`, тесты, production-сборку и TypeScript на Node.js 24. Он не использует секреты Supabase, не применяет миграции и не выполняет деплой. После первого успешного запуска можно сделать job `verify` обязательной проверкой ветки main.

## Vercel

1. **Add New → Project → Import Git Repository**: выберите свой репозиторий.
2. Framework: **Next.js**, Root Directory: корень репозитория, Node.js: **24.x**. Команды `npm ci` и `npm run build` заданы в `vercel.json`; Output Directory оставьте стандартной.
3. Добавьте Environment Variables:

| Переменная                             | Значение                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | HTTPS Project URL из `.env`                                                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key из `.env`                                                                                            |
| `SUPABASE_SECRET_KEY`                  | Secret key из `.env`; только сервер, пометьте Sensitive                                                              |
| `NEXT_PUBLIC_APP_URL`                  | Необязательно на Vercel. Для собственного домена можно задать HTTPS origin, например `https://contracts.example.com` |

`SUPABASE_ACCESS_TOKEN` и пароль PostgreSQL приложению и деплою не нужны. Не переносите их в Vercel. `.env` на GitHub не загружается.

Для первого деплоя не нужно заранее знать URL: оставьте `NEXT_PUBLIC_APP_URL` незаданным в Vercel. Убедитесь, что включена настройка **Enable access to System Environment Variables**. Приложение использует `VERCEL_PROJECT_PRODUCTION_URL` для production и `VERCEL_URL`/`VERCEL_BRANCH_URL` для адресов текущего deployment. Если в настройку скопирован localhost, на Vercel он игнорируется. Локальный `.env` менять не требуется. [Системные переменные Vercel](https://vercel.com/docs/environment-variables/system-environment-variables)

Сборка остановится, если отсутствуют ключи Supabase, серверный ключ указан вместо публичного или нет ни доверенного адреса Vercel, ни явного HTTPS origin. Произвольные Host/Origin-заголовки не добавляются в доверенные адреса. При смене переменных нужен новый deployment.

4. В **Supabase → Authentication → URL Configuration** установите Site URL в тот же HTTPS origin. В Redirect URLs добавьте точный адрес `https://your-project.vercel.app/auth/callback` и нужный локальный адрес `http://127.0.0.1:3000/auth/callback`.
5. Включите Email/Password и настройте подтверждение email/SMTP для регистрации реальных пользователей. Проверка временных аккаунтов администратором не подтверждает доставку email.
6. Запустите первый deployment. После готовности проверьте регистрацию с подтверждением, вход и весь сценарий с двумя сторонами.

Preview deployments должны использовать отдельный тестовый Supabase. Адреса preview определяются по системным переменным автоматически; production-домен не становится доверенным для preview автоматически. Не передавайте production secret в недоверенные PR/preview. Для дополнительного staging-домена задайте его HTTPS origin через `NEXT_PUBLIC_APP_URL` только для соответствующего окружения. Защиту Origin отключать не нужно.

## Ограничения, учтённые для Vercel

- Загрузка PDF/DOCX ограничена **4 МБ** на клиенте и сервере: multipart-запрос должен укладываться в лимит Vercel 4,5 МБ. Увеличение потребует прямой загрузки в Storage и отдельной серверной проверки. [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- API скачивания возвращает короткую JSON-ссылку после проверки сохранённых байтов по SHA-256. PDF скачивается напрямую из приватного Storage; ссылка действует 60 секунд. Большой PDF не проходит через тело ответа Vercel Function.
- Для закрытия и проверенного скачивания задан `maxDuration = 60`. Время обработки максимальных документов нужно измерить на выбранном тарифе/регионе после деплоя.
- Файлы Inter включаются в серверный tracing Next.js. Внешний сервис шрифтов для PDF не требуется.

## После первого деплоя

Проверить: создание/сохранение, импорт PDF и DOCX до 4 МБ, подпись создателя, приглашение в другом браузере, данные/подпись получателя, закрытие и скачивание, отзыв ссылки, доступ второго владельца. Проверить мобильную раскладку и рисование пальцем. Настроить регион выполнения рядом с базой, ограничения частоты запросов, мониторинг, резервное копирование и сроки хранения перед открытым запуском.

Результаты и границы проверки: [verification.md](verification.md). Полный жизненный цикл проверяется локально в PostgreSQL-движке. Живой тест ограничен удаляемым черновиком, чтобы не оставлять неизменяемый тестовый Closed-контракт.
