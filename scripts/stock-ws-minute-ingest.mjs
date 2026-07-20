#!/usr/bin/env node
/**
 * Always-on EODHD WebSocket → Supabase 1m bars (0 REST API credits).
 */

import dns from "node:dns";
import http from "node:http";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import {
  capWatchTickerList,
  loadCuratedUsPriorityTickers,
  loadStock1DLiveMinuteChartTickers,
  loadStockWsAlwaysOnTickers,
  stockWsCuratedMode,
  stockWsPinnedOnlyMode,
} from "./lib/stock-ws-priority-universe.mjs";
import { normalizeStockTicker, parseEodhdUsWsMessage } from "./lib/eodhd-ws-parse.mjs";

// Railway/containers: prefer IPv4 for Supabase REST (avoids intermittent `fetch failed`).
dns.setDefaultResultOrder("ipv4first");

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();

const WATCH_MAX_AGE_MS = Number(process.env.STOCK_WS_WATCH_MAX_AGE_MS ?? 5 * 60 * 1000);
/** Default 60s — watchlist polls were contributing load during Supabase 522 incidents. */
const WATCH_POLL_MS = Number(process.env.STOCK_WS_WATCH_POLL_MS ?? 60 * 1000);
const HEARTBEAT_MS = Number(process.env.STOCK_WS_HEARTBEAT_MS ?? 5 * 60 * 1000);
const MAX_SYMBOLS = Number(process.env.STOCK_WS_MAX_SYMBOLS ?? 50);
const INCLUDE_WATCHLIST = !stockWsCuratedMode() && process.env.STOCK_WS_WATCHLIST !== "0";
const INCLUDE_SCREENER = !stockWsCuratedMode() && process.env.STOCK_WS_SCREENER !== "0";
const INCLUDE_CHART_WATCH = process.env.STOCK_WS_CHART_WATCH !== "0";
const HEALTH_PORT = Number(process.env.PORT ?? process.env.STOCK_WS_HEALTH_PORT ?? 8080);
const SUBSCRIBE_CHUNK_SIZE = Number(process.env.STOCK_WS_SUBSCRIBE_CHUNK ?? 10);
const INCLUDE_US_QUOTE = process.env.STOCK_WS_US_QUOTE !== "0";
const REST_POLL_MS = Number(process.env.STOCK_WS_REST_POLL_MS ?? 20_000);
const REST_POLL_BATCH = Number(process.env.STOCK_WS_REST_POLL_BATCH ?? 4);
const WS_STALE_MS = Number(process.env.STOCK_WS_STALE_MS ?? 90_000);
const STATIC_TICKERS = (process.env.STOCK_WS_TICKERS ?? "")
  .split(",")
  .map((s) => normalizeStockTicker(s))
  .filter(Boolean);

const DISPLAY_TZ = "America/New_York";
const SCREENER_SNAPSHOT_KEYS = ["top500_market", "stocks_all_pages"];

/** @type {{
 *   ok: boolean,
 *   authorized: boolean,
 *   authorizedQuote: boolean,
 *   subscribed: number,
 *   pendingUpserts: number,
 *   retryQueueSize: number,
 *   flushInProgress: boolean,
 *   flushStartedAt: string | null,
 *   lastSuccessfulUpsertAt: string | null,
 *   lastFailedUpsertAt: string | null,
 *   lastUpsertLatencyMs: number | null,
 *   writeStallSeconds: number,
 *   upsertSuccessCount: number,
 *   upsertAbortCount: number,
 *   retryCount: number,
 *   lastTradeAt: string | null,
 *   lastWsActivityAt: string | null,
 *   lastRestPollAt: string | null,
 *   session: string,
 *   startedAt: string,
 * }} */
const health = {
  ok: true,
  authorized: false,
  authorizedQuote: false,
  subscribed: 0,
  pendingUpserts: 0,
  retryQueueSize: 0,
  flushInProgress: false,
  flushStartedAt: null,
  lastSuccessfulUpsertAt: null,
  lastFailedUpsertAt: null,
  lastUpsertLatencyMs: null,
  writeStallSeconds: 0,
  upsertSuccessCount: 0,
  upsertAbortCount: 0,
  retryCount: 0,
  lastTradeAt: null,
  lastWsActivityAt: null,
  lastRestPollAt: null,
  session: getUsEquityMarketSession(),
  startedAt: new Date().toISOString(),
};

/** @type {number | null} */
let lastSuccessfulUpsertMs = null;
/** Hot flush: one attempt, then hand off to retry queue (do not sleep under flush lock). */
const HOT_FLUSH_MAX_ATTEMPTS = 1;
const RETRY_TICK_MS = Number(process.env.STOCK_WS_RETRY_TICK_MS ?? 500);

