# PawangTools Deployment

Panduan deployment ke Ubuntu VPS (22.04 LTS atau lebih baru) dengan Nginx
reverse proxy dan Let's Encrypt HTTPS.

> **Penting**: ganti semua placeholder `<...>` dengan nilai Anda. Jangan
> menyimpan nilai produksi di repositori.

## Persyaratan

- Ubuntu 22.04+ VPS dengan akses root atau sudo
- Domain yang sudah di-pointing ke IP VPS (A record)
- Minimal 1 GB RAM, 1 vCPU (cukup untuk 1k pengguna)
- MySQL 8 terpasang
- Node.js 20 LTS

## 0. Buat user deployment (opsional, sangat direkomendasikan)

```bash
adduser --disabled-password --gecos "" pawang
# tambahkan ke grup sudo jika perlu, atau jalankan dengan permission terbatas
```

## 1. Instal paket sistem

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server certbot python3-certbot-nginx ufw curl
```

## 2. Pasang Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x.x
```

## 3. Konfigurasi MySQL

```bash
sudo mysql_secure_installation
sudo mysql -u root -p
```

Di shell MySQL:

```sql
CREATE DATABASE pawangtools CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'pawangtools'@'localhost' IDENTIFIED BY 'GANTI_DENGAN_PASSWORD_KUAT';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, REFERENCES, INDEX, ALTER,
      CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE ON pawangtools.*
      TO 'pawangtools'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Catat DATABASE_URL:

```
mysql://pawangtools:GANTI_DENGAN_PASSWORD_KUAT@127.0.0.1:3306/pawangtools
```

## 4. Clone & build aplikasi

```bash
sudo mkdir -p /opt/pawangtools && sudo chown $USER:$USER /opt/pawangtools
cd /opt/pawangtools
git clone <repository-url> .
```

### Backend

```bash
cd backend
cp .env.example .env
# Generate secret acak (gunakan 3 nilai berbeda):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Edit .env, isi:
#   DATABASE_URL
#   SESSION_SECRET, TOKEN_SECRET, HWID_HMAC_SECRET (>= 32 byte random hex/base64)
#   LICENSE_ENCRYPTION_KEY (base64 dari randomBytes(32))
#   FRONTEND_URL=https://pawang.example.com
#   BACKEND_PUBLIC_URL=https://api.pawang.example.com
#   NODE_ENV=production

npm ci --omit=dev
npx prisma migrate deploy
npm run seed
npm run build
```

### Frontend

```bash
cd ../frontend
cp .env.example .env
# Edit .env: VITE_API_BASE_URL=/api/v1
# (frontend diproxy oleh Nginx di path yang sama)
npm ci
npm run build
# Hasil build ada di dist/
```

## 5. Generate Ed25519 keypair (untuk validasi offline — opsional)

```bash
mkdir -p /opt/pawangtools/backend/keys
openssl genpkey -algorithm Ed25519 -out /opt/pawangtools/backend/keys/license_signing_private.pem
openssl pkey -in /opt/pawangtools/backend/keys/license_signing_private.pem -pubout -out /opt/pawangtools/backend/keys/license_signing_public.pem
chmod 600 /opt/pawangtools/backend/keys/license_signing_private.pem
```

## 6. Buat admin pertama

```bash
cd /opt/pawangtools/backend
BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
BOOTSTRAP_ADMIN_NAME="Admin" \
BOOTSTRAP_ADMIN_PASSWORD='GantiPasswordKuat!2024' \
  npx tsx scripts/bootstrap-admin.ts
# atau: npx tsx scripts/bootstrap-admin.ts --interactive
```

Atau build dulu lalu jalankan compiled:

```bash
npm run build
node dist/scripts/bootstrap-admin.js  # jika path tidak ada, gunakan tsx di atas
```

## 7. Konfigurasi PM2

Buat file `ecosystem.config.cjs` di `/opt/pawangtools/`:

```js
module.exports = {
  apps: [{
    name: 'pawangtools-backend',
    cwd: '/opt/pawangtools/backend',
    script: 'dist/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: { NODE_ENV: 'production', PORT: 3000 },
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    out_file: '/var/log/pawangtools/out.log',
    error_file: '/var/log/pawangtools/error.log',
  }],
};
```

```bash
sudo mkdir -p /var/log/pawangtools && sudo chown $USER:$USER /var/log/pawangtools
cd /opt/pawangtools
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # ikuti instruksi yang muncul
```

Perintah bermanfaat:

```bash
pm2 status
pm2 logs pawangtools-backend
pm2 restart pawangtools-backend
pm2 stop pawangtools-backend
pm2 delete pawangtools-backend
```

## 8. Konfigurasi Nginx

Salin `deployment/nginx/pawangtools.conf` ke `/etc/nginx/sites-available/`:

```bash
sudo cp /opt/pawangtools/deployment/nginx/pawangtools.conf /etc/nginx/sites-available/pawangtools
sudo ln -s /etc/nginx/sites-available/pawangtools /etc/nginx/sites-enabled/
sudo nginx -t
```

Edit `pawangtools.conf` dan ganti `server_name`, `root` (lokasi `frontend/dist`),
serta `proxy_pass` (URL backend, default `http://127.0.0.1:3000`).

## 9. Aktifkan HTTPS

```bash
sudo certbot --nginx -d pawang.example.com -d api.pawang.example.com
sudo systemctl reload nginx
```

Certbot akan mengedit konfigurasi Nginx untuk menambah blok `443` dan
redirect HTTP → HTTPS. Perpanjangan otomatis diaktifkan melalui systemd timer.

## 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 11. Uji

```bash
curl -i https://pawang.example.com/api/v1/health
# harusnya: HTTP/2 200, JSON {"success":true,"data":{"status":"online",...}}
```

Buka `https://pawang.example.com` di browser. Login dengan akun admin.

## 12. Backup database

Lihat `backup.sh` di direktori ini. Contoh jadwal harian:

```bash
sudo crontab -e
# Tambah baris:
0 3 * * * /opt/pawangtools/deployment/backup.sh >> /var/log/pawangtools/backup.log 2>&1
```

Backup disimpan ke `/var/backups/pawangtools/` dan di-rotate selama 14 hari.

## 13. Pemeliharaan

- Update dependency: `npm outdated`, lalu `npm update` per folder.
- Rotate secret: generate nilai baru, update `.env`, `pm2 restart`.
- Pantau log: `pm2 logs` atau agregat ke sistem logging (Loki/ELK).

## Troubleshooting

- **502 Bad Gateway** dari Nginx: backend tidak jalan. Cek `pm2 status` dan
  `pm2 logs pawangtools-backend`.
- **Prisma error "Environment variable not found: DATABASE_URL"**: `.env`
  tidak terbaca. Jalankan dari cwd `backend/`.
- **CORS error**: tambahkan origin frontend ke `FRONTEND_URL` dan `BACKEND_PUBLIC_URL`.
- **Email tidak terkirim**: SMTP belum dikonfigurasi. Set `SMTP_*` di `.env`.
- **License tidak bisa dirotasi**: `LICENSE_ENCRYPTION_KEY` belum di-set, atau
  key tidak bisa decrypt. Lihat log untuk detail.
