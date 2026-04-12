#!/usr/bin/env bash
# =============================================================================
# deploy.sh – Production deployment script for Golf ChallengePoint
#
# Pulls the latest code and restarts the stack against the managed Postgres
# database configured in DATABASE_URL.  No local Postgres container is
# started or managed by this script.
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
  echo "       Copy .env.example to .env and set DATABASE_URL to your managed DB connection string."
  exit 1
fi

if ! command -v docker &>/dev/null; then
  echo "ERROR: docker is not installed or not on PATH."
  exit 1
fi

DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is not set in $ENV_FILE."
  echo "       Add your managed Postgres connection string (e.g. from Neon or Supabase)."
  exit 1
fi

# ------------------------------------------------------------------------------
# 1. Pull latest code (skip with --skip-pull)
# ------------------------------------------------------------------------------
if [ "$SKIP_PULL" = false ]; then
  echo ">>> [1/3] Pulling latest code ..."
  git -C "$REPO_DIR" fetch origin
  git -C "$REPO_DIR" pull --ff-only
  echo "    Done."
else
  echo ">>> [1/3] Skipping git pull (--skip-pull)"
fi

# ------------------------------------------------------------------------------
# 2. Bring up the full stack
# ------------------------------------------------------------------------------
echo ""
echo ">>> [2/3] Starting full stack ..."
$COMPOSE up -d
echo "    Stack is up."

# ------------------------------------------------------------------------------
# 3. Show service status
# ------------------------------------------------------------------------------
echo ""
echo ">>> [3/3] Service status:"
$COMPOSE ps
echo ""
echo "======================================================"
echo "  Deployment complete."
echo "  Logs: docker compose logs -f"
echo "======================================================"
