import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

const app = createApp();
const unique = Date.now().toString(36);
let adminEmail = `admin-order+${unique}@pawang.local`;
let userEmail = `order+${unique}@pawang.local`;
function nextAdminEmail(): string { adminEmail = `admin-order+${unique}-${Math.random().toString(36).slice(2, 8)}@pawang.local`; return adminEmail; }
function nextUserEmail(): string { userEmail = `order+${unique}-${Math.random().toString(36).slice(2, 8)}@pawang.local`; return userEmail; }

async function cleanupByEmail(email: string): Promise<void> {
  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!u) return;
  const licenses = await prisma.license.findMany({ where: { userId: u.id }, select: { id: true } });
  await prisma.licenseActivationAttempt.deleteMany({ where: { licenseId: { in: licenses.map((l) => l.id) } } });
  await prisma.deviceReset.deleteMany({ where: { licenseId: { in: licenses.map((l) => l.id) } } });
  await prisma.device.deleteMany({ where: { userId: u.id } });
  await prisma.license.deleteMany({ where: { userId: u.id } });
  await prisma.subscription.deleteMany({ where: { userId: u.id } });
  await prisma.order.deleteMany({ where: { userId: u.id } });
  await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
  await prisma.notification.deleteMany({ where: { userId: u.id } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: u.id } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: u.id } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorUserId: u.id }, { entityId: u.id }] } });
  await prisma.user.deleteMany({ where: { id: u.id } });
}

beforeAll(async () => {
  await cleanupByEmail(userEmail);
  await cleanupByEmail(adminEmail);
});

afterAll(async () => {
  await cleanupByEmail(userEmail);
  await cleanupByEmail(adminEmail);
  await prisma.$disconnect();
});

export const __test_marker = true;

async function getAdminSession(): Promise<{ cookie: string; accessToken: string; userId: string }> {
  const plan = await prisma.plan.findFirst({ where: { slug: 'basic' } });
  expect(plan).toBeTruthy();
  const bcrypt = await import('argon2');
  const passwordHash = await bcrypt.hash('TestP@ssw0rd!1', { type: bcrypt.argon2id });
  const email = nextAdminEmail();
  const admin = await prisma.user.create({
    data: {
      email,
      name: 'Admin Order',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'TestP@ssw0rd!1' });
  expect(login.status).toBe(200);
  return { cookie: login.headers['set-cookie']?.[0] ?? '', accessToken: login.body.data.accessToken, userId: admin.id };
}

async function createPendingOrder(): Promise<{ orderId: string; userId: string; cookies: string }> {
  const bcrypt = await import('argon2');
  const passwordHash = await bcrypt.hash('TestP@ssw0rd!1', { type: bcrypt.argon2id });
  const email = nextUserEmail();
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Order User',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'TestP@ssw0rd!1' });
  const plan = await prisma.plan.findFirst({ where: { slug: 'basic' } });
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      planId: plan!.id,
      amount: Number(plan!.price),
      currency: plan!.currency,
      status: 'PENDING',
      provider: 'manual',
      durationDays: plan!.durationDays,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return { orderId: order.id, userId: user.id, cookies: login.headers['set-cookie']?.[0] ?? '' };
}

describe('Admin payment verification CRUD', () => {
  beforeAll(async () => {
    await cleanupByEmail(userEmail);
    await cleanupByEmail(adminEmail);
  });
  it('user cannot create a second PENDING order (idempotent)', async () => {
    const { orderId, cookies, userId } = await createPendingOrder();
    const plan = await prisma.plan.findFirst({ where: { slug: 'basic' } });
    const body = { planId: plan!.id, durationDays: plan!.durationDays };
    const second = await request(app).post('/api/v1/subscriptions/checkout').set('Cookie', cookies).send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.reused).toBe(true);
    expect(second.body.data.order.id).toBe(orderId);
    expect(second.body.data.order.status).toBe('PENDING');
    void userId;
  });

  it('admin lists PENDING orders, confirms it, then order is PAID with subscription + license', async () => {
    const admin = await getAdminSession();
    const { orderId } = await createPendingOrder();

    const list = await request(app).get('/api/v1/admin/orders?status=PENDING').set('Authorization', `Bearer ${admin.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((o: { id: string }) => o.id === orderId)).toBe(true);

    const confirm = await request(app).post(`/api/v1/admin/orders/${orderId}/confirm`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(confirm.status).toBe(200);

    const after = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
    expect(after?.status).toBe('PAID');
    expect(after?.paidAt).toBeTruthy();
    const sub = await prisma.subscription.findFirst({ where: { userId: after!.userId, status: 'ACTIVE' } });
    expect(sub).toBeTruthy();
    const lic = await prisma.license.findFirst({ where: { userId: after!.userId, planId: after!.planId, status: 'ACTIVE' } });
    expect(lic).toBeTruthy();
  });

  it('re-confirming a PAID order is a no-op', async () => {
    const admin = await getAdminSession();
    const { orderId } = await createPendingOrder();
    const first = await request(app).post(`/api/v1/admin/orders/${orderId}/confirm`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(first.status).toBe(200);
    const second = await request(app).post(`/api/v1/admin/orders/${orderId}/confirm`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(second.status).toBe(200);
  });

  it('admin rejects a PENDING order -> FAILED and user gets a notification', async () => {
    const admin = await getAdminSession();
    const { orderId, userId } = await createPendingOrder();
    const reject = await request(app).post(`/api/v1/admin/orders/${orderId}/reject`).set('Authorization', `Bearer ${admin.accessToken}`);
    expect(reject.status).toBe(200);
    const after = await prisma.order.findUnique({ where: { id: orderId } });
    expect(after?.status).toBe('FAILED');
    const notif = await prisma.notification.findFirst({ where: { userId, category: 'PAYMENT' }, orderBy: { createdAt: 'desc' } });
    expect(notif?.title).toBe('Pembayaran tidak dikonfirmasi');
  });

  it('non-admin cannot access admin order endpoints', async () => {
    const { cookies } = await createPendingOrder();
    const list = await request(app).get('/api/v1/admin/orders').set('Cookie', cookies);
    expect(list.status).toBe(403);
    const confirm = await request(app).post(`/api/v1/admin/orders/anything/confirm`).set('Cookie', cookies);
    expect(confirm.status).toBe(403);
  });
});
