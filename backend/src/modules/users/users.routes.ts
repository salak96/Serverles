import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { UnauthorizedError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../../services/audit.service';
import {
  hashPassword,
  revokeAllUserSessions,
  validatePasswordPolicy,
  verifyPassword,
} from '../auth/auth.service';
import { changePasswordSchema, updateProfileSchema } from './users.schema';

const router = Router();

function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') return xf.split(',')[0]?.trim() ?? req.ip ?? '';
  return req.ip ?? '';
}

// GET /api/v1/users/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        emailVerifiedAt: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });
    if (!u) throw new ValidationError('Pengguna tidak ditemukan.');
    res.json({ success: true, data: { ...u, emailVerified: Boolean(u.emailVerifiedAt) } });
  })
);

// PATCH /api/v1/users/me
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = updateProfileSchema.parse(req.body);
    if (!body.name) throw new ValidationError('Tidak ada perubahan.');
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name: body.name },
      select: { id: true, name: true, email: true, role: true, status: true, emailVerifiedAt: true, updatedAt: true },
    });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'user.update_profile',
      entityType: 'User',
      entityId: req.user!.id,
      result: 'SUCCESS',
    });
    res.json({ success: true, data: { ...updated, emailVerified: Boolean(updated.emailVerifiedAt) } });
  })
);

// PATCH /api/v1/users/me/password
router.patch(
  '/me/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    validatePasswordPolicy(body.newPassword);
    const u = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!u) throw new UnauthorizedError('Pengguna tidak ditemukan.');
    const ok = await verifyPassword(u.passwordHash, body.currentPassword);
    if (!ok) throw new UnauthorizedError('Password saat ini salah.');
    const passwordHash = await hashPassword(body.newPassword);
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash } });
    // Revoke other sessions, keep current
    await revokeAllUserSessions(u.id);
    await recordAudit({
      actorUserId: u.id,
      action: 'user.change_password',
      entityType: 'User',
      entityId: u.id,
      result: 'SUCCESS',
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });
    res.json({ success: true, data: { message: 'Password berhasil diubah. Silakan masuk ulang.' } });
  })
);

// GET /api/v1/users/me/activity
router.get(
  '/me/activity',
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const logs = await prisma.auditLog.findMany({
      where: { actorUserId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, action: true, entityType: true, result: true, createdAt: true, ip: true },
    });
    res.json({ success: true, data: logs });
  })
);

// DELETE /api/v1/users/me/activity
router.delete(
  '/me/activity',
  requireAuth,
  asyncHandler(async (req, res) => {
    const olderThanDays = Math.min(Math.max(Number(req.query.olderThanDays) || 7, 0), 365);
    const cutoff = olderThanDays > 0 ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) : null;
    const { count } = await prisma.auditLog.deleteMany({
      where: { actorUserId: req.user!.id, ...(cutoff ? { createdAt: { lt: cutoff } } : {}) },
    });
    res.json({ success: true, data: { deleted: count, olderThanDays } });
  })
);

// POST /api/v1/users/me/activity/purge (alias for explicit purge)
router.post(
  '/me/activity/purge',
  requireAuth,
  asyncHandler(async (req, res) => {
    const olderThanDays = Math.min(Math.max(Number(req.body?.olderThanDays) || 7, 0), 365);
    const cutoff = olderThanDays > 0 ? new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000) : null;
    const { count } = await prisma.auditLog.deleteMany({
      where: { actorUserId: req.user!.id, ...(cutoff ? { createdAt: { lt: cutoff } } : {}) },
    });
    res.json({ success: true, data: { deleted: count, olderThanDays } });
  })
);

export default router;
