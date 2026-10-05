# Cup26 Survey

Опрос по условиям проведения Кубка Свердловской области.

**Продакшен:** https://cup26.mma66.ru/

## Локальный запуск

**Windows:** дважды кликните `запуск.bat`, `run.bat` или `start-dev.bat`.

**Вручную:**

```bash
cd cup-survey
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run dev
```

http://localhost:3000

Тестовые данные (по желанию): `npm run seed:clubs` и `npm run seed:registrations`

Публичные страницы (участники, сетки, поединки):

```bash
npm run setup:local-public
```

Откройте http://localhost:3000/athletes, /brackets, /bouts (нужен `npm run dev` и `INDEPENDENT_BOUTS_RELEASE=true` в `.env`).

## Деплой на VPS

Инструкция: [deploy/DEPLOY.md](deploy/DEPLOY.md)

Кратко:
1. DNS: `cup26.mma66.ru` → A → IP VPS
2. `scp -r cup-survey root@VPS:/opt/cup-survey`
3. Заполнить `.env`, запустить `deploy/vps-setup.sh`

## Стек

Next.js 16, React 19, PostgreSQL, Prisma, Tailwind CSS 4
