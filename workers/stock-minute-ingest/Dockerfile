# Long-running EODHD WebSocket → Supabase minute-bar ingestor (Phase 2).
# Build from repo root: docker build -f workers/stock-minute-ingest/Dockerfile .
FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY scripts/stock-ws-minute-ingest.mjs ./scripts/

ENV NODE_ENV=production

CMD ["node", "scripts/stock-ws-minute-ingest.mjs"]
