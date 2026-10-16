import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import type { Tool } from '@/types';

export function ToolsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'newest' | 'name'>('newest');

  const tools = useQuery({
    queryKey: ['tools', search, category, sort],
    queryFn: () => api<Tool[]>('/tools', { query: { search, category: category || undefined, sort } }),
  });

  const categories = Array.from(new Set(tools.data?.map((t) => t.category) ?? []));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Bot & Tools</h2>
        <p className="text-sm text-ink-muted">Katalog tools yang dapat Anda akses sesuai paket.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            className="input pl-9"
            placeholder="Cari tool..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input max-w-[180px]" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input max-w-[180px]" value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'name')}>
          <option value="newest">Terbaru</option>
          <option value="name">Nama A-Z</option>
        </select>
      </div>

      {tools.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : !tools.data || tools.data.length === 0 ? (
        <EmptyState
          title="Tidak ada tool"
          message="Belum ada tool yang tersedia untuk kriteria ini."
          icon={<Package className="w-10 h-10" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.data.map((t) => (
            <Card key={t.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{t.name}</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="muted">{t.category}</Badge>
                    {t.requiredPlan && <Badge variant="accent">{t.requiredPlan.name}</Badge>}
                  </div>
                </div>
              </div>
              {t.description && <p className="text-sm text-ink-muted line-clamp-3">{t.description}</p>}
              <div className="text-xs text-ink-muted mt-auto pt-2 border-t border-line">
                {t.latestRelease ? (
                  <>v{t.latestRelease.version} · {formatJakarta(t.latestRelease.releasedAt)}</>
                ) : 'Belum ada rilis'}
              </div>
              <button className="btn btn-secondary" disabled={!t.latestRelease}>
                <Download className="w-4 h-4" /> Unduh
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
