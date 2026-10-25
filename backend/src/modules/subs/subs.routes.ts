import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { BusinessError, ForbiddenError } from '../../utils/errors';
import { makeLimiter } from '../../middleware/rateLimit';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { z } from 'zod';
import { env } from '../../config/env';
import { formatRupiah } from '../../utils/date';
import { handleWebhook } from './subs.webhook';
import { recordAudit } from '../../services/audit.service';
import { notifyTelegramNewOrder } from '../../services/telegram.service';
import { notifyMany, notify } from '../../services/notification.service';
import { issueLicense } from '../licenses/licenses.service';
import { hmacClientIp } from '../../utils/crypto';

function requireNonAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role === 'ADMIN') {
    return next(new ForbiddenError('Admin tidak dapat membuat atau mengelola langganan/order.'));
  }
  next();
}
const router = Router();

const checkoutSchema = z.object({
  planId: z.string().min(1),
  durationDays: z.number().int().min(1).max(3650).optional(),
});

const webhookLimiter = makeLimiter({ windowMs: 60_000, max: 120, message: 'Webhook rate limit.' });

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? req.ip ?? '';
  return req.ip ?? '';
}

// GET /api/v1/subscriptions/me
router.get(
  '/me',
  requireAuth,
  requireNonAdmin,
  asyncHandler(async (req, res) => {
    const subs = await prisma.subscription.findMany({
      where: { userId: req.user!.id },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: subs });
  })
);

// GET /api/v1/subscriptions/orders
router.get(
  '/orders',
  requireAuth,
  requireNonAdmin,
  asyncHandler(async (req, res) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user!.id },
      include: { plan: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: orders.map((o) => ({
        ...o,
        amountFormatted: formatRupiah(Number(o.amount)),
      })),
    });
  })
);

// GET /api/v1/subscriptions/orders/:id
router.get(
  '/orders/:id',
  requireAuth,
  requireNonAdmin,
  asyncHandler(async (req, res) => {
    const o = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { plan: true },
    });
    if (!o) throw new NotFoundError('Order tidak ditemukan.');
    if (o.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new ValidationError('Tidak diizinkan.');
    res.json({ success: true, data: { ...o, amountFormatted: formatRupiah(Number(o.amount)) } });
  })
);

