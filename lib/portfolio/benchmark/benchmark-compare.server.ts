/**
 * Server helpers for contribution-model SPY (or other) benchmark compare.
 */
import "server-only";

import { format, parseISO, subDays } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import {
  loadPortfolioBenchmarkEodBars,
  loadPortfolioEodBars,
} from "@/lib/portfolio/data/load-portfolio-eod-bars";
import {
  BENCHMARK_DEFAULT_TICKER,
  comparePortfolioToBenchmark,
  type BenchmarkCompareResult,
} from "@/lib/portfolio/benchmark/benchmark-engine";
import {
  lastBarDateOnOrBefore,
  lastCloseOnOrBefore,
  portfolioNetWorthOnDate,
} from "@/lib/portfolio/returns/portfolio-nav.server";

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function earliestTxYmd(transactions: PortfolioTransaction[]): string | null {
  let min: string | null = null;
  for (const t of transactions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
    if (min == null || t.date < min) min = t.date;
  }
  return min;
}

function tradeSymbols(transactions: PortfolioTransaction[]): string[] {
  const s = new Set<string>();
  for (const t of transactions) {
    if (t.kind !== "trade") continue;
    const u = t.symbol.trim().toUpperCase();
    if (u) s.add(u);
  }
  return [...s];
}

export function makePriceOnOrBefore(bars: EodhdDailyBar[]): (ymdStr: string) => number | null {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  return (ymdStr: string) => lastCloseOnOrBefore(sorted, ymdStr);
}

export async function fetchBenchmarkBars(
  ticker: string,
  fromYmd: string,
  toYmd: string,
): Promise<EodhdDailyBar[]> {
  const sym = ticker.trim().toUpperCase() || BENCHMARK_DEFAULT_TICKER;
  return loadPortfolioBenchmarkEodBars(sym, fromYmd, toYmd, { retry: true });
}

async function loadPortfolioBars(
  symbols: string[],
  fromYmd: string,
  toYmd: string,
): Promise<Map<string, EodhdDailyBar[]>> {
  return loadPortfolioEodBars(symbols, fromYmd, toYmd, { retry: true });
}

/** Inception window: day before first tx → asOf (default today). */
export function inceptionBenchmarkWindow(
  transactions: PortfolioTransaction[],
  asOfYmd?: string,
): { startYmd: string; endYmd: string; firstTxYmd: string } | null {
  const firstYmd = earliestTxYmd(transactions);
  if (!firstYmd) return null;
  const firstDt = parseYmd(firstYmd);
  const startYmd = firstDt ? ymd(subDays(firstDt, 1)) : firstYmd;
  const endYmd = asOfYmd ?? ymd(new Date());
  return { startYmd, endYmd, firstTxYmd: firstYmd };
}

export function comparePortfolioBenchmarkWithNavBars(args: {
  transactions: PortfolioTransaction[];
  portfolioBarsBySymbol: Map<string, EodhdDailyBar[]>;
  benchmarkBars: EodhdDailyBar[];
  startYmd: string;
  endYmd: string;
}): BenchmarkCompareResult {
  const priceOnOrBefore = makePriceOnOrBefore(args.benchmarkBars);
  const portfolioVStart = portfolioNetWorthOnDate(
    args.transactions,
    args.portfolioBarsBySymbol,
    args.startYmd,
  );
  const portfolioVEnd = portfolioNetWorthOnDate(
    args.transactions,
    args.portfolioBarsBySymbol,
    args.endYmd,
  );
  return comparePortfolioToBenchmark({
    transactions: args.transactions,
    portfolioVStart,
    portfolioVEnd,
    startYmd: args.startYmd,
    endYmd: args.endYmd,
    priceOnOrBefore,
  });
}

/**
 * Snap window to last available benchmark sessions (weekends/holidays).
 */
export function snapCompareSessions(
  benchmarkBars: EodhdDailyBar[],
  windowStartYmd: string,
  windowEndYmd: string,
): { d0: string; d1: string } | null {
  if (benchmarkBars.length === 0) return null;
  const sorted = [...benchmarkBars].sort((a, b) => a.date.localeCompare(b.date));
  const startDt = parseYmd(windowStartYmd);
  const preStart = startDt ? ymd(subDays(startDt, 1)) : windowStartYmd;
  // When windowStart is already "day before first tx", use it directly as d0 candidate.
  const d0 = lastBarDateOnOrBefore(sorted, windowStartYmd) ?? lastBarDateOnOrBefore(sorted, preStart);
  const d1 = lastBarDateOnOrBefore(sorted, windowEndYmd);
  if (!d0 || !d1 || d0 >= d1) {
    // Inception: start may be before any bar — use synthetic start with V=0
    if (d1 && windowStartYmd < d1) return { d0: windowStartYmd, d1 };
    return null;
  }
  return { d0, d1 };
}

/**
 * Inception-to-now contribution Dietz comparison (overview S&P card / Ahead).
 */
export async function computeInceptionBenchmarkCompare(
  transactions: PortfolioTransaction[],
  benchmarkTicker: string = BENCHMARK_DEFAULT_TICKER,
): Promise<BenchmarkCompareResult | null> {
  const win = inceptionBenchmarkWindow(transactions);
  if (!win) return null;

  const symbols = tradeSymbols(transactions);
  const [portfolioBars, benchmarkBars] = await Promise.all([
    loadPortfolioBars(symbols, win.startYmd, win.endYmd),
    fetchBenchmarkBars(benchmarkTicker, win.startYmd, win.endYmd),
  ]);
  if (benchmarkBars.length === 0) return null;

  const sessions = snapCompareSessions(benchmarkBars, win.startYmd, win.endYmd);
  if (!sessions) return null;

  // Portfolio V_B at day-before first activity is 0 when startYmd precedes all txs.
  const priceOnOrBefore = makePriceOnOrBefore(benchmarkBars);
  const portfolioVStart =
    sessions.d0 < win.firstTxYmd ?
      0
    : portfolioNetWorthOnDate(transactions, portfolioBars, sessions.d0);
  const portfolioVEnd = portfolioNetWorthOnDate(transactions, portfolioBars, sessions.d1);

  return comparePortfolioToBenchmark({
    transactions,
    portfolioVStart,
    portfolioVEnd,
    startYmd: sessions.d0,
    endYmd: sessions.d1,
    priceOnOrBefore,
  });
}
