# Troubleshooting Guide

## Error: "Failed to fetch"

This error means the backend Flask server isn't running properly.

### Solution:

**Step 1: Start the server correctly**

```bash
cd rps
./bin/start
```

You should see:
```
Starting RPS (Docker Compose)...
Access the application at:
http://127.0.0.1:5137
```

**Step 2: Open in browser**

Navigate to: **http://127.0.0.1:5137** (NOT file://)

The server MUST be running for the application to work.

---

## Error: "Permission denied"

The scripts need to be executable.

### Solution:

```bash
chmod +x bin/start
chmod +x bin/manage
```

---

## Error: "docker: command not found" / Docker not running

RPS runs via Docker Compose. If Docker is missing or not running, `./bin/start` will fail.

### Solution:

1. Install Docker Desktop (Mac/Windows) or Docker Engine (Linux)
2. Start Docker
3. Retry:

```bash
./bin/start
```

---

## Error: Port 5137 already in use

Another application is using port 5137.

### Solution:

**Option 1: Stop the other application**

Find and kill the process:
```bash
sudo ss -ltnp | rg ":5137" || true
```

**Option 2: Stop any existing RPS instance (local dev)**
```bash
./bin/manage stop
./bin/start
```

**Option 3: If a rootless Docker stack is holding the port**

```bash
DOCKER_HOST=unix:///run/user/1000/docker.sock docker ps --format "table {{.Names}}\t{{.Ports}}" || true
```

---

## Application loads but shows no data

### Solution:

Click "Load Saved Profile" in the Profile tab, or enter your data manually.

---

## Analysis shows weird numbers

### Solution:

1. Check your input data in Profile tab
2. Verify pension amounts are annual values
3. Re-run analysis

---

## Can't install dependencies

### Solution:

RPS dependencies are installed inside the Docker image.

If the Docker build fails:
1. Check free disk space
2. Restart Docker
3. Rebuild:

```bash
docker compose -f docker-compose.dev.yml build --no-cache
```

---

## How to completely restart

```bash
./bin/manage stop
./bin/start
```

To reset all local Docker data (WARNING: deletes profiles):
```bash
docker compose down -v
./bin/start
```

---

## Still having issues?

1. **Check if server is running:**
   ```bash
   curl http://127.0.0.1:5137/health
   ```
   Should return: `{"status":"healthy"}`

2. **View server logs:**
   ```bash
   ./bin/manage logs
   ```

3. **Check logs directory:**
   ```bash
   cat logs/app.log
   ```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start server | `./bin/start` |
| Stop server | `./bin/manage stop` |
| Check status | `./bin/manage status` |
| Access app | http://127.0.0.1:5137 |
| Backup data | `./bin/backup` |