function log(...args) {
  console.log(new Date().toISOString(), ...args);
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

const SUPABASE_READ_TIMEOUT_MS = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS ?? 20_000);
const SUPABASE_WRITE_TIMEOUT_MS = Number(
  process.env.SUPABASE_UPSERT_TIMEOUT_MS ?? process.env.SUPABASE_FETCH_TIMEOUT_MS ?? 30_000,
);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: makeSupabaseFetch(SUPABASE_READ_TIMEOUT_MS) },
});

/** Longer timeout for minute-bar upserts — avoids AbortError under load. */
const supabaseWrite = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: makeSupabaseFetch(SUPABASE_WRITE_TIMEOUT_MS) },
});

/** @type {Map<string, { ticker: string, session_ymd: string, bucket_unix: number, close: number, updated_at: string }>} */
const pendingUpserts = new Map();
/**
 * Failed writes awaiting backoff retry. Same ticker:bucket key; latest row always wins.
 * @type {Map<string, { row: { ticker: string, session_ymd: string, bucket_unix: number, close: number, updated_at: string }, attempt: number, nextAt: number }>}
 */
const retryQueue = new Map();
/** Keys with an in-flight upsert (hot or retry) — prevents concurrent writes for the same bar. */
const inFlightKeys = new Set();
let flushTimer = null;
let retryTickTimer = null;
/** @type {Set<string>} */
let subscribedSymbols = new Set();
let tradeMsgCount = 0;
let quoteMsgCount = 0;
let restPollCount = 0;
let lastWsActivityMs = 0;
let restPollOffset = 0;
let tradeDrainScheduled = false;
/** @type {WebSocket | null} */
let tradesWs = null;
/** @type {WebSocket | null} */
let quoteWs = null;
/** @type {Map<string, { sym: string, tradeSec: number, price: number }>} */
const tradeCoalesce = new Map();
const PENDING_UPSERTS_CAP = Number(process.env.STOCK_WS_PENDING_CAP ?? 600);

function minuteBarKey(row) {
  return `${row.ticker}:${row.bucket_unix}`;
}

/** Last-close-wins by updated_at (ISO strings are lexicographically comparable). */
function pickLatestMinuteRow(a, b) {
  if (!a) return b;
  if (!b) return a;
  return a.updated_at >= b.updated_at ? a : b;
}

function syncWriteHealthFields() {
  health.pendingUpserts = pendingUpserts.size;
  health.retryQueueSize = retryQueue.size;
  health.flushInProgress = flushInProgress;
  health.writeStallSeconds = computeWriteStallSeconds();
}

function computeWriteStallSeconds() {
  if (pendingUpserts.size === 0 && retryQueue.size === 0) return 0;
  const anchor = lastSuccessfulUpsertMs ?? Date.parse(health.startedAt);
  if (!Number.isFinite(anchor)) return 0;
  return Math.max(0, Math.floor((Date.now() - anchor) / 1000));
}

function recordUpsertSuccess(latencyMs) {
  lastSuccessfulUpsertMs = Date.now();
  health.lastSuccessfulUpsertAt = new Date(lastSuccessfulUpsertMs).toISOString();
  health.lastUpsertLatencyMs = latencyMs;
  health.upsertSuccessCount += 1;
  health.writeStallSeconds = computeWriteStallSeconds();
}

function recordUpsertFailure(message, latencyMs) {
  health.lastFailedUpsertAt = new Date().toISOString();
  health.lastUpsertLatencyMs = latencyMs;
  if (String(message ?? "").toLowerCase().includes("abort")) {
    health.upsertAbortCount += 1;
  }
  health.writeStallSeconds = computeWriteStallSeconds();
}

function mergeRetryRowLatest(row) {
  const key = minuteBarKey(row);
  const existing = retryQueue.get(key);
  if (!existing) return;
  existing.row = pickLatestMinuteRow(existing.row, row);
}

function enqueueRetry(rows, errMsg) {
  const now = Date.now();
  for (const row of rows) {
    const key = minuteBarKey(row);
    const latest = pickLatestMinuteRow(
      pickLatestMinuteRow(row, pendingUpserts.get(key)),
      retryQueue.get(key)?.row,
    );
    const prevAttempt = retryQueue.get(key)?.attempt ?? -1;
    const attempt = prevAttempt + 1;
    retryQueue.set(key, {
      row: latest,
      attempt,
      nextAt: now + flushBackoffMs(attempt, errMsg),
    });
  }
  health.retryQueueSize = retryQueue.size;
  scheduleRetryTick();
}

