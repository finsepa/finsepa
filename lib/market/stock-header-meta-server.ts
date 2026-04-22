import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_IDENTITY, REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { fetchEodhdFundamentalsJson, resolveEarningsDateDisplay } from "@/lib/market/eodhd-fundamentals";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { countWatchlistEntriesForStockTicker } from "@/lib/watchlist/stock-watchlist-count";

type HeaderIdentityFields = Pick<StockDetailHeaderMeta, "fullName" | "logoUrl" | "sector" | "industry">;

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

  return { fullName, logoUrl, sector, industry };
}

/** Next-earnings display string — follows fundamentals warm-long cadence. */
async function buildHeaderEarningsLineUncached(ticker: string): Promise<{ earningsDateDisplay: string | null }> {
  const root = await fetchEodhdFundamentalsJson(ticker);
  const r = root && typeof root === "object" ? (root as Record<string, unknown>) : null;
  if (!r) return { earningsDateDisplay: null };
  const highlights = parseHighlights(r);
  return { earningsDateDisplay: resolveEarningsDateDisplay(highlights, r) };
}

const getCachedStockHeaderIdentity = unstable_cache(buildHeaderIdentityUncached, ["stock-header-identity-v1-phase5"], {
  revalidate: REVALIDATE_IDENTITY,
});

const getCachedStockHeaderEarningsLine = unstable_cache(
  buildHeaderEarningsLineUncached,
  ["stock-header-earnings-line-v1-phase5"],
  { revalidate: REVALIDATE_WARM_LONG },
);

/**
 * Header meta for stock detail: fundamentals-backed slices (Phase 5 split) + live watchlist count.
 */
export async function getStockDetailHeaderMetaForPage(ticker: string): Promise<StockDetailHeaderMeta> {
  const [identity, earningsLine, watchlistCount] = await Promise.all([
    getCachedStockHeaderIdentity(ticker),
    getCachedStockHeaderEarningsLine(ticker),
    countWatchlistEntriesForStockTicker(ticker),
  ]);
  return {
    ...identity,
    earningsDateDisplay: earningsLine.earningsDateDisplay,
    watchlistCount,
  };
}
