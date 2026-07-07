#!/usr/bin/env bash
# Deploy ONLY the BTC crypto WS ingest worker to its dedicated Railway service.
#
# `--path-as-root` archives `workers/crypto-minute-ingest/` as the build root, so Railway reads
# that directory's own railway.toml + Dockerfile. This guarantees the crypto service builds the
# crypto worker and can never pick up the repo-root railway.toml (which targets the STOCK worker).
#
# Never run a plain `railway up` from the repo root against this service — that would upload the
# git root and build the stock Dockerfile. Always use this script (or `npm run crypto:ws-deploy`).
set -euo pipefail

PROJECT_ID="${RAILWAY_PROJECT_ID:-1aaf26e1-b55f-4546-9a09-70cf5b38ff97}"
SERVICE="${RAILWAY_CRYPTO_SERVICE:-finsepa-crypto-minute-ingest}"
ENVIRONMENT="${RAILWAY_ENVIRONMENT_NAME:-production}"

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_DIR"

echo "Deploying $SERVICE from workers/crypto-minute-ingest (path-as-root)…"
railway up workers/crypto-minute-ingest --path-as-root \
  --project "$PROJECT_ID" --service "$SERVICE" --environment "$ENVIRONMENT" --ci
