import "server-only";

import { normalizeCryptoBaseSymbol } from "@/lib/market/crypto-live-1d-tickers";
import {
  accumulateCryptoMinuteBarPages,
  CRYPTO_MINUTE_BAR_READ_LIMIT,
  CRYPTO_MINUTE_BAR_READ_PAGE_SIZE,
  mapCryptoMinuteBarRows,
  type CryptoMinuteBarRow,
} from "@/lib/market/crypto-session-minute-bar-rows";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export {
  CRYPTO_MINUTE_BAR_READ_LIMIT,
  CRYPTO_MINUTE_BAR_READ_PAGE_SIZE,
  mapCryptoMinuteBarRows,
} from "@/lib/market/crypto-session-minute-bar-rows";

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

  const acc: CryptoMinuteBarRow[] = [];
  let offset = 0;

  // PostgREST/`db-max-rows` caps each response (~1000). Page until the 24h window is complete.
  while (offset < CRYPTO_MINUTE_BAR_READ_LIMIT) {
    const end = Math.min(offset + CRYPTO_MINUTE_BAR_READ_PAGE_SIZE - 1, CRYPTO_MINUTE_BAR_READ_LIMIT - 1);
    const { data, error } = await admin
      .from("crypto_session_minute_bar")
      .select("bucket_unix, close")
      .eq("ticker", base)
      .gte("bucket_unix", fromUnix)
      .order("bucket_unix", { ascending: true })
      .range(offset, end);

    if (error) return [];
    const page = (data ?? []) as CryptoMinuteBarRow[];
    const { done } = accumulateCryptoMinuteBarPages(acc, page);
    if (done) break;
    offset += CRYPTO_MINUTE_BAR_READ_PAGE_SIZE;
  }

  if (!acc.length) return [];
  return mapCryptoMinuteBarRows(acc);
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
