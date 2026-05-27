/**
 * Routes where we **skip** live mark-to-market on workspace hydrate (saves EODHD calls on
 * read-mostly pages). Everywhere else we refresh so the top-bar portfolio total matches
 * Portfolio → Overview (otherwise `/stock/...` etc. kept last-fill prices and read low).
 *
 * Market list pages (`/screener`, `/heatmaps`) must defer — otherwise each visit fans out
 * per-ticker stock live-price API calls (intraday) for every holding while browsing quotes.
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
