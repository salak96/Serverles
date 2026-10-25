import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth } from '../../middleware/auth';
import { makeLimiter } from '../../middleware/rateLimit';
import { NotFoundError, ValidationError, BusinessError } from '../../utils/errors';
import { hmacDeviceId, sha256OfKey } from '../../utils/crypto';
import { revealKeyIfPossible, rotateKey } from './licenses.service';
import { activateDeviceAtomic, resetDevice, unbindDevice } from './devices.service';
import {
  activateDeviceSchema,
  activateDeviceWithKeySchema,
  resetDeviceSchema,
  validateLicenseSchema,
} from './licenses.schema';
import { notify } from '../../services/notification.service';
import { notifyTelegramDeviceConnected } from '../../services/telegram.service';
import { notifyTelegramLicenseSecurityEvent } from '../../services/telegram.service';
import { formatJakarta } from '../../utils/date';
import { logger } from '../../config/logger';

const router = Router();

const rotateLimiter = makeLimiter({ windowMs: 60 * 60 * 1000, max: 5, message: 'Terlalu banyak percobaan rotasi. Coba lagi nanti.' });
const validateLimiter = makeLimiter({ windowMs: 60 * 1000, max: 60, message: 'Terlalu banyak percobaan validasi.' });
const desktopActivationLimiter = makeLimiter({ windowMs: 60 * 60 * 1000, max: 10, message: 'Terlalu banyak percobaan aktivasi perangkat. Coba lagi dalam satu jam.' });

function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') return xf.split(',')[0]?.trim() ?? req.ip ?? '';
  return req.ip ?? '';
}

function licenseDto(l: {
  id: string; name: string | null; status: string; startsAt: Date; expiresAt: Date;
  keyLastFour: string; createdAt: Date; revokedAt: Date | null; revokeReason: string | null;
  plan: { id: string; name: string; slug: string; maxDevices: number };
}, keyMasked: string, deviceCount: number) {
  return {
    id: l.id,
    name: l.name,
    status: l.status,
    plan: l.plan,
    startsAt: l.startsAt,
    expiresAt: l.expiresAt,
    createdAt: l.createdAt,
    revokedAt: l.revokedAt,
    revokeReason: l.revokeReason,
    keyMasked,
    keyLastFour: l.keyLastFour,
    maxDevices: l.plan.maxDevices,
    activeDevices: deviceCount,
  };
}

// GET /api/v1/licenses/me
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const licenses = await prisma.license.findMany({
      where: { userId: req.user!.id },
      include: { plan: { select: { id: true, name: true, slug: true, maxDevices: true } }, _count: { select: { devices: { where: { status: 'ACTIVE' } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: licenses.map((l) => licenseDto(l, `PAW-****-****-****-${l.keyLastFour}`, l._count.devices)),
    });
  })
);

// GET /api/v1/licenses/:id
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lic = await prisma.license.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { id: true, name: true, slug: true, maxDevices: true } }, _count: { select: { devices: { where: { status: 'ACTIVE' } } } } },
    });
    if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (lic.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    res.json({
      success: true,
      data: licenseDto(lic, `PAW-****-****-****-${lic.keyLastFour}`, lic._count.devices),
    });
  })
);

// POST /api/v1/licenses/:id/reveal-key
router.post(
  '/:id/reveal-key',
  requireAuth,
  asyncHandler(async (req, res) => {
    const key = await revealKeyIfPossible(req.params.id, req.user!.id, req.user!.role);
    if (!key) {
      return res.json({
        success: true,
        data: { available: false, message: 'API key tidak dapat ditampilkan ulang. Gunakan rotasi untuk membuat kunci baru.' },
      });
    }
    res.json({ success: true, data: { available: true, licenseKey: key } });
  })
);

