# Quick Fix for Deployed Instance

If the service fails to start, run these commands on the server:

1. **Install missing dependency:**
   ```bash
   sudo systemctl stop rps
   
   # Install user-agents in the venv
   sudo -H -u www-data /var/www/rps.pan2.app/venv/bin/pip install user-agents
   
   # Verify
   sudo -u www-data /var/www/rps.pan2.app/venv/bin/pip show user-agents
   ```

2. **Fix matplotlib permission issue:**
   ```bash
   sudo mkdir -p /var/www/rps.pan2.app/.config/matplotlib
   sudo chown -R www-data:www-data /var/www/rps.pan2.app/.config
   ```

3. **Restart Service:**
   ```bash
   sudo systemctl start rps
   ```

4. **Check Status:**
   ```bash
   sudo systemctl status rps
   ```

5. **Check Logs:**
   ```bash
   tail -20 /var/www/rps.pan2.app/logs/rps-error.log
   ```

   Detailed logs:
   ```bash
   sudo journalctl -u rps -n 50
   ```