function usSessionYmdFromDate(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function usSessionWallClockUnix(sessionYmd, hour, minute) {
  const [y, mo, d] = sessionYmd.split("-").map(Number);
  const guessUtc = Date.UTC(y, mo - 1, d, hour + 5, minute, 0);
  for (let offsetMin = -840; offsetMin <= 840; offsetMin += 15) {
    const probe = new Date(guessUtc + offsetMin * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: DISPLAY_TZ,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(probe);
    const ph = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
    const pm = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
    const py = parts.find((p) => p.type === "year")?.value;
    const pmo = parts.find((p) => p.type === "month")?.value;
    const pd = parts.find((p) => p.type === "day")?.value;
    const ymd = `${py}-${pmo}-${pd}`;
    if (ymd === sessionYmd && ph === hour && pm === minute) {
      return Math.floor(probe.getTime() / 1000);
    }
  }
  return Math.floor(guessUtc / 1000);
}

function getUsEquityMarketSession(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  if (weekday === "Sat" || weekday === "Sun") return "closed";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  const mins = hour * 60 + minute;
  const open = 9 * 60 + 30;
  const close = 16 * 60;
  if (mins < open) return "pre";
  if (mins >= close) return "post";
  return "regular";
}

function minuteBucketUnix(sessionYmd, tradeSec) {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0);
  if (tradeSec < openSec) return openSec;
  if (tradeSec >= closeSec) return closeSec - 60;
  const offset = tradeSec - openSec;
  return openSec + Math.floor(offset / 60) * 60;
}

/** @type {Map<string, number>} */
const lastPriceBySymbol = new Map();

function queueMinuteClose(ticker, tradeSec, price) {
  if (getUsEquityMarketSession() === "closed") return;
  if (!Number.isFinite(price) || price <= 0) return;
  const sym = normalizeStockTicker(ticker);
  if (!sym) return;
  const sessionYmd = usSessionYmdFromDate(new Date(tradeSec * 1000));
  const bucketUnix = minuteBucketUnix(sessionYmd, tradeSec);
  if (pendingUpserts.size >= PENDING_UPSERTS_CAP && !pendingUpserts.has(`${sym}:${bucketUnix}`)) {
    void flushPendingUpserts();
    if (pendingUpserts.size >= PENDING_UPSERTS_CAP) return;
  }
  pendingUpserts.set(`${sym}:${bucketUnix}`, {
    ticker: sym,
    session_ymd: sessionYmd,
    bucket_unix: bucketUnix,
    close: price,
    updated_at: new Date().toISOString(),
  });
  mergeRetryRowLatest(pendingUpserts.get(`${sym}:${bucketUnix}`));
  health.lastTradeAt = new Date().toISOString();
  syncWriteHealthFields();
  scheduleFlush();
}

function ingestTradeMessage(sym, tradeSec, price, source = "ws") {
  if (!sym || !Number.isFinite(price) || price <= 0 || tradeSec == null) return;
  lastPriceBySymbol.set(sym, price);
  const sessionYmd = usSessionYmdFromDate(new Date(tradeSec * 1000));
  const bucketUnix = minuteBucketUnix(sessionYmd, tradeSec);
  tradeCoalesce.set(`${sym}:${bucketUnix}`, { sym, tradeSec, price });
  if (source === "ws-trade") tradeMsgCount += 1;
  if (source === "ws-quote") quoteMsgCount += 1;
  if (source === "rest") restPollCount += 1;
  if (source === "ws-trade" || source === "ws-quote") {
    lastWsActivityMs = Date.now();
    health.lastWsActivityAt = new Date().toISOString();
  }
  if (!tradeDrainScheduled) {
    tradeDrainScheduled = true;
    setImmediate(drainTradeCoalesce);
  }
}

function drainTradeCoalesce() {
  tradeDrainScheduled = false;
  const batch = Array.from(tradeCoalesce.values());
  tradeCoalesce.clear();
  for (const { sym, tradeSec, price } of batch) {
    queueMinuteClose(sym, tradeSec, price);
  }
  if (tradeCoalesce.size > 0) {
    tradeDrainScheduled = true;
    setImmediate(drainTradeCoalesce);
  }
}

function scheduleFlush() {
  if (flushInProgress) return;
  if (pendingUpserts.size >= FLUSH_URGENT_THRESHOLD) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    setImmediate(() => void flushPendingUpserts());
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    setImmediate(() => void flushPendingUpserts());
  }, FLUSH_DEBOUNCE_MS);
}

function scheduleRetryTick() {
  if (retryTickTimer) return;
  retryTickTimer = setTimeout(() => {
    retryTickTimer = null;
    setImmediate(() => void processRetryQueue());
  }, RETRY_TICK_MS);
}

