import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Search,
  Download,
  Package,
  ExternalLink,
  CalendarDays,
  CheckCircle2,
  Lock,
  CreditCard,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api, apiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Skeleton, PolicyModal } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import type { Tool, License } from '@/types';

export function ToolsPage() {
  const { user } = useAuth();
  const { slug: downloadSlug } = useParams();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'newest' | 'name'>('newest');
  const [selected, setSelected] = useState<Tool | null>(null);
  const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set());

  // Query license status of the current user
  const licensesQuery = useQuery({
    queryKey: ['licenses', 'me'],
    queryFn: () => api<License[]>('/licenses/me'),
  });

  // Query tools catalog
  const tools = useQuery({
    queryKey: ['tools', search, category, sort],
    queryFn: () => api<Tool[]>('/tools', { query: { search, category: category || undefined, sort } }),
  });

  // Check license state: Admin or active license with expiresAt > now
  const userLicenses = licensesQuery.data ?? [];
  const activeLicenses = userLicenses.filter((l) => l.status === 'ACTIVE' && new Date(l.expiresAt) > new Date());
  const hasActiveAccess = user?.role === 'ADMIN' || activeLicenses.length > 0;
  const hasExpiredLicense = userLicenses.length > 0 && activeLicenses.length === 0;

  const categories = Array.from(new Set(tools.data?.map((t) => t.category) ?? []));
  const selectedTool = tools.data?.find((tool) => tool.slug === downloadSlug);

  useEffect(() => {
    if (downloadSlug && selectedTool?.downloadUrl) {
      window.location.assign(selectedTool.downloadUrl);
    } else if (downloadSlug && selectedTool?.latestRelease) {
      window.location.assign(`/api/v1/tools/${encodeURIComponent(downloadSlug)}/download`);
    }
  }, [downloadSlug, selectedTool]);

  // Handle direct download route /tools/:slug/download
  if (downloadSlug) {
    if (tools.isLoading) return <Skeleton className="h-40" />;
    if (!selectedTool?.downloadUrl && !selectedTool?.latestRelease) {
      return (
        <div className="py-16 text-center">
          <Package className="w-12 h-12 text-ink-muted mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white">Unduhan belum tersedia</h3>
          <p className="text-sm text-ink-muted mt-1">Tool ini belum memiliki rilis yang bisa diunduh.</p>
        </div>
      );
    }
    return <div className="py-12 text-center text-sm text-ink-muted">Menyiapkan unduhan {selectedTool.name}...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Daftar Bot & Tools
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#94A3B8] max-w-3xl leading-relaxed">
          Semua bot otomatis terintegrasi langsung dengan gateway lisensi API PawangTools dan proteksi HWID.
        </p>
      </div>

        {/* LOADING STATE */}
        {licensesQuery.isLoading ? (
          <div className="mx-auto max-w-4xl py-12 space-y-4">
            <Skeleton className="h-10 w-48 mx-auto" />
            <Skeleton className="h-[420px] w-full rounded-3xl" />
          </div>
        ) : licensesQuery.isError || tools.isError ? (
          /* ERROR STATE */
          <div className="mx-auto max-w-lg py-16 text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-danger mx-auto" />
            <h3 className="text-lg font-semibold text-white">Gagal Memuat Status Lisensi / Katalog</h3>
            <p className="text-sm text-[#94A3B8]">Terjadi kendala saat memeriksa hak akses lisensi. Silakan periksa koneksi lalu coba lagi.</p>
            <button
              type="button"
              onClick={() => { licensesQuery.refetch(); tools.refetch(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E2330] hover:bg-[#282F40] text-sm font-medium transition-colors text-white"
            >
              <RefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          </div>
        ) : !hasActiveAccess ? (
          /* LOCKED STATE PANEL (Screenshot 1 Design) */
          <div className="py-4 sm:py-8 flex justify-center">
            <div className="w-full max-w-[960px] bg-[#12141A]/95 backdrop-blur-sm border border-[#D4AF37]/35 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-[0_12px_50px_-15px_rgba(212,175,55,0.15)] text-center relative overflow-hidden transition-all">
              {/* Golden accent flare at the top of the card */}
              <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-72 h-[2px] bg-gradient-to-r from-transparent via-[#F5C542] to-transparent" />
              <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#D4AF37]/10 blur-2xl rounded-full" />

              {/* Lock Icon */}
              <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-[#D4AF37]/25 via-[#D4AF37]/10 to-[#12141A] border border-[#D4AF37]/50 flex items-center justify-center text-[#F5C542] shadow-[0_0_30px_rgba(212,175,55,0.25)] mb-5">
                <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-[#F5C542]" strokeWidth={2.2} />
              </div>

              {/* Locked Badge */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#F5C542] text-xs font-semibold tracking-wider uppercase mb-4 shadow-sm">
                <Lock className="w-3.5 h-3.5 text-[#F5C542]" />
                <span>AKSES TERKUNCI · BUTUH LISENSI</span>
              </div>

              {/* Main Heading */}
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-3">
                Halaman Daftar Bot Terkunci
              </h2>

              {/* Message */}
              <p className="text-sm sm:text-base text-[#94A3B8] max-w-2xl mx-auto leading-relaxed mb-8">
                {hasExpiredLicense
                  ? 'Masa aktif lisensi langganan Anda telah berakhir. Silakan perpanjang paket langganan Anda untuk membuka kembali akses ke daftar bot, script, dan link unduhan.'
                  : 'Anda belum memiliki lisensi langganan aktif. Silakan pilih dan aktifkan paket langganan Anda untuk membuka akses ke seluruh bot, script, dan link unduhan.'}
              </p>

              {/* Action CTA Button */}
              <div className="flex justify-center mb-8">
                <Link
                  to="/subscriptions"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-3.5 rounded-xl font-bold text-sm sm:text-base text-black bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] hover:from-[#FFA126] hover:to-[#FF7A1A] shadow-[0_4px_25px_rgba(255,138,0,0.35)] hover:shadow-[0_6px_35px_rgba(255,138,0,0.55)] active:scale-[0.98] transition-all"
                >
                  <CreditCard className="w-5 h-5 text-black" strokeWidth={2.3} />
                  <span>{hasExpiredLicense ? 'Perpanjang Lisensi Sekarang' : 'Pilih Paket Lisensi Sekarang'}</span>
                </Link>
              </div>

              {/* Divider */}
              <div className="w-full border-t border-[#272C36] my-8" />

              {/* Three Feature Highlight Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                {/* Feature 1 */}
                <div className="bg-[#0E1118]/80 border border-white/5 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 hover:border-[#D4AF37]/30 transition-colors group">
                  <div className="rounded-lg p-1.5 bg-[#10B981]/15 text-[#10B981] shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm sm:text-base group-hover:text-[#F5C542] transition-colors">
                      Akses Semua Bot
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 leading-relaxed">
                      Unduh dan jalankan seluruh otomasi & GUI.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-[#0E1118]/80 border border-white/5 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 hover:border-[#D4AF37]/30 transition-colors group">
                  <div className="rounded-lg p-1.5 bg-[#10B981]/15 text-[#10B981] shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm sm:text-base group-hover:text-[#F5C542] transition-colors">
                      Proteksi HWID 1 PC
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 leading-relaxed">
                      Lisensi aman terikat ke perangkat Anda.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-[#0E1118]/80 border border-white/5 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 hover:border-[#D4AF37]/30 transition-colors group">
                  <div className="rounded-lg p-1.5 bg-[#10B981]/15 text-[#10B981] shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#10B981]" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm sm:text-base group-hover:text-[#F5C542] transition-colors">
                      Update & Support
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8] mt-1 leading-relaxed">
                      Pembaruan script otomatis & bantuan admin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* UNLOCKED STATE: Full Tools Catalog for Active License Holders */
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  className="w-full h-11 bg-[#12141A] border border-[#272C36] rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-[#94A3B8]/60 focus:outline-none focus:border-[#FF8A00] transition"
                  placeholder="Cari bot atau tool..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="h-11 bg-[#12141A] border border-[#272C36] rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-[#FF8A00] transition max-w-[180px]"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Semua kategori</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                className="h-11 bg-[#12141A] border border-[#272C36] rounded-xl px-3.5 text-sm text-white focus:outline-none focus:border-[#FF8A00] transition max-w-[180px]"
                value={sort}
                onChange={(e) => setSort(e.target.value as 'newest' | 'name')}
              >
                <option value="newest">Terbaru</option>
                <option value="name">Nama A-Z</option>
              </select>
            </div>

            {/* Catalog Grid */}
            {tools.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
              </div>
            ) : !tools.data || tools.data.length === 0 ? (
              <div className="text-center py-16 bg-[#12141A]/50 border border-[#272C36] rounded-2xl p-8">
                <Package className="w-12 h-12 text-[#94A3B8] mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white">Tidak ada tool ditemukan</h3>
                <p className="text-sm text-[#94A3B8] mt-1">Belum ada tool yang sesuai dengan kriteria pencarian Anda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tools.data.map((t) => (
                  <Card key={t.id} className="flex min-h-[270px] flex-col gap-4 !rounded-2xl !p-5 bg-[#12141A] border border-[#272C36] hover:border-[#D4AF37]/40 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#272C36] bg-[#0E1118] text-[#FF8A00]">
                        {t.iconUrl && !brokenIcons.has(t.id) ? (
                          <img
                            src={apiUrl(t.iconUrl)}
                            alt={`Ikon ${t.name}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onError={() => setBrokenIcons((icons) => new Set(icons).add(t.id))}
                          />
                        ) : <Package className="w-6 h-6" aria-hidden="true" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate font-semibold text-white text-base" title={t.name}>{t.name}</h3>
                          <span className="shrink-0"><Badge variant="success">Aktif</Badge></span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="muted">{t.category}</Badge>
                          {t.requiredPlan && <Badge variant="accent">{t.requiredPlan.name}</Badge>}
                        </div>
                      </div>
                    </div>

                    <p className="min-h-[4.5rem] whitespace-pre-line break-words text-sm leading-relaxed text-[#94A3B8] line-clamp-3">
                      {t.description || 'Belum ada deskripsi.'}
                    </p>

                    <div className="mt-auto flex min-h-5 items-center justify-between gap-2 border-t border-[#272C36] pt-3 text-xs text-[#94A3B8]">
                      {t.latestRelease ? (
                        <span>Rilis v{t.latestRelease.version} · {formatJakarta(t.latestRelease.releasedAt)}</span>
                      ) : t.downloadUrl ? (
                        <span className="inline-flex items-center gap-1 text-[#10B981]"><Download className="h-3.5 w-3.5" aria-hidden="true" /> Link download tersedia</span>
                      ) : <span>Belum ada rilis</span>}
                      {t.latestRelease && t.downloadUrl && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[#10B981]"><Download className="h-3.5 w-3.5" aria-hidden="true" /> Link download</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1A1F2C] hover:bg-[#252B3D] border border-[#272C36] transition-colors w-full"
                      onClick={() => setSelected(t)}
                    >
                      Lihat detail
                    </button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Tool Detail Modal */}
      <PolicyModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? 'Detail tool'}
        primaryLabel="Tutup"
      >
        {selected && (
          <div className="space-y-5 text-white">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-[#272C36] bg-[#0E1118] flex items-center justify-center text-[#FF8A00]">
                {selected.iconUrl && !brokenIcons.has(selected.id) ? (
                  <img
                    src={apiUrl(selected.iconUrl)}
                    alt={`Ikon ${selected.name}`}
                    className="h-full w-full object-cover"
                    onError={() => setBrokenIcons((icons) => new Set(icons).add(selected.id))}
                  />
                ) : <Package className="h-10 w-10" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-white">{selected.name}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />Aktif</Badge>
                  <Badge variant="muted">{selected.category}</Badge>
                  {selected.requiredPlan && <Badge variant="accent">{selected.requiredPlan.name}</Badge>}
                </div>
              </div>
            </div>

            <section>
              <h4 className="mb-2 text-sm font-semibold text-white">Deskripsi</h4>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#94A3B8]">
                {selected.description || 'Belum ada deskripsi.'}
              </p>
            </section>

            <div className="flex items-center justify-between gap-2 border-t border-[#272C36] pt-4 text-sm text-[#94A3B8]">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden="true" />
              <span className="flex-1">
                {selected.latestRelease
                  ? <>Versi {selected.latestRelease.version} · {formatJakarta(selected.latestRelease.releasedAt)}</>
                  : !selected.downloadUrl ? 'Belum ada rilis atau link download' : ''}
              </span>
              {selected.downloadUrl && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[#10B981]">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> Link download tersedia
                </span>
              )}
            </div>

            {selected.downloadUrl ? (
              <a
                href={selected.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-danger w-full py-3"
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh tool <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : selected.latestRelease ? (
              <Link
                to={`/tools/${selected.slug}/download`}
                className="btn btn-danger w-full py-3"
                onClick={() => setSelected(null)}
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh tool
              </Link>
            ) : (
              <button type="button" className="btn btn-secondary w-full py-3" disabled>
                Link download belum tersedia
              </button>
            )}
          </div>
        )}
      </PolicyModal>
    </div>
  );
}
