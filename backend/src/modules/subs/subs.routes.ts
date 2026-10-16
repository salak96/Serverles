import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { ForbiddenError } from '../../utils/errors';

function requireNonAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role === 'ADMIN') {
    return next(new ForbiddenError('Admin tidak dapat membuat atau mengelola langganan/order.'));
  }
  next();
}
import { makeLimiter } from '../../middleware/rateLimit';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { z } from 'zod';
import { env } from '../../config/env';
import { formatRupiah } from '../../utils/date';
import { handleWebhook } from './subs.webhook';
import { recordAudit } from '../../services/audit.service';

const router = Router();

const checkoutSchema = z.object({
  planId: z.string().min(1),
  durationDays: z.number().int().min(1).max(3650).optional(),
});

const webhookLimiter = makeLimiter({ windowMs: 60_000, max: 120, message: 'Webhook rate limit.' });

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
