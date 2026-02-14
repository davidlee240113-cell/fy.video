import { PrismaClient } from '@prisma/client';
import { config } from '../config.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasourceUrl: config.DATABASE_URL,
  });

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
