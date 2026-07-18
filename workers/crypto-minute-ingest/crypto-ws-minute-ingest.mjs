#!/usr/bin/env node
/**
 * Always-on EODHD crypto WebSocket → Supabase 1m bars for the live crypto 1D chart.
 *
 * Scope: BTC only (24/7, no US market session logic). Separate pipeline from the stock
 * WS ingestor — do not merge crypto into the stock worker.
 *
 * - Subscribes to the EODHD crypto WS (`/ws/crypto`) for the configured pair(s).
 * - Coalesces one close per UTC minute bucket and upserts into `crypto_session_minute_bar`.
 * - Emits a heartbeat bucket every ~60s from the last seen price so the line stays continuous
 *   even during quiet trade minutes.
 * - Exposes /health for Railway.
 *
 * Under Supabase 522 / timeouts: exponential backoff before retry (no immediate re-flush storm).
 */

import dns from "node:dns";
import http from "node:http";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import {
  resolveFlushDebounceMs,
  setPendingMinuteClose,
} from "./crypto-minute-ingest-core.mjs";

dns.setDefaultResultOrder("ipv4first");

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();

/** EODHD crypto pairs to subscribe to (WS symbol form, e.g. BTC-USD). BTC only for now. */
const WS_PAIRS = (process.env.CRYPTO_WS_PAIRS ?? "BTC-USD")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const HEARTBEAT_MS = Number(process.env.CRYPTO_WS_HEARTBEAT_MS ?? 60_000);
/** Default 6s, clamped to at least 5s, to limit same-minute PostgREST rewrites. */
const FLUSH_DEBOUNCE_MS = resolveFlushDebounceMs(
  process.env.CRYPTO_WS_FLUSH_DEBOUNCE_MS,
  (message) => console.warn(new Date().toISOString(), "[crypto-ws]", message),
);
const FLUSH_MAX_ATTEMPTS = Number(process.env.CRYPTO_WS_FLUSH_MAX_ATTEMPTS ?? 5);
const SUPABASE_UPSERT_TIMEOUT_MS = Number(process.env.SUPABASE_UPSERT_TIMEOUT_MS ?? 15_000);
const HEALTH_PORT = Number(process.env.PORT ?? process.env.CRYPTO_WS_HEALTH_PORT ?? 8080);

const health = {
  ok: true,
  authorized: false,
  subscribed: 0,
  pairs: WS_PAIRS,
  lastTradeAt: null,
  lastPrice: null,
  lastFlushAt: null,
  pendingUpserts: 0,
  flushBackoffMs: 0,
  startedAt: new Date().toISOString(),
};

function log(...args) {
  console.log(new Date().toISOString(), "[crypto-ws]", ...args);
}
function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!EODHD_KEY) fail("Missing EODHD_API_KEY");
if (!SUPABASE_URL || !SUPABASE_KEY) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

function makeSupabaseFetch(timeoutMs) {
  return function supabaseFetch(url, options = {}) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const outerSignal = options.signal;
    if (outerSignal) {
      if (outerSignal.aborted) ac.abort();
      else outerSignal.addEventListener("abort", () => ac.abort(), { once: true });
    }
    const { signal: _ignored, ...rest } = options;
    return fetch(url, { ...rest, signal: ac.signal })
      .catch((err) => {
        const cause = err instanceof Error && "cause" in err ? err.cause : null;
        if (cause) {
          throw new Error(`${err.message} (${String(cause)})`, { cause: err });
        }
        throw err;
      })
      .finally(() => clearTimeout(timer));
  };
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: makeSupabaseFetch(SUPABASE_UPSERT_TIMEOUT_MS) },
});

/** `BTC-USD` | `BTC-USD.CC` → `BTC` (base symbol we store). */
function baseSymbolFromPair(pair) {
  const up = String(pair ?? "").trim().toUpperCase();
  if (!up) return null;
  const base = up.replace(/\.(CC|US)$/i, "").split("-")[0];
  return base && /^[A-Z0-9]{1,12}$/.test(base) ? base : null;
}

function resolveTradeSec(rawTs) {
  const nowSec = Math.floor(Date.now() / 1000);
  let t = rawTs;
  if (typeof t === "string" && t.trim()) t = Number(t);
  if (typeof t !== "number" || !Number.isFinite(t)) return nowSec;
  const sec = t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
  // Guard against absurd timestamps — fall back to now.
  if (sec < nowSec - 86_400 || sec > nowSec + 300) return nowSec;
  return sec;
}

function isTransientUpsertFailure(message) {
  const m = String(message ?? "").toLowerCase();
  return (
    m.includes("522") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("abort") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("socket hang up") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504")
  );
}

function flushBackoffMs(attempt) {
  // Cap high so a Supabase outage cannot spin PostgREST.
  return Math.min(60_000, 1_000 * 2 ** attempt);
}

/** @type {Map<string, { ticker: string, bucket_unix: number, close: number, updated_at: string }>} */
const pendingUpserts = new Map();
/** @type {Map<string, number>} last price per base symbol (for heartbeat). */
const lastPriceBySymbol = new Map();
let flushTimer = null;
let flushInProgress = false;
let consecutiveFlushFailures = 0;

