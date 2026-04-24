"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { StockIncomeStatementTable } from "@/components/stock/stock-income-statement-table";
import {
  StockFinancialsSegmentedToggle,
  type FinancialsStatementView,
} from "@/components/stock/stock-financials-segmented-toggle";
import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import {
  buildIncomeStatementTableModel,
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

function buildModelForView(
  view: FinancialsStatementView,
  points: ChartingSeriesPoint[],
): IncomeStatementTableModel | null {
  switch (view) {
    case "income":
      return buildIncomeStatementTableModel(points);
    case "balance":
      return buildBalanceSheetTableModel(points);
    case "cashflow":
      return buildCashFlowTableModel(points);
    case "ratios":
      return buildRatiosTableModel(points);
  }
}

export function StockFinancialsTab({
  ticker,
  initialAnnualPoints,
}: {
  ticker: string;
  initialAnnualPoints?: ChartingSeriesPoint[];
}) {
  const [view, setView] = useState<FinancialsStatementView>("income");
  const [points, setPoints] = useState<ChartingSeriesPoint[]>(() =>
    isChartingPointArray(initialAnnualPoints) ? initialAnnualPoints : [],
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
      const json = (await res.json()) as { points?: unknown };
      const next = json.points;
      setPoints(isChartingPointArray(next) ? next : []);
    } catch {
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    if (isChartingPointArray(initialAnnualPoints)) {
      setPoints(initialAnnualPoints);
      setLoading(false);
      return;
    }
    void load();
  }, [ticker, initialAnnualPoints, load]);

  const tableModel = useMemo(() => buildModelForView(view, points), [view, points]);

  return (
    <div className="space-y-4 pt-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 className="shrink-0 text-[20px] font-semibold leading-8 tracking-tight text-[#09090B]">Financials</h2>
        <StockFinancialsSegmentedToggle value={view} onChange={setView} />
      </div>

      {loading ? (
        <div className="-mx-1 overflow-x-auto rounded-lg border border-[#E4E4E7] sm:-mx-0 sm:rounded-none sm:border-x-0 sm:border-t sm:border-b">
          <div className="min-w-[640px] divide-y divide-[#E4E4E7] bg-white px-4 py-4">
            <div className="h-4 w-48 animate-pulse rounded bg-neutral-200/90" />
            <div className="mt-4 h-[200px] animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ) : !tableModel ? (
        <p className="text-[14px] leading-6 text-[#71717A]">{EMPTY_COPY[view]}</p>
      ) : (
        <StockIncomeStatementTable model={tableModel} />
      )}
    </div>
  );
}
