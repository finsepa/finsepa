import "server-only";

import { formatMarketCapDisplay, formatPeDisplay } from "@/lib/screener/eod-derived-metrics";
import { getMockScreenerCompaniesNvdaBtcRows } from "@/lib/fixtures/screener-companies-test";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import type { SimpleScreenerStockDerived } from "@/lib/market/simple-market-layer";

function peFromScreenerSnapshot(u: TopCompanyUniverseRow): string {
  const price = u.adjustedClose;
  const eps = u.earningsShare;
  if (price != null && eps != null && eps > 0 && Number.isFinite(price) && Number.isFinite(eps)) {
    return formatPeDisplay(price / eps, null);
  }
  return "-";
}

/** Shared by Companies table and Top-10 strip — merges universe + quote + logo URL string. */
export function buildScreenerCompanyRowFromUniverse(
  u: TopCompanyUniverseRow,
  rankId: number,
  quote: EodhdRealtimePayload | null | undefined,
  logoUrl = "",
  /** When screener snapshot omits 1M/YTD, use derived %s from daily EOD bars (same cache as screener derived). */
  barDerived?: SimpleScreenerStockDerived | null,
): ScreenerTableRow {
  const rtClose = quote && typeof quote.close === "number" && Number.isFinite(quote.close) ? quote.close : null;
  const prevClose =
    quote && typeof quote.previousClose === "number" && Number.isFinite(quote.previousClose) ? quote.previousClose : null;

  const snapClose = u.adjustedClose;
  const price: number | null =
    rtClose ??
    (snapClose != null && Number.isFinite(snapClose) && snapClose > 0 ? snapClose : null);

  let change1D: number | null = null;
  if (rtClose != null) {
    if (typeof quote?.change_p === "number" && Number.isFinite(quote.change_p)) change1D = quote.change_p;
    else if (prevClose != null && prevClose !== 0) change1D = ((rtClose - prevClose) / prevClose) * 100;
  } else if (u.refund1dP != null && Number.isFinite(u.refund1dP)) {
    change1D = u.refund1dP;
  }

  const change1M =
    u.refund1mP != null && Number.isFinite(u.refund1mP) ? u.refund1mP : (barDerived?.changePercent1M ?? null);
  const changeYTD =
    u.refundYtdP != null && Number.isFinite(u.refundYtdP) ? u.refundYtdP : (barDerived?.changePercentYTD ?? null);

  return {
    id: rankId,
    name: u.name,
    ticker: u.ticker,
    logoUrl,
    price,
    change1D,
    change1M,
    changeYTD,
    marketCap: formatMarketCapDisplay(u.marketCapUsd),
    pe: peFromScreenerSnapshot(u),
    trend: [],
  };
}

export type CompaniesPayload = {
  page: number;
  pageSize: number;
  total: number;
  rows: ScreenerTableRow[];
};

/**
 * Screener v2 Companies tab: one merged server payload per (page, pageSize, q).
 * - Layer A (static): universe + logos — long cache, built once per refresh, not per page row.
 * - Layer B (market): full-universe realtime batch — short cache, shared by all pages.
 * - Merge: in-memory slice + join only (no provider fan-out per row).
 */
async function buildScreenerPagePayloadUncached(page: number, pageSize: number, q: string): Promise<CompaniesPayload> {
  // Screener companies test mode: deterministic static rows only.
  // No realtime maps, no layer caches, no API calls.
  const all = getMockScreenerCompaniesNvdaBtcRows();

  const qNorm = q.trim().toLowerCase();
  const filtered = qNorm.length
    ? all.filter((r) => r.ticker.toLowerCase().includes(qNorm) || r.name.toLowerCase().includes(qNorm))
    : all;

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  return { page, pageSize, total, rows };
}

/** Final normalized Companies tab payload (Screener v2). */
export async function getScreenerPagePayload(page: number, pageSize: number, q: string): Promise<CompaniesPayload> {
  // IMPORTANT: temporarily disable caching for the Screener Companies payload.
  // Stale rows were being served from `unstable_cache` even after API/fixtures were changed.
  return buildScreenerPagePayloadUncached(page, pageSize, q);
}

/** Alias for API routes and older imports — same as {@link getScreenerPagePayload}. */
export const getScreenerCompaniesPayload = getScreenerPagePayload;
