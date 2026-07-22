/**
 * Canonical daily portfolio return series (flow-aware) for risk analytics.
 * Pure: given NAV marks + external cash flows, produce consecutive daily returns.
 */

import type { ExternalCashFlow } from "@/lib/portfolio/returns/modified-dietz";
import { ANALYTICS_MAX_STALE_PRICE_DAYS } from "@/lib/portfolio/analytics/portfolio-analytics-types";

export type NavMark = {
  /** Session / valuation date YYYY-MM-DD */
  date: string;
  /** Net worth */
  nav: number;
  /**
   * Fraction of equity market value that had a fresh mark (0–1).
   * Cash-only days may use 1.
   */
  coverage: number;
};

export type DailyReturnPoint = {
  date: string;
  /** Simple flow-adjusted return for the day (not %). */
  r: number;
  coverage: number;
};

function cashFlowOnDate(flows: readonly ExternalCashFlow[], date: string): number {
  let s = 0;
  for (const f of flows) {
    if (f.date === date) s += f.amount;
  }
  return s;
}

/**
 * Daily mid-point Dietz between consecutive marks:
 * r = (V1 − V0 − CF) / (V0 + CF/2)
 * Skips pairs with insufficient coverage or non-positive denom.
 */
export function buildFlowAwareDailyReturns(
  marks: readonly NavMark[],
  flows: readonly ExternalCashFlow[],
  opts?: { minCoverage?: number },
): DailyReturnPoint[] {
  const minCoverage = opts?.minCoverage ?? 0.5;
  const sorted = [...marks]
    .filter((m) => Number.isFinite(m.nav) && /^\d{4}-\d{2}-\d{2}$/.test(m.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const out: DailyReturnPoint[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const gapDays = calendarGapDays(prev.date, cur.date);
    if (gapDays > ANALYTICS_MAX_STALE_PRICE_DAYS + 1) continue;
    if (cur.coverage < minCoverage || prev.coverage < minCoverage) continue;

    const cf = cashFlowOnDate(flows, cur.date);
    const denom = prev.nav + cf / 2;
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-9) continue;
    const num = cur.nav - prev.nav - cf;
    if (!Number.isFinite(num)) continue;
    const r = num / denom;
    if (!Number.isFinite(r)) continue;
    out.push({ date: cur.date, r, coverage: Math.min(prev.coverage, cur.coverage) });
  }
  return out;
}

function calendarGapDays(a: string, b: string): number {
  const ta = Date.parse(`${a}T12:00:00.000Z`);
  const tb = Date.parse(`${b}T12:00:00.000Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 999;
  return Math.round((tb - ta) / 86_400_000);
}

/** Align portfolio and benchmark returns on identical dates. */
export function alignPairedReturns(
  portfolio: readonly DailyReturnPoint[],
  benchmark: readonly DailyReturnPoint[],
): { date: string; rp: number; rb: number }[] {
  const bMap = new Map(benchmark.map((p) => [p.date, p.r]));
  const out: { date: string; rp: number; rb: number }[] = [];
  for (const p of portfolio) {
    const rb = bMap.get(p.date);
    if (rb == null || !Number.isFinite(rb)) continue;
    out.push({ date: p.date, rp: p.r, rb });
  }
  return out;
}
