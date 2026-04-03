FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# Install OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client (no DB connection needed for generate in Prisma 7)
RUN pnpm --filter @challengepoint/db run generate

# NEXT_PUBLIC_* vars must be present at build time to be bundled into client JS
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Run TypeScript check before the expensive next build (fail fast in seconds)
RUN pnpm --filter golf-challenge-point-web run typecheck

# Build Next.js app with standalone output
RUN pnpm --filter golf-challenge-point-web run build

# Production stage
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Standalone server (includes traced node_modules)
COPY --from=builder /app/apps/web/.next/standalone ./

# Static assets (not included in standalone output)
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Public folder (not included in standalone output)
COPY --from=builder /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is at apps/web/server.js inside the standalone output
# because outputFileTracingRoot is set to the monorepo root in next.config.ts
CMD ["node", "apps/web/server.js"]
