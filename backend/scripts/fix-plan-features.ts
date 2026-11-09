/**
 * Perbaiki features paket yang terhapus panel admin lama.
 *
 * Masalah: AdminPlansPage lama mengirim `features: []` di setiap simpan,
 * sehingga semua paket di database kehilangan daftar fiturnya — endpoint
 * /api/v1/licenses/validate mengembalikan allowed_features kosong dan
 * aplikasi desktop menolak membuka tools (FEATURE_NOT_ALLOWED).
 *
 * Script ini menambahkan flag kapabilitas 'tool-access' ke paket berbayar
 * (basic, pro, premium) TANPA mengubah harga, durasi, maxDevices, atau
 * fitur lain yang sudah ada. Paket free sengaja tidak disentuh.
 *
 * Jalankan di server, dari folder backend/ (supaya DATABASE_URL dari .env terbaca):
 *   npx tsx scripts/fix-plan-features.ts --dry-run   # lihat dulu apa yang berubah
 *   npx tsx scripts/fix-plan-features.ts             # terapkan
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const TOOL_ACCESS = 'tool-access';
const PAID_SLUGS = ['basic', 'pro', 'premium'];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? 'DRY RUN — tidak ada yang diubah.' : 'Menerapkan perbaikan features paket...');
  let changed = 0;
  for (const slug of PAID_SLUGS) {
    const plan = await prisma.plan.findUnique({ where: { slug } });
    if (!plan) {
      console.log(`  - ${slug}: tidak ditemukan, dilewati.`);
      continue;
    }
    const features = asStringArray(plan.features);
    if (features.includes(TOOL_ACCESS)) {
      console.log(`  - ${plan.name} (${slug}): sudah punya '${TOOL_ACCESS}', tidak diubah.`);
      continue;
    }
    const next = [...features, TOOL_ACCESS];
    console.log(`  - ${plan.name} (${slug}): ${JSON.stringify(features)} -> ${JSON.stringify(next)}`);
    if (!dryRun) {
      await prisma.plan.update({
        where: { slug },
        data: { features: next as unknown as Prisma.InputJsonValue },
      });
    }
    changed += 1;
  }
  console.log(changed === 0 ? 'Tidak ada paket yang perlu diperbaiki.' : `${changed} paket ${dryRun ? 'akan diperbaiki' : 'diperbaiki'}.`);
  if (!dryRun && changed > 0) {
    console.log('Selesai. Cek ulang dengan: curl https://pawangstore.web.id/api/v1/plans');
  }
}

main()
  .catch((e) => {
    console.error('Gagal:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
