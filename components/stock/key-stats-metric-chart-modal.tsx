"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X } from "lucide-react";

import { TabSwitcher } from "@/components/design-system";
import { ScreenerRankBadge } from "@/components/earnings/screener-rank-badge";
import { CompanyLogo } from "@/components/screener/company-logo";
import { FormListboxSelect } from "@/components/ui/form-listbox-select";
import type { ListboxOption } from "@/components/ui/form-listbox-select";
import {
  MultichartFundamentalsBar,
  MULTICHART_BAR_WIDTH_PX,
  MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX,
  MULTICHART_BAR_WIDTH_DENSE_QUARTERLY_PX,
  MULTICHART_BAR_WIDTH_EXTRA_WIDE_PX,
  MULTICHART_BAR_WIDTH_WIDE_PX,
  MULTICHART_MAX_ANNUAL_BARS,
  MULTICHART_MAX_QUARTERLY_BARS,
  sliceLastAnnualWithMetric,
  type MultichartVisual,
} from "@/components/stock/multichart-fundamentals-bar";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import {
  CHARTING_METRIC_LABEL,
  chartingMetricToParam,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  FUNDAMENTALS_CHART_TIME_RANGE_LABELS,
  FUNDAMENTALS_CHART_TIME_RANGE_ORDER,
  maxPeriodsForFundamentalsChartTimeRange,
  type FundamentalsChartTimeRange,
} from "@/lib/market/fundamentals-chart-time-range";
import { cn } from "@/lib/utils";

/** Mobile Key Stats sheet: last 10 fiscal years (40 quarters). */
const MOBILE_KEY_STATS_MAX_ANNUAL_BARS = 10;
const MOBILE_KEY_STATS_MAX_QUARTERLY_BARS = 40;
const MOBILE_KEY_STATS_CHART_HEIGHT_PX = 268;
const MOBILE_SHEET_DISMISS_DRAG_PX = 72;

function useMobileSheetDragDismiss(onClose: () => void, enabled: boolean) {
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startClientYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const resetDrag = useCallback(() => {
    setDragging(false);
    setDragOffsetY(0);
    pointerIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) resetDrag();
  }, [enabled, resetDrag]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (!(e.target as HTMLElement).closest("[data-sheet-drag-handle]")) return;
      pointerIdRef.current = e.pointerId;
      startClientYRef.current = e.clientY;
      setDragging(true);
      setDragOffsetY(0);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || pointerIdRef.current !== e.pointerId) return;
      setDragOffsetY(Math.max(0, e.clientY - startClientYRef.current));
    },
    [enabled],
  );

  const finishDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || pointerIdRef.current !== e.pointerId) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const dy = Math.max(0, e.clientY - startClientYRef.current);
      if (dy >= MOBILE_SHEET_DISMISS_DRAG_PX) {
        onClose();
        return;
      }
      resetDrag();
    },
    [enabled, onClose, resetDrag],
  );

  const sheetStyle =
    dragOffsetY > 0
      ? {
          transform: `translate3d(0, ${dragOffsetY}px, 0)`,
          transition: dragging ? "none" : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        }
      : undefined;

  const backdropStyle =
    dragOffsetY > 0 ? { opacity: Math.max(0.2, 0.6 - dragOffsetY / 400) } : undefined;

  const sheetPointerHandlers = enabled
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: finishDrag,
        onPointerCancel: finishDrag,
      }
    : {};

  return { sheetStyle, backdropStyle, sheetPointerHandlers };
}

const DESKTOP_PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
] as const;

const MOBILE_PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarter" },
] as const;

const KEY_STATS_TIME_RANGE_OPTIONS: ListboxOption<FundamentalsChartTimeRange>[] =
  FUNDAMENTALS_CHART_TIME_RANGE_ORDER.map((value) => ({
    value,
    label: FUNDAMENTALS_CHART_TIME_RANGE_LABELS[value],
  }));

function maxBarsForMode(
  mode: FundamentalsSeriesMode,
  mobile: boolean,
  timeRange: FundamentalsChartTimeRange,
): number {
  const platformCap = mobile
    ? mode === "quarterly"
      ? MOBILE_KEY_STATS_MAX_QUARTERLY_BARS
      : MOBILE_KEY_STATS_MAX_ANNUAL_BARS
    : mode === "quarterly"
      ? MULTICHART_MAX_QUARTERLY_BARS
      : MULTICHART_MAX_ANNUAL_BARS;
  const rangeCap = maxPeriodsForFundamentalsChartTimeRange(mode, timeRange);
  return Math.min(platformCap, rangeCap);
}

function pickSeedForMode(
  mode: FundamentalsSeriesMode,
  initialAnnualPoints?: ChartingSeriesPoint[],
  initialQuarterlyPoints?: ChartingSeriesPoint[],
): ChartingSeriesPoint[] | null {
  if (mode === "quarterly") {
    return Array.isArray(initialQuarterlyPoints) && initialQuarterlyPoints.length > 0 ? initialQuarterlyPoints : null;
  }
  return Array.isArray(initialAnnualPoints) && initialAnnualPoints.length > 0 ? initialAnnualPoints : null;
}

function isKeyStatsModalMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function useKeyStatsModalMobile(): boolean {
  const [mobile, setMobile] = useState(isKeyStatsModalMobileViewport);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

type Props = {
  ticker: string;
  metricId: ChartingMetricId | null;
  onClose: () => void;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  headerMeta: StockDetailHeaderMeta | null;
  /** When set (e.g. from calendar), matches Earnings preview badge. */
  screenerRank?: number | null;
};

export function KeyStatsMetricChartModal({
  ticker,
  metricId,
  onClose,
  initialAnnualPoints,
  initialQuarterlyPoints,
  headerMeta,
  screenerRank = null,
}: Props) {
  const isMobile = useKeyStatsModalMobile();
  const { sheetStyle, backdropStyle, sheetPointerHandlers } = useMobileSheetDragDismiss(onClose, isMobile);
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");
  const [chartVisual, setChartVisual] = useState<MultichartVisual>("bar");
  const [timeRange, setTimeRange] = useState<FundamentalsChartTimeRange>("all");

  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() => {
    if (metricId == null) return [];
    const seed = pickSeedForMode("annual", initialAnnualPoints, initialQuarterlyPoints);
    if (!seed) return [];
    const mobile = isKeyStatsModalMobileViewport();
    return sliceLastAnnualWithMetric(seed, metricId, maxBarsForMode("annual", mobile, "all")).length > 0
      ? seed
      : [];
  });
  const [loading, setLoading] = useState(() => {
    if (metricId == null) return false;
    const seed = pickSeedForMode("annual", initialAnnualPoints, initialQuarterlyPoints);
    if (!seed) return true;
    const mobile = isKeyStatsModalMobileViewport();
    return sliceLastAnnualWithMetric(seed, metricId, maxBarsForMode("annual", mobile, "all")).length === 0;
  });

  useEffect(() => {
    if (metricId == null) return;
    const activeMetric: ChartingMetricId = metricId;
    let cancelled = false;
    async function load() {
      const max = maxBarsForMode(periodMode, isMobile, timeRange);
      const seed = pickSeedForMode(periodMode, initialAnnualPoints, initialQuarterlyPoints);
      if (seed && sliceLastAnnualWithMetric(seed, activeMetric, max).length > 0) {
        if (!cancelled) {
          setPoints(seed);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${
            periodMode === "quarterly" ? "quarterly" : "annual"
          }`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok) {
          if (!cancelled) setPoints([]);
          return;
        }
        const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
        if (!cancelled) setPoints(Array.isArray(json.points) ? json.points : []);
      } catch {
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, periodMode, timeRange, metricId, initialAnnualPoints, initialQuarterlyPoints, isMobile]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!metricId) return;
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [metricId, onKeyDown]);

  useEffect(() => {
    if (!metricId) return;
    setPeriodMode("annual");
    setChartVisual("bar");
    setTimeRange("all");
  }, [metricId]);

  if (!metricId) return null;

  const maxBars = maxBarsForMode(periodMode, isMobile, timeRange);
  const denseQuarterlyBars =
    periodMode === "quarterly" && (timeRange === "5Y" || timeRange === "10Y");
  const barWidthPx =
    timeRange === "all"
      ? periodMode === "quarterly"
        ? MULTICHART_BAR_WIDTH_ALL_QUARTERLY_PX
        : MULTICHART_BAR_WIDTH_PX
      : denseQuarterlyBars
        ? MULTICHART_BAR_WIDTH_DENSE_QUARTERLY_PX
        : timeRange === "10Y"
          ? MULTICHART_BAR_WIDTH_WIDE_PX
          : MULTICHART_BAR_WIDTH_EXTRA_WIDE_PX;
  const hasSeries = sliceLastAnnualWithMetric(points, metricId, maxBars).length > 0;
  const chartingHref = `/stock/${encodeURIComponent(ticker.trim())}?tab=charting&metric=${encodeURIComponent(
    chartingMetricToParam(metricId),
  )}`;
  const metricTitle = CHARTING_METRIC_LABEL[metricId];
  const companyLine = headerMeta?.fullName?.trim() || null;
  const logoName = companyLine ?? ticker;
  const mobileSubtitle = companyLine ? `${ticker} · ${companyLine}` : ticker;

  const chartHeight = isMobile ? MOBILE_KEY_STATS_CHART_HEIGHT_PX : 400;
  const periodTabOptions = isMobile ? MOBILE_PERIOD_TAB_OPTIONS : DESKTOP_PERIOD_TAB_OPTIONS;

  const chartBody = useMemo(() => {
    if (loading) {
      return (
        <div
          className={cn(
            "flex items-center justify-center text-[14px] text-[#71717A]",
            isMobile ? "h-[268px]" : "h-[400px]",
          )}
        >
          Loading…
        </div>
      );
    }
    if (!hasSeries) {
      return <p className="text-[14px] leading-6 text-[#71717A]">No data for this metric.</p>;
    }
    return (
      <div className="min-w-0">
        <MultichartFundamentalsBar
          metricId={metricId}
          points={points}
          height={chartHeight}
          periodMode={periodMode}
          visual={chartVisual}
          maxBars={maxBars}
          barWidthPx={barWidthPx}
          compactHorizontalLayout
          periodPlotMargins={
            timeRange === "all" ? { left: 0.012, right: 0.018 } : undefined
          }
        />
        {!isMobile && metricId === "forward_pe" ? (
          <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
            Live forward P/E in Key Stats uses current price and consensus EPS. Historical fiscal rows
            rarely include that forward multiple; when it is missing, the bar uses trailing P/E for the
            same period so year-to-year comparisons stay available.
          </p>
        ) : null}
        {!isMobile && (metricId === "dividend_yield" || metricId === "payout_ratio") ? (
          <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
            Dividend yield and payout are computed from fiscal cash flow and net income on merged statements
            (same periods as other fundamentals charts), not a live forward yield from Highlights.
          </p>
        ) : null}
      </div>
    );
  }, [
    loading,
    hasSeries,
    metricId,
    points,
    chartHeight,
    periodMode,
    chartVisual,
    maxBars,
    barWidthPx,
    isMobile,
    timeRange,
  ]);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[300]",
        isMobile ? "flex items-end p-2" : "flex items-center justify-center p-4",
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-stats-metric-chart-title"
    >
      <button
        type="button"
        className={cn("absolute inset-0", isMobile ? "bg-black/60" : "bg-black/40")}
        style={isMobile ? backdropStyle : undefined}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex w-full flex-col overflow-hidden bg-white",
          isMobile
            ? "key-stats-metric-sheet-enter max-h-[min(92vh,720px)] rounded-xl border border-[#E4E4E7] shadow-[0px_10px_8px_rgba(10,10,10,0.1),0px_4px_3px_rgba(10,10,10,0.04)]"
            : "max-h-[min(92vh,900px)] max-w-[min(1080px,calc(100vw-2rem))] rounded-xl border border-[#E4E4E7] shadow-[0px_10px_16px_-3px_rgba(10,10,10,0.1),0px_4px_6px_0px_rgba(10,10,10,0.04)]",
        )}
        style={isMobile ? sheetStyle : undefined}
        {...(isMobile ? sheetPointerHandlers : {})}
      >
        {isMobile ? (
          <>
            <div
              data-sheet-drag-handle
              className="flex shrink-0 cursor-grab flex-col items-center gap-3 px-4 pb-1 pt-2 active:cursor-grabbing"
            >
              <div className="h-1 w-10 shrink-0 rounded-full bg-[#D9D9D9]" aria-hidden />
              <div className="flex w-full flex-col items-center gap-1 text-center">
                <h2
                  id="key-stats-metric-chart-title"
                  className="text-[16px] font-semibold leading-6 text-[#09090B]"
                >
                  {metricTitle}
                </h2>
                <p className="text-[11px] leading-4 text-[#71717A]">{mobileSubtitle}</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto px-4 py-2">
              {chartBody}
            </div>
            <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-1">
              <TabSwitcher
                size="sm"
                fullWidth
                options={periodTabOptions}
                value={periodMode}
                onChange={setPeriodMode}
                aria-label="Reporting period"
                className="min-w-0 flex-1"
              />
              <MultichartVisualSwitcher
                variant="icon"
                value={chartVisual}
                onChange={setChartVisual}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-[#E4E4E7] px-5 py-4">
              <Link
                href={chartingHref}
                onClick={() => onClose()}
                className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-[10px] outline-none ring-offset-2 transition-colors hover:bg-[#F4F4F5] focus-visible:ring-2 focus-visible:ring-[#09090B]/15"
                title={`Open Charting — ${metricTitle}`}
              >
                <CompanyLogo name={logoName} logoUrl={headerMeta?.logoUrl ?? ""} symbol={ticker} size="lg" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      id="key-stats-metric-chart-title"
                      className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B]"
                    >
                      {metricTitle}
                    </span>
                    {screenerRank != null ? <ScreenerRankBadge rank={screenerRank} /> : null}
                  </span>
                  {companyLine ? (
                    <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{companyLine}</span>
                  ) : (
                    <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{ticker}</span>
                  )}
                </span>
              </Link>
              <div className="flex shrink-0 flex-nowrap items-center gap-2">
                <FormListboxSelect
                  compact
                  value={timeRange}
                  onChange={setTimeRange}
                  options={KEY_STATS_TIME_RANGE_OPTIONS}
                  aria-label="Date range"
                  className="w-[4.25rem] shrink-0"
                  listboxClassName="z-[310]"
                  menuAlign="trailing"
                />
                <TabSwitcher
                  size="sm"
                  options={periodTabOptions}
                  value={periodMode}
                  onChange={setPeriodMode}
                  aria-label="Reporting period"
                />
                <MultichartVisualSwitcher variant="icon" value={chartVisual} onChange={setChartVisual} />
              </div>
              <span className="h-6 w-px shrink-0 bg-[#E4E4E7]" aria-hidden />
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[#71717A] transition-colors hover:bg-[#F4F4F5] hover:text-[#09090B]"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4">{chartBody}</div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
