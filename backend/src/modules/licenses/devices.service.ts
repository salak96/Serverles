import { prisma } from '../../config/prisma';
import { hmacDeviceId } from '../../utils/crypto';
import { NotFoundError, BusinessError } from '../../utils/errors';
import { recordAudit } from '../../services/audit.service';
import { checkResetQuota, getPlanResetPolicy } from '../../services/resetPolicy.service';
import { notify } from '../../services/notification.service';
import { Prisma } from '@prisma/client';

export interface ActivationResult {
  status: 'ok' | 'already_bound' | 'limit_reached' | 'license_inactive' | 'cooldown_active';
  created: boolean;
  nextAvailableAt?: Date;
  device: {
    id: string;
    deviceHash: string;
    deviceName: string | null;
    platform: string | null;
    appVersion: string | null;
    boundAt: Date;
    lastSeenAt: Date;
  };
}

export async function activateDeviceAtomic(params: {
  licenseId: string;
  deviceIdRaw: string;
  deviceName?: string;
  platform?: string;
  appVersion?: string;
  ip?: string;
  userAgent?: string;
}): Promise<ActivationResult> {
  const license = await prisma.license.findUnique({
    where: { id: params.licenseId },
    include: { plan: true, user: { select: { emailVerifiedAt: true, status: true } } },
  });
  if (!license) throw new NotFoundError('Lisensi tidak ditemukan.');
  if (license.status !== 'ACTIVE' || license.expiresAt <= new Date()) {
    return { status: 'license_inactive', created: false, device: emptyDevice() };
  }
  if (license.user.status !== 'ACTIVE' || !license.user.emailVerifiedAt) {
    return { status: 'license_inactive', created: false, device: emptyDevice() };
  }

  const deviceHash = hmacDeviceId(params.deviceIdRaw);
  const maxDevices = license.plan.maxDevices;

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.device.findUnique({
      where: { licenseId_deviceHash: { licenseId: license.id, deviceHash } },
    });
    if (existing && existing.status === 'ACTIVE') {
      const updated = await tx.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), deviceName: params.deviceName ?? existing.deviceName, appVersion: params.appVersion ?? existing.appVersion, platform: params.platform ?? existing.platform },
      });
      await recordActivationAttempt(tx, { licenseId: license.id, deviceHash, result: 'SUCCESS', reasonCode: 'ALREADY_BOUND', ip: params.ip, userAgent: params.userAgent });
      return { status: 'already_bound', created: false, device: toDeviceDto(updated) };
    }

    const lastCompletedReset = await tx.deviceReset.findFirst({
      where: { licenseId: license.id, status: 'COMPLETED', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });
    const nextAvailableAt = lastCompletedReset?.completedAt
      ? new Date(lastCompletedReset.completedAt.getTime() + 12 * 60 * 60 * 1000)
      : undefined;
    if (nextAvailableAt && nextAvailableAt > new Date()) {
      await recordActivationAttempt(tx, { licenseId: license.id, deviceHash, result: 'FAILURE', reasonCode: 'RESET_COOLDOWN_ACTIVE', ip: params.ip, userAgent: params.userAgent });
      return { status: 'cooldown_active', created: false, nextAvailableAt, device: emptyDevice() };
    }

    const activeCount = await tx.device.count({ where: { licenseId: license.id, status: 'ACTIVE' } });
    if (activeCount >= maxDevices) {
      await recordActivationAttempt(tx, { licenseId: license.id, deviceHash, result: 'FAILURE', reasonCode: 'DEVICE_LIMIT_REACHED', ip: params.ip, userAgent: params.userAgent });
      return { status: 'limit_reached', created: false, device: emptyDevice() };
    }
    if (existing) {
      const rebound = await tx.device.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          boundAt: new Date(),
          lastSeenAt: new Date(),
          unboundAt: null,
          deviceName: params.deviceName ?? existing.deviceName,
          appVersion: params.appVersion ?? existing.appVersion,
          platform: params.platform ?? existing.platform,
        },
      });
      await recordActivationAttempt(tx, { licenseId: license.id, deviceHash, result: 'SUCCESS', reasonCode: 'REBOUND', ip: params.ip, userAgent: params.userAgent });
      return { status: 'ok', created: false, device: toDeviceDto(rebound) };
    }
    const created = await tx.device.create({
      data: {
        licenseId: license.id,
        userId: license.userId,
        deviceHash,
        deviceName: params.deviceName ?? null,
        platform: params.platform ?? null,
        appVersion: params.appVersion ?? null,
        status: 'ACTIVE',
      },
    });
    await recordActivationAttempt(tx, { licenseId: license.id, deviceHash, result: 'SUCCESS', reasonCode: 'NEW_BIND', ip: params.ip, userAgent: params.userAgent });
    return { status: 'ok', created: true, device: toDeviceDto(created) };
  });
}

