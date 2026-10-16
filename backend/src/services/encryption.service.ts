import { createDecipheriv, createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  if (!env.LICENSE_ENCRYPTION_KEY) {
    throw new Error('LICENSE_ENCRYPTION_KEY is not configured. Generate one with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"` and set it in .env.');
  }
  // Accept either base64 or raw 32+ char string (we stretch it via scrypt).
  const raw = env.LICENSE_ENCRYPTION_KEY;
  try {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length >= 32) return buf.subarray(0, 32);
  } catch {
    // ignore
  }
  return scryptSync(raw, 'pawangtools-license-salt', 32);
}

export interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

export function encryptString(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload: EncryptedPayload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
  return JSON.stringify(payload);
}

export function decryptString(serialized: string): string {
  const key = getKey();
  const payload = JSON.parse(serialized) as EncryptedPayload;
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const data = Buffer.from(payload.data, 'base64');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