function queueMinuteClose(base, tradeSec, price) {
  if (!base || !Number.isFinite(price) || price <= 0) return;
  lastPriceBySymbol.set(base, price);
  setPendingMinuteClose(pendingUpserts, base, tradeSec, price, new Date().toISOString());
  health.lastTradeAt = new Date().toISOString();
  health.lastPrice = price;
  health.pendingUpserts = pendingUpserts.size;
  scheduleFlush();
}

function scheduleFlush(delayMs = FLUSH_DEBOUNCE_MS) {
  if (flushTimer || flushInProgress) return;
  const wait = Math.max(delayMs, health.flushBackoffMs || 0);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingUpserts();
  }, wait);
}

async function flushPendingUpserts() {
  if (!pendingUpserts.size || flushInProgress) return;
  flushInProgress = true;
  const rows = Array.from(pendingUpserts.values());
  pendingUpserts.clear();
  health.pendingUpserts = 0;
  let saved = false;
  let lastError = null;

  for (let attempt = 0; attempt < FLUSH_MAX_ATTEMPTS && !saved; attempt++) {
    try {
      const { error } = await supabase
        .from("crypto_session_minute_bar")
        .upsert(rows, { onConflict: "ticker,bucket_unix" });
      if (error) throw new Error(error.message);
      saved = true;
      consecutiveFlushFailures = 0;
      health.flushBackoffMs = 0;
      health.lastFlushAt = new Date().toISOString();
      log("upserted", rows.length, "minute bars");
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log("upsert error", lastError, "rows", rows.length, "attempt", attempt + 1);
      if (attempt < FLUSH_MAX_ATTEMPTS - 1) {
        const wait = flushBackoffMs(attempt);
        health.flushBackoffMs = wait;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  if (!saved) {
    consecutiveFlushFailures += 1;
    for (const row of rows) pendingUpserts.set(`${row.ticker}:${row.bucket_unix}`, row);
    const wait = flushBackoffMs(Math.min(consecutiveFlushFailures + 2, 8));
    health.flushBackoffMs = wait;
    log(
      "upsert deferred",
      "failures",
      consecutiveFlushFailures,
      "backoffMs",
      wait,
      "transient",
      isTransientUpsertFailure(lastError),
    );
  }

  flushInProgress = false;
  health.pendingUpserts = pendingUpserts.size;
  if (pendingUpserts.size > 0) {
    scheduleFlush(saved ? FLUSH_DEBOUNCE_MS : health.flushBackoffMs || FLUSH_DEBOUNCE_MS);
  }
}

/** Keep the line continuous during quiet minutes by re-stamping the last price each minute. */
function heartbeatTick() {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [base, price] of lastPriceBySymbol.entries()) {
    queueMinuteClose(base, nowSec, price);
  }
}

function processWsText(text) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    if (text.includes("Authorized") || text.includes("status_code")) return "authorized";
    return null;
  }

  if (msg.status_code != null) {
    log("auth status", msg.status_code, msg.message ?? "");
    return msg.status_code === 200 ? "authorized" : "auth-failed";
  }

  const base = baseSymbolFromPair(msg.s);
  if (!base) return null;
  const price = Number(msg.p);
  if (!Number.isFinite(price) || price <= 0) return null;
  const tradeSec = resolveTradeSec(msg.t);
  queueMinuteClose(base, tradeSec, price);
  return "trade";
}

let ws = null;

function connectWs() {
  const url = `wss://ws.eodhistoricaldata.com/ws/crypto?api_token=${encodeURIComponent(EODHD_KEY)}`;
  ws = new WebSocket(url);

  ws.on("open", () => log("websocket connecting…", WS_PAIRS.join(",")));

  ws.on("message", (raw) => {
    const result = processWsText(raw.toString());
    if (result === "authorized") {
      health.authorized = true;
      ws.send(JSON.stringify({ action: "subscribe", symbols: WS_PAIRS.join(",") }));
      health.subscribed = WS_PAIRS.length;
      log("subscribed", WS_PAIRS.join(","));
    }
  });

  ws.on("close", (code) => {
    log("websocket closed", code);
    health.authorized = false;
    health.subscribed = 0;
    setTimeout(connectWs, 5000);
  });

  ws.on("error", (err) => log("websocket error", err.message));
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json", Connection: "close" });
      res.end(JSON.stringify(health));
      return;
    }
    res.writeHead(404, { Connection: "close" });
    res.end();
  });
  server.keepAliveTimeout = 1000;
  server.headersTimeout = 5000;
  server.listen(HEALTH_PORT, "0.0.0.0", () => log("health server listening", HEALTH_PORT));
}

startHealthServer();
connectWs();
setInterval(heartbeatTick, HEARTBEAT_MS);

log("crypto WS minute ingest starting", {
  pairs: WS_PAIRS,
  heartbeatMs: HEARTBEAT_MS,
  flushDebounceMs: FLUSH_DEBOUNCE_MS,
  upsertTimeoutMs: SUPABASE_UPSERT_TIMEOUT_MS,
});
