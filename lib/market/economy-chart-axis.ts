import {
  buildFundamentalsYAxisDomain,
  buildFixedFundamentalsYAxisTicks,
} from "@/lib/chart/fundamentals-chart-surface";
import { formatPercentMetric } from "@/lib/market/key-stats-basic-format";

export type EconomyChartYAxis = {
  min: number;
  max: number;
  ticks: number[];
  bipolar: boolean;
};

/** NFIB-style indices (~50–125) use a fixed 0–125 axis with whole-number ticks. */
const INDEX_AXIS_MAX = 125;
const INDEX_AXIS_TICKS: readonly number[] = [125, 100, 75, 50, 0];

/**
 * Y-axis for economy event history bar charts.
 * Decimal fractions (≤1) stay on a percent axis; high-level indices use 0–125.
 */
export function buildEconomyHistoryYAxisDomain(values: number[]): EconomyChartYAxis {
  if (!values.length) {
    return { min: 0, max: INDEX_AXIS_MAX, ticks: [...INDEX_AXIS_TICKS], bipolar: false };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  if (rawMin < 0) {
    const domain = buildFundamentalsYAxisDomain(rawMin, rawMax, "ratio");
    return {
      min: domain.min,
      max: domain.max,
      ticks: domain.ticks,
      bipolar: domain.bipolar,
    };
  }

  if (rawMax <= 1) {
    const domain = buildFundamentalsYAxisDomain(rawMin, rawMax, "percent");
    return {
      min: domain.min,
      max: domain.max,
      ticks: domain.ticks,
      bipolar: false,
    };
  }

  if (rawMax > 50 && rawMax <= INDEX_AXIS_MAX + 5) {
    return { min: 0, max: INDEX_AXIS_MAX, ticks: [...INDEX_AXIS_TICKS], bipolar: false };
  }

  const domain = buildFundamentalsYAxisDomain(0, rawMax, "ratio");
  return {
    min: 0,
    max: domain.max,
    ticks: domain.ticks.length ? domain.ticks : buildFixedFundamentalsYAxisTicks(domain.max),
    bipolar: false,
  };
}

export function formatEconomyChartAxisTick(tick: number, yMax: number): string {
  if (!Number.isFinite(tick)) return "";
  if (yMax <= 1) return formatPercentMetric(tick);
  if (Number.isInteger(tick)) return String(tick);
  return tick.toLocaleString("en-US", { maximumFractionDigits: 1 });
}
