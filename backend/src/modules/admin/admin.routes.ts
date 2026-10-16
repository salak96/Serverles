import { Router } from 'express';
import { prisma } from '../../config/prisma';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { NotFoundError, ValidationError, BusinessError } from '../../utils/errors';
import { z } from 'zod';
import { recordAudit } from '../../services/audit.service';
import { notify } from '../../services/notification.service';
import { emailService } from '../../services/email.service';
import { issueLicense, revokeLicense, extendLicense } from '../licenses/licenses.service';
import { unbindDevice } from '../licenses/devices.service';
import { formatJakarta } from '../../utils/date';

const router = Router();

const userUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  name: z.string().min(2).max(120).optional(),
});

const licenseCreateSchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  durationDays: z.number().int().min(1).max(3650).optional(),
  name: z.string().max(120).optional(),
});

const licenseUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'PENDING']).optional(),
  revokeReason: z.string().max(255).optional(),
  extendDays: z.number().int().min(1).max(3650).optional(),
});

const notificationCreateSchema = z.object({
  userIds: z.array(z.string()).optional(),
  isGlobal: z.boolean().optional(),
  title: z.string().min(2).max(180),
  body: z.string().min(2).max(2000),
  category: z.enum(['ACCOUNT', 'SUBSCRIPTION', 'LICENSE', 'DEVICE', 'PAYMENT', 'TOOL_UPDATE', 'SYSTEM']),
  link: z.string().url().max(255).optional(),
});

function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string') return xf.split(',')[0]?.trim() ?? req.ip ?? '';
  return req.ip ?? '';
}

router.use(requireAuth, requireAdmin);

// GET /api/v1/admin/dashboard
router.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const [
      totalUsers,
      verifiedUsers,
      activeSubs,
      activeLicenses,
      expiredLicenses,
      activeDevices,
      pendingResets,
      totalTools,
      recentActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
      prisma.license.count({ where: { status: 'ACTIVE', expiresAt: { gt: now } } }),
      prisma.license.count({ where: expiredOrActive(now) }),
      prisma.device.count({ where: { status: 'ACTIVE' } }),
      prisma.deviceReset.count({ where: { status: 'PENDING' } }),
      prisma.tool.count(),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, action: true, entityType: true, result: true, createdAt: true, actorUserId: true } }),
    ]);
    res.json({
      success: true,
      data: {
        totalUsers,
        verifiedUsers,
        activeSubscriptions: activeSubs,
        activeLicenses,
        expiredLicenses,
        activeDevices,
        pendingDeviceResets: pendingResets,
        totalTools,
        recentActivity: recentActivity.map((a) => ({ ...a, createdAt: formatJakarta(a.createdAt) })),
        generatedAt: formatJakarta(now),
      },
    });
  })
);

function expiredOrActive(now: Date) {
  return {
    OR: [
      { status: 'EXPIRED' as const },
      { status: 'ACTIVE' as const, expiresAt: { lte: now } },
    ],
  };
}

// POST /api/v1/admin/users
router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const body = z.object({
      name: z.string().min(2).max(120),
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(8).max(128),
      role: z.enum(['USER', 'ADMIN']).optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
    }).parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new BusinessError('Email sudah terdaftar.', 'EMAIL_ALREADY_EXISTS', 409, { field: 'email' });
    const { hashPassword } = await import('../auth/auth.service');
    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash,
        role: body.role ?? 'USER',
        status: body.status ?? 'ACTIVE',
        emailVerifiedAt: body.status === 'ACTIVE' ? new Date() : null,
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'admin.user.create',
      entityType: 'User',
      entityId: user.id,
      result: 'SUCCESS',
    });
    res.status(201).json({ success: true, data: user });
  })
);

