#!/usr/bin/env node
/**
 * Always-on EODHD WebSocket → Supabase 1m bars (0 REST API credits).
 *
 * Required: EODHD_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: PORT (health server), STOCK_WS_SCREENER=1, STOCK_WS_WATCHLIST=1
 *
 * Deploy: npm run ops:setup-stock-minute-ingest
 */

import http from "node:http";
import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";
import {
  loadCuratedUsPriorityTickers,
  stockWsCuratedMode,
} from "./lib/stock-ws-priority-universe.mjs";

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();

const WATCH_MAX_AGE_MS = Number(process.env.STOCK_WS_WATCH_MAX_AGE_MS ?? 5 * 60 * 1000);
const WATCH_POLL_MS = Number(process.env.STOCK_WS_WATCH_POLL_MS ?? 30 * 1000);
const HEARTBEAT_MS = Number(process.env.STOCK_WS_HEARTBEAT_MS ?? 5 * 60 * 1000);
const MAX_SYMBOLS = Number(process.env.STOCK_WS_MAX_SYMBOLS ?? 50);
const INCLUDE_WATCHLIST = !stockWsCuratedMode() && process.env.STOCK_WS_WATCHLIST !== "0";
const INCLUDE_SCREENER = !stockWsCuratedMode() && process.env.STOCK_WS_SCREENER !== "0";
const INCLUDE_CHART_WATCH = !stockWsCuratedMode() && process.env.STOCK_WS_CHART_WATCH !== "0";
const HEALTH_PORT = Number(process.env.PORT ?? process.env.STOCK_WS_HEALTH_PORT ?? 8080);
const STATIC_TICKERS = (process.env.STOCK_WS_TICKERS ?? "")
  .split(",")
  .map((s) => normalizeStockTicker(s))
  .filter(Boolean);

const DISPLAY_TZ = "America/New_York";
const SCREENER_SNAPSHOT_KEYS = ["top500_market", "stocks_all_pages"];

/** @type {{ ok: boolean, authorized: boolean, subscribed: number, pendingUpserts: number, lastTradeAt: string | null, session: string, startedAt: string }} */
const health = {
  ok: true,
  authorized: false,
  subscribed: 0,
  pendingUpserts: 0,
  lastTradeAt: null,
  session: getUsEquityMarketSession(),
  startedAt: new Date().toISOString(),
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!EODHD_KEY) fail("Missing EODHD_API_KEY");
if (!SUPABASE_URL || !SUPABASE_KEY) fail("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** @type {Map<string, { ticker: string, session_ymd: string, bucket_unix: number, close: number, updated_at: string }>} */
const pendingUpserts = new Map();
let flushTimer = null;
/** @type {Set<string>} */
let subscribedSymbols = new Set();

function normalizeStockTicker(raw) {
  const t = String(raw ?? "").trim().toUpperCase();
  if (!t || t.includes(":") || t.includes("/") || t.startsWith("$")) return null;
  const base = t.replace(/\.US$/i, "").split(".")[0];
  if (!base || !/^[A-Z0-9-]{1,8}$/.test(base)) return null;
  return base;
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

function queueMinuteClose(ticker, tradeSec, price) {
  if (getUsEquityMarketSession() !== "regular") return;
  if (!Number.isFinite(price) || price <= 0) return;
  const sym = normalizeStockTicker(ticker);
  if (!sym) return;
  const sessionYmd = usSessionYmdFromDate(new Date(tradeSec * 1000));
  const bucketUnix = minuteBucketUnix(sessionYmd, tradeSec);
  pendingUpserts.set(`${sym}:${bucketUnix}`, {
    ticker: sym,
    session_ymd: sessionYmd,
    bucket_unix: bucketUnix,
    close: price,
    updated_at: new Date().toISOString(),
  });
  health.lastTradeAt = new Date().toISOString();
  health.pendingUpserts = pendingUpserts.size;
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPendingUpserts();
  }, 1000);
}

