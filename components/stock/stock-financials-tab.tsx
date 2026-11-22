"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, Plus } from "@/lib/icons";

import { ChartingWorkspace } from "@/components/charting/charting-workspace";
import { ChartingMetricPickerMenu } from "@/components/charting/charting-metric-picker-menu";
import type { ChartType } from "@/components/charting/charting-time-range";
import { FinancialsColumnOrderToggle } from "@/components/stock/financials-column-order-toggle";
import { ChartingVisualSwitcher } from "@/components/stock/multichart-visual-switcher";
import { StockFinancialsTabSkeleton } from "@/components/stock/stock-financials-tab-skeleton";
import { StockIncomeStatementTable } from "@/components/stock/stock-income-statement-table";
import {
  StockFinancialsSegmentedToggle,
  type FinancialsStatementView,
} from "@/components/stock/stock-financials-segmented-toggle";
import {
  StockFinancialsMobileToolbar,
  StockFinancialsPeriodToggle,
  StockFinancialsTimeRangeToggle,
} from "@/components/stock/stock-financials-toolbar-toggles";
import { secondaryOutlineButtonClassName } from "@/components/design-system";
import { STOCK_OVERVIEW_SECTION_HEADING_CLASS } from "@/components/design-system/card-surface-styles";
import { topbarSquircleIconClass } from "@/components/design-system/topbar-control-classes";
import { TopbarDropdownPortal } from "@/components/layout/topbar-dropdown-portal";
import { shellScrollToTop } from "@/lib/layout/use-shell-scroll-root";
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
import { chartingMetricsToParam } from "@/lib/market/stock-charting-metrics";
import { parseChartingTtmPoint } from "@/lib/market/charting-period-display";
import {
  buildIncomeStatementTableModel,
  reverseIncomeStatementTableColumns,
  type IncomeStatementTableModel,
} from "@/lib/market/stock-financials-income-table";
import {
  buildBalanceSheetTableModel,
  buildCashFlowTableModel,
  buildRatiosTableModel,
} from "@/lib/market/stock-financials-extra-tables";
import {
  applyFinancialsTableTimeRange,
  FINANCIALS_TABLE_TIME_RANGE_ORDER,
  type FinancialsTableTimeRange,
} from "@/lib/market/stock-financials-time-range";
import { cn } from "@/lib/utils";

/** Default chart series when opening Financials (matches prior Charting intent for income). */
const FINANCIALS_DEFAULT_CHART_METRICS: ChartingMetricId[] = ["revenue", "operating_income"];

function isChartingPointArray(v: unknown): v is ChartingSeriesPoint[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && "periodEnd" in x);
}

const EMPTY_COPY: Record<FinancialsStatementView, Record<FundamentalsSeriesMode, string>> = {
  income: {
    annual: "No annual income statement data available for this symbol.",
    quarterly: "No quarterly income statement data available for this symbol.",
  },
  balance: {
    annual: "No annual balance sheet data available for this symbol.",
    quarterly: "No quarterly balance sheet data available for this symbol.",
  },
  cashflow: {
    annual: "No cash flow series in this feed yet (free cash flow and dividends when reported).",
    quarterly: "No quarterly cash flow series in this feed yet.",
  },
  ratios: {
    annual: "No ratio history available for this symbol.",
    quarterly: "No quarterly ratio history available for this symbol.",
  },
};

function buildModelForView(
  view: FinancialsStatementView,
  points: ChartingSeriesPoint[],
  ttmPoint: ChartingSeriesPoint | null,
  periodMode: FundamentalsSeriesMode,
): IncomeStatementTableModel | null {
  const ttm = periodMode === "annual" ? ttmPoint : null;
  switch (view) {
    case "income":
      return buildIncomeStatementTableModel(points, ttm, periodMode);
    case "balance":
      return buildBalanceSheetTableModel(points, ttm, periodMode);
    case "cashflow":
      return buildCashFlowTableModel(points, ttm, periodMode);
    case "ratios":
      return buildRatiosTableModel(points, ttm, periodMode);
  }
}