// DELETE /api/v1/admin/users/:id
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) {
      throw new BusinessError('Anda tidak dapat menghapus akun Anda sendiri.', 'SELF_DELETE_FORBIDDEN', 400);
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) throw new NotFoundError('Pengguna tidak ditemukan.');
    if (target.role === 'ADMIN') {
      const otherAdmins = await prisma.user.count({ where: { role: 'ADMIN', id: { not: target.id } } });
      if (otherAdmins === 0) {
        throw new BusinessError('Tidak dapat menghapus admin terakhir.', 'LAST_ADMIN', 400);
      }
    }
    await prisma.$transaction([
      prisma.licenseActivationAttempt.deleteMany({ where: { license: { userId: target.id } } }),
      prisma.deviceReset.deleteMany({ where: { license: { userId: target.id } } }),
      prisma.device.deleteMany({ where: { userId: target.id } }),
      prisma.license.deleteMany({ where: { userId: target.id } }),
      prisma.subscription.deleteMany({ where: { userId: target.id } }),
      prisma.order.deleteMany({ where: { userId: target.id } }),
      prisma.refreshToken.deleteMany({ where: { userId: target.id } }),
      prisma.notification.deleteMany({ where: { userId: target.id } }),
      prisma.emailVerificationToken.deleteMany({ where: { userId: target.id } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: target.id } }),
      prisma.auditLog.deleteMany({ where: { actorUserId: target.id } }),
      prisma.user.delete({ where: { id: target.id } }),
    ]);
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'admin.user.delete',
      entityType: 'User',
      entityId: target.id,
      result: 'SUCCESS',
      metadata: { email: target.email },
    });
    res.json({ success: true, data: { message: 'Pengguna dihapus.' } });
  })
);

// GET /api/v1/admin/users
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const search = (req.query.search as string | undefined)?.trim();
    const status = req.query.status as string | undefined;
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(search ? { OR: [{ email: { contains: search } }, { name: { contains: search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: { id: true, name: true, email: true, role: true, status: true, emailVerifiedAt: true, lastLoginAt: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ success: true, data: { items, page, limit, total } });
  })
);

// GET /api/v1/admin/users/:id
router.get(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const u = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        licenses: { include: { plan: true, devices: { where: { status: 'ACTIVE' } } } },
      },
    });
    if (!u) throw new NotFoundError('Pengguna tidak ditemukan.');
    // Never return passwordHash
    const { passwordHash, ...safe } = u;
    void passwordHash;
    res.json({ success: true, data: safe });
  })
);

// PATCH /api/v1/admin/users/:id
router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const bodySchema = userUpdateSchema.extend({ password: z.string().min(8).max(128).optional() });
    const body = bodySchema.parse(req.body);
    const updateData: Record<string, unknown> = { name: body.name, role: body.role, status: body.status };
    if (body.password) {
      const { hashPassword } = await import('../auth/auth.service');
      updateData.passwordHash = await hashPassword(body.password);
    }
    const u = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'admin.user.update',
      entityType: 'User',
      entityId: u.id,
      result: 'SUCCESS',
      metadata: { fields: Object.keys(body) },
    });
    res.json({ success: true, data: { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status } });
  })
);

// GET /api/v1/admin/licenses
router.get(
  '/licenses',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.license.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { user: { select: { id: true, name: true, email: true } }, plan: { select: { name: true, slug: true } } },
      }),
      prisma.license.count({ where }),
    ]);
    res.json({ success: true, data: { items, page, limit, total } });
  })
);

// POST /api/v1/admin/licenses
router.post(
  '/licenses',
  asyncHandler(async (req, res) => {
    const body = licenseCreateSchema.parse(req.body);
    const issued = await issueLicense({
      userId: body.userId,
      planId: body.planId,
      durationDays: body.durationDays,
      name: body.name,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) ?? '',
    });
    await notify({
      userId: body.userId,
      title: 'Lisensi baru telah diterbitkan',
      body: `Paket ${issued.planName} telah diaktifkan.`,
      category: 'LICENSE',
    });
    res.status(201).json({ success: true, data: issued });
  })
);

// PATCH /api/v1/admin/licenses/:id
router.patch(
  '/licenses/:id',
  asyncHandler(async (req, res) => {
    const body = licenseUpdateSchema.parse(req.body);
    if (body.extendDays) {
      await extendLicense(req.params.id, body.extendDays, req.user!.id);
    }
    if (body.status === 'REVOKED') {
      await revokeLicense(req.params.id, body.revokeReason ?? 'Ditolak oleh admin', req.user!.id);
    } else if (body.status) {
      await prisma.license.update({ where: { id: req.params.id }, data: { status: body.status } });
      await recordAudit({
        actorUserId: req.user!.id,
        action: 'admin.license.update_status',
        entityType: 'License',
        entityId: req.params.id,
        result: 'SUCCESS',
        metadata: { status: body.status },
      });
    }
    const lic = await prisma.license.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: lic });
  })
);

