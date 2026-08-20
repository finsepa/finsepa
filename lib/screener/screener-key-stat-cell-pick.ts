import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import type { ScreenerKeyStatSection } from "@/lib/screener/screener-key-stats-metric-catalog";

/** Picks a formatted key-stat cell from a pre-built bundle row set. */
export function pickKeyStatCellFromBundle(
  bundle: StockKeyStatsBundle,
  section: ScreenerKeyStatSection,
  label: string,
): string {
  const v = bundle[section]?.find((r) => r.label === label)?.value;
  if (v == null || !String(v).trim()) return "—";
  return v;
}