async function flushPendingUpserts() {
  if (!pendingUpserts.size) return;
  const rows = Array.from(pendingUpserts.values());
  pendingUpserts.clear();
  health.pendingUpserts = pendingUpserts.size;

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    let saved = false;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      try {
        const { error } = await supabase.from("stock_session_minute_bar").upsert(chunk, {
          onConflict: "ticker,bucket_unix",
        });
        if (error) {
          log("upsert error", error.message, "rows", chunk.length, "attempt", attempt + 1);
          if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        saved = true;
        if (process.env.STOCK_WS_VERBOSE === "1") {
          log("upserted", chunk.length, "minute bars");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log("upsert error", msg, "rows", chunk.length, "attempt", attempt + 1);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (!saved) {
      for (const row of chunk) {
        pendingUpserts.set(`${row.ticker}:${row.bucket_unix}`, row);
      }
    }
  }

  health.pendingUpserts = pendingUpserts.size;
}

async function loadChartWatchTickers() {
  const cutoff = new Date(Date.now() - WATCH_MAX_AGE_MS).toISOString();
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
  if (stockWsCuratedMode()) {
    const curated = await loadCuratedUsPriorityTickers(supabase);
    if (curated.length > MAX_SYMBOLS) {
      log("capping curated subscriptions", curated.length, "→", MAX_SYMBOLS);
      return curated.slice(0, MAX_SYMBOLS);
    }
    return curated;
  }

  const [chart, watchlist, screener] = await Promise.all([
    INCLUDE_CHART_WATCH ? loadChartWatchTickers() : Promise.resolve([]),
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

  for (const t of chart) push(t);
  for (const t of watchlist) push(t);
  for (const t of STATIC_TICKERS) push(t);
  for (const t of screener) push(t);

  if (ordered.length > MAX_SYMBOLS) {
    log("capping subscriptions", ordered.length, "→", MAX_SYMBOLS);
    return ordered.slice(0, MAX_SYMBOLS);
  }
  return ordered;
}

function startHealthServer() {
  const server = http.createServer((req, res) => {
    health.session = getUsEquityMarketSession();
    health.subscribed = subscribedSymbols.size;
    health.pendingUpserts = pendingUpserts.size;
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(health));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(HEALTH_PORT, "0.0.0.0", () => log("health server listening", HEALTH_PORT));
}

function connectWs() {
  const url = `wss://ws.eodhistoricaldata.com/ws/us?api_token=${encodeURIComponent(EODHD_KEY)}`;
  const ws = new WebSocket(url);
  /** @type {Set<string>} */
  let subscribed = new Set();
  let watchPoll = null;
  let authorized = false;

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

  const syncSubscriptions = async () => {
    if (!authorized || ws.readyState !== WebSocket.OPEN) return;
    const targetList = await loadWatchTickers();
    const target = new Set(targetList);
    const toAdd = targetList.filter((t) => !subscribed.has(t));
    const toRemove = [...subscribed].filter((t) => !target.has(t));
    if (toAdd.length) {
      ws.send(JSON.stringify({ action: "subscribe", symbols: toAdd.join(",") }));
      for (const t of toAdd) subscribed.add(t);
      log("subscribed", toAdd.length, toAdd.slice(0, 8).join(","), toAdd.length > 8 ? "…" : "");
    }
    if (toRemove.length) {
      ws.send(JSON.stringify({ action: "unsubscribe", symbols: toRemove.join(",") }));
      for (const t of toRemove) subscribed.delete(t);
      log("unsubscribed", toRemove.length);
    }
    subscribedSymbols = subscribed;
    health.subscribed = subscribed.size;
  };

  ws.on("open", () => log("websocket connecting…"));

  ws.on("message", (raw) => {
    const text = raw.toString();
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      if (text.includes("Authorized") || text.includes("status_code")) {
        authorized = true;
        health.authorized = true;
        log("authorized", text.slice(0, 120));
        void syncSubscriptions();
        startWatchPoll();
      }
      return;
    }

    if (msg.status_code != null) {
      authorized = msg.status_code === 200;
      health.authorized = authorized;
      log("auth status", msg.status_code, msg.message ?? "");
      if (authorized) {
        void syncSubscriptions();
        startWatchPoll();
      }
      return;
    }

    const sym = typeof msg.s === "string" ? normalizeStockTicker(msg.s) : null;
    const price = Number(msg.p);
    let tradeSec = null;
    if (typeof msg.t === "number" && Number.isFinite(msg.t)) {
      tradeSec = msg.t > 1e12 ? Math.floor(msg.t / 1000) : Math.floor(msg.t);
    }
    if (!sym || !Number.isFinite(price) || price <= 0 || tradeSec == null) return;
    queueMinuteClose(sym, tradeSec, price);
  });

  ws.on("close", (code) => {
    log("websocket closed", code);
    stopWatchPoll();
    subscribed = new Set();
    subscribedSymbols = subscribed;
    authorized = false;
    health.authorized = false;
    health.subscribed = 0;
    setTimeout(connectWs, 5000);
  });

  ws.on("error", (err) => log("websocket error", err.message));
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
  health.pendingUpserts = pendingUpserts.size;
  log("heartbeat", {
    session: health.session,
    authorized: health.authorized,
    subscribed: health.subscribed,
    pendingUpserts: health.pendingUpserts,
    lastTradeAt: health.lastTradeAt,
  });
}, HEARTBEAT_MS);

log("starting stock minute ingest (always-on)", {
  curatedMode: stockWsCuratedMode(),
  staticTickers: STATIC_TICKERS.length,
  includeWatchlist: INCLUDE_WATCHLIST,
  includeScreener: INCLUDE_SCREENER,
  includeChartWatch: INCLUDE_CHART_WATCH,
  maxSymbols: MAX_SYMBOLS,
  healthPort: HEALTH_PORT,
  session: getUsEquityMarketSession(),
});

startHealthServer();
connectWs();
