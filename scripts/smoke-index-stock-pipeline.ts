/**
 * Smoke: stock-style index loaders (no live).
 *   npx tsx --env-file=.env.local scripts/smoke-index-stock-pipeline.ts
 */
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const { loadStockStyleChartPointsForProviderSymbol } = await import(
    "../lib/market/stock-chart-data"
  );
  const { indexDisablesUsSessionFilters } = await import("../lib/market/index-page-shared");
  const ranges = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;
  const symbols = ["GSPC.INDX", "N225.INDX", "IWM.US", "VIX.INDX"] as const;

  for (const sym of symbols) {
    const noRth = indexDisablesUsSessionFilters(sym);
    for (const range of ranges) {
      const t0 = performance.now();
      const pts = await loadStockStyleChartPointsForProviderSymbol(sym, range, {
        disableUsSessionFilters: noRth,
      });
      const ms = Math.round(performance.now() - t0);
      const ok = pts.length >= (range === "1D" ? 20 : 30);
      console.log(
        `${sym.padEnd(12)} ${range.padEnd(3)} n=${String(pts.length).padStart(4)} ${String(ms).padStart(5)}ms ${ok ? "OK" : "SPARSE"} ${noRth ? "no-rth" : "us-rth"}`,
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
