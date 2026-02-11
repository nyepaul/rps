FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install the same dependency set used by production deploys.
COPY config/requirements.txt /app/config/requirements.txt
RUN pip install --no-cache-dir -r /app/config/requirements.txt

COPY src/ /app/src/
COPY skills/ /app/skills/

# Create data directory
RUN mkdir -p /app/data

WORKDIR /app/src

EXPOSE 5137

CMD ["python", "app.py"]
