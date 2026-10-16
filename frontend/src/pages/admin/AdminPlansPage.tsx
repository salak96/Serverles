import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, HttpError } from '@/lib/api';
import { Card, Badge, Skeleton } from '@/components/ui';
import { formatRupiah, formatJakarta } from '@/lib/format';
import type { Plan } from '@/types';

interface PlanForm { name: string; slug: string; description: string; price: number; durationDays: number; maxDevices: number; isActive: boolean; }
const empty: PlanForm = { name: '', slug: '', description: '', price: 0, durationDays: 30, maxDevices: 1, isActive: true };

export function AdminPlansPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<(PlanForm & { id?: string }) | null>(null);
  const [error, setError] = useState('');
  const list = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api<Array<Plan & { isActive?: boolean; createdAt?: string; updatedAt?: string }>>('/admin/plans') });
  const save = useMutation({
    mutationFn: (f: PlanForm & { id?: string }) => api(f.id ? `/admin/plans/${f.id}` : '/admin/plans', { method: f.id ? 'PATCH' : 'POST', body: { ...f, features: [], resetPolicy: { maxResets: 2, periodDays: 30, cooldownDays: 7, requireAdmin: false, requireEmailVerification: true }, availableDurations: [{ days: f.durationDays, label: 'Durasi', price: f.price }] } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'plans'] }); qc.invalidateQueries({ queryKey: ['plans'] }); setEditing(null); setError(''); },
    onError: (e) => setError(e instanceof HttpError ? e.message : 'Gagal menyimpan paket.'),
  });
  return <div className="space-y-4"><div className="flex justify-between items-center"><div><h2 className="text-xl font-semibold">Manajemen Paket</h2><p className="text-sm text-ink-muted">Paket aktif ditampilkan pada halaman Langganan pengguna.</p></div><button className="btn btn-primary" onClick={() => setEditing(empty)}>+ Tambah Paket</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{list.isLoading ? <Skeleton className="h-40" /> : list.data?.map(p => <Card key={p.id} className="flex flex-col gap-2"><div className="flex justify-between"><h3 className="font-semibold">{p.name}</h3><Badge variant={p.isActive === false ? 'muted' : 'success'}>{p.isActive === false ? 'Nonaktif' : 'Aktif'}</Badge></div><p className="text-xs text-ink-muted">{p.slug}</p><p className="text-sm text-ink-muted">{p.description}</p><div className="text-2xl font-bold">{formatRupiah(p.price)}</div><div className="text-xs text-ink-muted">{p.durationDays} hari · maks {p.maxDevices} perangkat</div><button className="btn btn-secondary mt-2" onClick={() => setEditing({ id: p.id, name: p.name, slug: p.slug, description: p.description ?? '', price: p.price, durationDays: p.durationDays, maxDevices: p.maxDevices, isActive: p.isActive !== false })}>Edit</button></Card>)}</div>{editing && <PlanModal value={editing} error={error} busy={save.isPending} onCancel={() => setEditing(null)} onSave={(f) => save.mutate(f)} />}</div>;
}

function PlanModal({ value, error, busy, onCancel, onSave }: { value: PlanForm & { id?: string }; error: string; busy: boolean; onCancel: () => void; onSave: (v: PlanForm & { id?: string }) => void }) {
  const [form, setForm] = useState(value); const set = (k: keyof PlanForm, v: string | number | boolean) => setForm({ ...form, [k]: v });
  return <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"><Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto"><div className="flex justify-between mb-4"><h3 className="text-lg font-semibold">{form.id ? 'Edit Paket' : 'Tambah Paket'}</h3><button className="text-xl" onClick={onCancel}>×</button></div><div className="space-y-3">{[['name','Nama'],['slug','Slug'],['description','Deskripsi']].map(([k,l]) => <div key={k}><label className="label">{l}</label><input className="input" value={String(form[k as keyof PlanForm])} onChange={e => set(k as keyof PlanForm,e.target.value)} /></div>)}<div className="grid grid-cols-3 gap-2"><div><label className="label">Harga IDR</label><input className="input" type="number" value={form.price} onChange={e => set('price',Number(e.target.value))}/></div><div><label className="label">Hari</label><input className="input" type="number" value={form.durationDays} onChange={e => set('durationDays',Number(e.target.value))}/></div><div><label className="label">Perangkat</label><input className="input" type="number" value={form.maxDevices} onChange={e => set('maxDevices',Number(e.target.value))}/></div></div><label className="flex gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={e => set('isActive',e.target.checked)}/> Paket aktif</label>{error && <p className="text-sm text-danger">{error}</p>}<div className="flex justify-end gap-2"><button className="btn btn-secondary" onClick={onCancel}>Batal</button><button className="btn btn-primary" disabled={busy} onClick={() => onSave(form)}>{busy ? 'Menyimpan...' : 'Simpan'}</button></div></div></Card></div>;
}

void formatJakarta;
