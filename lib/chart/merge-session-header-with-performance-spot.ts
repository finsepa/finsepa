import type { ChartDisplayState } from "@/components/chart/PriceChart";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

function isPositiveUsd(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function priorCloseFromD1(spot: number, d1Pct: number, eodSpot: number | null | undefined): number | null {
  if (!Number.isFinite(d1Pct) || Math.abs(100 + d1Pct) <= 1e-6) return null;
  if (isPositiveUsd(eodSpot)) return eodSpot / (1 + d1Pct / 100);
  const prev = spot / (1 + d1Pct / 100);
  return Number.isFinite(prev) && Math.abs(prev) > 1e-12 ? prev : null;
}

/**
 * Headline is normally driven by a hidden 1D chart. We still align **Today** change with the overview
 * performance table (`StockPerformance.d1`: prior session close → latest daily close), not the
 * intraday move from the first 1D bar to the last.
 *
 * When the hidden session chart has no points yet, fall back to spot so the header is not "—".
 * Prefer `sessionLiveSpotUsd` (live-price API) over EOD `performance.price` for the headline number.
 */
export function mergeSessionHeaderWithPerformanceSpot(
  base: ChartDisplayState,
  perf: StockPerformance | null,
  chartSeries: StockChartSeries,
  sessionLiveSpotUsd?: number | null,
): ChartDisplayState {
  if (chartSeries !== "price" || base.selectionActive) return base;

  // Chart crosshair / mobile scrub — keep chart-driven price and change (1D overview).
  if (base.isHovering) return base;

  const eodSpot = perf?.price;
  const liveSpot = isPositiveUsd(sessionLiveSpotUsd) ? sessionLiveSpotUsd : null;
  const spotFromBase =
    base.displayPrice != null && Number.isFinite(base.displayPrice) ? base.displayPrice : null;
  const spot = liveSpot ?? spotFromBase ?? (isPositiveUsd(eodSpot) ? eodSpot : null);

  const d1Eod = perf?.d1;
  const hasD1 = d1Eod != null && Number.isFinite(d1Eod);

  if (spot != null && hasD1) {
    const prevClose = priorCloseFromD1(spot, d1Eod, eodSpot);
    const abs = prevClose != null ? spot - prevClose : null;
    return {
      ...base,
      loading: false,
      empty: false,
      displayPrice: spot,
      displayChangePct: d1Eod,
      displayChangeAbs: abs,
      selectionChangeAbs: null,
      selectionChangePct: null,
      isHovering: false,
    };
  }

  if (spotFromBase != null) return { ...base, loading: false };

  if (spot == null) return base;

  return {
    ...base,
    loading: false,
    empty: false,
    displayPrice: spot,
    displayChangePct: null,
    displayChangeAbs: null,
    selectionChangeAbs: null,
    selectionChangePct: null,
    isHovering: false,
  };
}
