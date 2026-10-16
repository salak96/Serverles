import { describe, it, expect } from 'vitest';
import {
  formatLicenseKey,
  maskLicenseKey,
  lastFour,
  sha256OfKey,
  hmacDeviceId,
  safeEqualHex,
  randomToken,
} from '../src/utils/crypto';

describe('crypto utilities', () => {
  it('formatLicenseKey produces PAW-XXXX-XXXX-XXXX-XXXX with hex', () => {
    const k = formatLicenseKey();
    expect(k).toMatch(/^PAW-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}-[0-9a-f]{8}$/);
  });

  it('two calls produce different keys', () => {
    const a = formatLicenseKey();
    const b = formatLicenseKey();
    expect(a).not.toBe(b);
  });

  it('maskLicenseKey keeps last 4 chars and prefix', () => {
    const k = 'PAW-abcd1234-ef567890-1234abcd-5678ef90';
    const m = maskLicenseKey(k);
    expect(m).toBe('PAW-****-****-****-EF90');
  });

  it('lastFour returns uppercase last 4 of compact key', () => {
    expect(lastFour('PAW-abcd1234-ef567890-1234abcd-5678ef90')).toBe('EF90');
  });

  it('sha256OfKey returns 64 hex', () => {
    expect(sha256OfKey('foo')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hmacDeviceId is deterministic for same input', () => {
    const a = hmacDeviceId('device-123');
    const b = hmacDeviceId('device-123');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hmacDeviceId differs for different inputs', () => {
    expect(hmacDeviceId('a')).not.toBe(hmacDeviceId('b'));
  });

  it('safeEqualHex compares without leaking', () => {
    expect(safeEqualHex('aa', 'aa')).toBe(true);
    expect(safeEqualHex('aa', 'ab')).toBe(false);
    expect(safeEqualHex('aabb', 'aa')).toBe(false);
  });

  it('randomToken length is reasonable', () => {
    expect(randomToken(16).length).toBe(32);
  });
});
