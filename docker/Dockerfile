FROM python:3.11-slim

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install the same dependency set used by production deploys.
COPY config/requirements.txt /app/config/requirements.txt
RUN pip install --no-cache-dir -r /app/config/requirements.txt

COPY config/ /app/config/
COPY migrations/ /app/migrations/
COPY scripts/ /app/scripts/
COPY src/ /app/src/
COPY skills/ /app/skills/
COPY docker/entrypoint.sh /app/docker/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/docker/entrypoint.sh

# Create data directory and set ownership
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

WORKDIR /app

# Set PYTHONPATH to include the /app directory for module resolution
ENV PYTHONPATH=/app

EXPOSE 5137

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import os,urllib.request; p=os.environ.get('PORT','5137'); urllib.request.urlopen(f'http://127.0.0.1:{p}/health', timeout=3).read(); print('ok')" || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
