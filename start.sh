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
    echo "✓ Virtual environment created"
fi

# Install/upgrade dependencies using venv's pip directly
echo "Installing dependencies..."
./venv/bin/pip install --upgrade pip > /dev/null 2>&1
./venv/bin/pip install -q -r requirements.txt

# Create data directory
mkdir -p data

echo "✓ Dependencies installed"
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

# Run the application using venv's python directly
./venv/bin/python app.py
