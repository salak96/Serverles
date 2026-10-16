import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { encryptString, decryptString } from '../../services/encryption.service';
import { formatLicenseKey, lastFour, maskLicenseKey, sha256OfKey } from '../../utils/crypto';
import { BusinessError, NotFoundError, ValidationError } from '../../utils/errors';
import { recordAudit } from '../../services/audit.service';

export interface IssuedLicense {
  id: string;
  name: string | null;
  planSlug: string;
  planName: string;
  status: string;
  startsAt: Date;
  expiresAt: Date;
  licenseKey: string; // plaintext — only returned at issuance
  keyMasked: string;
  keyLastFour: string;
}

export async function issueLicense(params: {
  userId: string;
  planId: string;
  durationDays?: number;
  name?: string;
  ip?: string;
  userAgent?: string;
}): Promise<IssuedLicense> {
  const plan = await prisma.plan.findUnique({ where: { id: params.planId } });
  if (!plan || !plan.isActive) throw new NotFoundError('Paket tidak ditemukan atau tidak aktif.');

  const duration = params.durationDays ?? plan.durationDays;
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + duration * 24 * 60 * 60 * 1000);

  const key = formatLicenseKey();
  const keyHash = sha256OfKey(key);
  const keyEncrypted = env.LICENSE_ENCRYPTION_KEY ? encryptString(key) : null;

  const license = await prisma.license.create({
    data: {
      userId: params.userId,
      planId: plan.id,
      name: params.name ?? null,
      keyHash,
      keyEncrypted,
      keyLastFour: lastFour(key),
      status: 'ACTIVE',
      startsAt,
      expiresAt,
    },
    include: { plan: { select: { name: true, slug: true } } },
  });

  await recordAudit({
    actorUserId: params.userId,
    action: 'license.issue',
    entityType: 'License',
    entityId: license.id,
    result: 'SUCCESS',
    ip: params.ip,
    userAgent: params.userAgent,
    metadata: { planSlug: plan.slug, durationDays: duration },
  });

  return {
    id: license.id,
    name: license.name,
    planSlug: license.plan.slug,
    planName: license.plan.name,
    status: license.status,
    startsAt: license.startsAt,
    expiresAt: license.expiresAt,
    licenseKey: key,
    keyMasked: maskLicenseKey(key),
    keyLastFour: license.keyLastFour,
  };
}

export async function revealKeyIfPossible(licenseId: string, requesterId: string, role: 'USER' | 'ADMIN'): Promise<string | null> {
  const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { userId: true, keyEncrypted: true } });
  if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
  if (role !== 'ADMIN' && lic.userId !== requesterId) throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
  if (!lic.keyEncrypted) return null;
  return decryptString(lic.keyEncrypted);
}

export async function revokeLicense(licenseId: string, reason: string, actorId: string | null): Promise<void> {
  await prisma.license.update({
    where: { id: licenseId },
    data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason },
  });
  await recordAudit({
    actorUserId: actorId,
    action: 'license.revoke',
    entityType: 'License',
    entityId: licenseId,
    result: 'SUCCESS',
    metadata: { reason },
  });
}

export async function extendLicense(licenseId: string, days: number, actorId: string | null): Promise<void> {
  const lic = await prisma.license.findUnique({ where: { id: licenseId } });
  if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
  const base = lic.expiresAt > new Date() ? lic.expiresAt : new Date();
  const newExpires = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  await prisma.license.update({
    where: { id: licenseId },
    data: { expiresAt: newExpires, status: 'ACTIVE', revokedAt: null, revokeReason: null },
  });
  await recordAudit({
    actorUserId: actorId,
    action: 'license.extend',
    entityType: 'License',
    entityId: licenseId,
    result: 'SUCCESS',
    metadata: { days, newExpiresAt: newExpires.toISOString() },
  });
}

export async function rotateKey(licenseId: string, actorId: string): Promise<IssuedLicense> {
  const existing = await prisma.license.findUnique({
    where: { id: licenseId },
    include: { plan: { select: { name: true, slug: true } } },
  });
  if (!existing) throw new NotFoundError('Lisensi tidak ditemukan.');
  if (existing.userId !== actorId) throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
  if (existing.status !== 'ACTIVE') throw new ValidationError('Hanya lisensi aktif yang dapat dirotasi.');

  const newKey = formatLicenseKey();
  const newHash = sha256OfKey(newKey);
  const newEncrypted = env.LICENSE_ENCRYPTION_KEY ? encryptString(newKey) : null;

  await prisma.license.update({
    where: { id: licenseId },
    data: { keyHash: newHash, keyEncrypted: newEncrypted, keyLastFour: lastFour(newKey) },
  });

  await recordAudit({
    actorUserId: actorId,
    action: 'license.rotate_key',
    entityType: 'License',
    entityId: licenseId,
    result: 'SUCCESS',
  });

  return {
    id: existing.id,
    name: existing.name,
    planSlug: existing.plan.slug,
    planName: existing.plan.name,
    status: existing.status,
    startsAt: existing.startsAt,
    expiresAt: existing.expiresAt,
    licenseKey: newKey,
    keyMasked: maskLicenseKey(newKey),
    keyLastFour: lastFour(newKey),
  };
}

export function isLicenseActive(license: { status: string; expiresAt: Date }): boolean {
  return license.status === 'ACTIVE' && license.expiresAt > new Date();
}
