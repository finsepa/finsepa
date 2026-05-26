import { SCREENER_MARKET_QUERY } from "@/lib/screener/screener-market-url";
import type { ScreenerMarketTabParam } from "@/lib/screener/screener-market-url";
import {
  SCREENER_INDUSTRY_QUERY,
  SCREENER_INDUSTRY_SECTOR_QUERY,
  type ScreenerIndustryDrill,
} from "@/lib/screener/screener-industry-url";
import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";

/** Client fetch URL for `/api/screener/market-tab` (stocks sector/industry filters preserved). */
export function buildScreenerMarketTabApiUrl(
  market: ScreenerMarketTabParam,
  opts?: {
    stocksSector?: ScreenerCanonicalSector | null;
    stocksIndustry?: ScreenerIndustryDrill | null;
  },
): string {
  const params = new URLSearchParams();
  if (market !== "stocks") {
    params.set(SCREENER_MARKET_QUERY, market);
  }
  const o = opts ?? {};
  if (market === "stocks") {
    const industry = o.stocksIndustry;
    if (industry) {
      params.set(SCREENER_INDUSTRY_QUERY, industry.industry);
      params.set(SCREENER_INDUSTRY_SECTOR_QUERY, industry.sector);
    } else if (o.stocksSector) {
      params.set(SCREENER_SECTOR_QUERY, o.stocksSector);
    }
  }
  const q = params.toString();
  return q ? `/api/screener/market-tab?${q}` : "/api/screener/market-tab";
}
