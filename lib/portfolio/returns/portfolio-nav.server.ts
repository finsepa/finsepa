/**
 * Shared net-worth marks for Modified Dietz (server).
 */
import "server-only";

import { format, parseISO, subDays } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { netCashUsdUpTo } from "@/lib/portfolio/overview-metrics";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";
import {
  type ModifiedDietzResult,
  portfolioPeriodReturnDietz,
} from "@/lib/portfolio/returns/portfolio-return-engine";

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function lastCloseOnOrBefore(bars: EodhdDailyBar[], ymdStr: string): number | null {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = bars[mid]!.date;
    if (t <= ymdStr) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? bars[ans]!.close : null;
}

export function lastBarDateOnOrBefore(bars: EodhdDailyBar[], ymdStr: string): string | null {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const t = bars[mid]!.date;
    if (t <= ymdStr) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? bars[ans]!.date : null;
}

/** Equity mark-to-market + cash as of {@link asOfYmd} (inclusive ledger). */
export function portfolioNetWorthOnDate(
  transactions: PortfolioTransaction[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  asOfYmd: string,
): number {
  const holdings = replayTradeTransactionsToHoldingsUpTo(transactions, asOfYmd);
  let equity = 0;
  for (const h of holdings) {
    const bars = barsBySymbol.get(h.symbol.toUpperCase()) ?? [];
    const px = lastCloseOnOrBefore(bars, asOfYmd);
    if (px != null && Number.isFinite(px) && h.shares > 0) {
      equity += h.shares * px;
    }
  }
  const cash = netCashUsdUpTo(transactions, asOfYmd);
  return equity + cash;
}

/** Modified Dietz between two session marks (exclusive start flows, inclusive end). */
export function dietzBetweenSessions(args: {
  transactions: PortfolioTransaction[];
  barsBySymbol: Map<string, EodhdDailyBar[]>;
  d0: string;
  d1: string;
}): ModifiedDietzResult {
  const v0 = portfolioNetWorthOnDate(args.transactions, args.barsBySymbol, args.d0);
  const v1 = portfolioNetWorthOnDate(args.transactions, args.barsBySymbol, args.d1);
  return portfolioPeriodReturnDietz({
    transactions: args.transactions,
    vStart: v0,
    vEnd: v1,
    startYmd: args.d0,
    endYmd: args.d1,
  });
}

/** Lifetime Dietz: V_B = 0 before first activity. */
export function dietzFromInception(args: {
  transactions: PortfolioTransaction[];
  barsBySymbol: Map<string, EodhdDailyBar[]>;
  firstTxYmd: string;
  asOfYmd: string;
  sessionCalendar?: EodhdDailyBar[];
}): ModifiedDietzResult {
  const firstDt = parseYmd(args.firstTxYmd);
  const startYmd = firstDt ? ymd(subDays(firstDt, 1)) : args.firstTxYmd;
  let endYmd = args.asOfYmd;
  if (args.sessionCalendar && args.sessionCalendar.length > 0) {
    const sorted = [...args.sessionCalendar].sort((a, b) => a.date.localeCompare(b.date));
    endYmd = lastBarDateOnOrBefore(sorted, args.asOfYmd) ?? args.asOfYmd;
  }
  const v1 = portfolioNetWorthOnDate(args.transactions, args.barsBySymbol, endYmd);
  return portfolioPeriodReturnDietz({
    transactions: args.transactions,
    vStart: 0,
    vEnd: v1,
    startYmd,
    endYmd,
  });
}

/** Day-weighted Dietz from inception through asOf using NW(asOf) already computed. */
export function dietzReturnPctFromInceptionNav(args: {
  transactions: PortfolioTransaction[];
  firstTxYmd: string;
  asOfYmd: string;
  vEnd: number;
}): number | null {
  const firstDt = parseYmd(args.firstTxYmd);
  const startYmd = firstDt ? ymd(subDays(firstDt, 1)) : args.firstTxYmd;
  return portfolioPeriodReturnDietz({
    transactions: args.transactions,
    vStart: 0,
    vEnd: args.vEnd,
    startYmd,
    endYmd: args.asOfYmd,
  }).pct;
}
