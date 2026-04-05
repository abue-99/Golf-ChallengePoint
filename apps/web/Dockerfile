FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @challengepoint/db run generate

# Compile packages/db TypeScript to JavaScript
RUN pnpm --filter @challengepoint/db run build

RUN pnpm --filter golf-challenge-point-web run build

# Production stage
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

# Extract the standalone bundle at the monorepo root so that the embedded
# server.js can resolve workspace packages at their original paths.
COPY --from=builder /app/apps/web/.next/standalone ./

# Static assets and public files must live alongside the app directory
# so that Next.js standalone server can serve them (including the header logo).
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
EXPOSE 3000

# server.js is generated at apps/web/server.js when outputFileTracingRoot is set
# to the monorepo root (see apps/web/next.config.ts).
CMD ["node", "apps/web/server.js"]
