import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { optionalAuth, requireAuth, requireAdmin } from '../../middleware/auth';
import { BusinessError, NotFoundError } from '../../utils/errors';
import { z } from 'zod';
import { getStorage } from '../../services/storage/storage.adapter';
import { env } from '../../config/env';
import { ValidationError } from '../../utils/errors';
import { recordAudit } from '../../services/audit.service';

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
        downloadUrl: t.downloadUrl,
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
    const tool = await prisma.tool.findUnique({
      where: { slug: req.params.slug },
      include: { requiredPlan: true, releases: { orderBy: { releasedAt: 'desc' } } },
    });
    if (!tool || !tool.isActive) throw new NotFoundError('Tool tidak ditemukan.');
    const version = typeof req.query.version === 'string' ? req.query.version : undefined;
    const release = tool.releases.find((candidate) => !version || candidate.version === version);
    if (!release) throw new NotFoundError('File unduhan belum tersedia.');

    if (tool.requiredPlanId) {
      const subscription = await prisma.subscription.findFirst({
        where: { userId: req.user!.id, planId: tool.requiredPlanId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      });
      if (!subscription) throw new ValidationError(`Tool ini memerlukan paket ${tool.requiredPlan?.name ?? 'khusus'}.`);
    }

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'tool.download',
      entityType: 'ToolRelease',
      entityId: release.id,
      result: 'SUCCESS',
      metadata: { toolSlug: tool.slug, version: release.version },
    });

    if (env.STORAGE.PROVIDER === 's3' && getStorage().signedUrl) {
      const url = await getStorage().signedUrl!(release.fileStorageKey, 300);
      return res.redirect(302, url);
    }

    const { stream, size } = await getStorage().getObjectStream(release.fileStorageKey);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename="${tool.slug}-${release.version}"`);
    stream.pipe(res);
  })
);

// Admin CRUD
const toolCreateSchema = z.object({
  name: z.string().trim().min(2, 'Nama tool wajib diisi (minimal 2 karakter).').max(120),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda strip.'),
  description: z.string().trim().min(1, 'Deskripsi wajib diisi.').max(10000, 'Deskripsi maksimal 10.000 karakter.'),
  category: z.string().trim().min(2, 'Kategori wajib diisi (minimal 2 karakter).').max(60),
  iconUrl: z.union([z.literal(''), z.string().url().max(255)]).optional(),
  downloadUrl: z.string().trim().min(1, 'Link download wajib diisi.').url('Link download harus berupa URL lengkap, misalnya https://drive.google.com/...').max(2048, 'Link download maksimal 2.048 karakter.'),
  isActive: z.boolean({ required_error: 'Status aktif wajib dipilih.' }),
  requiredPlanId: z.string().optional(),
  minAppVersion: z.string().max(40).optional(),
});

const toolUpdateSchema = toolCreateSchema;

router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = toolCreateSchema.parse(req.body);
    const duplicate = await prisma.tool.findFirst({ where: { OR: [{ slug: body.slug }, { name: body.name }] } });
    if (duplicate) {
      throw new BusinessError(
        duplicate.slug === body.slug ? 'Slug tool sudah digunakan.' : 'Nama tool sudah digunakan.',
        'TOOL_ALREADY_EXISTS',
        409,
      );
    }
    const { iconUrl: _iconUrl, ...toolData } = body;
    const t = await prisma.tool.create({ data: toolData }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new BusinessError('Nama atau slug tool sudah digunakan.', 'TOOL_ALREADY_EXISTS', 409);
      }
      throw error;
    });
    res.status(201).json({ success: true, data: t });
  })
);

router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = toolUpdateSchema.parse(req.body);
    if (body.name || body.slug) {
      const duplicate = await prisma.tool.findFirst({
        where: {
          id: { not: req.params.id },
          OR: [
            ...(body.name ? [{ name: body.name }] : []),
            ...(body.slug ? [{ slug: body.slug }] : []),
          ],
        },
      });
      if (duplicate) {
        throw new BusinessError(
          body.slug && duplicate.slug === body.slug ? 'Slug tool sudah digunakan.' : 'Nama tool sudah digunakan.',
          'TOOL_ALREADY_EXISTS',
          409,
        );
      }
    }
    const { iconUrl: _iconUrl, ...data } = body;
    const t = await prisma.tool.update({ where: { id: req.params.id }, data }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw new BusinessError('Nama atau slug tool sudah digunakan.', 'TOOL_ALREADY_EXISTS', 409);
      }
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new NotFoundError('Tool tidak ditemukan.');
      }
      throw error;
    });
    res.json({ success: true, data: t });
  })
);

router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const body = toolUpdateSchema.parse(req.body);
    const { iconUrl: _iconUrl, ...data } = body;
    const t = await prisma.tool.update({ where: { id: req.params.id }, data }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
        throw new NotFoundError('Tool tidak ditemukan.');
      }
      throw error;
    });
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
