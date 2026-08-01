"use client";

import { memo } from "react";

import { ComparisonWorkspace } from "@/components/comparison/comparison-workspace";
import { isSingleAssetMode } from "@/lib/features/single-asset";
import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";

export { PeerSearchDropdownRow } from "@/components/comparison/peer-search-dropdown-row";

function StockPeersTabInner({
  ticker,
  initialPageData,
  isActive = true,
}: {
  ticker: string;
  initialPageData?: StockPageInitialData | null;
  /** Visible stock tab — gates shared company-rail ownership. */
  isActive?: boolean;
}) {
  const main = ticker.trim().toUpperCase();

  if (isSingleAssetMode()) {
    return (
      <div className="space-y-2 pt-2 text-fg-muted">Peers temporarily unavailable in NVDA-only mode.</div>
    );
  }

  const initialByTicker: Record<string, StockPageInitialData> =
    initialPageData?.ticker === main ? { [main]: initialPageData } : {};

  return (
    <div className="w-full min-w-0">
      <ComparisonWorkspace
        tickers={[main]}
        anchorTicker={main}
        initialByTicker={initialByTicker}
        allowedChartingTickers={[]}
        urlMode="stock-tab"
        isActive={isActive}
      />
    </div>
  );
}

export const StockPeersTab = memo(StockPeersTabInner);
