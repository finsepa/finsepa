/**
 * Modified Dietz return engine (Manual Portfolio Phase 2).
 *
 * External cash flows = capital deposits/withdrawals only (`kind === "cash"`).
 * Trades, dividends (income), and fees (expense) are investment results, not CF.
 *
 * R = (VE − VB − Σ CFᵢ) / (VB + Σ (CFᵢ × wᵢ))
 * wᵢ = (CD − Dᵢ) / CD  (fraction of period remaining after the flow)
 *
 * @see https://en.wikipedia.org/wiki/Modified_Dietz_method
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

export type ExternalCashFlow = {
  /** Flow date YYYY-MM-DD */
  date: string;
  /** Positive = money into the portfolio; negative = withdrawal */
  amount: number;
};

export type ModifiedDietzResult = {
  /** Return in percent (e.g. 12.5 = +12.5%). */
  pct: number | null;
  /** Investment gain over the window: VE − VB − ΣCF (USD). */
  gainUsd: number | null;
  vStart: number;
  vEnd: number;
  netFlow: number;
  /** Weighted flow contribution Σ(CFᵢ × wᵢ). */
  weightedFlow: number;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Calendar day difference end − start (can be 0). Uses UTC noon to avoid DST issues. */
export function calendarDaysBetween(startYmd: string, endYmd: string): number {
  if (!YMD_RE.test(startYmd) || !YMD_RE.test(endYmd)) return 0;
  const a = Date.parse(`${startYmd}T12:00:00.000Z`);
  const b = Date.parse(`${endYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * External capital flows with date in (startYmd, endYmd] (exclusive start, inclusive end).
 */
export function extractExternalCashFlows(
  transactions: readonly PortfolioTransaction[],
  startYmd: string,
  endYmd: string,
): ExternalCashFlow[] {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  const ordered = sortPortfolioTransactionsCanonical(migrated);
  const out: ExternalCashFlow[] = [];
  for (const t of ordered) {
    if (t.kind !== "cash") continue;
    if (!YMD_RE.test(t.date)) continue;
    if (t.date <= startYmd || t.date > endYmd) continue;
    if (!Number.isFinite(t.sum) || t.sum === 0) continue;
    out.push({ date: t.date, amount: t.sum });
  }
  return out;
}

/**
 * True Modified Dietz with day-weighted flows.
 * Mid-point approximation is available via {@link modifiedDietzMidpointPct}.
 */
export function computeModifiedDietzReturn(args: {
  vStart: number;
  vEnd: number;
  startYmd: string;
  endYmd: string;
  flows: readonly ExternalCashFlow[];
}): ModifiedDietzResult {
  const { vStart, vEnd, startYmd, endYmd, flows } = args;
  const netFlow = flows.reduce((s, f) => s + f.amount, 0);
  const gainUsd =
    Number.isFinite(vStart) && Number.isFinite(vEnd) && Number.isFinite(netFlow)
      ? vEnd - vStart - netFlow
      : null;

  const empty: ModifiedDietzResult = {
    pct: null,
    gainUsd,
    vStart,
    vEnd,
    netFlow,
    weightedFlow: 0,
  };

  if (!Number.isFinite(vStart) || !Number.isFinite(vEnd)) return empty;

  const cd = calendarDaysBetween(startYmd, endYmd);
  let weightedFlow = 0;

  if (cd <= 0) {
    // Zero-length window: only meaningful if flat and no flows.
    if (Math.abs(netFlow) < 1e-9 && Math.abs(vEnd - vStart) < 1e-6) {
      return { ...empty, pct: 0, gainUsd: gainUsd ?? 0, weightedFlow: 0 };
    }
    return empty;
  }

  for (const f of flows) {
    const daysRemaining = calendarDaysBetween(f.date, endYmd);
    const w = Math.min(1, Math.max(0, daysRemaining / cd));
    weightedFlow += f.amount * w;
  }

  const denom = vStart + weightedFlow;
  if (!Number.isFinite(denom)) return { ...empty, weightedFlow };

  // Zero start + deposit mid-period: denom = weighted deposit; gain 0 → 0%.
  if (Math.abs(denom) < 1e-9) {
    if (gainUsd != null && Math.abs(gainUsd) < 1e-6) {
      return { pct: 0, gainUsd: 0, vStart, vEnd, netFlow, weightedFlow };
    }
    return { ...empty, weightedFlow };
  }

  // Allow slightly negative denom only if |denom| is meaningful (rare); else null.
  if (denom <= 0 && Math.abs(denom) < 1e-6) {
    return { ...empty, weightedFlow };
  }

  const pct = ((vEnd - vStart - netFlow) / denom) * 100;
  if (!Number.isFinite(pct)) return { ...empty, weightedFlow };

  return { pct, gainUsd, vStart, vEnd, netFlow, weightedFlow };
}

/**
 * Classic mid-period Dietz (all flows weighted ½). Kept for validation / comparison.
 * Equivalent to the previous `modifiedDietzReturnPct` helper.
 */
export function modifiedDietzMidpointPct(
  vStart: number,
  vEnd: number,
  netFlow: number,
): number | null {
  const denom = vStart + netFlow / 2;
  if (!Number.isFinite(denom) || denom <= 0) return null;
  const num = vEnd - vStart - netFlow;
  if (!Number.isFinite(num)) return null;
  return (num / denom) * 100;
}

/** Convenience: Dietz over [startYmd, endYmd] given NAV endpoints + ledger. */
export function modifiedDietzForNavWindow(args: {
  transactions: readonly PortfolioTransaction[];
  vStart: number;
  vEnd: number;
  startYmd: string;
  endYmd: string;
}): ModifiedDietzResult {
  const flows = extractExternalCashFlows(args.transactions, args.startYmd, args.endYmd);
  return computeModifiedDietzReturn({
    vStart: args.vStart,
    vEnd: args.vEnd,
    startYmd: args.startYmd,
    endYmd: args.endYmd,
    flows,
  });
}
