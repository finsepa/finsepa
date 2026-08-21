/**
 * Direct EOD (no unstable_cache) for 5Y/ALL density/latency proxy.
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

async function main() {
  const { runWithProviderTraceCollect } = await import("../lib/market/provider-trace");
  const { fetchEodhdCryptoDailyBars } = await import("../lib/market/eodhd-crypto");
  const { fetchEodhdEodDaily } = await import("../lib/market/eodhd-eod");
  const {
    oneSamplePerWeekByKey,
    oneSamplePerMonthByKey,
    stockChartPointsFromDailyBars,
    usSessionWeekKeyFromUnixSeconds,
    usSessionMonthKeyFromUnixSeconds,
  } = await import("../lib/market/stock-chart-data");

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  async function windowYears(y: number) {
    const d = new Date(now);
    d.setUTCFullYear(d.getUTCFullYear() - y);
    return d.toISOString().slice(0, 10);
  }

  const jobs = [
    { asset: "BTC", kind: "crypto" as const, sym: "BTC-USD.CC", years: 5, mode: "5Y" },
    { asset: "BTC", kind: "crypto" as const, sym: "BTC-USD.CC", years: 20, mode: "ALL" },
    { asset: "SOL", kind: "crypto" as const, sym: "SOL-USD.CC", years: 5, mode: "5Y" },
    { asset: "SOL", kind: "crypto" as const, sym: "SOL-USD.CC", years: 20, mode: "ALL" },
    { asset: "AAPL", kind: "equity" as const, sym: "AAPL.US", years: 5, mode: "5Y" },
    { asset: "AAPL", kind: "equity" as const, sym: "AAPL.US", years: 20, mode: "ALL" },
    { asset: "MSFT", kind: "equity" as const, sym: "MSFT.US", years: 5, mode: "5Y" },
    { asset: "MSFT", kind: "equity" as const, sym: "MSFT.US", years: 20, mode: "ALL" },
  ];

  for (const j of jobs) {
    const from = await windowYears(j.years);
    const t0 = performance.now();
    const { result, trace } = await runWithProviderTraceCollect(`${j.asset}:${j.mode}`, async () => {
      const bars =
        j.kind === "crypto"
          ? ((await fetchEodhdCryptoDailyBars(j.sym, from, to)) ?? [])
          : ((await fetchEodhdEodDaily(j.sym, from, to)) ?? []);
      const pts = stockChartPointsFromDailyBars(bars);
      const down =
        j.mode === "5Y"
          ? oneSamplePerWeekByKey(pts, (p) => usSessionWeekKeyFromUnixSeconds(p.time))
          : oneSamplePerMonthByKey(pts, (p) => usSessionMonthKeyFromUnixSeconds(p.time));
      return { raw: bars.length, points: down.length };
    });
    console.log(
      `${j.asset} ${j.mode} ${Math.round(performance.now() - t0)}ms raw=${result.raw} n=${result.points} eodhd=${trace.eodhdHttp}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
