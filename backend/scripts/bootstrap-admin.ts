/**
 * Bootstrap the first admin user.
 *
 * SECURITY: This script is meant to be run from the server shell only,
 * not exposed as an HTTP endpoint. It will refuse to run if NODE_ENV=production
 * unless the explicit --force flag is passed.
 *
 * Usage:
 *   # via env (preferred)
 *   BOOTSTRAP_ADMIN_EMAIL=admin@x.com BOOTSTRAP_ADMIN_NAME="Admin" \
 *     BOOTSTRAP_ADMIN_PASSWORD='StrongP@ssw0rd!' npx tsx scripts/bootstrap-admin.ts
 *
 *   # interactive
 *   npx tsx scripts/bootstrap-admin.ts --interactive
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import argon2 from 'argon2';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const prisma = new PrismaClient();

async function ask(question: string, hidden = false): Promise<string> {
  if (hidden) {
    const rl = readline.createInterface({ input, output });
    process.stdout.write(question);
    return new Promise((resolve) => {
      const silentRl = readline.createInterface({ input, output, terminal: true });
      // Best-effort: mute echo on platforms that support it.
      const stdinAny = process.stdin as unknown as { isTTY?: boolean; on: (e: string, fn: (data: Buffer) => void) => void };
      const origWrite = (process.stdout as unknown as { write: (b: string) => boolean }).write.bind(process.stdout);
      let value = '';
      silentRl.on('line', (line) => {
        value = line;
        silentRl.close();
        origWrite('\n');
        resolve(value);
      });
      void rl;
      void stdinAny;
    });
  }
  const rl = readline.createInterface({ input, output });
  const ans = await rl.question(question);
  rl.close();
  return ans;
}

function isStrongPassword(p: string): boolean {
  if (p.length < 10) return false;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasDigit = /\d/.test(p);
  const hasSymbol = /[^A-Za-z0-9]/.test(p);
  return hasUpper && hasLower && hasDigit && hasSymbol;
}

async function main(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const force = process.argv.includes('--force');
  if (isProd && !force) {
    console.error('Refusing to bootstrap admin in production without --force.');
    process.exit(1);
  }

  let email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? '';
  let name = process.env.BOOTSTRAP_ADMIN_NAME ?? '';
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';

  if (process.argv.includes('--interactive') || (!email || !password)) {
    if (!email) email = (await ask('Email admin: ')).trim();
    if (!name) name = (await ask('Nama admin: ')).trim();
    if (!password) password = (await ask('Password admin: ', true));
  }

  if (!email || !name || !password) {
    console.error('Email, nama, dan password wajib diisi.');
    process.exit(1);
  }
  if (!isStrongPassword(password)) {
    console.error('Password lemah. Gunakan minimal 10 karakter dengan huruf besar, kecil, angka, dan simbol.');
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === UserRole.ADMIN) {
      console.log('Pengguna sudah menjadi admin. Tidak ada perubahan.');
      return;
    }
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
    });
    console.log(`Pengguna ${email} dipromosikan menjadi admin.`);
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Admin dibuat: ${user.email} (id=${user.id}).`);
}

main()
  .catch((e) => {
    console.error('Bootstrap admin gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
