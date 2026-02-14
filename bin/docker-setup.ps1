$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

$hostPort = $env:RPS_HOST_PORT
if (-not $hostPort) { $hostPort = "5137" }

function Require-Cmd($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "ERROR: '$name' not found on PATH."
  }
}

Require-Cmd "docker"

try {
  docker compose version | Out-Null
} catch {
  throw "ERROR: 'docker compose' is not available (Docker Desktop / compose v2 required)."
}

$envFile = Join-Path (Get-Location) ".env"
if (Test-Path $envFile) {
  Write-Host "[setup] detected .env (optional overrides for compose interpolation)"
} else {
  Write-Host "[setup] no .env found (OK). Secrets will be auto-generated inside the container and persisted in the rps_data volume."
}

Write-Host "[setup] starting services (redis + rps) on http://127.0.0.1:$hostPort"
docker compose up -d

Write-Host "[setup] done"
Write-Host "Next:"
Write-Host "  - View logs: docker compose logs -f rps"
Write-Host "  - Stop:      docker compose down"
