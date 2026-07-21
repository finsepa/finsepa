#!/usr/bin/env bash
# Backfill Superinvestor profile snapshots one slug at a time (avoids 300s cron timeout).
# Usage:
#   BASE_URL=https://your.app CRON_SECRET=... bash scripts/superinvestor-phase1-backfill.sh
#   BASE_URL=http://localhost:3000 CRON_SECRET=... bash scripts/superinvestor-phase1-backfill.sh
set -euo pipefail

BASE_URL="${BASE_URL:?set BASE_URL}"
CRON_SECRET="${CRON_SECRET:?set CRON_SECRET}"

SLUGS=(
  berkshire-hathaway
  bill-ackman
  terry-smith
  michael-burry
  cathie-wood
  li-lu
  charlie-munger
  chris-hohn
  primecap-management
  first-eagle
  point72
  baillie-gifford
  ken-griffin
  jeremy-grantham
  renaissance-technologies
  blackrock
  ray-dalio
  ken-fisher
)

for slug in "${SLUGS[@]}"; do
  echo "=== refreshing $slug ==="
  curl -sS --max-time 480 -H "Authorization: Bearer ${CRON_SECRET}" \
    "${BASE_URL}/api/cron/superinvestor-13f?slug=${slug}" \
    | tee "/tmp/superinvestor-backfill-${slug}.json"
  echo
done

echo "=== enrich passes on large books ==="
for slug in ken-griffin blackrock renaissance-technologies point72 ken-fisher ray-dalio; do
  echo "=== enrich $slug ==="
  curl -sS --max-time 480 -H "Authorization: Bearer ${CRON_SECRET}" \
    "${BASE_URL}/api/cron/superinvestor-13f?slug=${slug}&enrichOnly=1"
  echo
done

echo "=== done ==="
