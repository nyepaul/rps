FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy application files from new structure
COPY src/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ /app/src/
COPY skills/ /app/skills/

# Create data directory
RUN mkdir -p /app/data

WORKDIR /app/src

EXPOSE 5137

CMD ["python", "app.py"]
