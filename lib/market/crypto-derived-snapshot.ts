import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";
import { getScreenerUsMarketCacheEpoch } from "@/lib/screener/screener-us-market-cache";

export type CryptoDerivedSnapshot = {
  changePercent7D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  last5DailyCloses: number[];
};

const SEGMENT_PREFIX = "crypto_derived_v1";

function keyFor(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return null;
  return `crypto_derived_${s}`;
}

function segmentForNow(): string {
  const epoch = getScreenerUsMarketCacheEpoch();
  return `${SEGMENT_PREFIX}:${epoch.segment}`;
}

export async function readCryptoDerivedSnapshot(symbol: string): Promise<CryptoDerivedSnapshot | null | undefined> {
  const key = keyFor(symbol);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin.from("market_snapshot").select("key, segment, data").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== segmentForNow()) return undefined;
  return data.data as CryptoDerivedSnapshot | null;
}

export async function upsertCryptoDerivedSnapshot(symbol: string, snap: CryptoDerivedSnapshot | null): Promise<void> {
  const key = keyFor(symbol);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    { key, segment: segmentForNow(), data: snap, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

