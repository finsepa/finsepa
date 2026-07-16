"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FinancialsColumnOrderToggle } from "@/components/stock/financials-column-order-toggle";
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
import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
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
  type FinancialsTableTimeRange,
} from "@/lib/market/stock-financials-time-range";

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
  onOpenMetricChart,
}: {
  ticker: string;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialQuarterlyPoints?: ChartingSeriesPoint[];
  initialTtmPoint?: ChartingSeriesPoint | null;
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
}) {
  const [view, setView] = useState<FinancialsStatementView>("income");
  const [periodMode, setPeriodMode] = useState<FundamentalsSeriesMode>("annual");
  const [timeRange, setTimeRange] = useState<FinancialsTableTimeRange>("10Y");
  const [columnsNewestFirst, setColumnsNewestFirst] = useState(true);
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
    setColumnsNewestFirst(true);
    setPeriodMode("annual");
    setTimeRange("10Y");
  }, [ticker]);

  useEffect(() => {
    if (isChartingPointArray(initialAnnualPoints)) {
      setAnnualPoints(initialAnnualPoints);
      const seededTtm = parseChartingTtmPoint(initialTtmPoint);
      setTtmPoint(seededTtm);
      setLoading(false);
      if (!seededTtm) {
        void (async () => {
          try {
            const res = await fetch(
              `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=annual`,
              { credentials: "include" },
            );
            if (!res.ok) return;
            const json = (await res.json()) as { ttmPoint?: unknown };
            setTtmPoint(parseChartingTtmPoint(json.ttmPoint));
          } catch {
            /* ignore */
          }
        })();
      }
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
    if (!tableModel || !columnsNewestFirst) return tableModel;
    return reverseIncomeStatementTableColumns(tableModel);
  }, [tableModel, columnsNewestFirst]);

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
    <div className="space-y-4 pt-1">
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StockFinancialsSegmentedToggle value={view} onChange={setView} />
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {displayTableModel ? (
            <FinancialsColumnOrderToggle
              reversed={columnsNewestFirst}
              onToggle={() => setColumnsNewestFirst((v) => !v)}
            />
          ) : null}
          <StockFinancialsPeriodToggle value={periodMode} onChange={onPeriodModeChange} />
          <StockFinancialsTimeRangeToggle value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {loading ? (
        <StockFinancialsTabSkeleton showToolbar={false} />
      ) : !displayTableModel ? (
        <p className="text-[14px] leading-6 text-[#71717A]">{EMPTY_COPY[view][periodMode]}</p>
      ) : (
        <StockIncomeStatementTable
          model={displayTableModel}
          onMetricClick={onOpenMetricChart}
          showLabelColumnRule
        />
      )}
    </div>
  );
}
