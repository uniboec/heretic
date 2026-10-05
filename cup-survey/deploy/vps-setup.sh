#!/usr/bin/env bash
# Полный деплой на VPS (Ubuntu/Debian). Запуск на сервере от root или sudo.
set -euo pipefail

DOMAIN="cup26.mma66.ru"
APP_DIR="/opt/cup-survey"
REPO_URL="${REPO_URL:-}"  # опционально: git clone URL

echo "==> Установка Docker (если нет)..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Установка nginx + certbot (если нет)..."
if ! command -v nginx &>/dev/null; then
  apt-get update
  apt-get install -y nginx certbot python3-certbot-nginx
fi

mkdir -p "$APP_DIR"

if [ -n "$REPO_URL" ]; then
  git clone "$REPO_URL" "$APP_DIR" || (cd "$APP_DIR" && git pull)
else
  echo "Скопируйте файлы проекта в $APP_DIR (rsync/scp) и запустите скрипт снова."
  if [ ! -f "$APP_DIR/docker-compose.prod.yml" ]; then
    exit 1
  fi
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.production.example .env
  echo ""
  echo "!!! Заполните $APP_DIR/.env (пароли, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET) и запустите скрипт снова."
  exit 1
fi

if grep -q "CHANGE_ME" .env 2>/dev/null; then
  echo "!!! В .env остались значения CHANGE_ME — заполните секреты."
  exit 1
fi

echo "==> Хранилище квитанций..."
chmod +x deploy/*.sh
./deploy/ensure-payment-proofs-storage.sh
./deploy/install-payment-proofs-backup-cron.sh

echo "==> Shared state + network..."
mkdir -p /opt/cup-survey-shared /opt/cup-survey-backups/postgres
export APP_DIR="$APP_DIR" DEPLOY_SCRIPT_DIR="$APP_DIR/deploy"
./deploy/network-transition.sh

echo "==> Сборка и запуск контейнеров..."
RELEASE_TAG="bootstrap-$(date -u +%Y%m%dT%H%M%SZ)"
GIT_SHA="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
export DOCKER_BUILDKIT=1
docker build \
  --build-arg RELEASE_ID="${RELEASE_TAG}" \
  --build-arg GIT_SHA="${GIT_SHA}" \
  -t "cup-survey-app:${RELEASE_TAG}" \
  -t cup-survey-app:current \
  -f Dockerfile .
printf 'CUP_BLUE_IMAGE=cup-survey-app:%s\nCUP_GREEN_IMAGE=cup-survey-app:%s\n' \
  "${RELEASE_TAG}" "${RELEASE_TAG}" > /opt/cup-survey-shared/compose-images.env
docker compose \
  --env-file .env \
  --env-file /opt/cup-survey-shared/compose-images.env \
  -f docker-compose.prod.yml up -d postgres app-blue
./deploy/verify-payment-proofs-storage.sh

echo "==> Nginx..."
mkdir -p /etc/nginx/snippets
cp deploy/snippets/cup-survey-upstream.conf /etc/nginx/snippets/cup-survey-upstream.conf
cp deploy/nginx-security-headers.conf /etc/nginx/snippets/cup-survey-security-headers.conf
if ! grep -q 'server_tokens off' /etc/nginx/nginx.conf; then
  sed -i 's/http {/http {\n    server_tokens off;/' /etc/nginx/nginx.conf
fi
cp deploy/nginx-cup26.mma66.ru.conf /etc/nginx/sites-available/cup26.mma66.ru
ln -sf /etc/nginx/sites-available/cup26.mma66.ru /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

echo "==> SSL (Let's Encrypt)..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@mma66.ru || {
  echo "Certbot не смог выпустить сертификат. Проверьте DNS A-запись $DOMAIN -> этот сервер."
  exit 1
}

echo ""
echo "Готово: https://$DOMAIN/"
echo "Админка: https://$DOMAIN/admin"
