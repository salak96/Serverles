# PawangTools

Portal membership dan server lisensi HWID untuk mengelola pengguna,
langganan, API key lisensi, perangkat, bot, tools, notifikasi, dan
distribusi file.

> **Stack:** Node.js + Express + TypeScript + Prisma + MySQL 8 (backend) ·
> React + Vite + TypeScript + Tailwind + TanStack Query (frontend) ·
> Nginx + PM2 + Let's Encrypt (deployment).

## Struktur

```
pawangtools/
├── backend/    # REST API, Prisma schema, migrations, seed
├── frontend/   # Dashboard pengguna & admin
├── deployment/ # Konfigurasi Nginx & systemd
└── docs/       # INSTALLATION, API, SECURITY, DEPLOYMENT
```

Lihat masing-masing folder untuk detail:

- [`backend/README.md`](./backend/README.md) — API, Prisma, environment
- [`frontend/README.md`](./frontend/README.md) — antarmuka & build
- [`docs/INSTALLATION.md`](./docs/INSTALLATION.md) — instalasi lokal
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deployment ke Ubuntu VPS
- [`docs/API.md`](./docs/API.md) — dokumentasi endpoint
- [`docs/SECURITY.md`](./docs/SECURITY.md) — catatan keamanan

## Fitur utama

- Autentikasi email + password (Argon2id), verifikasi email, reset password.
- Role USER / ADMIN dengan pemeriksaan di backend.
- Paket langganan (Free / Basic / Pro / Premium) yang dikelola dari database.
- Lisensi terikat perangkat (HWID) dengan HMAC-SHA-256.
- Rotasi API key, reset HWID, audit log.
- Pembayaran via adapter (Tripay/Midtrans/Xendit/Manual) — otomatis non-aktif
  jika payment gateway belum dikonfigurasi.
- Distribusi file rilis dengan endpoint unduhan yang dilindungi.
- Notifikasi pengguna (per-user dan global).
- Logging terstruktur (pino) dengan sanitasi otomatis untuk secret.

## Mulai cepat (lokal)

```bash
# 1. Siapkan database MySQL 8
mysql -u root -p -e "CREATE DATABASE pawangtools CHARACTER SET utf8mb4;"

# 2. Backend
cd backend
cp .env.example .env
# edit .env (DATABASE_URL, SESSION_SECRET, TOKEN_SECRET, HWID_HMAC_SECRET, ...)
npm install
npx prisma migrate dev --name init
npm run seed
npm run bootstrap:admin
npm run dev

# 3. Frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

Lihat [`docs/INSTALLATION.md`](./docs/INSTALLATION.md) untuk langkah lengkap.

## Lisensi

Internal / proprietary.
