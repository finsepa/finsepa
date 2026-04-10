import { NextResponse } from "next/server";

import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import { TOP10_META, TOP10_TICKERS } from "@/lib/screener/top10-config";

export type ChartingPickerStock = {
  ticker: string;
  name: string;
  logoUrl: string;
};

/**
 * Curated screener page-1 + page-2 equities for Charting / company pickers (names + logos).
 */
export async function GET() {
  const { universe } = await getScreenerCompaniesStaticLayer();
  const byTicker = new Map(universe.map((u) => [u.ticker.toUpperCase(), u] as const));
  const page2Tickers = pickScreenerPage2Tickers(universe);

  const top10: ChartingPickerStock[] = TOP10_TICKERS.map((ticker) => {
    const m = TOP10_META[ticker];
    return {
      ticker,
      name: m.name,
      logoUrl: companyLogoUrlForTicker(ticker, m.domain),
    };
  });

  const page2: ChartingPickerStock[] = page2Tickers.map((t) => {
    const u = byTicker.get(t.toUpperCase());
    return {
      ticker: t,
      name: u?.name?.trim() || t,
      logoUrl: resolveEquityLogoUrlFromTicker(t).trim(),
    };
  });

  const stocks = [...top10, ...page2];

  return NextResponse.json(
    { stocks },
    {
      headers: {
        "Cache-Control": "private, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
