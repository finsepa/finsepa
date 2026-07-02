import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { peRatioKeyStatsDisplayFromFundamentalsRoot } from "@/lib/market/eodhd-key-stats-valuation";
import { formatUsdCompact } from "@/lib/market/key-stats-basic-format";
import { formatPeDisplay } from "@/lib/screener/eod-derived-metrics";
import { getMockScreenerCompaniesNvdaBtcRows } from "@/lib/fixtures/screener-companies-test";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";
import type { ScreenerTableRow } from "@/lib/screener/screener-static";
import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import type { SimpleScreenerStockDerived } from "@/lib/market/simple-market-layer";
import { isScreenerUsMarketLiveSession } from "@/lib/screener/screener-us-market-cache";

function pickScreenerPct(snapshot: number | null | undefined, fromBars: number | null | undefined): number | null {
  if (snapshot != null && Number.isFinite(snapshot)) return snapshot;
  if (fromBars != null && Number.isFinite(fromBars)) return fromBars;
  return null;
}

/** Implied P/E from screener universe snapshot — no per-row fundamentals HTTP. */
export function screenerPeDisplayFromUniverse(u: TopCompanyUniverseRow): string {
  const price = u.adjustedClose;
  const eps = u.earningsShare;
  if (price != null && eps != null && eps > 0 && Number.isFinite(price) && Number.isFinite(eps)) {
    return formatPeDisplay(price / eps, null);
  }
  return "—";
}

function lastCloseFromDerived(derived: SimpleScreenerStockDerived | null | undefined): number | null {
  const s = derived?.last5DailyCloses;
  if (!s || !s.length) return null;
  const last = s[s.length - 1];
  return typeof last === "number" && Number.isFinite(last) && last > 0 ? last : null;
}

function change1DFromDerived(derived: SimpleScreenerStockDerived | null | undefined): number | null {
  const s = derived?.last5DailyCloses;
  if (!s || s.length < 2) return null;
  const last = s[s.length - 1];
  const prev = s[s.length - 2];
  if (
    typeof last !== "number" ||
    typeof prev !== "number" ||
    !Number.isFinite(last) ||
    !Number.isFinite(prev) ||
    last <= 0 ||
    prev <= 0
  ) {
    return null;
  }
  return ((last - prev) / prev) * 100;
}

/**
 * P/E in Key Stats (Highlights) format — matches stock Valuation "P/E Ratio" when fundamentals load.
 * Falls back to screener implied (price/earnings_share) if fundamentals are missing.
 */
export async function resolveScreenerPeToMatchKeyStats(
  ticker: string,
  u: TopCompanyUniverseRow | undefined,
): Promise<string> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (root) {
    const s = peRatioKeyStatsDisplayFromFundamentalsRoot(root);
    if (s !== "—") return s;
  }
  if (u) return screenerPeDisplayFromUniverse(u);
  return "—";
}

export function screenerAtClosePriceAndChange1D(
  quotePrice: number | null | undefined,
  quoteChange1D: number | null | undefined,
  universeRow: TopCompanyUniverseRow | null | undefined,
  barDerived?: SimpleScreenerStockDerived | null,
): { price: number | null; change1D: number | null } {
  const rtClose = quotePrice != null && Number.isFinite(quotePrice) && quotePrice > 0 ? quotePrice : null;
  const snapClose =
    universeRow?.adjustedClose != null &&
    Number.isFinite(universeRow.adjustedClose) &&
    universeRow.adjustedClose > 0
      ? universeRow.adjustedClose
      : null;
  const derivedClose = lastCloseFromDerived(barDerived);
  const derivedChange1D = change1DFromDerived(barDerived);
  const atCloseSession = !isScreenerUsMarketLiveSession();

  const price: number | null = atCloseSession
    ? (derivedClose ?? snapClose ?? rtClose)
    : (rtClose ?? snapClose ?? derivedClose);

  let change1D: number | null = null;
  if (atCloseSession) {
    change1D =
      derivedChange1D ??
      (universeRow?.refund1dP != null && Number.isFinite(universeRow.refund1dP)
        ? universeRow.refund1dP
        : null) ??
      (quoteChange1D != null && Number.isFinite(quoteChange1D) ? quoteChange1D : null);
  } else {
    change1D =
      (quoteChange1D != null && Number.isFinite(quoteChange1D) ? quoteChange1D : null) ??
      (universeRow?.refund1dP != null && Number.isFinite(universeRow.refund1dP)
        ? universeRow.refund1dP
        : null);
  }

  return { price, change1D };
}

/** Shared by Companies table and Top-10 strip — merges universe + quote + logo URL string. */
export function buildScreenerCompanyRowFromUniverse(
  u: TopCompanyUniverseRow,
  rankId: number,
  quote: EodhdRealtimePayload | null | undefined,
  logoUrl = "",
  /** When screener snapshot omits 1M/YTD, use derived %s from daily EOD bars (same cache as screener derived). */
  barDerived?: SimpleScreenerStockDerived | null,
  /** When set, Key Stats "P/E Ratio" string (from fundamentals); else implied from the universe row. */
  peKeyStatsDisplay?: string,
): ScreenerTableRow {
  const { price, change1D } = screenerAtClosePriceAndChange1D(
    quote?.close,
    quote?.change_p,
    u,
    barDerived,
  );

  const change1M = pickScreenerPct(u.refund1mP, barDerived?.changePercent1M);
  const changeYTD = pickScreenerPct(u.refundYtdP, barDerived?.changePercentYTD);

  const pe =
    peKeyStatsDisplay !== undefined
      ? peKeyStatsDisplay
      : (() => {
          const eps = u.earningsShare;
          if (price != null && eps != null && eps > 0 && Number.isFinite(eps)) {
            return formatPeDisplay(price / eps, null);
          }
          return screenerPeDisplayFromUniverse(u);
        })();

  return {
    id: rankId,
    name: u.name,
    ticker: u.ticker,
    logoUrl,
    price,
    change1D,
    change1M,
    changeYTD,
    marketCap: formatUsdCompact(u.marketCapUsd),
    pe,
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
