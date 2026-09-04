import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getScreenerUsMarketCacheEpoch,
  type ScreenerUsMarketCacheEpoch,
} from "@/lib/screener/screener-us-market-cache";
import {
  CRYPTO_HUB_MIN_FILL_RATIO,
  isUsableCryptoDerivedHub,
  type CryptoDerivedMetricsSnapshot,
} from "@/lib/screener/eod-derived-metrics";
import { CRYPTO_SCREENER_ALL, CRYPTO_SCREENER_PAGE2, CRYPTO_TOP10 } from "@/lib/market/crypto-meta";

import { MARKET_SNAPSHOT_KEY, type MarketSnapshotKey } from "@/lib/market/market-snapshot-keys";

function isUsableCryptoTabPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const crypto = (payload as { crypto?: Record<string, { price?: number | null }> }).crypto;
  if (!crypto || typeof crypto !== "object") return false;
  let ok = 0;
  for (const m of CRYPTO_TOP10) {
    const row = crypto[m.symbol] ?? crypto[m.symbol.toUpperCase()];
    const p = row?.price;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) ok += 1;
  }
  return ok >= Math.ceil(CRYPTO_TOP10.length * CRYPTO_HUB_MIN_FILL_RATIO);
}

function isUsableCryptoPage2Payload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const crypto = (payload as { crypto?: Record<string, { price?: number | null }> }).crypto;
  if (!crypto || typeof crypto !== "object") return false;
  if (CRYPTO_SCREENER_PAGE2.length === 0) return true;
  let ok = 0;
  for (const m of CRYPTO_SCREENER_PAGE2) {
    const row = crypto[m.symbol] ?? crypto[m.symbol.toUpperCase()];
    const p = row?.price;
    if (typeof p === "number" && Number.isFinite(p) && p > 0) ok += 1;
  }
  return ok >= Math.ceil(CRYPTO_SCREENER_PAGE2.length * CRYPTO_HUB_MIN_FILL_RATIO);
}

export type MarketSnapshotRow = {
  key: string;
  segment: string;
  data: unknown;
  updated_at: string;
};

export function marketSnapshotReadEnabled(): boolean {
  return process.env.FINSEPA_MARKET_SNAPSHOT_READ !== "0";
}

/** Hot quotes: reuse previous 15m segment for SSR until cron retags or re-ingests (matches cron min interval). */
export const MARKET_SNAPSHOT_HOT_STALE_MS = 14 * 60 * 1000;

/** EOD-derived blobs: one fill per regular session day during live hours. */
export const MARKET_SNAPSHOT_SLOW_STALE_MS = 20 * 60 * 60 * 1000;

/** Live/frozen quote segment (15m slot during regular session). */
export function marketSnapshotHotSegment(epoch: ScreenerUsMarketCacheEpoch): string {
  return epoch.segment;
}

/**
 * EOD-derived segment: same as hot when frozen; one row per regular session day when live.
 * Avoids re-fetching hundreds of daily bars on every 15m cron tick.
 */
export function marketSnapshotSlowSegment(epoch: ScreenerUsMarketCacheEpoch): string {
  if (epoch.mode === "frozen") return epoch.segment;
  return `slow-live-${epoch.lastRegularSessionYmd}`;
}

async function readMarketSnapshotForSegment<T>(key: MarketSnapshotKey, segment: string): Promise<T | null> {
  if (!marketSnapshotReadEnabled()) return null;

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  if (data.segment !== segment) return null;
  return data.data as T;
}

/**
 * When the 15m hot segment rolls, exact segment reads miss even though quotes are still fresh.
 * Serve the previous segment for SSR instead of fanning out hundreds of EODHD calls on refresh.
 */
async function readMarketSnapshotWithStaleFallback<T>(
  key: MarketSnapshotKey,
  expectedSegment: string,
  maxStaleMs: number,
  allowStaleFallback = true,
): Promise<T | null> {
  const exact = await readMarketSnapshotForSegment<T>(key, expectedSegment);
  if (exact) return exact;
  if (!allowStaleFallback) return null;

  const row = await readMarketSnapshotRow(key);
  if (!row?.data) return null;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated) || Date.now() - updated > maxStaleMs) return null;
  return row.data as T;
}

