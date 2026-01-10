#!/bin/bash

echo "==================================================="
echo "  Retirement Planning System - Starting...       "
echo "==================================================="
echo ""

cd "$(dirname "$0")/webapp"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3 and try again"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q flask flask-cors sqlalchemy numpy pandas matplotlib reportlab cryptography

# Create data directory
mkdir -p data

echo ""
echo "==================================================="
echo "  Starting Flask Server...                        "
echo "==================================================="
echo ""
echo "  Access the application at:"
echo "  http://127.0.0.1:8080"
echo ""
echo "  Press Ctrl+C to stop"
echo ""
echo "==================================================="
echo ""

# Run the application
python app.py
