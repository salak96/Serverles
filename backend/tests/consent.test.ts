import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

const app = createApp();
const unique = Date.now().toString(36);
const baseEmail = `consent+${unique}@pawangtools.local`;

async function cleanupByEmail(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
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

const validPayload = {
  name: 'Consent Tester',
  email: '',
  password: 'TestP@ssw0rd!1',
  confirmPassword: 'TestP@ssw0rd!1',
  acceptTerms: true,
};

beforeAll(async () => {
  await cleanupByEmail(baseEmail);
  await cleanupByEmail(`${baseEmail}-nocheck`);
});

afterAll(async () => {
  await cleanupByEmail(baseEmail);
  await cleanupByEmail(`${baseEmail}-nocheck`);
  await prisma.$disconnect();
});

describe('registration consent flow', () => {
  it('rejects registration when acceptTerms is false', async () => {
    const email = `${baseEmail}-nocheck`;
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email, acceptTerms: false });
    expect(r.status).toBe(422);
    // Zod path uses the error message we set in the schema
    expect(r.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration when acceptTerms is missing', async () => {
    const email = `${baseEmail}-nocheck`;
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'X', email, password: 'TestP@ssw0rd!1', confirmPassword: 'TestP@ssw0rd!1' });
    expect(r.status).toBe(422);
  });

  it('accepts registration when acceptTerms is true and records consent in audit log', async () => {
    const email = baseEmail;
    const r = await request(app).post('/api/v1/auth/register').send({ ...validPayload, email });
    expect(r.status).toBe(201);
    expect(r.body.success).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: { actorUserId: user!.id, action: 'auth.register' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    const meta = audit!.metadata as { consent?: { termsOfService: boolean; privacyPolicy: boolean; acceptedAt: string } } | null;
    expect(meta?.consent?.termsOfService).toBe(true);
    expect(meta?.consent?.privacyPolicy).toBe(true);
    expect(typeof meta?.consent?.acceptedAt).toBe('string');
  });
});
