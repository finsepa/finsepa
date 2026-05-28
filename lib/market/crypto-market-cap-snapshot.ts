import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

const SEGMENT = "crypto_market_cap_v1";

function keyFor(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return null;
  return `crypto_market_cap_${s}`;
}

export async function readCryptoMarketCapSnapshot(symbol: string): Promise<number | null | undefined> {
  const key = keyFor(symbol);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin.from("market_snapshot").select("key, segment, data").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== SEGMENT) return undefined;
  return typeof data.data === "number" || data.data === null ? (data.data as number | null) : undefined;
}

export async function upsertCryptoMarketCapSnapshot(symbol: string, marketCapUsd: number | null): Promise<void> {
  const key = keyFor(symbol);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    { key, segment: SEGMENT, data: marketCapUsd, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

