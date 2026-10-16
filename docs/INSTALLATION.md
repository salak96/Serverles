# Instalasi Lokal PawangTools

Panduan menjalankan PawangTools di mesin lokal (Windows, macOS, Linux) untuk
pengembangan. Untuk deployment ke VPS, lihat `DEPLOYMENT.md`.

## 1. Prasyarat

- Node.js >= 20
- MySQL 8 (atau MariaDB 10.6+)
- Git
- (opsional) Akun SMTP untuk mengirim email

## 2. Clone dan install

```bash
git clone <repository-url> pawangtools
cd pawangtools

# Backend
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run bootstrap:admin    # atau gunakan env (lihat di bawah)

# Frontend (terminal lain)
cd ../frontend
cp .env.example .env
npm install
```

## 3. Konfigurasi environment

### Backend `.env`

Variabel yang **harus** diubah:

| Variabel | Contoh | Catatan |
|---|---|---|
| `DATABASE_URL` | `mysql://pawangtools:secret@127.0.0.1:3306/pawangtools` | Akses DB |
| `SESSION_SECRET` | 48 byte random hex | Generate dengan `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `TOKEN_SECRET` | 48 byte random hex | Sama seperti di atas |
| `HWID_HMAC_SECRET` | 48 byte random hex | Sama seperti di atas |
| `FRONTEND_URL` | `http://localhost:5173` | URL frontend (dev) |

Variabel opsional (fitur tidak aktif jika kosong):

- `SMTP_*` → email verifikasi & reset password
- `PAYMENT_*` → integrasi payment gateway (default: `manual`)
- `STORAGE_*` → object storage (default: `local`)
- `LICENSE_ENCRYPTION_KEY` → diperlukan agar API key dapat di-decrypt saat display

### Frontend `.env`

```
VITE_API_BASE_URL=/api/v1
```

Pada dev mode, Vite akan mem-proxy `/api` ke `http://127.0.0.1:3000`
(lihat `vite.config.ts`). Pada produksi, Nginx yang mem-proxy.

## 4. Menjalankan

```bash
# Terminal 1: backend (http://localhost:3000)
cd backend
npm run dev

# Terminal 2: frontend (http://localhost:5173)
cd frontend
npm run dev
```

Buka `http://localhost:5173` di browser.

## 5. Membuat admin pertama

```bash
cd backend
BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
BOOTSTRAP_ADMIN_NAME="Admin" \
BOOTSTRAP_ADMIN_PASSWORD='GantiPasswordKuat!2024' \
  npx tsx scripts/bootstrap-admin.ts
```

Output:

```
Admin dibuat: admin@example.com (id=...).
```

Login dengan kredensial tersebut di frontend.

## 6. Konfigurasi SMTP (opsional)

Jika Anda ingin email verifikasi/reset benar-benar terkirim:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=bot@example.com
SMTP_PASSWORD=app-specific-password
SMTP_FROM="PawangTools <no-reply@example.com>"
SMTP_SECURE=false
```

Untuk Gmail, buat [App Password](https://support.google.com/accounts/answer/185833).
Untuk provider lain, sesuaikan host/port.

Restart backend setelah mengubah konfigurasi.

## 7. Konfigurasi payment gateway (opsional)

Secara default, `PAYMENT_PROVIDER=manual` artinya order dibuat dengan status
PENDING dan admin harus mengaktifkannya secara manual. Untuk mengaktifkan
gateway otomatis:

1. Daftar ke salah satu: Tripay, Midtrans, atau Xendit.
2. Set di `.env`:
   ```env
   PAYMENT_PROVIDER=tripay
   PAYMENT_API_KEY=...
   PAYMENT_WEBHOOK_SECRET=...
   PAYMENT_CALLBACK_URL=https://api.example.com/api/v1/subscriptions/webhook
   ```
3. Implementasikan adapter spesifik di
   `backend/src/services/payment/payment.adapter.ts` jika perlu.
   (Adapter HMAC generic sudah disertakan sebagai fallback.)

## 8. Konfigurasi object storage (opsional)

Default: file rilis disimpan di `./storage/` di server. Untuk S3-compatible
storage (AWS S3, Cloudflare R2, MinIO, dll), pasang `@aws-sdk/client-s3`
dan implementasikan `S3Storage` di
`backend/src/services/storage/storage.adapter.ts`. Lalu set:

```env
STORAGE_PROVIDER=s3
STORAGE_BUCKET=...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_ENDPOINT=https://...
STORAGE_REGION=...
```

## 9. Skrip bermanfaat

```bash
# Backend
npm run dev                 # mode development
npm run build && npm start  # mode produksi
npm run lint
npm test
npm run prisma:studio       # GUI database
npm run seed                # seed paket & app settings (idempotent)

# Frontend
npm run dev
npm run build && npm run preview
npm run typecheck
```

## 10. Troubleshooting

- **Error CORS**: Pastikan `FRONTEND_URL` di backend sesuai dengan URL frontend.
- **401 saat akses endpoint terproteksi**: cookie HttpOnly belum ada. Login dulu.
- **Prisma error**: jalankan `npx prisma generate` setelah mengubah schema.
- **MySQL connection refused**: pastikan MySQL berjalan dan DATABASE_URL benar.
