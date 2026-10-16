# PawangTools — Backend

Express + TypeScript + Prisma + MySQL 8.

## Persyaratan

- Node.js >= 20
- MySQL 8
- (opsional) SMTP untuk pengiriman email

## Instalasi

```bash
cp .env.example .env
# edit .env: set DATABASE_URL, SESSION_SECRET, TOKEN_SECRET, HWID_HMAC_SECRET
# generate secret acak:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm install
npx prisma migrate dev --name init
npm run seed
```

## Menjalankan

```bash
npm run dev          # development (tsx watch)
npm run build        # tsc -> dist/
npm start            # production
npm run lint
npm test             # vitest
```

## Skrip bermanfaat

```bash
npm run prisma:studio        # Prisma Studio (GUI DB)
npm run bootstrap:admin      # buat admin pertama (interaktif/env)
npm run seed                 # seed paket & app settings
```

## Environment

Lihat komentar di `.env.example`. Variabel yang **wajib** diubah untuk
lingkungan non-development:

- `DATABASE_URL`
- `SESSION_SECRET`, `TOKEN_SECRET`, `HWID_HMAC_SECRET` (>= 32 byte random)
- `SMTP_*` (jika ingin mengirim email)
- `PAYMENT_*` (jika payment gateway diaktifkan)
- `LICENSE_ENCRYPTION_KEY` (jika perlu menampilkan ulang API key)

## Struktur kode

```
src/
├── config/        # env, logger, prisma client
├── middleware/    # requestId, errorHandler, rateLimit
├── modules/
│   ├── health/    # GET /api/v1/health
│   ├── auth/      # FASE 3
│   ├── users/     # FASE 3
│   ├── plans/     # FASE 4-6
│   ├── subscriptions/  # FASE 7
│   ├── licenses/  # FASE 5
│   ├── devices/   # FASE 5
│   ├── tools/     # FASE 6
│   ├── notifications/  # FASE 6
│   ├── payments/  # FASE 7
│   ├── admin/     # FASE 6
│   └── audit/     # FASE 5-6
├── services/      # service bersama (email, storage, payment adapter)
├── utils/         # crypto, date, errors
├── app.ts         # Express app factory
└── server.ts      # entry point
```
