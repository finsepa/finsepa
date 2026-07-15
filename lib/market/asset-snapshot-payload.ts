import type { ScreenerUsMarketCacheMode } from "@/lib/screener/screener-us-market-cache";

import type { StockPageInitialData } from "@/lib/market/stock-page-initial-data";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

/** JSON stored in `market_snapshot` — hot fields + Key Indicators omitted (separate snapshot TTL). */
export type AssetSnapshotPayload = Omit<
  StockPageInitialData,
  "headerLiveSpotUsd" | "headerPriorCloseUsd" | "keyIndicators"
> & {
  headerLiveSpotUsd?: null;
  headerPriorCloseUsd?: null;
};

export function stripAssetSnapshotHotFields(
  data: StockPageInitialData,
  mode: ScreenerUsMarketCacheMode,
): AssetSnapshotPayload {
  const {
    headerLiveSpotUsd: _spot,
    headerPriorCloseUsd: _prior,
    keyIndicators: _ki,
    ...rest
  } = data;
  if (mode === "frozen") {
    return {
      ...rest,
      chart: data.chart,
      headerLiveSpotUsd: null,
      headerPriorCloseUsd: null,
    };
  }
  return {
    ...rest,
    chart: { range: data.chart.range, points: [] },
    headerLiveSpotUsd: null,
    headerPriorCloseUsd: null,
  };
}

export function assetSnapshotPayloadToPageData(payload: AssetSnapshotPayload): StockPageInitialData {
  return {
    ...payload,
    headerLiveSpotUsd: null,
    headerPriorCloseUsd: null,
    keyIndicators: null,
    liveRegularSessionActive:
      payload.liveRegularSessionActive ??
      (payload.chart.liveSessionMinute != null
        ? payload.chart.liveSessionMinute
        : getUsEquityMarketSession(new Date()) === "regular"),
  };
}
