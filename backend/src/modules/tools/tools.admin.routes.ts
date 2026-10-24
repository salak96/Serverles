import { Router } from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
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
const iconTypes = {
  'image/png': { extension: 'png', signature: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/jpeg': { extension: 'jpg', signature: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9 },
  'image/webp': { extension: 'webp', signature: (b: Buffer) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.trim()) {
      callback(new ValidationError('Nama file rilis tidak valid.'));
      return;
    }
    callback(null, true);
  },
});
const iconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!Object.hasOwn(iconTypes, file.mimetype)) {
      callback(new ValidationError('Format gambar tidak didukung. Pilih file PNG, JPG, atau WebP.'));
      return;
    }
    callback(null, true);
  },
});

// Backward compatibility for icons uploaded before URLs included their stored filename.
router.get(
  '/:slug/icon.:extension',
  asyncHandler(async (req, res) => {
    const extension = req.params.extension;
    if (!['png', 'jpg', 'webp'].includes(extension) || env.STORAGE.PROVIDER !== 'local') {
      throw new NotFoundError('Ikon tool tidak ditemukan. Unggah ulang ikon tool ini.');
    }
    const tool = await prisma.tool.findUnique({ where: { slug: req.params.slug }, select: { id: true, iconUrl: true } });
    if (!tool?.iconUrl) throw new NotFoundError('Ikon tool tidak ditemukan. Unggah ulang ikon tool ini.');

    const directory = join(env.STORAGE.LOCAL_DIR, 'tool-icons');
    const files = await readdir(directory).catch(() => []);
    const prefix = `${tool.id}-`;
    const filename = files.find((file) => file.startsWith(prefix) && file.endsWith(`.${extension}`));
    if (!filename) throw new NotFoundError('File ikon lama tidak ditemukan. Unggah ulang ikon tool ini.');

    const { stream, size } = await getStorage().getObjectStream(`tool-icons/${filename}`);
    res.setHeader('Content-Type', extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    stream.pipe(res);
  })
);

// Public tool icon image
router.get(
  '/:slug/icon/:filename',
  asyncHandler(async (req, res) => {
    const tool = await prisma.tool.findUnique({ where: { slug: req.params.slug }, select: { iconUrl: true } });
    if (!tool?.iconUrl) throw new NotFoundError('Ikon tool tidak ditemukan.');
    const filename = req.params.filename;
    const storedFilename = tool.iconUrl.split('/').pop();
    const match = /^([a-zA-Z0-9-]+)\.(png|jpg|webp)$/.exec(filename);
    if (!match || storedFilename !== filename) throw new NotFoundError('Ikon tool tidak ditemukan.');
    const [, , extension] = match;
    const { stream, size } = await getStorage().getObjectStream(`tool-icons/${filename}`);
    res.setHeader('Content-Type', extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    stream.pipe(res);
  })
);

// Admin: upload or replace a tool icon
router.post(
  '/:id/icon',
  requireAuth,
  requireAdmin,
  iconUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('Pilih file gambar terlebih dahulu.');
    const type = iconTypes[req.file.mimetype as keyof typeof iconTypes];
    if (!type || !type.signature(req.file.buffer)) {
      throw new ValidationError('Format gambar tidak didukung. Gunakan PNG, JPG, atau WebP yang valid.');
    }
    const tool = await prisma.tool.findUnique({ where: { id: req.params.id } });
    if (!tool) throw new NotFoundError('Tool tidak ditemukan.');

    const key = `${tool.id}-${createHash('sha256').update(req.file.buffer).digest('hex').slice(0, 16)}.${type.extension}`;
    try {
      await getStorage().putObject(`tool-icons/${key}`, { stream: Readable.from(req.file.buffer), size: req.file.size });
    } catch (error) {
      throw new ValidationError(`Gagal menyimpan gambar ikon: ${error instanceof Error ? error.message : 'penyimpanan tidak tersedia.'}`);
    }
    const iconUrl = `/api/v1/tools/${tool.slug}/icon/${key}`;
    try {
      await prisma.tool.update({ where: { id: tool.id }, data: { iconUrl } });
    } catch (error) {
      await getStorage().deleteObject(`tool-icons/${key}`).catch(() => undefined);
      throw error;
    }
    if (tool.iconUrl) {
      const previousKey = tool.iconUrl.split('/').pop();
      if (previousKey && previousKey !== key) await getStorage().deleteObject(`tool-icons/${previousKey}`);
    }
    res.json({ success: true, data: { iconUrl } });
  })
);

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
