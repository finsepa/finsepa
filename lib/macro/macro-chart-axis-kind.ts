import type { MacroValueKind } from "@/components/macro/macro-format";
import {
  buildFundamentalsYAxisDomain,
  buildTightNumericYAxisDomain,
  formatFundamentalsAxisTickLabel,
  type FundamentalsYAxisDomain,
} from "@/lib/chart/fundamentals-chart-surface";
import { formatMacroValue } from "@/components/macro/macro-format";
import type { ChartingMetricKind } from "@/lib/market/stock-charting-metrics";

export function macroKindToChartingKind(kind: MacroValueKind): ChartingMetricKind {
  if (kind === "percent") return "percent";
  if (kind === "usd") return "usd";
  return "ratio";
}

/** Matches {@link formatPercentMetric}: |v| ≤ 1 (nonzero) is a ratio; otherwise percent points. */
function macroPercentUsesPoints(values: number[]): boolean {
  return values.some((v) => Number.isFinite(v) && Math.abs(v) > 1);
}

/**
 * Y-axis for macro bar/line charts.
 * Decimal ratios (≤1) use the 0–100% axis; percent points (e.g. −1.09, 5.02) use a tight numeric scale.
 */
export function buildMacroChartYAxisDomain(
  values: number[],
  kind: MacroValueKind,
): FundamentalsYAxisDomain {
  const rawMin = values.length ? Math.min(...values, 0) : 0;
  const rawMax = values.length ? Math.max(...values) : 1;

  if (kind === "percent") {
    if (macroPercentUsesPoints(values)) {
      return buildTightNumericYAxisDomain(rawMin, rawMax);
    }
    return buildFundamentalsYAxisDomain(rawMin, rawMax, "percent");
  }

  return buildFundamentalsYAxisDomain(rawMin, rawMax, macroKindToChartingKind(kind));
}

export function formatMacroChartAxisTick(value: number, kind: MacroValueKind): string {
  if (!Number.isFinite(value)) return "";
  if (kind === "percent") return formatMacroValue("percent", value);
  return formatFundamentalsAxisTickLabel(macroKindToChartingKind(kind), value);
}
