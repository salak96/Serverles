import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';

const HEX = '0123456789abcdef';

/** Cryptographically secure random hex string. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Format bytes as PAW-XXXX-XXXX-XXXX-XXXX using crypto-secure random source. */
export function formatLicenseKey(): string {
  // 16 bytes -> 32 hex chars. We split into 4 groups of 8 chars separated by '-'.
  const buf = randomBytes(16);
  let hex = '';
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    hex += HEX[(b >> 4) & 0xf] + HEX[b & 0xf];
  }
  return `PAW-${hex.slice(0, 8)}-${hex.slice(8, 16)}-${hex.slice(16, 24)}-${hex.slice(24, 32)}`;
}

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256OfKey(key: string): string {
  return sha256(key);
}

export function lastFour(key: string): string {
  const compact = key.replace(/-/g, '');
  return compact.slice(-4).toUpperCase();
}

/** Mask a license key for display: PAW-XXXX-****-****-****, last 4 kept. */
export function maskLicenseKey(key: string): string {
  const compact = key.replace(/-/g, '').toUpperCase();
  if (compact.length < 12) return 'PAW-****-****-****-****';
  const tail = compact.slice(-4);
  return `PAW-****-****-****-${tail}`;
}

/** HMAC-SHA-256 of device identity using server-side secret. */
export function hmacDeviceId(identity: string): string {
  return createHmac('sha256', env.HWID_HMAC_SECRET).update(identity).digest('hex');
}

/** Constant-time equality for hashes/tokens. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
