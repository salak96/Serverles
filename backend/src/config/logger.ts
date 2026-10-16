import pino from 'pino';
import { env } from './env';

const isDev = !env.IS_PRODUCTION;

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  base: { service: 'pawangtools-backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.apiKey',
      '*.licenseKey',
      '*.key',
      '*.secret',
      '*.hmacSecret',
      '*.privateKey',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,service',
        },
      }
    : undefined,
});

export type Logger = typeof logger;