let flushInProgress = false;
let retryFlushInProgress = false;
let watchPollDeferred = false;
/** Softer defaults reduce PostgREST QPS when the origin is under load / returning 522. */
const FLUSH_DEBOUNCE_MS = Number(process.env.STOCK_WS_FLUSH_DEBOUNCE_MS ?? 1_500);
const FLUSH_URGENT_THRESHOLD = Number(process.env.STOCK_WS_FLUSH_URGENT_THRESHOLD ?? 40);
const FLUSH_MAX_ROWS_PER_CYCLE = Number(process.env.STOCK_WS_FLUSH_MAX_ROWS ?? 100);
const FLUSH_CHUNK_SIZE = Number(process.env.STOCK_WS_FLUSH_CHUNK_SIZE ?? 15);
const FLUSH_MAX_ATTEMPTS = Number(process.env.STOCK_WS_FLUSH_MAX_ATTEMPTS ?? 5);
const FLUSH_PERIODIC_MS = Number(process.env.STOCK_WS_FLUSH_PERIODIC_MS ?? 3_000);

function isTransientUpsertFailure(message) {
  const m = String(message ?? "").toLowerCase();
  return (
    m.includes("522") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("abort") ||
    m.includes("fetch failed") ||
    m.includes("econnreset") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504")
  );
}

function flushBackoffMs(attempt, message = "") {
  const base = isTransientUpsertFailure(message)
    ? Math.min(60_000, 1_000 * 2 ** attempt)
    : Math.min(8_000, 400 * 2 ** attempt);
  return base;
}

async function upsertMinuteBarChunk(chunk) {
  const { error } = await supabaseWrite.from("stock_session_minute_bar").upsert(chunk, {
    onConflict: "ticker,bucket_unix",
  });
  if (error) throw new Error(error.message);
}

/**
 * Hot path: at most HOT_FLUSH_MAX_ATTEMPTS per chunk, no in-lock sleep.
 * Transient failures go to retryQueue; flush lock is released by the caller immediately after.
 */
async function saveMinuteBarRowsHot(rows) {
  const chunkSize = Math.max(1, FLUSH_CHUNK_SIZE);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const keys = chunk.map(minuteBarKey);
    for (const key of keys) inFlightKeys.add(key);

    let saved = false;
    let lastMsg = "";
    const started = Date.now();
    for (let attempt = 0; attempt < HOT_FLUSH_MAX_ATTEMPTS && !saved; attempt++) {
      try {
        await upsertMinuteBarChunk(chunk);
        saved = true;
        recordUpsertSuccess(Date.now() - started);
        for (const key of keys) retryQueue.delete(key);
        log("upserted", chunk.length, "minute bars");
      } catch (err) {
        lastMsg = err instanceof Error ? err.message : String(err);
        recordUpsertFailure(lastMsg, Date.now() - started);
        log("upsert error", lastMsg, "rows", chunk.length, "attempt", attempt + 1);
      }
    }

    if (!saved) {
      if (isTransientUpsertFailure(lastMsg)) {
        enqueueRetry(chunk, lastMsg);
      } else {
        for (const row of chunk) {
          const key = minuteBarKey(row);
          const existing = pendingUpserts.get(key);
          pendingUpserts.set(key, pickLatestMinuteRow(existing, row));
        }
      }
    }

    for (const key of keys) inFlightKeys.delete(key);
    await yieldEventLoop();
  }
}

/**
 * Retry path: exponential backoff off the hot flush lock.
 * Skips keys present in pendingUpserts (hot owns latest) or currently inFlight.
 */
