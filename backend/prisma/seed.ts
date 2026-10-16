/**
 * Seed initial data:
 *  - Plans: Free, Basic, Pro, Premium (data awal, dapat diubah admin)
 *  - Settings: HWID reset defaults, license policy defaults
 *  - Tools: None (admin manages via /admin/tools)
 *
 * Re-running this seed is safe; existing records are upserted by slug/key.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const PLANS = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Paket gratis untuk mencoba PawangTools.',
    price: new Prisma.Decimal(0),
    durationDays: 30,
    maxDevices: 1,
    features: ['Akses 1 tools dasar', 'Forum komunitas', 'Dukungan lewat email'],
    resetPolicy: {
      maxResets: 1,
      periodDays: 30,
      cooldownDays: 7,
      requireAdmin: false,
      requireEmailVerification: true,
    },
    availableDurations: [{ days: 30, label: 'Bulanan', price: 0 }],
    sortOrder: 1,
  },
  {
    name: 'Basic',
    slug: 'basic',
    description: 'Untuk pengguna harian yang membutuhkan stabilitas.',
    price: new Prisma.Decimal(49000),
    durationDays: 30,
    maxDevices: 1,
    features: ['1 perangkat aktif', 'Akses tools standar', 'Update otomatis'],
    resetPolicy: {
      maxResets: 2,
      periodDays: 30,
      cooldownDays: 7,
      requireAdmin: false,
      requireEmailVerification: true,
    },
    availableDurations: [
      { days: 30, label: 'Bulanan', price: 49000 },
      { days: 90, label: '3 Bulanan', price: 129000 },
      { days: 180, label: '6 Bulanan', price: 239000 },
      { days: 365, label: 'Tahunan', price: 449000 },
    ],
    sortOrder: 2,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Untuk kreator dan power user dengan multi-perangkat.',
    price: new Prisma.Decimal(99000),
    durationDays: 30,
    maxDevices: 2,
    features: [
      'Hingga 2 perangkat aktif',
      'Akses semua tools utama',
      'Update otomatis',
      'Dukungan prioritas',
    ],
    resetPolicy: {
      maxResets: 3,
      periodDays: 30,
      cooldownDays: 5,
      requireAdmin: false,
      requireEmailVerification: true,
    },
    availableDurations: [
      { days: 30, label: 'Bulanan', price: 99000 },
      { days: 90, label: '3 Bulanan', price: 269000 },
      { days: 180, label: '6 Bulanan', price: 499000 },
      { days: 365, label: 'Tahunan', price: 899000 },
    ],
    sortOrder: 3,
  },
  {
    name: 'Premium',
    slug: 'premium',
    description: 'Paket tertinggi dengan semua fitur dan perangkat.',
    price: new Prisma.Decimal(199000),
    durationDays: 30,
    maxDevices: 3,
    features: [
      'Hingga 3 perangkat aktif',
      'Akses penuh semua tools',
      'Akses awal fitur beta',
      'Dukungan prioritas 24/7',
    ],
    resetPolicy: {
      maxResets: 5,
      periodDays: 30,
      cooldownDays: 3,
      requireAdmin: false,
      requireEmailVerification: true,
    },
    availableDurations: [
      { days: 30, label: 'Bulanan', price: 199000 },
      { days: 90, label: '3 Bulanan', price: 549000 },
      { days: 180, label: '6 Bulanan', price: 999000 },
      { days: 365, label: 'Tahunan', price: 1799000 },
    ],
    sortOrder: 4,
  },
];

const SETTINGS = [
  {
    key: 'hwid.reset.default',
    value: { maxResets: 2, periodDays: 30, cooldownDays: 7, requireAdmin: false, requireEmailVerification: true },
  },
  {
    key: 'license.key_format',
    value: { prefix: 'PAW', groups: 4, groupSize: 8, alphabet: 'hex' },
  },
  {
    key: 'license.signing.enabled',
    value: true,
  },
  {
    key: 'maintenance.mode',
    value: false,
  },
  {
    key: 'notifications.global.enabled',
    value: true,
  },
];

async function main(): Promise<void> {
  console.log('Seeding plans...');
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        durationDays: plan.durationDays,
        maxDevices: plan.maxDevices,
        features: plan.features as unknown as Prisma.InputJsonValue,
        resetPolicy: plan.resetPolicy as unknown as Prisma.InputJsonValue,
        availableDurations: plan.availableDurations as unknown as Prisma.InputJsonValue,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        price: plan.price,
        durationDays: plan.durationDays,
        maxDevices: plan.maxDevices,
        features: plan.features as unknown as Prisma.InputJsonValue,
        resetPolicy: plan.resetPolicy as unknown as Prisma.InputJsonValue,
        availableDurations: plan.availableDurations as unknown as Prisma.InputJsonValue,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
    console.log(`  - ${plan.name} (${plan.slug})`);
  }

  console.log('Seeding app settings...');
  for (const s of SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: { value: s.value as unknown as Prisma.InputJsonValue },
      create: { key: s.key, value: s.value as unknown as Prisma.InputJsonValue },
    });
    console.log(`  - ${s.key}`);
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
