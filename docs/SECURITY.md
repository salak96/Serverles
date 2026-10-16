# PawangTools — Security Notes

Catatan keamanan yang diterapkan di PawangTools. Dokumen ini menjelaskan
keputusan desain dan asumsi, bukan pengganti audit profesional.

## 1. Autentikasi

- Password disimpan dengan **Argon2id** (default cost).
- Kebijakan password: minimal 8 karakter, harus ada huruf besar, kecil, dan
  angka. (Bisa diperketat di `validatePasswordPolicy` di
  `backend/src/modules/auth/auth.service.ts`.)
- Verifikasi email wajib sebelum sebagian besar aksi sensitif (aktivasi
  lisensi, dll.).
- Reset password menggunakan token sekali pakai, hashed di DB, berlaku 1 jam.
- Login gagal menggunakan Argon2 dummy untuk mencegah timing attack.

## 2. Sesi

- Access token: JWT, 15 menit, disimpan di cookie HttpOnly atau
  `Authorization: Bearer`. Pada produksi, cookie `Secure` aktif.
- Refresh token: 48 byte random, di-hash (SHA-256) sebelum disimpan.
- Refresh token dirotasi pada setiap `/auth/refresh` (token lama dicabut).
- `logout-all` mencabut semua refresh token lain.

## 3. CSRF

Cookie SameSite=Lax. Karena endpoint sensitif sebagian besar menggunakan
JSON body (bukan form), risiko CSRF berkurang. Untuk produksi dengan
form HTML, pertimbangkan middleware CSRF token.

## 4. HWID & Device Binding

- **HWID bukan bukti identitas tak-terbobel.** Nilai HWID dapat dipalsukan.
  Digunakan hanya sebagai identifier aplikasi.
- HWID mentah **tidak pernah** disimpan. Disimpan sebagai
  **HMAC-SHA-256(server secret)**. Secret disimpan di environment, dirotasi
  secara periodik. Setelah rotasi, semua binding lama menjadi orphan
  (tidak bisa di-match dengan HWID baru) — oleh karena itu rotasi
  direncanakan waktunya.
- Aktivasi menggunakan transaksi database + batasan `maxDevices` per paket.
- Aktivasi bersamaan (race) dijaga oleh transaksi; tidak dapat melampaui
  kapasitas.
- Tampilan HWID ke frontend selalu disamarkan
  (`9F3A****B71C`). Backend **tidak pernah** mengirim HWID mentah.
- Reset device tunduk pada kuota dan cooldown paket (lihat
  `resetPolicy` di `Plan`).

## 5. Lisensi / API Key

- API key dihasilkan dari `crypto.randomBytes(16)` (128 bit entropi).
- Format: `PAW-XXXX-XXXX-XXXX-XXXX` (hex, hanya untuk keterbacaan).
- Disimpan sebagai **SHA-256 hash** (keyHash).
- Penampilan ulang hanya dimungkinkan jika `LICENSE_ENCRYPTION_KEY` di-set
  (enkripsi autentik AES-256-GCM). Tanpa itu, gunakan rotasi.
- Rotasi key mencabut key lama secara permanen.
- Frontend tidak pernah menerima plaintext key kecuali pada saat issuance
  dan rotation.

## 6. Autorisasi

- Middleware `requireAuth` (backend) memverifikasi JWT.
- Middleware `requireAdmin` mengecek role dari DB (bukan dari payload JWT saja).
- Endpoint `/licenses/:id/*` mengecek `license.userId === req.user.id`
  atau `req.user.role === 'ADMIN'`. Pengecekan ada di controller, bukan
  disembunyikan di frontend.

## 7. Webhook Pembayaran

- Signature diverifikasi dengan **HMAC-SHA-256** (constant-time compare).
- Idempotensi: `provider + providerEventId` di-unique-kan di DB. Callback
  berulang tidak memproses ulang.
- Verifikasi nominal, mata uang, dan order reference sebelum aktivasi.
- Aktivasi langganan dan penerbitan lisensi terjadi di dalam satu
  transaksi.
- Aktivasi TIDAK bergantung pada redirect browser — hanya webhook yang
  diverifikasi.

## 8. Validasi Input

