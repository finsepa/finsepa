/**
 * Routes where we eagerly refresh every holding's live price after workspace hydrate
 * ({@link refreshHoldingMarketPrices} — one `/api/.../live-price` per symbol per portfolio).
 *
 * On other routes (e.g. `/earnings`) we defer that burst until the user opens a portfolio-heavy
 * screen to cut provider outbound API usage on read-mostly pages.
 */
export function portfolioPathnameUsesEagerLiveQuotes(pathname: string): boolean {
  return pathname.startsWith("/portfolio") || pathname.startsWith("/portfolios");
}
