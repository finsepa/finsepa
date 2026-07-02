#!/usr/bin/env node
/**
 * End-to-end smoke test for live stock prices (AAPL by default).
 * Usage: npm run stock:verify-live -- --ticker=AAPL
 */

import { createClient } from "@supabase/supabase-js";

const ticker = (process.argv.find((a) => a.startsWith("--ticker="))?.slice("--ticker=".length) ?? "AAPL")
  .trim()
  .toUpperCase();

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();
const HEALTH_URL = process.env.STOCK_MINUTE_INGEST_HEALTH_URL?.trim();
const APP_URL = process.env.STOCK_VERIFY_APP_URL?.trim() ?? "http://localhost:3000";

if (!EODHD_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing EODHD_API_KEY, NEXT_PUBLIC_SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DISPLAY_TZ = "America/New_York";
const todayYmd = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
}

const rt = await fetch(
  `https://eodhd.com/api/real-time/${encodeURIComponent(ticker)}.US?api_token=${encodeURIComponent(EODHD_KEY)}&fmt=json`,
).then((r) => r.json());

const rtClose = typeof rt.close === "number" ? rt.close : null;
const rtTs = typeof rt.timestamp === "number" ? rt.timestamp : null;
if (rtClose != null && rtClose > 0) {
  pass("eodhd-realtime", { close: rtClose, ts: rtTs ? new Date(rtTs * 1000).toISOString() : null });
} else {
  fail("eodhd-realtime", rt);
}

const { data: bars, count } = await supabase
  .from("stock_session_minute_bar")
  .select("close, bucket_unix, updated_at", { count: "exact" })
  .eq("ticker", ticker)
  .eq("session_ymd", todayYmd)
  .order("bucket_unix", { ascending: false })
  .limit(20);

const uniquePrices = [...new Set((bars ?? []).map((r) => r.close))];
if ((count ?? 0) >= 5) {
  pass("supabase-minute-bars-count", { count });
} else {
  fail("supabase-minute-bars-count", { count });
}
if (uniquePrices.length >= 2) {
  const min = Math.min(...uniquePrices);
  const max = Math.max(...uniquePrices);
  const spread = max - min;
  if (spread >= 0.5) {
    pass("supabase-minute-bars-variation", { uniquePrices: uniquePrices.slice(0, 6), spread });
  } else {
    fail("supabase-minute-bars-variation", {
      uniquePrices,
      spread,
      note: "near-flat bars — worker may not be writing real ticks",
    });
  }
} else {
  fail("supabase-minute-bars-variation", { uniquePrices, note: "flat bars — worker may not be writing" });
}

if (HEALTH_URL) {
  try {
    const health = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(12_000) }).then((r) => r.json());
    if (health.ok && (health.authorized || (health.subscribed ?? 0) > 0)) {
      pass("railway-worker-health", health);
    } else {
      fail("railway-worker-health", health);
    }
  } catch (e) {
    fail("railway-worker-health", e instanceof Error ? e.message : String(e));
  }
} else {
  fail("railway-worker-health", "STOCK_MINUTE_INGEST_HEALTH_URL not set");
}

try {
  const chartRes = await fetch(
    `${APP_URL}/api/stocks/${encodeURIComponent(ticker)}/chart?range=1D&series=price`,
    { signal: AbortSignal.timeout(20_000) },
  );
  if (chartRes.ok) {
    const json = await chartRes.json();
    const points = Array.isArray(json.points) ? json.points : [];
    const prices = [...new Set(points.map((p) => Math.round(p.value * 100) / 100))];
    const last = points[points.length - 1];
    if (points.length >= 2) {
      pass("app-chart-api", {
        pointCount: points.length,
        uniquePrices: prices.slice(0, 8),
        lastPrice: last?.value ?? null,
      });
    } else {
      fail("app-chart-api", { pointCount: points.length, body: json });
    }
  } else if (chartRes.status === 401) {
    pass("app-chart-api", { skipped: true, reason: "auth required — test chart via stock page in browser" });
  } else {
    fail("app-chart-api", { status: chartRes.status, hint: "Is `npm run dev` running?" });
  }
} catch (e) {
  fail("app-chart-api", e instanceof Error ? e.message : String(e));
}

// Chart fallback sanity: today's REST open + close should differ (same source as stock page fallback).
if (rtClose != null && typeof rt.open === "number" && rt.open > 0) {
  const spread = Math.abs(rtClose - rt.open);
  if (spread >= 0.01) {
    pass("eodhd-session-spread", { open: rt.open, close: rtClose, spread: Number(spread.toFixed(2)) });
  } else {
    fail("eodhd-session-spread", { open: rt.open, close: rtClose });
  }
}

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ at: new Date().toISOString(), ticker, checks }, null, 2));
process.exit(failed.length ? 1 : 0);
