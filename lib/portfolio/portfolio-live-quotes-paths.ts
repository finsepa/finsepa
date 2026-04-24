/**
 * Routes where we **skip** live mark-to-market on workspace hydrate (saves provider calls on
 * read-mostly pages). Everywhere else we refresh so the top-bar portfolio total matches
 * Portfolio → Overview (otherwise `/stock/...` etc. kept last-fill prices and read low).
 */
const DEFER_LIVE_QUOTE_REFRESH_PREFIXES = ["/earnings", "/macro", "/news", "/superinvestors"] as const;

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
