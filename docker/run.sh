#!/bin/bash

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

docker build -f docker/Dockerfile -t retirement-planning .

docker run -d \
    --name retirement-planner \
    -p 8080:8080 \
    -v "$PROJECT_DIR/data":/app/data \
    retirement-planning

echo "Application started on http://127.0.0.1:8080"
echo ""
echo "To stop: docker stop retirement-planner"
echo "To view logs: docker logs -f retirement-planner"
