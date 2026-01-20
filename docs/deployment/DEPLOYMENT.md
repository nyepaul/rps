# Deployment Guide for RPS

This guide covers deploying RPS to Apache2 with Cloudflare Tunnel.

## Prerequisites

- Apache2 installed with mod_proxy and mod_proxy_http enabled
- Python 3.8+ installed
- Cloudflare Tunnel configured for rps.pan2.app
- Root/sudo access

## Quick Deployment

1. **Generate Encryption Key** (required for production):
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

2. **Run the deployment script**:
```bash
cd ~/src/rps
sudo ./bin/deploy
```

This will:
- Copy the application to `/var/www/rps.pan2.app/`
- Install Python dependencies in a virtual environment
- Configure Apache2 with proxy settings
- Create and start a systemd service
- Set proper file permissions

3. **Configure Environment Variables**:
```bash
sudo cp /var/www/rps.pan2.app/.env.production.example /var/www/rps.pan2.app/.env
sudo nano /var/www/rps.pan2.app/.env
```

Set the following:
- `SECRET_KEY` - Random secret for Flask sessions (generate a long random string)
- `ENCRYPTION_KEY` - From step 1 (REQUIRED for data encryption at rest)
- `CORS_ORIGINS` - Set to `https://rps.pan2.app` for production

**Note**: API keys for AI services (Gemini/Claude) are NOT configured here. Each user provides their own API keys through the Settings page in the application. The keys are encrypted using AES-256-GCM and stored per-user in the Profile database record.

4. **Restart the service**:
```bash
sudo systemctl restart rps
```

## Architecture

The deployment uses:
- **Flask App**: Runs on localhost:5137 (managed by systemd)
- **Apache2**: Listens on port 8087 and proxies to Flask on 5137
- **Cloudflare Tunnel**: Routes external traffic from https://rps.pan2.app to Apache on localhost:8087

```
[Cloudflare] -> [Apache2:8087] -> [Flask App:5137]
```

**Important**: Configure your Cloudflare Tunnel to point to `http://localhost:8087`

## Files and Directories

- `/var/www/rps.pan2.app/` - Application directory
- `/etc/apache2/sites-available/rps.pan2.app.conf` - Apache config
- `/etc/systemd/system/rps.service` - Systemd service
- `/var/www/rps.pan2.app/logs/` - Application logs
- `/var/www/rps.pan2.app/data/` - SQLite database

## Useful Commands

### Service Management
```bash
sudo systemctl status rps      # Check service status
sudo systemctl restart rps     # Restart service
sudo systemctl stop rps        # Stop service
sudo systemctl start rps       # Start service
sudo journalctl -u rps -f      # Follow service logs
```

### Application Logs
```bash
tail -f /var/www/rps.pan2.app/logs/rps.log
tail -f /var/www/rps.pan2.app/logs/rps-error.log
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
cd ~/src/rps
sudo ./bin/deploy
```

## Database Management

The SQLite database is located at `/var/www/rps.pan2.app/data/planning.db`

### Backup
```bash
sudo -u www-data sqlite3 /var/www/rps.pan2.app/data/planning.db ".backup /var/www/rps.pan2.app/backups/backup-$(date +%Y%m%d-%H%M%S).db"
```

### Migrations
If database schema changes are needed:
```bash
cd /var/www/rps.pan2.app
sudo -u www-data ./venv/bin/alembic upgrade head
```

## Security Considerations

1. **Encryption Key**: Never commit `.env` to git. Keep `ENCRYPTION_KEY` secure - it protects all user data.
2. **File Permissions**: Application runs as `www-data` user with restricted permissions
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
sudo journalctl -u rps -n 50 --no-pager
```

### Apache errors
```bash
sudo apache2ctl configtest
tail -50 /var/log/apache2/rps-error.log
```

### Permission errors
```bash
sudo chown -R www-data:www-data /var/www/rps.pan2.app
sudo chmod -R 755 /var/www/rps.pan2.app
sudo chmod -R 775 /var/www/rps.pan2.app/data
sudo chmod -R 775 /var/www/rps.pan2.app/logs
```

### Database locked errors
```bash
# Stop the service, check for stale locks
sudo systemctl stop rps
sudo rm -f /var/www/rps.pan2.app/data/*.db-shm
sudo rm -f /var/www/rps.pan2.app/data/*.db-wal
sudo systemctl start rps
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
2. Run tests: `cd ~/src/rps && pytest`
3. Deploy: `sudo ./bin/deploy`

The deployment script automatically:
- Backs up and updates files
- Restarts the service
- Reloads Apache configuration
