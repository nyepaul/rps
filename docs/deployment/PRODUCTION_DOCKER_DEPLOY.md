# Production Deployment (Docker-Only)

As of **2026-02-14**, RPS production runs **only** via Docker Compose (with Redis) on:

- App container: `127.0.0.1:5137` (Apache proxies to this)
- External URL: `https://rps.pan2.app`

This repo includes a safe deploy script: `bin/deploy-docker`.

## Prereqs (Production Host)

- Docker Engine + Docker Compose v2
- Apache2 (listens on `8087`, proxies to `127.0.0.1:5137`)
- Cloudflare Tunnel (routes `rps.pan2.app` -> `http://localhost:8087`)
- Root/sudo access

## One-Time Setup

1. Create production env file:

`/var/www/rps.pan2.app/.env.production` must exist and include at least:

- `SECRET_KEY`
- `ENCRYPTION_KEY`

Optional but typical:

- `BACKUP_KEY_PEPPER`
- mail settings (`MAIL_SERVER`, `MAIL_PORT`, etc.)
- cookie settings (`SESSION_COOKIE_SECURE`, etc.)

2. Confirm Apache is proxying to the Docker port:

- Apache should proxy to `http://127.0.0.1:5137`

## Deploy

From your checked-out repo (this workspace):

```bash
cd /home/paul/src/rps
git pull
sudo ./bin/deploy-docker
```

What it does:

- `rsync` code to `/var/www/rps.pan2.app/` (preserves `.env.production`, `data/`, `logs/`, `backups/`)
- Creates a pre-deploy DB backup (if `data/planning.db` exists)
- Builds the image via `docker compose -f docker-compose.prod.yml build`
- Installs/updates systemd unit as `rps.service`
- Starts the Compose stack (Redis + RPS)
- Health checks `http://127.0.0.1:5137/health`

## Manage

```bash
sudo systemctl status rps.service
sudo docker compose -f /var/www/rps.pan2.app/docker-compose.prod.yml ps
sudo docker compose -f /var/www/rps.pan2.app/docker-compose.prod.yml logs --tail=200 rps
```

## Rollback (Fast)

1. Stop containers:

```bash
sudo docker compose -f /var/www/rps.pan2.app/docker-compose.prod.yml down
```

2. Restore the DB from `/var/www/rps.pan2.app/backups/` (pick the most recent `*_pre_docker.db` or other known-good backup), then bring the stack back up:

```bash
sudo docker compose -f /var/www/rps.pan2.app/docker-compose.prod.yml up -d
```

## Common Failure: Port 5137 Already In Use

If `docker compose up` fails to publish `127.0.0.1:5137`, check both Docker daemons:

```bash
# Rootful docker (production)
sudo docker ps --format "table {{.Names}}\t{{.Ports}}"

# Rootless docker (if present on the host)
DOCKER_HOST=unix:///run/user/1000/docker.sock docker ps --format "table {{.Names}}\t{{.Ports}}" || true

sudo ss -ltnp | rg ":5137" || true
```

Only one stack can bind `127.0.0.1:5137`.

