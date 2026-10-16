import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { hmacAdapter, manualAdapter } from '../src/services/payment/payment.adapter';
import { env } from '../src/config/env';

describe('payment adapter', () => {
  it('manualAdapter is always configured', () => {
    expect(manualAdapter.isConfigured()).toBe(true);
    expect(manualAdapter.name).toBe('manual');
  });

  it('hmacAdapter rejects missing signature', async () => {
    if (!env.PAYMENT.WEBHOOK_SECRET) {
      // Skip if secret not configured
      return;
    }
    const body = JSON.stringify({ status: 'PAID', amount: 1000, reference: 'order-1' });
    await expect(hmacAdapter.verifyAndParse({ rawBody: body, signature: undefined, headers: {} })).rejects.toThrow(/signature/i);
  });

  it('hmacAdapter rejects invalid signature', async () => {
    if (!env.PAYMENT.WEBHOOK_SECRET) return;
    const body = JSON.stringify({ status: 'PAID', amount: 1000, reference: 'order-1' });
    await expect(
      hmacAdapter.verifyAndParse({ rawBody: body, signature: 'deadbeef', headers: {} })
    ).rejects.toThrow();
  });

  it('hmacAdapter accepts valid signature', async () => {
    if (!env.PAYMENT.WEBHOOK_SECRET) return;
    const body = JSON.stringify({
      event_id: 'evt-1',
      status: 'PAID',
      amount: 1000,
      currency: 'IDR',
      reference: 'order-1',
      paid_at: '2026-10-16T03:45:00.000Z',
    });
    const sig = createHmac('sha256', env.PAYMENT.WEBHOOK_SECRET).update(body).digest('hex');
    const ev = await hmacAdapter.verifyAndParse({ rawBody: body, signature: sig, headers: {} });
    expect(ev.status).toBe('PAID');
    expect(ev.amount).toBe(1000);
    expect(ev.orderReference).toBe('order-1');
    expect(ev.providerEventId).toBe('evt-1');
  });
});
