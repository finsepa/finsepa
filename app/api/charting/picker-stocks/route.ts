import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { TOP10_META, TOP10_TICKERS } from "@/lib/screener/top10-config";

export type ChartingPickerStock = {
  ticker: string;
  name: string;
  logoUrl: string;
};

/**
 * Screener page-1 top 10 (largest-first order) for Charting / company pickers default list.
 * More symbols are available via `/api/search` in the picker.
 */
export async function GET() {
  const stocks: ChartingPickerStock[] = TOP10_TICKERS.slice(0, 10).map((ticker) => {
    const m = TOP10_META[ticker];
    return {
      ticker,
      name: m.name,
      logoUrl: companyLogoUrlForTicker(ticker, m.domain),
    };
  });

  return NextResponse.json(
    { stocks },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL_PRIVATE_WARM,
      },
    },
  );
}
