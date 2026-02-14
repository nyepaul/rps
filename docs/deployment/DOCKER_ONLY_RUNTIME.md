# Docker-Only Runtime (Localhost HTTP + Redis)

This document describes running RPS entirely inside Docker. This is the recommended way to run RPS on:
- macOS (Docker Desktop)
- Windows (Docker Desktop)
- Linux (Docker Engine + Docker Compose v2)

## Quick Start (Localhost)

1. Ensure Docker Desktop is running (Windows/macOS) or Docker Engine is running (Linux).
2. In the RPS directory:

```bash
./bin/docker-setup
```

Then open:
- `http://127.0.0.1:5137`

### Port Conflicts

If port `5137` is already in use, set a different host port:

```bash
RPS_HOST_PORT=55137 ./bin/docker-setup
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\docker-setup.ps1
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

Secrets are stored in `.env` (created by setup scripts):
- `SECRET_KEY`
- `ENCRYPTION_KEY`

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
docker tag <loaded_image_id> retirement-planning:latest
```

3. Run setup:
```bash
./bin/docker-setup
```

If you prefer not to tag, set:
- `RPS_IMAGE=<your_image_name:tag>` in your environment before running setup.