// POST /api/v1/admin/licenses/:id/revoke
router.post(
  '/licenses/:id/revoke',
  asyncHandler(async (req, res) => {
    const reason = (req.body as { reason?: string })?.reason ?? 'Ditolak oleh admin';
    await revokeLicense(req.params.id, reason, req.user!.id);
    res.json({ success: true, data: { message: 'Lisensi dicabut.' } });
  })
);

// GET /api/v1/admin/devices
router.get(
  '/devices',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const status = req.query.status as string | undefined;
    const where = status ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      prisma.device.findMany({
        where, orderBy: { boundAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { license: { include: { user: { select: { id: true, email: true } }, plan: { select: { name: true } } } } },
      }),
      prisma.device.count({ where }),
    ]);
    res.json({ success: true, data: { items, page, limit, total } });
  })
);

// POST /api/v1/admin/devices/:id/unbind
router.post(
  '/devices/:id/unbind',
  asyncHandler(async (req, res) => {
    const dev = await prisma.device.findUnique({ where: { id: req.params.id } });
    if (!dev) throw new NotFoundError('Perangkat tidak ditemukan.');
    await unbindDevice(dev.licenseId, dev.id, req.user!.id, true);
    res.json({ success: true, data: { message: 'Perangkat dilepas.' } });
  })
);

// GET /api/v1/admin/orders
router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const status = (req.query.status as string | undefined) ?? undefined;
    const orders = await prisma.order.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } }, plan: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ success: true, data: orders.map((o) => ({ ...o, amount: Number(o.amount) })) });
  })
);

// POST /api/v1/admin/orders/:id/confirm
router.post(
  '/orders/:id/confirm',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { user: true, plan: true } });
    if (!order) throw new NotFoundError('Order tidak ditemukan.');
    if (order.status === 'PAID') {
      return res.json({ success: true, data: { message: 'Order sudah lunas.' } });
    }
    if (order.status !== 'PENDING') {
      throw new BusinessError('Order tidak dapat dikonfirmasi pada status saat ini.', 'INVALID_STATE', 400);
    }
    const now = new Date();
    const startsAt = now;
    const expiresAt = new Date(startsAt.getTime() + order.durationDays * 24 * 60 * 60 * 1000);

    const existingSub = await prisma.subscription.findFirst({
      where: { userId: order.userId, planId: order.planId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'desc' },
    });
    const sub = existingSub
      ? await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            expiresAt: new Date(Math.max(existingSub.expiresAt.getTime(), now.getTime()) + order.durationDays * 24 * 60 * 60 * 1000),
            status: 'ACTIVE',
          },
        })
      : await prisma.subscription.create({
          data: { userId: order.userId, planId: order.planId, status: 'ACTIVE', startsAt, expiresAt },
        });

    const { issueLicense } = await import('../licenses/licenses.service');
    await issueLicense({
      userId: order.userId,
      planId: order.planId,
      durationDays: order.durationDays,
      name: `${order.plan.name} - ${now.toISOString().slice(0, 10)}`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paidAt: now, subscriptionId: sub.id },
    });

    await notify({
      userId: order.userId,
      title: 'Pembayaran dikonfirmasi',
      body: `Order untuk paket ${order.plan.name} telah dikonfirmasi. Lisensi sudah aktif.`,
      category: 'PAYMENT',
    });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'admin.order.confirm',
      entityType: 'Order',
      entityId: order.id,
      result: 'SUCCESS',
    });

    res.json({ success: true, data: { message: 'Pembayaran dikonfirmasi dan lisensi diterbitkan.' } });
  })
);

// POST /api/v1/admin/orders/:id/reject
router.post(
  '/orders/:id/reject',
  asyncHandler(async (req, res) => {
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new NotFoundError('Order tidak ditemukan.');
    if (order.status !== 'PENDING') {
      throw new BusinessError('Order tidak dapat dibatalkan pada status saat ini.', 'INVALID_STATE', 400);
    }
    await prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
    await notify({
      userId: order.userId,
      title: 'Pembayaran tidak dikonfirmasi',
      body: 'Order Anda dibatalkan. Silakan membuat order baru atau hubungi admin.',
      category: 'PAYMENT',
    });
    await recordAudit({
      actorUserId: req.user!.id,
      action: 'admin.order.reject',
      entityType: 'Order',
      entityId: order.id,
      result: 'SUCCESS',
    });
    res.json({ success: true, data: { message: 'Order dibatalkan.' } });
  })
);

