import {
  portfolioIsCombined,
  type PortfolioEntry,
  type PortfolioHolding,
} from "@/components/portfolio/portfolio-types";

/**
 * Routes where we **skip auto** live mark-to-market on workspace hydrate (saves EODHD calls on
 * read-mostly pages). Top-bar uses last session marks; refresh on Portfolio, portfolio switch,
 * TTL, or cold first visit with no marks.
 *
 * Market list pages (`/screener`, `/heatmaps`) and asset pages must defer — otherwise each visit
 * fans out live quotes for the selected portfolio while browsing.
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
  "/crypto",
  /** Agent uses saved marks only — don't fan out live-price while chatting. */
  "/agents",
] as const;

function pathnameDefersLiveQuotes(pathname: string): boolean {
  const p = pathname || "";
  return DEFER_LIVE_QUOTE_REFRESH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

/**
 * When true, {@link applyWorkspaceState} runs live quotes immediately after rebuild.
 * When false, chrome uses last marks until Portfolio / switch / TTL / cold miss.
 */
export function portfolioPathnameUsesEagerLiveQuotes(pathname: string): boolean {
  return !pathnameDefersLiveQuotes(pathname);
}

/**
 * Continuous ledger heal (`/api/portfolio/stock-splits`) is Portfolio-path only.
 * Top-bar totals do not depend on it — running on Screener/hubs wastes BothCloses credits.
 */
export function portfolioPathnameAllowsStockSplitsHeal(pathname: string): boolean {
  return portfolioPathnameUsesEagerLiveQuotes(pathname);
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
