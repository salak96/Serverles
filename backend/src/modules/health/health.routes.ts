import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';

const router = Router();

/**
 * GET /api/v1/health
 * Public health endpoint. Returns overall status and (when safe) DB status.
 * Never returns secrets, stack traces, or internal config.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();

    let dbStatus: 'up' | 'down' | 'unknown' = 'unknown';
    let dbLatencyMs: number | null = null;
    try {
      const t0 = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - t0;
      dbStatus = 'up';
    } catch {
      dbStatus = 'down';
    }

    const overall: 'online' | 'degraded' | 'offline' =
      dbStatus === 'up' ? 'online' : dbStatus === 'down' ? 'degraded' : 'online';

    res.status(200).json({
      success: true,
      data: {
        status: overall,
        service: 'pawangtools-backend',
        version: '0.1.0',
        api_version: 'v1',
        time: new Date().toISOString(),
        checks: {
          database: { status: dbStatus, latency_ms: dbLatencyMs },
        },
        integrations: {
          smtp: env.SMTP.ENABLED ? 'configured' : 'not_configured',
          payment: env.PAYMENT.PROVIDER === 'manual' ? 'not_configured' : 'configured',
          storage: env.STORAGE.PROVIDER === 'local' ? 'local' : 'configured',
        },
        meta: {
          response_time_ms: Date.now() - startedAt,
        },
      },
    });
  })
);

export default router;
