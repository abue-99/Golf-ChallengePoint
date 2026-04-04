FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @challengepoint/db run generate

# Compile packages/db TypeScript to JavaScript
RUN pnpm --filter @challengepoint/db run build

ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/challengepoint"

RUN pnpm --filter golf-challenge-point-web run build

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next/standalone ./apps/web/.next/standalone
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

ENV NODE_ENV=production
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["node", ".next/standalone/server.js"]
