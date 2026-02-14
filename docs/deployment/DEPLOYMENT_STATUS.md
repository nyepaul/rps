# Deployment Status Summary

> [!NOTE]
> This document is **historical** (pre-2026-02-14). Production now runs via **Docker Compose**.
> Use `docs/deployment/DEPLOYMENT.md` and `docs/deployment/PRODUCTION_DOCKER_DEPLOY.md`.

## Current Status: ⚠️ ACTION REQUIRED

The RPS application has been deployed to `/var/www/rps.pan2.app/` but requires one manual fix to start.

## Issue Identified

**Missing dependency**: The `user-agents` package was not in the original requirements.txt, causing the service to fail on startup.

## Fix Applied

✅ Added `user-agents>=2.2.0` to requirements.txt
✅ Added `MPLCONFIGDIR` environment variable to systemd service
✅ Created deployment script with all fixes
✅ Pushed all changes to GitHub

## Required Action

Deploy with the current Docker-based deploy script:

```bash
cd /home/paul/src/rps
git pull
sudo RPS_DOCKER_MODE=rootless ./bin/deploy-docker
```

## After Fix is Applied

Once the service is running:
- `/var/www/rps.pan2.app/.env.production` must exist (bootstrap source)
- `/var/www/rps.pan2.app/.env.production.rootless` must exist (used by rootless compose)
Both must include `SECRET_KEY` and `ENCRYPTION_KEY`.

## Verification

Test the deployment:

```bash
# Check service status
sudo systemctl status rps.service

# Test direct RPS endpoint
curl http://127.0.0.1:5137/health

# Test Apache proxy
curl http://localhost:8087/health

# View logs
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml logs --tail=200 rps
sudo journalctl -u rps.service -n 100 --no-pager
```

## Architecture

```
[Cloudflare Tunnel]
        ↓
[Apache:8087] ← Configure tunnel to point here
        ↓
[Docker publish:127.0.0.1:5137] ← Internal application
```

## Files Created

- `/var/www/rps.pan2.app/` - Application directory
- `/etc/apache2/sites-available/rps.pan2.app.conf` - Apache config
- `/etc/systemd/system/rps.service` - Systemd service
- `~/src/rps/bin/deploy-docker` - Deployment automation script
- `~/src/rps/DEPLOYMENT.md` - Full deployment guide
- `~/src/rps/docs/API_KEY_SECURITY.md` - Security documentation

## Future Deployments

For future updates, just run:

```bash
cd ~/src/rps
git pull
sudo RPS_DOCKER_MODE=rootless ./bin/deploy-docker
```

The deployment script now includes all necessary fixes.

## Security Notes

- API keys are stored per-user, encrypted in the database
- No system-wide API keys needed
- Users configure their own keys in Settings
- Database and logs directories have proper www-data ownership
- Encryption key required for production (set in .env)

## Troubleshooting

If service fails:
```bash
sudo journalctl -u rps.service -n 100 --no-pager
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml logs --tail=200 rps
```

Migrations run automatically on container start. To force-run:
```bash
DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml exec -T rps \
  python -m alembic -c config/alembic.ini upgrade head
```

## Contact

For issues, check:
- GitHub: https://github.com/nyepaul/rps
- Logs: `/var/www/rps.pan2.app/logs/`
- Service status: `sudo systemctl status rps.service`
