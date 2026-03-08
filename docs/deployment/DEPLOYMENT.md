# Deployment Guide for RPS (Docker-Only)

This guide covers deploying RPS to Apache2 with Cloudflare Tunnel.

As of **2026-02-27**, RPS is intended to run **only** via Docker Compose (with Redis). Version: 3.10.13.

For the production Docker workflow, also see: `docs/deployment/PRODUCTION_DOCKER_DEPLOY.md`.

## Prerequisites

- Docker Engine + Docker Compose v2
- Apache2 installed with `mod_proxy` and `mod_proxy_http` enabled
- Cloudflare Tunnel configured for `rps.pan2.app`
- Root/sudo access

## Quick Deployment (Production)

1. Ensure production env exists:

`/var/www/rps.pan2.app/.env.production` must exist and include at least:
- `SECRET_KEY`
- `ENCRYPTION_KEY`

In rootless mode (recommended), the app loads env from `/var/www/rps.pan2.app/.env.production.rootless` (created automatically by the deploy script if missing).

2. Run the deployment script:

```bash
cd /home/paul/src/rps
sudo RPS_DOCKER_MODE=rootless ./bin/deploy-docker
```

This will:
- Sync code to `/var/www/rps.pan2.app/` (preserving `.env.production`, `.env.production.rootless`, `data/`, `logs/`, `backups/`)
- Back up the SQLite DB before the cutover (if present)
- Build the Docker image
- Start the Docker Compose stack via systemd (`rps.service`)
- Run Alembic migrations automatically on container start

**Note**: API keys for AI services (Gemini/Claude) are NOT configured at deploy time. Each user provides their own API keys through the Settings page in the application. The keys are encrypted using AES-256-GCM and stored per-user in the profile database record.

## Architecture

The deployment uses:
- **RPS container**: Flask app served by `gunicorn` on `127.0.0.1:5137` (published from Docker)
- **Redis container**: rate limiting storage for Flask-Limiter
- **Apache2**: Listens on port 8087 and proxies to Flask on 5137
- **Cloudflare Tunnel**: Routes external traffic from https://rps.pan2.app to Apache on localhost:8087

```
[Cloudflare] -> [Apache2:8087] -> [Docker published port:127.0.0.1:5137] -> [RPS container:5137]
```

**Important**: Configure your Cloudflare Tunnel to point to `http://localhost:8087`

## Files and Directories

- `/var/www/rps.pan2.app/` - Application directory
- `/etc/apache2/sites-available/rps.pan2.app.conf` - Apache config
- `/etc/systemd/system/rps.service` - Systemd unit that runs `docker compose ... up -d`
- `/var/www/rps.pan2.app/logs/` - Application logs
- `/var/www/rps.pan2.app/data/` - SQLite database

## Useful Commands

### Service Management
```bash
sudo systemctl status rps.service
sudo systemctl restart rps.service
sudo journalctl -u rps.service -f

# Container status/logs
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml ps
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml logs --tail=200 rps
```

### Application Logs
```bash
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml logs -f rps
```

### Apache Management
```bash
sudo systemctl reload apache2     # Reload Apache config
sudo apache2ctl configtest        # Test Apache config
tail -f /var/log/apache2/rps-error.log
tail -f /var/log/apache2/rps-access.log
```

### Redeployment
After making changes to the code:
```bash
cd /home/paul/src/rps
./bin/check-quality-gates
sudo RPS_DOCKER_MODE=rootless ./bin/deploy-docker
```

## Database Management

The SQLite database is located at `/var/www/rps.pan2.app/data/planning.db`

### Backup
```bash
sudo -u paul sqlite3 /var/www/rps.pan2.app/data/planning.db ".backup /var/www/rps.pan2.app/backups/backup-$(date +%Y%m%d-%H%M%S).db"
```

### Migrations
If database schema changes are needed:
```bash
Migrations run automatically on container start (see `docker/entrypoint.sh`).

To force-run migrations manually:
cd /var/www/rps.pan2.app
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f docker-compose.prod.rootless.yml exec -T rps \
  python -m alembic -c config/alembic.ini upgrade head
```

## Security Considerations

1. **Encryption Key**: Never commit `.env` files to git. Keep `ENCRYPTION_KEY` secure - it protects all user data.
2. **File Permissions**: In rootless mode, bind mounts are written by the service user (`paul`). Keep `data/`, `logs/`, and `backups/` writable by `paul`.
3. **Cloudflare Tunnel**: Provides HTTPS and DDoS protection
4. **Session Security**: Configured for secure cookies in production
5. **API Keys**: User API keys for AI services are stored per-profile, encrypted with AES-256-GCM
   - Keys are encrypted at rest with PBKDF2 key derivation (100,000 iterations)
   - Each encryption uses a random 12-byte IV
   - Keys are never exposed in logs or responses (only last 4 characters shown in UI)
   - Keys are isolated per profile and never shared between users

## Troubleshooting

### Service won't start
```bash
sudo journalctl -u rps.service -n 100 --no-pager
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml logs --tail=200 rps
```

### Apache errors
```bash
sudo apache2ctl configtest
tail -50 /var/log/apache2/rps-error.log
```

### Permission errors
```bash
# Rootless runtime needs bind mounts writable by user 'paul':
sudo chown -R paul:paul /var/www/rps.pan2.app/data /var/www/rps.pan2.app/logs /var/www/rps.pan2.app/backups
sudo chmod -R 775 /var/www/rps.pan2.app/data /var/www/rps.pan2.app/logs /var/www/rps.pan2.app/backups
```

### Database locked errors
```bash
# Stop the containers, check for stale locks
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml down
sudo rm -f /var/www/rps.pan2.app/data/*.db-shm
sudo rm -f /var/www/rps.pan2.app/data/*.db-wal
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml up -d
```

## Accessing the Application

- **Direct to Flask**: http://localhost:5137
- **Via Apache**: http://localhost:8087
- **External**: https://rps.pan2.app (via Cloudflare Tunnel)

## Cloudflare Tunnel Configuration

Configure your Cloudflare Tunnel to route traffic from `rps.pan2.app` to `http://localhost:8087`.

Example tunnel configuration:
```yaml
ingress:
  - hostname: rps.pan2.app
    service: http://localhost:8087
  - service: http_status:404
```

## Updating

1. Pull latest changes in development directory
2. Run quality gates: `cd /home/paul/src/rps && ./bin/check-quality-gates`
3. Deploy: `sudo RPS_DOCKER_MODE=rootless ./bin/deploy-docker`

The deployment script automatically:
- Backs up and updates files
- Restarts the service
- Reloads Apache configuration
