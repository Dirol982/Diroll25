# Запуск на VPS

Нужен сервер с Docker (Ubuntu 22.04+, от 1 vCPU / 1 ГБ RAM) и домен, A-запись которого указывает на IP сервера.

```sh
git clone https://github.com/Dirol982/Diroll25.git atlas && cd atlas
cp .env.example .env
nano .env                         # домен, ATLAS_ADMIN_EMAIL, ключи
docker compose up -d --build
```

Caddy сам получит HTTPS-сертификат для `ATLAS_DOMAIN`. Дальше:

1. Откройте `https://ваш-домен/cabinet` и зарегистрируйтесь с адресом из `ATLAS_ADMIN_EMAIL`: этот аккаунт станет администратором.
2. Вкладка «Редакция» → «Запустить агентов сейчас». Результат появится в списке запусков через несколько минут.
3. Подключите Telegram (`TELEGRAM_SETUP.md`), затем в `.env` укажите `ATLAS_TELEGRAM_DELIVERY=1` и выполните `docker compose up -d`.
4. Удалите секрет `TELEGRAM_BOT_TOKEN` из GitHub, чтобы посты не дублировались из Actions.
5. Для криптоплатежей: зарегистрируйтесь в NOWPayments, укажите кошелёк для выплат, создайте API key и IPN secret и впишите их в `.env`. Адрес IPN подставляется автоматически: `https://ваш-домен/api/payments/nowpayments/ipn`.

## Обслуживание

```sh
docker compose logs -f worker                     # что делают агенты и Telegram
docker compose pull && docker compose up -d --build   # обновление после git pull
docker compose run --rm web node tools/telegram-setup.js --apply --write-config
```

Резервная копия базы:

```sh
docker compose exec web node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/atlas.db').exec(\"VACUUM INTO '/data/backup.db'\")"
docker compose cp web:/data/backup.db ./atlas-backup-$(date +%F).db
```

Храните копии вне сервера: в базе есть email и хэши паролей пользователей.

## Ограничения текущей версии

- Один процесс worker на базу, масштабирование на несколько серверов не предусмотрено.
- Возвраты платежей и частичные оплаты разбираются вручную (статус `partial` виден в платежах).
- Отчётность в ОРД не автоматизирована.
