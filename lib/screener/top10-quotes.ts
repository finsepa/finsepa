import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { fetchEodhdUsRealtimeBatch } from "@/lib/market/eodhd-realtime";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";
import { companyLogoUrlForTicker } from "@/lib/screener/company-logo-url";
import { buildScreenerCompanyRowFromUniverse } from "@/lib/screener/companies-rows";
import {
  getScreenerCompaniesStaticLayer,
} from "@/lib/screener/screener-companies-layers";
import {
  parseMarketCapDisplayToUsd,
  sortRowsByMarketCapDesc,
  type ScreenerRowWithMarketCapSort,
} from "@/lib/screener/market-cap-sort";
import { screenerStaticByTicker } from "@/lib/screener/screener-static";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
function fallbackRow(ticker: Top10Ticker): ScreenerRowWithMarketCapSort {
  const fb = screenerStaticByTicker[ticker];
  const meta = TOP10_META[ticker];
  return {
    id: fb.id,
    name: meta.name,
    ticker,
    logoUrl: companyLogoUrlForTicker(ticker, meta.domain),
    price: fb.price,
    change1D: fb.change1D,
    change1M: fb.change1M,
    changeYTD: fb.changeYTD,
    marketCap: fb.marketCap,
    pe: String(fb.pe),
    trend: fb.trend,
    marketCapUsd: parseMarketCapDisplayToUsd(fb.marketCap),
  };
}

async function loadTop10RowsUncached(): Promise<ScreenerRowWithMarketCapSort[]> {
  const { universe } = await getScreenerCompaniesStaticLayer();
  const realtimeMap = await fetchEodhdUsRealtimeBatch([...TOP10_TICKERS]);
  const byTicker = new Map(universe.map((r) => [r.ticker.toUpperCase(), r] as const));

  const out: ScreenerRowWithMarketCapSort[] = [];
  for (const ticker of TOP10_TICKERS) {
    const u = byTicker.get(ticker);
    if (!u) {
      out.push(fallbackRow(ticker));
      continue;
    }
    const sym = toEodhdUsSymbol(ticker);
    const quote = realtimeMap.get(sym);
    const fb = screenerStaticByTicker[ticker];
    const meta = TOP10_META[ticker];
    const base = buildScreenerCompanyRowFromUniverse(u, fb.id, quote);
    const logoUrl = companyLogoUrlForTicker(ticker, meta.domain);
    out.push({
      ...base,
      name: meta.name,
      logoUrl,
      marketCapUsd: u.marketCapUsd,
    });
  }

  return out;
}

const getTop10ScreenerRowsData = unstable_cache(loadTop10RowsUncached, ["screener-top10-quotes-v11-logo-dev-only"], {
  revalidate: REVALIDATE_HOT,
});

/**
 * Cross-request: `unstable_cache` (hot tier). Same request: React `cache` dedupes if called twice.
 * Rows are sorted by market cap (largest first); missing cap sorts last. Sort key is not sent to the client.
 */
export const getTop10ScreenerRows = cache(async () => {
  const built = await getTop10ScreenerRowsData();
  return sortRowsByMarketCapDesc(built);
});
