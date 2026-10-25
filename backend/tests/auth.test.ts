import { describe, it, expect } from 'vitest';
import argon2 from 'argon2';
import { hashPassword, verifyPassword, validatePasswordPolicy } from '../src/modules/auth/auth.service';
import { signAccessToken, verifyAccessToken, hashToken, generateOpaqueToken } from '../src/modules/auth/auth.service';
import { verifyCaptcha } from '../src/services/captcha.service';
import { env } from '../src/config/env';

describe('auth utilities', () => {
  it('hashPassword uses argon2id and verifies', async () => {
    const hash = await hashPassword('TestP@ssw0rd!1');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'TestP@ssw0rd!1')).toBe(true);
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('verifyPassword returns false on bad hash', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });

  it('validatePasswordPolicy enforces strength rules', () => {
    expect(() => validatePasswordPolicy('short')).toThrow();
    expect(() => validatePasswordPolicy('alllowercase1234')).toThrow();
    expect(() => validatePasswordPolicy('NoNumberHere!')).toThrow();
    expect(() => validatePasswordPolicy('GoodPass123')).not.toThrow();
  });

  it('signAccessToken + verifyAccessToken round-trips', () => {
    const token = signAccessToken({ sub: 'u1', role: 'USER', email: 'a@b.com', sid: 's1' });
    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe('u1');
    expect(decoded.role).toBe('USER');
  });

  it('hashToken returns 64 hex', () => {
    expect(hashToken('hello')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateOpaqueToken returns a url-safe string of decent length', () => {
    const t = generateOpaqueToken();
    expect(t.length).toBeGreaterThan(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('skips CAPTCHA verification when disabled', async () => {
    const original = env.CAPTCHA_ENABLED;
    Object.defineProperty(env, 'CAPTCHA_ENABLED', { value: false, configurable: true });
    try {
      await expect(verifyCaptcha(undefined)).resolves.toBeUndefined();
    } finally {
      Object.defineProperty(env, 'CAPTCHA_ENABLED', { value: original, configurable: true });
    }
  });

  it('rejects missing CAPTCHA token when enabled', async () => {
    const originalEnabled = env.CAPTCHA_ENABLED;
    const originalSecret = env.CAPTCHA_SECRET_KEY;
    Object.defineProperty(env, 'CAPTCHA_ENABLED', { value: true, configurable: true });
    Object.defineProperty(env, 'CAPTCHA_SECRET_KEY', { value: 'test-secret-key', configurable: true });
    try {
      await expect(verifyCaptcha(undefined)).rejects.toThrow(/captcha/i);
    } finally {
      Object.defineProperty(env, 'CAPTCHA_ENABLED', { value: originalEnabled, configurable: true });
      Object.defineProperty(env, 'CAPTCHA_SECRET_KEY', { value: originalSecret, configurable: true });
    }
  });
});

void argon2;
