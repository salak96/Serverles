import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Package, HardDrive, Key, Clock, Server, Shield, AlertCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, Stat, Skeleton, EmptyState, Badge } from '@/components/ui';
import { formatJakarta, daysBetween } from '@/lib/format';
import type { License, NotificationList, Plan } from '@/types';

export function DashboardPage() {
  const { user } = useAuth();
  const greeting = greetingNow();

  const health = useQuery({ queryKey: ['health'], queryFn: () => api<{ status: string; checks: { database: { status: string; latency_ms: number | null } }; integrations: { smtp: string; payment: string; storage: string } }>('/health'), refetchInterval: 30_000 });
  const licenses = useQuery({ queryKey: ['licenses', 'me'], queryFn: () => api<License[]>('/licenses/me') });
  const notifications = useQuery({ queryKey: ['notifications', 'recent'], queryFn: () => api<NotificationList>('/notifications', { query: { limit: 5 } }) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/plans') });

  const activeLicenses = licenses.data?.filter((l) => l.status === 'ACTIVE' && new Date(l.expiresAt) > new Date()) ?? [];
  const totalActiveDevices = activeLicenses.reduce((sum, l) => sum + l.activeDevices, 0);
  const totalSlots = activeLicenses.reduce((sum, l) => sum + l.maxDevices, 0);
  const primaryLic = activeLicenses[0];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl lg:text-2xl font-semibold">{greeting}, {user?.name?.split(' ')[0] ?? 'Pengguna'}.</h2>
        <p className="text-ink-muted text-sm mt-1">{formatJakarta(new Date())}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {licenses.isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Stat
              label="Tools dapat diakses"
              value={plans.data ? `${activeLicenses.length} paket aktif` : '—'}
              hint={primaryLic ? `Paket: ${primaryLic.plan.name}` : 'Belum ada paket aktif'}
              icon={<Package className="w-4 h-4" />}
            />
            <Stat
              label="Perangkat aktif"
              value={totalActiveDevices}
              hint={totalSlots ? `Dari ${totalSlots} slot` : 'Tidak ada slot'}
              icon={<HardDrive className="w-4 h-4" />}
            />
            <Stat
              label="Slot tersedia"
              value={Math.max(0, totalSlots - totalActiveDevices)}
              hint={totalSlots ? `${totalSlots - totalActiveDevices}/${totalSlots}` : '—'}
              icon={<Key className="w-4 h-4" />}
            />
            <Stat
              label="Sisa masa aktif"
              value={primaryLic ? `${daysBetween(new Date().toISOString(), primaryLic.expiresAt)} hari` : '—'}
              hint={primaryLic ? `Berakhir ${formatJakarta(primaryLic.expiresAt)}` : '—'}
              icon={<Clock className="w-4 h-4" />}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Status langganan</h3>
            <Link to="/subscriptions" className="text-sm text-accent hover:underline">Lihat langganan →</Link>
          </div>
          {licenses.isLoading ? (
            <Skeleton className="h-20" />
          ) : activeLicenses.length === 0 ? (
            <EmptyState
              title="Belum ada paket aktif"
              message="Pilih paket untuk mulai menggunakan PawangTools."
              action={<Link to="/subscriptions" className="btn btn-primary">Lihat paket</Link>}
            />
          ) : (
            <div className="space-y-3">
              {activeLicenses.slice(0, 3).map((l) => (
                <div key={l.id} className="flex items-center justify-between border border-line rounded-lg p-3">
                  <div>
                    <div className="font-medium">{l.plan.name}</div>
                    <div className="text-xs text-ink-muted">
                      {l.activeDevices}/{l.maxDevices} perangkat · berakhir {formatJakarta(l.expiresAt)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="success">Aktif</Badge>
                    <Link to="/licenses" className="btn btn-secondary text-xs">Kelola</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Server className="w-4 h-4 text-accent" />
            <h3 className="font-semibold">Status server</h3>
          </div>
          {health.isLoading ? (
            <Skeleton className="h-16" />
          ) : health.data ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Status</span>
                <Badge variant={health.data.status === 'online' ? 'success' : 'warning'}>
                  {health.data.status === 'online' ? 'Online' : 'Tidak Dapat Dihubungi'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Database</span>
                <Badge variant={health.data.checks.database.status === 'up' ? 'success' : 'danger'}>
                  {health.data.checks.database.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">SMTP</span>
                <Badge variant="muted">{health.data.integrations.smtp}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Pembayaran</span>
                <Badge variant="muted">{health.data.integrations.payment}</Badge>
              </div>
              <p className="text-[11px] text-ink-muted pt-2 border-t border-line mt-3">
                Pemeriksaan terakhir: {formatJakarta(new Date())}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertCircle className="w-4 h-4" /> Tidak Dapat Dihubungi
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Notifikasi terbaru</h3>
            <Link to="/notifications" className="text-sm text-accent hover:underline">Lihat semua →</Link>
          </div>
          {notifications.isLoading ? <Skeleton className="h-20" /> :
            notifications.data?.items.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-6">Belum ada notifikasi.</p>
            ) : (
              <ul className="space-y-2">
                {notifications.data?.items.slice(0, 4).map((n) => (
                  <li key={n.id} className="text-sm border-l-2 border-accent/40 pl-3">
                    <div className="font-medium text-ink">{n.title}</div>
                    <div className="text-ink-muted text-xs line-clamp-1">{n.body}</div>
                    <div className="text-[10px] text-ink-muted mt-0.5">{formatJakarta(n.publishedAt)}</div>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Panduan aktivasi</h3>
          <ol className="text-sm text-ink-muted space-y-2 list-decimal pl-4">
            <li>Pilih paket di halaman <Link to="/subscriptions" className="text-accent hover:underline">Langganan</Link>.</li>
            <li>Setelah pembayaran terverifikasi, lisensi diterbitkan otomatis.</li>
            <li>Buka <Link to="/licenses" className="text-accent hover:underline">Lisensi & HWID</Link> untuk melihat API key.</li>
            <li>Pada aplikasi desktop/bot Anda, panggil <code className="text-accent">POST /api/v1/licenses/validate</code> untuk validasi.</li>
          </ol>
          {!user?.emailVerified && (
            <div className="mt-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Email belum diverifikasi. Beberapa fitur mungkin terbatas.</span>
            </div>
          )}
        </Card>
      </div>

      {user?.role === 'ADMIN' && (
        <Link to="/admin" className="card flex items-center gap-3 hover:border-accent/40 transition">
          <Shield className="w-5 h-5 text-accent" />
          <div>
            <div className="font-medium">Buka Admin Dashboard</div>
            <div className="text-xs text-ink-muted">Pengguna, paket, lisensi, audit, dan lainnya.</div>
          </div>
        </Link>
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
