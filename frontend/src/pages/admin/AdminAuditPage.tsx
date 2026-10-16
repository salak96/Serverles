import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui';
import { formatJakarta } from '@/lib/format';

interface AuditItem {
  id: string; action: string; entityType: string; entityId: string | null; result: string;
  ip: string | null; userAgent: string | null; createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['admin', 'audit', action, page],
    queryFn: () => api<{ items: AuditItem[]; total: number }>('/admin/audit-logs', { query: { action: action || undefined, page, limit: 30 } }),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Audit Log</h2>
      <input
        className="input max-w-md"
        placeholder="Filter berdasarkan action (mis. auth.login)"
        value={action}
        onChange={(e) => { setAction(e.target.value); setPage(1); }}
      />
      <Card className="!p-0 overflow-hidden">
        {list.isLoading ? <Skeleton className="h-40 m-4" /> : (
          <ul className="divide-y divide-line">
            {list.data?.items.map((a) => (
              <li key={a.id} className="p-3 text-sm">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs">{a.action}</span>
                    <Badge variant={a.result === 'SUCCESS' ? 'success' : a.result === 'FAILURE' ? 'danger' : 'warning'}>{a.result}</Badge>
                  </div>
                  <span className="text-[11px] text-ink-muted">{formatJakarta(a.createdAt)}</span>
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  {a.entityType}{a.entityId ? ` · ${a.entityId}` : ''} · oleh {a.actor?.name ?? 'sistem'} · IP {a.ip ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {list.data && list.data.total > 30 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</button>
          <span className="text-sm text-ink-muted">Halaman {page} / {Math.ceil(list.data.total / 30)}</span>
          <button className="btn btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page * 30 >= list.data.total}>Selanjutnya</button>
        </div>
      )}
    </div>
  );
}