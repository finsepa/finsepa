"use client";

import { createContext, useContext, type ReactNode } from "react";

import { KeyIndicators } from "@/components/stock/key-indicators";
import { KeyStats } from "@/components/stock/key-stats";
import { LatestNews } from "@/components/stock/latest-news";
import type { StockKeyIndicatorsResponse } from "@/lib/market/stock-key-indicators-types";
import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import type { StockNewsArticle } from "@/lib/market/stock-news-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";

type OverviewMetricActions = {
  onOpenMetricChart: (metricId: ChartingMetricId) => void;
  onOpenDrawdownChart: () => void;
};

const OverviewMetricActionsContext = createContext<OverviewMetricActions | null>(null);

export function StockOverviewMetricActionsProvider({
  value,
  children,
}: {
  value: OverviewMetricActions;
  children: ReactNode;
}) {
  return (
    <OverviewMetricActionsContext.Provider value={value}>{children}</OverviewMetricActionsContext.Provider>
  );
}

function useOverviewMetricActions(): OverviewMetricActions {
  const ctx = useContext(OverviewMetricActionsContext);
  if (!ctx) {
    return {
      onOpenMetricChart: () => {},
      onOpenDrawdownChart: () => {},
    };
  }
  return ctx;
}

/** Overview panels below the chart / mini-table — streamed after above-fold via Suspense. */
export function StockOverviewBelowFold({
  ticker,
  isEtf,
  keyIndicators,
  keyStatsBundle,
  news,
}: {
  ticker: string;
  isEtf: boolean;
  keyIndicators: StockKeyIndicatorsResponse | null;
  keyStatsBundle: StockKeyStatsBundle | null;
  news: StockNewsArticle[];
}) {
  const { onOpenMetricChart, onOpenDrawdownChart } = useOverviewMetricActions();
  if (isEtf) return null;

  return (
    <div className="space-y-5">
      <div>
        <KeyIndicators ticker={ticker} initial={keyIndicators} />
        <KeyStats
          ticker={ticker}
          initialBundle={keyStatsBundle}
          onOpenMetricChart={onOpenMetricChart}
          onOpenDrawdownChart={onOpenDrawdownChart}
        />
      </div>
      <div>
        <LatestNews
          ticker={ticker}
          initialItems={news.length > 0 ? news : undefined}
        />
      </div>
    </div>
  );
}
