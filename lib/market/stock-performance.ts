import "server-only";

import { unstable_cache } from "next/cache";

import { fetchEodhdEodDaily, type EodhdDailyBar } from "@/lib/market/eodhd-eod";

export type StockPerformance = {
  ticker: string;
  price: number | null;
  d1: number | null;
  d5: number | null;
  /** ~7 trading days back vs prior close */
  d7: number | null;
  m1: number | null;
  m6: number | null;
  ytd: number | null;
  y1: number | null;
  y5: number | null;
  all: number | null;
};

function parseYmdUtc(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`);
}

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonthsUtc(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function pickNearestBar(bars: EodhdDailyBar[], targetTimeMs: number): EodhdDailyBar | null {
  if (!bars.length) return null;
  let best = bars[0]!;
  let bestDiff = Infinity;
  for (const b of bars) {
    const t = parseYmdUtc(b.date);
    const diff = Math.abs(t - targetTimeMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = b;
    }
  }
  return best ?? null;
}

function pickBarOnOrAfter(bars: EodhdDailyBar[], ymdStart: string): EodhdDailyBar | null {
  for (const b of bars) {
    if (b.date >= ymdStart) return b;
  }
  return null;
}

function pctChange(current: number | null, base: number | null): number | null {
  if (current == null || base == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) return null;
  return ((current - base) / base) * 100;
}

function closeAtTradingOffset(bars: EodhdDailyBar[], tradingDaysBack: number): number | null {
  // bars are ascending by date.
  const idx = bars.length - 1 - tradingDaysBack;
  if (idx < 0 || idx >= bars.length) return null;
  const c = bars[idx]?.close;
  return typeof c === "number" && Number.isFinite(c) ? c : null;
}

async function loadStockPerformanceUncached(ticker: string): Promise<StockPerformance> {
  const sym = ticker.trim().toUpperCase();
  const now = new Date();
  const to = ymdUtc(now);

  // Fetch a long enough window to cover 5Y + ALL (bounded to 12Y for performance).
  const fromDate = new Date(now);
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 12);
  const from = ymdUtc(fromDate);

  const bars = await fetchEodhdEodDaily(sym, from, to);
  const sorted = bars?.length ? [...bars].sort((a, b) => a.date.localeCompare(b.date)) : [];

  const last = sorted.length ? sorted[sorted.length - 1]! : null;
  const price = last?.close ?? null;

  // Trading-day offsets (more accurate than calendar nearest for very short ranges).
  const prev1dClose = closeAtTradingOffset(sorted, 1); // previous trading day close
  const prev5dClose = closeAtTradingOffset(sorted, 5); // ~5 trading days back
  const prev7dClose = closeAtTradingOffset(sorted, 7); // ~7 trading days back

  const d1 = pctChange(price, prev1dClose);
  const d5 = pctChange(price, prev5dClose);
  const d7 = pctChange(price, prev7dClose);

  // Calendar-based ranges use nearest available trading bar to the target date.
  const m1Bar = pickNearestBar(sorted, addMonthsUtc(now, -1).getTime());
  const m6Bar = pickNearestBar(sorted, addMonthsUtc(now, -6).getTime());
  const y1Bar = pickNearestBar(sorted, addMonthsUtc(now, -12).getTime());
  const y5Bar = pickNearestBar(sorted, addMonthsUtc(now, -60).getTime());

  const m1 = pctChange(price, m1Bar?.close ?? null);
  const m6 = pctChange(price, m6Bar?.close ?? null);
  const y1 = pctChange(price, y1Bar?.close ?? null);
  const y5 = pctChange(price, y5Bar?.close ?? null);

  const ytdStart = `${now.getUTCFullYear()}-01-01`;
  const ytdBar = pickBarOnOrAfter(sorted, ytdStart);
  const ytd = pctChange(price, ytdBar?.close ?? null);

  const first = sorted.length ? sorted[0]! : null;
  const all = pctChange(price, first?.close ?? null);

  return { ticker: sym, price, d1, d5, d7, m1, m6, ytd, y1, y5, all };
}

export const getStockPerformance = unstable_cache(
  async (ticker: string) => loadStockPerformanceUncached(ticker),
  ["stock-performance-v2"],
  { revalidate: 60 },
);

