import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { optionalAuth, requireAuth, requireAdmin } from '../../middleware/auth';
import { NotFoundError } from '../../utils/errors';
import { z } from 'zod';

const router = Router();

// GET /api/v1/tools
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string | undefined)?.trim();
    const category = req.query.category as string | undefined;
    const plan = req.query.plan as string | undefined;
    const sort = (req.query.sort as string | undefined) ?? 'newest';
    const where: Record<string, unknown> = { isActive: true };
    if (category) where['category'] = category;
    if (plan) where['requiredPlan'] = { slug: plan };
    if (search) where['OR'] = [{ name: { contains: search } }, { description: { contains: search } }];
    const orderBy = sort === 'name' ? { name: 'asc' as const } : { createdAt: 'desc' as const };
    const tools = await prisma.tool.findMany({
      where, orderBy,
      include: { releases: { orderBy: { releasedAt: 'desc' }, take: 1 }, requiredPlan: { select: { name: true, slug: true } } },
    });
    res.json({
      success: true,
      data: tools.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        category: t.category,
        iconUrl: t.iconUrl,
        requiredPlan: t.requiredPlan,
        minAppVersion: t.minAppVersion,
        latestRelease: t.releases[0]
          ? { version: t.releases[0].version, releasedAt: t.releases[0].releasedAt, fileSize: Number(t.releases[0].fileSize) }
          : null,
        isActive: t.isActive,
        updatedAt: t.updatedAt,
      })),
    });
  })
);

// GET /api/v1/tools/:slug
router.get(
  '/:slug',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const t = await prisma.tool.findUnique({
      where: { slug: req.params.slug },
      include: { releases: { orderBy: { releasedAt: 'desc' } }, requiredPlan: true },
    });
    if (!t || !t.isActive) throw new NotFoundError('Tool tidak ditemukan.');
    res.json({ success: true, data: t });
  })
);

// GET /api/v1/tools/:slug/releases
router.get(
  '/:slug/releases',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const t = await prisma.tool.findUnique({ where: { slug: req.params.slug } });
    if (!t) throw new NotFoundError('Tool tidak ditemukan.');
    const releases = await prisma.toolRelease.findMany({
      where: { toolId: t.id }, orderBy: { releasedAt: 'desc' },
    });
    res.json({ success: true, data: releases });
  })
);

// GET /api/v1/tools/:slug/download?version=...
router.get(
  '/:slug/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const t = await prisma.tool.findUnique({ where: { slug: req.params.slug } });
    if (!t) throw new NotFoundError('Tool tidak ditemukan.');
    const version = (req.query.version as string | undefined) ?? undefined;
    const release = await prisma.toolRelease.findFirst({
      where: { toolId: t.id, ...(version ? { version } : {}) },
      orderBy: { releasedAt: 'desc' },
    });
    if (!release) {
      return res.status(404).json({
        success: false,
        error: { code: 'RELEASE_NOT_FOUND', message: 'File unduhan belum tersedia.' },
      });
    }
    // For FASE 7 we wire the storage adapter; for now we expose metadata.
    res.json({
      success: true,
      data: {
        tool: { id: t.id, slug: t.slug, name: t.name },
        release: {
          version: release.version,
          fileSize: Number(release.fileSize),
          sha256: release.sha256,
          releasedAt: release.releasedAt,
        },
        download: {
          available: false,
          message: 'Unduhan belum dikonfigurasi oleh administrator.',
        },
      },
    });
  })
);

// Admin CRUD
const toolCreateSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda strip.'),
  description: z.string().optional(),
  category: z.string().min(2).max(60),
  iconUrl: z.string().url().max(255).optional(),
  requiredPlanId: z.string().optional(),
  minAppVersion: z.string().max(40).optional(),
  isActive: z.boolean().optional(),
});

router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = toolCreateSchema.parse(req.body);
    const t = await prisma.tool.create({ data: body });
    res.status(201).json({ success: true, data: t });
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const t = await prisma.tool.update({ where: { id: req.params.id }, data: req.body });
    res.json({ success: true, data: t });
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    await prisma.tool.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ success: true, data: { message: 'Tool diarsipkan.' } });
  })
);

export default router;
