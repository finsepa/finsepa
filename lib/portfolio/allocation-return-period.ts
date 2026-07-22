/**
 * Allocation donut center — period presets.
 * Same ids/labels as the Overview chart range strip so Return % matches.
 */

import {
  PORTFOLIO_CHART_RANGES,
  type PortfolioChartRange,
} from "@/lib/portfolio/portfolio-chart-types";

/** Chart range id → Dietz period key used by `/api/portfolio/dietz-returns`. */
const DIETZ_KEY_BY_RANGE: Record<
  PortfolioChartRange,
  "d1" | "d7" | "m1" | "m6" | "ytd" | "y1" | "y5" | "all"
> = {
  "1d": "d1",
  "7d": "d7",
  "1m": "m1",
  "6m": "m6",
  ytd: "ytd",
  "1y": "y1",
  "5y": "y5",
  all: "all",
};

const LABEL_BY_RANGE: Record<PortfolioChartRange, string> = {
  "1d": "1D",
  "7d": "7D",
  "1m": "1M",
  "6m": "6M",
  ytd: "YTD",
  "1y": "1Y",
  "5y": "5Y",
  all: "ALL",
};

export const ALLOCATION_RETURN_PERIODS = PORTFOLIO_CHART_RANGES.map((id) => ({
  id,
  label: LABEL_BY_RANGE[id],
  dietzKey: DIETZ_KEY_BY_RANGE[id],
}));

export type AllocationReturnPeriodId = PortfolioChartRange;

/** Match Overview chart default range. */
export const ALLOCATION_RETURN_PERIOD_DEFAULT: AllocationReturnPeriodId = "ytd";

export function allocationReturnPeriodLabel(id: AllocationReturnPeriodId): string {
  return LABEL_BY_RANGE[id] ?? "YTD";
}

export function allocationReturnDietzKey(
  id: AllocationReturnPeriodId,
): "d1" | "d7" | "m1" | "m6" | "ytd" | "y1" | "y5" | "all" {
  return DIETZ_KEY_BY_RANGE[id] ?? "ytd";
}

/** Normalize legacy ids (e.g. pre-alignment "today") to a chart range. */
export function normalizeAllocationReturnPeriod(
  id: string | null | undefined,
): AllocationReturnPeriodId {
  if (id === "today") return "1d";
  if (id && (PORTFOLIO_CHART_RANGES as readonly string[]).includes(id)) {
    return id as AllocationReturnPeriodId;
  }
  return ALLOCATION_RETURN_PERIOD_DEFAULT;
}
