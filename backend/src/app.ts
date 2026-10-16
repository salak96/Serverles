import express, { type Application, type Request } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { requestId } from './middleware/requestId';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { makeLimiter } from './middleware/rateLimit';
import apiRouter from './modules';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers. CSP disabled in dev to avoid blocking Vite HMR.
  app.use(
    helmet({
      contentSecurityPolicy: env.IS_PRODUCTION ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS allowlist
  const allowedOrigins = new Set(
    [env.FRONTEND_URL, env.BACKEND_PUBLIC_URL].filter(Boolean)
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );

  // Request ID + structured logging
  app.use(requestId());
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { id?: string }).id ?? '',
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, url: req.url };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    })
  );

  app.use((req, res, next) => {
    if (req.path === '/api/v1/subscriptions/webhook') {
      // Preserve raw body for HMAC signature verification.
      // We do this for the webhook path only; other paths use json() below.
      let raw = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
        (req as Request & { rawBody?: string }).rawBody = raw;
        next();
      });
    } else {
      next();
    }
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // Global rate limit
  app.use(makeLimiter());

  // API
  app.use('/api/v1', apiRouter);

  // Root
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: {
        service: 'pawangtools-backend',
        api_prefix: '/api/v1',
        health: '/api/v1/health',
        docs: '/docs/API.md',
      },
    });
  });

  // 404 + error handler
  app.use(notFoundHandler());
  app.use(errorHandler());

  return app;
}
