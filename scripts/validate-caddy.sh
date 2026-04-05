#!/usr/bin/env bash
# validate-caddy.sh – Smoke-test Caddy routing for Golf ChallengePoint.
#
# Usage:
#   ./scripts/validate-caddy.sh [HOST]
#
# HOST defaults to localhost (DEV).  Pass the server IP for PROD, e.g.:
#   ./scripts/validate-caddy.sh 178.104.48.239

set -euo pipefail

HOST="${1:-localhost}"
FRONTEND_PORT=3000
API_PORT=4000

pass=0
fail=0

check() {
  local label="$1"
  local url="$2"
  local expected_status="$3"

  # curl returns empty string on connection failure; normalise to "ERROR"
  actual_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  if [ -z "$actual_status" ] || [ "$actual_status" = "000" ]; then
    actual_status="ERROR (no response)"
  fi

  if [ "$actual_status" = "$expected_status" ]; then
    echo "  ✅  $label  →  $url  ($actual_status)"
    pass=$((pass + 1))
  else
    echo "  ❌  $label  →  $url  (expected $expected_status, got $actual_status)"
    fail=$((fail + 1))
  fi
}

echo ""
echo "=== Caddy routing validation for host: $HOST ==="
echo ""

echo "--- Caddy / Next.js web ---"
check "Web root"          "http://$HOST/"              "200"

echo ""
echo "--- API via Caddy (/api/* prefix stripped) ---"
check "API health via Caddy"  "http://$HOST/api/health"   "200"

echo ""
echo "--- Direct service access ---"
check "Frontend direct ($FRONTEND_PORT)" "http://$HOST:$FRONTEND_PORT/"     "200"
check "API direct ($API_PORT)"           "http://$HOST:$API_PORT/health"    "200"

echo ""
echo "=== Results: $pass passed, $fail failed ==="
echo ""

if [ "$fail" -gt 0 ]; then
  exit 1
fi
