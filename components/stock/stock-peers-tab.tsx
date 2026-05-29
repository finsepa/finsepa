"use client";

import { memo } from "react";

import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";

export { PeerSearchDropdownRow } from "@/components/comparison/peer-search-dropdown-row";

function StockPeersTabInner({
  ticker,
  initialPageData,
}: {
  ticker: string;
  initialPageData?: StockPageInitialData | null;
}) {
  const main = ticker.trim().toUpperCase();

  if (isSingleAssetMode()) {
    return (
      <div className="space-y-2 pt-2 text-[#71717A]">Peers temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const initialByTicker: Record<string, StockPageInitialData> =
    initialPageData?.ticker === main ? { [main]: initialPageData } : {};

  return (
    <div className="w-full min-w-0 pt-1">
      <ComparisonWorkspace
        tickers={[main]}
        anchorTicker={main}
        initialByTicker={initialByTicker}
        allowedChartingTickers={[]}
        urlMode="stock-tab"
        titleAs="h2"
      />
    </div>
  );
}

export const StockPeersTab = memo(StockPeersTabInner);
