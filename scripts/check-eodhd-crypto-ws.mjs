#!/usr/bin/env node
/**
 * Quick check: does the configured EODHD_API_KEY have crypto WebSocket access?
 * Connects to /ws/crypto, subscribes to BTC-USD, and reports auth + first trade.
 *
 * Run: npm run crypto:ws-check
 */

import WebSocket from "ws";

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
if (!EODHD_KEY) {
  console.error("Missing EODHD_API_KEY");
  process.exit(1);
}

const PAIR = (process.env.CRYPTO_WS_PAIRS ?? "BTC-USD").split(",")[0].trim().toUpperCase();
const TIMEOUT_MS = Number(process.env.CRYPTO_WS_CHECK_TIMEOUT_MS ?? 15_000);

const url = `wss://ws.eodhistoricaldata.com/ws/crypto?api_token=${encodeURIComponent(EODHD_KEY)}`;
const ws = new WebSocket(url);

let authorized = false;
let gotTrade = false;
const started = Date.now();

function done(code, msg) {
  console.log(msg);
  try {
    ws.close();
  } catch {
    /* ignore */
  }
  process.exit(code);
}

const timer = setTimeout(() => {
  if (!authorized) done(1, "FAIL: no authorization within timeout — key likely lacks crypto WS access.");
  if (!gotTrade) done(0, `PARTIAL: authorized OK, but no ${PAIR} trade within ${TIMEOUT_MS / 1000}s (market may be quiet). Access looks fine.`);
}, TIMEOUT_MS);

ws.on("open", () => console.log(`connecting… (${PAIR})`));

ws.on("message", (raw) => {
  const text = raw.toString();
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }

  if (msg.status_code != null) {
    console.log("auth status:", msg.status_code, msg.message ?? "");
    if (msg.status_code === 200) {
      authorized = true;
      ws.send(JSON.stringify({ action: "subscribe", symbols: PAIR }));
      console.log("subscribed:", PAIR);
    } else {
      clearTimeout(timer);
      done(1, "FAIL: authorization rejected — key lacks crypto WS access.");
    }
    return;
  }

  if (msg.s && msg.p != null) {
    gotTrade = true;
    clearTimeout(timer);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    done(0, `PASS: ${msg.s} @ ${msg.p} (first trade in ${secs}s). Crypto WS access confirmed.`);
  }
});

ws.on("error", (err) => {
  clearTimeout(timer);
  done(1, `FAIL: websocket error — ${err.message}`);
});

ws.on("close", (code) => {
  if (!authorized) {
    clearTimeout(timer);
    done(1, `FAIL: closed before auth (code ${code}) — key likely lacks crypto WS access.`);
  }
});
