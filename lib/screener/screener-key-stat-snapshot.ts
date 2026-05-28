import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

const SEGMENT = "screener_key_stat_v1";

function keyFor(metricId: string, ticker: string): string | null {
  const m = metricId.trim();
  const t = ticker.trim().toUpperCase();
  if (!m || !t) return null;
  return `screener_key_stat_${m}_${t}`;
}

export async function readScreenerKeyStatCellSnapshot(
  metricId: string,
  ticker: string,
): Promise<string | undefined> {
  const key = keyFor(metricId, ticker);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin.from("market_snapshot").select("key, segment, data").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== SEGMENT) return undefined;
  return typeof data.data === "string" ? data.data : undefined;
}

export async function upsertScreenerKeyStatCellSnapshot(
  metricId: string,
  ticker: string,
  value: string,
): Promise<void> {
  const key = keyFor(metricId, ticker);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: SEGMENT,
      data: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

