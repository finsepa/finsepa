import type { ChartDisplayState } from "@/components/chart/PriceChart";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

function isPositiveUsd(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Headline is normally driven by a hidden 1D chart. When that session has no points yet (or is still
 * loading), fall back to a spot so the header never sits on "—" while the visible range chart already has prices.
 *
 * **Phase 7:** Prefer `sessionLiveSpotUsd` (intraday-aligned / live-price API) over `StockPerformance.price`
 * (last daily EOD close) when both exist, and recompute session change vs prior close implied by the EOD table so
 * the move line matches the fresher headline.
 */
export function mergeSessionHeaderWithPerformanceSpot(
  base: ChartDisplayState,
  perf: StockPerformance | null,
  chartSeries: StockChartSeries,
  sessionLiveSpotUsd?: number | null,
): ChartDisplayState {
  if (chartSeries !== "price" || base.selectionActive) return base;
  if (base.displayPrice != null && Number.isFinite(base.displayPrice)) return base;

  const eodSpot = perf?.price;
  const liveSpot = isPositiveUsd(sessionLiveSpotUsd) ? sessionLiveSpotUsd : null;
  const spot = liveSpot ?? (isPositiveUsd(eodSpot) ? eodSpot : null);
  if (spot == null) return base;

  const d1Eod = perf?.d1;
  let pct: number | null = d1Eod != null && Number.isFinite(d1Eod) ? d1Eod : null;
  let abs: number | null = null;

  if (liveSpot != null && isPositiveUsd(eodSpot) && d1Eod != null && Number.isFinite(d1Eod) && Math.abs(100 + d1Eod) > 1e-6) {
    const prevClose = eodSpot / (1 + d1Eod / 100);
    if (Number.isFinite(prevClose) && Math.abs(prevClose) > 1e-12) {
      pct = ((liveSpot - prevClose) / prevClose) * 100;
      abs = liveSpot - prevClose;
    }
  } else if (liveSpot != null) {
    pct = null;
    abs = null;
  } else if (pct != null && Math.abs(100 + pct) > 1e-6) {
    const prevClose = spot / (1 + pct / 100);
    if (Number.isFinite(prevClose)) abs = spot - prevClose;
  }

  return {
    ...base,
    loading: false,
    empty: false,
    displayPrice: spot,
    displayChangePct: pct,
    displayChangeAbs: abs,
    selectionChangeAbs: null,
    selectionChangePct: null,
    isHovering: false,
  };
}
