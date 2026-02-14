# Portable Install (Docker Image + Docker Compose)

RPS runs as a **Linux container**. On:
- **macOS/Windows**: Docker Desktop runs Linux containers inside a lightweight VM.
- **Linux**: Docker Engine runs Linux containers directly.

This means the *same* RPS image can run on macOS, Windows, and Linux.

## Online Install (Pull From Registry)

Default image:
- `ghcr.io/nyepaul/rps:latest`

If you have a specific version (example `ghcr.io/nyepaul/rps:3.9.299`):

```bash
docker pull ghcr.io/nyepaul/rps:<version>
RPS_IMAGE=ghcr.io/nyepaul/rps:<version> docker compose up -d
```

Then open:
- `http://127.0.0.1:5137`

## Offline Install (Image Tarball)

If you received `rps_image.tar`:

```bash
docker load -i rps_image.tar
docker tag <loaded_image_id> ghcr.io/nyepaul/rps:latest
docker compose up -d
```

If you don't want to tag, start with:

```bash
RPS_IMAGE=<your_loaded_image_name:tag> docker compose up -d
```

## First Boot Behavior (One Command)

On first boot, the container will:
1. Generate required secrets and persist them under `/app/data/.secrets/` (in the `rps_data` Docker volume)
2. Run database migrations
3. Seed the `demo` account (login: `demo` / `Demo1234`)

## Data Persistence

By default, `docker-compose.yml` uses Docker named volumes:
- `rps_data` -> `/app/data` (SQLite DB + secrets)
- `rps_logs` -> `/app/logs`
- `rps_backups` -> `/app/backups`
- `rps_redis` -> `/data`

## Windows Notes

- Use **PowerShell** or Windows Terminal.
- Use `docker compose` (Compose v2) rather than legacy `docker-compose`.