// POST /api/v1/licenses/:id/rotate-key
router.post(
  '/:id/rotate-key',
  requireAuth,
  rotateLimiter,
  asyncHandler(async (req, res) => {
    const issued = await rotateKey(req.params.id, req.user!.id);
    void prisma.license.findUnique({
      where: { id: req.params.id },
      include: { plan: { select: { name: true } } },
    }).then((license) => {
      if (!license) return;
      return notifyTelegramLicenseSecurityEvent({
        event: 'api_key_rotated',
        customerEmail: req.user!.email,
        planName: license.plan.name,
        licenseStatus: license.status,
        occurredAt: new Date(),
      });
    }).catch((error: unknown) => logger.warn({ error, licenseId: req.params.id }, 'telegram_key_rotation_alert_failed'));
    await notify({
      userId: req.user!.id,
      title: 'API key lisensi dirotasi',
      body: 'API key lama telah dicabut. Pastikan untuk memperbarui aplikasi Anda.',
      category: 'LICENSE',
    });
    res.json({
      success: true,
      data: {
        id: issued.id,
        status: issued.status,
        licenseKey: issued.licenseKey,
        keyMasked: issued.keyMasked,
        keyLastFour: issued.keyLastFour,
        message: 'Simpan API key ini di tempat aman. Anda tidak akan melihatnya lagi.',
      },
    });
  })
);

// POST /api/v1/licenses/:id/activate (self-service)
router.post(
  '/:id/activate',
  requireAuth,
  validateLimiter,
  asyncHandler(async (req, res) => {
    const body = activateDeviceSchema.parse(req.body);
    const lic = await prisma.license.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (lic.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    const result = await activateDeviceAtomic({
      licenseId: req.params.id,
      deviceIdRaw: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      appVersion: body.appVersion,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });
    res.json({
      success: result.status === 'ok' || result.status === 'already_bound',
      data: {
        result: result.status,
        device: result.status === 'limit_reached' || result.status === 'license_inactive' ? null : {
          id: result.device.id,
          deviceName: result.device.deviceName,
          platform: result.device.platform,
          appVersion: result.device.appVersion,
          boundAt: result.device.boundAt,
          lastSeenAt: result.device.lastSeenAt,
        },
        error_code: result.status === 'limit_reached' ? 'DEVICE_LIMIT_REACHED' : result.status === 'license_inactive' ? 'LICENSE_INACTIVE' : undefined,
      },
    });
  })
);

// POST /api/v1/licenses/:id/deactivate
router.post(
  '/:id/deactivate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = activateDeviceSchema.parse({ deviceId: (req.body as { deviceId?: string }).deviceId ?? '' });
    if (!body.deviceId) throw new ValidationError('deviceId wajib diisi.');
    const license = await prisma.license.findUnique({ where: { id: req.params.id }, include: { plan: { select: { name: true } }, user: { select: { email: true } } } });
    if (!license) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (license.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    const device = await prisma.device.findUnique({ where: { licenseId_deviceHash: { licenseId: req.params.id, deviceHash: hmacDeviceId(body.deviceId) } } });
    await unbindDevice(req.params.id, body.deviceId, req.user!.id, req.user!.role === 'ADMIN');
    if (device?.status === 'ACTIVE') {
      void notifyTelegramLicenseSecurityEvent({
        event: 'device_unbound',
        customerEmail: license.user.email,
        planName: license.plan.name,
        licenseStatus: license.status,
        maskedDeviceId: maskDeviceHash(device.deviceHash),
        deviceName: device.deviceName,
        platform: device.platform,
        appVersion: device.appVersion,
        occurredAt: new Date(),
      });
    }
    res.json({ success: true, data: { message: 'Perangkat berhasil dilepas.' } });
  })
);

// GET /api/v1/licenses/:id/devices
router.get(
  '/:id/devices',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lic = await prisma.license.findUnique({ where: { id: req.params.id }, select: { userId: true } });
    if (!lic) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (lic.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    const devices = await prisma.device.findMany({
      where: { licenseId: req.params.id },
      orderBy: { boundAt: 'desc' },
    });
    res.json({
      success: true,
      data: devices.map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        platform: d.platform,
        appVersion: d.appVersion,
        status: d.status,
        boundAt: d.boundAt,
        lastSeenAt: d.lastSeenAt,
        unboundAt: d.unboundAt,
        hwidMasked: maskDeviceHash(d.deviceHash),
      })),
    });
  })
);

