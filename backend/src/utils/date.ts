/**
 * Format a Date as "DD MMMM YYYY, HH:mm WIB" (Asia/Jakarta, UTC+7).
 * Pure formatter — does not depend on the system timezone.
 */
const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatJakarta(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '-';
  // Convert to Asia/Jakarta (+07:00) without depending on the host TZ.
  const utcMs = d.getTime();
  const jakartaMs = utcMs + 7 * 60 * 60 * 1000;
  const j = new Date(jakartaMs);
  const day = pad2(j.getUTCDate());
  const month = MONTHS_ID[j.getUTCMonth()];
  const year = j.getUTCFullYear();
  const hours = pad2(j.getUTCHours());
  const minutes = pad2(j.getUTCMinutes());
  return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
}

export function jakartaNow(): Date {
  return new Date();
}

export function formatRupiah(amount: number | string | bigint): string {
  const n = typeof amount === 'bigint' ? Number(amount) : Number(amount);
  if (!Number.isFinite(n)) return 'Rp 0';
  return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n);
}

export function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
