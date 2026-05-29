import type { ChartingSeriesPoint, FundamentalsSeriesMode } from "@/lib/market/charting-series-types";
import { formatChartingPeriodAxisLabel } from "@/lib/market/charting-period-display";
import {
  formatPercentMetric,
  formatRatio,
  formatUsdCompact,
  formatUsdPrice,
  roundToUsdCompactPrecision,
} from "@/lib/market/key-stats-basic-format";
import {
  CHARTING_METRIC_FIELD,
  CHARTING_METRIC_KIND,
  type ChartingMetricId,
} from "@/lib/market/stock-charting-metrics";
import {
  isFinancialsExtraChartingMetricId,
  readFinancialsExtraChartingMetricValue,
} from "@/lib/market/stock-charting-metrics-financials-ext";

export type MultichartPeriodComparison = {
  display: string;
  /** Signed change used for trend color (USD/EPS/pp/multiple points, or relative % for ratios). */
  delta: number;
};

function readMetricValue(row: ChartingSeriesPoint, metricId: ChartingMetricId): number | null {
  if (isFinancialsExtraChartingMetricId(metricId)) {
    return readFinancialsExtraChartingMetricValue(row, metricId);
  }
  const k = CHARTING_METRIC_FIELD[metricId];
  const v = row[k];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Match {@link formatPercentMetric} — provider may send 0.556 or 55.6 for 55.6%. */
export function toPercentPoints(n: number): number {
  return Math.abs(n) <= 1 && n !== 0 ? n * 100 : n;
}

function roundPercentPoints(n: number): number {
  const p = toPercentPoints(n);
  return Math.round(p * 100) / 100;
}

function roundEps(n: number): number {
  return Math.round(n * 100) / 100;
}

function signedUsdCompact(delta: number): string {
  const body = formatUsdCompact(delta);
  if (delta > 0 && body.startsWith("$")) return `+${body}`;
  return body;
}

function formatSignedEpsDelta(delta: number): string {
  if (!Number.isFinite(delta)) return "—";
  const sign = delta >= 0 ? "+" : "-";
  const body = Math.abs(delta).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${body}`;
}

function formatSignedPercentPointDelta(deltaPoints: number): string {
  if (!Number.isFinite(deltaPoints)) return "—";
  const sign = deltaPoints >= 0 ? "+" : "-";
  const body = Math.abs(deltaPoints).toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
  return `${sign}${body}%`;
}

function formatSignedRatioPointDelta(delta: number): string {
  if (!Number.isFinite(delta)) return "—";
  const sign = delta >= 0 ? "+" : "-";
  const body = Math.abs(delta).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${body}`;
}

/**
 * Period-over-period change for Multichart card subtitles vs the prior chart column.
 * Values are rounded to the same precision as headline/tooltip formatting before differencing.
 */
export function multichartComparisonFromLastTwo(
  rows: ChartingSeriesPoint[],
  metricId: ChartingMetricId,
): MultichartPeriodComparison | null {
  if (rows.length < 2) return null;
  const currentRaw = readMetricValue(rows[rows.length - 1]!, metricId);
  const priorRaw = readMetricValue(rows[rows.length - 2]!, metricId);
  if (currentRaw == null || priorRaw == null) return null;

  const kind = CHARTING_METRIC_KIND[metricId];

  if (kind === "usd") {
    const current = roundToUsdCompactPrecision(currentRaw);
    const prior = roundToUsdCompactPrecision(priorRaw);
    const delta = current - prior;
    return { display: signedUsdCompact(delta), delta };
  }

  if (kind === "eps") {
    const current = roundEps(currentRaw);
    const prior = roundEps(priorRaw);
    const delta = current - prior;
    return { display: formatSignedEpsDelta(delta), delta };
  }

  if (kind === "percent") {
    const current = roundPercentPoints(currentRaw);
    const prior = roundPercentPoints(priorRaw);
    const delta = current - prior;
    return { display: formatSignedPercentPointDelta(delta), delta };
  }

  if (kind === "multiple" || kind === "ratio") {
    const current = Math.round(currentRaw * 100) / 100;
    const prior = Math.round(priorRaw * 100) / 100;
    const delta = current - prior;
    return { display: formatSignedRatioPointDelta(delta), delta };
  }

  if (priorRaw === 0) return null;
  const pct = ((currentRaw / priorRaw) - 1) * 100;
  return {
    display: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
    delta: pct,
  };
}

/** Axis-aligned label for “vs …” copy (e.g. `2025`, `Q3 '25`). */
export function multichartPriorPeriodComparisonLabel(
  priorPeriodEnd: string,
  mode: FundamentalsSeriesMode,
): string {
  return formatChartingPeriodAxisLabel(priorPeriodEnd, mode);
}

export function formatMultichartHeadlineValue(metricId: ChartingMetricId, v: number): string {
  const kind = CHARTING_METRIC_KIND[metricId];
  switch (kind) {
    case "usd":
      return formatUsdCompact(v);
    case "eps":
      return formatUsdPrice(v);
    case "percent":
      return formatPercentMetric(v);
    case "multiple":
    case "ratio":
      return formatRatio(v);
    default:
      return formatUsdCompact(v);
  }
}
