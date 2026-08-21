/**
 * Evidence-only: mirror crypto-chart-data early-exit + time each EODHD call.
 */
import { performance } from "node:perf_hooks";
import { fetchEodhdIntraday } from "../lib/market/eodhd-intraday";
import { fetchEodhdCryptoDailyBars } from "../lib/market/eodhd-crypto";

function ms(n: number) {
  return Math.round(n);
}

type Step = {
  step: string;
  durationMs: number;
  barCount: number;
  returned: boolean;
  startedAtOffsetMs: number;
};

async function probeRange(pair: string, range: "5D" | "1M" | "6M" | "1Y") {
  const nowSec = Math.floor(Date.now() / 1000);
  const steps: Step[] = [];
  const t0 = performance.now();

  async function call(
    step: string,
    lookbackSec: number,
    interval: "5m" | "1m" | "1h",
    accept: (barCount: number) => boolean,
  ) {
    const a = performance.now();
    const bars = await fetchEodhdIntraday(pair, nowSec - lookbackSec, nowSec, interval);
    const barCount = bars?.length ?? 0;
    const returned = accept(barCount);
    steps.push({
      step,
      durationMs: ms(performance.now() - a),
      barCount,
      returned,
      startedAtOffsetMs: ms(a - t0),
    });
    return returned;
  }

  if (range === "5D") {
    // production returns after first strategy with points after downsample;
    // barCount>0 is a lower bound for "would continue processing"
    const strategies: { lookbackSec: number; interval: "5m" | "1m"; name: string }[] = [
      { lookbackSec: 14 * 86400, interval: "5m", name: "5D-5m-14d" },
      { lookbackSec: 10 * 86400, interval: "5m", name: "5D-5m-10d" },
      { lookbackSec: 9 * 86400, interval: "1m", name: "5D-1m-9d" },
    ];
    for (const s of strategies) {
      if (await call(s.name, s.lookbackSec, s.interval, (n) => n > 0)) {
        return { totalMs: ms(performance.now() - t0), steps, execution: "sequential-early-exit" };
      }
    }
    await call("5D-1h-fallback", 10 * 86400, "1h", (n) => n > 0);
    return { totalMs: ms(performance.now() - t0), steps, execution: "sequential-fallback" };
  }

  if (range === "1M") {
    // production: pts.length >= 36 then downsample; barCount>=36 is a safe lower bound
    const strategies: { lookbackSec: number; interval: "5m" | "1m" | "1h"; name: string }[] = [
      { lookbackSec: 42 * 86400, interval: "5m", name: "1M-5m-42d" },
      { lookbackSec: 55 * 86400, interval: "5m", name: "1M-5m-55d" },
      { lookbackSec: 34 * 86400, interval: "1m", name: "1M-1m-34d" },
      { lookbackSec: 42 * 86400, interval: "1h", name: "1M-1h-42d" },
      { lookbackSec: 55 * 86400, interval: "1h", name: "1M-1h-55d" },
    ];
    for (const s of strategies) {
      if (await call(s.name, s.lookbackSec, s.interval, (n) => n >= 36)) {
        return { totalMs: ms(performance.now() - t0), steps, execution: "sequential-early-exit" };
      }
    }
    return { totalMs: ms(performance.now() - t0), steps, execution: "sequential-exhausted" };
  }

  if (range === "6M") {
    const strategies: { lookbackSec: number; interval: "1h" | "5m"; name: string }[] = [
      { lookbackSec: 235 * 86400, interval: "1h", name: "6M-1h-235d" },
      { lookbackSec: 220 * 86400, interval: "5m", name: "6M-5m-220d" },
      { lookbackSec: 200 * 86400, interval: "5m", name: "6M-5m-200d" },
    ];
    for (const s of strategies) {
      if (await call(s.name, s.lookbackSec, s.interval, (n) => n >= 120)) {
        return { totalMs: ms(performance.now() - t0), steps, execution: "sequential-early-exit" };
      }
    }
    return { totalMs: ms(performance.now() - t0), steps, execution: "sequential-exhausted" };
  }

  const a = performance.now();
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 6);
  const from = fromDate.toISOString().slice(0, 10);
  const bars = await fetchEodhdCryptoDailyBars(pair, from, to);
  steps.push({
    step: "1Y-daily-6y",
    durationMs: ms(performance.now() - a),
    barCount: bars?.length ?? 0,
    returned: true,
    startedAtOffsetMs: ms(a - t0),
  });
  return { totalMs: ms(performance.now() - t0), steps, execution: "daily" };
}

async function main() {
  const out: Record<string, unknown> = {};
  for (const [sym, pair] of [
    ["BTC", "BTC-USD.CC"],
    ["SOL", "SOL-USD.CC"],
  ] as const) {
    for (const range of ["5D", "1M", "6M", "1Y"] as const) {
      out[`${sym}_${range}`] = await probeRange(pair, range);
    }
  }

  // Parallel control: BTC 1M first strategy only vs all sequential full (already have)
  const nowSec = Math.floor(Date.now() / 1000);
  const strategies = [
    { lookbackSec: 42 * 86400, interval: "5m" as const },
    { lookbackSec: 55 * 86400, interval: "5m" as const },
    { lookbackSec: 34 * 86400, interval: "1m" as const },
  ];
  const seqT0 = performance.now();
  for (const s of strategies) {
    await fetchEodhdIntraday("BTC-USD.CC", nowSec - s.lookbackSec, nowSec, s.interval);
  }
  const seqMs = ms(performance.now() - seqT0);
  const parT0 = performance.now();
  await Promise.all(
    strategies.map((s) =>
      fetchEodhdIntraday("BTC-USD.CC", nowSec - s.lookbackSec, nowSec, s.interval),
    ),
  );
  const parMs = ms(performance.now() - parT0);

  console.log(
    JSON.stringify(
      {
        note: "Early-exit mirrors production for-loop; startedAtOffsetMs proves sequential starts",
        out,
        sequentialityControl_3calls: {
          sequentialTotalMs: seqMs,
          parallelTotalMs: parMs,
          sequentialIsSlowerByMs: seqMs - parMs,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
