/**
 * Persist CUSIP → ticker resolutions learned at ingest (OpenFIGI / EODHD).
 * Speeds subsequent refreshes and improves coverage without UI changes.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

export const SUPERINVESTOR_CUSIP_TICKER_MAP_KEY = "superinvestor_13f_cusip_ticker_v1";

export async function readSuperinvestorCusipTickerMap(): Promise<Record<string, string>> {
  if (!marketSnapshotReadEnabled()) return {};
  const admin = getSupabaseAdminClient();
  if (!admin) return {};

  const { data, error } = await admin
    .from("market_snapshot")
    .select("data")
    .eq("key", SUPERINVESTOR_CUSIP_TICKER_MAP_KEY)
    .maybeSingle();

  if (error || !data?.data || typeof data.data !== "object") return {};
  const map = (data.data as { map?: Record<string, string> }).map;
  if (!map || typeof map !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string" && v.trim()) out[k.toUpperCase()] = v.trim().toUpperCase();
  }
  return out;
}

export async function mergeSuperinvestorCusipTickerMap(
  additions: Record<string, string>,
): Promise<number> {
  const entries = Object.entries(additions).filter(([k, v]) => k.length >= 6 && v.trim());
  if (!entries.length) return 0;

  const admin = getSupabaseAdminClient();
  if (!admin) return 0;

  const existing = await readSuperinvestorCusipTickerMap();
  let added = 0;
  for (const [k, v] of entries) {
    const key = k.toUpperCase();
    const val = v.trim().toUpperCase().replace(/\.US$/i, "");
    if (!existing[key]) added += 1;
    existing[key] = val;
  }

  await admin.from("market_snapshot").upsert(
    {
      key: SUPERINVESTOR_CUSIP_TICKER_MAP_KEY,
      segment: "map",
      data: { map: existing, updatedAt: new Date().toISOString(), size: Object.keys(existing).length },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  return added;
}
