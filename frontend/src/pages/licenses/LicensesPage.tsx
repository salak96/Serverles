import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Key, Copy, RefreshCw, Eye, EyeOff, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, Badge, EmptyState, Skeleton, ConfirmDialog } from '@/components/ui';
import { formatJakarta, daysBetween } from '@/lib/format';
import type { License } from '@/types';

type ToastState = { type: 'success' | 'error'; text: string } | null;

export function LicensesPage() {
  const { id: paramId } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [revealKey, setRevealKey] = useState<{ licenseId: string; key: string } | null>(null);
  const [rotateTarget, setRotateTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const rememberKey = (licenseId: string, key: string): void => setRevealedKeys((m) => ({ ...m, [licenseId]: key }));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
      rememberKey(id, res.licenseKey);
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
          </div>
          <div className="mt-4">
            <ApiKeyField licenseId={focused.id} masked={focused.keyMasked} revealed={revealedKeys[focused.id]} onRevealed={(k) => rememberKey(focused.id, k)} onToast={setToast} />
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
                <button className="btn btn-ghost p-1.5" onClick={() => copyWithToast(revealKey.key, setToast)} aria-label="Salin"><Copy className="w-4 h-4" /></button>
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
                </div>
                <ApiKeyField licenseId={l.id} masked={l.keyMasked} revealed={revealedKeys[l.id]} onRevealed={(k) => rememberKey(l.id, k)} onToast={setToast} />
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

function ApiKeyField({ licenseId, masked, revealed, onRevealed, onToast }: {
  licenseId: string;
  masked: string;
  revealed?: string;
  onRevealed: (key: string) => void;
  onToast: (t: ToastState) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  const fetchKey = async (): Promise<string | null> => {
    if (revealed) return revealed;
    setLoading(true);
    try {
      const res = await api<{ available: boolean; licenseKey?: string; message?: string }>(`/licenses/${licenseId}/reveal-key`, { method: 'POST' });
      if (res.available && res.licenseKey) {
        onRevealed(res.licenseKey);
        return res.licenseKey;
      }
      setUnavailable(res.message ?? 'API key tidak dapat ditampilkan ulang. Gunakan rotasi untuk membuat kunci baru.');
      return null;
    } catch (e) {
      onToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Gagal mengambil API key.' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleVisible = async (): Promise<void> => {
    if (visible) { setVisible(false); return; }
    if (await fetchKey()) setVisible(true);
  };

  const handleCopy = async (): Promise<void> => {
    const key = await fetchKey();
    if (!key) return;
    if (await copyText(key)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onToast({ type: 'success', text: 'API key disalin ke clipboard.' });
    } else {
      onToast({ type: 'error', text: 'Gagal menyalin. Tampilkan key lalu salin secara manual.' });
    }
  };

  const shown = visible && revealed ? revealed : masked;

  return (
    <div>
      <div className="text-[11px] text-ink-muted uppercase tracking-wide mb-1">API key</div>
      <div className="flex items-center gap-1 bg-bg-sidebar border border-line rounded-lg pl-3 pr-1 py-1">
        <code className={`flex-1 min-w-0 font-mono text-sm break-all py-1 ${visible ? 'select-all text-ink' : 'select-none text-ink-muted'}`} aria-live="polite">
          {shown}
        </code>
        <button
          type="button"
          className="btn btn-ghost p-2 shrink-0"
          onClick={toggleVisible}
          disabled={loading}
          aria-label={visible ? 'Sembunyikan API key' : 'Tampilkan API key'}
          aria-pressed={visible}
          title={visible ? 'Sembunyikan' : 'Tampilkan'}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          type="button"
          className="btn btn-ghost p-2 shrink-0"
          onClick={handleCopy}
          disabled={loading}
          aria-label="Salin API key"
          title="Salin"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {unavailable && (
        <p className="flex items-start gap-1.5 text-xs text-warning mt-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> {unavailable}
        </p>
      )}
    </div>
  );
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'muted' {
  if (s === 'ACTIVE') return 'success';
  if (s === 'PENDING') return 'warning';
  if (s === 'EXPIRED') return 'muted';
  return 'danger';
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }
  // Clipboard API is unavailable on non-HTTPS origins.
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok;
}

function copyWithToast(text: string, setToast: (t: ToastState) => void): void {
  void copyText(text).then((ok) => setToast(ok
    ? { type: 'success', text: 'Disalin ke clipboard.' }
    : { type: 'error', text: 'Gagal menyalin.' }));
}
