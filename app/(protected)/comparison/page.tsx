import { Suspense } from "react";

import { ComparisonPage } from "@/components/comparison/comparison-page";
import { buildChartingAllowedTickerList } from "@/lib/charting/charting-allowed-tickers";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { loadStockPageInitialData } from "@/lib/market/stock-page-initial-data";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { isComparisonSessionReady, parseChartingTickerList } from "@/lib/market/stock-charting-metrics";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function ComparisonRoutePage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const rawTickerParam = firstParam(sp.ticker)?.trim() ?? "";
  const tickersParsed = parseChartingTickerList(rawTickerParam || null);

  const { universe } = await getScreenerCompaniesStaticLayer();
  const chartingEquityAllowlist = buildChartingAllowedTickerList(universe);
  const chartingAllowSet = new Set(chartingEquityAllowlist);

  const allowedTickers = tickersParsed.filter((t) => {
    if (isSingleAssetMode()) return isSupportedAsset(t);
    return chartingAllowSet.has(t.trim().toUpperCase());
  });

  const comparisonReady = isComparisonSessionReady(allowedTickers);

  const initialByTicker: Record<string, StockPageInitialData> = {};
  if (comparisonReady) {
    const loaded = await Promise.all(
      allowedTickers.map(async (t) => ({ t, d: await loadStockPageInitialData(t) })),
    );
    for (const { t, d } of loaded) {
      if (d && d.ticker === t) initialByTicker[t] = d;
    }
  }

  return (
    <Suspense fallback={<div className="min-h-[40vh] px-4 py-4 sm:px-9 sm:py-6" aria-hidden />}>
      <ComparisonPage
        tickers={allowedTickers}
        initialByTicker={initialByTicker}
        comparisonReady={comparisonReady}
        allowedChartingTickers={chartingEquityAllowlist}
      />
    </Suspense>
  );
}