- Semua request divalidasi dengan **Zod** (frontend + backend).
- Error Zod diubah menjadi 400 dengan detail field oleh `errorHandler`.
- Frontend menggunakan Zod via `react-hook-form` untuk UX yang konsisten.

## 9. Rate Limiting

- `express-rate-limit` dengan window dan max yang dapat dikonfigurasi.
- Berlaku global + override per endpoint sensitif.
- Berjalan di-memory (single instance). Untuk multi-instance, gunakan
  Redis-backed store (lihat `rate-limit-redis` di deps; belum diaktifkan).

## 10. Logging

- Logger: `pino` (structured, JSON-friendly).
- `pino-pretty` di dev, JSON di prod.
- **Sanitasi otomatis** untuk field: `password`, `token`, `accessToken`,
  `refreshToken`, `apiKey`, `licenseKey`, `key`, `secret`, `privateKey`,
  `cookie`, `authorization`, dan yang mengandung substring tersebut.
- Audit log ke DB untuk aksi sensitif: login, register, issue/rotate
  license, reset device, payment, perubahan status.
- `recordAudit` menyaring `metadata` dari field sensitif sebelum simpan.
- Log tidak boleh berisi password, token, key lengkap, atau HMAC secret.

## 11. Headers

- `helmet` menambahkan header standar (CSP di produksi, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, dll.).
- HSTS aktif (`Strict-Transport-Security: max-age=...`) pada produksi
  (otomatis oleh Helmet).
- `X-Powered-By` dinonaktifkan.

## 12. CORS

- `Access-Control-Allow-Origin` allowlist: hanya `FRONTEND_URL` dan
  `BACKEND_PUBLIC_URL` yang diizinkan.
- `credentials: true` (cookie HttpOnly diizinkan).
- Origin yang tidak dikenal ditolak oleh middleware CORS.

## 13. Data Retention

- AuditLog, Notification, dan LicenseActivationAttempt disimpan tanpa
  TTL bawaan. Disarankan menambahkan job cleanup berkala:
  ```sql
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL 90 DAY;
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL 180 DAY;
  DELETE FROM license_activation_attempts WHERE created_at < NOW() - INTERVAL 60 DAY;
  ```
- Backup disimpan 14 hari di disk lokal (lihat `deployment/backup.sh`).
  Untuk retensi lebih lama, salin ke object storage.

## 14. Pemberitahuan Pelanggaran Data

- Admin dapat menangguhkan akun (`status = 'SUSPENDED'`) sehingga
  login ditolak.
- Endpoint reset password selalu merespons identik (tidak membocorkan
  apakah email terdaftar).

## 15. Yang TIDAK Dilakukan di Build Ini

- **2FA / TOTP** — bisa ditambahkan nanti di tabel `user.twoFactorSecret`.
- **SSO (Google/GitHub)** — tidak dalam build default.
- **CSRF token form-based** — saat ini SameSite=Lax cukup untuk
  aplikasi yang semuanya JSON. Tambahkan middleware jika Anda
  menggunakan form HTML.
- **Redis-backed rate limit** — saat ini single-instance.

## 16. Laporan Insiden

Jika terjadi insiden keamanan:

1. Putar `SESSION_SECRET`, `TOKEN_SECRET`, `HWID_HMAC_SECRET` (env) →
   `pm2 restart`. Catat: ini akan memutuskan semua sesi aktif.
2. Jika HWID_HMAC_SECRET dirotasi, binding perangkat user perlu diulang.
3. Putar `LICENSE_ENCRYPTION_KEY` jika compromise. **Key ter-enkripsi di
   DB tidak akan bisa di-decrypt ulang.** Minta user melakukan rotasi.
4. Cabut lisensi yang terdampak (`status = 'REVOKED'`).
5. Periksa `audit_logs` untuk jejak aktivitas mencurigakan.
6. Informasikan user yang terdampak (via notifikasi) untuk reset password.

## 17. Tanggung Jawab Pengguna

- Jangan bagikan API key lisensi.
- Jangan hardcode `LICENSE_ENCRYPTION_KEY` atau `HWID_HMAC_SECRET` di
  repositori.
- Untuk deployment, generate secret baru. Jangan gunakan secret contoh.
