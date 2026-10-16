# PawangTools — API Reference

Base URL: `https://<your-domain>/api/v1`

Semua response mengikuti format:

```json
{ "success": true, "data": { ... } }
```

Atau saat error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { } } }
```

## HTTP Status

| Code | Kapan |
|---|---|
| 200 | Berhasil |
| 201 | Resource baru dibuat |
| 400 | Request tidak valid / validasi gagal |
| 401 | Belum terautentikasi |
| 403 | Tidak memiliki izin |
| 404 | Resource tidak ditemukan |
| 409 | Konflik (email duplikat, dsb.) |
| 429 | Rate limit tercapai |
| 500 | Kesalahan internal (lihat log) |

## Autentikasi

PawangTools menggunakan dua mekanisme bersamaan:

- **Access token**: 15 menit, dikirim via cookie HttpOnly `pt_access` atau
  header `Authorization: Bearer <token>`.
- **Refresh token**: 30 hari, disimpan di DB (hash), dikirim via cookie
  HttpOnly `pt_refresh`. Rotasi otomatis pada setiap `/auth/refresh`.

Pada produksi, cookie di-set dengan `Secure` flag aktif.

## Endpoint

### Health

#### `GET /health`
Publik. Status service + integrasi.

```json
{
  "success": true,
  "data": {
    "status": "online",
    "service": "pawangtools-backend",
    "version": "0.1.0",
    "checks": { "database": { "status": "up", "latency_ms": 12 } },
    "integrations": { "smtp": "configured|not_configured", "payment": "configured|not_configured", "storage": "local|configured" }
  }
}
```

### Authentication

#### `POST /auth/register`

```json
{
  "name": "Nama Lengkap",
  "email": "user@example.com",
  "password": "PasswordKuat!1",
  "confirmPassword": "PasswordKuat!1",
  "acceptTerms": true
}
```

Response 201:

```json
{
  "success": true,
  "data": {
    "message": "Akun berhasil dibuat.",
    "emailDelivery": { "configured": true, "delivered": true, "reason": null }
  }
}
```

Email tidak akan diverifikasi sampai tautan diklik. `delivered: false`
artinya SMTP tidak dikonfigurasi atau pengiriman gagal.

#### `POST /auth/verify-email`

```json
{ "token": "<from-email-url>" }
```

#### `POST /auth/resend-verification`

```json
{ "email": "user@example.com" }
```

#### `POST /auth/login`

```json
{ "email": "user@example.com", "password": "..." }
```

Response 200 menyetel cookie `pt_access` + `pt_refresh` dan mengembalikan
`accessToken` (untuk klien yang tidak dapat menerima cookie).

```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "accessTokenExpiresIn": 900,
    "user": { "id": "...", "name": "...", "email": "...", "role": "USER|ADMIN", "emailVerified": true, "status": "ACTIVE" }
  }
}
```

#### `POST /auth/refresh`

Memutar refresh token (cookie atau body `refreshToken`).

#### `POST /auth/logout`

Mencabut refresh token saat ini. Selalu 200.

#### `POST /auth/logout-all` (auth)

Mencabut semua sesi lain (refresh token lain di device lain).

#### `POST /auth/forgot-password`

```json
{ "email": "user@example.com" }
```

Selalu 200, tanpa membocorkan apakah email terdaftar.

#### `POST /auth/reset-password`

```json
{
  "token": "<from-email-url>",
  "password": "PasswordBaru!1",
  "confirmPassword": "PasswordBaru!1"
}
```

Mencabut semua refresh token user.

#### `GET /auth/me` (auth)

Mengembalikan profil user saat ini.

### Users

#### `GET /users/me` (auth)
#### `PATCH /users/me` (auth) — body: `{ "name": "..." }`
#### `PATCH /users/me/password` (auth)
```json
{ "currentPassword": "...", "newPassword": "...", "confirmPassword": "..." }
```
Mencabut sesi lain.

#### `GET /users/me/activity` (auth)
Log audit milik user (maks 100 entri).

### Plans

#### `GET /plans` (publik)
Daftar paket aktif. Format rupiah Indonesia sudah di-format.

#### `GET /plans/:slug` (publik)
Detail paket.

### Subscriptions

#### `GET /subscriptions/me` (auth)
Daftar langganan user.

#### `POST /subscriptions/checkout` (auth)
```json
{ "planId": "...", "durationDays": 30 }
```
Membuat order PENDING. Status tidak berubah sampai webhook diterima.

#### `GET /subscriptions/orders` (auth)
Riwayat order user.

#### `GET /subscriptions/orders/:id` (auth)
Detail order.

#### `POST /subscriptions/webhook` (publik, signed)
Dipanggil oleh payment gateway. Header `X-Signature: <hex hmac-sha256>`
atas raw body dengan secret `PAYMENT_WEBHOOK_SECRET`. Idempotent
berdasarkan `providerEventId`.

### Licenses

#### `GET /licenses/me` (auth)
Daftar lisensi user.

#### `GET /licenses/:id` (auth)
Detail lisensi.

#### `POST /licenses/:id/reveal-key` (auth)
Menampilkan API key lengkap (hanya jika `LICENSE_ENCRYPTION_KEY` di-set).
Jika tidak, kembalikan `{ available: false, message: "..." }`.

#### `POST /licenses/:id/rotate-key` (auth, 5/jam)
Merotasi API key. Key lama langsung dicabut. Response berisi plaintext
key baru — simpan di tempat aman.

#### `POST /licenses/:id/activate` (auth)
```json
{ "deviceId": "...", "deviceName": "...", "platform": "...", "appVersion": "..." }
```
- `deviceId` ≥ 8 karakter.
- Aktivasi atomik; tidak dapat melampaui `plan.maxDevices`.

#### `POST /licenses/:id/deactivate` (auth)
Body sama dengan activate. Melepas device tertentu.

#### `GET /licenses/:id/devices` (auth)
Daftar perangkat terikat. `hwidMasked` adalah representasi tersamarkan.

#### `POST /licenses/:id/devices/reset` (auth) atau `POST /licenses/:id/devices/:deviceId/reset` (auth)
Reset mengikuti kuota paket (`resetPolicy`). Bisa berstatus `COMPLETED`
atau `PENDING` (jika `requireAdmin` di paket).

#### `DELETE /licenses/:id/devices/:deviceId` (auth)
Lepas device langsung.

#### `POST /licenses/validate` (publik, rate-limited)
Validasi untuk aplikasi eksternal.

Request:
```json
{
  "licenseKey": "PAW-XXXX-XXXX-XXXX-XXXX",
  "deviceId": "device-identity-string",
  "appVersion": "1.0.0",
  "platform": "Windows"
}
```

Success response (HTTP 200):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "license_status": "ACTIVE",
    "plan": { "name": "Pro", "slug": "pro", "max_devices": 2, "features": ["..."] },
    "expires_at": "2026-12-31T...",
    "device_status": "BOUND" | "NOT_BOUND",
    "allowed_features": ["..."],
    "server_time": "2026-10-16T..."
  }
}
```

