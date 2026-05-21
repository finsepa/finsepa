"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { FinancialsColumnOrderToggle } from "@/components/stock/financials-column-order-toggle";
import { StockIncomeStatementTable } from "@/components/stock/stock-income-statement-table";
import {
  StockFinancialsSegmentedToggle,
  type FinancialsStatementView,
} from "@/components/stock/stock-financials-segmented-toggle";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";
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

function isChartingPointArray(v: unknown): v is ChartingSeriesPoint[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && "periodEnd" in x);
}

const EMPTY_COPY: Record<FinancialsStatementView, string> = {
  income: "No annual income statement data available for this symbol.",
  balance: "No annual balance sheet data available for this symbol.",
  cashflow: "No cash flow series in this feed yet (free cash flow and dividends when reported).",
  ratios: "No ratio history available for this symbol.",
};

function parseTtmPoint(raw: unknown): ChartingSeriesPoint | null {
  if (!raw || typeof raw !== "object" || !("periodEnd" in raw)) return null;
  return raw as ChartingSeriesPoint;
}

function buildModelForView(
  view: FinancialsStatementView,
  points: ChartingSeriesPoint[],
  ttmPoint: ChartingSeriesPoint | null,
): IncomeStatementTableModel | null {
  switch (view) {
    case "income":
      return buildIncomeStatementTableModel(points, ttmPoint);
    case "balance":
      return buildBalanceSheetTableModel(points, ttmPoint);
    case "cashflow":
      return buildCashFlowTableModel(points, ttmPoint);
    case "ratios":
      return buildRatiosTableModel(points, ttmPoint);
  }
}

export function StockFinancialsTab({
  ticker,
  initialAnnualPoints,
  initialTtmPoint,
  onOpenMetricChart,
}: {
  ticker: string;
  initialAnnualPoints?: ChartingSeriesPoint[];
  initialTtmPoint?: ChartingSeriesPoint | null;
  onOpenMetricChart?: (metricId: ChartingMetricId) => void;
}) {
  const [view, setView] = useState<FinancialsStatementView>("income");
  const [columnsNewestFirst, setColumnsNewestFirst] = useState(false);
  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() =>
    isChartingPointArray(initialAnnualPoints) ? initialAnnualPoints : [],
  );
  const [ttmPoint, setTtmPoint] = useState<ChartingSeriesPoint | null>(() =>
    initialTtmPoint && typeof initialTtmPoint === "object" && "periodEnd" in initialTtmPoint
      ? initialTtmPoint
      : null,
  );
  const [loading, setLoading] = useState(() => !isChartingPointArray(initialAnnualPoints));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/stocks/${encodeURIComponent(ticker)}/fundamentals-series?period=annual`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setPoints([]);
        return;
      }
      const json = (await res.json()) as { points?: unknown; ttmPoint?: unknown };
      const next = json.points;
      setPoints(isChartingPointArray(next) ? next : []);
      setTtmPoint(parseTtmPoint(json.ttmPoint));
    } catch {
      setPoints([]);
      setTtmPoint(null);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    setColumnsNewestFirst(false);
  }, [ticker]);

  useEffect(() => {
    if (isChartingPointArray(initialAnnualPoints)) {
      setPoints(initialAnnualPoints);
      const seededTtm = parseTtmPoint(initialTtmPoint);
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
            setTtmPoint(parseTtmPoint(json.ttmPoint));
          } catch {
            /* ignore */
          }
        })();
      }
      return;
    }
    void load();
  }, [ticker, initialAnnualPoints, initialTtmPoint, load]);

  const tableModel = useMemo(() => buildModelForView(view, points, ttmPoint), [view, points, ttmPoint]);

  const displayTableModel = useMemo(() => {
    if (!tableModel || !columnsNewestFirst) return tableModel;
    return reverseIncomeStatementTableColumns(tableModel);
  }, [tableModel, columnsNewestFirst]);

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 className="shrink-0 text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Financials</h2>
        <div className="flex min-w-0 items-center gap-2 self-start sm:self-auto">
          {displayTableModel ? (
            <FinancialsColumnOrderToggle
              reversed={columnsNewestFirst}
              onToggle={() => setColumnsNewestFirst((v) => !v)}
            />
          ) : null}
          <StockFinancialsSegmentedToggle value={view} onChange={setView} />
        </div>
      </div>

      {loading ? (
        <div className="-mx-1 overflow-x-auto rounded-lg border border-[#E4E4E7] sm:-mx-0 sm:rounded-none sm:border-x-0 sm:border-t sm:border-b">
          <div className="min-w-[640px] divide-y divide-[#E4E4E7] bg-white px-4 py-4">
            <div className="h-4 w-48 animate-pulse rounded bg-neutral-200/90" />
            <div className="mt-4 h-[200px] animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ) : !displayTableModel ? (
        <p className="text-[14px] leading-6 text-[#71717A]">{EMPTY_COPY[view]}</p>
      ) : (
        <StockIncomeStatementTable model={displayTableModel} onMetricClick={onOpenMetricChart} />
      )}
    </div>
  );
}
