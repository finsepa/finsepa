/**
 * Holdings lookthrough daily returns — risk metrics from day 1 when the ledger
 * is too short for flow-aware NAV history.
 *
 * Uses current holding weights × each asset's EOD price returns on the session calendar.
 * Pure / isomorphic (no server-only imports).
 */

import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import type { DailyReturnPoint } from "@/lib/portfolio/analytics/portfolio-return-series";

export type LookthroughHoldingWeight = {
  symbol: string;
  marketValue: number;
};

function lastCloseOnOrBefore(bars: EodhdDailyBar[], ymdStr: string): number | null {
  let best: number | null = null;
  for (const b of bars) {
    if (b.date <= ymdStr && Number.isFinite(b.close) && b.close > 0) best = b.close;
    if (b.date > ymdStr) break;
  }
  return best;
}

/**
 * Weighted daily simple returns from current positions.
 * Missing marks for a name drop that weight for the day; requires {@link minCoverage}
 * of total equity MV to have prices on both ends of the day.
 */
export function buildHoldingsLookthroughDailyReturns(args: {
  holdings: readonly LookthroughHoldingWeight[];
  barsBySymbol: Map<string, EodhdDailyBar[]>;
  sampleDates: readonly string[];
  minCoverage?: number;
}): DailyReturnPoint[] {
  const minCoverage = args.minCoverage ?? 0.5;
  const equity = args.holdings.filter(
    (h) => h.marketValue > 0 && Boolean(h.symbol.trim()),
  );
  const totalMv = equity.reduce((s, h) => s + h.marketValue, 0);
  if (totalMv <= 0 || args.sampleDates.length < 2) return [];

  const weights = equity.map((h) => ({
    symbol: h.symbol.trim().toUpperCase(),
    w: h.marketValue / totalMv,
  }));

  const sortedBars = new Map<string, EodhdDailyBar[]>();
  for (const { symbol } of weights) {
    const bars = [...(args.barsBySymbol.get(symbol) ?? [])].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    sortedBars.set(symbol, bars);
  }

  const out: DailyReturnPoint[] = [];
  for (let i = 1; i < args.sampleDates.length; i++) {
    const prev = args.sampleDates[i - 1]!;
    const cur = args.sampleDates[i]!;
    let coveredW = 0;
    let weightedR = 0;

    for (const { symbol, w } of weights) {
      const bars = sortedBars.get(symbol) ?? [];
      const p0 = lastCloseOnOrBefore(bars, prev);
      const p1 = lastCloseOnOrBefore(bars, cur);
      if (p0 == null || p1 == null || p0 <= 0 || p1 <= 0) continue;
      coveredW += w;
      weightedR += w * (p1 / p0 - 1);
    }

    if (coveredW + 1e-12 < minCoverage) continue;
    const r = weightedR / coveredW;
    if (!Number.isFinite(r)) continue;
    out.push({ date: cur, r, coverage: coveredW });
  }
  return out;
}

/** Prefer lookthrough when ledger NAV returns are too short. */
export function pickRiskReturnSeries(args: {
  ledgerReturns: readonly DailyReturnPoint[];
  lookthroughReturns: readonly DailyReturnPoint[];
  minObs: number;
}): { returns: DailyReturnPoint[]; source: "ledger" | "lookthrough" } {
  const ledger = [...args.ledgerReturns];
  const look = [...args.lookthroughReturns];
  if (ledger.length >= args.minObs) {
    return { returns: ledger, source: "ledger" };
  }
  if (look.length >= args.minObs || look.length > ledger.length) {
    return { returns: look, source: "lookthrough" };
  }
  return { returns: ledger, source: "ledger" };
}
