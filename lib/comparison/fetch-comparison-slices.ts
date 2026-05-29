import type { ComparisonTickerSlice } from "@/lib/comparison/fetch-comparison-ticker-slice";
import { parseChartingTickerList } from "@/lib/market/stock-charting-metrics";

export type { ComparisonTickerSlice } from "@/lib/comparison/fetch-comparison-ticker-slice";

/** True when performance annual series is ready for the return chart. */
export function comparisonSliceIsReady(slice: ComparisonTickerSlice | undefined): boolean {
  return Boolean(slice?.performance?.annualReturns?.length);
}

/**
 * Batch-load comparison slices (1 HTTP request for all tickers).
 * Falls back to per-ticker parallel fetches if the batch route fails.
 */
export async function fetchComparisonTickerSlices(
  tickers: string[],
  signal?: AbortSignal,
): Promise<Record<string, ComparisonTickerSlice>> {
  const keys = parseChartingTickerList(tickers.join(",")).map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (!keys.length) return {};

  const emptySlice = (): ComparisonTickerSlice => ({
    headerMeta: null,
    performance: null,
    keyStatsBundle: null,
  });

  try {
    const q = encodeURIComponent(keys.join(","));
    const res = await fetch(`/api/comparison/slices?tickers=${q}`, {
      credentials: "include",
      signal,
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { slices?: Record<string, ComparisonTickerSlice> };
      const out: Record<string, ComparisonTickerSlice> = {};
      for (const key of keys) {
        const slice = json.slices?.[key];
        out[key] =
          slice && typeof slice === "object"
            ? {
                headerMeta: slice.headerMeta ?? null,
                performance: slice.performance ?? null,
                keyStatsBundle: slice.keyStatsBundle ?? null,
              }
            : emptySlice();
      }
      return out;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
  }

  const { fetchComparisonTickerSlice } = await import("@/lib/comparison/fetch-comparison-ticker-slice");
  const settled = await Promise.allSettled(keys.map((key) => fetchComparisonTickerSlice(key, signal)));
  const out: Record<string, ComparisonTickerSlice> = {};
  keys.forEach((key, i) => {
    const s = settled[i];
    out[key] = s?.status === "fulfilled" ? s.value : emptySlice();
  });
  return out;
}
