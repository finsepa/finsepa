"use client";

import { useMemo } from "react";

import { StockIncomeStatementTable } from "@/components/stock/stock-income-statement-table";
import { buildEarningsAnnualSummaryTableModel } from "@/lib/market/earnings-annual-summary-model";
import type { StockEarningsEstimatesPoint } from "@/lib/market/stock-earnings-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";

/**
 * Annual revenue / EPS summary — same `annual` points as the Estimates chart, rendered with
 * Financials income-statement table chrome (Fiscal Year / Period Ending headers, row dividers).
 */
export function EarningsAnnualSummaryTable({
  annual,
  onMetricClick,
}: {
  annual: StockEarningsEstimatesPoint[];
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const model = useMemo(() => buildEarningsAnnualSummaryTableModel(annual), [annual]);
  if (!model) return null;
  return (
    <StockIncomeStatementTable
      model={model}
      onMetricClick={onMetricClick}
      showPeriodEndingRow={false}
      viewportScroll={false}
    />
  );
}
