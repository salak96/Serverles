import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

const app = createApp();
const unique = Date.now().toString(36);
let adminEmail = `bulk-admin+${unique}@pawang.local`;
function nextAdminEmail() { adminEmail = `bulk-admin+${unique}-${Math.random().toString(36).slice(2, 6)}@pawang.local`; return adminEmail; }
function nextUserEmail() { return `bulk-user+${unique}-${Math.random().toString(36).slice(2, 6)}@pawang.local`; }

async function cleanupAll(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { contains: 'bulk-' } } });
}

async function makeAdmin(): Promise<{ id: string; email: string; accessToken: string }> {
  const bcrypt = await import('argon2');
  const email = nextAdminEmail();
  const passwordHash = await bcrypt.hash('TestP@ssw0rd!1', { type: bcrypt.argon2id });
  const admin = await prisma.user.create({
    data: { email, name: 'Bulk Admin', passwordHash, role: 'ADMIN', status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'TestP@ssw0rd!1' });
  return { id: admin.id, email, accessToken: login.body.data.accessToken };
}

async function makeUser(name: string): Promise<string> {
  const bcrypt = await import('argon2');
  const passwordHash = await bcrypt.hash('TestP@ssw0rd!1', { type: bcrypt.argon2id });
  const u = await prisma.user.create({
    data: { email: nextUserEmail(), name, passwordHash, role: 'USER', status: 'ACTIVE', emailVerifiedAt: new Date() },
  });
  return u.id;
}

beforeAll(async () => { await cleanupAll(); });
afterAll(async () => { await cleanupAll(); await prisma.$disconnect(); });

describe('Admin bulk delete users', () => {
  it('admin cannot bulk-delete themselves', async () => {
    const admin = await makeAdmin();
    const id1 = await makeUser('User 1');
    const id2 = await makeUser('User 2');
    const r = await request(app).post('/api/v1/admin/users/bulk-delete').set('Authorization', `Bearer ${admin.accessToken}`).send({ ids: [admin.id, id1, id2] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('SELF_DELETE_FORBIDDEN');
    expect(await prisma.user.count({ where: { id: { in: [admin.id, id1, id2] } } })).toBe(3);
  });

  it('admin cannot delete the last admin', async () => {
    const admin = await makeAdmin();
    const id1 = await makeUser('User 1');
    const r = await request(app).post('/api/v1/admin/users/bulk-delete').set('Authorization', `Bearer ${admin.accessToken}`).send({ ids: [admin.id, id1] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('SELF_DELETE_FORBIDDEN');
  });

  it('admin can bulk-delete other users', async () => {
    const admin = await makeAdmin();
    const id1 = await makeUser('User 1');
    const id2 = await makeUser('User 2');
    const id3 = await makeUser('User 3');
    const r = await request(app).post('/api/v1/admin/users/bulk-delete').set('Authorization', `Bearer ${admin.accessToken}`).send({ ids: [id1, id2, id3] });
    expect(r.status).toBe(200);
    expect(r.body.data.deleted).toBe(3);
    expect(await prisma.user.count({ where: { id: { in: [id1, id2, id3] } } })).toBe(0);
  });
});
