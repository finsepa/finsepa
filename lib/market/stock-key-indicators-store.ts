import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { stockKeyIndicatorsSnapshotKey } from "@/lib/market/stock-key-indicators-keys";
import type { StockKeyIndicatorsSnapshot } from "@/lib/market/stock-key-indicators-types";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

export type StockKeyIndicatorsSnapshotRow = {
  key: string;
  segment: string;
  data: StockKeyIndicatorsSnapshot;
  updated_at: string;
};

const SEGMENT = "v1";

export async function readStockKeyIndicatorsSnapshot(
  ticker: string,
): Promise<StockKeyIndicatorsSnapshotRow | null> {
  const key = stockKeyIndicatorsSnapshotKey(ticker);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return data as StockKeyIndicatorsSnapshotRow;
}

export async function upsertStockKeyIndicatorsSnapshot(
  ticker: string,
  payload: StockKeyIndicatorsSnapshot,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = stockKeyIndicatorsSnapshotKey(ticker);
  if (!key) return { ok: false, reason: "invalid_ticker" };

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, reason: "no_supabase_admin" };

  const { error } = await admin.from("market_snapshot").upsert(
    {
      key,
      segment: SEGMENT,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
