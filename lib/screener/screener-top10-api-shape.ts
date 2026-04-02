import type { ScreenerTableRow } from "@/lib/screener/screener-static";

/** Normalized payload (API / integration contract). */
export type ScreenerTop10NormalizedQuote = {
  ticker: string;
  price: number | null;
  changePercent1D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  marketCap: string;
  pe: string;
  sparkline5d: number[];
};

export function toNormalizedQuote(row: ScreenerTableRow): ScreenerTop10NormalizedQuote {
  return {
    ticker: row.ticker,
    price: row.price,
    changePercent1D: row.change1D,
    changePercent1M: row.change1M,
    changePercentYTD: row.changeYTD,
    marketCap: row.marketCap,
    pe: row.pe,
    sparkline5d: row.trend,
  };
}
