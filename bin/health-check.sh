#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/rps.pan2.app"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/health-check.log"
DOCKER_HOST_VALUE="unix:///run/user/1000/docker.sock"
COMPOSE_FILE="$APP_DIR/docker-compose.prod.rootless.yml"

mkdir -p "$LOG_DIR"

log() {
  local line
  line=$(printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*")
  printf '%s\n' "$line"
  if [[ -w "$LOG_FILE" ]] || [[ ! -e "$LOG_FILE" && -w "$LOG_DIR" ]]; then
    printf '%s\n' "$line" >> "$LOG_FILE" 2>/dev/null || true
  fi
}

run_compose_as_paul() {
  if [[ "$EUID" -eq 0 ]]; then
    runuser -u paul -- env DOCKER_HOST="$DOCKER_HOST_VALUE" docker compose -f "$COMPOSE_FILE" "$@"
  else
    env DOCKER_HOST="$DOCKER_HOST_VALUE" docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

restart_system_service() {
  local service="$1"
  log "Attempting to restart $service..."
  systemctl restart "$service"
  sleep 3
  if systemctl is-active --quiet "$service"; then
    log "SUCCESS: $service restarted successfully"
    return 0
  fi
  log "ERROR: $service did not recover after restart"
  return 1
}

check_http() {
  local label="$1"
  local url="$2"
  if curl -fsS --max-time 10 "$url" >/dev/null; then
    log "SUCCESS: $label reachable at $url"
    return 0
  fi
  log "WARN: $label check failed for $url"
  return 1
}

main() {
  local failures=0

  log "=== Starting Health Check ==="

  if [[ "$EUID" -eq 0 ]] && systemctl is-active --quiet rps.service; then
    log "SUCCESS: rps.service is active"
  elif [[ "$EUID" -ne 0 ]]; then
    log "WARN: skipping systemd service checks because this script is not running as root"
  else
    log "ERROR: rps.service is not running"
    restart_system_service rps.service || failures=1
  fi

  if [[ "$EUID" -eq 0 ]] && systemctl is-active --quiet apache2.service; then
    log "SUCCESS: apache2.service is active"
  elif [[ "$EUID" -eq 0 ]]; then
    log "ERROR: apache2.service is not running"
    restart_system_service apache2.service || failures=1
  fi

  if run_compose_as_paul ps --status running | grep -q "rpspan2app-rps-1"; then
    log "SUCCESS: RPS container is running"
  else
    log "ERROR: RPS container is not running"
    log "Attempting to recover container stack..."
    if run_compose_as_paul up -d --remove-orphans; then
      sleep 5
      if run_compose_as_paul ps --status running | grep -q "rpspan2app-rps-1"; then
        log "SUCCESS: RPS container recovered"
      else
        log "ERROR: RPS container still not running after compose restart"
        failures=1
      fi
    else
      log "ERROR: docker compose recovery failed"
      failures=1
    fi
  fi

  check_http "RPS app" "http://127.0.0.1:5137/health" || true
  check_http "Apache proxy" "http://127.0.0.1:8087/health" || true
  check_http "External site" "https://rps.pan2.app/api/health" || true

  if [[ "$failures" -eq 0 ]]; then
    log "SUCCESS: All required checks passed"
    return 0
  fi

  log "ERROR: Health check completed with failures"
  return 1
}

main "$@"
