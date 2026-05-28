import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

export type StockHeaderIdentitySnapshot = {
  fullName: string | null;
  logoUrl: string | null;
  exchange: string | null;
  countryIso: string | null;
  sector: string | null;
  industry: string | null;
};

function identityKey(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;
  // Keep within Postgres text constraints; ticker set is already validated upstream.
  return `stock_header_identity_${t}`;
}

const IDENTITY_SEGMENT = "identity_static_v1";

export async function readStockHeaderIdentitySnapshot(
  ticker: string,
): Promise<StockHeaderIdentitySnapshot | null> {
  const key = identityKey(ticker);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  if (data.segment !== IDENTITY_SEGMENT) return null;
  return data.data as StockHeaderIdentitySnapshot;
}

export async function upsertStockHeaderIdentitySnapshot(
  ticker: string,
  payload: StockHeaderIdentitySnapshot,
): Promise<void> {
  const key = identityKey(ticker);
  if (!key) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("market_snapshot").upsert(
    {
      key,
      segment: IDENTITY_SEGMENT,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}