async function processRetryQueue() {
  if (retryFlushInProgress || retryQueue.size === 0) return;
  retryFlushInProgress = true;
  try {
    const now = Date.now();
    /** @type {{ ticker: string, session_ymd: string, bucket_unix: number, close: number, updated_at: string }[]} */
    const dueRows = [];
    for (const [key, entry] of retryQueue) {
      if (entry.nextAt > now) continue;
      if (pendingUpserts.has(key)) continue;
      if (inFlightKeys.has(key)) continue;
      const latest = pickLatestMinuteRow(entry.row, pendingUpserts.get(key));
      entry.row = latest;
      dueRows.push(latest);
      if (dueRows.length >= FLUSH_MAX_ROWS_PER_CYCLE) break;
    }

    const chunkSize = Math.max(1, FLUSH_CHUNK_SIZE);
    for (let i = 0; i < dueRows.length; i += chunkSize) {
      const chunk = dueRows.slice(i, i + chunkSize);
      const keys = chunk.map(minuteBarKey);
      // Re-check ownership before write
      const writable = [];
      for (let j = 0; j < chunk.length; j++) {
        const key = keys[j];
        if (pendingUpserts.has(key) || inFlightKeys.has(key)) continue;
        inFlightKeys.add(key);
        writable.push(chunk[j]);
      }
      if (!writable.length) continue;

      const writeKeys = writable.map(minuteBarKey);
      const started = Date.now();
      health.retryCount += 1;
      try {
        await upsertMinuteBarChunk(writable);
        recordUpsertSuccess(Date.now() - started);
        for (const key of writeKeys) retryQueue.delete(key);
        log("upserted", writable.length, "minute bars (retry)");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        recordUpsertFailure(msg, Date.now() - started);
        log("upsert error", msg, "rows", writable.length, "retry");
        const failNow = Date.now();
        for (const row of writable) {
          const key = minuteBarKey(row);
          if (pendingUpserts.has(key)) {
            // Hot has a newer owner — drop retry entry; hot will write.
            retryQueue.delete(key);
            continue;
          }
          const existing = retryQueue.get(key);
          const attempt = (existing?.attempt ?? 0) + 1;
          const latest = pickLatestMinuteRow(row, existing?.row);
          retryQueue.set(key, {
            row: latest,
            attempt,
            nextAt: failNow + flushBackoffMs(attempt, msg),
          });
        }
      } finally {
        for (const key of writeKeys) inFlightKeys.delete(key);
      }
      await yieldEventLoop();
    }
  } finally {
    retryFlushInProgress = false;
    syncWriteHealthFields();
    if (retryQueue.size > 0) scheduleRetryTick();
  }
}

function yieldEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function flushPendingUpserts() {
  if (!pendingUpserts.size || flushInProgress) return;
  flushInProgress = true;
  health.flushInProgress = true;
  health.flushStartedAt = new Date().toISOString();

  const rows = [];
  for (const [key, row] of pendingUpserts) {
    if (rows.length >= FLUSH_MAX_ROWS_PER_CYCLE) break;
    if (inFlightKeys.has(key)) continue;
    rows.push(row);
    pendingUpserts.delete(key);
  }
  syncWriteHealthFields();

  try {
    if (rows.length > 0) await saveMinuteBarRowsHot(rows);
  } finally {
    flushInProgress = false;
    health.flushInProgress = false;
    health.flushStartedAt = null;
    syncWriteHealthFields();
    if (pendingUpserts.size > 0) scheduleFlush();
    if (retryQueue.size > 0) scheduleRetryTick();
    if (watchPollDeferred) {
      watchPollDeferred = false;
      setImmediate(() => void syncSubscriptions());
    }
  }
}

function chartWatchRequestedSinceIso() {
  const session = getUsEquityMarketSession();
  if (session === "regular" || session === "post") {
    const todayYmd = usSessionYmdFromDate(new Date());
    return new Date(usSessionWallClockUnix(todayYmd, 9, 30) * 1000).toISOString();
  }
  return new Date(Date.now() - WATCH_MAX_AGE_MS).toISOString();
}

async function loadChartWatchTickers() {
  const cutoff = chartWatchRequestedSinceIso();
  const { data, error } = await supabase
    .from("stock_session_minute_bar_watch")
    .select("ticker, last_requested_at")
    .gte("last_requested_at", cutoff)
    .order("last_requested_at", { ascending: false })
    .limit(MAX_SYMBOLS);
  if (error) {
    log("watch poll error", error.message);
    return [];
  }
  return (data ?? []).map((row) => normalizeStockTicker(row.ticker)).filter(Boolean);
}

async function loadWatchlistTickers() {
  if (!INCLUDE_WATCHLIST) return [];
  const { data, error } = await supabase.from("watchlist").select("ticker").limit(5000);
  if (error) {
    log("watchlist poll error", error.message);
    return [];
  }
  const set = new Set();
  for (const row of data ?? []) {
    const sym = normalizeStockTicker(row.ticker);
    if (sym) set.add(sym);
  }
  return Array.from(set);
}

function tickersFromMarketSnapshotPayload(data) {
  if (!data || typeof data !== "object") return [];
  const rec = /** @type {Record<string, unknown>} */ (data);
  const out = [];
  const stocks = rec.stocks;
  if (stocks && typeof stocks === "object") {
    for (const key of Object.keys(stocks)) {
      const sym = normalizeStockTicker(key);
      if (sym) out.push(sym);
    }
  }
  const extra = rec.extraScreenerStocks;
  if (extra && typeof extra === "object") {
    for (const key of Object.keys(extra)) {
      const sym = normalizeStockTicker(key);
      if (sym) out.push(sym);
    }
  }
  return out;
}

