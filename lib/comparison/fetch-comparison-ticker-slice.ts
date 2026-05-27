import type { StockKeyStatsBundle } from "@/lib/market/stock-key-stats-bundle-types";
import type { StockDetailHeaderMeta } from "@/lib/market/stock-header-meta";
import type { StockPerformance } from "@/lib/market/stock-performance-types";

export type ComparisonTickerSlice = {
  headerMeta: StockDetailHeaderMeta | null;
  performance: StockPerformance | null;
  keyStatsBundle: StockKeyStatsBundle | null;
};

/** Client fetch for comparison table rows — uses cached API routes (no full stock SSR bundle). */
export async function fetchComparisonTickerSlice(ticker: string, signal?: AbortSignal): Promise<ComparisonTickerSlice> {
  const enc = encodeURIComponent(ticker.trim().toUpperCase());
  const empty: ComparisonTickerSlice = { headerMeta: null, performance: null, keyStatsBundle: null };
  if (!enc) return empty;

  try {
    const [metaRes, perfRes, bundleRes] = await Promise.all([
      fetch(`/api/stocks/${enc}/header-meta`, { credentials: "include", signal }),
      fetch(`/api/stocks/${enc}/performance`, { credentials: "include", signal }),
      fetch(`/api/stocks/${enc}/key-stats-bundle`, { credentials: "include", signal }),
    ]);

    const headerMeta = metaRes.ok ? ((await metaRes.json()) as StockDetailHeaderMeta) : null;
    const performance = perfRes.ok ? ((await perfRes.json()) as StockPerformance) : null;
    const bundleJson = bundleRes.ok ? ((await bundleRes.json()) as { bundle?: StockKeyStatsBundle | null }) : null;

    return {
      headerMeta: headerMeta && typeof headerMeta === "object" ? headerMeta : null,
      performance: performance && typeof performance === "object" ? performance : null,
      keyStatsBundle: bundleJson?.bundle ?? null,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return empty;
  }
}
