#!/usr/bin/env bash
# Nightly Postgres backup: pg_dump -> gzip -> local rotation -> optional
# off-site copy via rclone (Hetzner Storage Box / Cloudflare R2).
# Install: crontab -e ->  15 3 * * * /opt/cockpitzero/deploy/backup.sh
set -euo pipefail

PROJECT="${COMPOSE_PROJECT:-cockpitzero-prod}"
BACKUP_DIR="${BACKUP_DIR:-/opt/cockpitzero/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}" # e.g. "storagebox:cockpitzero-backups"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"
file="$BACKUP_DIR/cockpitzero-$stamp.sql.gz"

docker compose -p "$PROJECT" exec -T postgres \
  pg_dump -U cockpitzero -d cockpitzero | gzip >"$file"

find "$BACKUP_DIR" -name 'cockpitzero-*.sql.gz' -mtime "+$KEEP_DAYS" -delete

if [[ -n "$RCLONE_REMOTE" ]]; then
  rclone copy "$file" "$RCLONE_REMOTE"
fi

echo "backup written: $file"
