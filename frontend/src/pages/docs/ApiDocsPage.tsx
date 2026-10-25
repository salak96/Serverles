import { useState } from 'react';
import { Check, Clipboard, Code2, KeyRound, ShieldCheck } from 'lucide-react';
import { apiUrl } from '@/lib/api';
import { Card } from '@/components/ui';

const baseUrl = apiUrl('/licenses/validate').replace(/\/licenses\/validate$/, '');
const validateExample = `curl -X POST "${baseUrl}/licenses/validate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "PAW-XXXX-XXXX-XXXX-XXXX",
    "deviceId": "unique-device-id-12345",
    "platform": "windows",
    "appVersion": "1.0.0",
    "deviceName": "PC utama"
  }'`;

export function ApiDocsPage() {
  const [copied, setCopied] = useState(false);

  const copyExample = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(validateExample);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Code2 className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Dokumentasi API Lisensi</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Gunakan API ini dari aplikasi desktop atau tool Anda untuk memeriksa apakah lisensi pelanggan aktif.
          </p>
        </div>
      </header>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="font-semibold">Validasi lisensi</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <span className="inline-flex h-fit w-fit rounded-md bg-success/15 px-2.5 py-1 font-mono text-xs font-bold text-success">POST</span>
          <code className="break-all rounded-lg border border-line bg-bg-sidebar px-3 py-2 text-sm text-ink">{baseUrl}/licenses/validate</code>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">
          Endpoint ini bersifat publik; aplikasi pelanggan tidak memerlukan login akun. API key lisensi dikirim pada body request sebagai <code className="text-accent">licenseKey</code>. Jangan menaruh API key rahasia server di aplikasi desktop.
        </p>
      </Card>

      <Card className="space-y-4">
        <h3 className="font-semibold">Body request JSON</h3>
        <div className="overflow-x-auto rounded-lg border border-line bg-bg-sidebar p-4">
          <pre className="min-w-[480px] text-xs leading-relaxed text-ink"><code>{JSON.stringify({
            licenseKey: 'PAW-XXXX-XXXX-XXXX-XXXX',
            deviceId: 'unique-device-id-12345',
            platform: 'windows',
            appVersion: '1.0.0',
            deviceName: 'PC utama',
          }, null, 2)}</code></pre>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-mono text-accent">licenseKey</dt><dd className="mt-1 text-ink-muted">API key lisensi dari menu Lisensi &amp; HWID.</dd></div>
          <div><dt className="font-mono text-accent">deviceId</dt><dd className="mt-1 text-ink-muted">ID stabil dan unik untuk perangkat. Minimal 8 karakter; gunakan ID yang sama pada validasi berikutnya.</dd></div>
          <div><dt className="font-mono text-accent">platform</dt><dd className="mt-1 text-ink-muted">Opsional, contoh: windows, macos, linux.</dd></div>
          <div><dt className="font-mono text-accent">appVersion</dt><dd className="mt-1 text-ink-muted">Opsional, versi aplikasi Anda.</dd></div>
          <div><dt className="font-mono text-accent">deviceName</dt><dd className="mt-1 text-ink-muted">Opsional, nama yang terlihat pengguna pada daftar perangkat.</dd></div>
        </dl>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Contoh dengan cURL</h3>
          <button type="button" onClick={() => void copyExample()} className="btn btn-secondary min-h-10 shrink-0">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Clipboard className="h-4 w-4" />}
            {copied ? 'Tersalin' : 'Salin contoh'}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg-sidebar p-4 text-xs leading-relaxed text-ink"><code>{validateExample}</code></pre>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="font-semibold">Membaca hasil validasi</h3>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">Jika key valid, aktif, email pemilik terverifikasi, dan perangkat memenuhi batas paket, respons memuat <code className="text-accent">data.valid: true</code> beserta paket, fitur yang diizinkan, tanggal kedaluwarsa, dan status perangkat.</p>
        <div className="overflow-x-auto rounded-lg border border-line bg-bg-sidebar p-4">
          <pre className="text-xs leading-relaxed text-ink"><code>{JSON.stringify({
            success: true,
            data: {
              valid: true,
              license_status: 'ACTIVE',
              plan: { name: 'Pro', slug: 'pro', max_devices: 2, features: ['tool-access'] },
              expires_at: '2026-12-31T00:00:00.000Z',
              device_status: 'NOT_BOUND',
              allowed_features: ['tool-access'],
              server_time: '2026-06-01T00:00:00.000Z',
            },
          }, null, 2)}</code></pre>
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">Status <code className="text-accent">NOT_BOUND</code> berarti perangkat belum terikat. Setelah pengguna menyetujui aktivasi, ikat perangkat melalui <code className="text-accent">POST {baseUrl}/licenses/:id/activate</code> menggunakan login akun. Perangkat yang sudah terikat akan mendapat status <code className="text-accent">BOUND</code>.</p>
        <div>
          <h4 className="mb-2 text-sm font-medium">Kode error yang mungkin diterima</h4>
          <ul className="grid gap-1.5 text-sm text-ink-muted sm:grid-cols-2">
            <li><code className="text-danger">LICENSE_INVALID</code> — key tidak ditemukan atau belum aktif.</li>
            <li><code className="text-danger">LICENSE_EXPIRED</code> — masa lisensi habis.</li>
            <li><code className="text-danger">LICENSE_REVOKED</code> — lisensi dicabut.</li>
            <li><code className="text-danger">LICENSE_SUSPENDED</code> — akun atau lisensi ditangguhkan.</li>
            <li><code className="text-danger">EMAIL_NOT_VERIFIED</code> — email akun belum diverifikasi.</li>
            <li><code className="text-danger">DEVICE_LIMIT_REACHED</code> — kuota perangkat paket sudah penuh.</li>
          </ul>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-ink-muted">
        Validasi dibatasi 60 request per menit per alamat IP. Jangan menyimpan API key dalam log, URL, atau repository publik. Pengguna dapat melihat key dari halaman Lisensi &amp; HWID; key yang tidak bisa ditampilkan ulang perlu dirotasi.
      </p>
    </div>
  );
}