Error codes (saat `valid: false`):
- `LICENSE_INVALID` — key tidak dikenal
- `LICENSE_EXPIRED` — sudah lewat `expiresAt`
- `LICENSE_REVOKED` — dicabut admin
- `LICENSE_SUSPENDED` — ditangguhkan
- `EMAIL_NOT_VERIFIED` — pemilik belum verifikasi email
- `DEVICE_LIMIT_REACHED` — semua slot terpakai
- `DEVICE_NOT_BOUND` — jika client butuh binding (kami otomatis mengarahkan ke activate)

### Devices

Lihat `/licenses/:id/devices/...` di atas.

### Tools

#### `GET /tools` (publik)
Query: `search`, `category`, `plan` (slug), `sort` (`newest`|`name`).

#### `GET /tools/:slug` (publik)
Detail tool + semua rilis.

#### `GET /tools/:slug/releases` (publik)
Daftar rilis.

#### `GET /tools/:slug/download?version=...` (auth)
Mengembalikan metadata unduhan. Untuk tool yang memerlukan paket,
langganan aktif pada paket tersebut wajib ada. File dikirim via
streaming atau signed URL (S3).

#### `POST /tools` (admin) — body sesuai schema
#### `PATCH /tools/:id` (admin)
#### `DELETE /tools/:id` (admin, archive)

