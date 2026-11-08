#!/usr/bin/env node
/**
 * Isolated Binance trade-stream smoke test (does NOT touch the live EODHD worker
 * or `crypto_session_minute_bar`).
 *
 * Default: BTC / ETH / SOL for ~45s, log trades + per-minute closes, then exit.
 *
 *   node binance-ws-smoke-test.mjs
 *   CRYPTO_BINANCE_TEST_SECONDS=60 node binance-ws-smoke-test.mjs
 *   CRYPTO_BINANCE_TEST_SYMBOLS=BTC,ETH,SOL node binance-ws-smoke-test.mjs
 */

import WebSocket from "ws";
import { minuteBucketUnix } from "./crypto-minute-ingest-core.mjs";

const BASES = (process.env.CRYPTO_BINANCE_TEST_SYMBOLS ?? "BTC,ETH,SOL")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const RUN_SEC = Math.max(10, Number(process.env.CRYPTO_BINANCE_TEST_SECONDS ?? 45));
const streams = BASES.map((b) => `${b.toLowerCase()}usdt@trade`).join("/");
const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

/** @type {Map<string, { trades: number, lastPrice: number, lastTradeMs: number, minutes: Map<number, number> }>} */
const byBase = new Map(
  BASES.map((b) => [b, { trades: 0, lastPrice: NaN, lastTradeMs: 0, minutes: new Map() }]),
);

function log(...args) {
  console.log(new Date().toISOString(), "[binance-smoke]", ...args);
}

log("connecting", { bases: BASES, runSec: RUN_SEC, url });

const ws = new WebSocket(url);
let openedAt = 0;

ws.on("open", () => {
  openedAt = Date.now();
  log("open");
});

ws.on("message", (buf) => {
  let msg;
  try {
    msg = JSON.parse(String(buf));
  } catch {
    return;
  }
  const d = msg?.data;
  if (!d || d.e !== "trade") return;

  const symbol = String(d.s ?? "").toUpperCase(); // BTCUSDT
  if (!symbol.endsWith("USDT")) return;
  const base = symbol.slice(0, -4);
  const row = byBase.get(base);
  if (!row) return;

  const price = Number(d.p);
  const tradeMs = Number(d.T ?? d.E ?? Date.now());
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tradeMs)) return;

  const tradeSec = Math.floor(tradeMs / 1000);
  const bucket = minuteBucketUnix(tradeSec);
  row.trades += 1;
  row.lastPrice = price;
  row.lastTradeMs = tradeMs;
  row.minutes.set(bucket, price);

  if (row.trades <= 3 || row.trades % 50 === 0) {
    log("trade", base, price, new Date(tradeMs).toISOString(), `n=${row.trades}`);
  }
});

ws.on("error", (err) => {
  log("error", err.message);
});

ws.on("close", (code, reason) => {
  log("closed", code, String(reason ?? ""));
});

setTimeout(() => {
  const elapsedMs = openedAt ? Date.now() - openedAt : 0;
  log("summary", {
    elapsedSec: Math.round(elapsedMs / 1000),
    pairs: Object.fromEntries(
      [...byBase.entries()].map(([base, row]) => [
        base,
        {
          trades: row.trades,
          lastPrice: row.lastPrice,
          lastTradeAt: row.lastTradeMs ? new Date(row.lastTradeMs).toISOString() : null,
          minuteCloses: [...row.minutes.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([bucket, close]) => ({
              bucketUtc: new Date(bucket * 1000).toISOString(),
              close,
            })),
        },
      ]),
    ),
  });
  try {
    ws.close();
  } catch {
    /* ignore */
  }
  const ok = BASES.every((b) => (byBase.get(b)?.trades ?? 0) > 0);
  process.exit(ok ? 0 : 2);
}, RUN_SEC * 1000);
