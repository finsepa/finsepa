import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";

const TTL_MS = 15 * 60 * 1000;

type Entry = {
  at: number;
  points: ChartingSeriesPoint[];
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<ChartingSeriesPoint[] | null>>();

function cacheKey(ticker: string, period: "annual" | "quarterly"): string {
  return `${ticker.trim().toUpperCase()}|${period}`;
}

/** Dedupe fundamentals-series fetches when switching metrics or remounting charting UI in one tab. */
export async function fetchChartingFundamentalsSeriesCached(
  ticker: string,
  period: "annual" | "quarterly",
): Promise<ChartingSeriesPoint[] | null> {
  const key = cacheKey(ticker, period);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.points;

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = fetch(
    `/api/stocks/${encodeURIComponent(ticker.trim().toUpperCase())}/fundamentals-series?period=${period}`,
    { credentials: "include" },
  )
    .then(async (res) => {
      if (!res.ok) return null;
      const json = (await res.json()) as { points?: ChartingSeriesPoint[] };
      const points = Array.isArray(json.points) ? json.points : [];
      cache.set(key, { at: Date.now(), points });
      return points;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}