// POST /api/v1/licenses/:id/devices/:deviceId/reset
router.post(
  '/:id/devices/:deviceId/reset',
  requireAuth,
  asyncHandler(async (req, res) => {
    const license = await prisma.license.findUnique({ where: { id: req.params.id }, include: { plan: { select: { name: true } }, user: { select: { email: true } } } });
    if (!license) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (license.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId } });
    const body = resetDeviceSchema.parse(req.body ?? {});
    const result = await resetDevice({
      licenseId: req.params.id,
      deviceId: req.params.deviceId,
      requestedById: req.user!.id,
      isAdmin: req.user!.role === 'ADMIN',
      reason: body.reason,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });
    if (result.status === 'COMPLETED') {
      void notifyTelegramLicenseSecurityEvent({
        event: 'device_reset_completed',
        customerEmail: license.user.email,
        planName: license.plan.name,
        licenseStatus: license.status,
        maskedDeviceId: device?.deviceHash ? maskDeviceHash(device.deviceHash) : undefined,
        deviceName: device?.deviceName,
        platform: device?.platform,
        appVersion: device?.appVersion,
        nextAvailableAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        occurredAt: new Date(),
      });
    } else {
      void notifyTelegramLicenseSecurityEvent({
        event: 'device_reset_requested',
        customerEmail: license.user.email,
        planName: license.plan.name,
        licenseStatus: license.status,
        maskedDeviceId: device?.deviceHash ? maskDeviceHash(device.deviceHash) : undefined,
        deviceName: device?.deviceName,
        platform: device?.platform,
        appVersion: device?.appVersion,
        occurredAt: new Date(),
      });
    }
    res.json({
      success: true,
      data: {
        resetId: result.resetId,
        status: result.status,
        message: result.status === 'PENDING' ? 'Permintaan menunggu persetujuan admin.' : 'Reset selesai.',
      },
    });
  })
);

// POST /api/v1/licenses/:id/devices/reset (reset slot tanpa menentukan device)
router.post(
  '/:id/devices/reset',
  requireAuth,
  asyncHandler(async (req, res) => {
    const license = await prisma.license.findUnique({ where: { id: req.params.id }, include: { plan: { select: { name: true } }, user: { select: { email: true } } } });
    if (!license) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (license.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    const body = resetDeviceSchema.parse(req.body ?? {});
    const result = await resetDevice({
      licenseId: req.params.id,
      requestedById: req.user!.id,
      isAdmin: req.user!.role === 'ADMIN',
      reason: body.reason,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });
    void notifyTelegramLicenseSecurityEvent({
      event: result.status === 'COMPLETED' ? 'device_reset_completed' : 'device_reset_requested',
      customerEmail: license.user.email,
      planName: license.plan.name,
      licenseStatus: license.status,
      nextAvailableAt: result.status === 'COMPLETED' ? new Date(Date.now() + 12 * 60 * 60 * 1000) : undefined,
      occurredAt: new Date(),
    });
    res.json({
      success: true,
      data: {
        resetId: result.resetId,
        status: result.status,
        message: result.status === 'PENDING' ? 'Permintaan menunggu persetujuan admin.' : 'Reset selesai.',
      },
    });
  })
);

// DELETE /api/v1/licenses/:id/devices/:deviceId
router.delete(
  '/:id/devices/:deviceId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const license = await prisma.license.findUnique({ where: { id: req.params.id }, include: { plan: { select: { name: true } } } });
    if (!license) throw new NotFoundError('Lisensi tidak ditemukan.');
    if (license.userId !== req.user!.id && req.user!.role !== 'ADMIN') throw new BusinessError('Tidak diizinkan.', 'FORBIDDEN', 403);
    const device = await prisma.device.findUnique({ where: { id: req.params.deviceId } });
    await unbindDevice(req.params.id, req.params.deviceId, req.user!.id, req.user!.role === 'ADMIN');
    if (device?.status === 'ACTIVE') {
      void notifyTelegramLicenseSecurityEvent({
        event: 'device_unbound',
        customerEmail: req.user!.email,
        planName: license.plan.name,
        licenseStatus: license.status,
        maskedDeviceId: maskDeviceHash(device.deviceHash),
        deviceName: device.deviceName,
        platform: device.platform,
        appVersion: device.appVersion,
        occurredAt: new Date(),
      });
    }
    res.json({ success: true, data: { message: 'Perangkat dilepas.' } });
  })
);

