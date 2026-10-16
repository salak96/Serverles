import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { getStorage } from '../../services/storage/storage.adapter';
import { recordAudit } from '../../services/audit.service';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { formatJakarta } from '../../utils/date';
import { env } from '../../config/env';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

const releaseSchema = z.object({
  toolId: z.string().min(1),
  version: z.string().min(1).max(40),
  releaseNotes: z.string().max(8000).optional(),
});

// Admin: upload a release file
router.post(
  '/releases',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('File wajib diunggah.');
    const body = releaseSchema.parse({ toolId: req.body.toolId, version: req.body.version, releaseNotes: req.body.releaseNotes });
    const tool = await prisma.tool.findUnique({ where: { id: body.toolId } });
    if (!tool) throw new NotFoundError('Tool tidak ditemukan.');
    const storageKey = `tools/${tool.slug}/${body.version}/${req.file.originalname}`;
    const sha256 = createHash('sha256').update(req.file.buffer).digest('hex');
    const storage = getStorage();
    const { Readable } = await import('node:stream');
    const stream = Readable.from(req.file.buffer);
    const uploaded = await storage.putObject(storageKey, { stream, size: req.file.size }).catch((e) => {
      throw new ValidationError(`Upload gagal: ${e instanceof Error ? e.message : 'unknown'}`);
    });
    const release = await prisma.toolRelease.create({
      data: {
        toolId: tool.id,
        version: body.version,
        releaseNotes: body.releaseNotes ?? null,
        fileStorageKey: uploaded.key,
        fileSize: BigInt(uploaded.size),
        sha256,
      },
    });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'tool.release.upload',
      entityType: 'ToolRelease',
      entityId: release.id,
      result: 'SUCCESS',
      metadata: { toolSlug: tool.slug, version: body.version, size: uploaded.size },
    });
    res.status(201).json({
      success: true,
      data: {
        ...release,
        fileSize: Number(release.fileSize),
        releasedAt: formatJakarta(release.releasedAt),
      },
    });
  })
);

// Protected download: requires auth, checks plan requirements
router.get(
  '/:slug/download',
  requireAuth,
  asyncHandler(async (req, res) => {
    const t = await prisma.tool.findUnique({
      where: { slug: req.params.slug },
      include: { requiredPlan: true, releases: { orderBy: { releasedAt: 'desc' } } },
    });
    if (!t || !t.isActive) throw new NotFoundError('Tool tidak ditemukan.');
    const version = (req.query.version as string | undefined) ?? undefined;
    const release = t.releases.find((r) => (version ? r.version === version : true));
    if (!release) throw new NotFoundError('File unduhan belum tersedia.');

    // If tool requires a plan, check user has an active subscription for it
    if (t.requiredPlanId) {
      const sub = await prisma.subscription.findFirst({
        where: { userId: req.user!.id, planId: t.requiredPlanId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
      });
      if (!sub) throw new ValidationError(`Tool ini memerlukan paket ${t.requiredPlan?.name ?? 'khusus'}.`);
    }

    await recordAudit({
      actorUserId: req.user!.id,
      action: 'tool.download',
      entityType: 'ToolRelease',
      entityId: release.id,
      result: 'SUCCESS',
      metadata: { toolSlug: t.slug, version: release.version },
    });

    if (env.STORAGE.PROVIDER === 's3' && getStorage().signedUrl) {
      const url = await getStorage().signedUrl!(release.fileStorageKey, 300);
      return res.json({ success: true, data: { url, expiresIn: 300 } });
    }

    const { stream, size } = await getStorage().getObjectStream(release.fileStorageKey);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `attachment; filename="${t.slug}-${release.version}"`);
    stream.pipe(res);
  })
);

export default router;