async function loadScreenerSnapshotTickers() {
  if (!INCLUDE_SCREENER) return [];
  for (const key of SCREENER_SNAPSHOT_KEYS) {
    const { data, error } = await supabase.from("market_snapshot").select("data").eq("key", key).maybeSingle();
    if (error) {
      log("screener snapshot error", key, error.message);
      continue;
    }
    const tickers = tickersFromMarketSnapshotPayload(data?.data);
    if (tickers.length) return tickers;
  }
  return [];
}

async function loadWatchTickers() {
  if (stockWsPinnedOnlyMode()) {
    return loadStock1DLiveMinuteChartTickers();
  }

  const alwaysOn = loadStockWsAlwaysOnTickers();
  const chartWatch = INCLUDE_CHART_WATCH ? await loadChartWatchTickers() : [];

  if (stockWsCuratedMode()) {
    const curated = await loadCuratedUsPriorityTickers(supabase);
    const ordered = [];
    const seen = new Set();
    const push = (t) => {
      if (!t || seen.has(t)) return;
      seen.add(t);
      ordered.push(t);
    };

    for (const t of alwaysOn) push(t);
    for (const t of chartWatch) push(t);
    for (const t of curated) push(t);

    if (ordered.length > MAX_SYMBOLS) {
      log("capping curated+watch subscriptions", ordered.length, "→", MAX_SYMBOLS);
      return capWatchTickerList(ordered, MAX_SYMBOLS, alwaysOn);
    }
    return ordered;
  }

  const [watchlist, screener] = await Promise.all([
    loadWatchlistTickers(),
    loadScreenerSnapshotTickers(),
  ]);

  const ordered = [];
  const seen = new Set();
  const push = (t) => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    ordered.push(t);
  };

  for (const t of alwaysOn) push(t);
  for (const t of chartWatch) push(t);
  for (const t of watchlist) push(t);
  for (const t of STATIC_TICKERS) push(t);
  for (const t of screener) push(t);

  if (ordered.length > MAX_SYMBOLS) {
    log("capping subscriptions", ordered.length, "→", MAX_SYMBOLS);
    return capWatchTickerList(ordered, MAX_SYMBOLS, alwaysOn);
  }
  return ordered;
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    health.session = getUsEquityMarketSession();
    health.subscribed = subscribedSymbols.size;
    syncWriteHealthFields();
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        Connection: "close",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          ...health,
          tradeMsgCount,
          quoteMsgCount,
          restPollCount,
          wsStaleMs: lastWsActivityMs > 0 ? Date.now() - lastWsActivityMs : null,
        }),
      );
      return;
    }
    res.writeHead(404, { Connection: "close" });
    res.end();
  });
  server.keepAliveTimeout = 1000;
  server.headersTimeout = 5000;
  server.listen(HEALTH_PORT, "0.0.0.0", () => log("health server listening", HEALTH_PORT));
}

function sendWsCommand(ws, action, symbols) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !symbols.length) return;
  const chunkSize = Math.max(1, SUBSCRIBE_CHUNK_SIZE);
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    ws.send(JSON.stringify({ action, symbols: chunk.join(",") }));
  }
}

function processWsText(text, source) {
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    if (text.includes("Authorized") || text.includes("status_code")) {
      log("authorized", source, text.slice(0, 120));
      return "authorized";
    }
    return null;
  }

  if (msg.status_code != null) {
    log("auth status", source, msg.status_code, msg.message ?? "");
    return msg.status_code === 200 ? "authorized" : "auth-failed";
  }

  const parsed = parseEodhdUsWsMessage(msg);
  if (!parsed) return null;
  ingestTradeMessage(parsed.sym, parsed.tradeSec, parsed.price, source);
  return "trade";
}

function attachWsHandlers(ws, source, onAuthorized) {
  /** @type {Buffer[]} */
  const rawWsQueue = [];
  let rawWsDrainScheduled = false;

  const drainRawWsQueue = () => {
    rawWsDrainScheduled = false;
    const batch = rawWsQueue.splice(0, 250);
    for (const raw of batch) {
      const result = processWsText(raw.toString(), source);
      if (result === "authorized") onAuthorized();
    }
    if (rawWsQueue.length > 0) {
      rawWsDrainScheduled = true;
      setImmediate(drainRawWsQueue);
    }
  };

  ws.on("message", (raw) => {
    rawWsQueue.push(Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw)));
    if (!rawWsDrainScheduled) {
      rawWsDrainScheduled = true;
      setImmediate(drainRawWsQueue);
    }
  });
}

/** @type {Set<string>} */
let localSubscribed = new Set();
let watchPoll = null;
let tradesAuthorized = false;
let quoteAuthorized = false;

