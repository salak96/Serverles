import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface CreateOrderResult {
  paymentUrl?: string;
  reference: string;
  raw?: unknown;
}

export interface VerifyWebhookInput {
  rawBody: string;
  signature: string | undefined;
  headers: Record<string, string | string[] | undefined>;
}

export interface WebhookEvent {
  provider: string;
  providerEventId: string;
  orderReference: string;
  status: 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'PENDING';
  amount: number;
  currency: string;
  paidAt: Date | null;
  raw: unknown;
}

export interface PaymentAdapter {
  readonly name: string;
  isConfigured(): boolean;
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  verifyAndParse(input: VerifyWebhookInput): Promise<WebhookEvent>;
}

/**
 * Manual adapter: order is created with PENDING status, admin marks it PAID
 * via /admin endpoint (out of scope here — admin can update status directly).
 * No external gateway is involved.
 */
export const manualAdapter: PaymentAdapter = {
  name: 'manual',
  isConfigured() { return true; },
  async createOrder(input) {
    return { reference: input.orderId, paymentUrl: undefined, raw: { provider: 'manual' } };
  },
  async verifyAndParse() {
    throw new Error('Manual adapter does not accept webhooks.');
  },
};

/**
 * Generic HMAC-SHA256 adapter (compatible with Tripay-style signing).
 * Set PAYMENT_WEBHOOK_SECRET in env. The provider name is whatever is
 * configured in PAYMENT_PROVIDER (e.g. 'tripay', 'midtrans', 'xendit').
 *
 * The signature header is X-Signature (hex-encoded HMAC-SHA256 of raw body).
 * Override by editing this file for provider-specific signing rules.
 */
export const hmacAdapter: PaymentAdapter = {
  name: env.PAYMENT.PROVIDER,
  isConfigured() {
    return Boolean(env.PAYMENT.API_KEY && env.PAYMENT.WEBHOOK_SECRET);
  },
  async createOrder(_input) {
    // Real provider integration (Tripay/Midtrans/Xendit) is intentionally
    // not bundled. Implement here when credentials are available.
    // The shape returned should at minimum include `reference`.
    throw new Error(`Payment provider "${env.PAYMENT.PROVIDER}" is not implemented in this build. Set PAYMENT_PROVIDER=manual or implement the adapter.`);
  },
  async verifyAndParse(input) {
    if (!env.PAYMENT.WEBHOOK_SECRET) {
      throw new Error('PAYMENT_WEBHOOK_SECRET not configured.');
    }
    const sig = (input.signature ?? '').toLowerCase();
    if (!sig) throw new Error('Missing signature.');

    const expected = createHmac('sha256', env.PAYMENT.WEBHOOK_SECRET).update(input.rawBody).digest('hex');
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid signature.');
    }

    let body: Record<string, unknown>;
    try { body = JSON.parse(input.rawBody); } catch { throw new Error('Invalid JSON body.'); }

    const orderRef = String(body['reference'] ?? body['order_id'] ?? body['merchant_ref'] ?? '');
    const eventId = String(body['event_id'] ?? body['id'] ?? `${orderRef}-${Date.now()}`);
    const statusRaw = String(body['status'] ?? '').toLowerCase();
    const status: WebhookEvent['status'] =
      statusRaw === 'paid' || statusRaw === 'success' || statusRaw === 'settlement' ? 'PAID' :
      statusRaw === 'expired' ? 'EXPIRED' :
      statusRaw === 'failed' || statusRaw === 'failure' ? 'FAILED' :
      statusRaw === 'refunded' ? 'REFUNDED' : 'PENDING';

    return {
      provider: this.name,
      providerEventId: eventId,
      orderReference: orderRef,
      status,
      amount: Number(body['amount'] ?? body['total'] ?? 0),
      currency: String(body['currency'] ?? 'IDR'),
      paidAt: body['paid_at'] ? new Date(String(body['paid_at'])) : null,
      raw: body,
    };
  },
};

let cached: PaymentAdapter | null = null;
export function getPaymentAdapter(): PaymentAdapter {
  if (cached) return cached;
  cached = env.PAYMENT.PROVIDER === 'manual' ? manualAdapter : hmacAdapter;
  logger.info({ provider: cached.name, configured: cached.isConfigured() }, 'payment_adapter_selected');
  return cached;
}
