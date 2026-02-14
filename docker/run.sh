#!/bin/bash

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

docker compose -f docker-compose.dev.yml up -d --build

echo "Application started on http://127.0.0.1:5137"
echo ""
echo "To stop: docker compose -f docker-compose.dev.yml down"
echo "To view logs: docker compose -f docker-compose.dev.yml logs -f rps"
