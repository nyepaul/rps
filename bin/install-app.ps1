$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

$hostPort = if ($env:RPS_HOST_PORT) { $env:RPS_HOST_PORT } else { "5137" }

function Test-Command($Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Wait-ForDocker($TimeoutSeconds = 120) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      docker info | Out-Null
      docker compose version | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  throw "Docker is not ready yet. Start Docker Desktop and rerun the script."
}

function Install-DockerDesktop {
  if (Test-Command "winget") {
    Write-Host "[install:RPS] installing Docker Desktop with winget"
    winget install --id Docker.DockerDesktop --exact --accept-package-agreements --accept-source-agreements
    return
  }
  if (Test-Command "choco") {
    Write-Host "[install:RPS] installing Docker Desktop with Chocolatey"
    choco install docker-desktop -y
    return
  }
  throw "Docker Desktop is missing and neither winget nor choco is available to install it."
}

try {
  docker compose version | Out-Null
  docker info | Out-Null
} catch {
  Install-DockerDesktop
  Start-Process "Docker Desktop" -ErrorAction SilentlyContinue | Out-Null
  Wait-ForDocker
}

$envFile = Join-Path (Get-Location) ".env"
if (Test-Path $envFile) {
  Write-Host "[install:RPS] detected .env for compose interpolation overrides"
} else {
  Write-Host "[install:RPS] no .env found; container will auto-generate secrets into Docker volumes on first boot"
}

Write-Host "[install:RPS] pulling application images"
docker compose pull

Write-Host "[install:RPS] starting services on http://127.0.0.1:$hostPort"
docker compose up -d

Write-Host "[install:RPS] install complete"
Write-Host "Next:"
Write-Host "  - View logs: docker compose logs -f rps"
Write-Host "  - Stop:      docker compose down"
