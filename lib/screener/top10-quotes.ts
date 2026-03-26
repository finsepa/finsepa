import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdFundamentalsHighlights } from "@/lib/market/eodhd-fundamentals";
import { fetchEodhdUsRealtime } from "@/lib/market/eodhd-realtime";
import { companyLogoUrlFromDomain } from "@/lib/screener/company-logo-url";
import {
  deriveMetricsFromDailyBars,
  eodFetchWindowUtc,
  formatDecimalTrim,
  formatMarketCapDisplay,
  formatPeDisplay,
} from "@/lib/screener/eod-derived-metrics";
import {
  parseMarketCapDisplayToUsd,
  sortRowsByMarketCapDesc,
  type ScreenerRowWithMarketCapSort,
} from "@/lib/screener/market-cap-sort";
import { screenerStaticByTicker } from "@/lib/screener/screener-static";
import { TOP10_META, TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";

async function buildTop10RowForTicker(ticker: Top10Ticker): Promise<ScreenerRowWithMarketCapSort> {
  const meta = TOP10_META[ticker];
  const fb = screenerStaticByTicker[ticker];
  const logoUrl = companyLogoUrlFromDomain(meta.domain);
  const { from, to } = eodFetchWindowUtc();

  const [quoteSettled, eodSettled, fundSettled] = await Promise.allSettled([
    fetchEodhdUsRealtime(ticker),
    fetchEodhdEodDaily(ticker, from, to),
    fetchEodhdFundamentalsHighlights(ticker),
  ]);

  const quote = quoteSettled.status === "fulfilled" ? quoteSettled.value : null;
  const bars = eodSettled.status === "fulfilled" ? eodSettled.value : null;
  const fund = fundSettled.status === "fulfilled" ? fundSettled.value : null;

  const rtClose =
    quote && typeof quote.close === "number" && Number.isFinite(quote.close) ? quote.close : null;
  const prevClose =
    quote && typeof quote.previousClose === "number" && Number.isFinite(quote.previousClose)
      ? quote.previousClose
      : null;

  const lastEodClose =
    bars && bars.length > 0 ? bars[bars.length - 1]!.close : null;

  const price = rtClose ?? lastEodClose ?? fb.price;

  let change1D = fb.change1D;
  if (rtClose != null) {
    if (typeof quote?.change_p === "number" && Number.isFinite(quote.change_p)) {
      change1D = quote.change_p;
    } else if (prevClose != null && prevClose !== 0) {
      change1D = ((rtClose - prevClose) / prevClose) * 100;
    }
  }

  const derived =
    bars && bars.length > 0 ? deriveMetricsFromDailyBars(bars, price) : null;

  const change1M = derived?.changePercent1M ?? fb.change1M;
  const changeYTD = derived?.changePercentYTD ?? fb.changeYTD;

  let trend: number[] = fb.trend;
  if (derived?.sparkline5d?.length) {
    const s = derived.sparkline5d;
    if (s.length >= 2) trend = s;
    else if (s.length === 1) trend = [s[0]!, s[0]!];
  }

  const hasMc =
    fund?.marketCapUsd != null && Number.isFinite(fund.marketCapUsd) && fund.marketCapUsd > 0;
  const marketCapStr = hasMc ? formatMarketCapDisplay(fund!.marketCapUsd) : "-";
  const peStr = formatPeDisplay(fund?.peTrailing, fund?.peForward);

  const marketCapUsd: number | null = hasMc ? fund!.marketCapUsd : null;

  return {
    id: fb.id,
    name: meta.name,
    ticker,
    logoUrl,
    price,
    change1D,
    change1M,
    changeYTD,
    marketCap: marketCapStr,
    pe: peStr,
    trend,
    marketCapUsd,
  };
}

async function loadTop10RowsUncached(): Promise<ScreenerRowWithMarketCapSort[]> {
  const settled = await Promise.allSettled(TOP10_TICKERS.map((t) => buildTop10RowForTicker(t)));

  return TOP10_TICKERS.map((ticker, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") return r.value;
    const fb = screenerStaticByTicker[ticker];
    const meta = TOP10_META[ticker];
    return {
      id: fb.id,
      name: meta.name,
      ticker,
      logoUrl: companyLogoUrlFromDomain(meta.domain),
      price: fb.price,
      change1D: fb.change1D,
      change1M: fb.change1M,
      changeYTD: fb.changeYTD,
      marketCap: fb.marketCap,
      pe: formatDecimalTrim(fb.pe),
      trend: fb.trend,
      marketCapUsd: parseMarketCapDisplayToUsd(fb.marketCap),
    };
  });
}

const getTop10ScreenerRowsData = unstable_cache(loadTop10RowsUncached, ["screener-top10-quotes-v3"], {
  revalidate: 60,
});

/**
 * Cross-request: `unstable_cache` (60s). Same request: React `cache` dedupes if called twice.
 * Rows are sorted by market cap (largest first); missing cap sorts last. Sort key is not sent to the client.
 */
export const getTop10ScreenerRows = cache(async () => {
  const built = await getTop10ScreenerRowsData();
  return sortRowsByMarketCapDesc(built);
});
