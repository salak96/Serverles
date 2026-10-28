import { Link } from 'react-router-dom';
import {
  Users,
  Key,
  Clock,
  TrendingUp,
  Server,
  Database,
  Mail,
  CreditCard,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Package,
  Settings,
  BarChart3,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { Skeleton } from '@/components/ui';

interface DashboardData {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  activeDevices: number;
  pendingDeviceResets: number;
  totalTools: number;
  totalOrders: number;
  pendingPayments: number;
  monthlyRevenue: number;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    result: string;
    createdAt: string;
    actorUserId: string | null;
    actor?: { id: string; name: string; email: string } | null;
  }>;
  generatedAt: string;
}

interface HealthData {
  status: string;
  checks: {
    database: { status: string; latency_ms: number | null };
  };
  integrations: {
    smtp: string;
    payment: string;
    storage: string;
  };
  meta?: {
    response_time_ms?: number;
  };
}

export function AdminDashboardPage() {
  const dash = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => api<DashboardData>('/admin/dashboard'),
    refetchInterval: 45_000,
  });

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<HealthData>('/health'),
    refetchInterval: 30_000,
  });

  // Accurate metric values for the Ringkasan Sistem Bar Chart
  const userCount = dash.data?.totalUsers ?? 0;
  const licenseCount = dash.data?.totalLicenses ?? 0;
  const paymentCount = dash.data?.totalOrders ?? 0;
  const chartMax = Math.max(userCount, licenseCount, paymentCount, 1);

  const userBarPercent = Math.max(Math.round((userCount / chartMax) * 100), userCount > 0 ? 8 : 2);
  const licenseBarPercent = Math.max(Math.round((licenseCount / chartMax) * 100), licenseCount > 0 ? 8 : 2);
  const paymentBarPercent = Math.max(Math.round((paymentCount / chartMax) * 100), paymentCount > 0 ? 8 : 2);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Admin Dashboard
        </h2>
        <p className="text-sm text-[#A7B0C0] mt-1">
          Ringkasan metrik, sistem lisensi, dan log operasional PawangTools.
        </p>
      </div>

      {/* =========================================================================
          4 STATISTIC CARDS (TOP SECTION)
      ========================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Total Pengguna */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Total Pengguna
            </span>
            <div className="p-2 rounded-xl bg-[#FF8A00]/10 text-[#FF8A00]">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {dash.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {dash.data?.totalUsers.toLocaleString('id-ID') ?? '—'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              {dash.data ? `${dash.data.verifiedUsers} Terverifikasi` : '—'}
            </div>
          </div>
        </div>

        {/* Stat 2: Lisensi Aktif */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Lisensi Aktif
            </span>
            <div className="p-2 rounded-xl bg-[#FFA500]/10 text-[#FFA500]">
              <Key className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {dash.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {dash.data?.activeLicenses.toLocaleString('id-ID') ?? '—'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1">
              {dash.data ? `${dash.data.expiredLicenses} Kedaluwarsa` : '—'}
            </div>
          </div>
        </div>

        {/* Stat 3: Pembayaran Menunggu */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Pembayaran Menunggu
            </span>
            <div className="p-2 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {dash.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {dash.data?.pendingPayments.toLocaleString('id-ID') ?? '0'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1 flex items-center justify-between">
              <span>{(dash.data?.pendingPayments ?? 0) > 0 ? 'Menunggu verifikasi' : 'Semua telah diproses'}</span>
              {(dash.data?.pendingPayments ?? 0) > 0 && (
                <Link to="/admin/orders" className="text-[#FF8A00] font-semibold hover:underline">
                  Periksa
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stat 4: Pendapatan Bulan Ini */}
        <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 flex flex-col justify-between hover:border-[#FF8A00]/40 transition-colors shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-[#A7B0C0] uppercase tracking-wider">
              Pendapatan Bulan Ini
            </span>
            <div className="p-2 rounded-xl bg-[#10B981]/10 text-[#10B981]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            {dash.isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <div className="text-2xl sm:text-3xl font-extrabold text-white truncate">
                {dash.data ? formatRupiah(dash.data.monthlyRevenue) : '—'}
              </div>
            )}
            <div className="text-xs text-[#A7B0C0] mt-1">
              Bulan berjalan (Lunas)
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TWO-COLUMN DASHBOARD CONTENT
      ========================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* =======================================================================
            MAIN COLUMN: RECENT ACTIVITY TABLE (col-span-8)
        ======================================================================== */}
        <div className="lg:col-span-8 bg-[#12151B] border border-[#292D35] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 flex items-center justify-between border-b border-[#292D35]">
            <div>
              <h3 className="font-bold text-white text-base">Aktivitas Terbaru</h3>
              <p className="text-xs text-[#A7B0C0] mt-0.5">Catatan audit dan tindakan administratif terkini.</p>
            </div>
            <Link
              to="/admin/audit"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF8A00] hover:text-[#FFA500] transition-colors"
            >
              <span>Lihat semua</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {dash.isLoading ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : !dash.data?.recentActivity?.length ? (
            <div className="py-12 text-center text-sm text-[#A7B0C0]">
              Belum ada aktivitas yang dicatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#0D1118] text-[#A7B0C0] border-b border-[#292D35] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Aktivitas</th>
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292D35]/60 text-white">
                  {dash.data.recentActivity.map((a) => {
                    const userName = a.actor?.name || a.actor?.email || (a.actorUserId ? 'Admin' : 'Sistem');
                    return (
                      <tr key={a.id} className="hover:bg-[#161B24] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#FFA500]">
                          {a.action}
                        </td>
                        <td className="px-4 py-3 text-[#F5F5F5] font-medium max-w-[160px] truncate">
                          {userName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              a.result === 'SUCCESS'
                                ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                                : a.result === 'FAILURE'
                                ? 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-danger/15 text-danger border border-danger/30'
                                : 'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-warning/15 text-warning border border-warning/30'
                            }
                          >
                            {a.result}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-[#A7B0C0] whitespace-nowrap">
                          {a.createdAt}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* =======================================================================
            SIDE COLUMN: RINGKASAN SISTEM (GRAFIK STATISTIK), STATUS, & AKSES CEPAT
        ======================================================================== */}
        <div className="lg:col-span-4 space-y-6">
          {/* =====================================================================
              CARD: RINGKASAN SISTEM — GRAFIK STATISTIK BATANG
          ====================================================================== */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#FF8A00]" />
                  <span>Ringkasan Sistem</span>
                </h3>
                <p className="text-xs text-[#A7B0C0] mt-0.5">Grafik statistik data platform</p>
              </div>
              <span className="text-[10px] font-bold text-[#FF8A00] bg-[#FF8A00]/10 border border-[#FF8A00]/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                AKUMULATIF
              </span>
            </div>

            {dash.isLoading ? (
              <div className="h-44 flex items-center justify-center">
                <Skeleton className="h-36 w-full rounded-xl" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* 3 Vertical Bars Container */}
                <div className="h-40 bg-[#0D1118] border border-[#292D35] rounded-xl p-4 flex items-end justify-around gap-3 pt-6">
                  {/* Category 1: Pengguna */}
                  <div className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-xs font-bold text-white mb-1.5 group-hover:text-[#FFA500] transition-colors">
                      {userCount.toLocaleString('id-ID')}
                    </span>
                    <div className="w-full max-w-[48px] bg-[#171B24] rounded-t-lg h-full flex items-end p-0.5">
                      <div
                        style={{ height: `${userBarPercent}%` }}
                        className="w-full bg-gradient-to-t from-[#FF8A00] to-[#FFA500] rounded-t-md shadow-[0_0_12px_rgba(255,138,0,0.35)] transition-all duration-700"
                      />
                    </div>
                  </div>

                  {/* Category 2: Lisensi */}
                  <div className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-xs font-bold text-white mb-1.5 group-hover:text-[#FFA500] transition-colors">
                      {licenseCount.toLocaleString('id-ID')}
                    </span>
                    <div className="w-full max-w-[48px] bg-[#171B24] rounded-t-lg h-full flex items-end p-0.5">
                      <div
                        style={{ height: `${licenseBarPercent}%` }}
                        className="w-full bg-gradient-to-t from-[#FF8A00] to-[#FFA500] rounded-t-md shadow-[0_0_12px_rgba(255,138,0,0.35)] transition-all duration-700"
                      />
                    </div>
                  </div>

                  {/* Category 3: Pembayaran */}
                  <div className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-xs font-bold text-white mb-1.5 group-hover:text-[#FFA500] transition-colors">
                      {paymentCount.toLocaleString('id-ID')}
                    </span>
                    <div className="w-full max-w-[48px] bg-[#171B24] rounded-t-lg h-full flex items-end p-0.5">
                      <div
                        style={{ height: `${paymentBarPercent}%` }}
                        className="w-full bg-gradient-to-t from-[#FF8A00] to-[#FFA500] rounded-t-md shadow-[0_0_12px_rgba(255,138,0,0.35)] transition-all duration-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Category Labels Below Bars */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-[#0D1118]/80 border border-[#292D35]/80">
                    <div className="font-bold text-white text-[11px] truncate">Pengguna</div>
                    <div className="text-[10px] text-[#A7B0C0] truncate">Total Akun</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0D1118]/80 border border-[#292D35]/80">
                    <div className="font-bold text-white text-[11px] truncate">Lisensi</div>
                    <div className="text-[10px] text-[#A7B0C0] truncate">Total Diterbitkan</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0D1118]/80 border border-[#292D35]/80">
                    <div className="font-bold text-white text-[11px] truncate">Pembayaran</div>
                    <div className="text-[10px] text-[#A7B0C0] truncate">Total Transaksi</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =====================================================================
              CARD: STATUS SISTEM & SERVER
          ====================================================================== */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FF8A00]" />
                <span>Status Sistem</span>
              </h3>
              <span className="text-[11px] text-[#A7B0C0]">Infrastruktur</span>
            </div>

            {health.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <div className="space-y-3 text-xs sm:text-sm">
                {/* API Server */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#A7B0C0]">
                    <Server className="w-4 h-4 text-[#FF8A00]" />
                    <span>API Server</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-[#10B981]">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span>Online</span>
                    {health.data?.meta?.response_time_ms && (
                      <span className="text-[11px] text-[#A7B0C0] font-normal">
                        ({health.data.meta.response_time_ms}ms)
                      </span>
                    )}
                  </div>
                </div>

                {/* Database */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#A7B0C0]">
                    <Database className="w-4 h-4 text-[#FFA500]" />
                    <span>Database MySQL</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-[#10B981]">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span>Terhubung</span>
                    {health.data?.checks?.database?.latency_ms && (
                      <span className="text-[11px] text-[#A7B0C0] font-normal">
                        ({health.data.checks.database.latency_ms}ms)
                      </span>
                    )}
                  </div>
                </div>

                {/* SMTP Email */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#A7B0C0]">
                    <Mail className="w-4 h-4 text-[#FF8A00]" />
                    <span>SMTP Brevo</span>
                  </div>
                  <div>
                    {health.data?.integrations.smtp === 'configured' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#10B981]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-warning">
                        <AlertCircle className="w-3.5 h-3.5" /> Belum diatur
                      </span>
                    )}
                  </div>
                </div>

                {/* Payment Gateway */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#A7B0C0]">
                    <CreditCard className="w-4 h-4 text-[#FFA500]" />
                    <span>Pembayaran</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#10B981]">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" /> QRIS / Manual
                  </span>
                </div>

                {/* Storage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-[#A7B0C0]">
                    <HardDrive className="w-4 h-4 text-[#FF8A00]" />
                    <span>Penyimpanan File</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#F5F5F5]">
                    Local Storage
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* =====================================================================
              CARD: AKSES CEPAT ADMIN
          ====================================================================== */}
          <div className="bg-[#12151B] border border-[#292D35] rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-white text-base">Akses Cepat Admin</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Link
                to="/admin/users"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0D1118] border border-[#292D35] text-[#F5F5F5] hover:border-[#FF8A00]/50 hover:text-[#FFA500] transition-colors"
              >
                <Users className="w-4 h-4 text-[#FF8A00]" />
                <span className="truncate">Pengguna</span>
              </Link>
              <Link
                to="/admin/licenses"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0D1118] border border-[#292D35] text-[#F5F5F5] hover:border-[#FF8A00]/50 hover:text-[#FFA500] transition-colors"
              >
                <Key className="w-4 h-4 text-[#FFA500]" />
                <span className="truncate">Lisensi</span>
              </Link>
              <Link
                to="/admin/orders"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0D1118] border border-[#292D35] text-[#F5F5F5] hover:border-[#FF8A00]/50 hover:text-[#FFA500] transition-colors"
              >
                <CreditCard className="w-4 h-4 text-[#F59E0B]" />
                <span className="truncate">Payment Verif.</span>
              </Link>
              <Link
                to="/admin/plans"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0D1118] border border-[#292D35] text-[#F5F5F5] hover:border-[#FF8A00]/50 hover:text-[#FFA500] transition-colors"
              >
                <Package className="w-4 h-4 text-[#FF8A00]" />
                <span className="truncate">Paket</span>
              </Link>
              <Link
                to="/admin/tools"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0D1118] border border-[#292D35] text-[#F5F5F5] hover:border-[#FF8A00]/50 hover:text-[#FFA500] transition-colors"
              >
                <Package className="w-4 h-4 text-[#FFA500]" />
                <span className="truncate">Tools</span>
              </Link>
              <Link
                to="/admin/settings"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#0D1118] border border-[#292D35] text-[#F5F5F5] hover:border-[#FF8A00]/50 hover:text-[#FFA500] transition-colors"
              >
                <Settings className="w-4 h-4 text-[#A7B0C0]" />
                <span className="truncate">Pengaturan</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
