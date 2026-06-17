"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TabSwitcher } from "@/components/design-system";
import type { TabSwitcherOption } from "@/components/design-system";
import { CompanyLogo } from "@/components/screener/company-logo";
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
import { FundamentalsChartSettingsMenu } from "@/components/stock/fundamentals-chart-settings-menu";
import { MultichartVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import {
  DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS,
  type FundamentalsChartDisplayOptions,
} from "@/lib/chart/fundamentals-chart-display-options";
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import {
  CHARTING_METRIC_LABEL,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  FUNDAMENTALS_CHART_TIME_RANGE_LABELS,
  FUNDAMENTALS_CHART_TIME_RANGE_ORDER,
  maxPeriodsForFundamentalsChartTimeRange,
  type FundamentalsChartTimeRange,
} from "@/lib/market/fundamentals-chart-time-range";
import { ChartScreenshotDownloadModal } from "@/components/chart/chart-screenshot-download-modal";
import type { ChartType } from "@/components/charting/charting-workspace";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { AppModalShell } from "@/components/ui/app-modal-shell";
import { AssetChartSkeleton } from "@/components/ui/chart-skeleton";
import {
  fetchChartingFundamentalsSeriesCached,
  readChartingFundamentalsSeriesCache,
} from "@/lib/charting/charting-fundamentals-client-cache";
import type { ChartScreenshotSnapshot } from "@/lib/chart/chart-screenshot-types";
import { Download } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Desktop chart modal width (960px pre–App Modal Shell; avoids shrink-wrapped ~480px default). */
const KEY_STATS_DESKTOP_MODAL_WIDTH_CLASS = "w-full max-w-[960px]";

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

  const sheetPointerHandlers = enabled
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp: finishDrag,
        onPointerCancel: finishDrag,
      }
    : {};

  return { sheetStyle, sheetPointerHandlers };
}

const DESKTOP_PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarterly" },
] as const;

const MOBILE_PERIOD_TAB_OPTIONS = [
  { value: "annual" as const, label: "Annual" },
  { value: "quarterly" as const, label: "Quarter" },
] as const;

const KEY_STATS_TIME_RANGE_TAB_OPTIONS: TabSwitcherOption<FundamentalsChartTimeRange>[] =
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

function seriesHasMetric(
  points: ChartingSeriesPoint[] | null | undefined,
  metricId: ChartingMetricId,
  maxBars: number,
): boolean {
  if (!points?.length) return false;
  return sliceLastAnnualWithMetric(points, metricId, maxBars).length > 0;
}

function resolveFundamentalsPointsForModal(
  ticker: string,
  metricId: ChartingMetricId,
  mode: FundamentalsSeriesMode,
  timeRange: FundamentalsChartTimeRange,
  mobile: boolean,
  initialAnnualPoints?: ChartingSeriesPoint[],
  initialQuarterlyPoints?: ChartingSeriesPoint[],
): { points: ChartingSeriesPoint[]; loading: boolean } {
  const maxBars = maxBarsForMode(mode, mobile, timeRange);
  const period = mode === "quarterly" ? ("quarterly" as const) : ("annual" as const);
  const ssr = pickSeedForMode(mode, initialAnnualPoints, initialQuarterlyPoints);
  if (seriesHasMetric(ssr, metricId, maxBars)) {
    return { points: ssr!, loading: false };
  }
  const cached = readChartingFundamentalsSeriesCache(ticker, period);
  if (seriesHasMetric(cached?.points ?? null, metricId, maxBars)) {
    return { points: cached!.points, loading: false };
  }
  if (ssr?.length) return { points: ssr, loading: true };
  if (cached?.points.length) return { points: cached.points, loading: true };
  return { points: [], loading: true };
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
};