/**
 * Read a hot-tier snapshot when segment matches the current US market window.
 * Falls back to the previous segment when still within {@link MARKET_SNAPSHOT_HOT_STALE_MS}.
 */
export async function readMarketSnapshot<T>(key: MarketSnapshotKey): Promise<T | null> {
  const epoch = getScreenerUsMarketCacheEpoch();
  return readMarketSnapshotWithStaleFallback<T>(
    key,
    marketSnapshotHotSegment(epoch),
    MARKET_SNAPSHOT_HOT_STALE_MS,
    epoch.mode !== "frozen",
  );
}

/** Read EOD-derived snapshot (session-day segment during live hours). */
export async function readMarketSnapshotSlow<T>(key: MarketSnapshotKey): Promise<T | null> {
  const epoch = getScreenerUsMarketCacheEpoch();
  return readMarketSnapshotWithStaleFallback<T>(
    key,
    marketSnapshotSlowSegment(epoch),
    MARKET_SNAPSHOT_SLOW_STALE_MS,
  );
}

/**
 * Cron: when the hot segment rolls but payload is still fresh, retag segment without EODHD refetch.
 */
export async function retagRecentMarketSnapshotSegment(
  key: MarketSnapshotKey,
  newSegment: string,
  maxAgeMs: number,
): Promise<boolean> {
  const row = await readMarketSnapshotRow(key);
  if (!row?.data || row.segment === newSegment) return false;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated) || Date.now() - updated > maxAgeMs) return false;
  const res = await upsertMarketSnapshot(key, newSegment, row.data);
  return res.ok;
}

export async function readMarketSnapshotRow(key: MarketSnapshotKey): Promise<MarketSnapshotRow | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("market_snapshot")
    .select("key, segment, data, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error || !data) return null;
  return data as MarketSnapshotRow;
}

export async function upsertMarketSnapshot(
  key: MarketSnapshotKey,
  segment: string,
  payload: unknown,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // `data` is jsonb NOT NULL — bare null/undefined becomes a Postgres 23502.
  if (payload === null || payload === undefined) {
    return { ok: false, reason: "empty_payload" };
  }

  // Never let cron overwrite a healthy weekend hub with a sparse EODHD batch.
  if (key === MARKET_SNAPSHOT_KEY.cryptoTab) {
    if (!isUsableCryptoTabPayload(payload)) {
      return { ok: false, reason: "unusable_crypto_tab" };
    }
  }
  if (key === MARKET_SNAPSHOT_KEY.cryptoPage2) {
    if (!isUsableCryptoPage2Payload(payload)) {
      return { ok: false, reason: "unusable_crypto_page2" };
    }
  }
  if (key === MARKET_SNAPSHOT_KEY.cryptoDerived) {
    if (
      !isUsableCryptoDerivedHub(
        payload as Record<string, CryptoDerivedMetricsSnapshot | null | undefined>,
        CRYPTO_SCREENER_ALL.map((c) => c.symbol),
      )
    ) {
      return { ok: false, reason: "unusable_crypto_derived" };
    }
  }

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

export async function marketSnapshotKeyIsFresh(
  key: MarketSnapshotKey,
  segment: string,
  maxAgeMs: number,
): Promise<boolean> {
  const row = await readMarketSnapshotRow(key);
  if (!row || row.segment !== segment) return false;
  const updated = Date.parse(row.updated_at);
  if (!Number.isFinite(updated)) return false;
  return Date.now() - updated < maxAgeMs;
}

/** True when canonical hot row already ingested for this segment. */
export async function marketSnapshotSegmentIsFresh(segment: string, maxAgeMs: number): Promise<boolean> {
  return marketSnapshotKeyIsFresh(MARKET_SNAPSHOT_KEY.stocksAllPages, segment, maxAgeMs);
}
