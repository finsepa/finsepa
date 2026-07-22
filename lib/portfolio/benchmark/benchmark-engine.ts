/**
 * Cash-flow contribution benchmark (Manual Portfolio Phase 3).
 *
 * Every external portfolio cash flow is invested into / withdrawn from the
 * benchmark on the same day. Benchmark NAV is then comparable to portfolio NAV
 * under identical Modified Dietz methodology.
 */

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import {
  computeModifiedDietzReturn,
  extractExternalCashFlows,
  type ExternalCashFlow,
  type ModifiedDietzResult,
} from "@/lib/portfolio/returns/modified-dietz";
import { sortPortfolioTransactionsCanonical } from "@/lib/portfolio/ledger/portfolio-ledger-order";
import { migratePortfolioTransactionSequences } from "@/lib/portfolio/ledger/portfolio-ledger-migrate";

export type BenchmarkPriceFn = (ymd: string) => number | null;

export type BenchmarkCompareResult = {
  /** Portfolio Modified Dietz % over the window. */
  portfolioPct: number | null;
  /** Benchmark contribution-model Modified Dietz % over the same window. */
  benchmarkPct: number | null;
  /** portfolioPct − benchmarkPct (percentage points). */
  aheadPct: number | null;
  portfolio: ModifiedDietzResult;
  benchmark: ModifiedDietzResult;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** All external cash flows (deposits/withdrawals), chronological. */
export function extractAllExternalCashFlows(
  transactions: readonly PortfolioTransaction[],
): ExternalCashFlow[] {
  const { transactions: migrated } = migratePortfolioTransactionSequences(transactions);
  const ordered = sortPortfolioTransactionsCanonical(migrated);
  const out: ExternalCashFlow[] = [];
  for (const t of ordered) {
    if (t.kind !== "cash") continue;
    if (!YMD_RE.test(t.date)) continue;
    if (!Number.isFinite(t.sum) || t.sum === 0) continue;
    out.push({ date: t.date, amount: t.sum });
  }
  return out;
}

/**
 * Replay contribution-model shares through {@link asOfYmd} (inclusive).
 * Deposit → buy shares at that day's mark; withdrawal → sell shares (floored at 0).
 */
export function replayBenchmarkSharesAsOf(
  flows: readonly ExternalCashFlow[],
  asOfYmd: string,
  priceOnOrBefore: BenchmarkPriceFn,
): number {
  let shares = 0;
  for (const f of flows) {
    if (f.date > asOfYmd) break;
    const px = priceOnOrBefore(f.date);
    if (px == null || !Number.isFinite(px) || px <= 0) continue;
    if (f.amount > 0) {
      shares += f.amount / px;
    } else {
      const want = Math.abs(f.amount) / px;
      shares = Math.max(0, shares - want);
    }
  }
  return shares;
}

/** Benchmark NAV = shares × mark on/before asOf. */
export function benchmarkNavOnDate(
  flows: readonly ExternalCashFlow[],
  asOfYmd: string,
  priceOnOrBefore: BenchmarkPriceFn,
): number {
  const shares = replayBenchmarkSharesAsOf(flows, asOfYmd, priceOnOrBefore);
  const px = priceOnOrBefore(asOfYmd);
  if (px == null || !Number.isFinite(px) || px <= 0) return 0;
  return shares * px;
}

/**
 * Modified Dietz on contribution-model benchmark NAV for (startYmd, endYmd] marks.
 * Uses the same external flows as the portfolio window.
 */
export function benchmarkDietzForWindow(args: {
  flows: readonly ExternalCashFlow[];
  startYmd: string;
  endYmd: string;
  priceOnOrBefore: BenchmarkPriceFn;
}): ModifiedDietzResult {
  const { flows, startYmd, endYmd, priceOnOrBefore } = args;
  const vStart = benchmarkNavOnDate(flows, startYmd, priceOnOrBefore);
  const vEnd = benchmarkNavOnDate(flows, endYmd, priceOnOrBefore);
  const windowFlows = flows.filter((f) => f.date > startYmd && f.date <= endYmd);
  return computeModifiedDietzReturn({
    vStart,
    vEnd,
    startYmd,
    endYmd,
    flows: windowFlows,
  });
}

export function portfolioDietzForWindow(args: {
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

/**
 * Single comparison entry: identical Dietz methodology, contribution-synced benchmark.
 */
export function comparePortfolioToBenchmark(args: {
  transactions: readonly PortfolioTransaction[];
  portfolioVStart: number;
  portfolioVEnd: number;
  startYmd: string;
  endYmd: string;
  priceOnOrBefore: BenchmarkPriceFn;
}): BenchmarkCompareResult {
  const allFlows = extractAllExternalCashFlows(args.transactions);
  const portfolio = portfolioDietzForWindow({
    transactions: args.transactions,
    vStart: args.portfolioVStart,
    vEnd: args.portfolioVEnd,
    startYmd: args.startYmd,
    endYmd: args.endYmd,
  });

  // No external deposits/withdrawals → contribution-model S&P has nothing to invest.
  // Dietz on 0→0 NAV returns a misleading 0%; treat as unavailable instead.
  if (allFlows.length === 0) {
    const emptyBenchmark = benchmarkDietzForWindow({
      flows: allFlows,
      startYmd: args.startYmd,
      endYmd: args.endYmd,
      priceOnOrBefore: args.priceOnOrBefore,
    });
    return {
      portfolioPct: portfolio.pct,
      benchmarkPct: null,
      aheadPct: null,
      portfolio,
      benchmark: { ...emptyBenchmark, pct: null },
    };
  }

  const benchmark = benchmarkDietzForWindow({
    flows: allFlows,
    startYmd: args.startYmd,
    endYmd: args.endYmd,
    priceOnOrBefore: args.priceOnOrBefore,
  });

  const portfolioPct = portfolio.pct;
  const benchmarkPct = benchmark.pct;
  let aheadPct: number | null = null;
  if (
    portfolioPct != null &&
    Number.isFinite(portfolioPct) &&
    benchmarkPct != null &&
    Number.isFinite(benchmarkPct)
  ) {
    aheadPct = portfolioPct - benchmarkPct;
  }

  return { portfolioPct, benchmarkPct, aheadPct, portfolio, benchmark };
}

/**
 * Dollar NAV path for chart overlay — same sample dates as portfolio history.
 * `mode: "profit"` = NAV − cumulative net deposits through that date.
 */
export function buildContributionBenchmarkSeries(args: {
  sampleYmds: readonly string[];
  flows: readonly ExternalCashFlow[];
  priceOnOrBefore: BenchmarkPriceFn;
  mode?: "value" | "profit";
}): { t: string; value: number }[] {
  const mode = args.mode ?? "value";
  const out: { t: string; value: number }[] = [];
  for (const t of args.sampleYmds) {
    const nav = benchmarkNavOnDate(args.flows, t, args.priceOnOrBefore);
    if (!Number.isFinite(nav)) continue;
    if (mode === "value") {
      out.push({ t, value: nav });
      continue;
    }
    const netDeposits = args.flows
      .filter((f) => f.date <= t)
      .reduce((s, f) => s + f.amount, 0);
    out.push({ t, value: nav - netDeposits });
  }
  return out;
}

export const BENCHMARK_DEFAULT_TICKER = "SPY";
export const BENCHMARK_PRICE_BASIS = "eodhd_adjusted_close" as const;
