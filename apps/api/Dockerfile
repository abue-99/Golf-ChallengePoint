FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

# Install OS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY . .

RUN pnpm install --frozen-lockfile

# Set DATABASE_URL for generation (dummy URL; no DB connection needed for generate)
ENV DATABASE_URL="postgresql://user:password@localhost:5432/golf"

# Generate Prisma client
RUN pnpm --filter @golf/db run generate

# Build NestJS API
RUN pnpm --filter api run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "apps/api/dist/main.js"]
