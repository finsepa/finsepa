import type { MarketTab } from "@/components/screener/market-tabs";
import {
  parseScreenerMarketTab,
  SCREENER_MARKET_QUERY,
  screenerMarketTabLabelFromParam,
  screenerMarketTabParamFromLabel,
} from "@/lib/screener/screener-market-url";
import {
  SCREENER_INDUSTRY_QUERY,
  SCREENER_INDUSTRY_SECTOR_QUERY,
} from "@/lib/screener/screener-industry-url";
import { SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";
import { SCREENER_STOCKS_SUB_TAB_QUERY } from "@/lib/screener/screener-stocks-sub-tab-url";

export function screenerMarketTabFromSearchParams(searchParams: URLSearchParams): MarketTab {
  return screenerMarketTabLabelFromParam(parseScreenerMarketTab(searchParams.get(SCREENER_MARKET_QUERY)));
}

export function applyScreenerMarketTabToSearchParams(
  params: URLSearchParams,
  next: MarketTab,
): URLSearchParams {
  const out = new URLSearchParams(params.toString());
  if (next === "Stocks") {
    out.delete(SCREENER_MARKET_QUERY);
  } else {
    out.set(SCREENER_MARKET_QUERY, screenerMarketTabParamFromLabel(next));
  }
  if (next !== "Stocks") {
    out.delete(SCREENER_SECTOR_QUERY);
    out.delete(SCREENER_INDUSTRY_QUERY);
    out.delete(SCREENER_INDUSTRY_SECTOR_QUERY);
    out.delete(SCREENER_STOCKS_SUB_TAB_QUERY);
  }
  return out;
}

export function screenerMarketTabHref(
  pathname: string,
  searchParams: URLSearchParams,
  next: MarketTab,
): string {
  const params = applyScreenerMarketTabToSearchParams(searchParams, next);
  const q = params.toString();
  return q ? `${pathname}?${q}` : pathname;
}