const stopWatchPoll = () => {
  if (watchPoll) {
    clearInterval(watchPoll);
    watchPoll = null;
  }
};

const startWatchPoll = () => {
  stopWatchPoll();
  watchPoll = setInterval(() => void syncSubscriptions(), WATCH_POLL_MS);
};

async function syncSubscriptions() {
  if (flushInProgress) {
    watchPollDeferred = true;
    return;
  }
  const tradesReady = tradesAuthorized && tradesWs?.readyState === WebSocket.OPEN;
  const quoteReady = quoteAuthorized && quoteWs?.readyState === WebSocket.OPEN;
  if (!tradesReady && !quoteReady) return;

  const targetList = await loadWatchTickers();
  const target = new Set(targetList);
  const toAdd = targetList.filter((t) => !localSubscribed.has(t));
  const toRemove = [...localSubscribed].filter((t) => !target.has(t));

  if (toAdd.length) {
    if (tradesReady) sendWsCommand(tradesWs, "subscribe", toAdd);
    if (quoteReady) sendWsCommand(quoteWs, "subscribe", toAdd);
    for (const t of toAdd) localSubscribed.add(t);
    log("subscribed", toAdd.length, toAdd.slice(0, 8).join(","), toAdd.length > 8 ? "…" : "");
  }
  if (toRemove.length) {
    if (tradesReady) sendWsCommand(tradesWs, "unsubscribe", toRemove);
    if (quoteReady) sendWsCommand(quoteWs, "unsubscribe", toRemove);
    for (const t of toRemove) localSubscribed.delete(t);
    log("unsubscribed", toRemove.length);
  }

  subscribedSymbols = localSubscribed;
  health.subscribed = subscribedSymbols.size;
  void preMarketBootstrap();
}

function connectMarketWs(path, source, onAuthorized, onClose) {
  const url = `wss://ws.eodhistoricaldata.com/ws/${path}?api_token=${encodeURIComponent(EODHD_KEY)}`;
  const ws = new WebSocket(url);

  ws.on("open", () => log("websocket connecting…", path));

  attachWsHandlers(ws, source, () => {
    onAuthorized();
    health.authorized = tradesAuthorized;
    health.authorizedQuote = quoteAuthorized;
    const existing = [...localSubscribed];
    if (existing.length) sendWsCommand(ws, "subscribe", existing);
    void syncSubscriptions();
    startWatchPoll();
  });

  ws.on("close", (code) => {
    log("websocket closed", path, code);
    onClose();
    setTimeout(() => connectMarketWs(path, source, onAuthorized, onClose), 5000);
  });

  ws.on("error", (err) => log("websocket error", path, err.message));
  return ws;
}

function connectWs() {
  tradesAuthorized = false;
  quoteAuthorized = false;
  localSubscribed = new Set();
  subscribedSymbols = localSubscribed;
  health.authorized = false;
  health.authorizedQuote = false;
  health.subscribed = 0;

  tradesWs = connectMarketWs(
    "us",
    "ws-trade",
    () => {
      tradesAuthorized = true;
    },
    () => {
      tradesAuthorized = false;
      tradesWs = null;
      if (!quoteAuthorized) stopWatchPoll();
    },
  );

  if (INCLUDE_US_QUOTE) {
    quoteWs = connectMarketWs(
      "us-quote",
      "ws-quote",
      () => {
        quoteAuthorized = true;
      },
      () => {
        quoteAuthorized = false;
        quoteWs = null;
        if (!tradesAuthorized) stopWatchPoll();
      },
    );
  }
}

