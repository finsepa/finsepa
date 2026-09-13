import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_IDENTITY } from "@/lib/data/cache-policy";
import { withScreenerUsMarketCache } from "@/lib/screener/screener-us-market-cache";
import { type EodhdTopUniverseRow, fetchEodhdTopByMarketCap } from "@/lib/market/eodhd-screener";
import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { filterUniverseRowsRemovingOtcDuplicates } from "@/lib/market/otc-duplicate-tickers";
import { filterIssuerLineDuplicatesInUniverse } from "@/lib/screener/universe-issuer-dedupe";
import {
  filterScreenerTop500ExcludedTickers,
  normalizeTop500SnapshotRows,
  type TopCompanyUniverseRow,
} from "@/lib/screener/top500-snapshot-normalize";

export type { TopCompanyUniverseRow } from "@/lib/screener/top500-snapshot-normalize";
export {
  filterScreenerTop500ExcludedTickers,
  normalizeTop500SnapshotRows,
} from "@/lib/screener/top500-snapshot-normalize";

function mergeUniversePages(pages: readonly EodhdTopUniverseRow[][]): TopCompanyUniverseRow[] {
  const combined = pages.flat();
  const byTicker = new Map<string, TopCompanyUniverseRow>();
  for (const r of combined) {
    const prev = byTicker.get(r.ticker);
    if (!prev || r.marketCapUsd > prev.marketCapUsd) byTicker.set(r.ticker, r);
  }
  const out = Array.from(byTicker.values());
  out.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
  const cleaned = filterIssuerLineDuplicatesInUniverse(filterUniverseRowsRemovingOtcDuplicates(out));
  return filterScreenerTop500ExcludedTickers(cleaned);
}

async function fetchScreenerPageGroup(offsets: readonly number[]): Promise<EodhdTopUniverseRow[][]> {
  const settled = await Promise.allSettled(offsets.map((offset) => fetchEodhdTopByMarketCap({ limit: 100, offset })));
  const pages: EodhdTopUniverseRow[][] = [];
  for (const s of settled) {
    pages.push(s.status === "fulfilled" ? s.value : []);
  }
  return pages;
}

async function buildTop500UniverseUncached(): Promise<TopCompanyUniverseRow[]> {
  const wave1 = await fetchScreenerPageGroup([0, 100, 200, 300, 400]);
  let merged = mergeUniversePages(wave1);
  /** ETFs are stripped in {@link fetchEodhdTopByMarketCap}; pull deeper offsets so we still fill ~500 equities. */
  if (merged.length < 500) {
    const wave2 = await fetchScreenerPageGroup([500, 600, 700, 800, 900]);
    merged = mergeUniversePages([...wave1, ...wave2]);
  }
  return merged.slice(0, 500);
}

/** Cron ingest — one EODHD screener fan-out per 15m slot for all users. */
export async function buildTop500MarketSnapshotForIngest(): Promise<TopCompanyUniverseRow[]> {
  return buildTop500UniverseUncached();
}

/**
 * Prefer cron `top500_market` so a 7d identity-cache miss does not fan out EODHD on a visitor.
 * Falls back to live EODHD screener pages only when the snapshot is missing/unusable.
 */
async function loadTop500UniversePreferSnapshot(): Promise<TopCompanyUniverseRow[]> {
  const fromSnapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market);
  const normalized = normalizeTop500SnapshotRows(fromSnapshot);
  if (normalized) return normalized;
  return buildTop500UniverseUncached();
}

const getTop500UniverseData = unstable_cache(
  loadTop500UniversePreferSnapshot,
  ["screener-top500-universe-v15-snapshot-first"],
  { revalidate: REVALIDATE_SCREENER_IDENTITY },
);

/** Cached across requests; returns up to 500 US equity rows (ETFs/ETNs excluded). */
export const getTop500Universe = cache(async () => getTop500UniverseData());

/**
 * Screener tables that need fresh 1D/1M/YTD (Gainers/Losers, Sectors, Industries):
 * re-read `top500_market` every call (15m cron). Fallback EODHD only on snapshot miss.
 * Identity (names/logos) for Companies still goes through {@link getScreenerCompaniesStaticLayer} (7d),
 * which also prefers the same snapshot via {@link getTop500Universe}.
 */
export async function getTop500UniverseMarketSnapshot(): Promise<TopCompanyUniverseRow[]> {
  const fromSnapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market);
  const normalized = normalizeTop500SnapshotRows(fromSnapshot);
  if (normalized) return normalized;
  return withScreenerUsMarketCache("screener-top500-market-snapshot-v3-exclude-skhy", buildTop500UniverseUncached);
}
