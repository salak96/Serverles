import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: env.IS_PRODUCTION
    ? [{ level: 'error', emit: 'event' }]
    : [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
});

if (!env.IS_PRODUCTION) {
  prisma.$on('query', (e: Prisma.QueryEvent) => {
    logger.debug({ duration: `${e.duration}ms`, query: e.query }, 'prisma:query');
  });
}

prisma.$on('error', (e: Prisma.LogEvent) => {
  logger.error({ target: e.target, message: e.message }, 'prisma:error');
});

prisma.$on('warn', (e: Prisma.LogEvent) => {
  logger.warn({ target: e.target, message: e.message }, 'prisma:warn');
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
