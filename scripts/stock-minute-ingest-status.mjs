#!/usr/bin/env node
/**
 * Verify always-on minute ingest: WS auth + Supabase minute-bar counts for today.
 *
 * Usage: npm run stock:minute-ingest:status
 * Optional: npm run stock:minute-ingest:status -- --ticker=NVDA
 */

import WebSocket from "ws";
import { createClient } from "@supabase/supabase-js";

const ticker = (process.argv.find((a) => a.startsWith("--ticker="))?.slice("--ticker=".length) ?? "NVDA")
  .trim()
  .toUpperCase();

const EODHD_KEY = process.env.EODHD_API_KEY?.trim();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? process.env.SUPABASE_SERVICE_KEY?.trim();

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

function wsAuthCheck() {
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://ws.eodhistoricaldata.com/ws/us?api_token=${encodeURIComponent(EODHD_KEY)}`);
    const timer = setTimeout(() => {
      ws.close();
      resolve({ ok: false, reason: "timeout" });
    }, 8000);
    ws.on("message", (raw) => {
      const text = raw.toString();
      if (text.includes("Authorized") || text.includes('"status_code":200')) {
        clearTimeout(timer);
        ws.close();
        resolve({ ok: true });
      }
    });
    ws.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: e.message });
    });
  });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const [ws, bars, backfill, watch] = await Promise.all([
  wsAuthCheck(),
  supabase
    .from("stock_session_minute_bar")
    .select("bucket_unix", { count: "exact", head: true })
    .eq("ticker", ticker)
    .eq("session_ymd", todayYmd),
  supabase
    .from("stock_session_minute_bar_backfill")
    .select("status, bar_count, api_calls")
    .eq("ticker", ticker)
    .eq("session_ymd", todayYmd)
    .maybeSingle(),
  supabase
    .from("stock_session_minute_bar_watch")
    .select("last_requested_at")
    .eq("ticker", ticker)
    .maybeSingle(),
]);

const healthUrl = process.env.STOCK_MINUTE_INGEST_HEALTH_URL?.trim();

let remoteHealth = null;
if (healthUrl) {
  try {
    const res = await fetch(healthUrl);
    remoteHealth = await res.json();
  } catch (e) {
    remoteHealth = { error: e instanceof Error ? e.message : "fetch_failed" };
  }
}

console.log(
  JSON.stringify(
    {
      at: new Date().toISOString(),
      sessionYmd: todayYmd,
      ticker,
      websocket: ws,
      minuteBarsToday: bars.count ?? 0,
      backfill: backfill.data ?? null,
      chartWatch: watch.data ?? null,
      remoteWorker: remoteHealth,
      hints: {
        fullLiveChartNeeds: "~390 minute bars from 9:30 (WS always-on from open)",
        workerHealthSet: "STOCK_MINUTE_INGEST_HEALTH_URL=https://your-railway-service.up.railway.app/health",
      },
    },
    null,
    2,
  ),
);

if (!ws.ok) process.exit(1);
