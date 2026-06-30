import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_IDENTITY, REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson, resolveEarningsDateDisplay } from "@/lib/market/eodhd-fundamentals";
import {
  readStockHeaderIdentitySnapshot,
  upsertStockHeaderIdentitySnapshot,
} from "@/lib/market/stock-header-identity-snapshot";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { countWatchlistEntriesForStockTicker } from "@/lib/watchlist/stock-watchlist-count";
import { getScreenerRankForTicker } from "@/lib/screener/screener-rank";

type HeaderIdentityFields = Pick<
  StockDetailHeaderMeta,
  "fullName" | "logoUrl" | "exchange" | "countryIso" | "sector" | "industry"
>;

function parseGeneral(root: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!root || typeof root !== "object" || !root.General || typeof root.General !== "object") return null;
  return root.General as Record<string, unknown>;
}

function parseHighlights(root: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!root || typeof root !== "object" || !root.Highlights || typeof root.Highlights !== "object") return null;
  return root.Highlights as Record<string, unknown>;
}

/** Name / sector / industry / logo — slow-changing; longer shared TTL than earnings headline (Phase 5). */
async function buildHeaderIdentityUncached(ticker: string): Promise<HeaderIdentityFields> {
  const snap = await readStockHeaderIdentitySnapshot(ticker);
  if (snap) return snap;

  const root = await fetchEodhdFundamentalsJson(ticker);
  const logoStr = resolveEquityLogoUrlFromTicker(ticker);
  const r = root && typeof root === "object" ? (root as Record<string, unknown>) : null;
  const general = parseGeneral(r);

  const fullNameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName ?? null;
  const fullName = typeof fullNameRaw === "string" && fullNameRaw.trim() ? fullNameRaw.trim() : null;

  const logoUrl = logoStr.trim() ? logoStr : null;

  const sectorRaw = general?.Sector ?? null;
  const sector = typeof sectorRaw === "string" && sectorRaw.trim() ? sectorRaw.trim() : null;

  const industryRaw = general?.Industry ?? null;
  const industry = typeof industryRaw === "string" && industryRaw.trim() ? industryRaw.trim() : null;

  const exchangeRaw = general?.Exchange ?? null;
  const exchange = typeof exchangeRaw === "string" && exchangeRaw.trim() ? exchangeRaw.trim() : null;

  const countryRaw = general?.CountryISO ?? general?.Country ?? null;
  let countryIso: string | null = null;
  if (typeof countryRaw === "string" && countryRaw.trim()) {
    const c = countryRaw.trim().toUpperCase();
    countryIso = c === "USA" ? "US" : /^[A-Z]{2}$/.test(c) ? c : null;
  }

  const out = { fullName, logoUrl, exchange, countryIso, sector, industry };
  void upsertStockHeaderIdentitySnapshot(ticker, out);
  return out;
}

/** Next-earnings display string — follows fundamentals warm-long cadence. */
async function buildHeaderEarningsLineUncached(ticker: string): Promise<{ earningsDateDisplay: string | null }> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  const r = root && typeof root === "object" ? (root as Record<string, unknown>) : null;
  if (!r) return { earningsDateDisplay: null };
  const highlights = parseHighlights(r);
  return { earningsDateDisplay: resolveEarningsDateDisplay(highlights, r) };
}

const getCachedStockHeaderIdentity = unstable_cache(buildHeaderIdentityUncached, ["stock-header-identity-v3-country"], {
  revalidate: REVALIDATE_IDENTITY,
});

const getCachedStockHeaderEarningsLine = unstable_cache(
  buildHeaderEarningsLineUncached,
  ["stock-header-earnings-line-v1-phase5"],
  { revalidate: REVALIDATE_WARM_LONG },
);

/** Identity fields only — no watchlist count. Safe for batch portfolio slices. */
export async function getStockHeaderIdentityForTicker(ticker: string): Promise<HeaderIdentityFields> {
  return getCachedStockHeaderIdentity(ticker);
}

/**
 * Header meta for stock detail: fundamentals-backed slices (Phase 5 split) + live watchlist count.
 */
export async function getStockDetailHeaderMetaForPage(ticker: string): Promise<StockDetailHeaderMeta> {
  const [identity, earningsLine, watchlistCount, screenerRank] = await Promise.all([
    getCachedStockHeaderIdentity(ticker),
    getCachedStockHeaderEarningsLine(ticker),
    countWatchlistEntriesForStockTicker(ticker),
    getScreenerRankForTicker(ticker),
  ]);
  return {
    ...identity,
    earningsDateDisplay: earningsLine.earningsDateDisplay,
    watchlistCount,
    screenerRank,
  };
}
