import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import {
  isCryptoLive1DSymbol,
  normalizeCryptoBaseSymbol,
} from "@/lib/market/crypto-live-1d-tickers";
import { resolveCryptoMetaForProvider } from "@/lib/market/crypto-meta-resolver";
import { eodhdSymbolsForMeta } from "@/lib/market/crypto-meta";
import { fetchCryptoMinuteBarsFromDb } from "@/lib/market/crypto-session-minute-bar-store";
import { fetchEodhdIntraday } from "@/lib/market/eodhd-intraday";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";

const MINUTE_SEC = 60;
const DAY_SEC = 24 * 60 * 60;
/**
 * Chart output bucket size. The base/merge is at 1m; the 1D series is downsampled to 2m buckets
 * to keep the payload/rendering lighter (~720 pts vs ~1440) while still feeling live.
 */
const OUTPUT_BUCKET_SEC = 2 * MINUTE_SEC;

function minuteBucket(sec: number): number {
  return Math.floor(sec / MINUTE_SEC) * MINUTE_SEC;
}

/** Intraday closes for one crypto symbol at a given interval, at minute-bucket resolution. */
async function fetchCryptoRestIntraday(
  symbol: string,
  fromSec: number,
  toSec: number,
  interval: "1m" | "5m",
): Promise<StockChartPoint[]> {
  const meta = await resolveCryptoMetaForProvider(symbol);
  if (!meta) return [];

  for (const pair of eodhdSymbolsForMeta(meta)) {
    const bars = await fetchEodhdIntraday(pair, fromSec, toSec, interval);
    if (!bars?.length) continue;
    const points: StockChartPoint[] = [];
    for (const b of bars) {
      const time = minuteBucket(Number(b.timestamp));
      const value = Number(b.close);
      if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) continue;
      points.push({ time, value, timeZone: "UTC" });
    }
    if (points.length) return points;
  }
  return [];
}

