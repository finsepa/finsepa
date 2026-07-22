/**
 * Portfolio return engine — single entry point for Manual Portfolio return %.
 * Phase 2: Modified Dietz for period / chart returns. Lifetime equity ROC kept for All $ alignment.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  computeModifiedDietzReturn,
  extractExternalCashFlows,
  modifiedDietzForNavWindow,
  modifiedDietzMidpointPct,
  type ModifiedDietzResult,
} from "@/lib/portfolio/returns/modified-dietz";
import { lifetimeEquityProfitPct } from "@/lib/portfolio/overview-metrics";
import type { PortfolioHolding } from "@/components/portfolio/portfolio-types";

export type {
  ExternalCashFlow,
  ModifiedDietzResult,
} from "@/lib/portfolio/returns/modified-dietz";

export {
  calendarDaysBetween,
  computeModifiedDietzReturn,
  extractExternalCashFlows,
  modifiedDietzForNavWindow,
  modifiedDietzMidpointPct,
} from "@/lib/portfolio/returns/modified-dietz";

export type PortfolioReturnKind =
  /** Day-weighted Modified Dietz on net worth with external cash flows only. */
  | "modified_dietz"
  /**
   * Lifetime equity simple ROC: (realized+unrealized) / historical equity cost.
   * Used for Overview “All” so % stays aligned with unchanged equity profit $.
   */
  | "lifetime_equity_roc";

/**
 * Lifetime equity return % (not flow-adjusted). Unchanged from Phase 0/1 semantics.
 */
export function lifetimeEquityReturnPct(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): number | null {
  return lifetimeEquityProfitPct(holdings, transactions);
}

/**
 * Modified Dietz % between two NAV marks.
 */
export function portfolioPeriodReturnDietz(args: {
  transactions: readonly PortfolioTransaction[];
  vStart: number;
  vEnd: number;
  startYmd: string;
  endYmd: string;
}): ModifiedDietzResult {
  return modifiedDietzForNavWindow(args);
}

/**
 * Dietz from inception (startYmd) through asOfYmd for chart Return series.
 */
export function portfolioReturnDietzAsOf(args: {
  transactions: readonly PortfolioTransaction[];
  vStart: number;
  vEnd: number;
  inceptionYmd: string;
  asOfYmd: string;
}): ModifiedDietzResult {
  return modifiedDietzForNavWindow({
    transactions: args.transactions,
    vStart: args.vStart,
    vEnd: args.vEnd,
    startYmd: args.inceptionYmd,
    endYmd: args.asOfYmd,
  });
}

/** Re-export midpoint helper used by legacy `benchmark-inception` callers / tests. */
export function simpleModifiedDietzPct(
  vStart: number,
  vEnd: number,
  netFlow: number,
): number | null {
  return modifiedDietzMidpointPct(vStart, vEnd, netFlow);
}

/** Unit-test helper: Dietz when all flows known without NAV rebuild. */
export function dietzFromComponents(
  vStart: number,
  vEnd: number,
  startYmd: string,
  endYmd: string,
  flows: { date: string; amount: number }[],
): ModifiedDietzResult {
  return computeModifiedDietzReturn({ vStart, vEnd, startYmd, endYmd, flows });
}

export function externalFlowsInWindow(
  transactions: readonly PortfolioTransaction[],
  startYmd: string,
  endYmd: string,
) {
  return extractExternalCashFlows(transactions, startYmd, endYmd);
}
