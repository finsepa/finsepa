import { NextResponse } from "next/server";

import { CACHE_CONTROL_PRIVATE_WARM } from "@/lib/data/cache-policy";
import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { logoDevStockLogoUrl } from "@/lib/screener/company-logo-url";
import { getTop500Universe } from "@/lib/screener/top500-companies";
import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
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
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limitParsed = limitRaw ? Number(limitRaw) : NaN;
  const limit = Number.isFinite(limitParsed) ? Math.max(1, Math.min(50, Math.floor(limitParsed))) : 10;

  const top10: ChartingPickerStock[] = TOP10_TICKERS.slice(0, Math.min(10, limit)).map((ticker) => {
    const m = TOP10_META[ticker];
    return {
      ticker,
      name: m.name,
      logoUrl: companyLogoUrlForTicker(ticker, m.domain),
    };
  });

  let stocks: ChartingPickerStock[] = top10;
  if (limit > top10.length) {
    const universe = await getTop500Universe();
    const byTicker = new Map(universe.map((r) => [r.ticker.trim().toUpperCase(), r] as const));
    const nextTickers = pickScreenerPage2Tickers(universe).slice(0, limit - top10.length);
    const nextRows: ChartingPickerStock[] = nextTickers.map((ticker) => {
      const row = byTicker.get(ticker) ?? null;
      const name = row?.name?.trim() || ticker;
      const logoUrl = logoDevStockLogoUrl(ticker) || "";
      return { ticker, name, logoUrl };
    });
    stocks = [...top10, ...nextRows];
  }

  return NextResponse.json(
    { stocks },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL_PRIVATE_WARM,
      },
    },
  );
}
