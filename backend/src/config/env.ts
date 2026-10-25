import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string = ''): string {
  return process.env[name] ?? fallback;
}

function asInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

function asBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function smtpEnabled(): boolean {
  const host = process.env['SMTP_HOST'] ?? '';
  const user = process.env['SMTP_USER'] ?? '';
  const pass = process.env['SMTP_PASS'] ?? process.env['SMTP_PASSWORD'] ?? '';
  return Boolean(host && user && pass);
} 

function smtpPassword(): string {
  return process.env['SMTP_PASS'] ?? process.env['SMTP_PASSWORD'] ?? '';
}

function mailFrom(): string {
  return process.env['MAIL_FROM'] ?? process.env['SMTP_FROM'] ?? 'PawangTools <no-reply@pawangtools.local>';
}

function appUrl(): string {
  return (process.env['APP_URL'] ?? process.env['FRONTEND_URL'] ?? 'http://localhost:5173').replace(/\/$/, '');
}

function smtpHost(): string {
  return optional('SMTP_HOST', '');
}

function smtpUser(): string {
  return optional('SMTP_USER', '');
}

function smtpPort(): number {
  return asInt('SMTP_PORT', 587);
}

function smtpSecure(): boolean {
  return asBool('SMTP_SECURE', false);
}

const NODE_ENV = optional('NODE_ENV', 'development');
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test' || process.env.VITEST === 'true';

export const env = {
  NODE_ENV,
  IS_PRODUCTION,
  PORT: asInt('PORT', 3000),
  DATABASE_URL: required('DATABASE_URL'),
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),
  APP_URL: appUrl(),
  EMAIL_VERIFICATION_REQUIRED: asBool('EMAIL_VERIFICATION_REQUIRED', true),
  CAPTCHA_ENABLED: IS_TEST ? false : asBool('CAPTCHA_ENABLED', true),
  CAPTCHA_SECRET_KEY: optional('CAPTCHA_SECRET_KEY', IS_PRODUCTION ? '' : '1x0000000000000000000000000000000AA'),
  REGISTRATION_SINGLE_ACCOUNT_PER_IP: asBool('REGISTRATION_SINGLE_ACCOUNT_PER_IP', IS_PRODUCTION),
  FREE_PLAN_SINGLE_CLAIM_PER_IP: asBool('FREE_PLAN_SINGLE_CLAIM_PER_IP', IS_PRODUCTION),
  BACKEND_PUBLIC_URL: optional('BACKEND_PUBLIC_URL', 'http://localhost:3000'),
  SESSION_SECRET: required('SESSION_SECRET', IS_PRODUCTION ? undefined : 'dev-session-secret-please-change-32b'),
  TOKEN_SECRET: required('TOKEN_SECRET', IS_PRODUCTION ? undefined : 'dev-token-secret-please-change-32b'),
  HWID_HMAC_SECRET: required('HWID_HMAC_SECRET', IS_PRODUCTION ? undefined : 'dev-hwid-hmac-secret-please-change-32b'),
  LICENSE_ENCRYPTION_KEY: optional('LICENSE_ENCRYPTION_KEY', ''),
  LICENSE_SIGNING_PRIVATE_KEY_PATH: optional('LICENSE_SIGNING_PRIVATE_KEY_PATH', path.resolve(process.cwd(), 'keys/license_signing_private.pem')),
  LICENSE_SIGNING_PUBLIC_KEY_PATH: optional('LICENSE_SIGNING_PUBLIC_KEY_PATH', path.resolve(process.cwd(), 'keys/license_signing_public.pem')),
  LICENSE_SIGNING_PUBLIC_KEY_PEM: optional('LICENSE_SIGNING_PUBLIC_KEY_PEM', ''),
  LICENSE_DEFAULT_DURATION_DAYS: asInt('LICENSE_DEFAULT_DURATION_DAYS', 30),
  LICENSE_OFFLINE_TOKEN_TTL_SECONDS: asInt('LICENSE_OFFLINE_TOKEN_TTL_SECONDS', 900),
  SMTP: {
    HOST: smtpHost(),
    PORT: smtpPort(),
    USER: smtpUser(),
    PASSWORD: smtpPassword(),
    FROM: mailFrom(),
    SECURE: smtpSecure(),
    ENABLED: smtpEnabled(),
  },
  PAYMENT: {
    PROVIDER: optional('PAYMENT_PROVIDER', 'manual'),
    API_KEY: optional('PAYMENT_API_KEY', ''),
    WEBHOOK_SECRET: optional('PAYMENT_WEBHOOK_SECRET', ''),
    CALLBACK_URL: optional('PAYMENT_CALLBACK_URL', ''),
  },
  TELEGRAM: {
    BOT_TOKEN: optional('TELEGRAM_BOT_TOKEN', ''),
    CHAT_ID: optional('TELEGRAM_CHAT_ID', ''),
  },
  STORAGE: {
    PROVIDER: optional('STORAGE_PROVIDER', 'local'),
    BUCKET: optional('STORAGE_BUCKET', ''),
    ACCESS_KEY: optional('STORAGE_ACCESS_KEY', ''),
    SECRET_KEY: optional('STORAGE_SECRET_KEY', ''),
    ENDPOINT: optional('STORAGE_ENDPOINT', ''),
    REGION: optional('STORAGE_REGION', ''),
    PUBLIC_BASE_URL: optional('STORAGE_PUBLIC_BASE_URL', ''),
    LOCAL_DIR: optional('STORAGE_LOCAL_DIR', path.resolve(process.cwd(), 'storage')),
  },
  RATE_LIMIT: {
    WINDOW_MS: asInt('RATE_LIMIT_WINDOW_MS', 60_000),
    MAX_REQUESTS: asInt('RATE_LIMIT_MAX_REQUESTS', 120),
  },
} as const;
