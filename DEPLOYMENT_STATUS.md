# Deployment Status Summary

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

Run the fix script to install the missing package:

```bash
/tmp/fix_rps.sh
```

Or manually:

```bash
sudo systemctl stop rps
sudo -H -u www-data /var/www/rps.pan2.app/venv/bin/pip install user-agents
sudo mkdir -p /var/www/rps.pan2.app/.config/matplotlib
sudo chown -R www-data:www-data /var/www/rps.pan2.app/.config
sudo systemctl start rps
sudo systemctl status rps
curl http://localhost:5137/health
```

## After Fix is Applied

Once the service is running:

1. Configure environment variables:
   ```bash
   sudo cp /var/www/rps.pan2.app/.env.production.example /var/www/rps.pan2.app/.env
   sudo nano /var/www/rps.pan2.app/.env
   ```

   Set:
   - `SECRET_KEY` - Random secret for Flask sessions
   - `ENCRYPTION_KEY` - Generate with: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
   - `CORS_ORIGINS` - Set to `https://rps.pan2.app`

2. Restart after env configuration:
   ```bash
   sudo systemctl restart rps
   ```

3. Configure Cloudflare Tunnel to point to `http://localhost:8087`

## Verification

Test the deployment:

```bash
# Check service status
sudo systemctl status rps

# Test direct Flask endpoint
curl http://localhost:5137/health

# Test Apache proxy
curl http://localhost:8087/health

# View logs
tail -f /var/www/rps.pan2.app/logs/rps.log
sudo journalctl -u rps -f
```

## Architecture

```
[Cloudflare Tunnel]
        ↓
[Apache:8087] ← Configure tunnel to point here
        ↓
[Flask:5137] ← Internal application
```

## Files Created

- `/var/www/rps.pan2.app/` - Application directory
- `/etc/apache2/sites-available/rps.pan2.app.conf` - Apache config
- `/etc/systemd/system/rps.service` - Systemd service
- `~/src/rps/bin/deploy` - Deployment automation script
- `~/src/rps/DEPLOYMENT.md` - Full deployment guide
- `~/src/rps/docs/API_KEY_SECURITY.md` - Security documentation

## Future Deployments

For future updates, just run:

```bash
cd ~/src/rps
git pull
sudo ./bin/deploy
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
sudo journalctl -u rps -n 50
tail -50 /var/www/rps.pan2.app/logs/rps-error.log
```

If database errors:
```bash
cd /var/www/rps.pan2.app
sudo -u www-data ./venv/bin/alembic upgrade head
```

## Contact

For issues, check:
- GitHub: https://github.com/nyepaul/rps
- Logs: `/var/www/rps.pan2.app/logs/`
- Service status: `sudo systemctl status rps`
