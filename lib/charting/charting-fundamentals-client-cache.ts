import type { ChartingSeriesPoint } from "@/lib/market/charting-series-types";
import { parseChartingTtmPoint } from "@/lib/market/charting-period-display";

const TTL_MS = 15 * 60 * 1000;

export type ChartingFundamentalsSeriesPayload = {
  points: ChartingSeriesPoint[];
  ttmPoint: ChartingSeriesPoint | null;
};

type Entry = {
  at: number;
  points: ChartingSeriesPoint[];
  ttmPoint: ChartingSeriesPoint | null;
};

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<ChartingFundamentalsSeriesPayload | null>>();

function cacheKey(ticker: string, period: "annual" | "quarterly"): string {
  return `${ticker.trim().toUpperCase()}|${period}`;
}

/** Hydrate in-tab cache from SSR / stock page initial data (same series as Revenue modal). */
export function seedChartingFundamentalsSeriesCache(
  ticker: string,
  period: "annual" | "quarterly",
  points: ChartingSeriesPoint[],
  ttmPoint: ChartingSeriesPoint | null = null,
): void {
  if (!points.length) return;
  cache.set(cacheKey(ticker, period), { at: Date.now(), points, ttmPoint });
}

export function readChartingFundamentalsSeriesCache(
  ticker: string,
  period: "annual" | "quarterly",
): ChartingFundamentalsSeriesPayload | null {
  const key = cacheKey(ticker, period);
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at >= TTL_MS) return null;
  return { points: hit.points, ttmPoint: hit.ttmPoint };
}

async function fetchChartingFundamentalsSeriesPayload(
  ticker: string,
  period: "annual" | "quarterly",
): Promise<ChartingFundamentalsSeriesPayload | null> {
  const res = await fetch(
    `/api/stocks/${encodeURIComponent(ticker.trim().toUpperCase())}/fundamentals-series?period=${period}`,
    { credentials: "include" },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { points?: ChartingSeriesPoint[]; ttmPoint?: unknown };
  const points = Array.isArray(json.points) ? json.points : [];
  const ttmPoint = period === "annual" ? parseChartingTtmPoint(json.ttmPoint) : null;
  return { points, ttmPoint };
}

/** Dedupe fundamentals-series fetches when switching metrics or remounting charting UI in one tab. */
export async function fetchChartingFundamentalsSeriesCached(
  ticker: string,
  period: "annual" | "quarterly",
): Promise<ChartingFundamentalsSeriesPayload | null> {
  const key = cacheKey(ticker, period);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { points: hit.points, ttmPoint: hit.ttmPoint };
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = fetchChartingFundamentalsSeriesPayload(ticker, period)
    .then((payload) => {
      if (payload) {
        cache.set(key, { at: Date.now(), points: payload.points, ttmPoint: payload.ttmPoint });
      }
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, p);
  return p;
}

/** Always hit the API and refresh the in-tab cache (e.g. after earnings when SSR seed is stale). */
export async function revalidateChartingFundamentalsSeriesCached(
  ticker: string,
  period: "annual" | "quarterly",
): Promise<ChartingFundamentalsSeriesPayload | null> {
  const key = cacheKey(ticker, period);
  cache.delete(key);

  const pending = inflight.get(key);
  if (pending) return pending;

  return fetchChartingFundamentalsSeriesCached(ticker, period);
}
