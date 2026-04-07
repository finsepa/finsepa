import type { StockPerformance } from "@/lib/market/stock-performance-types";

export type OverviewProfitPeriod = "all" | "m1" | "ytd" | "y1" | "y5";

export function pickPerformancePct(
  p: StockPerformance | null,
  period: Exclude<OverviewProfitPeriod, "all">,
): number | null {
  if (!p) return null;
  switch (period) {
    case "m1":
      return p.m1;
    case "ytd":
      return p.ytd;
    case "y1":
      return p.y1;
    case "y5":
      return p.y5;
    default:
      return null;
  }
}
