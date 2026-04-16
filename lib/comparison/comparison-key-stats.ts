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
