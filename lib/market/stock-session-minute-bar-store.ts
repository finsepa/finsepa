import "server-only";

import { STOCK_DISPLAY_TZ } from "@/lib/market/chart-timestamp-format";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type StockSessionMinuteBarRow = {
  ticker: string;
  session_ymd: string;
  bucket_unix: number;
  close: number;
  updated_at: string;
};

/** WS-priority tickers need fewer stored bars; polled tickers need real coverage. */
export const MIN_STOCK_SESSION_MINUTE_BARS_FOR_LIVE_CHART = 3;

export function stockSessionMinuteBarReadEnabled(): boolean {
  return process.env.FINSEPA_STOCK_MINUTE_BAR_READ !== "0";
}

export function stockSessionMinuteBarWriteEnabled(): boolean {
  return process.env.FINSEPA_STOCK_MINUTE_BAR_WRITE !== "0";
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function fetchStockSessionMinuteBarsFromDb(
  ticker: string,
  sessionYmd: string,
): Promise<StockChartPoint[]> {
  if (!stockSessionMinuteBarReadEnabled()) return [];

  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const sym = normalizeTicker(ticker);
  const { data, error } = await admin
    .from("stock_session_minute_bar")
    .select("bucket_unix, close, session_ymd")
    .eq("ticker", sym)
    .eq("session_ymd", sessionYmd)
    .order("bucket_unix", { ascending: true });

  if (error || !data?.length) return [];

  const points: StockChartPoint[] = [];
  for (const row of data) {
    const time = Number(row.bucket_unix);
    const value = Number(row.close);
    if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) continue;
    points.push({
      time,
      value,
      sessionDate: sessionYmd,
      timeZone: STOCK_DISPLAY_TZ,
    });
  }
  return points;
}

export async function upsertStockSessionMinuteBarToDb(
  ticker: string,
  sessionYmd: string,
  bucketUnix: number,
  close: number,
): Promise<void> {
  await upsertStockSessionMinuteBarsBatchToDb(ticker, sessionYmd, [{ bucket_unix: bucketUnix, close }]);
}

export async function upsertStockSessionMinuteBarsBatchToDb(
  ticker: string,
  sessionYmd: string,
  bars: readonly { bucket_unix: number; close: number }[],
): Promise<void> {
  if (!stockSessionMinuteBarWriteEnabled()) return;
  if (!bars.length) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const sym = normalizeTicker(ticker);
  if (!sym) return;

  const now = new Date().toISOString();
  const rows = bars
    .filter((b) => Number.isFinite(b.bucket_unix) && Number.isFinite(b.close) && b.close > 0)
    .map((b) => ({
      ticker: sym,
      session_ymd: sessionYmd,
      bucket_unix: b.bucket_unix,
      close: b.close,
      updated_at: now,
    }));

  if (!rows.length) return;

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await admin.from("stock_session_minute_bar").upsert(chunk, {
      onConflict: "ticker,bucket_unix",
    });
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[stock minute bar] batch upsert failed", { ticker: sym, error: error.message });
    }
  }
}

export type LatestStockSessionMinuteBar = {
  bucket_unix: number;
  close: number;
  updated_at: string;
};

