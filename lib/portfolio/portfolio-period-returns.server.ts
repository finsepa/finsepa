import "server-only";

import {
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subYears,
} from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type {
  PeriodReturnGranularity,
  PortfolioPeriodReturnBar,
} from "@/lib/portfolio/portfolio-period-returns-types";
import { parseBodyTransactions } from "@/lib/portfolio/portfolio-value-history.server";
import {
  comparePortfolioToBenchmark,
} from "@/lib/portfolio/benchmark/benchmark-engine";
import { makePriceOnOrBefore } from "@/lib/portfolio/benchmark/benchmark-compare.server";
import {
  loadPortfolioBenchmarkEodBars,
  loadPortfolioEodBars,
} from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { resolvePeriodReturnSessionMarks } from "@/lib/portfolio/portfolio-period-returns-sessions";
import { portfolioNetWorthOnDate } from "@/lib/portfolio/returns/portfolio-nav.server";

const MAX_TX = 4000;

const MAX_BARS: Record<PeriodReturnGranularity, number> = {
  weekly: 52,
  monthly: 24,
  quarterly: 16,
  annually: 12,
};

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymdSubDays(ymdStr: string, days: number): string {
  const d = parseYmd(ymdStr);
  if (!d) return ymdStr;
  return ymd(subDays(d, days));
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

type RawBucket = { label: string; periodStart: string; periodEnd: string };

function buildBuckets(granularity: PeriodReturnGranularity, firstTx: Date, now: Date): RawBucket[] {
  const startCap = minDate([firstTx, now]);
  const endCap = maxDate([firstTx, now]);

  switch (granularity) {
    case "annually": {
      const from = startOfYear(startCap);
      const to = endOfYear(endCap);
      const years = eachYearOfInterval({ start: from, end: to });
      return years.map((d) => {
        const ys = ymd(startOfYear(d));
        const ye = ymd(endOfYear(d));
        return { label: format(d, "yyyy"), periodStart: ys, periodEnd: ye };
      });
    }
    case "quarterly": {
      const from = startOfQuarter(startCap);
      const to = endOfQuarter(endCap);
      const qs = eachQuarterOfInterval({ start: from, end: to });
      return qs.map((d) => {
        const qsYmd = ymd(startOfQuarter(d));
        const qeYmd = ymd(endOfQuarter(d));
        const label = `Q${Math.floor(d.getMonth() / 3) + 1} ${format(d, "yyyy")}`;
        return { label, periodStart: qsYmd, periodEnd: qeYmd };
      });
    }
    case "monthly": {
      const from = startOfMonth(startCap);
      const to = endOfMonth(endCap);
      const ms = eachMonthOfInterval({ start: from, end: to });
      return ms.map((d) => ({
        label: format(d, "MMM yyyy"),
        periodStart: ymd(startOfMonth(d)),
        periodEnd: ymd(endOfMonth(d)),
      }));
    }
    case "weekly": {
      const from = startOfWeek(startCap, { weekStartsOn: 1 });
      const to = endOfWeek(endCap, { weekStartsOn: 1 });
      const ws = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
      return ws.map((d) => {
        const wkStart = startOfWeek(d, { weekStartsOn: 1 });
        const wkEnd = endOfWeek(d, { weekStartsOn: 1 });
        return {
          label: `${format(wkStart, "MMM d")} – ${format(wkEnd, "MMM d, yyyy")}`,
          periodStart: ymd(wkStart),
          periodEnd: ymd(wkEnd),
        };
      });
    }
    default:
      return [];
  }
}

function sliceRecent<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
}

export async function computePortfolioPeriodReturns(
  transactions: PortfolioTransaction[],
  granularity: PeriodReturnGranularity,
  benchmarkTicker: string,
): Promise<PortfolioPeriodReturnBar[]> {
  if (transactions.length === 0) return [];

  const firstYmd = earliestTxYmd(transactions);
  if (!firstYmd) return [];

  const firstDt = parseYmd(firstYmd);
  if (!firstDt) return [];

  const now = new Date();
  const capFrom = subYears(now, 12);
  const rangeStart = maxDate([firstDt, capFrom]);
  const toYmd = ymd(now);

  let rawBuckets = buildBuckets(granularity, rangeStart, now);
  rawBuckets = sliceRecent(rawBuckets, MAX_BARS[granularity]);

  /**
   * Annual/quarter/… buckets use d0 = last session on/before day-before periodStart
   * (e.g. 2024-12-31 for calendar 2025). Bars must start early enough for that mark
   * even when the first trade is mid-year — otherwise the inception year is all nulls.
   */
  let earliestPreStart = ymd(subDays(firstDt, 1));
  for (const b of rawBuckets) {
    const pre = ymdSubDays(b.periodStart, 1);
    if (pre < earliestPreStart) earliestPreStart = pre;
  }
  const earliestPreDt = parseYmd(earliestPreStart) ?? firstDt;
  const fromYmd = ymd(subDays(earliestPreDt, 14));

  const symbols = tradeSymbols(transactions);
  const benchSym = benchmarkTicker.trim().toUpperCase() || "SPY";

  const [barsBySymbol, benchBars] = await Promise.all([
    loadPortfolioEodBars(symbols, fromYmd, toYmd),
    loadPortfolioBenchmarkEodBars(benchSym, fromYmd, toYmd),
  ]);
  if (benchBars.length === 0) return [];

  const benchSorted = [...benchBars].sort((a, b) => a.date.localeCompare(b.date));
  const priceOnOrBefore = makePriceOnOrBefore(benchSorted);

  const out: PortfolioPeriodReturnBar[] = [];

  for (const b of rawBuckets) {
    const marks = resolvePeriodReturnSessionMarks({
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      asOfYmd: toYmd,
      firstTxYmd: firstYmd,
      benchSorted,
    });
    if (!marks) {
      out.push({ ...b, portfolioPct: null, benchmarkPct: null });
      continue;
    }
    const { d0, d1 } = marks;

    const portfolioVStart =
      d0 < firstYmd ? 0 : portfolioNetWorthOnDate(transactions, barsBySymbol, d0);
    const portfolioVEnd = portfolioNetWorthOnDate(transactions, barsBySymbol, d1);
    const compare = comparePortfolioToBenchmark({
      transactions,
      portfolioVStart,
      portfolioVEnd,
      startYmd: d0,
      endYmd: d1,
      priceOnOrBefore,
    });

    out.push({
      label: b.label,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      portfolioPct: compare.portfolioPct,
      benchmarkPct: compare.benchmarkPct,
    });
  }

  return out;
}

export function parsePortfolioPeriodReturnsBody(body: unknown): {
  transactions: PortfolioTransaction[];
  granularity: PeriodReturnGranularity;
  benchmark: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const g = o.granularity;
  const granularity =
    g === "weekly" || g === "monthly" || g === "quarterly" || g === "annually" ? g : null;
  if (!granularity) return null;

  const rawTx = o.transactions;
  if (!Array.isArray(rawTx) || rawTx.length > MAX_TX) return null;
  const transactions = parseBodyTransactions(rawTx);
  if (transactions == null) return null;

  const b = o.benchmark;
  const benchmark = typeof b === "string" && b.trim() ? b.trim().toUpperCase() : "SPY";

  return { transactions, granularity, benchmark };
}
