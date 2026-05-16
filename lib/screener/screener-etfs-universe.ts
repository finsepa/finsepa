import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC } from "@/lib/data/cache-policy";
import { fetchEodhdTopEtfsByMarketCap, type EodhdTopUniverseRow } from "@/lib/market/eodhd-screener";
import { POPULAR_US_ETFS } from "@/lib/search/popular-us-etfs";

/** Screener ETFs tab — number of rows (single page). */
export const SCREENER_ETFS_TOP_N = 20;

export type EtfTableRow = {
  name: string;
  /** US ticker (e.g. QQQ). */
  symbol: string;
  value: number;
  change1D: number;
  change1M: number | null;
  changeYTD: number | null;
};

export type ScreenerEtfMeta = {
  ticker: string;
  name: string;
  refund1dP: number | null;
  refund1mP: number | null;
  refundYtdP: number | null;
  adjustedClose: number | null;
};

function fallbackEtfMetas(): ScreenerEtfMeta[] {
  return POPULAR_US_ETFS.slice(0, SCREENER_ETFS_TOP_N).map((e) => ({
    ticker: e.ticker,
    name: e.name,
    refund1dP: null,
    refund1mP: null,
    refundYtdP: null,
    adjustedClose: null,
  }));
}

function rowsToMetas(rows: EodhdTopUniverseRow[]): ScreenerEtfMeta[] {
  return rows.slice(0, SCREENER_ETFS_TOP_N).map((r) => ({
    ticker: r.ticker,
    name: r.name,
    refund1dP: r.refund1dP,
    refund1mP: r.refund1mP,
    refundYtdP: r.refundYtdP,
    adjustedClose: r.adjustedClose,
  }));
}

async function loadScreenerEtfsTop20Uncached(): Promise<ScreenerEtfMeta[]> {
  const remote = await fetchEodhdTopEtfsByMarketCap(SCREENER_ETFS_TOP_N);
  const fromApi = remote.length > 0 ? rowsToMetas(remote) : [];
  if (fromApi.length >= SCREENER_ETFS_TOP_N) return fromApi.slice(0, SCREENER_ETFS_TOP_N);

  const seen = new Set(fromApi.map((m) => m.ticker));
  const merged: ScreenerEtfMeta[] = [...fromApi];
  for (const e of POPULAR_US_ETFS) {
    if (merged.length >= SCREENER_ETFS_TOP_N) break;
    const tk = e.ticker.trim().toUpperCase();
    if (seen.has(tk)) continue;
    seen.add(tk);
    merged.push({
      ticker: tk,
      name: e.name,
      refund1dP: null,
      refund1mP: null,
      refundYtdP: null,
      adjustedClose: null,
    });
  }
  if (merged.length > 0) return merged;
  return fallbackEtfMetas();
}

export const getScreenerEtfsTop20 = unstable_cache(
  loadScreenerEtfsTop20Uncached,
  ["screener-etfs-top20-v2"],
  { revalidate: REVALIDATE_STATIC },
);

export function screenerEtfTickers(metas: readonly ScreenerEtfMeta[]): string[] {
  return metas.map((m) => m.ticker.trim().toUpperCase());
}
