# Quick fix script for deployed RPS instance

echo "=== Fixing RPS Deployment ==="

# 1. Install user-agents in the venv
echo "Stopping rps service..."
sudo systemctl stop rps

echo "Installing user-agents..."
sudo -u www-data /var/www/rps.pan2.app/venv/bin/pip install user-agents>=2.2.0

# 2. Fix matplotlib config directory
echo "Fixing matplotlib config..."
sudo mkdir -p /var/www/rps.pan2.app/.config/matplotlib
sudo chown -R www-data:www-data /var/www/rps.pan2.app/.config

# 3. Update systemd service to use the venv python
echo "Updating systemd service..."
sudo tee /etc/systemd/system/rps.service > /dev/null << 'EOF'
[Unit]
Description=RPS - Retirement and Wealth Planning System
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/rps.pan2.app
Environment="PATH=/var/www/rps.pan2.app/venv/bin"
Environment="MPLCONFIGDIR=/var/www/rps.pan2.app/.config/matplotlib"
ExecStart=/var/www/rps.pan2.app/venv/bin/python /var/www/rps.pan2.app/run_server.py
Restart=always
RestartSec=10
StandardOutput=append:/var/www/rps.pan2.app/logs/rps.log
StandardError=append:/var/www/rps.pan2.app/logs/rps-error.log

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd..."
sudo systemctl daemon-reload

echo "Starting rps service..."
sudo systemctl start rps

echo "Checking status..."
sleep 2
sudo systemctl status rps --no-pager | head -15

echo "Checking logs..."
tail -20 /var/www/rps.pan2.app/logs/rps-error.log
