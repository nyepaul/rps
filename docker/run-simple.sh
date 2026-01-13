#!/bin/bash

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR/src"

python3 -m venv venv
source venv/bin/activate

pip install -q -r requirements.txt

mkdir -p ../data

echo "Starting application on http://127.0.0.1:8080"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python app.py
