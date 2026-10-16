import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

const app = createApp();
const unique = Date.now().toString(36);
const testEmail = `tester+${unique}@pawangtools.local`;
let accessToken = '';

async function cleanup(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: testEmail }, select: { id: true } });
  if (!user) return;
  const u = user.id;
  const licenses = await prisma.license.findMany({ where: { userId: u }, select: { id: true } });
  const licenseIds = licenses.map((l) => l.id);
  await prisma.licenseActivationAttempt.deleteMany({ where: { licenseId: { in: licenseIds } } });
  await prisma.deviceReset.deleteMany({ where: { licenseId: { in: licenseIds } } });
  await prisma.device.deleteMany({ where: { userId: u } });
  await prisma.license.deleteMany({ where: { userId: u } });
  await prisma.subscription.deleteMany({ where: { userId: u } });
  await prisma.order.deleteMany({ where: { userId: u } });
  await prisma.refreshToken.deleteMany({ where: { userId: u } });
  await prisma.notification.deleteMany({ where: { userId: u } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: u } });
  await prisma.passwordResetToken.deleteMany({ where: { userId: u } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: u } });
  await prisma.user.deleteMany({ where: { id: u } });
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('auth + license integration', () => {
  it('registers, verifies, logs in, fetches /me', async () => {
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Tester', email: testEmail, password: 'TestP@ssw0rd!1', confirmPassword: 'TestP@ssw0rd!1', acceptTerms: true });
    expect(reg.status).toBe(201);
    expect(reg.body.success).toBe(true);

    // Manually verify the email (SMTP is dev-log mode)
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(user).toBeTruthy();
    await prisma.user.update({ where: { id: user!.id }, data: { emailVerifiedAt: new Date(), status: 'ACTIVE' } });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: 'TestP@ssw0rd!1' });
    expect(login.status).toBe(200);
    accessToken = login.body.data.accessToken;
    expect(accessToken).toBeTruthy();

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', [`pt_access=${accessToken}`]);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(testEmail);
  });

  it('rejects duplicate registration', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Tester', email: testEmail, password: 'TestP@ssw0rd!1', confirmPassword: 'TestP@ssw0rd!1', acceptTerms: true });
    expect(r.status).toBe(409);
  });

  it('rejects weak password', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Weak', email: `weak+${unique}@x.com`, password: 'short', confirmPassword: 'short', acceptTerms: true });
    expect(r.status).toBe(422);
  });

  it('rejects wrong password on login', async () => {
    const r = await request(app).post('/api/v1/auth/login').send({ email: testEmail, password: 'WrongPassword123!' });
    expect(r.status).toBe(401);
  });

  it('admin can issue a license, user can activate a device, validate returns BOUND', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    expect(plan).toBeTruthy();
    const user = await prisma.user.findUnique({ where: { email: testEmail } });

    // Create a license directly (admin route requires admin role, we use the service for the test)
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    expect(issued.licenseKey).toMatch(/^PAW-/);

    // Activate
    const act = await request(app)
      .post(`/api/v1/licenses/${issued.id}/activate`)
      .set('Cookie', [`pt_access=${accessToken}`])
      .send({ deviceId: 'TEST-DEVICE-AAAA-1111', deviceName: 'Test Laptop', platform: 'Windows', appVersion: '1.0.0' });
    expect(act.status).toBe(200);
    expect(act.body.data.result).toBe('ok');

    // Validate (public)
    const val = await request(app)
      .post('/api/v1/licenses/validate')
      .send({ licenseKey: issued.licenseKey, deviceId: 'TEST-DEVICE-AAAA-1111', platform: 'Windows', appVersion: '1.0.0' });
    expect(val.status).toBe(200);
    expect(val.body.data.valid).toBe(true);
    expect(val.body.data.device_status).toBe('BOUND');
  });

  it('validate returns LICENSE_INVALID for unknown key', async () => {
    const r = await request(app).post('/api/v1/licenses/validate').send({ licenseKey: 'PAW-aaaa-bbbb-cccc-dddd', deviceId: 'UNKNOWN-DEVICE-1234' });
    expect(r.status).toBe(200);
    expect(r.body.data.valid).toBe(false);
    expect(r.body.data.error_code).toBe('LICENSE_INVALID');
  });

  it('activate a second device hits the limit (Pro allows 2, so 3rd device should fail)', async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });

    // 1st device
    const r1 = await request(app).post(`/api/v1/licenses/${issued.id}/activate`).set('Cookie', [`pt_access=${accessToken}`]).send({ deviceId: 'DEV-A-001' });
    expect(r1.body.data?.result).toBe('ok');
    // 2nd device
    const r2 = await request(app).post(`/api/v1/licenses/${issued.id}/activate`).set('Cookie', [`pt_access=${accessToken}`]).send({ deviceId: 'DEV-B-002' });
    expect(r2.body.data?.result).toBe('ok');
    // 3rd device — should be limit_reached
    const third = await request(app).post(`/api/v1/licenses/${issued.id}/activate`).set('Cookie', [`pt_access=${accessToken}`]).send({ deviceId: 'DEV-C-003' });
    expect(third.body.data?.result).toBe('limit_reached');
    expect(third.body.data?.error_code).toBe('DEVICE_LIMIT_REACHED');
  });

  it('rotate key revokes old key', async () => {
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const { issueLicense, rotateKey } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    const oldKey = issued.licenseKey;

    const rotated = await rotateKey(issued.id, user!.id);
    expect(rotated.licenseKey).not.toBe(oldKey);

    // Old key should no longer validate
    const r = await request(app).post('/api/v1/licenses/validate').send({ licenseKey: oldKey, deviceId: 'ANY-DEVICE-XYZ' });
    expect(r.body.data.error_code).toBe('LICENSE_INVALID');
    // New key should validate
    const r2 = await request(app).post('/api/v1/licenses/validate').send({ licenseKey: rotated.licenseKey, deviceId: 'ANY-DEVICE-XYZ' });
    expect(r2.body.data.valid).toBe(true);
  });
});
