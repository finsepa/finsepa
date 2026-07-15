import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

const SEGMENT = "crypto_market_cap_v1";

/** Stored as an object so JSON `null` never lands in `market_snapshot.data` (NOT NULL). */
type CryptoMarketCapPayload = { marketCapUsd: number | null };

function keyFor(symbol: string): string | null {
  const s = symbol.trim().toUpperCase();
  if (!s) return null;
  return `crypto_market_cap_${s}`;
}

function parseMarketCapPayload(raw: unknown): number | null | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  // Legacy: bare JSON null was attempted historically and failed INSERT; ignore.
  if (raw === null) return null;
  if (raw && typeof raw === "object" && "marketCapUsd" in raw) {
    const v = (raw as CryptoMarketCapPayload).marketCapUsd;
    if (v === null) return null;
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

export async function readCryptoMarketCapSnapshot(symbol: string): Promise<number | null | undefined> {
  const key = keyFor(symbol);
  if (!key || !marketSnapshotReadEnabled()) return undefined;
  const admin = getSupabaseAdminClient();
  if (!admin) return undefined;

  const { data, error } = await admin.from("market_snapshot").select("key, segment, data").eq("key", key).maybeSingle();
  if (error || !data) return undefined;
  if (data.segment !== SEGMENT) return undefined;
  return parseMarketCapPayload(data.data);
}

export async function upsertCryptoMarketCapSnapshot(symbol: string, marketCapUsd: number | null): Promise<void> {
  const key = keyFor(symbol);
  if (!key) return;
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const payload: CryptoMarketCapPayload = {
    marketCapUsd: marketCapUsd != null && Number.isFinite(marketCapUsd) ? marketCapUsd : null,
  };

  await admin.from("market_snapshot").upsert(
    { key, segment: SEGMENT, data: payload, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}
