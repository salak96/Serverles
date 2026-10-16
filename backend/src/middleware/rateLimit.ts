import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { RateLimitError } from '../utils/errors';

interface LimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
}

export function makeLimiter(opts: LimitOptions = {}): RequestHandler {
  const windowMs = opts.windowMs ?? env.RATE_LIMIT.WINDOW_MS;
  const max = opts.max ?? env.RATE_LIMIT.MAX_REQUESTS;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new RateLimitError(opts.message));
    },
  });
}
