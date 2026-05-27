import type { ScreenerUsMarketCacheMode } from "@/lib/screener/screener-us-market-cache";

import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";

/** JSON stored in `market_snapshot` — hot fields omitted in live mode. */
export type AssetSnapshotPayload = Omit<StockPageInitialData, "headerLiveSpotUsd"> & {
  headerLiveSpotUsd?: null;
};

export function stripAssetSnapshotHotFields(
  data: StockPageInitialData,
  mode: ScreenerUsMarketCacheMode,
): AssetSnapshotPayload {
  const { headerLiveSpotUsd: _spot, ...rest } = data;
  if (mode === "frozen") {
    return { ...rest, headerLiveSpotUsd: null };
  }
  return {
    ...rest,
    chart: { range: data.chart.range, points: [] },
    headerLiveSpotUsd: null,
  };
}

export function assetSnapshotPayloadToPageData(payload: AssetSnapshotPayload): StockPageInitialData {
  return {
    ...payload,
    headerLiveSpotUsd: null,
  };
}
