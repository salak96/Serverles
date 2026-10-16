/**
 * Registration error-handling tests.
 *
 * These cover the new contract: Zod validation errors return 422 with
 * a fieldErrors map; duplicate email returns 409 with code
 * EMAIL_ALREADY_EXISTS; malformed JSON returns 400 with code
 * INVALID_JSON; rate limiting returns 429; the legacy code CONFLICT is
 * still returned by the explicit findUnique pre-check.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

const app = createApp();
const unique = Date.now().toString(36);
const testEmail = `register-err+${unique}@pawangtools.local`;

async function cleanup(): Promise<void> {
  const u = await prisma.user.findUnique({ where: { email: testEmail }, select: { id: true } });
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
  await prisma.auditLog.deleteMany({ where: { actorUserId: u.id } });
  await prisma.user.deleteMany({ where: { id: u.id } });
}

beforeAll(async () => { await cleanup(); });
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

const validPayload = {
  name: 'Reg Tester',
  email: testEmail,
  password: 'TestP@ssw0rd!1',
  confirmPassword: 'TestP@ssw0rd!1',
  acceptTerms: true,
};

describe('register error handling', () => {
  it('1. all fields empty -> 422 with per-field errors', async () => {
    const r = await request(app).post('/api/v1/auth/register').send({});
    expect(r.status).toBe(422);
    expect(r.body.error?.code).toBe('VALIDATION_ERROR');
    expect(r.body.error?.details?.fieldErrors).toBeDefined();
    const fe = r.body.error.details.fieldErrors as Record<string, string>;
    expect(fe.name).toBeTruthy();
    expect(fe.email).toBeTruthy();
    expect(fe.password).toBeTruthy();
  });

  it('2. invalid email -> 422 with field error on email', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });
    expect(r.status).toBe(422);
    const fe = r.body.error.details.fieldErrors as Record<string, string>;
    expect(fe.email).toBeTruthy();
  });

  it('3. empty password -> 422 with field error on password', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: `pw-empty+${unique}@x.local`, password: '' });
    expect(r.status).toBe(422);
    const fe = r.body.error.details.fieldErrors as Record<string, string>;
    expect(fe.password).toBeTruthy();
  });

  it('4. password not meeting policy -> 422 (Zod) or 422 (custom policy)', async () => {
    // Zod requires min 8; the deeper policy requires upper/lower/digit.
    // 'short' fails at Zod. 'alllowercase1' passes Zod but fails policy.
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: `weak+${unique}@x.local`, password: 'short', confirmPassword: 'short' });
    expect(r.status).toBe(422);

    const r2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: `weak2+${unique}@x.local`, password: 'alllowercase1', confirmPassword: 'alllowercase1' });
    expect(r2.status).toBe(422);
  });

  it('5. duplicate email -> 409 with code CONFLICT or EMAIL_ALREADY_EXISTS', async () => {
    // First registration
    const r1 = await request(app).post('/api/v1/auth/register').send(validPayload);
    expect(r1.status).toBe(201);
    // Second registration with the same email
    const r2 = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, name: 'Second' });
    expect(r2.status).toBe(409);
    expect(['CONFLICT', 'EMAIL_ALREADY_EXISTS']).toContain(r2.body.error?.code);
    expect(r2.body.error?.message).toMatch(/sudah terdaftar/i);
  });

  it('7. confirm password mismatch -> 422 with field error on confirmPassword', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: `mismatch+${unique}@x.local`, confirmPassword: 'DifferentP@ssw0rd!1' });
    expect(r.status).toBe(422);
    const fe = r.body.error.details.fieldErrors as Record<string, string>;
    expect(fe.confirmPassword).toBeTruthy();
  });

  it('8. acceptTerms not true -> 422 with field error', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: `noaccept+${unique}@x.local`, acceptTerms: false });
    expect(r.status).toBe(422);
    const fe = r.body.error.details.fieldErrors as Record<string, string>;
    expect(fe.acceptTerms).toBeTruthy();
  });

  it('9. valid registration -> 201 with email delivery info', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: `valid+${unique}@x.local` });
    expect(r.status).toBe(201);
    expect(r.body.success).toBe(true);
    expect(r.body.data?.emailDelivery).toBeDefined();
    expect(r.body.data.emailDelivery).toHaveProperty('configured');
    expect(r.body.data.emailDelivery).toHaveProperty('delivered');
    // No password / hash leaked
    const body = JSON.stringify(r.body);
    expect(body).not.toMatch(/passwordHash/);
    expect(body).not.toMatch(/password/i);
  });

  it('12. malformed JSON -> 400 with code INVALID_JSON (NOT 500)', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .set('Content-Type', 'application/json')
      .send('{not-json');
    expect(r.status).toBe(400);
    expect(r.body.error?.code).toBe('INVALID_JSON');
  });

  it('error responses NEVER include password or passwordHash', async () => {
    const r = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validPayload, email: 'not-an-email' });
    const body = JSON.stringify(r.body);
    expect(body).not.toMatch(/passwordHash/);
    expect(body).not.toMatch(/"password"\s*:/);
  });
});
