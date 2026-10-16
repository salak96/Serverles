import { describe, it, expect } from 'vitest';
import { formatJakarta, formatRupiah, daysBetween } from '../src/utils/date';

describe('format utilities', () => {
  it('formatJakarta renders DD MMMM YYYY, HH:mm WIB', () => {
    // 2026-10-16 03:45 UTC = 2026-10-16 10:45 WIB
    const out = formatJakarta('2026-10-16T03:45:00.000Z');
    expect(out).toBe('16 Oktober 2026, 10:45 WIB');
  });

  it('formatJakarta returns "-" for invalid', () => {
    expect(formatJakarta('not-a-date')).toBe('-');
    expect(formatJakarta(null as unknown as string)).toBe('-');
    expect(formatJakarta(undefined as unknown as string)).toBe('-');
  });

  it('formatRupiah uses IDR with no decimals', () => {
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(49000)).toBe('Rp 49.000');
    expect(formatRupiah(1234567)).toBe('Rp 1.234.567');
  });

  it('daysBetween returns whole days', () => {
    const a = new Date('2026-01-01T00:00:00Z');
    const b = new Date('2026-01-08T00:00:00Z');
    expect(daysBetween(a, b)).toBe(7);
    expect(daysBetween(b, a)).toBe(0);
  });
});
