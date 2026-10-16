import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, EmptyState, Skeleton, Badge } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import type { NotificationList, NotificationCategory } from '@/types';

const CATEGORIES: { value: NotificationCategory | ''; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'ACCOUNT', label: 'Akun' },
  { value: 'SUBSCRIPTION', label: 'Langganan' },
  { value: 'LICENSE', label: 'Lisensi' },
  { value: 'DEVICE', label: 'Perangkat' },
  { value: 'PAYMENT', label: 'Pembayaran' },
  { value: 'TOOL_UPDATE', label: 'Update Tools' },
  { value: 'SYSTEM', label: 'Sistem' },
];

export function NotificationsPage() {
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['notifications', page, category],
    queryFn: () => api<NotificationList>('/notifications', { query: { page, limit: 15, category: category || undefined } }),
  });

  const readAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readOne = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Notifikasi</h2>
          <p className="text-sm text-ink-muted">{q.data?.unread ?? 0} belum dibaca</p>
        </div>
        <button className="btn btn-secondary" onClick={() => readAll.mutate()} disabled={!q.data?.unread}>
          <CheckCheck className="w-4 h-4" /> Tandai semua dibaca
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value || 'all'}
            onClick={() => { setCategory(c.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition ${category === c.value ? 'bg-accent text-bg border-accent' : 'bg-bg-card text-ink-muted border-line hover:text-ink'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        {q.isLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : q.data?.items.length === 0 ? (
          <EmptyState title="Tidak ada notifikasi" message="Anda akan melihat notifikasi terbaru di sini." />
        ) : (
          <ul className="divide-y divide-line">
            {q.data?.items.map((n) => (
              <li
                key={n.id}
                className={`p-4 hover:bg-bg-sidebar/50 transition cursor-pointer ${!n.readAt ? 'bg-accent/5' : ''}`}
                onClick={() => !n.readAt && readOne.mutate(n.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!n.readAt && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                      <span className="font-medium text-ink">{n.title}</span>
                      <Badge variant="muted">{n.category}</Badge>
                      {!n.userId && <Badge variant="accent">Pengumuman</Badge>}
                    </div>
                    <p className="text-sm text-ink-muted mt-1">{n.body}</p>
                    <p className="text-[11px] text-ink-muted mt-1.5">{formatJakarta(n.publishedAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {q.data && q.data.total > 15 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</button>
          <span className="text-sm text-ink-muted">Halaman {page} / {Math.ceil(q.data.total / 15)}</span>
          <button className="btn btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page * 15 >= q.data.total}>Selanjutnya</button>
        </div>
      )}
    </div>
  );
}

void Trash2;
