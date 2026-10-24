import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Search, Download, Package, ExternalLink, CalendarDays, CheckCircle2 } from 'lucide-react';
import { api, apiUrl } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton, PolicyModal } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import type { Tool } from '@/types';

export function ToolsPage() {
  const { slug: downloadSlug } = useParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'newest' | 'name'>('newest');
  const [selected, setSelected] = useState<Tool | null>(null);
  const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set());

  const tools = useQuery({
    queryKey: ['tools', search, category, sort],
    queryFn: () => api<Tool[]>('/tools', { query: { search, category: category || undefined, sort } }),
  });

  const categories = Array.from(new Set(tools.data?.map((t) => t.category) ?? []));
  const selectedTool = tools.data?.find((tool) => tool.slug === downloadSlug);

  useEffect(() => {
    if (downloadSlug && selectedTool?.downloadUrl) {
      window.location.assign(selectedTool.downloadUrl);
    } else if (downloadSlug && selectedTool?.latestRelease) {
      window.location.assign(`/api/v1/tools/${encodeURIComponent(downloadSlug)}/download`);
    }
  }, [downloadSlug, selectedTool]);

  if (downloadSlug) {
    if (tools.isLoading) return <Skeleton className="h-40" />;
    if (!selectedTool?.downloadUrl && !selectedTool?.latestRelease) {
      return <EmptyState title="Unduhan belum tersedia" message="Tool ini belum memiliki rilis yang bisa diunduh." icon={<Package className="w-10 h-10" />} />;
    }
    return <div className="py-12 text-center text-sm text-ink-muted">Menyiapkan unduhan {selectedTool.name}...</div>;
  }

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
              <Card key={t.id} className="flex min-h-[260px] flex-col gap-4 !rounded-2xl !p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-bg-sidebar text-accent">
                  {t.iconUrl && !brokenIcons.has(t.id) ? (
                    <img
                      src={apiUrl(t.iconUrl)}
                      alt={`Ikon ${t.name}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={() => setBrokenIcons((icons) => new Set(icons).add(t.id))}
                    />
                  ) : <Package className="w-5 h-5" aria-hidden="true" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-ink" title={t.name}>{t.name}</h3>
                    <span className="shrink-0"><Badge variant="success">Aktif</Badge></span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="muted">{t.category}</Badge>
                    {t.requiredPlan && <Badge variant="accent">{t.requiredPlan.name}</Badge>}
                  </div>
                </div>
              </div>
              <p className="min-h-[4.5rem] whitespace-pre-line break-words text-sm leading-relaxed text-ink-muted line-clamp-3">
                {t.description || 'Belum ada deskripsi.'}
              </p>
              <div className="mt-auto flex min-h-5 items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
                {t.latestRelease ? (
                  <span>Rilis v{t.latestRelease.version} · {formatJakarta(t.latestRelease.releasedAt)}</span>
                ) : t.downloadUrl ? (
                  <span className="inline-flex items-center gap-1 text-success"><Download className="h-3.5 w-3.5" aria-hidden="true" /> Link download tersedia</span>
                ) : <span>Belum ada rilis</span>}
                {t.latestRelease && t.downloadUrl && <span className="inline-flex shrink-0 items-center gap-1 text-success"><Download className="h-3.5 w-3.5" aria-hidden="true" /> Link download tersedia</span>}
              </div>
              <button type="button" className="btn btn-secondary min-h-10 w-full" onClick={() => setSelected(t)}>
                Lihat detail
              </button>
            </Card>
          ))}
        </div>
      )}

      <PolicyModal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? 'Detail tool'} primaryLabel="Tutup">
        {selected && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-line bg-bg-sidebar flex items-center justify-center text-accent">
                {selected.iconUrl && !brokenIcons.has(selected.id) ? (
                  <img src={apiUrl(selected.iconUrl)} alt={`Ikon ${selected.name}`} className="h-full w-full object-cover" onError={() => setBrokenIcons((icons) => new Set(icons).add(selected.id))} />
                ) : <Package className="h-9 w-9" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-ink">{selected.name}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />Aktif</Badge>
                  <Badge variant="muted">{selected.category}</Badge>
                  {selected.requiredPlan && <Badge variant="accent">{selected.requiredPlan.name}</Badge>}
                </div>
              </div>
            </div>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-ink">Deskripsi</h4>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-muted">{selected.description || 'Belum ada deskripsi.'}</p>
            </section>

            <div className="flex items-center justify-between gap-2 border-t border-line pt-4 text-sm text-ink-muted">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{selected.latestRelease
                ? <>Versi {selected.latestRelease.version} · {formatJakarta(selected.latestRelease.releasedAt)}</>
                : !selected.downloadUrl ? 'Belum ada rilis atau link download' : ''}</span>
              {selected.downloadUrl && <span className="inline-flex shrink-0 items-center gap-1 text-xs text-success"><Download className="h-3.5 w-3.5" aria-hidden="true" /> Link download tersedia</span>}
            </div>

            {selected.downloadUrl ? (
              <a href={selected.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-danger w-full">
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh tool <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : selected.latestRelease ? (
              <Link to={`/tools/${selected.slug}/download`} className="btn btn-danger w-full" onClick={() => setSelected(null)}>
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh tool
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary w-full" disabled>
                Link download belum tersedia
              </button>
            )}
          </div>
        )}
      </PolicyModal>
    </div>
  );
}
