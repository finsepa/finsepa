"use client";

import { useState, type ReactNode } from "react";

import {
  EarningsEstimatesChart,
  EarningsEstimatesHeader,
  type EstimatesMetric,
} from "@/components/stock/earnings-estimates-chart";
import { EarningsEstimatesSummaryTable } from "@/components/stock/earnings-estimates-summary-table";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockEarningsEstimatesChart } from "@/lib/market/stock-earnings-types";

/** Estimates header, optional summary cards, chart + table sharing Annual / Quarterly period state. */
export function EarningsEstimatesSection({
  data,
  belowHeader,
}: {
  data: StockEarningsEstimatesChart;
  /** Rendered between the Estimates title/toggles and the chart; receives active period + metric (e.g. summary cards). */
  belowHeader?: (period: FundamentalsSeriesMode, metric: EstimatesMetric) => ReactNode;
}) {
  const [period, setPeriod] = useState<FundamentalsSeriesMode>("annual");
  const [metric, setMetric] = useState<EstimatesMetric>("revenue");
  const hasTable =
    period === "annual" ? data.annual.length > 0 : data.quarterly.length > 0;

  return (
    <div className="min-w-0 space-y-6">
      <EarningsEstimatesHeader
        period={period}
        onPeriodChange={setPeriod}
        metric={metric}
        onMetricChange={setMetric}
      />
      {belowHeader?.(period, metric)}
      <EarningsEstimatesChart data={data} period={period} metric={metric} />
      {hasTable ? <EarningsEstimatesSummaryTable data={data} period={period} /> : null}
    </div>
  );
}
