export { PrismaClient, Prisma } from './generated/client/index.js';
export type { Role } from './generated/client/index.js';

import { PrismaClient } from './generated/client/index.js';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}