import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson, resolveEarningsDateDisplay } from "@/lib/market/eodhd-fundamentals";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { countWatchlistEntriesForStockTicker } from "@/lib/watchlist/stock-watchlist-count";

async function buildHeaderMetaFromFundamentalsOnly(ticker: string): Promise<Omit<StockDetailHeaderMeta, "watchlistCount">> {
  const fundamentalsPromise = fetchEodhdFundamentalsJson(ticker);
  const logoStr = resolveEquityLogoUrlFromTicker(ticker);
  const root = await fundamentalsPromise;

  const general =
    root && typeof root === "object" && root.General && typeof root.General === "object"
      ? (root.General as Record<string, unknown>)
      : null;
  const highlights =
    root && typeof root === "object" && root.Highlights && typeof root.Highlights === "object"
      ? (root.Highlights as Record<string, unknown>)
      : null;

  const fullNameRaw = general?.Name ?? general?.CompanyName ?? general?.ShortName ?? null;
  const fullName = typeof fullNameRaw === "string" && fullNameRaw.trim() ? fullNameRaw.trim() : null;

  const logoUrl = logoStr.trim() ? logoStr : null;

  const sectorRaw = general?.Sector ?? null;
  const sector = typeof sectorRaw === "string" && sectorRaw.trim() ? sectorRaw.trim() : null;

  const industryRaw = general?.Industry ?? null;
  const industry = typeof industryRaw === "string" && industryRaw.trim() ? industryRaw.trim() : null;

  const earningsDateDisplay = root ? resolveEarningsDateDisplay(highlights, root as Record<string, unknown>) : null;

  return {
    fullName,
    logoUrl,
    sector,
    industry,
    earningsDateDisplay,
  };
}

const getCachedFundamentalsHeaderSlice = unstable_cache(
  async (ticker: string) => buildHeaderMetaFromFundamentalsOnly(ticker),
  ["stock-header-meta-fundamentals-v4-align-900s"],
  { revalidate: REVALIDATE_WARM_LONG },
);

/**
 * Header meta for stock detail: fundamentals (cached) + live watchlist count.
 */
export async function getStockDetailHeaderMetaForPage(ticker: string): Promise<StockDetailHeaderMeta> {
  const [fundamentals, watchlistCount] = await Promise.all([
    getCachedFundamentalsHeaderSlice(ticker),
    countWatchlistEntriesForStockTicker(ticker),
  ]);
  return {
    ...fundamentals,
    watchlistCount,
  };
}
