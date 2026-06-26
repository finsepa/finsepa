import type { ChartDisplayState } from "@/components/chart/PriceChart";
import {
  changePctFromPrior,
  reconcilePriceChangePair,
} from "@/lib/chart/reconcile-price-change";
import type { StockChartSeries } from "@/lib/market/stock-chart-types";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import { priorSessionDayChangeFromPerformance } from "@/lib/market/prior-session-day-change";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

function isPositiveUsd(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** Prior close implied by EOD mini-table `d1` relative to the last daily bar. */
function priorCloseFromD1(spot: number, d1Pct: number, eodSpot: number | null | undefined): number | null {
  if (!Number.isFinite(d1Pct) || Math.abs(100 + d1Pct) <= 1e-6) return null;
  if (isPositiveUsd(eodSpot)) return eodSpot / (1 + d1Pct / 100);
  const prev = spot / (1 + d1Pct / 100);
  return Number.isFinite(prev) && Math.abs(prev) > 1e-12 ? prev : null;
}

function periodStartPriceFromHeader(base: ChartDisplayState): number | null {
  if (
    base.displayPrice == null ||
    base.displayChangeAbs == null ||
    !Number.isFinite(base.displayPrice) ||
    !Number.isFinite(base.displayChangeAbs)
  ) {
    return null;
  }
  return base.displayPrice - base.displayChangeAbs;
}

/**
 * Reference price for today's move during the live session: prior regular-session close,
 * not the close from two trading days ago (which `priorCloseFromD1` yields when paired with live spot).
 */
function resolveLiveSessionPriorClose(
  sessionPriorCloseUsd: number | null | undefined,
  eodSpot: number | null | undefined,
): number | null {
  if (isPositiveUsd(sessionPriorCloseUsd)) return sessionPriorCloseUsd;
  if (isPositiveUsd(eodSpot)) return eodSpot;
  return null;
}

function computeTodayChange(
  priceForChange: number,
  priorClose: number | null,
  d1Eod: number | null | undefined,
  useLiveSpot: boolean,
): { abs: number | null; pct: number | null } {
  if (priorClose != null) {
    const abs = priceForChange - priorClose;
    const pct = changePctFromPrior(abs, priorClose);
    return reconcilePriceChangePair(priceForChange, abs, pct);
  }
  if (!useLiveSpot && d1Eod != null && Number.isFinite(d1Eod)) {
    return { abs: null, pct: d1Eod };
  }
  return { abs: null, pct: null };
}

/**
 * Outside regular hours on multi-day overview ranges: headline price = last session close,
 * while change stays aligned to the selected range (5D, 1M, …).
 */
export function mergeClosedMarketOverviewHeader(
  base: ChartDisplayState,
  perf: StockPerformance | null,
  chartSeries: StockChartSeries,
  now: Date = new Date(),
): ChartDisplayState {
  if (chartSeries !== "price" || getUsEquityMarketSession(now) === "regular") return base;
  if (base.selectionActive || base.isHovering) return base;

  const lastClose = isPositiveUsd(perf?.price) ? perf!.price! : base.displayPrice;
  if (lastClose == null || !Number.isFinite(lastClose)) return base;

  const start = periodStartPriceFromHeader(base);
  if (start == null || !Number.isFinite(start) || Math.abs(start) < 1e-12) {
    return { ...base, displayPrice: lastClose, loading: false, empty: false };
  }

  const abs = lastClose - start;
  const pct = (abs / start) * 100;
  return {
    ...base,
    loading: false,
    empty: false,
    displayPrice: lastClose,
    displayChangeAbs: abs,
    displayChangePct: pct,
    selectionChangeAbs: null,
    selectionChangePct: null,
    isHovering: false,
  };
}

/**
 * Headline is normally driven by a hidden 1D chart. On the visible **1D overview** during the
 * regular session, change matches the chart baseline (session open → live price), not prior close.
 *
 * When the hidden session chart has no points yet, fall back to spot so the header is not "—".
 * Prefer `sessionLiveSpotUsd` (live-price API) over EOD `performance.price` for the headline number
 * during the regular session only. Outside regular hours the headline stays at the prior session close.
 *
 * When `alignChangeWithChartAnchor` is false (other tabs / initial SSR), live-session change is vs
 * prior session close (`sessionPriorCloseUsd` from the realtime quote, else last EOD bar).
 */
export function mergeSessionHeaderWithPerformanceSpot(
  base: ChartDisplayState,
  perf: StockPerformance | null,
  chartSeries: StockChartSeries,
  sessionLiveSpotUsd?: number | null,
  now: Date = new Date(),
  sessionPriorCloseUsd?: number | null,
  alignChangeWithChartAnchor = false,
): ChartDisplayState {
  if (chartSeries !== "price" || base.selectionActive) return base;

  // Chart crosshair / mobile scrub — keep chart-driven price and change (1D overview).
  if (base.isHovering) return base;

  const eodSpot = perf?.price;
  const session = getUsEquityMarketSession(now);
  const useLiveSpot = session === "regular";
  const liveSpot = useLiveSpot && isPositiveUsd(sessionLiveSpotUsd) ? sessionLiveSpotUsd : null;
  const spotFromBase =
    base.displayPrice != null && Number.isFinite(base.displayPrice) ? base.displayPrice : null;

  if (session !== "regular" && !base.selectionActive && !base.isHovering && chartSeries === "price") {
    const priorSession = priorSessionDayChangeFromPerformance(
      perf,
      sessionPriorCloseUsd,
    );
    if (priorSession) {
      return {
        ...base,
        loading: false,
        empty: false,
        displayPrice: priorSession.closePrice,
        displayChangeAbs: priorSession.changeAbs,
        displayChangePct: priorSession.changePct,
        selectionChangeAbs: null,
        selectionChangePct: null,
        isHovering: false,
      };
    }
  }

  const spot = useLiveSpot
    ? (liveSpot ?? spotFromBase ?? (isPositiveUsd(eodSpot) ? eodSpot : null))
    : isPositiveUsd(eodSpot)
      ? eodSpot
      : spotFromBase;

  const d1Eod = perf?.d1;

  if (spot != null) {
    const priceForChange = useLiveSpot ? spot : isPositiveUsd(eodSpot) ? eodSpot : spot;
    const chartAnchor =
      useLiveSpot && alignChangeWithChartAnchor ? periodStartPriceFromHeader(base) : null;
    const priorClose = useLiveSpot
      ? isPositiveUsd(chartAnchor)
        ? chartAnchor
        : resolveLiveSessionPriorClose(sessionPriorCloseUsd, eodSpot)
      : priorCloseFromD1(priceForChange, d1Eod ?? NaN, eodSpot);
    const { abs, pct } = computeTodayChange(
      priceForChange,
      priorClose != null && Number.isFinite(priorClose) ? priorClose : null,
      d1Eod,
      useLiveSpot,
    );
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

  if (spotFromBase != null) return { ...base, loading: false };

  return base;
}
