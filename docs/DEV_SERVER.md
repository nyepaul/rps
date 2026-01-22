# Development Server Setup

## Architecture

RPS uses a two-port architecture:

| Port | Service | Purpose |
|------|---------|---------|
| 5137 | Flask/Gunicorn | Python backend API |
| 8087 | Apache | Reverse proxy (adds security headers, serves static files) |

In production, gunicorn runs on 5137 via systemd (`rps.service`).
In development, Flask dev server runs on 5137 via `bin/start`.

Apache always listens on 8087 and proxies requests to 5137.

## Starting Development Server

```bash
./bin/start
```

This will:
- Create virtual environment if needed
- Install dependencies
- Start Flask in the background on port 5137
- Log output to `logs/dev-server.log`

## Stopping Development Server

```bash
pkill -f 'python src/app.py'
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
| Backend | `./bin/start` (Flask dev server) | `systemctl start rps` (gunicorn) |
| Frontend proxy | Apache on 8087 | Apache on 8087 |
| Logs | `logs/dev-server.log` | `/var/www/rps.pan2.app/logs/` |

## Troubleshooting

### Port 5137 already in use
```bash
# Check what's using it
lsof -i :5137

# If it's gunicorn (production), stop it first
sudo systemctl stop rps

# If it's a stale dev server
pkill -f 'python src/app.py'
```

**Note:** `./bin/start` will automatically detect if the production service is running and prompt you to stop it.

## Boot Configuration

Both services are enabled to start on boot:
```bash
# Check if enabled
systemctl is-enabled rps apache2

# Disable auto-start (if needed)
sudo systemctl disable rps

# Re-enable auto-start
sudo systemctl enable rps
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