#### `POST /tools/releases` (admin, multipart)
Field: `file` (binary, maks 500MB), `toolId`, `version`, `releaseNotes`.
Menghitung SHA-256 dan ukuran otomatis.

### Notifications

#### `GET /notifications` (auth)
Query: `page`, `limit`, `category`. Mengembalikan unread count.

#### `PATCH /notifications/:id/read` (auth)
#### `POST /notifications/read-all` (auth)

### Admin

#### `GET /admin/dashboard` (admin)
Ringkasan metrik.

#### `GET /admin/users` (admin) — query: `page`, `limit`, `search`, `status`
#### `GET /admin/users/:id` (admin)
#### `PATCH /admin/users/:id` (admin)
```json
{ "status": "ACTIVE|SUSPENDED|PENDING_VERIFICATION", "role": "USER|ADMIN", "name": "..." }
```

#### `GET /admin/licenses` (admin)
#### `POST /admin/licenses` (admin)
```json
{ "userId": "...", "planId": "...", "durationDays": 30, "name": "..." }
```
Mengembalikan API key lengkap.

#### `PATCH /admin/licenses/:id` (admin)
```json
{ "status": "ACTIVE|EXPIRED|REVOKED|SUSPENDED|PENDING", "revokeReason": "...", "extendDays": 30 }
```

#### `POST /admin/licenses/:id/revoke` (admin)

#### `GET /admin/devices` (admin)
#### `POST /admin/devices/:id/unbind` (admin)

#### `GET /admin/tools` (admin)
#### `POST /admin/notifications` (admin)
```json
{
  "isGlobal": true,
  // atau
  "userIds": ["cuid1", "cuid2"],
  "title": "...",
  "body": "...",
  "category": "SYSTEM|ACCOUNT|SUBSCRIPTION|LICENSE|DEVICE|PAYMENT|TOOL_UPDATE",
  "link": "https://..."
}
```

#### `GET /admin/audit-logs` (admin) — query: `action`, `page`, `limit`
#### `GET /admin/settings` (admin)
#### `PATCH /admin/settings` (admin) — body: `{ "key": "...", "value": ... }`

## Integrasi Lisensi (Contoh Klien)

Contoh kode (pseudo) untuk aplikasi desktop:

```js
const r = await fetch('https://api.example.com/api/v1/licenses/validate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    licenseKey: userInputKey,
    deviceId: hwid,        // string identity unik mesin
    appVersion: APP_VERSION,
    platform: process.platform,
  }),
});
const { data } = await r.json();
if (!data.valid) {
  showError(data.error_code);
  return;
}
if (data.device_status === 'NOT_BOUND') {
  // Otomatis aktivasi
  await fetch(`https://api.example.com/api/v1/licenses/${licenseId}/activate`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: hwid, platform: process.platform, appVersion: APP_VERSION }),
  });
}
// Lanjut ke fitur aplikasi, hanya izinkan yang ada di data.allowed_features
```

> **Catatan validasi offline**: PawangTools mendukung penerbitan token
> offline berumur pendek (≤ 15 menit, default 900 detik) yang ditandatangani
> Ed25519 oleh server. Embed public key di klien. Pencabutan tidak
> langsung terkonfirmasi pada klien yang sedang offline. Implementasi
> spesifik tidak termasuk dalam build default.

## Rate Limiting

Default global: 120 req/menit per IP. Endpoint sensitif override:

| Endpoint | Batas |
|---|---|
| `POST /auth/register` | 20/15min |
| `POST /auth/login` | 8/15min |
| `POST /auth/reset-password` | 8/15min |
| `POST /auth/resend-verification`, `POST /auth/forgot-password` | 3/5min |
| `POST /licenses/:id/rotate-key` | 5/jam |
| `POST /licenses/:id/activate`, `POST /licenses/validate` | 60/menit |
| `POST /subscriptions/webhook` | 120/menit |

Response 429:
```json
{ "success": false, "error": { "code": "RATE_LIMITED", "message": "Terlalu banyak percobaan. Coba lagi nanti." } }
```
