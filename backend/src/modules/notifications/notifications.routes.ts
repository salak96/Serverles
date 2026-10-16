import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { NotFoundError, ValidationError } from '../../utils/errors';

const router = Router();

// GET /api/v1/notifications
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const category = req.query.category as string | undefined;
    const where = {
      OR: [{ userId: req.user!.id }, { userId: null }],
      ...(category ? { category: category as never } : {}),
    };
    const [items, total, unread] = await Promise.all([
      prisma.notification.findMany({
        where, orderBy: { publishedAt: 'desc' }, skip, take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { OR: [{ userId: req.user!.id }, { userId: null }], readAt: null } }),
    ]);
    res.json({
      success: true,
      data: { items, page, limit, total, unread },
    });
  })
);

// PATCH /api/v1/notifications/:id/read
router.patch(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req, res) => {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!n) throw new NotFoundError('Notifikasi tidak ditemukan.');
    if (n.userId && n.userId !== req.user!.id) throw new ValidationError('Tidak diizinkan.');
    await prisma.notification.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
    res.json({ success: true, data: { message: 'Notifikasi ditandai dibaca.' } });
  })
);

// POST /api/v1/notifications/read-all
router.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.notification.updateMany({
      where: { OR: [{ userId: req.user!.id }, { userId: null }], readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ success: true, data: { message: 'Semua notifikasi ditandai dibaca.' } });
  })
);

export default router;