export function KeyStatsMetricChartModal({
  ticker,
  metricId,
  onClose,
  initialAnnualPoints,
  initialQuarterlyPoints,
  headerMeta,
}: Props) {
  const isMobile = useKeyStatsModalMobile();
  const { sheetStyle, sheetPointerHandlers } = useMobileSheetDragDismiss(onClose, isMobile);
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");
  const [chartVisual, setChartVisual] = useState<MultichartVisual>("bar");
  const [timeRange, setTimeRange] = useState<FundamentalsChartTimeRange>("all");
  const [displayOptions, setDisplayOptions] = useState<FundamentalsChartDisplayOptions>(
    () => ({ ...DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS }),
  );
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadSnapshot, setDownloadSnapshot] = useState<ChartScreenshotSnapshot | null>(null);

  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() => {
    if (metricId == null) return [];
    const mobile = isKeyStatsModalMobileViewport();
    return resolveFundamentalsPointsForModal(
      ticker,
      metricId,
      "annual",
      "all",
      mobile,
      initialAnnualPoints,
      initialQuarterlyPoints,
    ).points;
  });
  const [loading, setLoading] = useState(() => {
    if (metricId == null) return false;
    const mobile = isKeyStatsModalMobileViewport();
    return resolveFundamentalsPointsForModal(
      ticker,
      metricId,
      "annual",
      "all",
      mobile,
      initialAnnualPoints,
      initialQuarterlyPoints,
    ).loading;
  });

  useEffect(() => {
    if (metricId == null) return;
    const activeMetric: ChartingMetricId = metricId;
    let cancelled = false;
    async function load() {
      const resolved = resolveFundamentalsPointsForModal(
        ticker,
        activeMetric,
        periodMode,
        timeRange,
        isMobile,
        initialAnnualPoints,
        initialQuarterlyPoints,
      );
      if (!resolved.loading) {
        if (!cancelled) {
          setPoints(resolved.points);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const period = periodMode === "quarterly" ? "quarterly" : "annual";
      const fetched = await fetchChartingFundamentalsSeriesCached(ticker, period);
      if (!cancelled) setPoints(fetched?.points ?? []);
      if (!cancelled) setLoading(false);
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
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [metricId, onKeyDown]);

  useEffect(() => {
    if (!metricId) return;
    setPeriodMode("annual");
    setChartVisual("bar");
    setTimeRange("all");
    setDisplayOptions({ ...DEFAULT_FUNDAMENTALS_CHART_DISPLAY_OPTIONS });
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
  const metricTitle = CHARTING_METRIC_LABEL[metricId];
  const companyLine = headerMeta?.fullName?.trim() || null;
  const logoName = companyLine ?? ticker;
  const mobileSubtitle = companyLine ? `${ticker} · ${companyLine}` : ticker;
  const horizontalPeriodAxisLabels =
    periodMode === "annual" && (timeRange === "5Y" || timeRange === "10Y");
  const periodPlotMargins = timeRange === "all" ? { left: 0.012, right: 0.018 } : undefined;

  const handleOpenDownload = () => {
    const chartType: ChartType = chartVisual === "line" ? "line" : "bars";
    setDownloadSnapshot({
      variant: "keyStatsMetric",
      ticker,
      companyName: companyLine,
      logoUrl: headerMeta?.logoUrl ?? null,
      periodMode,
      timeRange,
      chartType,
      selectedMetrics: [metricId],
      fullPoints: points,
      keyStatsMetric: {
        metricId,
        metricLabel: metricTitle,
        chartVisual,
        timeRange,
        displayOptions,
        maxBars,
        barWidthPx,
        denseQuarterlyBars,
        horizontalPeriodAxisLabels,
        periodPlotMargins,
      },
    });
    setDownloadOpen(true);
  };

  const chartHeight = isMobile ? MOBILE_KEY_STATS_CHART_HEIGHT_PX : 400;
  const periodTabOptions = isMobile ? MOBILE_PERIOD_TAB_OPTIONS : DESKTOP_PERIOD_TAB_OPTIONS;

  const chartBody = useMemo(() => {
    if (loading) {
      return <AssetChartSkeleton heightPx={chartHeight} className="w-full min-w-0" />;
    }
    if (!hasSeries) {
      return <p className="text-[14px] leading-6 text-[#71717A]">No data for this metric.</p>;
    }
    return (
      <div className="min-w-0">
        <MultichartFundamentalsBar
          key={`${metricId}-${periodMode}-${timeRange}-${chartVisual}`}
          metricId={metricId}
          points={points}
          height={chartHeight}
          periodMode={periodMode}
          visual={chartVisual}
          maxBars={maxBars}
          barWidthPx={barWidthPx}
          compactHorizontalLayout
          displayOptions={displayOptions}
          animateBarsOnAppear
          horizontalPeriodAxisLabels={horizontalPeriodAxisLabels}
          periodPlotMargins={periodPlotMargins}
        />
        {!isMobile && metricId === "forward_pe" ? (
          <p className="mt-3 text-[12px] leading-5 text-[#71717A]">
            Live forward P/E in Key Stats uses current price and consensus EPS. Historical fiscal rows
            rarely include that forward multiple; when it is missing, the bar uses trailing P/E for the
            same period so year-to-year comparisons stay available.
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
    displayOptions,
  ]);

  const shell = isMobile ? (
    <AppModalShell
      titleId="key-stats-metric-chart-title"
      showClose={false}
      maxWidthClass="w-full"
      maxHeightClass="max-h-[min(92vh,720px)]"
      className="key-stats-metric-sheet-enter !rounded-t-xl !rounded-b-none !bg-white !p-0 !shadow-[0px_10px_8px_rgba(10,10,10,0.1),0px_4px_3px_rgba(10,10,10,0.04)]"
      bareBody
      bodyScroll={false}
    >
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
      <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-1">
        <TabSwitcher
          size="sm"
          fullWidth
          options={periodTabOptions}
          value={periodMode}
          onChange={setPeriodMode}
          aria-label="Reporting period"
          className="min-w-0 flex-1"
        />
        <FundamentalsChartSettingsMenu options={displayOptions} onChange={setDisplayOptions} />
        <MultichartVisualSwitcher variant="icon" value={chartVisual} onChange={setChartVisual} />
      </div>
    </AppModalShell>
  ) : (
    <AppModalShell
      titleId="key-stats-metric-chart-title"
      title="Metric"
      onClose={onClose}
      maxWidthClass="w-full"
      maxHeightClass="max-h-[min(92vh,900px)]"
      bodyScroll={false}
      bodyClassName="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-0"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] px-5 pt-5 pb-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CompanyLogo
            name={logoName}
            logoUrl={headerMeta?.logoUrl ?? ""}
            symbol={ticker}
            size="lg"
            className="!rounded-xl"
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="shrink-0 text-[18px] font-semibold leading-7 text-[#09090B]">
              {metricTitle}
            </span>
            {companyLine ? (
              <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{companyLine}</span>
            ) : (
              <span className="min-w-0 truncate text-[14px] leading-5 text-[#71717A]">{ticker}</span>
            )}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <TabSwitcher
            size="sm"
            options={periodTabOptions}
            value={periodMode}
            onChange={setPeriodMode}
            aria-label="Reporting period"
          />
          <FundamentalsChartSettingsMenu options={displayOptions} onChange={setDisplayOptions} />
          <MultichartVisualSwitcher variant="icon" value={chartVisual} onChange={setChartVisual} />
          <TabSwitcher
            size="sm"
            options={KEY_STATS_TIME_RANGE_TAB_OPTIONS}
            value={timeRange}
            onChange={setTimeRange}
            aria-label="Date range"
          />
          <button
            type="button"
            onClick={handleOpenDownload}
            disabled={loading || !hasSeries}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#E4E4E7] bg-white text-[#09090B] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Download chart"
          >
            <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 px-5 py-4">{chartBody}</div>
    </AppModalShell>
  );

  return (
    <>
      <AppModalOverlay
        open={metricId != null}
        onClose={onClose}
        zIndex={300}
        align={isMobile ? "bottom" : "center"}
      >
        <div
          className={cn(!isMobile && KEY_STATS_DESKTOP_MODAL_WIDTH_CLASS)}
          style={isMobile ? sheetStyle : undefined}
          onMouseDown={(e) => e.stopPropagation()}
          {...(isMobile ? sheetPointerHandlers : {})}
        >
          {shell}
        </div>
      </AppModalOverlay>
      {!isMobile ? (
        <ChartScreenshotDownloadModal
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
          snapshot={downloadSnapshot}
          zIndex={350}
        />
      ) : null}
    </>
  );
}
