#!/bin/sh
set -eu

cd /app

PORT="${PORT:-5137}"
HOST="${HOST:-0.0.0.0}"
WORKERS="${RPS_WORKERS:-2}"
THREADS="${RPS_THREADS:-4}"
TIMEOUT="${RPS_TIMEOUT:-600}"
STRICT_MIGRATIONS="${RPS_MIGRATIONS_STRICT:-true}"
RUN_LEGACY_MIGRATIONS="${RPS_RUN_LEGACY_MIGRATIONS:-false}"

export MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/matplotlib}"

# Basic preflight: ensure key directories exist (volumes may be mounted empty).
mkdir -p /app/data /app/logs /app/backups "${MPLCONFIGDIR}"

echo "[rps] running migrations (alembic)..."
if [ "${STRICT_MIGRATIONS}" = "true" ]; then
  python -m alembic -c config/alembic.ini upgrade head
else
  python -m alembic -c config/alembic.ini upgrade head || true
fi

# Legacy/custom migrations (kept for older environments; OFF by default for docker installs).
if [ "${RUN_LEGACY_MIGRATIONS}" = "true" ]; then
  for script in scripts/apply_feedback_migration.py scripts/apply_feedback_content_migration.py scripts/add_super_admin_flag.py; do
    if [ -f "$script" ]; then
      echo "[rps] running legacy migration: $script"
      python "$script" || true
    fi
  done
fi

echo "[rps] starting gunicorn on ${HOST}:${PORT}"
exec gunicorn \
  -w "${WORKERS}" \
  --threads "${THREADS}" \
  --timeout "${TIMEOUT}" \
  -b "${HOST}:${PORT}" \
  --access-logfile - \
  --error-logfile - \
  src.wsgi:app
