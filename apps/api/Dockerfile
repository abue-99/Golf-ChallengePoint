FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# Install OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

# Generate Prisma client (no DB connection needed for generate in Prisma 7)
RUN pnpm --filter @challengepoint/db run generate

# Compile packages/db TypeScript to JavaScript
RUN pnpm --filter @challengepoint/db run build

# Build NestJS API
RUN pnpm --filter api run build

# Production stage – only compiled output + prod deps
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/index.js ./packages/db/index.js
COPY --from=builder /app/packages/db/index.d.ts ./packages/db/index.d.ts
COPY --from=builder /app/packages/db/db.js ./packages/db/db.js
COPY --from=builder /app/packages/db/db.d.ts ./packages/db/db.d.ts
COPY --from=builder /app/packages/db/generated ./packages/db/generated
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @challengepoint/db run migrate:deploy && node apps/api/dist/main.js"]
