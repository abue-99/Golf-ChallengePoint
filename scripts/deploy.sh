#!/usr/bin/env bash
# =============================================================================
# deploy.sh – Production deployment script for Golf ChallengePoint
#
# This script is the canonical way to deploy (or redeploy) the stack on the
# production server.  It intentionally runs a password-sync step BEFORE
# starting the API/web containers so that a stale postgres_data volume never
# causes a P1000 "password authentication failed" error.
#
# Why this is necessary
# ---------------------
# PostgreSQL only reads POSTGRES_PASSWORD when the data directory is first
# initialised.  If the volume already exists (e.g. after `docker compose down`
# without -v), the env-var is silently ignored and the old password stays in
# the volume.  Any mismatch between the stored password and DATABASE_URL
# produces error P1000 / Postgres error 28P01.
#
# This script starts postgres alone first, syncs the password inside the
# running container (using the local trust/peer auth that works without
# knowing the old password), then brings up the rest of the stack.
#
# Usage
# -----
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh              # deploy with current .env
#   ./scripts/deploy.sh --skip-pull  # skip git pull (e.g. on a dev box)
#
# Requirements: docker (with compose plugin), git
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"
COMPOSE="docker compose -f $REPO_DIR/docker-compose.yml"

SKIP_PULL=false
for arg in "$@"; do
  [[ "$arg" == "--skip-pull" ]] && SKIP_PULL=true
done

# Helper: read and strip quotes from a variable in the .env file
# Usage: read_env_var KEY [DEFAULT]
read_env_var() {
  local key="$1"
  local default="${2:-}"
  local value
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  echo "${value:-$default}"
}

echo ""
echo "======================================================"
echo "  Golf ChallengePoint – production deploy"
echo "  Repo: $REPO_DIR"
echo "======================================================"
echo ""

# ------------------------------------------------------------------------------
# 0. Pre-flight checks
# ------------------------------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found."
  echo "       Copy .env.example to .env and fill in real secrets first."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is not installed or not on PATH."
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. Pull latest code (skip with --skip-pull)
# ------------------------------------------------------------------------------
if [ "$SKIP_PULL" = false ]; then
  echo ">>> [1/5] Pulling latest code ..."
  git -C "$REPO_DIR" fetch origin
  git -C "$REPO_DIR" pull --ff-only
  echo "    Done."
else
  echo ">>> [1/5] Skipping git pull (--skip-pull)"
fi

# ------------------------------------------------------------------------------
# 2. Start postgres only and wait for it to be healthy
# ------------------------------------------------------------------------------
echo ""
echo ">>> [2/5] Starting postgres ..."
$COMPOSE up -d postgres

echo "    Waiting for postgres to be ready ..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until $COMPOSE exec -T postgres pg_isready -U "${POSTGRES_USER:-postgres}" -d challengepoint &>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "    ERROR: Postgres did not become ready after ${MAX_ATTEMPTS}s."
    echo "    Recent postgres logs:"
    $COMPOSE logs postgres | tail -30
    exit 1
  fi
  sleep 1
done
echo "    Postgres is ready."

# ------------------------------------------------------------------------------
# 3. Sync the password stored in the volume with the current POSTGRES_PASSWORD
#
#    This is the key step that prevents P1000 / 28P01 on re-deployments.
#    We connect via the local Unix socket inside the container which uses
#    trust/peer auth (no password required), so it works even when the stored
#    password doesn't match the env-var.
# ------------------------------------------------------------------------------
echo ""
echo ">>> [3/5] Syncing postgres password ..."

# Read POSTGRES_USER and POSTGRES_PASSWORD from .env
POSTGRES_USER_VAL="$(read_env_var POSTGRES_USER postgres)"
POSTGRES_PASSWORD_VAL="$(read_env_var POSTGRES_PASSWORD)"

if [ -z "$POSTGRES_PASSWORD_VAL" ]; then
  echo "    ERROR: POSTGRES_PASSWORD is not set in $ENV_FILE."
  exit 1
fi

# Escape single quotes for SQL (replace ' with '')
ESCAPED_PASSWORD="${POSTGRES_PASSWORD_VAL//\'/\'\'}"

$COMPOSE exec -T postgres \
  psql -U "$POSTGRES_USER_VAL" -d postgres \
  -c "ALTER USER \"$POSTGRES_USER_VAL\" PASSWORD '$ESCAPED_PASSWORD';" \
  > /dev/null

echo "    Password synced for user '$POSTGRES_USER_VAL'."

# ------------------------------------------------------------------------------
# 4. Bring up the full stack
# ------------------------------------------------------------------------------
echo ""
echo ">>> [4/5] Starting full stack ..."
$COMPOSE up -d
echo "    Stack is up."

# ------------------------------------------------------------------------------
# 5. Show service status
# ------------------------------------------------------------------------------
echo ""
echo ">>> [5/5] Service status:"
$COMPOSE ps
echo ""
echo "======================================================"
echo "  Deployment complete."
echo "  Logs: docker compose logs -f"
echo "======================================================"
