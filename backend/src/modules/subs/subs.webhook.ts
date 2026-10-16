import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { getPaymentAdapter, type WebhookEvent } from '../../services/payment/payment.adapter';
import { issueLicense } from '../licenses/licenses.service';
import { notify } from '../../services/notification.service';
import { recordAudit } from '../../services/audit.service';
import { logger } from '../../config/logger';
import { ValidationError } from '../../utils/errors';

export async function handleWebhook(rawBody: string, signature: string | undefined, headers: Record<string, string | string[] | undefined>): Promise<{ received: true; orderId: string; status: string }> {
  const adapter = getPaymentAdapter();
  const event: WebhookEvent = await adapter.verifyAndParse({ rawBody, signature, headers });

  // Dedupe by provider + providerEventId
  const existing = await prisma.paymentEvent.findUnique({
    where: { provider_providerEventId: { provider: event.provider, providerEventId: event.providerEventId } },
  });
  if (existing) {
    logger.info({ providerEventId: event.providerEventId }, 'payment_webhook_duplicate');
    return { received: true, orderId: event.orderReference, status: 'duplicate' };
  }

  const order = await prisma.order.findFirst({
    where: { OR: [{ id: event.orderReference }, { providerReference: event.orderReference }] },
    include: { user: true, plan: true },
  });
  if (!order) {
    await prisma.paymentEvent.create({
      data: {
        orderId: 'unknown',
        provider: event.provider,
        providerEventId: event.providerEventId,
        status: event.status,
        payload: event.raw as object,
        processedAt: new Date(),
        result: 'FAILURE',
        errorMessage: 'Order not found',
      },
    });
    throw new ValidationError('Order tidak ditemukan.');
  }

  // Verify amount
  if (Number(event.amount) !== Number(order.amount) || event.currency !== order.currency) {
    await prisma.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: event.provider,
        providerEventId: event.providerEventId,
        status: event.status,
        payload: event.raw as object,
        processedAt: new Date(),
        result: 'FAILURE',
        errorMessage: 'Amount mismatch',
      },
    });
    throw new ValidationError('Nominal pembayaran tidak cocok.');
  }

  // Idempotency: only act if order still PENDING and event is PAID
  if (event.status === 'PAID' && order.status === 'PENDING') {
    const now = new Date();
    const startsAt = now;
    const expiresAt = new Date(startsAt.getTime() + order.durationDays * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Update order
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID', paidAt: now, providerReference: event.orderReference },
      });
      // Create or extend subscription
      const existingSub = await tx.subscription.findFirst({
        where: { userId: order.userId, planId: order.planId, status: 'ACTIVE' },
        orderBy: { expiresAt: 'desc' },
      });
      const sub = existingSub
        ? await tx.subscription.update({
            where: { id: existingSub.id },
            data: {
              expiresAt: new Date(
                Math.max(existingSub.expiresAt.getTime(), now.getTime()) + order.durationDays * 24 * 60 * 60 * 1000,
              ),
              status: 'ACTIVE',
            },
          })
        : await tx.subscription.create({
            data: {
              userId: order.userId,
              planId: order.planId,
              status: 'ACTIVE',
              startsAt,
              expiresAt,
            },
          });
      await tx.order.update({ where: { id: order.id }, data: { subscriptionId: sub.id } });
      // Issue a license
      await issueLicense({
        userId: order.userId,
        planId: order.planId,
        durationDays: order.durationDays,
        name: `${order.plan.name} - ${now.toISOString().slice(0, 10)}`,
      });
      // Log payment event
      await tx.paymentEvent.create({
        data: {
          orderId: order.id,
          provider: event.provider,
          providerEventId: event.providerEventId,
          status: event.status,
          payload: event.raw as object,
          processedAt: now,
          result: 'SUCCESS',
        },
      });
    });

    await notify({
      userId: order.userId,
      title: 'Pembayaran terverifikasi',
      body: `Paket ${order.plan.name} telah diaktifkan. Lisensi baru sudah tersedia.`,
      category: 'PAYMENT',
    });
    await recordAudit({
      actorUserId: null,
      action: 'payment.webhook.paid',
      entityType: 'Order',
      entityId: order.id,
      result: 'SUCCESS',
      metadata: { provider: event.provider, eventId: event.providerEventId },
    });
    return { received: true, orderId: order.id, status: 'paid' };
  }

  // Non-PAID or already-processed: just record the event
  await prisma.paymentEvent.create({
    data: {
      orderId: order.id,
      provider: event.provider,
      providerEventId: event.providerEventId,
      status: event.status,
      payload: event.raw as object,
      processedAt: new Date(),
      result: event.status === 'PAID' ? 'SUCCESS' : 'FAILURE',
    },
  });
  if (event.status === 'FAILED' || event.status === 'EXPIRED') {
    await prisma.order.update({ where: { id: order.id }, data: { status: event.status } });
  }
  return { received: true, orderId: order.id, status: event.status.toLowerCase() };
}

void env;
