export { PrismaClient, Prisma } from './generated/client/index.js';
export type { Role } from './generated/client/index.js';

import { PrismaClient } from './generated/client/index.js';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  return new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  });
}

export const prisma = isBuild
  ? ({} as PrismaClient)
  : globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}