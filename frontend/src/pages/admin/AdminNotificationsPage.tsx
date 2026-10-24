import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, HttpError } from '@/lib/api';
import { Card } from '@/components/ui';
import { Send } from 'lucide-react';

export function AdminNotificationsPage() {
  const [form, setForm] = useState({ title: '', body: '', category: 'SYSTEM' as 'ACCOUNT' | 'SUBSCRIPTION' | 'LICENSE' | 'DEVICE' | 'PAYMENT' | 'TOOL_UPDATE' | 'SYSTEM', isGlobal: true, userIds: '' });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const send = useMutation({
    mutationFn: () => api<{ message: string }>('/admin/notifications', {
      method: 'POST',
      body: {
        title: form.title,
        body: form.body,
        category: form.category,
        isGlobal: form.isGlobal,
        userIds: form.isGlobal ? undefined : form.userIds.split(',').map((s) => s.trim()).filter(Boolean),
      },
    }),
    onSuccess: (result) => {
      const isWarning = result.message.includes('belum dikonfigurasi') || result.message.includes('gagal');
      setToast({ type: isWarning ? 'error' : 'success', text: result.message });
      setForm({ ...form, title: '', body: '' });
    },
    onError: (e) => setToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Gagal.' }),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-xl font-semibold">Kirim Notifikasi</h2>
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-3">
          <div>
            <label className="label">Judul</label>
            <input className="input" required minLength={2} maxLength={180} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Isi</label>
            <textarea className="input min-h-[100px]" required minLength={2} maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div>
            <label className="label">Kategori</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}>
              <option value="SYSTEM">Pengumuman Sistem</option>
              <option value="ACCOUNT">Akun</option>
              <option value="SUBSCRIPTION">Langganan</option>
              <option value="LICENSE">Lisensi</option>
              <option value="DEVICE">Perangkat</option>
              <option value="PAYMENT">Pembayaran</option>
              <option value="TOOL_UPDATE">Update Tools</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isGlobal} onChange={(e) => setForm({ ...form, isGlobal: e.target.checked })} />
              <span>Pengumuman global (semua pengguna)</span>
            </label>
          </div>
          {!form.isGlobal && (
            <div>
              <label className="label">ID Pengguna (pisahkan dengan koma)</label>
              <input className="input" value={form.userIds} onChange={(e) => setForm({ ...form, userIds: e.target.value })} placeholder="cuid1, cuid2, ..." />
            </div>
          )}
          <button type="submit" className="btn btn-primary" disabled={send.isPending}>
            <Send className="w-4 h-4" /> {send.isPending ? 'Mengirim...' : 'Kirim'}
          </button>
        </form>
      </Card>
      {toast && (
        <div className={`fixed bottom-4 right-4 text-sm rounded-lg px-3 py-2 border ${toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
