import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CalendarDays, Download, ExternalLink, Image as ImageIcon, Package, Pencil, Plus } from 'lucide-react';
import { api, apiUrl, HttpError } from '@/lib/api';
import { Badge, Card, PolicyModal, Skeleton } from '@/components/ui';
import { formatJakarta } from '@/lib/format';

interface AdminTool { id: string; name: string; slug: string; category: string; description?: string | null; iconUrl?: string | null; downloadUrl?: string | null; requiredPlanId?: string | null; isActive: boolean; releases: Array<{ version: string; releasedAt: string }> }
interface ToolForm { name: string; slug: string; category: string; description: string; iconUrl: string; downloadUrl: string; isActive: boolean }
const empty: ToolForm = { name: '', slug: '', category: 'General', description: '', iconUrl: '', downloadUrl: '', isActive: true };

export function AdminToolsPage() {
  const qc = useQueryClient(); const [editing, setEditing] = useState<(ToolForm & { id?: string }) | null>(null); const [details, setDetails] = useState<AdminTool | null>(null); const [error, setError] = useState('');
  const list = useQuery({ queryKey: ['admin', 'tools'], queryFn: () => api<AdminTool[]>('/admin/tools') });
  const save = useMutation({
    mutationFn: async ({ form, iconFile }: { form: ToolForm & { id?: string }; iconFile: File | null }) => {
      const { iconUrl: _iconUrl, ...toolFields } = form;
      const tool = await api<AdminTool>(form.id ? `/tools/${form.id}` : '/tools', {
        method: form.id ? 'PATCH' : 'POST',
        body: toolFields,
      });
      if (iconFile) {
        setEditing({ ...form, id: tool.id });
        const body = new FormData();
        body.append('file', iconFile);
        await api(`/tools/${tool.id}/icon`, { method: 'POST', body });
      }
      return tool;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'tools'] }); qc.invalidateQueries({ queryKey: ['tools'] }); setEditing(null); setError(''); },
    onError: (e) => setError(e instanceof HttpError ? e.message : 'Gagal menyimpan tool.'),
  });
  const archive = useMutation({ mutationFn: (id: string) => api(`/tools/${id}`, { method: 'DELETE' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'tools'] }); qc.invalidateQueries({ queryKey: ['tools'] }); } });
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl border border-line bg-bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Package className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Manajemen Tools</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-muted">Kelola katalog tool, ikon, deskripsi, dan tautan unduhan yang dilihat pengguna.</p>
          </div>
        </div>
        <button className="btn btn-primary h-11 shrink-0" onClick={() => { setError(''); setEditing(empty); }}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Tool
        </button>
      </header>

      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-56 rounded-2xl" />)}
        </div>
      ) : !list.data?.length ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent"><Package className="h-5 w-5" /></div>
          <h3 className="font-semibold">Belum ada tool</h3>
          <p className="mt-1 max-w-sm text-sm text-ink-muted">Tambahkan tool untuk mulai membangun katalog pengguna.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.data.map((tool) => (
            <Card key={tool.id} className="flex min-h-[260px] flex-col gap-4 !rounded-2xl !p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-bg-sidebar text-accent">
                  {tool.iconUrl
                    ? <img src={apiUrl(tool.iconUrl)} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-5 w-5" aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-ink" title={tool.name}>{tool.name}</h3>
                    <span className={`badge shrink-0 ${tool.isActive ? 'badge-success' : 'badge-muted'}`}>
                      {tool.isActive ? 'Aktif' : 'Arsip'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="muted">{tool.category}</Badge>
                  </div>
                </div>
              </div>

              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-muted line-clamp-3">
                {tool.description || 'Belum ada deskripsi.'}
              </p>

              <div className="mt-auto space-y-2 border-t border-line pt-3">
                <div className="flex min-h-5 items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
                  {tool.releases[0]
                    ? <span>Rilis v{tool.releases[0].version} · {formatJakarta(tool.releases[0].releasedAt)}</span>
                    : tool.downloadUrl
                      ? <span className="inline-flex items-center gap-1 text-ink-muted"><Download className="h-3.5 w-3.5" /> Link download tersedia</span>
                      : <span>Belum ada rilis</span>}
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary min-h-10 flex-1" onClick={() => setDetails(tool)}>Lihat detail</button>
                  <button className="btn btn-secondary min-h-10 flex-1" onClick={() => { setError(''); setEditing({ id: tool.id, name: tool.name, slug: tool.slug, category: tool.category, description: tool.description ?? '', iconUrl: tool.iconUrl ?? '', downloadUrl: tool.downloadUrl ?? '', isActive: tool.isActive }); }}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                  </button>
                  {tool.isActive && (
                    <button className="btn btn-danger min-h-10" onClick={() => archive.mutate(tool.id)} disabled={archive.isPending}>
                      <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Arsipkan
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing && <ToolModal value={editing} error={error} busy={save.isPending} onCancel={() => setEditing(null)} onSave={(form, iconFile) => save.mutate({ form, iconFile })} />}
      <PolicyModal open={Boolean(details)} onClose={() => setDetails(null)} title={details?.name ?? 'Detail tool'} primaryLabel="Tutup">
        {details && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-bg-sidebar text-accent">
                {details.iconUrl ? <img src={apiUrl(details.iconUrl)} alt={`Ikon ${details.name}`} className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8" />}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-semibold text-ink">{details.name}</h3>
                <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Badge variant="muted">{details.category}</Badge>
                  <Badge variant={details.isActive ? 'success' : 'muted'}>{details.isActive ? 'Aktif' : 'Arsip'}</Badge>
                </div>
              </div>
            </div>
            <section>
              <h4 className="mb-2 text-sm font-semibold text-ink">Deskripsi</h4>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-muted">{details.description || 'Belum ada deskripsi.'}</p>
            </section>
            <div className="flex items-center gap-2 border-t border-line pt-4 text-sm text-ink-muted">
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              {details.releases[0]
                ? <>Versi {details.releases[0].version} · {formatJakarta(details.releases[0].releasedAt)}</>
                : details.downloadUrl ? 'Link download tersedia' : 'Belum ada rilis atau link download'}
            </div>
            {details.downloadUrl ? (
              <a href={details.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh tool <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : details.releases[0] ? (
              <a href={apiUrl(`/tools/${details.slug}/download`)} className="btn btn-primary w-full">
                <Download className="h-4 w-4" aria-hidden="true" /> Unduh rilis terbaru
              </a>
            ) : null}
          </div>
        )}
      </PolicyModal>
    </div>
  );
}

function ToolModal({ value, error, busy, onCancel, onSave }: { value: ToolForm & { id?: string }; error: string; busy: boolean; onCancel: () => void; onSave: (v: ToolForm & { id?: string }, iconFile: File | null) => void }) {
  const [form, setForm] = useState(value); const set = (k: keyof ToolForm, v: string | boolean) => { setForm({ ...form, [k]: v }); setFileError(''); };
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(value.iconUrl ? apiUrl(value.iconUrl) : '');
  const [previewError, setPreviewError] = useState(false);
  useEffect(() => {
    setForm(value);
    setIconFile(null);
    setPreviewUrl(value.iconUrl ? apiUrl(value.iconUrl) : '');
    setPreviewError(false);
  }, [value]);
  useEffect(() => {
    if (!iconFile) return;
    const objectUrl = URL.createObjectURL(iconFile);
    setPreviewUrl(objectUrl);
    setPreviewError(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [iconFile]);
  const save = () => {
    if (fileError) return;
    const missingFields = [
      !form.name.trim() && 'Nama',
      form.slug.trim().length < 2 && 'Slug (minimal 2 karakter)',
      !form.category.trim() && 'Kategori',
      !form.description.trim() && 'Deskripsi',
      !form.downloadUrl.trim() && 'Link download',
      !iconFile && !value.iconUrl && 'Gambar ikon',
    ].filter(Boolean);
    if (missingFields.length) {
      setFileError(`Wajib diisi: ${missingFields.join(', ')}.`);
      return;
    }
    const downloadUrl = form.downloadUrl.trim();
    try {
      const parsed = new URL(downloadUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
    } catch {
      setFileError('Link download harus berupa URL lengkap yang diawali http:// atau https://.');
      return;
    }
    onSave({
      ...form,
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      iconUrl: form.iconUrl.trim(),
      downloadUrl,
      description: form.description.trim(),
    }, iconFile);
  };
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center overflow-y-auto p-4"><Card className="my-auto w-full max-w-lg"><div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">{form.id ? 'Edit Tool' : 'Tambah Tool'}</h3><button type="button" className="text-xl" onClick={onCancel} aria-label="Tutup">×</button></div><div className="space-y-3">{[['name','Nama'],['slug','Slug'],['category','Kategori']].map(([k,l]) => <div key={k}><label className="label" htmlFor={`tool-${k}`}>{l}</label><input id={`tool-${k}`} className="input" value={String(form[k as keyof ToolForm])} onChange={e => set(k as keyof ToolForm,e.target.value)}/></div>)}<div><label className="label" htmlFor="tool-icon">Gambar ikon (PNG, JPG, WebP · maks. 5 MB)</label><div className="flex items-center gap-3"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-bg-sidebar">{previewUrl && !previewError ? <img src={previewUrl} alt="Preview ikon tool" className="h-full w-full object-cover" onError={() => setPreviewError(true)} /> : <span className="px-1 text-center text-[10px] text-ink-muted">{value.iconUrl && !iconFile ? 'Ikon tidak ditemukan — unggah ulang' : 'Preview'}</span>}</div><input id="tool-icon" type="file" accept="image/png,image/jpeg,image/webp" className="block min-w-0 text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/15 file:px-3 file:py-2 file:font-medium file:text-accent hover:file:bg-accent/25" onChange={e => { const file = e.target.files?.[0] ?? null; setFileError(file && file.size > 5 * 1024 * 1024 ? 'Ukuran gambar maksimal 5 MB.' : ''); if (!file || file.size <= 5 * 1024 * 1024) { setIconFile(file); setPreviewError(false); } }} /></div>{fileError && <p role="alert" className="mt-1 text-xs text-danger">{fileError}</p>}</div><div><label className="label" htmlFor="tool-download-url">Link download (Google Drive, GitHub, atau URL langsung)</label><input id="tool-download-url" type="url" className="input" placeholder="https://..." value={form.downloadUrl} onChange={e => { set('downloadUrl',e.target.value); setFileError(''); }} /></div><div><label className="label" htmlFor="tool-description">Deskripsi</label><textarea id="tool-description" className="input min-h-24" value={form.description} onChange={e => set('description',e.target.value)} /></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => set('isActive',e.target.checked)}/> Tool aktif</label>{error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex justify-end gap-2"><button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button><button type="button" className="btn btn-primary" disabled={busy || Boolean(fileError)} onClick={save}>{busy ? 'Menyimpan...' : 'Simpan'}</button></div></div></Card></div>;
}
