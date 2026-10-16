import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserX, UserCheck, Shield, Trash2, Plus, Edit, CheckSquare, Square } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { Card, Badge, Skeleton, ConfirmDialog } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import { useAuth } from '@/lib/auth';

interface AdminUser {
  id: string; name: string; email: string; role: 'USER' | 'ADMIN'; status: string; emailVerifiedAt: string | null; lastLoginAt: string | null; createdAt: string;
}
interface UserForm { name: string; email: string; password: string; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'; }
const emptyForm: UserForm = { name: '', email: '', password: '', role: 'USER', status: 'ACTIVE' };

export function AdminUsersPage() {
  const qc = useQueryClient();
  const { user: currentAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'suspend' | 'activate' | null>(null);
  const [bulkResult, setBulkResult] = useState<{ deleted: number; requested: number } | null>(null);

  const list = useQuery({
    queryKey: ['admin', 'users', search, page],
    queryFn: () => api<{ items: AdminUser[]; total: number; page: number; limit: number }>('/admin/users', { query: { search: search || undefined, page, limit } }),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminUser> }) => api(`/admin/users/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
  const create = useMutation({
    mutationFn: () => api('/admin/users', { method: 'POST', body: form }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setShowForm(false); setEditingId(null); setForm(emptyForm); setFormError(''); },
    onError: (e) => setFormError(e instanceof HttpError ? e.message : 'Gagal membuat pengguna.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setDeleteId(null); setSelected((s) => { const n = new Set(s); n.forEach((v) => v === deleteId && n.delete(v)); return n; }); },
    onError: (e) => alert(e instanceof HttpError ? e.message : 'Gagal menghapus.'),
  });
  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) => api<{ deleted: number; requested: number }>('/admin/users/bulk-delete', { method: 'POST', body: { ids } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSelected(new Set());
      setBulkDelete(false);
      setBulkResult(res);
    },
    onError: (e) => {
      setBulkDelete(false);
      setBulkResult({ deleted: 0, requested: Array.from(selected).length });
      alert(e instanceof HttpError ? e.message : 'Hapus massal gagal.');
    },
  });
  const bulkMut = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const results = await Promise.allSettled(
        ids.map((id) => api(`/admin/users/${id}`, { method: 'PATCH', body: { status: bulkAction === 'suspend' ? 'SUSPENDED' : 'ACTIVE' } }))
      );
      return { deleted: results.filter((r) => r.status === 'fulfilled').length, requested: ids.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSelected(new Set());
      setBulkAction(null);
      setBulkResult(res);
    },
    onError: (e) => alert(e instanceof HttpError ? e.message : 'Aksi gagal.'),
  });

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const allSelected = useMemo(() => items.length > 0 && items.every((u) => selected.has(u.id)), [items, selected]);
  const someSelected = useMemo(() => items.some((u) => selected.has(u.id)), [items, selected]);
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else {
      const eligible = items.filter((u) => u.id !== currentAdmin?.id);
      setSelected(new Set(eligible.map((u) => u.id)));
    }
  };
  const toggleOne = (id: string) => {
    if (id === currentAdmin?.id) return; // cannot select self
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-xl font-semibold">Manajemen Pengguna</h2><p className="text-sm text-ink-muted">Pilih beberapa baris untuk aksi massal, atau klik tombol aksi per baris.</p></div>
        <div className="flex gap-2">
          {someSelected && (
            <div className="flex gap-1">
              <span className="text-xs text-ink-muted self-center">{selected.size} dipilih</span>
              <button className="btn btn-secondary text-xs" onClick={() => setBulkAction('activate')}>Aktifkan</button>
              <button className="btn btn-secondary text-xs" onClick={() => setBulkAction('suspend')}>Tangguhkan</button>
              <button className="btn btn-danger text-xs" disabled={bulkDeleteMut.isPending} onClick={() => setBulkDelete(true)}>{bulkDeleteMut.isPending ? 'Menghapus...' : 'Hapus'}</button>
              <button className="btn btn-ghost text-xs" onClick={() => setSelected(new Set())}>Batal pilih</button>
            </div>
          )}
          <button className="btn btn-primary" onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}><Plus className="w-4 h-4" /> Tambah Pengguna</button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <input className="input pl-9" placeholder="Cari nama atau email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setSelected(new Set()); }} />
      </div>

      <Card className="!p-0 overflow-hidden">
        {list.isLoading ? <Skeleton className="h-40 m-4" /> : (
          <table className="w-full text-sm">
            <thead className="bg-bg-sidebar border-b border-line">
              <tr>
                <th className="p-3 w-8"><button onClick={toggleAll} className="text-ink-muted hover:text-ink" aria-label="Pilih semua">{allSelected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}</button></th>
                <th className="text-left p-3 text-ink-muted font-medium">#</th>
                <th className="text-left p-3 text-ink-muted font-medium">Pengguna</th>
                <th className="text-left p-3 text-ink-muted font-medium">Role</th>
                <th className="text-left p-3 text-ink-muted font-medium">Status</th>
                <th className="text-left p-3 text-ink-muted font-medium">Terakhir masuk</th>
                <th className="text-left p-3 text-ink-muted font-medium">Dibuat</th>
                <th className="text-right p-3 text-ink-muted font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((u, idx) => (
                <tr key={u.id} className={`hover:bg-bg-sidebar/50 ${selected.has(u.id) ? 'bg-accent/5' : ''}`}>
                  <td className="p-3"><button onClick={() => toggleOne(u.id)} aria-label={`Pilih ${u.email}`}>{selected.has(u.id) ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4 text-ink-muted" />}</button></td>
                  <td className="p-3 text-ink-muted text-xs">{(page - 1) * limit + idx + 1}</td>
                  <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-ink-muted">{u.email}</div></td>
                  <td className="p-3">{u.role === 'ADMIN' ? <Badge variant="accent"><Shield className="w-3 h-3" /> Admin</Badge> : <Badge variant="muted">User</Badge>}</td>
                  <td className="p-3">
                    <Badge variant={u.status === 'ACTIVE' ? 'success' : u.status === 'SUSPENDED' ? 'danger' : 'warning'}>{u.status}</Badge>
                    {!u.emailVerifiedAt && <Badge variant="muted">unverified</Badge>}
                  </td>
                  <td className="p-3 text-xs text-ink-muted">{u.lastLoginAt ? formatJakarta(u.lastLoginAt) : '—'}</td>
                  <td className="p-3 text-xs text-ink-muted">{formatJakarta(u.createdAt)}</td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {u.status === 'SUSPENDED' ? (
                        <button className="btn btn-secondary text-xs" onClick={() => update.mutate({ id: u.id, data: { status: 'ACTIVE' } })}><UserCheck className="w-3.5 h-3.5" /> Aktifkan</button>
                      ) : (
                        <button className="btn btn-secondary text-xs" onClick={() => update.mutate({ id: u.id, data: { status: 'SUSPENDED' } })}><UserX className="w-3.5 h-3.5" /> Tangguhkan</button>
                      )}
                      {u.role === 'USER' ? (
                        <button className="btn btn-ghost text-xs" onClick={() => update.mutate({ id: u.id, data: { role: 'ADMIN' } })}>Jadikan Admin</button>
                      ) : (
                        <button className="btn btn-ghost text-xs" onClick={() => update.mutate({ id: u.id, data: { role: 'USER' } })}>Turunkan</button>
                      )}
                      <button className="btn btn-ghost text-xs" onClick={() => { setEditingId(u.id); setForm({ name: u.name, email: u.email, password: '', role: u.role as 'USER' | 'ADMIN', status: u.status as 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' }); setShowForm(true); }} title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                      <button className="btn btn-danger text-xs" onClick={() => setDeleteId(u.id)}><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr><td colSpan={8} className="p-8 text-center text-ink-muted text-sm">Tidak ada pengguna pada filter ini.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {total > limit && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</button>
          <span className="text-sm text-ink-muted">Halaman {page} / {Math.ceil(total / limit)}</span>
          <button className="btn btn-secondary" onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>Selanjutnya</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <h3 className="font-semibold text-lg mb-4">{editingId ? 'Edit Pengguna' : 'Tambah Pengguna'}</h3>
            <div className="space-y-3">
              <div><label className="label">Nama</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editingId} /></div>
              <div><label className="label">Password {editingId ? '(kosongkan jika tidak diubah)' : ''}</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><label className="label">Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'USER' | 'ADMIN' })}>
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {editingId && (
                <div><label className="label">Status</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION' })}>
                    <option value="ACTIVE">Aktif</option>
                    <option value="SUSPENDED">Ditangguhkan</option>
                    <option value="PENDING_VERIFICATION">Belum Verifikasi</option>
                  </select>
                </div>
              )}
              {formError && <p className="text-sm text-danger">{formError}</p>}
              <div className="flex gap-2 justify-end">
                <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); setFormError(''); setForm(emptyForm); }}>Batal</button>
                <button className="btn btn-primary" disabled={create.isPending || update.isPending} onClick={() => {
                  if (editingId) {
                    const data: { name: string; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'; password?: string } = { name: form.name, role: form.role, status: form.status };
                    if (form.password) data.password = form.password;
                    update.mutate({ id: editingId, data }, { onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); setShowForm(false); setEditingId(null); setForm(emptyForm); } });
                  } else {
                    create.mutate();
                  }
                }}>{create.isPending || update.isPending ? 'Menyimpan...' : (editingId ? 'Simpan' : 'Buat')}</button>
              </div>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus pengguna ini?"
        message="Seluruh data terkait (lisensi, subscription, order, sesi) akan ikut dihapus. Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        destructive
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />

      <ConfirmDialog
        open={!!bulkDelete}
        title={`Hapus ${selected.size} pengguna sekaligus?`}
        message="Aksi ini tidak dapat dibatalkan. Semua data terkait akan ikut dihapus."
        confirmText={`Hapus ${selected.size}`}
        destructive
        onCancel={() => setBulkDelete(false)}
        onConfirm={() => { const ids = Array.from(selected).filter((id) => id !== currentAdmin?.id); if (ids.length) bulkDeleteMut.mutate(ids); else { setBulkDelete(false); alert('Tidak ada pengguna yang dapat dihapus.'); } }}
      />
      <ConfirmDialog
        open={!!bulkAction && bulkAction !== null}
        title={`Konfirmasi aksi massal (${selected.size} pengguna)?`}
        message={`Aksi: ${bulkAction === 'suspend' ? 'Tangguhkan' : 'Aktifkan'}.`}
        confirmText="Lanjutkan"
        onCancel={() => setBulkAction(null)}
        onConfirm={() => { bulkMut.mutate(); }}
      />
      {bulkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm">
            <h3 className="text-lg font-semibold text-success mb-2">Berhasil</h3>
            <p className="text-sm text-ink-muted mb-4">{bulkResult.deleted} dari {bulkResult.requested} pengguna berhasil dihapus.</p>
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={() => setBulkResult(null)}>Tutup</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
