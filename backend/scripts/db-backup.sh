#!/usr/bin/env bash
# Back up the database in DATABASE_URL (or BACKUP_DATABASE_URL) to backups/,
# as a compressed custom-format dump, keeping the newest KEEP (default 14).
# Read-only on the database. Restore with scripts/db-restore.sh.
#
#   npm run db:backup                      # uses backend/.env
#   BACKUP_DATABASE_URL=postgres://… npm run db:backup   # e.g. the live database
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${BACKUP_DATABASE_URL:-}" ] && [ -f .env ]; then
  # Read DATABASE_URL from .env without executing the file.
  DATABASE_URL="${DATABASE_URL:-$(grep -E '^DATABASE_URL=' .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')}"
fi
URL="${BACKUP_DATABASE_URL:-${DATABASE_URL:-}}"
[ -n "$URL" ] || { echo "No database URL (set BACKUP_DATABASE_URL or DATABASE_URL)." >&2; exit 1; }
command -v pg_dump >/dev/null || { echo "pg_dump not found (install PostgreSQL client tools)." >&2; exit 1; }

URL="${URL%%\?*}" # pg_dump doesn't understand Prisma's ?schema=… parameter
mkdir -p backups
FILE="backups/unzur-$(date -u +%Y%m%d-%H%M%S).dump"
trap 'rm -f "$FILE.part"' EXIT # never leave a half-written backup behind
pg_dump --format=custom --compress=9 --no-owner --no-privileges --file="$FILE.part" "$URL"
mv "$FILE.part" "$FILE"
echo "Backup written: $FILE ($(du -h "$FILE" | cut -f1))"

KEEP="${KEEP:-14}"
ls -1t backups/unzur-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f
