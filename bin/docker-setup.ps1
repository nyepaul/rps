$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

& (Join-Path $PSScriptRoot "install-app.ps1")
