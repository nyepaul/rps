FROM python:3.11-slim-bookworm AS builder

WORKDIR /build

# Build wheels in a builder layer, so we can keep the runtime image free of build tooling.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
  && rm -rf /var/lib/apt/lists/*

COPY config/requirements.txt /build/requirements.txt
RUN pip wheel --no-cache-dir -r /build/requirements.txt -w /wheels

# Install wheels into a relocatable prefix we can copy into the runtime image.
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r /build/requirements.txt --prefix=/install


FROM python:3.11-slim-bookworm

WORKDIR /app

# Create a non-root user for security. Entry point can drop privileges after init.
RUN groupadd -r appuser && useradd -r -g appuser appuser \
  && apt-get update \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*

# Copy python deps from builder; no compiler toolchain in final image.
COPY --from=builder /install /usr/local

COPY config/ /app/config/
COPY migrations/ /app/migrations/
COPY scripts/ /app/scripts/
COPY src/ /app/src/
COPY skills/ /app/skills/
COPY docker/entrypoint.sh /app/docker/entrypoint.sh

RUN chmod +x /app/docker/entrypoint.sh \
  && mkdir -p /app/data \
  && chown -R appuser:appuser /app

ENV PYTHONPATH=/app

EXPOSE 5137

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import os,urllib.request; p=os.environ.get('PORT','5137'); urllib.request.urlopen(f'http://127.0.0.1:{p}/health', timeout=3).read(); print('ok')" || exit 1

ENTRYPOINT ["/app/docker/entrypoint.sh"]
