/**
 * Regression audit: stock-style crypto pipeline for the 10-coin merge set.
 * Loader correctness + density only (no browser). 5Y/ALL use direct daily when CLI has no Next cache.
 *
 *   npx tsx --env-file=.env.local scripts/audit-crypto-universe-pipeline.ts
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

const ASSETS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "LINK", "SUI"] as const;
const RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "ALL"] as const;

type Row = {
  asset: string;
  range: string;
  ms: number;
  points: number;
  eodhd: number;
  ok: boolean;
  note: string;
};

async function main() {
  const { runWithProviderTraceCollect } = await import("../lib/market/provider-trace");
  const { resolveCryptoMetaForProvider } = await import("../lib/market/crypto-meta-resolver");
  const { loadStockStyleChartPointsForProviderSymbol } = await import(
    "../lib/market/stock-chart-data"
  );
  const { isCryptoLive1DSymbol } = await import("../lib/market/crypto-live-1d-tickers");
  const { fetchEodhdCryptoDailyBars } = await import("../lib/market/eodhd-crypto");
  const {
    oneSamplePerWeekByKey,
    oneSamplePerMonthByKey,
    stockChartPointsFromDailyBars,
    usSessionWeekKeyFromUnixSeconds,
    usSessionMonthKeyFromUnixSeconds,
  } = await import("../lib/market/stock-chart-data");

  const rows: Row[] = [];
  const regressions: string[] = [];

  for (const asset of ASSETS) {
    const meta = await resolveCryptoMetaForProvider(asset);
    if (!meta?.eodhdSymbol) {
      regressions.push(`${asset}: no crypto meta / eodhdSymbol`);
      continue;
    }
    for (const range of RANGES) {
      try {
        const t0 = performance.now();
        const { result, trace } = await runWithProviderTraceCollect(`${asset}:${range}`, async () => {
          if (range === "5Y" || range === "ALL") {
            const now = new Date();
            const to = now.toISOString().slice(0, 10);
            const fromDate = new Date(now);
            fromDate.setUTCFullYear(fromDate.getUTCFullYear() - (range === "5Y" ? 5 : 20));
            const from = fromDate.toISOString().slice(0, 10);
            const bars = (await fetchEodhdCryptoDailyBars(meta.eodhdSymbol, from, to)) ?? [];
            const pts = stockChartPointsFromDailyBars(bars);
            const down =
              range === "5Y"
                ? oneSamplePerWeekByKey(pts, (p) => usSessionWeekKeyFromUnixSeconds(p.time))
                : oneSamplePerMonthByKey(pts, (p) => usSessionMonthKeyFromUnixSeconds(p.time));
            return { points: down, path: "daily-direct" };
          }
          // Live 1D allowlist uses live path in prod; CLI measures continuous stock-style 1D.
          const points = await loadStockStyleChartPointsForProviderSymbol(meta.eodhdSymbol, range);
          return {
            points,
            path:
              range === "1D" && isCryptoLive1DSymbol(asset)
                ? "stock-1d-proxy (prod=live-1d)"
                : "stock-pipeline",
          };
        });
        const ms = Math.round(performance.now() - t0);
        const n = result.points.length;
        const ok = n >= (range === "ALL" ? 20 : range === "5Y" ? 40 : range === "1D" ? 50 : 30);
        if (!ok) regressions.push(`${asset} ${range}: sparse n=${n}`);
        // Spot-check: no US-session collapse (1Y should be hundreds for majors)
        if (range === "1Y" && n < 200) {
          regressions.push(`${asset} 1Y: suspected RTH collapse n=${n}`);
        }
        rows.push({
          asset,
          range,
          ms,
          points: n,
          eodhd: trace.eodhdHttp,
          ok,
          note: result.path,
        });
        console.log(
          `${asset.padEnd(4)} ${range.padEnd(3)} ${String(ms).padStart(5)}ms n=${String(n).padStart(4)} eodhd=${trace.eodhdHttp} ${ok ? "OK" : "SPARSE"} ${result.path}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 100) : String(e);
        regressions.push(`${asset} ${range}: ${msg}`);
        rows.push({ asset, range, ms: -1, points: -1, eodhd: -1, ok: false, note: msg });
        console.log(`${asset.padEnd(4)} ${range.padEnd(3)} FAIL ${msg}`);
      }
    }
  }

  console.log("\n=== REGRESSIONS ONLY ===");
  if (!regressions.length) console.log("(none)");
  else for (const r of regressions) console.log("-", r);

  console.log("\n===JSON===");
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), rows, regressions }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
