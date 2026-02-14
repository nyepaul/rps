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
SEED_DEMO="${RPS_SEED_DEMO:-true}"
DROP_PRIVS="${RPS_DROP_PRIVS:-true}"
INIT_MARKER="${RPS_INIT_MARKER:-/app/data/.rps_initialized_v1}"
AUTO_SECRETS="${RPS_AUTO_SECRETS:-true}"

export MPLCONFIGDIR="${MPLCONFIGDIR:-/tmp/matplotlib}"

# Basic preflight: ensure key directories exist (volumes may be mounted empty).
mkdir -p /app/data /app/logs /app/backups "${MPLCONFIGDIR}" /app/data/.secrets
chmod 700 /app/data/.secrets 2>/dev/null || true

# Always point scripts at the docker DB path (can be overridden).
export RPS_DB_PATH="${RPS_DB_PATH:-/app/data/planning.db}"
export DATABASE_PATH="${DATABASE_PATH:-${RPS_DB_PATH}}"

_gen_secret() {
  # URL-safe random secret (roughly 64+ chars).
  python - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
}

_ensure_env_secret() {
  # Usage: _ensure_env_secret ENVVAR /path/to/file
  # If ENVVAR is set, keep it. Otherwise load from file; if missing, generate and persist.
  var="$1"
  file="$2"

  # POSIX sh doesn't support ${!var}; handle explicitly below.
  case "$var" in
    SECRET_KEY)
      if [ -n "${SECRET_KEY:-}" ]; then
        if [ ! -f "$file" ]; then
          umask 077
          printf "%s" "${SECRET_KEY}" >"$file"
          chmod 600 "$file" 2>/dev/null || true
        fi
        return 0
      fi
      ;;
    ENCRYPTION_KEY)
      if [ -n "${ENCRYPTION_KEY:-}" ]; then
        if [ ! -f "$file" ]; then
          umask 077
          printf "%s" "${ENCRYPTION_KEY}" >"$file"
          chmod 600 "$file" 2>/dev/null || true
        fi
        return 0
      fi
      ;;
    BACKUP_KEY_PEPPER)
      if [ -n "${BACKUP_KEY_PEPPER:-}" ]; then
        if [ ! -f "$file" ]; then
          umask 077
          printf "%s" "${BACKUP_KEY_PEPPER}" >"$file"
          chmod 600 "$file" 2>/dev/null || true
        fi
        return 0
      fi
      ;;
    *)
      echo "[rps] ERROR: unsupported secret var: $var" >&2
      exit 2
      ;;
  esac

  if [ -f "$file" ]; then
    val="$(cat "$file")"
  else
    umask 077
    val="$(_gen_secret)"
    printf "%s" "$val" >"$file"
    chmod 600 "$file" 2>/dev/null || true
  fi

  case "$var" in
    SECRET_KEY) export SECRET_KEY="$val" ;;
    ENCRYPTION_KEY) export ENCRYPTION_KEY="$val" ;;
    BACKUP_KEY_PEPPER) export BACKUP_KEY_PEPPER="$val" ;;
  esac
}

if [ "${AUTO_SECRETS}" = "true" ]; then
  # One-command installs: auto-generate secrets on first boot (persisted in the data volume).
  _ensure_env_secret SECRET_KEY /app/data/.secrets/SECRET_KEY
  _ensure_env_secret ENCRYPTION_KEY /app/data/.secrets/ENCRYPTION_KEY
  # Used by email-based recovery flows. Not required for a basic localhost install, but generating avoids
  # runtime errors if a user explores backup/recovery features.
  _ensure_env_secret BACKUP_KEY_PEPPER /app/data/.secrets/BACKUP_KEY_PEPPER
else
  if [ -z "${SECRET_KEY:-}" ] || [ -z "${ENCRYPTION_KEY:-}" ]; then
    echo "[rps] ERROR: SECRET_KEY and ENCRYPTION_KEY must be set (RPS_AUTO_SECRETS=false)." >&2
    exit 2
  fi
fi

# If we're root, fix volume permissions so we can drop privileges safely.
if [ "$(id -u)" -eq 0 ]; then
  chown -R appuser:appuser /app/data /app/logs /app/backups "${MPLCONFIGDIR}" 2>/dev/null || true
fi

echo "[rps] running migrations (alembic)..."
if [ "${STRICT_MIGRATIONS}" = "true" ]; then
  python -m alembic -c config/alembic.ini upgrade head
else
  python -m alembic -c config/alembic.ini upgrade head || true
fi

# Seed demo data on first boot (docker-only installs).
if [ "${SEED_DEMO}" = "true" ] && [ ! -f "${INIT_MARKER}" ]; then
  echo "[rps] first boot detected; seeding demo data..."
  # Alembic should have created the DB; seed script will refuse to run if DB is missing.
  python /app/scripts/seed_demo_data.py
  umask 022
  touch "${INIT_MARKER}"
  echo "[rps] demo seed complete"
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
if [ "${DROP_PRIVS}" = "true" ] && command -v gosu >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
  exec gosu appuser:appuser gunicorn \
    -w "${WORKERS}" \
    --threads "${THREADS}" \
    --timeout "${TIMEOUT}" \
    -b "${HOST}:${PORT}" \
    --access-logfile - \
    --error-logfile - \
    src.wsgi:app
else
  exec gunicorn \
    -w "${WORKERS}" \
    --threads "${THREADS}" \
    --timeout "${TIMEOUT}" \
    -b "${HOST}:${PORT}" \
    --access-logfile - \
    --error-logfile - \
    src.wsgi:app
fi
