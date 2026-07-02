# Long-running EODHD WebSocket → Supabase minute-bar ingestor.
# Build from repo root: docker build -f workers/stock-minute-ingest/Dockerfile .
FROM node:22-alpine
WORKDIR /app

# Required for HTTPS fetch to Supabase/EODHD from Alpine (without this: `TypeError: fetch failed`).
RUN apk add --no-cache ca-certificates

COPY workers/stock-minute-ingest/package.json workers/stock-minute-ingest/package-lock.json ./
RUN npm ci --omit=dev

COPY scripts/stock-ws-minute-ingest.mjs ./scripts/
COPY scripts/lib/ ./scripts/lib/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "scripts/stock-ws-minute-ingest.mjs"]
