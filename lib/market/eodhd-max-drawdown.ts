import "server-only";

import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import type { DrawdownSeriesPoint } from "@/lib/market/drawdown-series-types";

export type { DrawdownSeriesPoint } from "@/lib/market/drawdown-series-types";

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Largest peak-to-trough decline over the series (as a positive fraction, e.g. 0.8376 = 83.76%).
 */
export function computeMaxDrawdownFraction(closes: number[]): number | null {
  if (closes.length < 2) return null;
  let peak = closes[0]!;
  if (!Number.isFinite(peak) || peak <= 0) return null;
  let maxDd = 0;
  for (let i = 1; i < closes.length; i++) {
    const p = closes[i]!;
    if (!Number.isFinite(p) || p <= 0) continue;
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return Number.isFinite(maxDd) ? maxDd : null;
}

/** Running peak-to-trough drawdown at each bar (underwater curve). */
export function computeDrawdownSeries(bars: EodhdDailyBar[]): DrawdownSeriesPoint[] {
  if (bars.length < 2) return [];

  let peak = bars[0]!.close;
  if (!Number.isFinite(peak) || peak <= 0) return [];

  const out: DrawdownSeriesPoint[] = [];
  for (const bar of bars) {
    const close = bar.close;
    if (!Number.isFinite(close) || close <= 0) continue;
    if (close > peak) peak = close;
    const drawdown = peak > 0 ? (close - peak) / peak : 0;
    out.push({
      date: bar.date,
      timestamp: Math.floor(Date.parse(`${bar.date}T00:00:00Z`) / 1000),
      drawdown,
    });
  }
  return out.length >= 2 ? out : [];
}

/** ~5 calendar years of daily adjusted closes, then max drawdown. */
export async function fetchFiveYearMaxDrawdownFraction(ticker: string): Promise<number | null> {
  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 5);
  const bars = await fetchEodhdEodDaily(ticker, ymdUtc(from), ymdUtc(now));
  if (!bars?.length) return null;
  const closes = bars.map((b) => b.close);
  return computeMaxDrawdownFraction(closes);
}

/** ~20 calendar years of daily adjusted closes, then underwater drawdown series. */
export async function fetchTwentyYearDrawdownSeries(ticker: string): Promise<DrawdownSeriesPoint[] | null> {
  const now = new Date();
  const from = new Date(now);
  from.setUTCFullYear(from.getUTCFullYear() - 20);
  const bars = await fetchEodhdEodDaily(ticker, ymdUtc(from), ymdUtc(now));
  if (!bars?.length) return null;
  const series = computeDrawdownSeries(bars);
  return series.length ? series : null;
}
