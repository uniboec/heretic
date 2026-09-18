#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Создайте .env из .env.production.example и заполните секреты."
  exit 1
fi

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "Приложение запущено на порту $(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 || echo 3001)"
echo "Добавьте deploy/nginx.conf в конфиг nginx для mma66.ru и выполните: sudo nginx -t && sudo systemctl reload nginx"
echo "Откройте: https://mma66.ru/cup26/"
