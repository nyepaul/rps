# High Availability Configuration for RPS

This document describes the high availability (HA) measures implemented to ensure rps.pan2.app stays online 24/7.

## Overview

RPS uses a multi-layered approach to ensure continuous availability:
1. **Automatic service restart** on failures
2. **Periodic health monitoring** with automatic recovery
3. **Redundant checks** across multiple layers
4. **Rate-limited restart attempts** to prevent boot loops

## Architecture

```
[Users] → [Cloudflare Tunnel] → [Apache2:8087] → [Flask/Gunicorn:5137]
            ↑                      ↑                  ↑
            |                      |                  |
       Health Check            Restart           Restart
       Every 5min              Always            Always
```

## 1. Systemd Auto-Restart Policies

### RPS Service (`/etc/systemd/system/rps.service`)
```ini
Restart=always
RestartSec=10
```
- **Restart=always**: Service restarts on ANY failure (crash, exit, signal)
- **RestartSec=10**: Waits 10 seconds between restart attempts
- **Result**: Automatic recovery within 10 seconds of any failure

### Apache2 Service (`/etc/systemd/system/apache2.service.d/restart.conf`)
```ini
Restart=always
RestartSec=10
StartLimitIntervalSec=300
StartLimitBurst=3
```
- **Restart=always**: Restarts on any failure
- **RestartSec=10**: 10-second delay between restarts
- **StartLimitBurst=3**: Maximum 3 restart attempts within 5 minutes
- **Result**: Prevents restart loops while ensuring recovery

## 2. Health Check Monitoring

### Health Check Script (`/var/www/rps.pan2.app/bin/health-check.sh`)

Runs every 5 minutes via systemd timer to verify:
- ✓ RPS service is running
- ✓ Apache2 service is running
- ✓ Flask app responds on localhost:5137
- ✓ Apache proxy responds on localhost:8087
- ✓ External site accessible at https://rps.pan2.app

**Automatic Recovery Actions:**
- Detects stopped services → Restarts them automatically
- Logs all checks to `/var/www/rps.pan2.app/logs/health-check.log`
- Returns exit code 0 on success, 1 on any failure

### Health Check Timer (`/etc/systemd/system/rps-health-check.timer`)
```ini
OnBootSec=2min      # First run 2 minutes after boot
OnUnitActiveSec=5min # Subsequent runs every 5 minutes
```

## 3. Service Status Commands

### Check Service Status
```bash
# RPS application
sudo systemctl status rps.service

# Apache2 web server
sudo systemctl status apache2.service

# Health check timer
sudo systemctl status rps-health-check.timer
```

### View Logs
```bash
# RPS application logs
tail -f /var/www/rps.pan2.app/logs/rps.log
tail -f /var/www/rps.pan2.app/logs/rps-error.log

# Health check logs
tail -f /var/www/rps.pan2.app/logs/health-check.log

# Systemd journals
sudo journalctl -u rps.service -f
sudo journalctl -u apache2.service -f
sudo journalctl -u rps-health-check.service -f
```

### Manual Health Check
```bash
sudo /var/www/rps.pan2.app/bin/health-check.sh
```

### List Scheduled Health Checks
```bash
systemctl list-timers rps-health-check.timer
```

## 4. Recovery Time Objectives

| Failure Scenario | Detection Time | Recovery Time | Total Downtime |
|------------------|----------------|---------------|----------------|
| RPS process crash | Immediate | 10 seconds | ~10 seconds |
| Apache2 crash | Immediate | 10 seconds | ~10 seconds |
| HTTP endpoint failure | Up to 5 minutes | 10-15 seconds | 5-6 minutes max |
| Server reboot | N/A | 2-3 minutes | 2-3 minutes |

## 5. Testing Failure Recovery

### Test RPS Auto-Restart
```bash
# Kill the RPS process (simulates crash)
sudo systemctl kill rps.service -s KILL

# Wait 12 seconds
sleep 12

# Verify it restarted
sudo systemctl status rps.service
curl http://localhost:8087/
```

### Test Apache2 Auto-Restart
```bash
# Stop Apache2
sudo systemctl stop apache2.service

# Wait 12 seconds
sleep 12

# Verify it restarted
sudo systemctl status apache2.service
curl http://localhost:8087/
```

### Test Health Check
```bash
# Stop both services
sudo systemctl stop rps.service apache2.service

# Run health check manually (it will restart them)
sudo /var/www/rps.pan2.app/bin/health-check.sh

# Verify recovery
sudo systemctl status rps.service apache2.service
```

## 6. Boot Persistence

All services are enabled to start automatically on boot:
```bash
sudo systemctl is-enabled rps.service          # enabled
sudo systemctl is-enabled apache2.service      # enabled
sudo systemctl is-enabled rps-health-check.timer  # enabled
```

## 7. Monitoring and Alerts

### Current Status
View the latest health check results:
```bash
tail -20 /var/www/rps.pan2.app/logs/health-check.log
```

### Sample Log Output (Success)
```
[2026-01-22 22:14:39] === Starting Health Check ===
[2026-01-22 22:14:39] SUCCESS: All checks passed
```

### Sample Log Output (Failure + Recovery)
```
[2026-01-22 22:20:00] === Starting Health Check ===
[2026-01-22 22:20:00] ERROR: rps.service is not running
[2026-01-22 22:20:00] Attempting to restart rps.service...
[2026-01-22 22:20:05] SUCCESS: rps.service restarted successfully
[2026-01-22 22:20:08] SUCCESS: All checks passed
```

## 8. Troubleshooting

### Service won't stay running
```bash
# Check for repeated failures
sudo journalctl -u rps.service -n 50

# Check application error logs
tail -50 /var/www/rps.pan2.app/logs/rps-error.log

# Common issues:
# - Database locked: Remove .db-shm and .db-wal files
# - Port conflict: Check if another process uses port 5137
# - Permission errors: Ensure www-data owns application files
```

### Health check not running
```bash
# Verify timer is active
systemctl list-timers | grep rps-health-check

# Enable and start if needed
sudo systemctl enable --now rps-health-check.timer

# Test manually
sudo /var/www/rps.pan2.app/bin/health-check.sh
```

### Site unreachable despite healthy services
```bash
# Check Cloudflare Tunnel status (if using cloudflared)
sudo systemctl status cloudflared

# Test each layer individually
curl http://localhost:5137/    # Flask app
curl http://localhost:8087/    # Apache proxy
curl https://rps.pan2.app/     # External access
```

## 9. Maintenance Mode

If you need to temporarily disable auto-restart for maintenance:

```bash
# Disable health checks
sudo systemctl stop rps-health-check.timer

# Stop service without automatic restart
sudo systemctl stop rps.service

# Perform maintenance...

# Re-enable when done
sudo systemctl start rps.service
sudo systemctl start rps-health-check.timer
```

## 10. Summary

RPS is now configured with enterprise-grade high availability:

✅ **Automatic recovery** from crashes and failures
✅ **Proactive monitoring** every 5 minutes
✅ **Multi-layer health checks** (service, HTTP, external)
✅ **Boot-persistent** configuration
✅ **Rate-limited restarts** to prevent loops
✅ **Comprehensive logging** for debugging

**Expected uptime: 99.9%+** (less than 9 hours downtime per year)
