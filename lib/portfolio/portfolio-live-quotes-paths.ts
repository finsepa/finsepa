import {
  portfolioIsCombined,
  type PortfolioEntry,
  type PortfolioHolding,
} from "@/components/portfolio/portfolio-types";

/**
 * Routes where we **skip full** live mark-to-market on workspace hydrate (saves EODHD calls on
 * read-mostly pages). On these routes we still refresh quotes for the **selected** portfolio
 * only so the top-bar total matches Portfolio → Overview without fanning out every holding.
 *
 * Market list pages (`/screener`, `/heatmaps`) must defer full refresh — otherwise each visit
 * fans out per-ticker live-price calls for every portfolio while browsing quotes.
 */
const DEFER_LIVE_QUOTE_REFRESH_PREFIXES = [
  "/screener",
  "/heatmaps",
  "/watchlist",
  "/earnings",
  "/macro",
  "/news",
  "/superinvestors",
  "/charting",
  "/comparison",
  "/economy",
  "/stock",
] as const;

function pathnameDefersLiveQuotes(pathname: string): boolean {
  const p = pathname || "";
  return DEFER_LIVE_QUOTE_REFRESH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * When true, {@link applyWorkspaceState} runs {@link refreshHoldingMarketPrices} immediately
 * after rebuild. When false, refresh runs later when the user hits a non-deferred route
 * (see deferred effect in `PortfolioWorkspaceProvider`).
 */
export function portfolioPathnameUsesEagerLiveQuotes(pathname: string): boolean {
  return !pathnameDefersLiveQuotes(pathname);
}

/** Source portfolio ids whose holdings need quotes for the selected (or combined) portfolio total. */
export function portfolioSourceIdsForLiveQuotes(
  portfolios: PortfolioEntry[],
  selectedPortfolioId: string | null,
): string[] {
  if (!selectedPortfolioId) return [];
  const selected = portfolios.find((p) => p.id === selectedPortfolioId);
  if (!selected) return [];
  if (portfolioIsCombined(selected)) {
    const from = selected.combinedFrom ?? [];
    return from.filter((sid) => portfolios.some((x) => x.id === sid && !portfolioIsCombined(x)));
  }
  return [selected.id];
}

/** Holdings slice to quote for top-bar / selected-portfolio display on deferred routes. */
export function holdingsSliceForPortfolioLiveQuotes(
  holdingsByPortfolioId: Record<string, PortfolioHolding[]>,
  portfolios: PortfolioEntry[],
  selectedPortfolioId: string | null,
): Record<string, PortfolioHolding[]> {
  const ids = portfolioSourceIdsForLiveQuotes(portfolios, selectedPortfolioId);
  const out: Record<string, PortfolioHolding[]> = {};
  for (const id of ids) {
    out[id] = holdingsByPortfolioId[id] ?? [];
  }
  return out;
}
