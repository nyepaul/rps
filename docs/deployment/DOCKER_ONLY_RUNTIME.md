# Docker-Only Runtime (Localhost HTTP + Redis)

This document describes running RPS entirely inside Docker. This is the recommended way to run RPS on:
- macOS (Docker Desktop)
- Windows (Docker Desktop)
- Linux (Docker Engine + Docker Compose v2)

## Quick Start (Localhost)

1. Ensure Docker Desktop is running (Windows/macOS) or Docker Engine is running (Linux).
2. In the RPS directory:

```bash
docker compose up -d
```

Then open:
- `http://127.0.0.1:5137`

On first boot, the container will:
- generate required secrets (persisted in the `rps_data` Docker volume)
- run migrations
- seed the `demo` account (login: `demo` / `Demo1234`)

If you prefer a helper script:
```bash
./bin/docker-setup
```

### Stop / Restart

- Stop: `docker compose down`
- Restart: `docker compose up -d`

### Port Conflicts

If port `5137` is already in use, set a different host port:

```bash
RPS_HOST_PORT=55137 docker compose up -d
```

### Windows PowerShell

```powershell
docker compose up -d
```

## What Runs

- `rps` container: the RPS Flask app, served via `gunicorn`
- `redis` container: rate limit storage backend

The app is bound to localhost only:
- host: `127.0.0.1:5137`
- container: `0.0.0.0:5137`

## Persistence

Docker named volumes are used:
- `rps_data` -> `/app/data` (SQLite DB)
- `rps_logs` -> `/app/logs`
- `rps_backups` -> `/app/backups`
- `rps_redis` -> `/data` (Redis AOF)

## Configuration

Secrets are auto-generated (unless provided via environment) and persisted under:
- `/app/data/.secrets/` (inside the container, stored in the `rps_data` volume)

Localhost defaults are set in `docker-compose.yml`:
- `SESSION_COOKIE_SECURE=false`
- `APP_BASE_URL=http://127.0.0.1:5137`
- `RPS_REQUIRE_EMAIL_VERIFICATION=false` (so installs don't require SMTP)

## Operations

- Start: `docker compose up -d`
- Logs: `docker compose logs -f rps`
- Stop: `docker compose down`

## Image-Only Installs (No Source)

If you received an image tarball:

1. Load it:
```bash
docker load -i rps_image.tar
```

2. Tag it (optional but recommended):
```bash
docker tag <loaded_image_id> ghcr.io/nyepaul/rps:latest
```

3. Start:
```bash
docker compose up -d
```

If you prefer not to tag, set `RPS_IMAGE=<your_image_name:tag>` in your environment before starting.