/** Newest 1m bucket for a ticker/session — used to prefer WS store over stale REST. */
export async function fetchLatestStockSessionMinuteBarFromDb(
  ticker: string,
  sessionYmd: string,
): Promise<LatestStockSessionMinuteBar | null> {
  if (!stockSessionMinuteBarReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const sym = normalizeTicker(ticker);
  const { data, error } = await admin
    .from("stock_session_minute_bar")
    .select("bucket_unix, close, updated_at")
    .eq("ticker", sym)
    .eq("session_ymd", sessionYmd)
    .order("bucket_unix", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const bucket_unix = Number(data.bucket_unix);
  const close = Number(data.close);
  const updated_at = typeof data.updated_at === "string" ? data.updated_at : "";
  if (!Number.isFinite(bucket_unix) || !Number.isFinite(close) || close <= 0 || !updated_at) {
    return null;
  }
  return { bucket_unix, close, updated_at };
}

export async function countStockSessionMinuteBarsInDb(
  ticker: string,
  sessionYmd: string,
): Promise<number> {
  if (!stockSessionMinuteBarReadEnabled()) return 0;

  const admin = getSupabaseAdminClient();
  if (!admin) return 0;

  const sym = normalizeTicker(ticker);
  const { count, error } = await admin
    .from("stock_session_minute_bar")
    .select("bucket_unix", { count: "exact", head: true })
    .eq("ticker", sym)
    .eq("session_ymd", sessionYmd);

  if (error) return 0;
  return count ?? 0;
}

export type StockSessionMinuteBarBackfillRow = {
  ticker: string;
  session_ymd: string;
  status: string;
  bar_count: number | null;
  api_calls: number | null;
  last_error: string | null;
  completed_at: string | null;
  updated_at: string;
};

export async function fetchStockSessionMinuteBarBackfillRow(
  ticker: string,
  sessionYmd: string,
): Promise<StockSessionMinuteBarBackfillRow | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const sym = normalizeTicker(ticker);
  const { data, error } = await admin
    .from("stock_session_minute_bar_backfill")
    .select("ticker, session_ymd, status, bar_count, api_calls, last_error, completed_at, updated_at")
    .eq("ticker", sym)
    .eq("session_ymd", sessionYmd)
    .maybeSingle();

  if (error || !data) return null;
  return data as StockSessionMinuteBarBackfillRow;
}

export async function upsertStockSessionMinuteBarBackfillRow(
  ticker: string,
  sessionYmd: string,
  patch: {
    status: string;
    barCount?: number | null;
    apiCalls?: number | null;
    lastError?: string | null;
    completedAt?: string | null;
  },
): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const sym = normalizeTicker(ticker);
  const row: Record<string, unknown> = {
    ticker: sym,
    session_ymd: sessionYmd,
    status: patch.status,
    updated_at: new Date().toISOString(),
  };
  if (patch.barCount !== undefined) row.bar_count = patch.barCount;
  if (patch.apiCalls !== undefined) row.api_calls = patch.apiCalls;
  if (patch.lastError !== undefined) row.last_error = patch.lastError;
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;

  await admin.from("stock_session_minute_bar_backfill").upsert(row, {
    onConflict: "ticker,session_ymd",
  });
}

export async function listPendingStockSessionTickBackfillRows(
  limit: number,
): Promise<{ ticker: string; session_ymd: string }[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("stock_session_minute_bar_backfill")
    .select("ticker, session_ymd")
    .in("status", ["pending", "partial", "failed"])
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    ticker: String(row.ticker).trim().toUpperCase(),
    session_ymd: String(row.session_ymd),
  }));
}

function normalizeWatchlistStockTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase();
  if (!t || t.includes(":") || t.includes("/") || t.startsWith("$")) return null;
  const base = t.replace(/\.US$/i, "").split(".")[0];
  if (!base || !/^[A-Z0-9-]{1,8}$/.test(base)) return null;
  return base;
}

export async function listDistinctWatchlistStockTickers(): Promise<string[]> {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data, error } = await admin.from("watchlist").select("ticker").limit(10_000);
  if (error || !data) return [];

  const set = new Set<string>();
  for (const row of data) {
    const sym = normalizeWatchlistStockTicker(String(row.ticker ?? ""));
    if (sym) set.add(sym);
  }
  return Array.from(set);
}

/** Mark ticker as recently viewed so the WS ingestor keeps streaming it. */
export async function touchStockSessionMinuteBarWatch(ticker: string): Promise<void> {
  if (!stockSessionMinuteBarWriteEnabled()) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const sym = normalizeTicker(ticker);
  if (!sym) return;

  const { error } = await admin.from("stock_session_minute_bar_watch").upsert(
    {
      ticker: sym,
      last_requested_at: new Date().toISOString(),
    },
    { onConflict: "ticker" },
  );

  if (error && process.env.NODE_ENV === "development") {
    console.warn("[stock minute bar] watch touch failed", { ticker: sym, error: error.message });
  }
}
