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

COPY src/ /app/src/
COPY skills/ /app/skills/

# Create data directory and set ownership
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

WORKDIR /app

# Set PYTHONPATH to include the /app directory for module resolution
ENV PYTHONPATH=/app

EXPOSE 5137

CMD ["python", "src/app.py"]
