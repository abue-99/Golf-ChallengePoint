<#
.SYNOPSIS
  Starts the full stack locally with a LOCAL Postgres (no Neon connection).

.DESCRIPTION
  Merges docker-compose.yml + docker-compose.override.yml +
  docker-compose.localdb.yml, builds the images from the current branch and
  starts db, api, web and caddy. The app is then available at
  http://localhost:3000.

  The API applies pending Prisma migrations to the LOCAL database on start,
  so branches with new migrations can be tested safely.

  Fill the local database with a copy of production:
    .\scripts\sync-prod-db.ps1

.EXAMPLE
  .\scripts\local-up.ps1          # build + start
  .\scripts\local-up.ps1 -Down    # stop (data is kept)
  .\scripts\local-up.ps1 -Logs    # follow API logs
#>
param(
  [switch]$Down,
  [switch]$Logs
)

$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$compose = @(
  "compose",
  "-f", "docker-compose.yml",
  "-f", "docker-compose.override.yml",
  "-f", "docker-compose.localdb.yml"
)

# docker-compose.yml requires DATABASE_URL to be set. Locally it is replaced
# by the local database anyway, so a placeholder is enough if .env has none.
$envFile = Join-Path $repo ".env"
$hasDbUrl = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^\s*DATABASE_URL=' -Quiet)
if (-not $hasDbUrl -and -not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused"
}

if ($Down) {
  & docker @compose down
  exit $LASTEXITCODE
}

if ($Logs) {
  & docker @compose logs -f --tail 100 api
  exit $LASTEXITCODE
}

Write-Host "==> Building and starting local stack (local database) ..." -ForegroundColor Cyan
& docker @compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Start failed (exit code $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}

# Check whether the local database already contains users.
$userCount = & docker exec golf_db psql -U postgres -d challengepoint -Atc "SELECT count(*) FROM users" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $userCount -or [int]$userCount -eq 0) {
  Write-Host ""
  Write-Host "The local database is still empty." -ForegroundColor Yellow
  Write-Host "Copy production data with:  .\scripts\sync-prod-db.ps1" -ForegroundColor Yellow
} else {
  Write-Host ""
  Write-Host "Local database contains $userCount users." -ForegroundColor Green
}

Write-Host ""
Write-Host "App:       http://localhost:3000" -ForegroundColor Green
Write-Host "Database:  localhost:5433  (user postgres / password postgres / db challengepoint)"
Write-Host "API logs:  .\scripts\local-up.ps1 -Logs"
Write-Host "Stop:      .\scripts\local-up.ps1 -Down"
