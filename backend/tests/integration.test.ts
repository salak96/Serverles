import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
  await prisma.appSetting.deleteMany({ where: { key: { startsWith: `free-claim:${u}:` } } });
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

  it('desktop can bind a device using its license key, then validate it as BOUND', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    const payload = {
      licenseKey: issued.licenseKey,
      deviceId: `DESKTOP-${unique}-ACTIVATE`,
      deviceName: 'Desktop integration test',
      platform: 'windows',
      appVersion: '1.2.3',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 }));
    const activated = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.11').send(payload);
    expect(activated.status).toBe(200);
    expect(activated.body.success).toBe(true);
    expect(activated.body.data.valid).toBe(true);
    expect(activated.body.data.device_status).toBe('BOUND');
    expect(activated.body.data.device.device_name).toBe(payload.deviceName);

    const validated = await request(app).post('/api/v1/licenses/validate').send(payload);
    expect(validated.body.data.valid).toBe(true);
    expect(validated.body.data.device_status).toBe('BOUND');

    const devices = await prisma.device.findMany({ where: { licenseId: issued.id, status: 'ACTIVE' } });
    expect(devices).toHaveLength(1);
    expect(devices[0].deviceName).toBe(payload.deviceName);
    const ownerNotifications = await prisma.notification.findMany({ where: { userId: user!.id, category: 'DEVICE', title: 'Perangkat baru terhubung' } });
    expect(ownerNotifications).toHaveLength(1);
    expect(ownerNotifications[0].body).toContain('HWID: ');
    expect(ownerNotifications[0].body).not.toContain(payload.deviceId);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const telegramPayload = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)) as { text: string };
    expect(telegramPayload.text).toContain('Desktop integration test');
    expect(telegramPayload.text).toContain('HWID: ');
    expect(telegramPayload.text).not.toContain(payload.deviceId);
    expect(telegramPayload.text).not.toContain(issued.licenseKey);
    expect(telegramPayload.text).not.toContain(testEmail);
    fetchSpy.mockRestore();
  });

  it('desktop activation is idempotent and does not create duplicate devices', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    const deviceName = `Idempotent desktop ${unique}`;
    const payload = { licenseKey: issued.licenseKey, deviceId: `DESKTOP-${unique}-IDEMPOTENT`, deviceName, platform: 'windows' };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 2 } }), { status: 200 }));
    const first = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.12').send(payload);
    const second = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.12').send(payload);
    expect(first.body.data.device_status).toBe('BOUND');
    expect(second.body.data.device_status).toBe('BOUND');
    expect(second.body.data.device.id).toBe(first.body.data.device.id);
    expect(await prisma.device.count({ where: { licenseId: issued.id, status: 'ACTIVE' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: user!.id, category: 'DEVICE', title: 'Perangkat baru terhubung', body: { contains: deviceName } } })).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('desktop reactivation after a device reset is blocked for 12 hours', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    const deviceId = `DESKTOP-${unique}-RESET-COOLDOWN`;
    const remote = '198.51.100.17';

    const activated = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', remote).send({ licenseKey: issued.licenseKey, deviceId });
    expect(activated.body.data.device_status).toBe('BOUND');
    const device = await prisma.device.findFirstOrThrow({ where: { licenseId: issued.id, status: 'ACTIVE' } });
    await prisma.device.update({ where: { id: device.id }, data: { status: 'UNBOUND', unboundAt: new Date() } });
    await prisma.deviceReset.create({ data: { licenseId: issued.id, deviceId: device.id, requestedById: user!.id, status: 'COMPLETED', completedAt: new Date() } });

    const duringCooldown = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', remote).send({ licenseKey: issued.licenseKey, deviceId: `DESKTOP-${unique}-RESET-NEW` });
    expect(duringCooldown.body.data.error_code).toBe('RESET_COOLDOWN_ACTIVE');

    await prisma.deviceReset.updateMany({ where: { licenseId: issued.id, status: 'COMPLETED' }, data: { completedAt: new Date(Date.now() - 13 * 60 * 60 * 1000) } });
    const afterCooldown = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', remote).send({ licenseKey: issued.licenseKey, deviceId: `DESKTOP-${unique}-RESET-NEW` });
    expect(afterCooldown.body.data.device_status).toBe('BOUND');
  });

  it('desktop activation rejects invalid and ineligible licenses', async () => {
    const invalid = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.13').send({
      licenseKey: 'PAW-aaaa-bbbb-cccc-dddd', deviceId: `DESKTOP-${unique}-INVALID`,
    });
    expect(invalid.body.data).toEqual({ valid: false, error_code: 'LICENSE_INVALID' });

    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');

    const expired = await issueLicense({ userId: user!.id, planId: plan!.id });
    await prisma.license.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expiredResponse = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.13').send({
      licenseKey: expired.licenseKey, deviceId: `DESKTOP-${unique}-EXPIRED`,
    });
    expect(expiredResponse.body.data.error_code).toBe('LICENSE_EXPIRED');

    const revoked = await issueLicense({ userId: user!.id, planId: plan!.id });
    await prisma.license.update({ where: { id: revoked.id }, data: { status: 'REVOKED', revokedAt: new Date() } });
    const revokedResponse = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.13').send({
      licenseKey: revoked.licenseKey, deviceId: `DESKTOP-${unique}-REVOKED`,
    });
    expect(revokedResponse.body.data.error_code).toBe('LICENSE_REVOKED');

    const suspended = await issueLicense({ userId: user!.id, planId: plan!.id });
    await prisma.license.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    const suspendedResponse = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.13').send({
      licenseKey: suspended.licenseKey, deviceId: `DESKTOP-${unique}-SUSPENDED`,
    });
    expect(suspendedResponse.body.data.error_code).toBe('LICENSE_SUSPENDED');

    await prisma.user.update({ where: { id: user!.id }, data: { emailVerifiedAt: null, status: 'PENDING_VERIFICATION' } });
    const unverified = await issueLicense({ userId: user!.id, planId: plan!.id });
    const unverifiedResponse = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.13').send({
      licenseKey: unverified.licenseKey, deviceId: `DESKTOP-${unique}-UNVERIFIED`,
    });
    expect(unverifiedResponse.body.data.error_code).toBe('EMAIL_NOT_VERIFIED');
    await prisma.user.update({ where: { id: user!.id }, data: { emailVerifiedAt: new Date(), status: 'ACTIVE' } });
  });

  it('desktop activation enforces the plan device limit', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'free' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    const first = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.15').send({
      licenseKey: issued.licenseKey, deviceId: `DESKTOP-${unique}-LIMIT-A`,
    });
    expect(first.body.data.device_status).toBe('BOUND');
    const second = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.15').send({
      licenseKey: issued.licenseKey, deviceId: `DESKTOP-${unique}-LIMIT-B`,
    });
    expect(second.body.data).toEqual({ valid: false, device_status: 'NOT_BOUND', error_code: 'DEVICE_LIMIT_REACHED' });
  });

  it('desktop activation rejects unauthenticated calls on the existing account endpoint', async () => {
    const result = await request(app)
      .post('/api/v1/licenses/some-license-id/activate')
      .send({ deviceId: `DESKTOP-${unique}-NOAUTH` });
    expect(result.status).toBe(401);
  });

  it('a user can claim the Free plan only once and receives an active license', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'free' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    expect(plan).toBeTruthy();

    const first = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Cookie', [`pt_access=${accessToken}`])
      .send({ planId: plan!.id, durationDays: plan!.durationDays });
    expect(first.status).toBe(201);
    expect(first.body.data.freePlan).toBe(true);
    expect(first.body.data.order.status).toBe('PAID');

    const [subscription, license] = await Promise.all([
      prisma.subscription.findFirst({ where: { userId: user!.id, planId: plan!.id, status: 'ACTIVE' } }),
      prisma.license.findFirst({ where: { userId: user!.id, planId: plan!.id, status: 'ACTIVE' } }),
    ]);
    expect(subscription).toBeTruthy();
    expect(license).toBeTruthy();

    const second = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Cookie', [`pt_access=${accessToken}`])
      .send({ planId: plan!.id, durationDays: plan!.durationDays });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('FREE_PLAN_ALREADY_CLAIMED');
  });

  it('desktop activation rejects suspended account owners', async () => {
    const plan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const { issueLicense } = await import('../src/modules/licenses/licenses.service');
    const issued = await issueLicense({ userId: user!.id, planId: plan!.id });
    await prisma.user.update({ where: { id: user!.id }, data: { status: 'SUSPENDED' } });
    try {
      const response = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.14').send({
        licenseKey: issued.licenseKey, deviceId: `DESKTOP-${unique}-OWNER-SUSPENDED`,
      });
      expect(response.body.data.error_code).toBe('LICENSE_SUSPENDED');
    } finally {
      await prisma.user.update({ where: { id: user!.id }, data: { status: 'ACTIVE' } });
    }
  });

  it('rate limits desktop activation attempts', async () => {
    const payload = {
      licenseKey: 'PAW-aaaa-bbbb-cccc-dddd',
      deviceId: `DESKTOP-${unique}-RATE-LIMIT`,
    };
    let limitedResponse: request.Response | undefined;
    for (let attempt = 0; attempt < 11; attempt++) {
      limitedResponse = await request(app).post('/api/v1/licenses/activate-device').set('X-Forwarded-For', '198.51.100.16').send(payload);
    }
    expect(limitedResponse?.status).toBe(429);
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