/** First series wins the base buckets; the second overwrites on overlapping minute buckets. */
function mergeByBucket(
  base: readonly StockChartPoint[],
  overlay: readonly StockChartPoint[],
): StockChartPoint[] {
  const map = new Map<number, StockChartPoint>();
  for (const p of base) map.set(p.time, p);
  for (const p of overlay) map.set(p.time, p);
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

/**
 * Rolling-24h REST base for the live 1D crypto chart.
 *
 * EODHD intraday lags real time (1m stops ~10h back, 5m ~6h back), so we blend both: 5m for reach
 * and freshness of the tail, 1m for density earlier in the window. Cached because it changes slowly
 * and the chart route is uncached + polled ~60s — this keeps EODHD credit use low while the live
 * WS bars (read fresh, uncached) provide up-to-the-minute freshness on top.
 */
const getCryptoLive1DRestBaseCached = unstable_cache(
  async (baseSymbol: string): Promise<StockChartPoint[]> => {
    const nowSec = Math.floor(Date.now() / 1000);
    const fromSec = minuteBucket(nowSec - DAY_SEC);
    const [fiveMin, oneMin] = await Promise.all([
      fetchCryptoRestIntraday(baseSymbol, fromSec, nowSec, "5m"),
      fetchCryptoRestIntraday(baseSymbol, fromSec, nowSec, "1m"),
    ]);
    // 5m reaches the freshest REST bar; 1m adds density (wins on its minute buckets).
    return mergeByBucket(fiveMin, oneMin);
  },
  ["crypto-live-1d-rest-base-v1"],
  { revalidate: REVALIDATE_WARM },
);

type BucketedSeries = {
  points: StockChartPoint[];
  realCount: number;
  syntheticCount: number;
  lastRealBar: number | null;
  lastSyntheticBar: number | null;
};

/**
 * Downsample 1m bars to `bucketSec` buckets (latest close per bucket) and emit ONLY real bars —
 * no forward-fill of missing interior/trailing buckets. The series may be extended by at most one
 * synthetic point that duplicates the latest close into the current bucket, and only when the last
 * real bar is exactly the immediately preceding bucket. If data is stale for more than one bucket,
 * the series stops at the last real bar (no flat synthetic tail).
 */
function buildBucketedSeries(
  bars: readonly StockChartPoint[],
  nowSec: number,
  bucketSec: number,
): BucketedSeries {
  const empty: BucketedSeries = {
    points: [],
    realCount: 0,
    syntheticCount: 0,
    lastRealBar: null,
    lastSyntheticBar: null,
  };
  if (!bars.length) return empty;

  // Latest (most recent by source time) close within each output bucket.
  const latestByBucket = new Map<number, number>();
  const latestSrcTime = new Map<number, number>();
  for (const p of bars) {
    const bucket = Math.floor(p.time / bucketSec) * bucketSec;
    const prevSrc = latestSrcTime.get(bucket);
    if (prevSrc == null || p.time >= prevSrc) {
      latestSrcTime.set(bucket, p.time);
      latestByBucket.set(bucket, p.value);
    }
  }

  const buckets = Array.from(latestByBucket.keys()).sort((a, b) => a - b);
  const points: StockChartPoint[] = buckets.map((t) => ({
    time: t,
    value: latestByBucket.get(t)!,
    timeZone: "UTC",
  }));

  const realCount = points.length;
  const lastRealBar = points[realCount - 1]!.time;

  let syntheticCount = 0;
  let lastSyntheticBar: number | null = null;

  // Extend the latest known price to the current bucket — at most one point, only if not stale.
  const currentBucket = Math.floor(nowSec / bucketSec) * bucketSec;
  if (currentBucket === lastRealBar + bucketSec) {
    points.push({ time: currentBucket, value: points[realCount - 1]!.value, timeZone: "UTC" });
    syntheticCount = 1;
    lastSyntheticBar = currentBucket;
  }

  return { points, realCount, syntheticCount, lastRealBar, lastSyntheticBar };
}

function maxGapSeconds(points: readonly StockChartPoint[]): number {
  let max = 0;
  for (let i = 1; i < points.length; i += 1) {
    const gap = points[i]!.time - points[i - 1]!.time;
    if (gap > max) max = gap;
  }
  return max;
}

/**
 * Rolling last-24h 1D series for a live crypto ticker (BTC only, for now).
 *
 * Base = EODHD REST intraday (5m + 1m blend, cached) so the series is continuous across worker
 * downtime; live WS minute bars from Supabase are merged on top and win on overlapping buckets.
 * Output is downsampled to 2m buckets with no full forward-fill (see {@link buildBucketedSeries}).
 * Uncached at the route level (`Cache-Control: no-store`); the client polls ~60s.
 */
export async function loadCryptoLive1DMinuteChartPoints(
  symbol: string,
  now: Date = new Date(),
): Promise<StockChartPoint[]> {
  if (!isCryptoLive1DSymbol(symbol)) return [];

  const nowSec = Math.floor(now.getTime() / 1000);
  const fromSec = minuteBucket(nowSec - DAY_SEC);
  const base = normalizeCryptoBaseSymbol(symbol) || symbol;

  const [restBase, wsBars] = await Promise.all([
    getCryptoLive1DRestBaseCached(base),
    fetchCryptoMinuteBarsFromDb(symbol, fromSec),
  ]);

  // REST base first, live WS bars overwrite overlapping minute buckets (WS is freshest).
  const merged = mergeByBucket(restBase, wsBars).filter((p) => p.time >= fromSec);

  const series = buildBucketedSeries(merged, nowSec, OUTPUT_BUCKET_SEC);
  const { points, realCount, syntheticCount, lastRealBar, lastSyntheticBar } = series;

  if (process.env.NODE_ENV === "development") {
    const first = points[0];
    const last = points.at(-1);
    const iso = (sec: number | null) => (sec != null ? new Date(sec * 1000).toISOString() : null);
    console.info("[crypto-1d-ws]", base, {
      restBarCount: restBase.length,
      wsBarCount: wsBars.length,
      mergedPointCount: merged.length,
      outputBucketSec: OUTPUT_BUCKET_SEC,
      pointCount: points.length,
      realCount,
      syntheticCount,
      maxGapSeconds: maxGapSeconds(points),
      lastRealBar: iso(lastRealBar),
      lastSyntheticBar: iso(lastSyntheticBar),
      firstPointTime: iso(first?.time ?? null),
      lastPointTime: iso(last?.time ?? null),
    });
  }

  return points;
}
