#!/bin/bash

cd /home/claude/pan-rps/webapp

docker build -t retirement-planning .

docker run -d \
    --name retirement-planner \
    -p 8080:8080 \
    -v $(pwd)/data:/app/data \
    retirement-planning

echo "Application started on http://127.0.0.1:8080"
echo "Opening index.html to access the interface"
echo ""
echo "To stop: docker stop retirement-planner"
echo "To view logs: docker logs -f retirement-planner"
