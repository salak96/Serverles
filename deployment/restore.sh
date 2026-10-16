#!/usr/bin/env bash
# Restore backup MySQL PawangTools.
# Usage: ./restore.sh /var/backups/pawangtools/pawangtools_20260101_030000.sql.gz

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
DB_NAME="pawangtools"
DB_USER="${PAWANG_DB_USER:-root}"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}" >&2
  exit 1
fi

echo "This will REPLACE the current ${DB_NAME} database."
read -p "Type 'YES' to continue: " CONFIRM
if [ "${CONFIRM}" != "YES" ]; then
  echo "Aborted."
  exit 1
fi

gunzip -c "${BACKUP_FILE}" | mysql --user="${DB_USER}" "${DB_NAME}"
echo "Restore complete from ${BACKUP_FILE}."

# Setelah restore, jalankan:
#   cd /opt/pawangtools/backend && npx prisma migrate deploy
# untuk memastikan schema up-to-date.
