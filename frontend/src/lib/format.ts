const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

export function formatJakarta(iso: string | Date | null | undefined): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '-';
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: JAKARTA_TIME_ZONE,
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.day} ${values.month} ${values.year}, ${values.hour}:${values.minute} WIB`;
}

export function formatRupiah(n: number | string | null | undefined): string {
  const num = typeof n === 'string' ? Number(n) : n ?? 0;
  if (!Number.isFinite(num)) return 'Rp 0';
  return 'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
