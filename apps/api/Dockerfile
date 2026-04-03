# ---- Build Stage ----
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable

# Install OS dependencies (needed for bcrypt, prisma engines)
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

# Generate Prisma client (dummy URL is sufficient; no DB connection needed for generate)
ARG DATABASE_URL="postgresql://user:password@localhost:5432/golf"
RUN DATABASE_URL=${DATABASE_URL} pnpm --filter @golf/db run generate

# Build @golf/db (compile TypeScript to JavaScript so Node.js can require it at runtime)
RUN pnpm --filter @golf/db run build

# Build NestJS API
RUN pnpm --filter api run build

# Prune dev dependencies so only production deps are copied to runtime stage
RUN pnpm deploy --filter api --prod /prod/api


# ---- Runtime Stage ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

# Production node_modules (includes @golf/db with generated Prisma client)
COPY --from=build /prod/api/node_modules ./node_modules

# Compiled NestJS application
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Prisma schema and migrations (needed for migrate deploy at startup)
COPY --from=build /app/packages/db/prisma ./packages/db/prisma

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