async function pollRealtimeMinuteBar(sym) {
  const url = `https://eodhd.com/api/real-time/${encodeURIComponent(sym)}.US?api_token=${encodeURIComponent(EODHD_KEY)}&fmt=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) return false;
  const rt = await res.json();
  const open = rt.open ?? rt.previousClose;
  const close = rt.close;
  if (
    typeof close !== "number" ||
    !Number.isFinite(close) ||
    close <= 0 ||
    typeof open !== "number" ||
    !Number.isFinite(open) ||
    open <= 0
  ) {
    return false;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  ingestTradeMessage(sym, nowSec, close, "rest");
  health.lastRestPollAt = new Date().toISOString();
  return true;
}

async function restPollTick() {
  const session = getUsEquityMarketSession();
  if (session === "closed") return;

  const symbols = [...subscribedSymbols];
  if (!symbols.length) return;

  const wsStale = lastWsActivityMs === 0 || Date.now() - lastWsActivityMs > WS_STALE_MS;
  if (!wsStale) return;

  const batchSize = Math.max(1, REST_POLL_BATCH);
  const batch = [];
  for (let i = 0; i < batchSize && i < symbols.length; i += 1) {
    const idx = (restPollOffset + i) % symbols.length;
    batch.push(symbols[idx]);
  }
  restPollOffset = (restPollOffset + batchSize) % symbols.length;

  for (const sym of batch) {
    try {
      await pollRealtimeMinuteBar(sym);
    } catch (err) {
      log("rest poll error", sym, err instanceof Error ? err.message : String(err));
    }
  }
}

/** One close per symbol per minute wall-clock bucket (pre + regular). */
async function minuteHeartbeatTick() {
  const session = getUsEquityMarketSession();
  if (session === "closed" || session === "post") return;

  const symbols = [...subscribedSymbols];
  if (!symbols.length) return;

  const nowSec = Math.floor(Date.now() / 1000);
  for (const sym of symbols) {
    const price = lastPriceBySymbol.get(sym);
    if (price != null) {
      ingestTradeMessage(sym, nowSec, price, "heartbeat");
      continue;
    }
    try {
      await pollRealtimeMinuteBar(sym);
    } catch (err) {
      log("minute heartbeat rest poll error", sym, err instanceof Error ? err.message : String(err));
    }
  }
}

function startMinuteHeartbeat() {
  const alignMs = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    void minuteHeartbeatTick();
    setInterval(() => void minuteHeartbeatTick(), 60_000);
  }, alignMs);
  log("minute heartbeat aligned", { firstInMs: alignMs });
}

/** Seed last prices and open bucket during pre-market before 9:30 ET. */
let preMarketBootstrapped = false;
async function preMarketBootstrap() {
  if (preMarketBootstrapped) return;
  if (getUsEquityMarketSession() !== "pre") return;
  const symbols = [...subscribedSymbols];
  if (!symbols.length) return;
  preMarketBootstrapped = true;
  log("pre-market bootstrap", symbols.join(","));
  for (const sym of symbols) {
    try {
      await pollRealtimeMinuteBar(sym);
    } catch (err) {
      log("pre-market bootstrap error", sym, err instanceof Error ? err.message : String(err));
    }
  }
}

process.on("SIGINT", async () => {
  log("shutting down…");
  await flushPendingUpserts();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await flushPendingUpserts();
  process.exit(0);
});

setInterval(() => {
  health.session = getUsEquityMarketSession();
  health.subscribed = subscribedSymbols.size;
  syncWriteHealthFields();
  log("heartbeat", {
    session: health.session,
    authorized: health.authorized,
    authorizedQuote: health.authorizedQuote,
    subscribed: health.subscribed,
    pendingUpserts: health.pendingUpserts,
    retryQueueSize: health.retryQueueSize,
    flushInProgress: health.flushInProgress,
    flushStartedAt: health.flushStartedAt,
    lastSuccessfulUpsertAt: health.lastSuccessfulUpsertAt,
    lastFailedUpsertAt: health.lastFailedUpsertAt,
    lastUpsertLatencyMs: health.lastUpsertLatencyMs,
    writeStallSeconds: health.writeStallSeconds,
    upsertSuccessCount: health.upsertSuccessCount,
    upsertAbortCount: health.upsertAbortCount,
    retryCount: health.retryCount,
    tradeMsgCount,
    quoteMsgCount,
    restPollCount,
    lastTradeAt: health.lastTradeAt,
    lastWsActivityAt: health.lastWsActivityAt,
    lastRestPollAt: health.lastRestPollAt,
  });
}, HEARTBEAT_MS);

setInterval(() => {
  void restPollTick();
}, REST_POLL_MS);

setInterval(() => {
  if (pendingUpserts.size > 0) scheduleFlush();
  if (retryQueue.size > 0) scheduleRetryTick();
}, FLUSH_PERIODIC_MS);

log("starting stock minute ingest (always-on)", {
  curatedMode: stockWsCuratedMode(),
  alwaysOn: loadStockWsAlwaysOnTickers(),
  staticTickers: STATIC_TICKERS.length,
  includeWatchlist: INCLUDE_WATCHLIST,
  includeScreener: INCLUDE_SCREENER,
  includeChartWatch: INCLUDE_CHART_WATCH,
  includeUsQuote: INCLUDE_US_QUOTE,
  maxSymbols: MAX_SYMBOLS,
  subscribeChunkSize: SUBSCRIBE_CHUNK_SIZE,
  restPollMs: REST_POLL_MS,
  flushDebounceMs: FLUSH_DEBOUNCE_MS,
  flushPeriodicMs: FLUSH_PERIODIC_MS,
  healthPort: HEALTH_PORT,
  session: getUsEquityMarketSession(),
});

startHealthServer();
connectWs();
startMinuteHeartbeat();
