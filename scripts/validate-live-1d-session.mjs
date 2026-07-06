#!/usr/bin/env node
/**
 * Live 1D session validation snapshot (reference tickers: AAPL, NVDA, SPY, QQQ).
 * Run every 15–30 min during regular hours; compare visually to Google Finance.
 *
 * Usage:
 *   npm run stock:validate-1d-session
 *   npm run stock:validate-1d-session -- --tickers=AAPL,NVDA,SPY,QQQ
 */

import { createClient } from "@supabase/supabase-js";

const DISPLAY_TZ = "America/New_York";
const LIVE_TICKERS = ["AAPL", "NVDA", "SPY", "QQQ"];

const tickersArg = process.argv.find((a) => a.startsWith("--tickers="))?.slice("--tickers=".length);
const tickers = (tickersArg ? tickersArg.split(",") : LIVE_TICKERS)
  .map((t) => t.trim().toUpperCase())
  .filter(Boolean);

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();
const HEALTH_URL = process.env.STOCK_MINUTE_INGEST_HEALTH_URL?.trim();

if (!EODHD_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing EODHD_API_KEY, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fmtEt(sec) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(sec * 1000));
}

function sessionYmdNow() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function usSessionOpenSec(ymd) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const probe = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_TZ,
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const m = off.match(/GMT([+-])(\d+)(?::(\d+))?/);
  let offsetMin = 300;
  if (m) {
    const sign = m[1] === "+" ? 1 : -1;
    offsetMin = sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] || "0", 10));
  }
  return Math.floor((Date.UTC(y, mo - 1, d, 9, 30, 0) - offsetMin * 60 * 1000) / 1000);
}

async function fetchRealtime(ticker) {
  const res = await fetch(
    `https://eodhd.com/api/real-time/${encodeURIComponent(ticker)}.US?api_token=${encodeURIComponent(EODHD_KEY)}&fmt=json`,
  );
  if (!res.ok) return null;
  return res.json();
}

async function snapshotTicker(ticker, sessionYmd, nowSec, openSec) {
  const elapsedMin = Math.max(0, Math.floor((nowSec - openSec) / 60));
  const minBarsExpected = Math.max(1, Math.floor(elapsedMin * 0.5));

  const { count } = await supabase
    .from("stock_session_minute_bar")
    .select("*", { count: "exact", head: true })
    .eq("ticker", ticker)
    .eq("session_ymd", sessionYmd);

  const { data: latest } = await supabase
    .from("stock_session_minute_bar")
    .select("bucket_unix, close, updated_at")
    .eq("ticker", ticker)
    .eq("session_ymd", sessionYmd)
    .order("bucket_unix", { ascending: false })
    .limit(5);

  const rt = await fetchRealtime(ticker);
  const headerClose = typeof rt?.close === "number" ? rt.close : null;
  const last = latest?.[0];
  const lastBarSec = last ? Number(last.bucket_unix) : null;
  const lastClose = last ? Number(last.close) : null;
  const lagMin = lastBarSec != null ? Math.floor((nowSec - lastBarSec) / 60) : null;
  const headerDelta =
    headerClose != null && lastClose != null ? (headerClose - lastClose).toFixed(4) : null;

  const closes = (latest ?? []).map((r) => Number(r.close)).filter((n) => Number.isFinite(n));
  const spread =
    closes.length >= 2 ? (Math.max(...closes) - Math.min(...closes)).toFixed(4) : "n/a";

  const coveragePct =
    elapsedMin > 0 && count != null ? ((count / elapsedMin) * 100).toFixed(0) : "n/a";

  return {
    ticker,
    wsBarCount: count ?? 0,
    elapsedMinSinceOpen: elapsedMin,
    minBarsExpectedRough: minBarsExpected,
    coveragePct: `${coveragePct}%`,
    lastBars: (latest ?? []).map((r) => ({
      et: fmtEt(Number(r.bucket_unix)),
      close: Number(r.close),
    })),
    lagMinutesBehindNow: lagMin,
    lastBarClose: lastClose,
    headerClose,
    headerVsLastBar: headerDelta,
    recentSpread: spread,
  };
}

const now = new Date();
const nowSec = Math.floor(now.getTime() / 1000);
const sessionYmd = sessionYmdNow();
const openSec = usSessionOpenSec(sessionYmd);

console.log("=== Live 1D session validation ===");
console.log(
  JSON.stringify(
    {
      atUtc: now.toISOString(),
      atEt: fmtEt(nowSec),
      sessionYmd,
      compareWith: "https://www.google.com/finance/quote/AAPL:NASDAQ (and NVDA)",
    },
    null,
    2,
  ),
);
console.log("");

for (const ticker of tickers) {
  const snap = await snapshotTicker(ticker, sessionYmd, nowSec, openSec);
  console.log(JSON.stringify(snap, null, 2));
  console.log("");
}

if (HEALTH_URL) {
  try {
    const health = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(10_000) }).then((r) => r.json());
    console.log(
      "worker",
      JSON.stringify(
        {
          subscribed: health.subscribed,
          pendingUpserts: health.pendingUpserts,
          lastTradeAt: health.lastTradeAt,
          lastWsActivityAt: health.lastWsActivityAt,
          session: health.session,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.log("worker", { error: err instanceof Error ? err.message : String(err) });
  }
} else {
  console.log("worker", "(set STOCK_MINUTE_INGEST_HEALTH_URL to include Railway health)");
}

console.log("");
console.log("Manual checks vs Google Finance:");
console.log("  1. Session shape: open → high → low → close roughly matches (not flat all day)");
console.log("  2. No barcode / vertical spikes / time going backwards");
console.log("  3. Header price may differ slightly from chart tail (expected under Option B)");
console.log("  4. Flag if lagMinutesBehindNow > 3 or wsBarCount << minBarsExpectedRough");
