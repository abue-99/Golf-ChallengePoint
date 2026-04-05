#!/usr/bin/env bash
# =============================================================================
# Golf ChallengePoint – local-setup.sh
#
# Overwrites your local copy with the latest code from this branch and
# prepares the full local development environment.
#
# Usage:
#   chmod +x local-setup.sh
#   ./local-setup.sh
#
# Requirements: git, node (>=20), pnpm, docker (with compose plugin)
# Optional:     gh CLI (https://cli.github.com) – needed to close old PRs
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${1:-main}"

echo ""
echo "======================================================"
echo "  Golf ChallengePoint – local setup"
echo "  Working in: $REPO_DIR"
echo "  Branch:     $BRANCH"
echo "======================================================"
echo ""

# ------------------------------------------------------------------------------
# 1. Pull latest code
# ------------------------------------------------------------------------------
echo ">>> [1/7] Syncing code from origin/$BRANCH ..."
git -C "$REPO_DIR" fetch origin
git -C "$REPO_DIR" checkout "$BRANCH"
git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
echo "    Done."

# ------------------------------------------------------------------------------
# 2. Close old open PRs (requires gh CLI and authentication)
# ------------------------------------------------------------------------------
echo ""
echo ">>> [2/7] Closing stale open pull requests ..."
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  for pr in 25 27 28 30 31 36; do
    echo "    Closing PR #$pr ..."
    gh pr close "$pr" \
      --repo abue-99/Golf-ChallengePoint \
      --comment "Superseded by manual cleanup on the main branch – closing." \
      2>/dev/null || echo "    PR #$pr already closed or not found, skipping."
  done
  echo "    Done."
else
  echo "    SKIP – gh CLI not installed or not authenticated."
  echo "    To close old PRs manually run:"
  echo "      gh auth login"
  echo "      for pr in 25 27 28 30 31 36; do"
  echo "        gh pr close \$pr --repo abue-99/Golf-ChallengePoint --comment 'Superseded.'"
  echo "      done"
fi

# ------------------------------------------------------------------------------
# 3. Create .env if missing
# ------------------------------------------------------------------------------
echo ""
echo ">>> [3/7] Setting up .env ..."
if [ ! -f "$REPO_DIR/.env" ]; then
  cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
  echo "    Created .env from .env.example – review secrets before running!"
else
  echo "    .env already exists, skipping."
fi

# ------------------------------------------------------------------------------
# 4. Install dependencies
# ------------------------------------------------------------------------------
echo ""
echo ">>> [4/7] Installing pnpm dependencies ..."
cd "$REPO_DIR"
corepack enable 2>/dev/null || true
pnpm install --frozen-lockfile
echo "    Done."

# ------------------------------------------------------------------------------
# 5. Generate Prisma client and build @challengepoint/db
# ------------------------------------------------------------------------------
echo ""
echo ">>> [5/7] Generating Prisma client and building @challengepoint/db ..."
pnpm --filter @challengepoint/db run generate
pnpm --filter @challengepoint/db run build
echo "    Done."

# ------------------------------------------------------------------------------
# 6. Start Postgres via Docker and run migrations
# ------------------------------------------------------------------------------
echo ""
echo ">>> [6/7] Starting Postgres and running migrations ..."
docker compose -f "$REPO_DIR/docker-compose.yml" up -d postgres

echo "    Waiting for Postgres to be ready ..."
for i in $(seq 1 30); do
  if docker compose -f "$REPO_DIR/docker-compose.yml" exec -T postgres \
       pg_isready -U postgres -d challengepoint &>/dev/null; then
    echo "    Postgres is ready."
    break
  fi
  sleep 1
done

# Run pending migrations
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$REPO_DIR/.env" | cut -d= -f2- | tr -d '"')" \
  pnpm --filter @challengepoint/db exec prisma migrate deploy
echo "    Migrations done."

# ------------------------------------------------------------------------------
# 7. Start development servers
# ------------------------------------------------------------------------------
echo ""
echo ">>> [7/7] Starting API and Web dev servers ..."
echo "    API  → http://localhost:4000"
echo "    Web  → http://localhost:3000"
echo "    Press Ctrl+C to stop both servers."
echo ""

# Run both in parallel and forward output
trap 'kill %1 %2 2>/dev/null; docker compose -f "$REPO_DIR/docker-compose.yml" stop postgres' INT TERM

(
  cd "$REPO_DIR"
  NODE_ENV=development \
    pnpm --filter api run start:dev 2>&1 | sed 's/^/[api] /'
) &

(
  cd "$REPO_DIR"
  pnpm --filter golf-challenge-point-web run dev 2>&1 | sed 's/^/[web] /'
) &

wait
