FROM node:22-bookworm-slim

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

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "pnpm --filter @challengepoint/db run migrate:deploy && node apps/api/dist/main.js"]
