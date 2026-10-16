import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Key, Copy, RefreshCw, Eye, EyeOff, AlertTriangle, Check } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, Badge, EmptyState, Skeleton, ConfirmDialog } from '@/components/ui';
import { formatJakarta, daysBetween } from '@/lib/format';
import type { License } from '@/types';

export function LicensesPage() {
  const { id: paramId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [revealKey, setRevealKey] = useState<{ licenseId: string; key: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const licenses = useQuery({ queryKey: ['licenses', 'me'], queryFn: () => api<License[]>('/licenses/me') });
  const focused = paramId ? licenses.data?.find((l) => l.id === paramId) : null;
  const devices = useQuery({
    queryKey: ['license', focused?.id, 'devices'],
    queryFn: () => api<Array<{ id: string; deviceName: string | null; platform: string | null; appVersion: string | null; status: string; boundAt: string; lastSeenAt: string; hwidMasked: string }>>(`/licenses/${focused!.id}/devices`),
    enabled: !!focused,
  });

  const rotate = useMutation({
    mutationFn: (id: string) => api<{ licenseKey: string; keyMasked: string }>(`/licenses/${id}/rotate-key`, { method: 'POST' }),
    onSuccess: (res, id) => {
      setRevealKey({ licenseId: id, key: res.licenseKey });
      qc.invalidateQueries({ queryKey: ['licenses'] });
      setToast({ type: 'success', text: 'API key berhasil dirotasi. Salin dan simpan di tempat aman.' });
      setRotateTarget(null);
    },
    onError: (e) => setToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Rotasi gagal.' }),
  });

  if (focused) {
    return (
      <div className="space-y-4">
        <Link to="/licenses" className="text-sm text-accent hover:underline">← Kembali ke daftar lisensi</Link>
        <Card>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Lisensi {focused.plan.name}</h2>
              <p className="text-sm text-ink-muted">Diterbitkan {formatJakarta(focused.createdAt)}</p>
            </div>
            <Badge variant={statusVariant(focused.status)}>{focused.status}</Badge>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            <Info label="Masa aktif" value={formatJakarta(focused.expiresAt)} />
            <Info label="Sisa hari" value={`${daysBetween(new Date().toISOString(), focused.expiresAt)} hari`} />
            <Info label="Perangkat" value={`${focused.activeDevices}/${focused.maxDevices}`} />
            <Info label="API key" value={focused.keyMasked} mono />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button className="btn btn-primary" onClick={() => setRotateTarget(focused.id)}>
              <RefreshCw className="w-4 h-4" /> Rotasi API key
            </button>
            <Link to="/devices" className="btn btn-secondary">
              Kelola perangkat
            </Link>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Perangkat terikat</h3>
          {devices.isLoading ? <Skeleton className="h-20" /> :
            !devices.data || devices.data.length === 0 ? (
              <EmptyState title="Belum ada perangkat" message="Perangkat yang terikat akan muncul di sini." />
            ) : (
              <ul className="divide-y divide-line">
                {devices.data.map((d) => (
                  <li key={d.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{d.deviceName ?? 'Perangkat tanpa nama'}</div>
                      <div className="text-xs text-ink-muted">{d.platform} · {d.appVersion ?? '—'}</div>
                      <div className="text-[10px] text-ink-muted font-mono mt-1">HWID: {d.hwidMasked}</div>
                    </div>
                    <Badge variant={d.status === 'ACTIVE' ? 'success' : 'muted'}>{d.status}</Badge>
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

        <ConfirmDialog
          open={!!rotateTarget}
          title="Rotasi API key?"
          message="API key lama akan dicabut permanen. Aplikasi yang menggunakan key lama akan kehilangan akses. Pastikan Anda siap memperbarui aplikasi."
          confirmText="Ya, rotasi sekarang"
          destructive
          onCancel={() => setRotateTarget(null)}
          onConfirm={() => rotateTarget && rotate.mutate(rotateTarget)}
        />

        {revealKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <Card className="max-w-lg w-full">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2"><Key className="w-5 h-5 text-accent" /> API key baru</h3>
              <p className="text-sm text-ink-muted mb-3">Simpan key ini di tempat aman. Anda tidak akan melihatnya lagi.</p>
              <div className="bg-bg-sidebar border border-line rounded-lg p-3 font-mono text-sm break-all flex items-center gap-2">
                <span className="flex-1">{revealKey.key}</span>
                <button className="btn btn-ghost p-1.5" onClick={() => copy(revealKey.key, setToast)} aria-label="Salin"><Copy className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <button className="btn btn-primary" onClick={() => setRevealKey(null)}>Saya sudah menyimpan</button>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Lisensi & HWID</h2>
        <p className="text-sm text-ink-muted">Kelola API key dan perangkat yang terikat ke lisensi Anda.</p>
      </div>

      {licenses.isLoading ? <Skeleton className="h-40" /> :
        !licenses.data || licenses.data.length === 0 ? (
          <EmptyState
            title="Belum ada lisensi"
            message={user?.emailVerified ? 'Pilih paket terlebih dahulu untuk menerbitkan lisensi.' : 'Verifikasi email Anda, kemudian pilih paket.'}
            action={user?.emailVerified ? <Link to="/subscriptions" className="btn btn-primary">Pilih paket</Link> : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {licenses.data.map((l) => (
              <Card key={l.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{l.plan.name}</h3>
                    <p className="text-xs text-ink-muted">Paket {l.plan.slug.toUpperCase()}</p>
                  </div>
                  <Badge variant={statusVariant(l.status)}>{l.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Info label="Berakhir" value={formatJakarta(l.expiresAt)} />
                  <Info label="Sisa" value={`${daysBetween(new Date().toISOString(), l.expiresAt)} hari`} />
                  <Info label="Perangkat" value={`${l.activeDevices}/${l.maxDevices}`} />
                  <Info label="API key" value={l.keyMasked} mono />
                </div>
                <div className="flex gap-2">
                  <Link to={`/licenses/${l.id}`} className="btn btn-primary flex-1">Kelola</Link>
                  <button className="btn btn-secondary" onClick={() => setRotateTarget(l.id)}>
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

      {toast && (
        <div className={`fixed bottom-4 right-4 text-sm rounded-lg px-3 py-2 border ${toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
          {toast.text}
        </div>
      )}

      <ConfirmDialog
        open={!!rotateTarget}
        title="Rotasi API key?"
        message="API key lama akan dicabut permanen. Aplikasi yang menggunakan key lama akan kehilangan akses."
        confirmText="Ya, rotasi"
        destructive
        onCancel={() => setRotateTarget(null)}
        onConfirm={() => rotateTarget && rotate.mutate(rotateTarget)}
      />
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-ink-muted uppercase tracking-wide">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
    </div>
  );
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (s === 'ACTIVE') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'EXPIRED') return 'muted';
  return 'danger';
}

function copy(text: string, setToast: (t: { type: 'success' | 'error'; text: string } | null) => void) {
  navigator.clipboard.writeText(text).then(
    () => setToast({ type: 'success', text: 'Disalin ke clipboard.' }),
    () => setToast({ type: 'error', text: 'Gagal menyalin.' }),
  );
}

void AlertTriangle;
void Eye;
void EyeOff;
void Check;
