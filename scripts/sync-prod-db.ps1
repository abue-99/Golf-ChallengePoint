<#
.SYNOPSIS
  Copies the production database into the local Docker Postgres (golf_db).

.DESCRIPTION
  1. Connects to the production server via SSH, reads DATABASE_URL from the
     running API container and creates a dump with pg_dump (in a temporary
     Docker container on the server, so nothing has to be installed there).
     The company network does not need access to Neon - only SSH to the server.
  2. Downloads the dump via scp and deletes it on the server.
  3. Replaces the local database with the dump and restarts the local stack.

  Afterwards you can log in locally with your normal production credentials.
  Production is only READ, never modified.

  The dump contains personal data (names, emails, password hashes). It is
  stored in .localdb/ (git-ignored) and deleted after the restore unless
  -KeepDump is given.

.EXAMPLE
  .\scripts\sync-prod-db.ps1
  .\scripts\sync-prod-db.ps1 -Server root@178.104.48.239 -KeepDump
  .\scripts\sync-prod-db.ps1 -SkipDownload   # re-import the kept dump
#>
param(
  [string]$Server = "root@178.104.48.239",
  [string]$ApiContainer = "golf_api",
  [switch]$KeepDump,
  [switch]$SkipDownload
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
$dumpDir = Join-Path $repo ".localdb"
$dumpFile = Join-Path $dumpDir "prod.dump"
$remoteDump = "/tmp/challengepoint-prod.dump"

function Fail([string]$message) {
  Write-Host ""
  Write-Host "ERROR: $message" -ForegroundColor Red
  exit 1
}

function Step([string]$message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

# Same placeholder logic as local-up.ps1 (DATABASE_URL is required by compose).
$envFile = Join-Path $repo ".env"
$hasDbUrl = (Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^\s*DATABASE_URL=' -Quiet)
if (-not $hasDbUrl -and -not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://unused:unused@localhost:5432/unused"
}

New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null

if (-not $SkipDownload) {
  # --- 1. Create dump on the production server --------------------------------
  Step "Creating dump on $Server (read-only) ..."

  # Runs on the server (bash). Uses the direct (non-pooler) Neon endpoint,
  # because pg_dump does not work reliably through the connection pooler.
  $remoteScript = @"
set -e
URL=`$(docker exec $ApiContainer printenv DATABASE_URL)
if [ -z "`$URL" ]; then echo "DATABASE_URL not found in container $ApiContainer" >&2; exit 1; fi
URL=`$(printf '%s' "`$URL" | sed 's/-pooler\././')
VERSION=`$(docker run --rm -e PGURL="`$URL" postgres:17-alpine sh -c 'psql "`$PGURL" -Atc "show server_version_num"')
MAJOR=`$((VERSION / 10000))
echo "Production database: PostgreSQL `$MAJOR"
if [ "`$MAJOR" -gt 17 ]; then echo "PostgreSQL `$MAJOR is newer than the local postgres:17 image - update docker-compose.localdb.yml" >&2; exit 1; fi
umask 077
rm -f $remoteDump
docker run --rm -e PGURL="`$URL" -v /tmp:/out postgres:17-alpine sh -c 'pg_dump --no-owner --no-acl --format=custom --file=/out/challengepoint-prod.dump "`$PGURL"'
chmod 600 $remoteDump
ls -lh $remoteDump | awk '{print "Dump size: " `$5}'
"@
  # Send the script base64-encoded: avoids quoting problems and Windows line
  # endings (CRLF) breaking the bash script on the server.
  $bashScript = $remoteScript -replace "`r", ""
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bashScript))
  & ssh $Server "echo $encoded | base64 -d | bash"
  if ($LASTEXITCODE -ne 0) { Fail "Dump on the server failed (see output above)." }

  # --- 2. Download --------------------------------------------------------------
  Step "Downloading dump ..."
  & scp "${Server}:$remoteDump" "$dumpFile"
  $scpExit = $LASTEXITCODE
  & ssh $Server "rm -f $remoteDump"
  if ($scpExit -ne 0) { Fail "Download via scp failed." }
}

if (-not (Test-Path $dumpFile)) { Fail "No dump found at $dumpFile." }

# --- 3. Restore into the local database --------------------------------------
Step "Starting local database ..."
& docker @compose up -d db
if ($LASTEXITCODE -ne 0) { Fail "Could not start the local database container." }

$healthy = $false
for ($i = 0; $i -lt 40; $i++) {
  $status = & docker inspect -f "{{.State.Health.Status}}" golf_db 2>$null
  if ($status -eq "healthy") { $healthy = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $healthy) { Fail "Local database did not become healthy." }

Step "Stopping api/web so no connections block the import ..."
& docker @compose stop api web | Out-Null

Step "Replacing local database with the production copy ..."
& docker exec golf_db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS challengepoint WITH (FORCE);" -c "CREATE DATABASE challengepoint;"
if ($LASTEXITCODE -ne 0) { Fail "Could not recreate the local database." }

& docker cp "$dumpFile" golf_db:/tmp/prod.dump
if ($LASTEXITCODE -ne 0) { Fail "Could not copy the dump into the container." }

& docker exec golf_db pg_restore -U postgres -d challengepoint --no-owner --no-acl /tmp/prod.dump
$restoreExit = $LASTEXITCODE
& docker exec golf_db rm -f /tmp/prod.dump | Out-Null
if ($restoreExit -ne 0) {
  Write-Host "pg_restore reported warnings (often harmless, e.g. Neon-specific settings)." -ForegroundColor Yellow
}

$userCount = & docker exec golf_db psql -U postgres -d challengepoint -Atc "SELECT count(*) FROM users"
if ($LASTEXITCODE -ne 0 -or -not $userCount) { Fail "Import failed: table 'users' not found." }
Write-Host "Imported: $userCount users." -ForegroundColor Green

if (-not $KeepDump -and -not $SkipDownload) {
  Remove-Item $dumpFile -Force
  Write-Host "Local dump file deleted (use -KeepDump to keep it)."
}

# --- 4. Start the stack again -------------------------------------------------
Step "Starting local stack ..."
& docker @compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail "Could not start the local stack." }

Write-Host ""
Write-Host "Done. Open http://localhost:3000 and log in with your production credentials." -ForegroundColor Green
