FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Provide a MySQL URL so db/index.ts takes the mysql2 path (no native SQLite addon loaded).
# mysql2 pools are lazy — no actual connection is made during build.
ENV DATABASE_URL=mysql://build:build@localhost:3306/build
RUN npm run build

# Production runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat
RUN addgroup --system --gid 1001 nodejs
RUN adduser  --system --uid 1001 nextjs

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder /app/public ./public

# Migration assets (script + SQL files + native deps)
COPY --from=builder /app/scripts               ./scripts
COPY --from=builder /app/db/migrations         ./db/migrations
COPY --from=builder /app/db/migrations-mysql   ./db/migrations-mysql
COPY --from=builder /app/node_modules     ./node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["sh", "-c", "node scripts/migrate.js && node scripts/seed.js && node server.js"]
