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
