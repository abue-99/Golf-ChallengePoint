#!/usr/bin/env bash
# =============================================================================
# fix-db-auth.sh – Fix P1000: Authentication failed against database server
#
# Use this script when the postgres container rejects the password configured
# in POSTGRES_PASSWORD.  This happens when POSTGRES_PASSWORD is changed in
# .env AFTER the postgres Docker volume was already initialised – postgres
# stores credentials in the volume and ignores the env-var on restart.
#
# The script connects to the running postgres container using peer / trust
# authentication (no password required inside the container) and runs
#   ALTER USER <user> PASSWORD '<new-password>';
# so that the stored credentials match what is configured in .env.
#
# IMPORTANT: the postgres container must be running when you execute this.
#
# Usage:
#   chmod +x scripts/fix-db-auth.sh
#   ./scripts/fix-db-auth.sh
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found.  Copy .env.example to .env and fill in values first."
  exit 1
fi

# Read variables from .env (strip surrounding quotes if present)
POSTGRES_USER_VAL="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
POSTGRES_USER_VAL="${POSTGRES_USER_VAL:-postgres}"

POSTGRES_PASSWORD_VAL="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"

if [ -z "$POSTGRES_PASSWORD_VAL" ]; then
  echo "ERROR: POSTGRES_PASSWORD is not set in $ENV_FILE."
  exit 1
fi

echo ""
echo "======================================================"
echo "  Golf ChallengePoint – DB credentials reset"
echo "  User:     $POSTGRES_USER_VAL"
echo "  Password: (read from .env)"
echo "======================================================"
echo ""

# Verify the postgres container is running
if ! docker compose -f "$REPO_DIR/docker-compose.yml" ps --status running postgres 2>/dev/null | grep -q "postgres"; then
  echo "Starting postgres container..."
  docker compose -f "$REPO_DIR/docker-compose.yml" up -d postgres
  echo "Waiting for postgres to be ready..."
  for i in $(seq 1 30); do
    if docker compose -f "$REPO_DIR/docker-compose.yml" exec -T postgres \
         pg_isready -U "$POSTGRES_USER_VAL" &>/dev/null 2>&1; then
      echo "Postgres is ready."
      break
    fi
    sleep 1
  done
fi

echo "Resetting password for user '$POSTGRES_USER_VAL' inside the postgres container..."

# Escape any single quotes in the password (SQL literal safety)
ESCAPED_PASSWORD="${POSTGRES_PASSWORD_VAL//\'/\'\'}"

# Run ALTER USER inside the container.
# Inside the container the postgres OS user has peer/trust access so no
# password is required for this psql call.
docker compose -f "$REPO_DIR/docker-compose.yml" exec -T postgres \
  psql -U "$POSTGRES_USER_VAL" -d postgres \
  -c "ALTER USER \"$POSTGRES_USER_VAL\" PASSWORD '$ESCAPED_PASSWORD';"

echo ""
echo "Done.  Password updated successfully."
echo "You can now restart the full stack:"
echo "  docker compose -f docker-compose.yml up -d"
