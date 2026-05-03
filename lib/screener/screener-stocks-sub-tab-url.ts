import type { ScreenerCanonicalSector } from "@/lib/screener/screener-gics-sectors";
import { SCREENER_SECTOR_QUERY } from "@/lib/screener/screener-sector-url";

/** Stocks sub-view: Companies, Gainers & Losers, Sectors, Industries (matches UI tab ids). */
export const SCREENER_STOCKS_SUB_TAB_QUERY = "stocksTab" as const;

const STOCKS_SUB_TAB_IDS = ["Companies", "Gainers & Losers", "Sectors", "Industries"] as const;

export type ParsedStocksSubTabParam = (typeof STOCKS_SUB_TAB_IDS)[number];

export function parseStocksSubTabParam(raw: string | null | undefined): ParsedStocksSubTabParam | null {
  const v = raw?.trim();
  if (!v) return null;
  return (STOCKS_SUB_TAB_IDS as readonly string[]).includes(v) ? (v as ParsedStocksSubTabParam) : null;
}

/** Deep link: Sectors tab, drilled into a canonical sector (companies table below). */
export function screenerSectorDrillHref(sector: ScreenerCanonicalSector): string {
  const params = new URLSearchParams();
  params.set(SCREENER_SECTOR_QUERY, sector);
  params.set(SCREENER_STOCKS_SUB_TAB_QUERY, "Sectors");
  return `/screener?${params.toString()}`;
}
