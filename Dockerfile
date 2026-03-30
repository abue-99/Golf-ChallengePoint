# ---- Build Stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /repo

RUN corepack enable

# Install OS dependencies for prisma/bcrypt/etc.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

# Generate Prisma client (dummy URL is sufficient; no DB connection needed for generate)
ARG DATABASE_URL="postgresql://user:password@localhost:5432/golf"
RUN DATABASE_URL=${DATABASE_URL} pnpm --filter @golf/db run generate

# NEXT_PUBLIC_* vars must be present at build time to be bundled into client JS
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Run TypeScript check before the expensive next build (fail fast in seconds)
RUN pnpm --filter golf-challenge-point-web run typecheck

# Build Next.js app with standalone output
RUN pnpm --filter golf-challenge-point-web run build


# ---- Runtime Stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Standalone server (includes traced node_modules)
COPY --from=build /repo/apps/web/.next/standalone /app

# Static assets (not included in standalone output)
COPY --from=build /repo/apps/web/.next/static /app/apps/web/.next/static

# Public folder (not included in standalone output)
COPY --from=build /repo/apps/web/public /app/apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js is at apps/web/server.js inside the standalone output
# because outputFileTracingRoot is set to the monorepo root in next.config.ts
CMD ["node", "apps/web/server.js"]
