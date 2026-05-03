#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/../docker/docker-compose.yml"
export DATABASE_URL="mysql://root:devpassword@127.0.0.1:3306/pantusso_e2e"

echo "Starting MySQL via docker compose..."
docker compose -f "$COMPOSE_FILE" up -d db

echo "Waiting for MySQL to be ready..."
until docker compose -f "$COMPOSE_FILE" exec -T db \
    mysqladmin ping -u root -pdevpassword --silent 2>/dev/null; do
  sleep 2
done
echo "MySQL ready."

echo "Running migrations..."
node scripts/migrate.js

echo "Seeding E2E data..."
SEED_ADMIN_EMAIL=admin@example.com \
SEED_ADMIN_PASSWORD=changeme \
  node scripts/seed-e2e.js

# Clear .next so npm run dev can start clean.
# If it's root-owned from a prior Docker run, sudo is required.
if [ -d .next ]; then
  rm -rf .next 2>/dev/null || sudo rm -rf .next
fi

echo "Running Playwright E2E tests against MySQL..."
npx playwright test --config playwright.mysql.config.ts
