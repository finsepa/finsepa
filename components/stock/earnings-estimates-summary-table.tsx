"use client";

import { useMemo } from "react";

import { StockIncomeStatementTable } from "@/components/stock/stock-income-statement-table";
import {
  buildEarningsAnnualSummaryTableModel,
  buildEarningsQuarterlySummaryTableModel,
} from "@/lib/market/earnings-annual-summary-model";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockEarningsEstimatesChart } from "@/lib/market/stock-earnings-types";
import type { ChartingMetricId } from "@/lib/market/stock-charting-metrics";

/**
 * Revenue / EPS summary under the Estimates chart — follows the chart's Annual / Quarterly toggle.
 */
export function EarningsEstimatesSummaryTable({
  data,
  period,
  onMetricClick,
}: {
  data: StockEarningsEstimatesChart;
  period: FundamentalsSeriesMode;
  onMetricClick?: (metricId: ChartingMetricId) => void;
}) {
  const model = useMemo(() => {
    if (period === "annual") {
      return buildEarningsAnnualSummaryTableModel(data.annual);
    }
    return buildEarningsQuarterlySummaryTableModel(data.quarterly);
  }, [data, period]);

  if (!model) return null;
  return <StockIncomeStatementTable model={model} onMetricClick={onMetricClick} />;
}