// POST /api/v1/licenses/activate-device (public desktop activation using license key)
router.post(
  '/activate-device',
  desktopActivationLimiter,
  asyncHandler(async (req, res) => {
    const body = activateDeviceWithKeySchema.parse(req.body);
    const license = await prisma.license.findUnique({
      where: { keyHash: sha256OfKey(body.licenseKey) },
      select: { id: true, status: true, expiresAt: true, userId: true },
    });

    // Keep missing, pending, and unusable keys indistinguishable to callers.
    if (!license || license.status === 'PENDING') {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_INVALID' } });
    }
    if (license.status === 'REVOKED') {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_REVOKED' } });
    }
    if (license.status === 'SUSPENDED') {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_SUSPENDED' } });
    }
    if (license.status === 'EXPIRED' || license.expiresAt <= new Date()) {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_EXPIRED' } });
    }

    const owner = await prisma.user.findUnique({
      where: { id: license.userId },
      select: { status: true, emailVerifiedAt: true },
    });
    if (!owner?.emailVerifiedAt) {
      return res.json({ success: false, data: { valid: false, error_code: 'EMAIL_NOT_VERIFIED' } });
    }
    if (owner.status !== 'ACTIVE') {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_SUSPENDED' } });
    }

    const result = await activateDeviceAtomic({
      licenseId: license.id,
      deviceIdRaw: body.deviceId,
      deviceName: body.deviceName,
      platform: body.platform,
      appVersion: body.appVersion,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });

    if (result.status === 'limit_reached') {
      return res.json({ success: false, data: { valid: false, device_status: 'NOT_BOUND', error_code: 'DEVICE_LIMIT_REACHED' } });
    }
    if (result.status === 'license_inactive') {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_INACTIVE' } });
    }
    if (result.status === 'cooldown_active') {
      return res.json({ success: false, data: { valid: false, device_status: 'NOT_BOUND', error_code: 'RESET_COOLDOWN_ACTIVE', next_available_at: result.nextAvailableAt } });
    }

    if (result.created) {
      const activatedLicense = await prisma.license.findUnique({
        where: { id: license.id },
        include: {
          plan: { select: { name: true, maxDevices: true } },
          devices: { where: { status: 'ACTIVE' }, select: { id: true } },
        },
      });
      const activatedOwner = await prisma.user.findUnique({ where: { id: license.userId }, select: { email: true } });
      if (activatedLicense && activatedOwner) {
        const notificationBody = [
          `Perangkat: ${result.device.deviceName ?? 'Perangkat tanpa nama'}`,
          `Paket ${activatedLicense.plan.name}`,
          `${activatedLicense.devices.length}/${activatedLicense.plan.maxDevices} perangkat · berakhir ${formatJakarta(activatedLicense.expiresAt)}`,
          'Status: ACTIVE',
          `${result.device.platform ?? 'platform tidak diketahui'} · ${result.device.appVersion ?? 'versi tidak diketahui'}`,
          `HWID: ${maskDeviceHash(result.device.deviceHash)}`,
          `Terakhir aktif: ${formatJakarta(result.device.lastSeenAt)}`,
        ].join('\n');

        void notify({
          userId: license.userId,
          title: 'Perangkat baru terhubung',
          body: notificationBody,
          category: 'DEVICE',
          link: '/licenses',
        }).catch((error: unknown) => logger.warn({ error, licenseId: license.id }, 'device_connection_notification_failed'));
        void notifyTelegramDeviceConnected({
          customerEmail: activatedOwner.email,
          planName: activatedLicense.plan.name,
          activeDevices: activatedLicense.devices.length,
          maxDevices: activatedLicense.plan.maxDevices,
          expiresAt: activatedLicense.expiresAt,
          licenseStatus: 'ACTIVE',
          deviceName: result.device.deviceName,
          platform: result.device.platform,
          appVersion: result.device.appVersion,
          maskedDeviceId: maskDeviceHash(result.device.deviceHash),
          lastSeenAt: result.device.lastSeenAt,
        }).catch((error: unknown) => logger.warn({ error, licenseId: license.id }, 'telegram_device_connection_notification_failed'));
      }
    }

    const current = await prisma.license.findUnique({
      where: { id: license.id },
      include: {
        plan: { select: { name: true, slug: true, maxDevices: true, features: true } },
        devices: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });
    if (!current) return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_INVALID' } });

    return res.json({
      success: true,
      data: {
        valid: true,
        license_status: 'ACTIVE',
        plan: { name: current.plan.name, slug: current.plan.slug, max_devices: current.plan.maxDevices, features: current.plan.features },
        expires_at: current.expiresAt,
        device_status: 'BOUND',
        device: {
          id: result.device.id,
          device_name: result.device.deviceName,
          platform: result.device.platform,
          app_version: result.device.appVersion,
          bound_at: result.device.boundAt,
          last_seen_at: result.device.lastSeenAt,
        },
        active_devices: current.devices.length,
        allowed_features: current.plan.features,
        server_time: new Date(),
      },
    });
  })
);

// POST /api/v1/licenses/validate (public, for external apps)
router.post(
  '/validate',
  validateLimiter,
  asyncHandler(async (req, res) => {
    const body = validateLicenseSchema.parse(req.body);
    const keyHash = sha256OfKey(body.licenseKey);
    const lic = await prisma.license.findUnique({
      where: { keyHash },
      include: { plan: { select: { name: true, slug: true, maxDevices: true, features: true } }, devices: { where: { status: 'ACTIVE' } } },
    });
    if (!lic) {
      return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_INVALID' } });
    }
    const now = new Date();
    if (lic.status === 'REVOKED') return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_REVOKED' } });
    if (lic.status === 'SUSPENDED') return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_SUSPENDED' } });
    if (lic.status === 'EXPIRED' || lic.expiresAt <= now) return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_EXPIRED' } });
    if (lic.status === 'PENDING') return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_INVALID' } });

    const user = await prisma.user.findUnique({ where: { id: lic.userId }, select: { status: true, emailVerifiedAt: true } });
    if (!user?.emailVerifiedAt) return res.json({ success: false, data: { valid: false, error_code: 'EMAIL_NOT_VERIFIED' } });
    if (user.status === 'SUSPENDED') return res.json({ success: false, data: { valid: false, error_code: 'LICENSE_SUSPENDED' } });

    // Check device binding
    const crypto = await import('node:crypto');
    const { hmacDeviceId } = await import('../../utils/crypto');
    const deviceHash = hmacDeviceId(body.deviceId);
    const existing = lic.devices.find((d) => d.deviceHash === deviceHash);
    if (existing) {
      await prisma.device.update({ where: { id: existing.id }, data: { lastSeenAt: now, appVersion: body.appVersion ?? existing.appVersion, platform: body.platform ?? existing.platform, deviceName: body.deviceName ?? existing.deviceName } });
      return res.json({
        success: true,
        data: {
          valid: true,
          license_status: 'ACTIVE',
          plan: { name: lic.plan.name, slug: lic.plan.slug, max_devices: lic.plan.maxDevices, features: lic.plan.features },
          expires_at: lic.expiresAt,
          device_status: 'BOUND',
          allowed_features: lic.plan.features,
          server_time: now,
        },
      });
    }
    if (lic.devices.length >= lic.plan.maxDevices) {
      return res.json({ success: false, data: { valid: false, error_code: 'DEVICE_LIMIT_REACHED' } });
    }
    return res.json({
      success: true,
      data: {
        valid: true,
        license_status: 'ACTIVE',
        plan: { name: lic.plan.name, slug: lic.plan.slug, max_devices: lic.plan.maxDevices, features: lic.plan.features },
        expires_at: lic.expiresAt,
        device_status: 'NOT_BOUND',
        allowed_features: lic.plan.features,
        server_time: now,
        hint: 'Kirim POST /api/v1/licenses/:id/activate untuk mengikat perangkat.',
      },
    });
    void crypto;
  })
);

function maskDeviceHash(hash: string): string {
  if (hash.length < 8) return '****';
  return `${hash.slice(0, 4)}****${hash.slice(-4)}`.toUpperCase();
}

export default router;
