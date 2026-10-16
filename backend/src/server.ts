import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma, prisma } from './config/prisma';

const ACTIVITY_RETENTION_DAYS = 7;
const ACTIVITY_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

let purgeTimer: NodeJS.Timeout | null = null;

async function purgeOldActivityLogs(): Promise<void> {
  const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  try {
    const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (count > 0) logger.info({ deleted: count, retentionDays: ACTIVITY_RETENTION_DAYS }, 'activity_logs_purged');
  } catch (e) {
    logger.error({ err: e }, 'activity_log_purge_failed');
  }
}

async function bootstrap(): Promise<void> {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV, frontend: env.FRONTEND_URL },
      'pawangtools-backend listening'
    );
  });

  // Daily cleanup of audit logs older than 7 days. Runs once at boot
  // and then on a 24h interval. Cron-grade scheduling is intentionally
  // avoided here to keep the runtime free of extra dependencies.
  await purgeOldActivityLogs();
  purgeTimer = setInterval(() => { void purgeOldActivityLogs(); }, ACTIVITY_PURGE_INTERVAL_MS);
  purgeTimer.unref();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    if (purgeTimer) clearInterval(purgeTimer);
    server.close(() => {
      logger.info('http server closed');
    });
    try {
      await disconnectPrisma();
    } catch (e) {
      logger.error({ err: e }, 'prisma disconnect failed');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled_rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught_exception');
    process.exit(1);
  });
}

void bootstrap();
