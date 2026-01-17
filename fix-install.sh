#!/bin/bash

# Quick fix script for deployed RPS instance

echo "=== Fixing RPS Deployment ==="

# 1. Install user-agents in the venv
echo "Stopping rps service..."
sudo systemctl stop rps

echo "Installing user-agents..."
sudo -H -u www-data /var/www/rps.pan2.app/venv/bin/pip install user-agents

# Verify
sudo -u www-data /var/www/rps.pan2.app/venv/bin/pip show user-agents

# 2. Fix matplotlib config directory
echo "Fixing matplotlib config..."
sudo mkdir -p /var/www/rps.pan2.app/.config/matplotlib
sudo chown -R www-data:www-data /var/www/rps.pan2.app/.config

# 3. Restart Service
echo "Starting rps service..."
sudo systemctl start rps

# 4. Check Status
echo "Checking status..."
sleep 2
sudo systemctl status rps --no-pager | head -20

echo "Checking logs..."
tail -10 /var/www/rps.pan2.app/logs/rps-error.log 2>/dev/null || echo "No errors yet"
