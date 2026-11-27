#!/usr/bin/env bash
# Restore a dump made by db-backup.sh INTO the database in RESTORE_DATABASE_URL.
# Destructive for that database (objects are dropped and recreated), so the
# target must be given explicitly and confirmed.
#
#   RESTORE_DATABASE_URL=postgres://… npm run db:restore -- backups/unzur-20261127-020000.dump
set -euo pipefail
FILE="${1:-}"
[ -f "$FILE" ] || { echo "Usage: RESTORE_DATABASE_URL=… npm run db:restore -- <backup.dump>" >&2; exit 1; }
URL="${RESTORE_DATABASE_URL:-}"
[ -n "$URL" ] || { echo "Set RESTORE_DATABASE_URL to the database to overwrite." >&2; exit 1; }
URL="${URL%%\?*}"
HOST="$(printf '%s' "$URL" | sed -E 's#^[a-z]+://([^@]*@)?([^:/]+).*#\2#')"
read -r -p "This REPLACES the data in the database on ${HOST} with ${FILE}. Type the host name to continue: " ANSWER
[ "$ANSWER" = "$HOST" ] || { echo "Cancelled."; exit 1; }
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$URL" "$FILE"
echo "Restored ${FILE} into ${HOST}."
