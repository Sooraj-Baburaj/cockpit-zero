# CockpitZero backend deployment (self-hosted VPS)

Single VPS (Hetzner CX/AX recommended), Docker Compose, Caddy for automatic
TLS, Postgres 16 + pgvector, Uptime Kuma for monitoring. Staging and prod run
as two compose projects on the same box until load says otherwise.

## One-time provisioning

```bash
# Ubuntu LTS, as root
adduser deploy && usermod -aG sudo,docker deploy
apt update && apt install -y docker.io docker-compose-v2 fail2ban unattended-upgrades
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

# as deploy
sudo mkdir -p /opt/cockpitzero && sudo chown deploy /opt/cockpitzero
cd /opt/cockpitzero
git clone <repo> src && ln -s src/deploy deploy   # or scp the deploy/ dir
```

DNS: point `api.<domain>`, `staging.<domain>`, and `status.api.<domain>` at
the VPS. Caddy provisions certificates on first request.

## Per-environment setup

Create `/opt/cockpitzero/deploy/.env.prod` (and `.env.staging`):

```env
API_DOMAIN=api.cockpitzero.app
PUBLIC_API_URL=https://api.cockpitzero.app
POSTGRES_PASSWORD=<openssl rand -hex 32>
BETTER_AUTH_SECRET=<openssl rand -hex 32>
API_TAG=latest            # staging can pin -rc tags
```

Bring up:

```bash
cd /opt/cockpitzero/deploy
docker compose -p cockpitzero-prod --env-file .env.prod up -d
docker compose -p cockpitzero-staging --env-file .env.staging up -d
```

Secrets live only in these `.env` files on the host — never in the repo.

## Deploys

CI (`.github/workflows/deploy-backend.yml`) builds the image, pushes to GHCR,
then SSHes in and runs `docker compose pull api && up -d api`. Manual deploy:

```bash
docker compose -p cockpitzero-prod --env-file .env.prod pull api
docker compose -p cockpitzero-prod --env-file .env.prod up -d api
```

Migrations run from CI (drizzle-kit against `DATABASE_URL`) before the new
container starts serving; until that lands, run them manually from a checkout.

## Backups (non-negotiable)

`backup.sh` does nightly `pg_dump` → gzip → 14-day local rotation → optional
`rclone` off-site copy (Hetzner Storage Box or Cloudflare R2). Add to cron and
**test a restore** before launch:

```bash
gunzip -c backups/cockpitzero-<stamp>.sql.gz | \
  docker compose -p cockpitzero-staging exec -T postgres psql -U cockpitzero -d cockpitzero
```

## Scale path (documented, not built)

The API is stateless: scale by running more `api` replicas behind Caddy, then
move Postgres to a dedicated box or managed PG when it becomes the bottleneck.
No code changes required — this is compose/DNS work.
