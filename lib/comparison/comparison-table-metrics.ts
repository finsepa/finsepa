import { chartingTickersToParam } from "@/lib/market/stock-charting-metrics";
import { SCREENER_KEY_STAT_CATEGORIES } from "@/lib/screener/screener-key-stats-metric-catalog";

export type ComparisonTableMetricId = string;

export type ComparisonTableMetricDef = {
  id: ComparisonTableMetricId;
  header: string;
  labels: string[];
  pickerLabel: string;
};

const COMPARISON_HEADER_OVERRIDES: Partial<Record<string, string>> = {
  "rp-operating-income": "Oper Income",
  "mg-operating": "Oper Margin",
  "rp-gross-profit": "Gross Profit",
  "rp-net-income": "Net Income",
  "rp-revenue": "Revenue",
  "gr-q-rev-yoy": "Rev Growth (YoY)",
  "gr-rev-3y": "Rev Growth (3Y)",
  "gr-q-eps-yoy": "EPS Growth (YoY)",
  "gr-eps-3y": "EPS Growth (3Y)",
};

const COMPOSITE_METRICS: ComparisonTableMetricDef[] = [
  {
    id: "rev-growth",
    header: "Rev Growth",
    labels: ["Quarterly Revenue (YoY)", "Revenue (3Y)"],
    pickerLabel: "Revenue Growth",
  },
  {
    id: "eps-growth",
    header: "EPS Growth",
    labels: ["Quarterly EPS (YoY)", "EPS (3Y)"],
    pickerLabel: "EPS Growth",
  },
];

function screenerToComparisonDef(metric: {
  id: string;
  label: string;
}): ComparisonTableMetricDef {
  return {
    id: metric.id,
    header: COMPARISON_HEADER_OVERRIDES[metric.id] ?? metric.label,
    labels: [metric.label],
    pickerLabel: metric.label,
  };
}

export const COMPARISON_TABLE_METRICS_BY_ID: Record<ComparisonTableMetricId, ComparisonTableMetricDef> =
  {};

for (const category of SCREENER_KEY_STAT_CATEGORIES) {
  for (const metric of category.metrics) {
    COMPARISON_TABLE_METRICS_BY_ID[metric.id] = screenerToComparisonDef(metric);
  }
}

for (const metric of COMPOSITE_METRICS) {
  COMPARISON_TABLE_METRICS_BY_ID[metric.id] = metric;
}

/** Default fundamentals table columns (matches original Comparison table). */
export const COMPARISON_DEFAULT_TABLE_METRIC_IDS: ComparisonTableMetricId[] = [
  "rev-growth",
  "rp-gross-profit",
  "rp-operating-income",
  "rp-net-income",
  "rp-eps",
  "eps-growth",
  "rp-revenue",
];

export type ComparisonMetricPickerGroup = {
  id: string;
  label: string;
  metricIds: ComparisonTableMetricId[];
};

export const COMPARISON_METRIC_PICKER_GROUPS: ComparisonMetricPickerGroup[] =
  SCREENER_KEY_STAT_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.title,
    metricIds: [
      ...(category.id === "growth" ? (["rev-growth", "eps-growth"] as const) : []),
      ...category.metrics.map((m) => m.id),
    ],
  }));

export function getComparisonTableMetric(
  id: ComparisonTableMetricId,
): ComparisonTableMetricDef | undefined {
  return COMPARISON_TABLE_METRICS_BY_ID[id];
}

export function resolveComparisonTableMetrics(
  ids: ComparisonTableMetricId[],
): ComparisonTableMetricDef[] {
  const out: ComparisonTableMetricDef[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const def = COMPARISON_TABLE_METRICS_BY_ID[id];
    if (!def) continue;
    seen.add(id);
    out.push(def);
  }
  return out;
}

export function parseComparisonTableMetricsParam(
  raw: string | null | undefined,
): ComparisonTableMetricId[] {
  if (!raw?.trim()) return [];
  const out: ComparisonTableMetricId[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id) || !COMPARISON_TABLE_METRICS_BY_ID[id]) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function comparisonTableMetricsToParam(ids: ComparisonTableMetricId[]): string {
  return ids.join(",");
}

export function normalizeComparisonTableMetricIds(
  ids: ComparisonTableMetricId[],
): ComparisonTableMetricId[] {
  const resolved = resolveComparisonTableMetrics(ids).map((m) => m.id);
  return resolved.length > 0 ? resolved : [...COMPARISON_DEFAULT_TABLE_METRIC_IDS];
}

export function buildComparisonPagePath(
  tickers: string[],
  columnIds: ComparisonTableMetricId[],
): string {
  const tq = chartingTickersToParam(tickers);
  const cq = comparisonTableMetricsToParam(normalizeComparisonTableMetricIds(columnIds));
  const isDefault =
    cq === comparisonTableMetricsToParam(COMPARISON_DEFAULT_TABLE_METRIC_IDS);
  if (!tq && (isDefault || !cq)) return "/comparison";
  const p = new URLSearchParams();
  if (tq) p.set("ticker", tq);
  if (cq && !isDefault) p.set("col", cq);
  return `/comparison?${p.toString()}`;
}
