FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# Install OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

# Generate Prisma client (no DB connection needed for generate in Prisma 7)
RUN pnpm --filter @challengepoint/db run generate

# Set dummy DATABASE_URL for build (Next.js SSR needs it but won't connect)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

# Build Next.js app with standalone output
RUN pnpm --filter golf-challenge-point-web run build

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages/db/generated ./packages/db/generated

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/web/.next/standalone/server.js"]