export function StockFinancialsTab({
  ticker,
  initialAnnualPoints,
  initialQuarterlyPoints,
  initialTtmPoint,
  assetDisplayName,
  assetLogoUrl,
}: {
  ticker: string;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  initialTtmPoint?: ChartingSeriesPoint | null;
  assetDisplayName?: string | null;
  assetLogoUrl?: string | null;
}) {
  const [view, setView] = useState<FinancialsStatementView>("income");
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");
  const [timeRange, setTimeRange] = useState<FinancialsTableTimeRange>("10Y");
  /** Default matches chart: oldest → newest (TTM) on the right. Reverse dates flips to newest-first. */
  const [columnsNewestFirst, setColumnsNewestFirst] = useState(false);
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<ChartingMetricId[]>(
    () => [...FINANCIALS_DEFAULT_CHART_METRICS],
  );
  const [chartType, setChartType] = useState<ChartType>("bars");
  const chartDownloadRef = useRef<{ openDownload: () => void } | null>(null);
  /** Chart + Selected block — scroll here when adding a metric from the statement table. */
  const chartSectionRef = useRef<HTMLDivElement>(null);
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const [metricPickerQuery, setMetricPickerQuery] = useState("");
  const metricPickerWrapRef = useRef<HTMLDivElement | null>(null);
  const metricPickerButtonRef = useRef<HTMLButtonElement | null>(null);
  const metricPickerMenuPortalRef = useRef<HTMLDivElement | null>(null);
  const [annualPoints, setAnnualPoints] = useState<ChartingSeriesPoint[]>(() =>
    isChartingPointArray(initialAnnualPoints) ? initialAnnualPoints : [],
  );
  const [quarterlyPoints, setQuarterlyPoints] = useState<ChartingSeriesPoint[]>(() =>
    isChartingPointArray(initialQuarterlyPoints) ? initialQuarterlyPoints : [],
  );
  const [ttmPoint, setTtmPoint] = useState<ChartingSeriesPoint | null>(() =>
    parseChartingTtmPoint(initialTtmPoint),
  );
  const [loading, setLoading] = useState(
    () => !isChartingPointArray(initialAnnualPoints) && !isChartingPointArray(initialQuarterlyPoints),
  );

  const load = useCallback(
    async (mode: FundamentalsSeriesMode) => {
      setLoading(true);
      try {
        const period = mode === "quarterly" ? "quarterly" : "annual";
        const res = await fetch(
          `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=${period}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (mode === "quarterly") setQuarterlyPoints([]);
          else setAnnualPoints([]);
          return;
        }
        const json = (await res.json()) as { points?: unknown; ttmPoint?: unknown };
        const next = json.points;
        const parsed = isChartingPointArray(next) ? next : [];
        if (mode === "quarterly") {
          setQuarterlyPoints(parsed);
        } else {
          setAnnualPoints(parsed);
          setTtmPoint(parseChartingTtmPoint(json.ttmPoint));
        }
      } catch {
        if (mode === "quarterly") setQuarterlyPoints([]);
        else {
          setAnnualPoints([]);
          setTtmPoint(null);
        }
      } finally {
        setLoading(false);
      }
    },
    [ticker],
  );

  useEffect(() => {
    setColumnsNewestFirst(false);
    setPeriodMode("annual");
    setTimeRange("10Y");
    setChartType("bars");
    setSelectedChartMetrics([...FINANCIALS_DEFAULT_CHART_METRICS]);
  }, [ticker]);

  const onChartTypeChange = useCallback((next: ChartType) => {
    setChartType(next);
  }, []);

  const selectedChartMetricSet = useMemo(
    () => new Set(selectedChartMetrics),
    [selectedChartMetrics],
  );

  const chartMetricParam = useMemo(
    () => chartingMetricsToParam(selectedChartMetrics),
    [selectedChartMetrics],
  );

  const pendingScrollToTopRef = useRef(false);

  const scrollShellToTop = useCallback(() => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    if (desktop) {
      const main = chartSectionRef.current?.closest("main");
      if (main instanceof HTMLElement) {
        shellScrollToTop(main, "smooth");
        return;
      }
    }
    shellScrollToTop(window, "smooth");
  }, []);

  const addChartMetric = useCallback((metricId: ChartingMetricId) => {
    setSelectedChartMetrics((prev) => (prev.includes(metricId) ? prev : [...prev, metricId]));
    setMetricPickerQuery("");
    setMetricPickerOpen(false);
    pendingScrollToTopRef.current = true;
  }, []);

  const toggleChartMetric = useCallback((metricId: ChartingMetricId) => {
    let added = false;
    setSelectedChartMetrics((prev) => {
      if (prev.includes(metricId)) return prev.filter((id) => id !== metricId);
      added = true;
      return [...prev, metricId];
    });
    if (!added) return;
    // After the Selected table updates (and the statement row hides), scroll shell to top.
    pendingScrollToTopRef.current = true;
  }, []);

  useLayoutEffect(() => {
    if (!pendingScrollToTopRef.current) return;
    pendingScrollToTopRef.current = false;
    scrollShellToTop();
  }, [selectedChartMetrics, scrollShellToTop]);

  const onSelectedMetricsChange = useCallback((next: ChartingMetricId[]) => {
    setSelectedChartMetrics(next);
  }, []);

  useEffect(() => {
    if (!metricPickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (metricPickerWrapRef.current?.contains(t)) return;
      if (metricPickerMenuPortalRef.current?.contains(t)) return;
      setMetricPickerOpen(false);
      setMetricPickerQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [metricPickerOpen]);

  useEffect(() => {
    if (isChartingPointArray(initialAnnualPoints)) {
      setAnnualPoints(initialAnnualPoints);
      const seededTtm = parseChartingTtmPoint(initialTtmPoint);
      setTtmPoint(seededTtm);
      setLoading(false);
      return;
    }
    void load("annual");
  }, [ticker, initialAnnualPoints, initialTtmPoint, load]);

  useEffect(() => {
    if (isChartingPointArray(initialQuarterlyPoints)) {
      setQuarterlyPoints(initialQuarterlyPoints);
    }
  }, [ticker, initialQuarterlyPoints]);

  useEffect(() => {
    if (periodMode === "annual") return;
    if (quarterlyPoints.length > 0) return;
    if (isChartingPointArray(initialQuarterlyPoints)) {
      setQuarterlyPoints(initialQuarterlyPoints);
      return;
    }
    void load("quarterly");
  }, [periodMode, quarterlyPoints.length, initialQuarterlyPoints, load]);

  const rawPoints = periodMode === "quarterly" ? quarterlyPoints : annualPoints;

  const rangedPoints = useMemo(
    () => applyFinancialsTableTimeRange(rawPoints, periodMode, timeRange),
    [rawPoints, periodMode, timeRange],
  );

  const tableModel = useMemo(
    () => buildModelForView(view, rangedPoints, ttmPoint, periodMode),
    [view, rangedPoints, ttmPoint, periodMode],
  );

  const displayTableModel = useMemo(() => {
    if (!tableModel) return null;
    const ordered = columnsNewestFirst
      ? reverseIncomeStatementTableColumns(tableModel)
      : tableModel;
    // Selected series live in the chart Selected table — omit them here so each row shows once.
    if (selectedChartMetricSet.size === 0) return ordered;
    return {
      ...ordered,
      rows: ordered.rows.filter(
        (row) => !row.chartingMetricId || !selectedChartMetricSet.has(row.chartingMetricId),
      ),
    };
  }, [tableModel, columnsNewestFirst, selectedChartMetricSet]);

  const onPeriodModeChange = useCallback(
    (next: FundamentalsSeriesMode) => {
      setPeriodMode(next);
      if (
        next === "quarterly" &&
        quarterlyPoints.length === 0 &&
        !isChartingPointArray(initialQuarterlyPoints)
      ) {
        setLoading(true);
      }
    },
    [quarterlyPoints.length, initialQuarterlyPoints],
  );

  return (
    <div className="space-y-5">
      <StockFinancialsMobileToolbar
        view={view}
        onViewChange={setView}
        periodMode={periodMode}
        onPeriodModeChange={onPeriodModeChange}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        showColumnOrder={displayTableModel != null}
        columnsNewestFirst={columnsNewestFirst}
        onColumnOrderToggle={() => setColumnsNewestFirst((v) => !v)}
      />
      <div className="hidden flex-col gap-3 sm:flex lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <h2 className={cn("min-w-0 shrink-0", STOCK_OVERVIEW_SECTION_HEADING_CLASS)}>Financials</h2>
        <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
          <StockFinancialsPeriodToggle value={periodMode} onChange={onPeriodModeChange} />
          <StockFinancialsTimeRangeToggle value={timeRange} onChange={setTimeRange} />
          <ChartingVisualSwitcher value={chartType} onChange={onChartTypeChange} className="shrink-0" />
          <button
            type="button"
            onClick={() => chartDownloadRef.current?.openDownload()}
            className={cn(topbarSquircleIconClass, "shrink-0")}
            aria-label="Export"
            title="Export"
          >
            <Download className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
          <div className="relative shrink-0" ref={metricPickerWrapRef}>
            <button
              ref={metricPickerButtonRef}
              type="button"
              className={cn(secondaryOutlineButtonClassName, "gap-2")}
              onClick={() =>
                setMetricPickerOpen((open) => {
                  if (open) setMetricPickerQuery("");
                  return !open;
                })
              }
              aria-label="Add metric"
              title="Add metric"
              aria-expanded={metricPickerOpen}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Add Metric
            </button>
            {metricPickerOpen ? (
              <TopbarDropdownPortal
                open={metricPickerOpen}
                anchorRef={metricPickerButtonRef}
                ref={metricPickerMenuPortalRef}
                align="trailing"
                placement="auto"
                className="w-[min(calc(100vw-2rem),520px)]"
                onRequestClose={() => {
                  setMetricPickerOpen(false);
                  setMetricPickerQuery("");
                }}
              >
                <ChartingMetricPickerMenu
                  excludeMetricIds={selectedChartMetrics}
                  query={metricPickerQuery}
                  onQueryChange={setMetricPickerQuery}
                  onPick={addChartMetric}
                />
              </TopbarDropdownPortal>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={chartSectionRef}
        className="min-w-0 scroll-mt-4 [--fs-chart-plot-bg:var(--fs-panel)] md:scroll-mt-[var(--shell-chrome-header-height,0px)]"
      >
        <ChartingWorkspace
          ticker={ticker}
          metricParam={chartMetricParam || null}
          initialAnnualPoints={annualPoints.length ? annualPoints : undefined}
          initialQuarterlyPoints={quarterlyPoints.length ? quarterlyPoints : undefined}
          initialTtmPoint={ttmPoint}
          metricControlsPlacement="legend"
          omitTickerInLegend
          histogramLayout="stockFullWidthFixedBars"
          animateBarsOnAppear
          enableScreenshotDownload
          hideMetricPicker
          hideDataTable
          hideLegendChips
          showSelectedMetricsTable
          hidePeriodTimeRangeControls
          hideToolbar
          controlledPeriodMode={periodMode}
          controlledTimeRange={timeRange}
          controlledChartType={chartType}
          timeRangeOrder={FINANCIALS_TABLE_TIME_RANGE_ORDER}
          chartDownloadRef={chartDownloadRef}
          onSelectedMetricsChange={onSelectedMetricsChange}
          workspaceTitle=""
          assetDisplayName={assetDisplayName}
          assetLogoUrl={assetLogoUrl}
          // Keep company rail off — Financials checkboxes own metric selection.
          isActive={false}
        />
      </div>

      <div className="hidden items-center justify-between gap-3 sm:flex">
        <StockFinancialsSegmentedToggle value={view} onChange={setView} />
        {displayTableModel ? (
          <FinancialsColumnOrderToggle
            reversed={columnsNewestFirst}
            onToggle={() => setColumnsNewestFirst((v) => !v)}
          />
        ) : null}
      </div>

      {loading ? (
        <StockFinancialsTabSkeleton showToolbar={false} />
      ) : !displayTableModel ? (
        <p className="text-[14px] leading-6 text-fg-muted">{EMPTY_COPY[view][periodMode]}</p>
      ) : (
        <StockIncomeStatementTable
          model={displayTableModel}
          chartMetricSelection={{
            selected: selectedChartMetricSet,
            onToggle: toggleChartMetric,
          }}
          showLabelColumnRule
          // Page-sticky Fiscal Year / Period Ending (like screener) — no fixed table height.
          viewportScroll={false}
          // Newest on the right → pin scroll so the latest columns are in view by default.
          scrollAlignEnd={!columnsNewestFirst}
        />
      )}
    </div>
  );
}
