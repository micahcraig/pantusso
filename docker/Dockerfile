FROM node:20-alpine AS base

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
COPY --from=builder /app/scripts          ./scripts
COPY --from=builder /app/db/migrations    ./db/migrations
COPY --from=builder /app/node_modules     ./node_modules

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["sh", "-c", "node scripts/migrate.js && node server.js"]
