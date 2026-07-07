import "server-only";

import { normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export function cryptoMinuteBarReadEnabled(): boolean {
  return process.env.FINSEPA_CRYPTO_MINUTE_BAR_READ !== "0";
}

/** Live 1m closes for a crypto ticker at or after `fromUnix` (ascending). UTC time axis. */
export async function fetchCryptoMinuteBarsFromDb(
  symbol: string,
  fromUnix: number,
): Promise<StockChartPoint[]> {
  if (!cryptoMinuteBarReadEnabled()) return [];

  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base) return [];

  const { data, error } = await admin
    .from("crypto_session_minute_bar")
    .select("bucket_unix, close")
    .eq("ticker", base)
    .gte("bucket_unix", fromUnix)
    .order("bucket_unix", { ascending: true });

  if (error || !data?.length) return [];

  const points: StockChartPoint[] = [];
  for (const row of data) {
    const time = Number(row.bucket_unix);
    const value = Number(row.close);
    if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) continue;
    points.push({ time, value, timeZone: "UTC" });
  }
  return points;
}

export type LatestCryptoMinuteBar = { bucket_unix: number; close: number };

/** Newest stored 1m bucket — used by header live price to prefer WS over REST when fresh. */
export async function fetchLatestCryptoMinuteBarFromDb(
  symbol: string,
): Promise<LatestCryptoMinuteBar | null> {
  if (!cryptoMinuteBarReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const base = normalizeCryptoBaseSymbol(symbol);
  if (!base) return null;

  const { data, error } = await admin
    .from("crypto_session_minute_bar")
    .select("bucket_unix, close")
    .eq("ticker", base)
    .order("bucket_unix", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const bucket_unix = Number(data.bucket_unix);
  const close = Number(data.close);
  if (!Number.isFinite(bucket_unix) || !Number.isFinite(close) || close <= 0) return null;
  return { bucket_unix, close };
}