// GET /api/v1/admin/plans
router.get(
  '/plans',
  asyncHandler(async (_req, res) => {
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
    res.json({ success: true, data: plans.map((p) => ({ ...p, price: Number(p.price) })) });
  })
);

// POST /api/v1/admin/plans
router.post(
  '/plans',
  asyncHandler(async (req, res) => {
    const p = await prisma.plan.create({ data: normalizePlanInput(req.body) });
    res.status(201).json({ success: true, data: { ...p, price: Number(p.price) } });
  })
);

// PATCH /api/v1/admin/plans/:id
router.patch(
  '/plans/:id',
  asyncHandler(async (req, res) => {
    const p = await prisma.plan.update({ where: { id: req.params.id }, data: normalizePlanInput(req.body) });
    res.json({ success: true, data: { ...p, price: Number(p.price) } });
  })
);

function normalizePlanInput(body: Record<string, unknown>) {
  return {
    name: String(body.name ?? '').trim(),
    slug: String(body.slug ?? '').trim().toLowerCase(),
    description: body.description ? String(body.description) : null,
    price: Number(body.price ?? 0),
    currency: String(body.currency ?? 'IDR'),
    durationDays: Number(body.durationDays ?? 30),
    maxDevices: Number(body.maxDevices ?? 1),
    features: Array.isArray(body.features) ? body.features : [],
    resetPolicy: body.resetPolicy ?? { maxResets: 2, periodDays: 30, cooldownDays: 7, requireAdmin: false, requireEmailVerification: true },
    availableDurations: Array.isArray(body.availableDurations) ? body.availableDurations : [],
    isActive: body.isActive !== false,
    sortOrder: Number(body.sortOrder ?? 0),
  };
}

// GET /api/v1/admin/tools
router.get(
  '/tools',
  asyncHandler(async (_req, res) => {
    const items = await prisma.tool.findMany({ include: { releases: { orderBy: { releasedAt: 'desc' }, take: 1 } }, orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: items });
  })
);

// POST /api/v1/admin/notifications
router.post(
  '/notifications',
  asyncHandler(async (req, res) => {
    const body = notificationCreateSchema.parse(req.body);
    if (body.isGlobal) {
      await prisma.notification.create({
        data: { userId: null, title: body.title, body: body.body, category: body.category, link: body.link ?? null },
      });
    } else if (body.userIds && body.userIds.length > 0) {
      await prisma.notification.createMany({
        data: body.userIds.map((userId) => ({ userId, title: body.title, body: body.body, category: body.category, link: body.link ?? null })),
      });
    } else {
      throw new ValidationError('userIds atau isGlobal wajib diisi.');
    }
    res.status(201).json({ success: true, data: { message: 'Notifikasi dikirim.' } });
  })
);

// GET /api/v1/admin/audit-logs
router.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const action = req.query.action as string | undefined;
    const where = action ? { action } : {};
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ success: true, data: { items, page, limit, total } });
  })
);

// GET /api/v1/admin/settings/smtp-test
router.get(
  '/settings/smtp-test',
  asyncHandler(async (_req, res) => {
    const result = await emailService.verifyConnection();
    res.status(result.connected ? 200 : 503).json({
      success: result.connected,
      data: result.connected
        ? { status: 'connected', message: 'Koneksi SMTP berhasil diverifikasi.' }
        : { status: 'unavailable', message: 'Koneksi SMTP belum tersedia atau gagal diverifikasi.', reason: result.reason },
    });
  })
);

// GET /api/v1/admin/settings
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const items = await prisma.appSetting.findMany();
    res.json({ success: true, data: items });
  })
);

// PATCH /api/v1/admin/settings
router.patch(
  '/settings',
  asyncHandler(async (req, res) => {
    const body = z.object({ key: z.string(), value: z.unknown() }).parse(req.body);
    const updated = await prisma.appSetting.upsert({
      where: { key: body.key },
      update: { value: body.value as object, updatedBy: req.user!.id },
      create: { key: body.key, value: body.value as object, updatedBy: req.user!.id },
    });
    res.json({ success: true, data: updated });
  })
);

void BusinessError;
export default router;
