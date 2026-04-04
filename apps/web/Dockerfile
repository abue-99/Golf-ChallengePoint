FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @challengepoint/db run generate

<<<<<<< HEAD
# Compile packages/db TypeScript to JavaScript
RUN pnpm --filter @challengepoint/db run build

=======
<<<<<<< HEAD
>>>>>>> b35b186 (fix: add build step to packages/db so compiled JS is available at runtime)
ENV DATABASE_URL="postgresql://postgres:postgres@postgres:5432/challengepoint"
=======
# Compile packages/db TypeScript to JavaScript
RUN pnpm --filter @challengepoint/db run build

ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
>>>>>>> f49ca1e (fix: add build step to packages/db so compiled JS is available at runtime)

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
