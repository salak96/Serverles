#!/usr/bin/env bash
# Backup database MySQL PawangTools.
# Simpan di /var/backups/pawangtools/, rotate 14 hari.

set -euo pipefail

BACKUP_DIR="/var/backups/pawangtools"
RETENTION_DAYS=14
DB_NAME="pawangtools"
DB_USER="${PAWANG_DB_USER:-root}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Catatan keamanan: jangan taruh password di command line.
# Pakai ~/.my.cnf dengan permission 600 atau variabel environment.
# Contoh ~/.my.cnf:
#   [mysqldump]
#   user=root
#   password=YOUR_PASSWORD
chmod 700 "${BACKUP_DIR}"

mysqldump \
  --user="${DB_USER}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --quick \
  --lock-tables=false \
  "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Atur permission
chmod 600 "${BACKUP_FILE}"

echo "Backup created: ${BACKUP_FILE}"
echo "Size: $(du -h "${BACKUP_FILE}" | cut -f1)"

# Hapus backup lama
find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Old backups (>${RETENTION_DAYS} days) removed."
