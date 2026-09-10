"use client";

import { useState, type ReactNode } from "react";

import {
  EarningsEstimatesChart,
  EarningsEstimatesHeader,
  type EstimatesMetric,
} from "@/components/stock/earnings-estimates-chart";
import type { FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import type { StockEarningsEstimatesChart } from "@/lib/market/stock-earnings-types";

/** Estimates header + chart sharing Annual / Quarterly period state. */
export function EarningsEstimatesSection({
  data,
  aboveHeader,
}: {
  data: StockEarningsEstimatesChart;
  /** Rendered above the Revenue/EPS toggle row (e.g. Next earnings / Days left). */
  aboveHeader?: ReactNode;
}) {
  const [period, setPeriod] = useState<FundamentalsSeriesMode>("quarterly");
  const [metric, setMetric] = useState<EstimatesMetric>("eps");

  return (
    <div className="min-w-0 space-y-5">
      <div className="min-w-0 space-y-5">
        {aboveHeader}
        <EarningsEstimatesHeader
          period={period}
          onPeriodChange={setPeriod}
          metric={metric}
          onMetricChange={setMetric}
        />
      </div>
      <EarningsEstimatesChart data={data} period={period} metric={metric} />
    </div>
  );
}
