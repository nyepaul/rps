# Quick Fix for Deployed Instance

> [!NOTE]
> This document is **historical** (pre-2026-02-14). Production now runs via **Docker Compose** and installs dependencies in the image.
> Use `docs/deployment/PRODUCTION_DOCKER_DEPLOY.md` for current production operations.

If the service fails to start, run these commands on the server:

1. **Redeploy cleanly (recommended):**
   ```bash
   cd /home/paul/src/rps
   git pull
   sudo RPS_DOCKER_MODE=rootless ./bin/deploy-docker
   ```

2. **Check Status:**
   ```bash
   sudo systemctl status rps.service
   DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml ps
   ```

3. **Check Logs:**
   ```bash
   DOCKER_HOST=unix:///run/user/1000/docker.sock docker compose -f /var/www/rps.pan2.app/docker-compose.prod.rootless.yml logs --tail=200 rps
   sudo journalctl -u rps.service -n 100 --no-pager
   ```
