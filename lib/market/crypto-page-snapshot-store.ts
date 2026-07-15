import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CryptoPageInitialData } from "@/lib/market/crypto-page-initial-data";
import { marketSnapshotReadEnabled } from "@/lib/market/market-snapshot-store";

/** How long a prior-segment crypto page snapshot stays usable (hot-refresh only). */
export const CRYPTO_PAGE_SNAPSHOT_STALE_MAX_MS = 6 * 60 * 60 * 1000;

export type CryptoPageSnapshotPayload = Omit<CryptoPageInitialData, "headerLiveSpotUsd"> & {
  headerLiveSpotUsd?: number | null;
};

/** Supabase `market_snapshot.key` for a crypto detail page bundle. */
export function cryptoPageSnapshotKey(symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  return sym ? `asset_crypto_${sym}` : "";
}

/** 15m UTC slots — crypto trades 24/7, so equity market sessions are a poor fit. */
export function getCryptoPageCacheSegment(now: Date = new Date()): string {
  const slot = Math.floor(now.getTime() / (15 * 60 * 1000));
  return `crypto_page_v1:${slot}`;
}

export function stripCryptoPageSnapshotHotFields(data: CryptoPageInitialData): CryptoPageSnapshotPayload {
  const { headerLiveSpotUsd: _spot, ...rest } = data;
  return {
    ...rest,
    // Keep daily chart + session points in the snapshot; live spot is refreshed on read.
    headerLiveSpotUsd: null,
  };
}

export function cryptoPageSnapshotToPageData(payload: CryptoPageSnapshotPayload): CryptoPageInitialData {
  return {
    ...payload,
    headerLiveSpotUsd:
      typeof payload.headerLiveSpotUsd === "number" &&
      Number.isFinite(payload.headerLiveSpotUsd) &&
      payload.headerLiveSpotUsd > 0
        ? payload.headerLiveSpotUsd
        : null,
  };
}

/**
 * Exact segment match, or — when `allowStale` — last snapshot within
 * {@link CRYPTO_PAGE_SNAPSHOT_STALE_MAX_MS}.
 */
export async function readCryptoPageSnapshot(
  symbol: string,
  segment: string,
  opts?: { allowStale?: boolean; maxStaleMs?: number },
): Promise<{ payload: CryptoPageSnapshotPayload; exactSegment: boolean } | null> {
  const key = cryptoPageSnapshotKey(symbol);
  if (!key || !marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data?.data) return null;
  const payload = data.data as CryptoPageSnapshotPayload;
  const sym = symbol.trim().toUpperCase();
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.routeSymbol?.trim().toUpperCase() !== sym
  ) {
    return null;
  }

  if (data.segment === segment) {
    return { payload, exactSegment: true };
  }

  if (!opts?.allowStale) return null;

  const maxStale = opts.maxStaleMs ?? CRYPTO_PAGE_SNAPSHOT_STALE_MAX_MS;
  const updatedAt = Date.parse(typeof data.updated_at === "string" ? data.updated_at : "");
  if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxStale) return null;

  return { payload, exactSegment: false };
}

export async function upsertCryptoPageSnapshot(
  symbol: string,
  segment: string,
  payload: CryptoPageSnapshotPayload,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = cryptoPageSnapshotKey(symbol);
  if (!key) return { ok: false, reason: "invalid_symbol" };

  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, reason: "no_supabase_admin" };

  const { error } = await admin.from("market_snapshot").upsert(
    {
      key,
      segment,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