async function recordActivationAttempt(
  tx: Prisma.TransactionClient,
  p: { licenseId: string; deviceHash: string; result: string; reasonCode?: string; ip?: string; userAgent?: string }
): Promise<void> {
  await tx.licenseActivationAttempt.create({
    data: {
      licenseId: p.licenseId,
      deviceHash: p.deviceHash,
      result: p.result,
      reasonCode: p.reasonCode ?? null,
      ip: p.ip ?? null,
      userAgent: p.userAgent?.slice(0, 254) ?? null,
    },
  });
}

function toDeviceDto(d: {
  id: string;
  deviceHash: string;
  deviceName: string | null;
  platform: string | null;
  appVersion: string | null;
  boundAt: Date;
  lastSeenAt: Date;
}): ActivationResult['device'] {
  return {
    id: d.id,
    deviceHash: d.deviceHash,
    deviceName: d.deviceName,
    platform: d.platform,
    appVersion: d.appVersion,
    boundAt: d.boundAt,
    lastSeenAt: d.lastSeenAt,
  };
}

function emptyDevice(): ActivationResult['device'] {
  return {
    id: '',
    deviceHash: '',
    deviceName: null,
    platform: null,
    appVersion: null,
    boundAt: new Date(0),
    lastSeenAt: new Date(0),
  };
}

export async function unbindDevice(licenseId: string, deviceId: string, actorId: string, isAdmin: boolean): Promise<void> {
  const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { userId: true } });
  if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
  if (!isAdmin && lic.userId !== actorId) throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
  const dev = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!dev || dev.licenseId !== licenseId) throw new NotFoundError('Perangkat tidak ditemukan.');
  await prisma.device.update({ where: { id: deviceId }, data: { status: 'UNBOUND', unboundAt: new Date() } });
  await recordAudit({
    actorUserId: actorId,
    action: 'device.unbind',
    entityType: 'Device',
    entityId: deviceId,
    result: 'SUCCESS',
  });
}

export async function resetDevice(params: {
  licenseId: string;
  deviceId?: string;
  requestedById: string;
  isAdmin: boolean;
  reason?: string;
  ip?: string;
  userAgent?: string;
}): Promise<{ resetId: string; status: 'COMPLETED' | 'PENDING' }> {
  const lic = await prisma.license.findUnique({ where: { id: params.licenseId }, include: { user: true, plan: true } });
  if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
  if (!params.isAdmin && lic.userId !== params.requestedById) throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
  const policy = await getPlanResetPolicy(lic.planId);
  if (policy.requireAdmin && !params.isAdmin) {
    throw new BusinessError('Reset perangkat memerlukan persetujuan admin untuk paket ini.', 'ADMIN_REQUIRED', 403);
  }
  const quota = await checkResetQuota(lic.id);
  if (!quota.allowed) {
    throw new BusinessError(quota.reason ?? 'Reset tidak diizinkan.', 'RESET_NOT_ALLOWED', 400, quota);
  }

  // Identify device to unbind (either specific or the oldest active)
  let device: { id: string } | null = null;
  if (params.deviceId) {
    const d = await prisma.device.findUnique({ where: { id: params.deviceId } });
    if (!d || d.licenseId !== lic.id) throw new NotFoundError('Perangkat tidak ditemukan.');
    device = d;
  } else {
    device = await prisma.device.findFirst({
      where: { licenseId: lic.id, status: 'ACTIVE' },
      orderBy: { boundAt: 'asc' },
    });
  }

  const resetRecord = await prisma.deviceReset.create({
    data: {
      licenseId: lic.id,
      deviceId: device?.id ?? null,
      requestedById: params.requestedById,
      reason: params.reason ?? null,
      status: (policy.requireAdmin ? 'PENDING' : 'COMPLETED') as 'PENDING' | 'COMPLETED',
      completedAt: policy.requireAdmin ? null : new Date(),
    },
  });

  if (!policy.requireAdmin && device) {
    await prisma.device.update({ where: { id: device.id }, data: { status: 'UNBOUND', unboundAt: new Date() } });
    await notify({
      userId: lic.userId,
      title: 'Reset perangkat berhasil',
      body: device ? 'Satu slot perangkat pada lisensi Anda telah dilepas. Anda dapat mengaktifkan perangkat baru.' : 'Kuota reset perangkat Anda bertambah.',
      category: 'DEVICE',
    });
  } else {
    await notify({
      userId: lic.userId,
      title: 'Permintaan reset perangkat menunggu persetujuan',
      body: 'Permintaan reset perangkat Anda menunggu persetujuan admin.',
      category: 'DEVICE',
    });
  }

  await recordAudit({
    actorUserId: params.requestedById,
    action: 'device.reset',
    entityType: 'License',
    entityId: lic.id,
    result: 'SUCCESS',
    metadata: { deviceId: device?.id ?? null, policy: { requireAdmin: policy.requireAdmin } },
    ip: params.ip,
    userAgent: params.userAgent,
  });

  return { resetId: resetRecord.id, status: (resetRecord.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING') as 'COMPLETED' | 'PENDING' };
}
