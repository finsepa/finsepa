import "server-only";

import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";

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
