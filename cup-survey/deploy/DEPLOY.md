# Деплой на https://cup26.mma66.ru

Опрос размещается на VPS (например `159.194.210.165`). Основной сайт `mma66.ru` остаётся на Beget.

## 1. DNS (панель Beget)

| Тип | Имя | Значение |
|-----|-----|----------|
| A | `cup26` | IP вашего VPS |

## 2. Скопировать проект на VPS

```bash
# с вашего ПК (из папки project-heretic):
scp -r cup-survey root@159.194.210.165:/opt/cup-survey
```

Или `rsync -avz cup-survey/ root@159.194.210.165:/opt/cup-survey/`

## 3. Настроить .env на VPS

```bash
ssh root@159.194.210.165
cd /opt/cup-survey
cp .env.production.example .env
nano .env
```

Заполнить `POSTGRES_PASSWORD`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`.

Локально сгенерировать:
```bash
npm run hash-password 'ваш-пароль'
openssl rand -base64 32
```

## 4. Запустить установку

```bash
chmod +x deploy/vps-setup.sh deploy/docker-entrypoint.sh
sudo ./deploy/vps-setup.sh
```

## 5. Редирект с Beget (опционально)

В `public_html/cup26/.htaccess` на Beget:

```apache
RewriteEngine On
RewriteRule ^(.*)$ https://cup26.mma66.ru/$1 [R=302,L]
```

## URL

- Опрос: https://cup26.mma66.ru/
- Админка: https://cup26.mma66.ru/admin

## Локально

http://localhost:3000/
