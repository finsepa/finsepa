import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";

const BUNDLE_KEYS: (keyof StockKeyStatsBundle)[] = [
  "basic",
  "valuation",
  "revenueProfit",
  "margins",
  "growth",
  "assetsLiabilities",
  "returns",
  "dividends",
  "risk",
];

/** First matching row value across sections; prefers non-placeholder values. */
export function findKeyStatValue(bundle: StockKeyStatsBundle | null | undefined, labels: string[]): string {
  if (!bundle) return "—";
  for (const label of labels) {
    for (const section of BUNDLE_KEYS) {
      const rows = bundle[section];
      if (!rows) continue;
      const row = rows.find((r) => r.label.trim() === label);
      const v = row?.value?.trim();
      if (v && v !== "—") return v;
    }
  }
  for (const label of labels) {
    for (const section of BUNDLE_KEYS) {
      const rows = bundle[section];
      if (!rows) continue;
      const row = rows.find((r) => r.label.trim() === label);
      const v = row?.value?.trim();
      if (v) return v;
    }
  }
  return "—";
}

const COMPARISON_GROWTH_METRIC_IDS = new Set([
  "rev-growth",
  "eps-growth",
  "gr-q-rev-yoy",
  "gr-rev-3y",
  "gr-q-eps-yoy",
  "gr-eps-3y",
]);

export function isComparisonGrowthMetricId(metricId: string): boolean {
  return COMPARISON_GROWTH_METRIC_IDS.has(metricId);
}

/** Parses display strings like `+21.69%`, `-1.00%`, `16.60%`. */
export function parseComparisonPercentCell(cell: string): number | null {
  const t = cell.trim();
  if (!t || t === "—" || t === "-") return null;
  const m = t.match(/^([+-])?([\d,.]+)\s*%$/);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const n = Number(m[2]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return sign * n;
}

export function comparisonGrowthCellTone(cell: string): "positive" | "negative" | "neutral" | "missing" {
  const v = parseComparisonPercentCell(cell);
  if (v == null) return "missing";
  if (v > 0) return "positive";
  if (v < 0) return "negative";
  return "neutral";
}

export function comparisonGrowthCellClassName(
  metricId: string,
  cell: string,
  baseClass = "min-w-0 w-full text-right font-['Inter'] text-[14px] leading-5 tabular-nums",
): string {
  if (!isComparisonGrowthMetricId(metricId)) {
    return `${baseClass} font-normal text-[#0F0F0F]`;
  }
  const tone = comparisonGrowthCellTone(cell);
  if (tone === "positive") return `${baseClass} font-medium text-[#16A34A]`;
  if (tone === "negative") return `${baseClass} font-medium text-[#DC2626]`;
  if (tone === "missing") return `${baseClass} font-normal text-[#71717A]`;
  return `${baseClass} font-normal text-[#0F0F0F]`;
}
