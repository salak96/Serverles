import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui';
import { formatJakarta } from '@/lib/format';

interface AdminLicense {
  id: string; name: string | null; status: string; expiresAt: string; createdAt: string; keyLastFour: string;
  user: { id: string; name: string; email: string };
  plan: { name: string; slug: string };
}

export function AdminLicensesPage() {
  const list = useQuery({
    queryKey: ['admin', 'licenses'],
    queryFn: () => api<{ items: AdminLicense[]; total: number }>('/admin/licenses', { query: { limit: 50 } }),
  });
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Manajemen Lisensi</h2>
      <Card className="!p-0 overflow-hidden">
        {list.isLoading ? <Skeleton className="h-40 m-4" /> : (
          <table className="w-full text-sm">
            <thead className="bg-bg-sidebar border-b border-line">
              <tr>
                <th className="text-left p-3 text-ink-muted font-medium">Pengguna</th>
                <th className="text-left p-3 text-ink-muted font-medium">Paket</th>
                <th className="text-left p-3 text-ink-muted font-medium">Status</th>
                <th className="text-left p-3 text-ink-muted font-medium">Berakhir</th>
                <th className="text-left p-3 text-ink-muted font-medium">API key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.data?.items.map((l) => (
                <tr key={l.id} className="hover:bg-bg-sidebar/50">
                  <td className="p-3">
                    <div className="font-medium">{l.user.name}</div>
                    <div className="text-xs text-ink-muted">{l.user.email}</div>
                  </td>
                  <td className="p-3"><Badge variant="accent">{l.plan.name}</Badge></td>
                  <td className="p-3"><Badge variant={l.status === 'ACTIVE' ? 'success' : l.status === 'REVOKED' ? 'danger' : 'muted'}>{l.status}</Badge></td>
                  <td className="p-3 text-xs">{formatJakarta(l.expiresAt)}</td>
                  <td className="p-3 font-mono text-xs">PAW-****-****-****-{l.keyLastFour}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}