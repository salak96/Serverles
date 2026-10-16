import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Unlink } from 'lucide-react';
import { api, HttpError } from '@/lib/api';
import { Card, Badge, EmptyState, Skeleton, ConfirmDialog } from '@/components/ui';
import { formatJakarta } from '@/lib/format';
import type { License } from '@/types';

interface Device {
  id: string;
  deviceName: string | null;
  platform: string | null;
  appVersion: string | null;
  status: 'ACTIVE' | 'UNBOUND';
  boundAt: string;
  lastSeenAt: string;
  unboundAt: string | null;
  hwidMasked: string;
}

export function DevicesPage() {
  const qc = useQueryClient();
  const [action, setAction] = useState<{ type: 'reset' | 'unbind'; licenseId: string; deviceId: string; name: string } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const licenses = useQuery({ queryKey: ['licenses', 'me'], queryFn: () => api<License[]>('/licenses/me') });

  const resetMutation = useMutation({
    mutationFn: ({ licenseId, deviceId }: { licenseId: string; deviceId: string }) =>
      api(`/licenses/${licenseId}/devices/${deviceId}/reset`, { method: 'POST', body: { reason: 'User-initiated reset' } }),
    onSuccess: () => {
      setToast({ type: 'success', text: 'Reset berhasil. Slot perangkat dilepas.' });
      qc.invalidateQueries({ queryKey: ['licenses'] });
      setAction(null);
    },
    onError: (e) => setToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Reset gagal.' }),
  });

  const unbindMutation = useMutation({
    mutationFn: ({ licenseId, deviceId }: { licenseId: string; deviceId: string }) =>
      api(`/licenses/${licenseId}/devices/${deviceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      setToast({ type: 'success', text: 'Perangkat dilepas.' });
      qc.invalidateQueries({ queryKey: ['licenses'] });
      setAction(null);
    },
    onError: (e) => setToast({ type: 'error', text: e instanceof HttpError ? e.message : 'Gagal.' }),
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Perangkat</h2>
        <p className="text-sm text-ink-muted">Kelola perangkat yang terikat pada lisensi Anda. Reset mengikuti kuota dan cooldown yang diatur admin.</p>
      </div>

      {licenses.isLoading ? <Skeleton className="h-40" /> :
        !licenses.data || licenses.data.length === 0 ? (
          <EmptyState title="Belum ada lisensi" message="Perangkat akan muncul setelah lisensi diterbitkan." />
        ) : (
          licenses.data.map((lic) => (
            <DevicesForLicense
              key={lic.id}
              license={lic}
              onReset={(deviceId, name) => setAction({ type: 'reset', licenseId: lic.id, deviceId, name })}
              onUnbind={(deviceId, name) => setAction({ type: 'unbind', licenseId: lic.id, deviceId, name })}
            />
          ))
        )}

      {toast && (
        <div className={`fixed bottom-4 right-4 text-sm rounded-lg px-3 py-2 border ${toast.type === 'success' ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger'}`}>
          {toast.text}
        </div>
      )}

      <ConfirmDialog
        open={!!action}
        title={action?.type === 'reset' ? 'Reset perangkat?' : 'Lepas perangkat?'}
        message={
          action?.type === 'reset'
            ? `Reset slot untuk ${action.name}. Setelah reset, Anda dapat mengikat perangkat baru. Reset tunduk pada kuota paket.`
            : `Lepas ${action?.name} dari lisensi. Perangkat harus diaktifkan ulang untuk digunakan kembali.`
        }
        confirmText={action?.type === 'reset' ? 'Ya, reset' : 'Ya, lepas'}
        destructive
        onCancel={() => setAction(null)}
        onConfirm={() => {
          if (!action) return;
          if (action.type === 'reset') resetMutation.mutate({ licenseId: action.licenseId, deviceId: action.deviceId });
          else unbindMutation.mutate({ licenseId: action.licenseId, deviceId: action.deviceId });
        }}
      />
    </div>
  );
}

function DevicesForLicense({ license, onReset, onUnbind }: { license: License; onReset: (id: string, name: string) => void; onUnbind: (id: string, name: string) => void }) {
  const devices = useQuery({
    queryKey: ['license', license.id, 'devices'],
    queryFn: () => api<Device[]>(`/licenses/${license.id}/devices`),
  });
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold">{license.plan.name}</h3>
          <p className="text-xs text-ink-muted">{license.activeDevices}/{license.maxDevices} perangkat · berakhir {formatJakarta(license.expiresAt)}</p>
        </div>
        <Badge variant={license.status === 'ACTIVE' ? 'success' : 'muted'}>{license.status}</Badge>
      </div>
      {devices.isLoading ? <Skeleton className="h-20" /> :
        !devices.data || devices.data.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-4">Belum ada perangkat terikat.</p>
        ) : (
          <ul className="divide-y divide-line">
            {devices.data.map((d) => (
              <li key={d.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{d.deviceName ?? 'Perangkat tanpa nama'}</div>
                  <div className="text-xs text-ink-muted">{d.platform ?? '—'} · {d.appVersion ?? '—'}</div>
                  <div className="text-[10px] text-ink-muted font-mono mt-1">HWID: {d.hwidMasked}</div>
                  <div className="text-[10px] text-ink-muted">Terakhir aktif: {formatJakarta(d.lastSeenAt)}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <Badge variant={d.status === 'ACTIVE' ? 'success' : 'muted'}>{d.status}</Badge>
                  {d.status === 'ACTIVE' && (
                    <div className="flex gap-1">
                      <button className="btn btn-secondary p-1.5" onClick={() => onReset(d.id, d.deviceName ?? 'perangkat')} title="Reset"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <button className="btn btn-ghost p-1.5" onClick={() => onUnbind(d.id, d.deviceName ?? 'perangkat')} title="Lepas"><Unlink className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </Card>
  );
}
