import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { optionalAuth, requireAdmin } from '../../middleware/auth';
import { formatRupiah } from '../../utils/date';

const router = Router();

// GET /api/v1/plans
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        price: true,
        currency: true,
        durationDays: true,
        maxDevices: true,
        features: true,
        availableDurations: true,
        sortOrder: true,
      },
    });
    res.json({
      success: true,
      data: plans.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: Number(p.price),
        priceFormatted: formatRupiah(Number(p.price)),
        currency: p.currency,
        durationDays: p.durationDays,
        maxDevices: p.maxDevices,
        features: p.features,
        availableDurations: p.availableDurations,
      })),
    });
  })
);

// GET /api/v1/plans/:slug
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const p = await prisma.plan.findUnique({ where: { slug: req.params.slug } });
    if (!p || !p.isActive) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Paket tidak ditemukan.' } });
    res.json({
      success: true,
      data: {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: Number(p.price),
        priceFormatted: formatRupiah(Number(p.price)),
        currency: p.currency,
        durationDays: p.durationDays,
        maxDevices: p.maxDevices,
        features: p.features,
        availableDurations: p.availableDurations,
      },
    });
  })
);

// POST /api/v1/admin/plans
router.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const p = await prisma.plan.create({ data: req.body });
    res.status(201).json({ success: true, data: p });
  })
);

// PATCH /api/v1/admin/plans/:id
router.patch(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const p = await prisma.plan.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: p });
  })
);

void prisma;
export default router;
