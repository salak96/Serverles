import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Trash2, ShieldAlert } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton, ConfirmDialog } from '@/components/ui';
import { formatJakarta } from '@/lib/format';

interface ActivityItem { id: string; action: string; entityType: string; result: string; createdAt: string; ip: string | null }

export function ActivityPage() {
  const qc = useQueryClient();
  const activity = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<ActivityItem[]>('/users/me/activity', { query: { limit: 100 } }),
  });
  const [purgeAll, setPurgeAll] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const purge = useMutation({
    mutationFn: (olderThanDays: number) => api<{ deleted: number; olderThanDays: number }>('/users/me/activity', { method: 'DELETE', query: { olderThanDays } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['activity'] });
      setPurgeAll(false);
      setError('');
      setInfo(`Berhasil menghapus ${res.deleted} log yang lebih dari ${res.olderThanDays} hari.`);
    },
    onError: (e) => {
      setPurgeAll(false);
      setError(e instanceof HttpError ? e.message : 'Gagal menghapus log.');
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Log Aktivitas</h2>
          <p className="text-sm text-ink-muted">Riwayat aktivitas akun Anda. Log yang lebih dari 7 hari dihapus otomatis oleh server.</p>
        </div>
        <button
          type="button"
          className="btn btn-danger text-xs"
          onClick={() => { setError(''); setInfo(''); setPurgeAll(true); }}
          disabled={purge.isPending}
        >
          <Trash2 className="w-3.5 h-3.5" /> {purge.isPending ? 'Menghapus...' : 'Hapus log lama'}
        </button>
      </div>
      {info && <p className="text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">{info}</p>}
      {error && <p className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</p>}
      <Card className="!p-0 overflow-hidden">
        {activity.isLoading ? (
          <div className="p-4"><Skeleton className="h-40" /></div>
        ) : !activity.data?.length ? (
          <EmptyState title="Belum ada aktivitas" icon={<Activity className="w-8 h-8" />} />
        ) : (
          <ul className="divide-y divide-line">
            {activity.data.map((a) => (
              <li key={a.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-xs">{a.action}</div>
                  <div className="text-xs text-ink-muted mt-1">{a.entityType} · {formatJakarta(a.createdAt)} · IP {a.ip ?? '—'}</div>
                </div>
                <Badge variant={a.result === 'SUCCESS' ? 'success' : a.result === 'FAILURE' ? 'danger' : 'warning'}>{a.result}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ConfirmDialog
        open={purgeAll}
        title="Hapus log yang lebih dari 7 hari?"
        message="Tindakan ini tidak dapat dibatalkan. Log terbaru tetap disimpan."
        confirmText="Hapus"
        destructive
        onCancel={() => setPurgeAll(false)}
        onConfirm={() => purge.mutate(7)}
      />
      <div className="text-xs text-ink-muted flex items-center gap-2">
        <ShieldAlert className="w-3.5 h-3.5" />
        Log aktivitas pengguna dihapus otomatis setelah 7 hari oleh server.
      </div>
    </div>
  );
}
