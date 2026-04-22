import type { PortfolioHolding, PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  cumulativeRealizedGainUsd,
  cumulativeRealizedGainUsdUpTo,
  lifetimeEquityProfitUsd,
} from "@/lib/portfolio/realized-pnl-from-trades";

export function netCashUsd(transactions: PortfolioTransaction[]): number {
  return transactions.reduce((s, t) => s + t.sum, 0);
}

/** Cash ledger balance after all rows on or before {@link ymd} (inclusive). */
export function netCashUsdUpTo(transactions: PortfolioTransaction[], ymd: string): number {
  let s = 0;
  for (const t of transactions) {
    if (t.date <= ymd) s += t.sum;
  }
  return s;
}

/** Sum of market value of positions plus net cash (total net worth). */
export function totalNetWorth(holdings: PortfolioHolding[], cashUsd: number): number {
  const equity = holdings.reduce((s, h) => s + h.currentValue, 0);
  return equity + cashUsd;
}

/**
 * Values within half a cent of zero format as $0.00 (avoids -$0.00 from float noise / rounding).
 */
export function normalizeUsdForDisplay(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n) < 0.005 ? 0 : n;
}

/** Capital invested in open positions at cost (excludes cash). */
export function totalCostBasisInvested(holdings: PortfolioHolding[]): number {
  return holdings.reduce((s, h) => s + h.costBasis, 0);
}

/** Unrealized P/L on stock positions. */
export function unrealizedProfitUsd(holdings: PortfolioHolding[]): number {
  return holdings.reduce((s, h) => s + (h.currentValue - h.costBasis), 0);
}

export function unrealizedProfitPct(holdings: PortfolioHolding[]): number | null {
  const cost = totalCostBasisInvested(holdings);
  if (cost <= 0) return null;
  return (unrealizedProfitUsd(holdings) / cost) * 100;
}

export function equityMarketValue(holdings: PortfolioHolding[]): number {
  return holdings.reduce((s, h) => s + h.currentValue, 0);
}

/** Sum of sell `sum` (cash proceeds) for equity trades. */
export function totalEquitySellProceedsUsd(transactions: PortfolioTransaction[]): number {
  let s = 0;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.operation.toLowerCase() !== "sell") continue;
    s += t.sum;
  }
  return s;
}

/** Sell proceeds from equity trades on or before {@link asOfYmd} (inclusive). */
export function totalEquitySellProceedsUsdUpTo(
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): number {
  let s = 0;
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    if (t.operation.toLowerCase() !== "sell") continue;
    if (t.date <= asOfYmd) s += t.sum;
  }
  return s;
}

/**
 * Total equity capital deployed through {@link asOfYmd}: cost basis of open positions at that
 * date plus cost of shares sold through that date. Matches the denominator of
 * {@link lifetimeEquityProfitPct} when evaluated at “now”, extended to any as-of date.
 */
export function totalHistoricalEquityCostBasisAsOf(
  openCostBasisHeld: number,
  transactions: PortfolioTransaction[],
  asOfYmd: string,
): number {
  const proceeds = totalEquitySellProceedsUsdUpTo(transactions, asOfYmd);
  const realized = cumulativeRealizedGainUsdUpTo(transactions, asOfYmd);
  const costOfSold = proceeds - realized;
  if (!Number.isFinite(costOfSold) || costOfSold < 0) return openCostBasisHeld;
  return openCostBasisHeld + costOfSold;
}

/**
 * Cost basis still held plus cost basis of everything sold (average-cost), i.e. total capital
 * ever deployed in equity trades. Matches `lifetimeEquityProfitUsd` denominator for a simple
 * return % aligned with the headline profit figure.
 */
export function totalHistoricalEquityCostBasis(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): number {
  const open = totalCostBasisInvested(holdings);
  const proceeds = totalEquitySellProceedsUsd(transactions);
  const realized = cumulativeRealizedGainUsd(transactions);
  const costOfSold = proceeds - realized;
  if (!Number.isFinite(costOfSold) || costOfSold < 0) return open;
  return open + costOfSold;
}

/**
 * Lifetime equity return %: total realized + unrealized profit divided by total historical
 * cost basis (open lots + cost of sold shares). Comparable to simple “return on capital
 * deployed” in other portfolio apps (distinct from Modified Dietz or price-only benchmarks).
 */
export function lifetimeEquityProfitPct(
  holdings: PortfolioHolding[],
  transactions: PortfolioTransaction[],
): number | null {
  const profit = lifetimeEquityProfitUsd(holdings, transactions);
  const denom = totalHistoricalEquityCostBasis(holdings, transactions);
  if (!Number.isFinite(denom) || denom <= 0) return null;
  const pct = (profit / denom) * 100;
  return Number.isFinite(pct) ? pct : null;
}
