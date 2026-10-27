import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { Card, Badge, Skeleton, EmptyState, ConfirmDialog } from '@/components/ui';
import { formatRupiah, formatJakarta } from '@/lib/format';

interface AdminOrder {
  id: string;
  amount: number;
  amountFormatted?: string;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';
  provider: string;
  durationDays: number;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  plan: { id: string; name: string; slug: string };
}

export function AdminOrdersPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'ALL' | AdminOrder['status']>('PENDING');
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const list = useQuery({
    queryKey: ['admin', 'orders', status, search],
    queryFn: () => api<AdminOrder[]>('/admin/orders', {
      query: {
        status: status === 'ALL' ? undefined : status,
        search: search.trim() || undefined,
      },
    }),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api(`/admin/orders/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'orders'] }); setConfirmId(null); setError(''); },
    onError: (e) => setError(e instanceof HttpError ? e.message : 'Gagal mengonfirmasi order.'),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api(`/admin/orders/${id}/reject`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'orders'] }); setRejectId(null); setError(''); },
    onError: (e) => setError(e instanceof HttpError ? e.message : 'Gagal membatalkan order.'),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Verifikasi Pembayaran</h2>
          <p className="text-sm text-ink-muted">Order PENDING menunggu verifikasi manual admin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              className="input pl-9 h-10 text-sm"
              placeholder="Cari nama, email, ID order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input max-w-[150px] h-10 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="ALL">Semua Status</option>
            <option value="PENDING">PENDING</option>
            <option value="PAID">PAID</option>
            <option value="FAILED">FAILED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>
        </div>
      </div>
      {error && <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">{error}</div>}
      {list.isLoading ? (
        <Skeleton className="h-40" />
      ) : !list.data?.length ? (
        <EmptyState
          title="Tidak ada order"
          message={search.trim() ? `Tidak ditemukan order yang cocok dengan "${search}".` : 'Belum ada order pada filter ini.'}
        />
      ) : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-sidebar border-b border-line">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Pengguna</th>
                <th className="text-left p-3">Paket</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Kedaluwarsa</th>
                <th className="text-right p-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-mono text-xs">{o.id}</td>
                  <td className="p-3"><div className="font-medium">{o.user.name}</div><div className="text-xs text-ink-muted">{o.user.email}</div></td>
                  <td className="p-3">{o.plan.name}<div className="text-xs text-ink-muted">{o.durationDays} hari</div></td>
                  <td className="p-3 font-semibold">{formatRupiah(o.amount)}</td>
                  <td className="p-3"><Badge variant={o.status === 'PAID' ? 'success' : o.status === 'PENDING' ? 'warning' : 'muted'}>{o.status}</Badge></td>
                  <td className="p-3 text-xs text-ink-muted">{formatJakarta(o.expiresAt)}</td>
                  <td className="p-3 text-right">
                    {o.status === 'PENDING' ? (
                      <div className="flex gap-1 justify-end">
                        <button className="btn btn-primary text-xs" onClick={() => setConfirmId(o.id)}>Konfirmasi</button>
                        <button className="btn btn-danger text-xs" onClick={() => setRejectId(o.id)}>Tolak</button>
                      </div>
                    ) : (
                      <span className="text-xs text-ink-muted">{o.paidAt ? formatJakarta(o.paidAt) : '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ConfirmDialog
        open={!!confirmId}
        title="Konfirmasi pembayaran?"
        message="Order akan ditandai PAID, subscription diaktifkan, dan lisensi baru diterbitkan."
        confirmText="Konfirmasi Pembayaran"
        onCancel={() => setConfirmId(null)}
        onConfirm={() => confirmId && confirm.mutate(confirmId)}
      />
      <ConfirmDialog
        open={!!rejectId}
        title="Tolak order ini?"
        message="Order akan ditandai FAILED dan user akan menerima notifikasi. Buat order baru jika user ingin mencoba lagi."
        confirmText="Tolak Order"
        destructive
        onCancel={() => setRejectId(null)}
        onConfirm={() => rejectId && reject.mutate(rejectId)}
      />
    </div>
  );
}
