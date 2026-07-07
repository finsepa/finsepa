# Long-running EODHD crypto WebSocket → Supabase minute-bar ingestor (BTC only).
# Self-contained: deploy with this dir as the upload/build context
# (`railway up workers/crypto-minute-ingest --service finsepa-crypto-minute-ingest`).
FROM node:22-alpine
WORKDIR /app

# Required for HTTPS fetch to Supabase/EODHD from Alpine (without this: `TypeError: fetch failed`).
RUN apk add --no-cache ca-certificates

COPY package.json ./
RUN npm install --omit=dev

COPY crypto-ws-minute-ingest.mjs ./

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "crypto-ws-minute-ingest.mjs"]
