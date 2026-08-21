import "server-only";

import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

const SEGMENT_PREFIX = "screener_eod_bars_v1";

function keyForSymbol(symbolOrTicker: string): string | null {
  const s = symbolOrTicker.trim().toUpperCase();
  if (!s) return null;
  return `screener_eod_bars_${s}`;
}

function segmentForNow(): string {
  const epoch = getScreenerUsMarketCacheEpoch();
  return `${SEGMENT_PREFIX}:${epoch.segment}`;
}

export async function readScreenerEodBarsSnapshot(symbolOrTicker: string): Promise<EodhdDailyBar[] | null | undefined> {
  const key = keyForSymbol(symbolOrTicker);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin.from("market_snapshot").select("key, segment, data").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== segmentForNow()) return undefined;
  return data.data as EodhdDailyBar[] | null;
}

/**
 * Persist non-empty screener EOD bars. Skip null/undefined — `market_snapshot.data`
 * is jsonb NOT NULL; writing SQL null raises Postgres 23502.
 *
 * Empty vs missing stays distinguishable for callers of {@link readScreenerEodBarsSnapshot}:
 * - no row / segment miss → `undefined` (missing)
 * - fetch with zero bars → caller returns `null` without writing (same as today; null upserts never succeeded)
 */
export async function upsertScreenerEodBarsSnapshot(
  symbolOrTicker: string,
  bars: EodhdDailyBar[] | null | undefined,
): Promise<void> {
  if (bars == null) return;

  const key = keyForSymbol(symbolOrTicker);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: segmentForNow(),
      data: bars,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

