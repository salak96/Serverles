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
const activateExample = `curl -X POST "${baseUrl}/licenses/activate-device" \\
  -H "Content-Type: application/json" \\
  -d '{
    "licenseKey": "PAW-XXXX-XXXX-XXXX-XXXX",
    "deviceId": "unique-device-id-12345",
    "platform": "windows",
    "appVersion": "1.0.0",
    "deviceName": "PC utama"
  }'`;
const activateResponseExample = `{
  "success": true,
  "data": {
    "valid": true,
    "license_status": "ACTIVE",
    "plan": { "name": "Pro", "slug": "pro", "max_devices": 2, "features": ["tool-access"] },
    "expires_at": "2026-12-31T00:00:00.000Z",
    "device_status": "BOUND",
    "device": {
      "id": "cmexampledeviceid",
      "device_name": "PC utama",
      "platform": "windows",
      "app_version": "1.0.0",
      "bound_at": "2026-06-01T00:00:00.000Z",
      "last_seen_at": "2026-06-01T00:00:00.000Z"
    },
    "active_devices": 1,
    "allowed_features": ["tool-access"],
    "server_time": "2026-06-01T00:00:00.000Z"
  }
}`;

export function ApiDocsPage() {
  const [copied, setCopied] = useState<'validate' | 'activate' | null>(null);

  const copyExample = async (kind: 'validate' | 'activate'): Promise<void> => {
    try {
      await navigator.clipboard.writeText(kind === 'validate' ? validateExample : activateExample);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
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
            Gunakan API ini dari aplikasi desktop atau tool Anda untuk memeriksa lisensi dan mengikat perangkat tanpa login akun.
          </p>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="font-semibold">1. Validasi lisensi</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <span className="inline-flex h-fit w-fit rounded-md bg-success/15 px-2.5 py-1 font-mono text-xs font-bold text-success">POST</span>
            <code className="break-all rounded-lg border border-line bg-bg-sidebar px-3 py-2 text-sm text-ink">{baseUrl}/licenses/validate</code>
          </div>
        <p className="text-sm leading-relaxed text-ink-muted">Endpoint publik untuk memeriksa key. Perangkat baru mendapat status <code className="text-accent">NOT_BOUND</code>. Jangan buka fitur berlisensi sebelum pengguna menyetujui pengikatan dan aktivasi selesai.</p>
        </Card>
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="font-semibold">2. Aktivasi perangkat desktop</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
            <span className="inline-flex h-fit w-fit rounded-md bg-success/15 px-2.5 py-1 font-mono text-xs font-bold text-success">POST</span>
            <code className="break-all rounded-lg border border-line bg-bg-sidebar px-3 py-2 text-sm text-ink">{baseUrl}/licenses/activate-device</code>
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">Setelah pengguna menyetujui pengikatan, endpoint publik ini mengaktifkan perangkat langsung dengan API key. Login akun tidak diperlukan.</p>
        </Card>
      </div>

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
          <h3 className="font-semibold">Contoh validasi dengan cURL</h3>
          <button type="button" onClick={() => void copyExample('validate')} className="btn btn-secondary min-h-10 shrink-0">
            {copied === 'validate' ? <Check className="h-4 w-4 text-success" /> : <Clipboard className="h-4 w-4" />}
            {copied === 'validate' ? 'Tersalin' : 'Salin contoh'}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg-sidebar p-4 text-xs leading-relaxed text-ink"><code>{validateExample}</code></pre>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Contoh aktivasi perangkat dengan cURL</h3>
          <button type="button" onClick={() => void copyExample('activate')} className="btn btn-secondary min-h-10 shrink-0">
            {copied === 'activate' ? <Check className="h-4 w-4 text-success" /> : <Clipboard className="h-4 w-4" />}
            {copied === 'activate' ? 'Tersalin' : 'Salin contoh'}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-line bg-bg-sidebar p-4 text-xs leading-relaxed text-ink"><code>{activateExample}</code></pre>
        <div>
          <h4 className="mb-2 text-sm font-medium">Respons sukses</h4>
          <pre className="overflow-x-auto rounded-lg border border-line bg-bg-sidebar p-4 text-xs leading-relaxed text-ink"><code>{activateResponseExample}</code></pre>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="font-semibold">Urutan integrasi desktop</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>Buat dan simpan satu <code className="text-accent">deviceId</code> stabil untuk instalasi ini. Jangan membuat ID baru setiap aplikasi dijalankan.</li>
          <li>Kirim request validasi menggunakan API key dan <code className="text-accent">deviceId</code>.</li>
          <li>Jika <code className="text-accent">valid</code> bernilai false, blokir fitur dan tampilkan kode error.</li>
          <li>Jika lisensi valid dan pengguna setuju mengikat perangkat, kirim request aktivasi eksplisit. Jangan aktivasi otomatis hanya karena key valid.</li>
          <li>Lanjutkan hanya jika aktivasi berhasil dan <code className="text-accent">device_status</code> bernilai <code className="text-accent">BOUND</code>.</li>
          <li>Setelah reset atau pelepasan perangkat, pengikatan device ID/HWID baru ditahan selama 12 jam. Aktivasi sebelum waktunya mengembalikan <code className="text-accent">RESET_COOLDOWN_ACTIVE</code> dan <code className="text-accent">next_available_at</code>.</li>
        </ol>
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
        <p className="text-sm leading-relaxed text-ink-muted">Respons aktivasi sukses berisi <code className="text-accent">device_status: "BOUND"</code>. Validasi berikutnya dengan deviceId yang sama juga akan mengembalikan BOUND. Aktivasi menggunakan key diverifikasi melalui hash, dibatasi 10 percobaan per jam per alamat IP, dan tidak menyimpan key mentah.</p>
        <div>
          <h4 className="mb-2 text-sm font-medium">Kode error yang mungkin diterima</h4>
          <ul className="grid gap-1.5 text-sm text-ink-muted sm:grid-cols-2">
            <li><code className="text-danger">LICENSE_INVALID</code> — key tidak ditemukan atau lisensi belum aktif.</li>
            <li><code className="text-danger">LICENSE_EXPIRED</code> — masa lisensi habis.</li>
            <li><code className="text-danger">LICENSE_REVOKED</code> — lisensi dicabut.</li>
            <li><code className="text-danger">LICENSE_SUSPENDED</code> — akun atau lisensi ditangguhkan.</li>
            <li><code className="text-danger">EMAIL_NOT_VERIFIED</code> — email akun belum diverifikasi.</li>
            <li><code className="text-danger">DEVICE_LIMIT_REACHED</code> — kuota perangkat paket sudah penuh.</li>
            <li><code className="text-danger">RESET_COOLDOWN_ACTIVE</code> — tunggu 12 jam setelah reset perangkat sebelum mengikat komputer/HWID baru. Respons menyertakan <code>next_available_at</code>.</li>
            <li><code className="text-danger">LICENSE_INACTIVE</code> — lisensi berubah status saat aktivasi.</li>
            <li>HTTP <code className="text-danger">429</code> — batas percobaan aktivasi tercapai.</li>
          </ul>
        </div>
      </Card>

      <p className="text-xs leading-relaxed text-ink-muted">
        Validasi dibatasi 60 request per menit per alamat IP. Jangan menyimpan API key dalam log, URL, atau repository publik. Pengguna dapat melihat key dari halaman Lisensi &amp; HWID; key yang tidak bisa ditampilkan ulang perlu dirotasi.
      </p>
    </div>
  );
}
