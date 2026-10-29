# Telegram-каналы ATLAS / Контекст

Каждый раздел на каждом языке получает отдельный канал. Главный канал получает самые важные новости всех разделов (важность ≥ 4). Названия и описания хранятся в `config/topics.json`.

| Раздел | Русский канал | Английский канал |
| --- | --- | --- |
| Главное | @atlas_context_ru · «ATLAS / Контекст — Главное» | @atlas_context_en · «ATLAS / Context — Top Stories» |
| Технологии | @atlas_context_tech_ru · «ATLAS / Контекст — Технологии» | @atlas_context_tech_en · «ATLAS / Context — Technology» |
| Наука | @atlas_context_science_ru · «ATLAS / Контекст — Наука» | @atlas_context_science_en · «ATLAS / Context — Science» |
| Экономика | @atlas_context_economy_ru · «ATLAS / Контекст — Экономика» | @atlas_context_economy_en · «ATLAS / Context — Economy» |
| Культура | @atlas_context_culture_ru · «ATLAS / Контекст — Культура» | @atlas_context_culture_en · «ATLAS / Context — Culture» |
| Спорт | @atlas_context_sport_ru · «ATLAS / Контекст — Спорт» | @atlas_context_sport_en · «ATLAS / Context — Sport» |
| Путешествия | @atlas_context_travel_ru · «ATLAS / Контекст — Путешествия» | @atlas_context_travel_en · «ATLAS / Context — Travel» |

Доступность имён заранее не проверялась. Если имя занято, выберите другое и поменяйте `username` в `config/topics.json`.

## Подключение

1. В @BotFather создайте бота (`/newbot`) и сохраните токен. Не пересылайте его в чат и не коммитьте.
2. Создайте 14 публичных каналов с именами из таблицы. Бот API не умеет создавать каналы, это делается только вручную.
3. В каждом канале добавьте бота администратором с правами «Публикация сообщений» и «Изменение профиля канала».
4. Проверьте права и выставьте названия и описания:

   ```sh
   TELEGRAM_BOT_TOKEN=... node tools/telegram-setup.js                 # только отчёт
   TELEGRAM_BOT_TOKEN=... node tools/telegram-setup.js --apply --write-config
   ```

   `--write-config` записывает проверенные каналы в `config/connections.json`. Закоммитьте этот файл: после этого ссылки «Подписаться» появятся на сайте.
5. Включите отправку **в одном месте**:
   - GitHub Pages: добавьте секрет репозитория `TELEGRAM_BOT_TOKEN` (Settings → Secrets and variables → Actions);
   - VPS: `TELEGRAM_BOT_TOKEN` и `ATLAS_TELEGRAM_DELIVERY=1` в `.env`, а секрет в GitHub удалите.

## Как выглядит пост

Жирный заголовок, текст от агента рерайта (300–700 знаков), до трёх ссылок на источники, ссылка «Читать на сайте» и хэштег раздела. Отправляются только новости, опубликованные за последние 24 часа, поэтому новый канал не завалит архивом. Если результат отправки неизвестен (таймаут), пост не переотправляется автоматически: журнал виден в кабинете администратора.

Рекламные посты (размещение «Пост в Telegram») уходят один раз при старте кампании. В конце поста стоит пометка «Реклама · рекламодатель · erid».
