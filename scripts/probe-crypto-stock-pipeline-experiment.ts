/**
 * TEMP experiment probe: same stock range loader for crypto pairs vs equities.
 * Compares BTC↔AAPL and SOL↔MSFT for 1M / YTD / 1Y (load ms + point count).
 *
 *   npx tsx --env-file=.env.local scripts/probe-crypto-stock-pipeline-experiment.ts
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

async function loadStockStyle() {
  const mod = await import("../lib/market/stock-chart-data");
  return mod.loadStockStyleChartPointsForProviderSymbol;
}

type Range = "1M" | "YTD" | "1Y";

async function timeLoad(
  load: Awaited<ReturnType<typeof loadStockStyle>>,
  symbol: string,
  range: Range,
) {
  const t0 = performance.now();
  const points = await load(symbol, range);
  const ms = Math.round(performance.now() - t0);
  return { symbol, range, ms, points: points.length };
}

async function main() {
  const load = await loadStockStyle();
  const pairs: Array<{ crypto: string; stock: string; label: string }> = [
    { crypto: "BTC-USD.CC", stock: "AAPL.US", label: "BTC vs AAPL" },
    { crypto: "SOL-USD.CC", stock: "MSFT.US", label: "SOL vs MSFT" },
  ];
  const ranges: Range[] = ["1M", "YTD", "1Y"];

  console.log("=== crypto-stock-pipeline experiment (identical stock strategies) ===\n");

  for (const { crypto, stock, label } of pairs) {
    console.log(`--- ${label} ---`);
    for (const range of ranges) {
      const c = await timeLoad(load, crypto, range);
      const s = await timeLoad(load, stock, range);
      const slower = c.ms > s.ms ? "crypto" : c.ms < s.ms ? "stock" : "tie";
      console.log(
        `${range.padEnd(3)}  crypto ${c.symbol.padEnd(12)} ${String(c.ms).padStart(5)}ms  n=${String(c.points).padStart(4)}` +
          `  |  stock ${s.symbol.padEnd(8)} ${String(s.ms).padStart(5)}ms  n=${String(s.points).padStart(4)}` +
          `  | slower=${slower} Δ=${c.ms - s.ms}ms`,
      );
    }
    console.log("");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