// POST /api/v1/subscriptions/checkout
router.post(
  '/checkout',
  requireAuth,
  requireNonAdmin,
  asyncHandler(async (req, res) => {
    const body = checkoutSchema.parse(req.body);
    const plan = await prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan || !plan.isActive) throw new NotFoundError('Paket tidak ditemukan.');

    const duration = body.durationDays ?? plan.durationDays;
    // Compute price: use availableDurations override if provided, else price * (duration/planDurationDays)
    const durations = (plan.availableDurations as Array<{ days: number; price: number; label?: string }>) ?? [];
    const override = durations.find((d) => d.days === duration);
    const basePrice = override ? override.price : Number(plan.price) * (duration / plan.durationDays);

    const isFreePlan = plan.slug.toLowerCase() === 'free' || Number(plan.price) === 0;
    if (isFreePlan) {
      const ip = clientIp(req);
      if (env.FREE_PLAN_SINGLE_CLAIM_PER_IP && ip && ip !== 'unknown') {
        const claimKey = `free-ip-claim:${hmacClientIp(ip)}`;
        const previousIpClaim = await prisma.appSetting.findUnique({ where: { key: claimKey }, select: { id: true } });
        if (previousIpClaim) {
          throw new BusinessError('Paket Free sudah pernah diambil dari jaringan ini.', 'FREE_PLAN_IP_ALREADY_CLAIMED', 409);
        }
      }
      const existingFreeOrder = await prisma.order.findFirst({
        where: {
          userId: req.user!.id,
          OR: [
            { planId: plan.id },
            { metadata: { path: '$.planSlug', equals: plan.slug } },
          ],
        },
        select: { id: true },
      });
      const existingFreeSubscription = await prisma.subscription.findFirst({ where: { userId: req.user!.id, planId: plan.id }, select: { id: true } });
      if (existingFreeOrder || existingFreeSubscription) {
        throw new BusinessError('Paket Free hanya dapat diambil satu kali per akun.', 'FREE_PLAN_ALREADY_CLAIMED', 409);
      }
      const freeClaimKey = `free-claim:${req.user!.id}:${plan.id}`;
      try {
        await prisma.appSetting.create({ data: { key: freeClaimKey, value: { claimedAt: new Date().toISOString() }, updatedBy: req.user!.id } });
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          throw new BusinessError('Paket Free hanya dapat diambil satu kali per akun.', 'FREE_PLAN_ALREADY_CLAIMED', 409);
        }
        throw error;
      }

      const freeIpClaimKey = env.FREE_PLAN_SINGLE_CLAIM_PER_IP && ip && ip !== 'unknown'
        ? `free-ip-claim:${hmacClientIp(ip)}`
        : null;
      if (freeIpClaimKey) {
        try {
          await prisma.appSetting.create({ data: { key: freeIpClaimKey, value: { claimedAt: new Date().toISOString() }, updatedBy: req.user!.id } });
        } catch (error) {
          await prisma.appSetting.delete({ where: { key: freeClaimKey } }).catch(() => undefined);
          if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            throw new BusinessError('Paket Free sudah pernah diambil dari jaringan ini.', 'FREE_PLAN_IP_ALREADY_CLAIMED', 409);
          }
          throw error;
        }
      }

      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
        const order = await prisma.order.create({
          data: {
            userId: req.user!.id,
            planId: plan.id,
            amount: 0,
            currency: plan.currency,
            status: 'PAID',
            provider: 'free',
            durationDays: duration,
            paidAt: now,
            expiresAt,
            metadata: { planSlug: plan.slug, planName: plan.name, freeClaim: true } as object,
          },
        });
        const subscription = await prisma.subscription.create({
          data: { userId: req.user!.id, planId: plan.id, status: 'ACTIVE', startsAt: now, expiresAt },
        });
        await issueLicense({
          userId: req.user!.id,
          planId: plan.id,
          durationDays: duration,
          name: `${plan.name} - ${now.toISOString().slice(0, 10)}`,
          ip: clientIp(req),
          userAgent: (req.headers['user-agent'] as string) ?? '',
        });
        await prisma.order.update({ where: { id: order.id }, data: { subscriptionId: subscription.id } });
        await notify({ userId: req.user!.id, title: 'Paket Free diaktifkan', body: `Paket ${plan.name} aktif selama ${duration} hari. Lisensi Anda sudah tersedia.`, category: 'SUBSCRIPTION' });
        await recordAudit({ actorUserId: req.user!.id, action: 'subscription.free.claim', entityType: 'Order', entityId: order.id, result: 'SUCCESS', ip: clientIp(req) });
        return res.status(201).json({
          success: true,
          data: {
            freePlan: true,
            order: { id: order.id, amount: 0, amountFormatted: formatRupiah(0), currency: order.currency, status: order.status, durationDays: duration, expiresAt, plan: { name: plan.name, slug: plan.slug } },
            payment: { provider: 'free', configured: true, message: 'Paket Free dan lisensi berhasil diaktifkan.' },
          },
        });
      } catch (error) {
        await prisma.appSetting.delete({ where: { key: freeClaimKey } }).catch(() => undefined);
        if (freeIpClaimKey) await prisma.appSetting.delete({ where: { key: freeIpClaimKey } }).catch(() => undefined);
        throw error;
      }
    }

    const provider = env.PAYMENT.PROVIDER;
    const now = new Date();
    const existingPending = await prisma.order.findFirst({
      where: {
        userId: req.user!.id,
        status: 'PENDING',
        expiresAt: { gt: now },
      },
      include: { plan: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending) {
      return res.status(200).json({
        success: true,
        data: {
          reused: true,
          order: {
            id: existingPending.id,
            amount: Number(existingPending.amount),
            amountFormatted: formatRupiah(Number(existingPending.amount)),
            currency: existingPending.currency,
            status: existingPending.status,
            provider: existingPending.provider,
            durationDays: existingPending.durationDays,
            expiresAt: existingPending.expiresAt,
            plan: existingPending.plan,
          },
          payment: {
            provider: existingPending.provider,
            configured: existingPending.provider !== 'manual' && Boolean(env.PAYMENT.API_KEY),
            message: 'Anda sudah memiliki order PENDING. Lanjutkan pembayaran pada order yang sama.',
          },
        },
      });
    }

    const order = await prisma.order.create({
      data: {
        userId: req.user!.id,
        planId: plan.id,
        amount: basePrice,
        currency: plan.currency,
        status: 'PENDING',
        provider,
        providerReference: null,
        durationDays: duration,
        metadata: { planSlug: plan.slug, planName: plan.name } as object,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    await notifyTelegramNewOrder({
      orderId: order.id,
      customerEmail: req.user!.email,
      planName: plan.name,
      durationDays: order.durationDays,
      amountFormatted: formatRupiah(Number(order.amount)),
    });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await notifyMany(admins.map((admin) => admin.id), {
      title: 'Pembayaran menunggu verifikasi',
      body: `${req.user!.email} membuat order ${plan.name} (${duration} hari) sebesar ${formatRupiah(Number(order.amount))}.`,
      category: 'PAYMENT',
      link: '/admin/orders',
    });

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order.id,
          amount: Number(order.amount),
          amountFormatted: formatRupiah(Number(order.amount)),
          currency: order.currency,
          status: order.status,
          provider: order.provider,
          durationDays: order.durationDays,
          expiresAt: order.expiresAt,
          plan: { name: plan.name, slug: plan.slug },
        },
        payment: {
          provider,
          configured: provider !== 'manual' && Boolean(env.PAYMENT.API_KEY),
          message:
            provider === 'manual'
              ? 'Pembayaran online belum dikonfigurasi. Hubungi admin untuk aktivasi manual.'
              : 'Gateway pembayaran akan diintegrasikan pada FASE 7.',
        },
      },
    });
  })
);

// POST /api/v1/subscriptions/webhook (public, provider-signed)
router.post(
  '/webhook',
  webhookLimiter,
  asyncHandler(async (req: Request, res) => {
    const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body ?? {});
    const signature = (req.headers['x-signature'] as string | undefined) ?? (req.headers['x-callback-signature'] as string | undefined);
    try {
      const result = await handleWebhook(rawBody, signature, req.headers as Record<string, string | string[] | undefined>);
      res.json({ success: true, data: result });
    } catch (e) {
      await recordAudit({
        actorUserId: null,
        action: 'payment.webhook.failed',
        entityType: 'Order',
        entityId: null,
        result: 'FAILURE',
        metadata: { error: e instanceof Error ? e.message : 'unknown' },
        ip: req.ip ?? '',
      });
      throw e;
    }
  })
);

export default router;
void env;
