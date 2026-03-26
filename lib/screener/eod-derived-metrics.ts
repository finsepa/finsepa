import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";

function parseYmdUtc(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00.000Z`);
}

export function trimNumberString(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "") || "0";
}

export function formatDecimalTrim(n: number): string {
  return trimNumberString(n.toFixed(2));
}

/** e.g. $3.22T, $890.44B, $12.3M — returns "-" when missing. */
export function formatMarketCapDisplay(usd: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd) || usd <= 0) return "-";
  const v = usd;
  if (v >= 1e12) return `$${trimNumberString((v / 1e12).toFixed(2))}T`;
  if (v >= 1e9) return `$${trimNumberString((v / 1e9).toFixed(2))}B`;
  if (v >= 1e6) return `$${trimNumberString((v / 1e6).toFixed(2))}M`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

/** Trailing PE preferred, then forward. "-" when unavailable. */
export function formatPeDisplay(trailing: number | null | undefined, forward: number | null | undefined): string {
  const v = trailing ?? forward;
  if (v == null || !Number.isFinite(v)) return "-";
  return trimNumberString(v.toFixed(2));
}

export type DerivedFromEodBars = {
  changePercent1M: number | null;
  changePercentYTD: number | null;
  sparkline5d: number[];
};

/**
 * 1M % vs nearest trading day ~30 calendar days before the latest bar.
 * YTD % vs first bar on or after Jan 1 (UTC year of latest bar date).
 * Sparkline: last 5 adjusted closes.
 */
export function deriveMetricsFromDailyBars(bars: EodhdDailyBar[], currentPrice: number): DerivedFromEodBars {
  if (!bars.length || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { changePercent1M: null, changePercentYTD: null, sparkline5d: [] };
  }

  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const lastBar = sorted[sorted.length - 1]!;
  const lastTime = parseYmdUtc(lastBar.date);

  const sparkline5d = sorted.slice(-5).map((b) => b.close);

  const ytdYear = Number(lastBar.date.slice(0, 4));
  const ytdStartStr = `${ytdYear}-01-01`;
  const ytdBar = sorted.find((b) => b.date >= ytdStartStr);
  let changePercentYTD: number | null = null;
  if (ytdBar && ytdBar.close > 0) {
    changePercentYTD = ((currentPrice - ytdBar.close) / ytdBar.close) * 100;
  }

  const targetTime = lastTime - 30 * 24 * 60 * 60 * 1000;
  let nearest = sorted[0]!;
  let nearestDiff = Infinity;
  for (const b of sorted) {
    const t = parseYmdUtc(b.date);
    const diff = Math.abs(t - targetTime);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearest = b;
    }
  }

  let changePercent1M: number | null = null;
  if (nearest && nearest.close > 0) {
    changePercent1M = ((currentPrice - nearest.close) / nearest.close) * 100;
  }

  return { changePercent1M, changePercentYTD, sparkline5d };
}

export function eodFetchWindowUtc(): { from: string; to: string } {
  const to = new Date();
  const toStr = to.toISOString().slice(0, 10);
  const from = new Date(to);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  from.setUTCDate(from.getUTCDate() - 45);
  const fromStr = from.toISOString().slice(0, 10);
  return { from: fromStr, to: toStr };
}
