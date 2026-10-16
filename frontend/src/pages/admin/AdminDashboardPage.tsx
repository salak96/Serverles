import { Link } from 'react-router-dom';
import { Card, Stat, Skeleton } from '@/components/ui';
import { Users, Key, HardDrive, Package, AlertCircle, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatJakarta } from '@/lib/format';

interface DashboardData {
  totalUsers: number;
  verifiedUsers: number;
  activeSubscriptions: number;
  activeLicenses: number;
  expiredLicenses: number;
  activeDevices: number;
  pendingDeviceResets: number;
  totalTools: number;
  recentActivity: Array<{ id: string; action: string; entityType: string; result: string; createdAt: string; actorUserId: string | null }>;
  generatedAt: string;
}

export function AdminDashboardPage() {
  const dash = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api<DashboardData>('/admin/dashboard') });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Admin Dashboard</h2>
        <p className="text-sm text-ink-muted">Ringkasan metrik dan aktivitas terbaru.</p>
      </div>

      {dash.isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3,4,5,6,7].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : dash.data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Pengguna" value={dash.data.totalUsers} hint={`${dash.data.verifiedUsers} terverifikasi`} icon={<Users className="w-4 h-4" />} />
          <Stat label="Lisensi aktif" value={dash.data.activeLicenses} hint={`${dash.data.expiredLicenses} kedaluwarsa`} icon={<Key className="w-4 h-4" />} />
          <Stat label="Perangkat" value={dash.data.activeDevices} hint={`${dash.data.pendingDeviceResets} menunggu reset`} icon={<HardDrive className="w-4 h-4" />} />
          <Stat label="Tools" value={dash.data.totalTools} hint="termasuk arsip" icon={<Package className="w-4 h-4" />} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Akses cepat</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link to="/admin/users" className="btn btn-secondary"><Users className="w-4 h-4" /> Pengguna</Link>
            <Link to="/admin/licenses" className="btn btn-secondary"><Key className="w-4 h-4" /> Lisensi</Link>
            <Link to="/admin/plans" className="btn btn-secondary"><Package className="w-4 h-4" /> Paket</Link>
            <Link to="/admin/tools" className="btn btn-secondary"><Package className="w-4 h-4" /> Tools</Link>
            <Link to="/admin/notifications" className="btn btn-secondary"><Bell className="w-4 h-4" /> Notifikasi</Link>
            <Link to="/admin/audit" className="btn btn-secondary"><AlertCircle className="w-4 h-4" /> Audit</Link>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Aktivitas terbaru</h3>
          {!dash.data ? <Skeleton className="h-32" /> : (
            <ul className="text-sm divide-y divide-line">
              {dash.data.recentActivity.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs">{a.action}</div>
                    <div className="text-[11px] text-ink-muted">{a.entityType} · {formatJakarta(a.createdAt)}</div>
                  </div>
                  <span className={a.result === 'SUCCESS' ? 'badge badge-success' : a.result === 'FAILURE' ? 'badge badge-danger' : 'badge badge-warning'}>
                    {a.result}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}