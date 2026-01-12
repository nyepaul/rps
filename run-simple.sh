#!/bin/bash

cd /home/claude/pan-rps/webapp

python3 -m venv venv
source venv/bin/activate

pip install -q flask flask-cors sqlalchemy numpy pandas matplotlib reportlab cryptography

mkdir -p data

echo "Starting application on http://127.0.0.1:8080"
echo ""
echo "Access the web interface by opening:"
echo "  file://$(pwd)/index.html"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python app.py
