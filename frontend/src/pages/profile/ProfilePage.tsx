import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, HttpError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, Badge } from '@/components/ui';
import { formatJakarta } from '@/lib/format';

const profileSchema = z.object({ name: z.string().min(2, 'Nama minimal 2 karakter.').max(120) });
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Password saat ini wajib diisi.'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter.'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Konfirmasi tidak cocok.', path: ['confirmPassword'],
}).refine((d) => d.currentPassword !== d.newPassword, {
  message: 'Password baru harus berbeda.', path: ['newPassword'],
});

type ProfileData = z.infer<typeof profileSchema>;
type PasswordData = z.infer<typeof passwordSchema>;

export function ProfilePage() {
  const { user, refresh, logout } = useAuth();
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const profileForm = useForm<ProfileData>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? '' } });
  const passwordForm = useForm<PasswordData>({ resolver: zodResolver(passwordSchema) });

  const activity = useQuery({
    queryKey: ['activity'],
    queryFn: () => api<Array<{ id: string; action: string; entityType: string; result: string; createdAt: string; ip: string | null }>>('/users/me/activity', { query: { limit: 15 } }),
  });

  const updateProfile = useMutation({
    mutationFn: (d: ProfileData) => api('/users/me', { method: 'PATCH', body: d }),
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries({ queryKey: ['activity'] });
      setToast({ type: 'success', text: 'Profil diperbarui.' });
    },
    onError: (e) => setToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Gagal.' }),
  });

  const changePassword = useMutation({
    mutationFn: (d: PasswordData) => api('/users/me/password', { method: 'PATCH', body: d }),
    onSuccess: async () => {
      setToast({ type: 'success', text: 'Password diubah. Silakan masuk ulang.' });
      await logout();
    },
    onError: (e) => setToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Gagal.' }),
  });

  const logoutAll = useMutation({
    mutationFn: () => api('/auth/logout-all', { method: 'POST' }),
    onSuccess: async () => {
      await logout();
    },
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-xl font-semibold">Pengaturan Akun</h2>

      <Card>
        <h3 className="font-semibold mb-4">Profil</h3>
        <form onSubmit={profileForm.handleSubmit((d) => updateProfile.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" value={user?.email ?? ''} disabled />
          </div>
          <div>
            <label className="label">Nama lengkap</label>
            <input className="input" {...profileForm.register('name')} />
            {profileForm.formState.errors.name && <p className="text-xs text-danger mt-1">{profileForm.formState.errors.name.message}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={user?.emailVerified ? 'success' : 'warning'}>
              {user?.emailVerified ? 'Email terverifikasi' : 'Email belum diverifikasi'}
            </Badge>
            <Badge variant={user?.role === 'ADMIN' ? 'accent' : 'muted'}>{user?.role}</Badge>
          </div>
          <button type="submit" className="btn btn-primary" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Menyimpan...' : 'Simpan perubahan'}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">Ubah password</h3>
        <form onSubmit={passwordForm.handleSubmit((d) => changePassword.mutate(d))} className="space-y-3">
          <div>
            <label className="label">Password saat ini</label>
            <input className="input" type="password" autoComplete="current-password" {...passwordForm.register('currentPassword')} />
            {passwordForm.formState.errors.currentPassword && <p className="text-xs text-danger mt-1">{passwordForm.formState.errors.currentPassword.message}</p>}
          </div>
          <div>
            <label className="label">Password baru</label>
            <input className="input" type="password" autoComplete="new-password" {...passwordForm.register('newPassword')} />
            {passwordForm.formState.errors.newPassword && <p className="text-xs text-danger mt-1">{passwordForm.formState.errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="label">Konfirmasi password baru</label>
            <input className="input" type="password" autoComplete="new-password" {...passwordForm.register('confirmPassword')} />
            {passwordForm.formState.errors.confirmPassword && <p className="text-xs text-danger mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>}
          </div>
          <button type="submit" className="btn btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? 'Menyimpan...' : 'Ubah password'}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">Sesi</h3>
        <p className="text-sm text-ink-muted mb-3">Cabut semua sesi aktif di perangkat lain. Anda akan tetap masuk di perangkat ini.</p>
        <button className="btn btn-danger" onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending}>
          {logoutAll.isPending ? 'Memproses...' : 'Cabut semua sesi lain'}
        </button>
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">Aktivitas terbaru</h3>
        {activity.isLoading ? <p className="text-sm text-ink-muted">Memuat...</p> :
          !activity.data || activity.data.length === 0 ? (
            <p className="text-sm text-ink-muted">Belum ada aktivitas.</p>
          ) : (
            <ul className="text-sm divide-y divide-line">
              {activity.data.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs">{a.action}</div>
                    <div className="text-[11px] text-ink-muted">{formatJakarta(a.createdAt)} · {a.ip ?? '—'}</div>
                  </div>
                  <Badge variant={a.result === 'SUCCESS' ? 'success' : 'danger'}>{a.result}</Badge>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {toast && (
        <div className={`fixed bottom-4 right-4 text-sm rounded-lg px-3 py-2 border ${toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
