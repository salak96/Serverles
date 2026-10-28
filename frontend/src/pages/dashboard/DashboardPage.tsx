import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package,
  Key,
  Clock,
  CreditCard,
  HardDrive,
  ArrowRight,
  Shield,
  MessageCircle,
  HelpCircle,
  Bell,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui';
import { formatJakarta, daysBetween, formatRupiah } from '@/lib/format';
import type { License, NotificationList } from '@/types';

interface UserOrder {
  id: string;
  amount: number;
  amountFormatted?: string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  durationDays: number;
  createdAt: string;
  paidAt: string | null;
  plan: { name: string; slug: string };
}

export function DashboardPage() {
  const { user } = useAuth();
  const greeting = greetingNow();

  // Queries for User Data (Strictly isolated from global server monitoring)
  const licenses = useQuery({
    queryKey: ['licenses', 'me'],
    queryFn: () => api<License[]>('/licenses/me'),
  });

  const orders = useQuery({
    queryKey: ['subscriptions', 'orders', 'me'],
    queryFn: () => api<UserOrder[]>('/subscriptions/orders'),
  });

  const notifications = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => api<NotificationList>('/notifications', { query: { limit: 4 } }),
  });

  // License & Device calculations
  const activeLicenses = licenses.data?.filter((l) => l.status === 'ACTIVE' && new Date(l.expiresAt) > new Date()) ?? [];
  const totalActiveDevices = activeLicenses.reduce((sum, l) => sum + l.activeDevices, 0);
  const totalSlots = activeLicenses.reduce((sum, l) => sum + l.maxDevices, 0);
  const primaryLic = activeLicenses[0];
  const daysLeft = primaryLic ? Math.max(0, daysBetween(new Date().toISOString(), primaryLic.expiresAt)) : 0;

  // Orders & Payment calculations
  const userOrders = orders.data ?? [];
  const paidOrders = userOrders.filter((o) => o.status === 'PAID');
  const totalPaidAmount = paidOrders.reduce((sum, o) => sum + Number(o.amount), 0);
  const pendingOrders = userOrders.filter((o) => o.status === 'PENDING');

  // Slot utilization percentage for user's own quota
  const slotPercent = totalSlots > 0 ? Math.min(100, Math.round((totalActiveDevices / totalSlots) * 100)) : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Greeting Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {greeting}, {user?.name?.split(' ')[0] ?? 'Pengguna'}.
          </h2>
          <p className="text-xs sm:text-sm text-[#A7B0C0] mt-0.5">
            Kelola paket langganan, kunci lisensi, dan perangkat Anda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/subscriptions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFA500] hover:from-[#FFA500] hover:to-[#FF8A00] shadow-[0_2px_15px_rgba(255,138,0,0.3)] transition-all"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pilih Paket Baru</span>
          </Link>
        </div>
      </div>

      {/* =========================================================================
          4 STATISTIC CARDS (TOP SECTION) - UNIFORM HEIGHT & GAP
      ========================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Stat 1: Paket Aktif */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-4.5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Paket Aktif
            </span>
            <div className="p-1.5 rounded-lg bg-[#FF8A00]/10 text-[#FF8A00]">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {licenses.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="text-lg sm:text-xl font-extrabold text-white truncate" title={primaryLic ? primaryLic.plan.name : 'Belum Berlangganan'}>
                {primaryLic ? primaryLic.plan.name : 'Belum Berlangganan'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${primaryLic ? 'bg-[#10B981]' : 'bg-[#A7B0C0]'}`} />
              <span className="truncate">{primaryLic ? `${activeLicenses.length} Lisensi Berjalan` : 'Pilih paket di menu Langganan'}</span>
            </div>
          </div>
        </div>

        {/* Stat 2: Lisensi Aktif */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-4.5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Lisensi Aktif
            </span>
            <div className="p-1.5 rounded-lg bg-[#FFA500]/10 text-[#FFA500]">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {licenses.isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-lg sm:text-xl font-extrabold text-white">
                {activeLicenses.length} Lisensi
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1 truncate">
              {totalSlots > 0 ? `${totalActiveDevices}/${totalSlots} Perangkat Terikat` : 'Belum ada perangkat'}
            </div>
          </div>
        </div>

        {/* Stat 3: Sisa Waktu */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-4.5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Sisa Waktu
            </span>
            <div className="p-1.5 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {licenses.isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-lg sm:text-xl font-extrabold text-white">
                {primaryLic ? `${daysLeft} Hari` : '—'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1 truncate">
              {primaryLic ? `Berakhir ${formatJakarta(primaryLic.expiresAt)}` : 'Tidak ada masa aktif'}
            </div>
          </div>
        </div>

        {/* Stat 4: Total Pembayaran */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-4.5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Total Pembayaran
            </span>
            <div className="p-1.5 rounded-lg bg-[#10B981]/10 text-[#10B981]">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {orders.isLoading ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <div className="text-lg sm:text-xl font-extrabold text-white truncate">
                {orders.data ? formatRupiah(totalPaidAmount) : '—'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1 flex items-center justify-between">
              <span>{paidOrders.length} Transaksi Lunas</span>
              {pendingOrders.length > 0 && (
                <span className="text-warning font-semibold">({pendingOrders.length} Pending)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          UNIFIED TWO-COLUMN LAYOUT (FLOW INDEPENDEN, TIDAK ADA CELAH KOSONG)
      ========================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        
        {/* =======================================================================
            KOLOM KIRI (58-60% width: col-span-12 lg:col-span-7)
            1. Paket & Lisensi Saya
            2. Riwayat Order & Pembayaran
        ======================================================================== */}
        <div className="lg:col-span-7 flex flex-col gap-3.5 sm:gap-4 min-w-0">
          
          {/* Card 1: Paket & Lisensi Saya */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#292D35] pb-2.5">
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">Paket &amp; Lisensi Saya</h3>
                <p className="text-[11px] text-[#A7B0C0]">Daftar lisensi aktif yang terikat ke akun Anda.</p>
              </div>
              <Link
                to="/licenses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF8A00] hover:text-[#FFA500] transition-colors"
              >
                <span>Kelola lisensi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {licenses.isLoading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : activeLicenses.length === 0 ? (
              <div className="py-6 text-center space-y-2.5">
                <Package className="w-9 h-9 text-[#A7B0C0] mx-auto" />
                <div className="text-sm font-semibold text-white">Belum Ada Paket Aktif</div>
                <p className="text-xs text-[#A7B0C0] max-w-sm mx-auto leading-relaxed">
                  Pilih paket langganan untuk mulai menggunakan bot &amp; lisensi resmi PawangTools.
                </p>
                <div className="pt-1">
                  <Link
                    to="/subscriptions"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFA500]"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pilih Paket Langganan</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeLicenses.slice(0, 3).map((l) => (
                  <div
                    key={l.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-[#0D1118] border border-[#292D35] hover:border-[#FF8A00]/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs sm:text-sm truncate">{l.plan.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 uppercase">
                          Aktif
                        </span>
                      </div>
                      <div className="text-[11px] text-[#A7B0C0] mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                        <span>{l.activeDevices}/{l.maxDevices} Slot PC</span>
                        <span>•</span>
                        <span>Berakhir: {formatJakarta(l.expiresAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Link
                        to={`/licenses/${l.id}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#171B24] border border-[#292D35] hover:border-[#FF8A00] hover:text-[#FFA500] transition-colors"
                      >
                        Buka Kunci
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Riwayat Order & Pembayaran */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#292D35] pb-2.5">
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base">Riwayat Order &amp; Pembayaran</h3>
                <p className="text-[11px] text-[#A7B0C0]">Catatan transaksi paket langganan Anda.</p>
              </div>
              <Link
                to="/subscriptions"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF8A00] hover:text-[#FFA500] transition-colors"
              >
                <span>Lihat semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {orders.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : userOrders.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#A7B0C0]">
                Belum ada riwayat pesanan.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0D1118] text-[#A7B0C0] border-b border-[#292D35] font-semibold">
                    <tr>
                      <th className="px-3 py-2">ID Order</th>
                      <th className="px-3 py-2">Paket</th>
                      <th className="px-3 py-2">Jumlah</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#292D35]/60 text-white">
                    {userOrders.slice(0, 4).map((o) => (
                      <tr key={o.id} className="hover:bg-[#161B24] transition-colors">
                        <td className="px-3 py-2 font-mono text-[11px] text-[#FFA500] max-w-[90px] truncate" title={o.id}>
                          {o.id}
                        </td>
                        <td className="px-3 py-2 font-medium truncate max-w-[130px]" title={o.plan.name}>
                          {o.plan.name} ({o.durationDays}h)
                        </td>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">
                          {o.amountFormatted ?? formatRupiah(o.amount)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              o.status === 'PAID'
                                ? 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                                : o.status === 'PENDING'
                                ? 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning/15 text-warning border border-warning/30'
                                : 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-line/60 text-ink-muted'
                            }
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-[#A7B0C0] whitespace-nowrap">
                          {formatJakarta(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* =======================================================================
            KOLOM KANAN (40-42% width: col-span-12 lg:col-span-5)
            1. Ringkasan Kuota Perangkat
            2. Panduan Aktivasi Cepat
            3. Notifikasi Terbaru
        ======================================================================== */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4 min-w-0">
          
          {/* Card 1: Ringkasan Kuota Perangkat (User's Own Quota) */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#292D35] pb-2.5">
              <div>
                <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[#FF8A00]" />
                  <span>Ringkasan Kuota Perangkat</span>
                </h3>
                <p className="text-[11px] text-[#A7B0C0]">Kapasitas slot HWID lisensi aktif Anda.</p>
              </div>
              <Link
                to="/devices"
                className="text-xs font-semibold text-[#FF8A00] hover:text-[#FFA500]"
              >
                Perangkat →
              </Link>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-[#0D1118] border border-[#292D35] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A7B0C0]">Kapasitas Terpakai</span>
                  <span className="font-bold text-white">
                    {totalActiveDevices} dari {totalSlots} Slot ({slotPercent}%)
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 bg-[#171B24] rounded-full overflow-hidden p-0.5 border border-[#292D35]">
                  <div
                    style={{ width: `${slotPercent}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FFA500] shadow-[0_0_8px_rgba(255,138,0,0.4)] transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#A7B0C0] pt-0.5">
                  <span>Tersedia: {Math.max(0, totalSlots - totalActiveDevices)} slot</span>
                  <span>Maksimum: {totalSlots} PC</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0D1118]/80 border border-[#292D35] text-[11px] text-[#A7B0C0] flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-[#FFA500] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Lisensi terikat ke identitas HWID komputer. Anda dapat melepas atau mereset perangkat di menu Perangkat jika berganti PC.
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Panduan Aktivasi Cepat */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#FF8A00]" />
              <span>Panduan Aktivasi Cepat</span>
            </h3>

            <ol className="text-xs text-[#A7B0C0] space-y-2 list-decimal pl-4 leading-relaxed">
              <li>
                Pilih paket di menu{' '}
                <Link to="/subscriptions" className="text-[#FF8A00] font-semibold hover:underline">
                  Langganan &amp; Order
                </Link>
                .
              </li>
              <li>Selesaikan pembayaran (QRIS / Bank) hingga diverifikasi.</li>
              <li>
                Salin Kunci Lisensi di menu{' '}
                <Link to="/licenses" className="text-[#FF8A00] font-semibold hover:underline">
                  Lisensi &amp; HWID
                </Link>
                .
              </li>
              <li>
                Buka aplikasi di PC Anda, lalu tempelkan lisensi untuk aktivasi perangkat otomatis.
              </li>
            </ol>

            <div className="pt-2 border-t border-[#292D35]/80">
              <a
                href="https://wa.me/6285867336036"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-black bg-[#22C55E] hover:bg-[#16A34A] transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Bantuan Admin WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Card 3: Notifikasi Terbaru */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#292D35]">
              <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#FFA500]" />
                <span>Notifikasi Terbaru</span>
              </h3>
              <Link to="/notifications" className="text-xs text-[#FF8A00] hover:text-[#FFA500]">
                Lihat semua →
              </Link>
            </div>
            {notifications.isLoading ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : !notifications.data?.items.length ? (
              <p className="text-xs text-[#A7B0C0] text-center py-3">Belum ada notifikasi baru.</p>
            ) : (
              <ul className="space-y-2">
                {notifications.data.items.slice(0, 3).map((n) => (
                  <li key={n.id} className="text-xs border-l-2 border-[#FF8A00] pl-2.5 py-0.5">
                    <div className="font-semibold text-white truncate">{n.title}</div>
                    <div className="text-[#A7B0C0] text-[11px] line-clamp-1 mt-0.5">{n.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>

      </div>

      {/* Admin Quick Jump (Hanya muncul jika yang sedang login adalah ADMIN) */}
      {user?.role === 'ADMIN' && (
        <div className="bg-[#12151B] border border-[#FF8A00]/40 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FF8A00]/15 text-[#FF8A00]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Akun Administrator Terdeteksi</div>
              <div className="text-[11px] text-[#A7B0C0]">
                Beralih ke portal administrasi penuh untuk mengelola order, pengguna, dan lisensi.
              </div>
            </div>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#FF8A00] to-[#FFA500] shrink-0"
          >
            <span>Buka Admin Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

function greetingNow(): string {
  const hourText = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  const h = Number(hourText);
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}
