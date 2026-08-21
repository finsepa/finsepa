/**
 * Runtime audit (server path): BTC/SOL stock-pipeline experiment vs AAPL/MSFT stock loaders.
 * Measures loader ms, point count, EODHD HTTP count (provider calls), cold→warm if cache applies.
 *
 *   FINSEPA_PROVIDER_TRACE=1 npx tsx --env-file=.env.local scripts/audit-crypto-stock-pipeline-ranges.ts
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

process.env.FINSEPA_PROVIDER_TRACE = "1";

type Range = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "ALL";

const RANGES: Range[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "ALL"];

type Row = {
  asset: string;
  range: Range;
  ms: number;
  points: number;
  eodhdHttp: number;
  byFn: Record<string, number>;
  path: string;
};

async function main() {
  const { runWithProviderTraceCollect } = await import("../lib/market/provider-trace");
  const { loadStockStyleChartPointsForProviderSymbol } = await import(
    "../lib/market/stock-chart-data"
  );

  const assets: Array<{
    asset: string;
    provider: string;
    kind: "btc" | "sol" | "stock";
  }> = [
    { asset: "BTC", provider: "BTC-USD.CC", kind: "btc" },
    { asset: "SOL", provider: "SOL-USD.CC", kind: "sol" },
    { asset: "AAPL", provider: "AAPL.US", kind: "stock" },
    { asset: "MSFT", provider: "MSFT.US", kind: "stock" },
  ];

  const rows: Row[] = [];

  for (const a of assets) {
    for (const range of RANGES) {
      const label = `${a.asset}:${range}`;
      try {
        const t0 = performance.now();
        const { result, trace } = await runWithProviderTraceCollect(label, async () => {
          if (a.kind === "btc" && range === "1D") {
            // Production uses live WS+REST 1D; CLI has no Next Data Cache for that unstable_cache.
            // Measure stock-pipeline continuous 24h as the experiment mid-range sibling path.
            return {
              points: await loadStockStyleChartPointsForProviderSymbol(a.provider, range),
              path: "stock-pipeline-1d-continuous (prod BTC uses live-1d)",
            };
          }
          return {
            points: await loadStockStyleChartPointsForProviderSymbol(a.provider, range),
            path: a.kind === "stock" ? "stock-loader" : "stock-pipeline-crypto",
          };
        });
        const ms = Math.round(performance.now() - t0);
        rows.push({
          asset: a.asset,
          range,
          ms,
          points: result.points.length,
          eodhdHttp: trace.eodhdHttp,
          byFn: trace.byFn,
          path: result.path,
        });
        console.log(
          `${a.asset.padEnd(4)} ${range.padEnd(3)} ${String(ms).padStart(5)}ms  n=${String(result.points.length).padStart(4)}  eodhd=${trace.eodhdHttp}  ${result.path}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const clipped = msg.includes("incrementalCache")
          ? "CLI_NO_NEXT_CACHE (5Y/ALL daily via unstable_cache)"
          : msg.slice(0, 120);
        rows.push({
          asset: a.asset,
          range,
          ms: -1,
          points: -1,
          eodhdHttp: -1,
          byFn: {},
          path: clipped,
        });
        console.log(`${a.asset.padEnd(4)} ${range.padEnd(3)} SKIP  ${clipped}`);
      }
    }
  }

  // Second pass (warm): repeat 1Y only to see unstable_cache / HTTP reuse outside Next Data Cache
  console.log("\n--- warm re-run (1Y only; Next unstable_cache may miss in CLI) ---");
  for (const a of assets) {
    const range: Range = "1Y";
    const t0 = performance.now();
    const { result, trace } = await runWithProviderTraceCollect(`${a.asset}:1Y:warm`, async () => {
      return {
        points: await loadStockStyleChartPointsForProviderSymbol(a.provider, range),
        path: "warm",
      };
    });
    console.log(
      `${a.asset} 1Y warm ${Math.round(performance.now() - t0)}ms n=${result.points.length} eodhd=${trace.eodhdHttp}`,
    );
  }

  console.log("\n===JSON===");
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
