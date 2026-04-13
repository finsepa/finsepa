import { companyLogoUrlForTicker, logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { isTop10Ticker, TOP10_META } from "@/lib/screener/top10-config";

/**
 * Deterministic equity logo URL (Logo.dev domain for top 10, else ticker CDN / fallbacks).
 * No network I/O — safe on client or server.
 */
export function resolveEquityLogoUrlFromTicker(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  if (!t) return "";
  if (isTop10Ticker(t)) return companyLogoUrlForTicker(t, TOP10_META[t].domain);
  return logoDevStockLogoUrl(t) ?? "";
}

/**
 * Same as {@link resolveEquityLogoUrlFromTicker} but accepts listing-style symbols (e.g. `BRK.B`
 * from earnings calendar) so top-10 domain logos still match the screener strip.
 */
export function resolveEquityLogoUrlFromListingTicker(ticker: string): string {
  const t = ticker.trim().toUpperCase().replace(/\.US$/i, "");
  if (!t) return "";
  const hyphenated = t.replace(/\./g, "-");
  if (isTop10Ticker(hyphenated)) {
    return companyLogoUrlForTicker(hyphenated, TOP10_META[hyphenated].domain);
  }
  if (isTop10Ticker(t)) {
    return companyLogoUrlForTicker(t, TOP10_META[t].domain);
  }
  return logoDevStockLogoUrl(t) ?? "";
}
