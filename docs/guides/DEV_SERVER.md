# Development Server Setup

## Architecture

RPS uses a two-port architecture:

| Port | Service | Purpose |
|------|---------|---------|
| 5137 | Docker-published RPS (`gunicorn` inside container) | Python backend API |
| 8087 | Apache | Reverse proxy (adds security headers, serves static files) |

In production, the Docker Compose stack is started via systemd (`rps.service`) and publishes `127.0.0.1:5137`.
In development, `./bin/start` starts the Docker Compose runtime on `127.0.0.1:5137` by default.

Apache always listens on 8087 and proxies requests to 5137.

## Starting Development Server

```bash
./bin/start
```

This will:
- Create `.env` if needed
- Start Docker Compose (`rps` + `redis`)
- Publish `http://127.0.0.1:5137`

If you want a build-from-source dev runtime, use:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## Stopping Development Server

```bash
./bin/manage stop
```

## Starting/Stopping Apache (port 8087)

```bash
sudo systemctl start apache2   # Start
sudo systemctl stop apache2    # Stop
sudo systemctl status apache2  # Check status
```

## Production vs Development

| Component | Development | Production |
|-----------|-------------|------------|
| Backend | `./bin/start` (docker compose) | `sudo systemctl restart rps.service` (docker compose) |
| Frontend proxy | Apache on 8087 | Apache on 8087 |
| Logs | `docker compose logs -f rps` | `sudo docker compose -f /var/www/rps.pan2.app/docker-compose.prod.yml logs -f rps` |

## Troubleshooting

### Port 5137 already in use
```bash
# Check what's using it
sudo ss -ltnp | rg ":5137" || true

# Check rootful docker (production)
sudo docker ps --format "table {{.Names}}\t{{.Ports}}"

# Check rootless docker (if present)
DOCKER_HOST=unix:///run/user/1000/docker.sock docker ps --format "table {{.Names}}\t{{.Ports}}" || true

# Stop local dev stack
./bin/manage stop
```

Only one service can bind `127.0.0.1:5137` at a time.

## Boot Configuration

On the production host, these services are typically enabled to start on boot:
```bash
# Check if enabled
systemctl is-enabled rps.service apache2

# Disable auto-start (if needed)
sudo systemctl disable rps.service

# Re-enable auto-start
sudo systemctl enable rps.service
```

### Port 8087 not responding
```bash
# Check Apache status
sudo systemctl status apache2

# Start if not running
sudo systemctl start apache2

# Check for config errors
sudo apache2ctl configtest
```

### Verify full stack
```bash
# Backend only
curl http://127.0.0.1:5137/health

# Through Apache proxy
curl http://127.0.0.1:8087/health
```

## Access URLs

- Development: http://127.0.0.1:5137 (direct) or http://127.0.0.1:8087 (via Apache)
- Local network: http://192.168.87.50:8087 or http://nas:8087
- Production: https://rps.pan2.app
