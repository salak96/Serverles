import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Skeleton } from '@/components/ui';
import { formatJakarta } from '@/lib/format';

export function AdminSettingsPage() {
  const list = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api<Array<{ id: string; key: string; value: unknown; updatedAt: string }>>('/admin/settings') });
  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-xl font-semibold">Pengaturan Sistem</h2>
      <p className="text-sm text-ink-muted">Konfigurasi runtime. Disimpan di tabel app_settings.</p>
      {list.isLoading ? <Skeleton className="h-40" /> :
        <div className="space-y-3">
          {list.data?.map((s) => (
            <Card key={s.id}>
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm">{s.key}</h3>
                <span className="text-xs text-ink-muted">Diperbarui {formatJakarta(s.updatedAt)}</span>
              </div>
              <pre className="text-xs bg-bg-sidebar border border-line rounded-lg p-3 mt-2 overflow-x-auto">{JSON.stringify(s.value, null, 2)}</pre>
            </Card>
          ))}
        </div>
      }
    </div>
  );
}