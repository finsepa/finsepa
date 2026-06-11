import type { ChartingMetricKind } from "@/lib/market/stock-charting-metrics";
import type { MacroValueKind } from "@/components/macro/macro-format";

export function macroKindToChartingKind(kind: MacroValueKind): ChartingMetricKind {
  if (kind === "percent") return "percent";
  if (kind === "usd") return "usd";
  return "ratio";
}
