import "server-only";

import {
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachYearOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subYears,
} from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type {
  PeriodReturnGranularity,
  PortfolioPeriodReturnBar,
} from "@/lib/portfolio/portfolio-period-returns-types";
import { PERIOD_RETURN_HISTORY_YEARS } from "@/lib/portfolio/portfolio-period-returns-years";
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
  _benchmarkTicker: string,
  calendarYear?: number | null,
): Promise<PortfolioPeriodReturnBar[]> {
  if (transactions.length === 0) return [];

  const firstYmd = earliestTxYmd(transactions);
  if (!firstYmd) return [];

  const firstDt = parseYmd(firstYmd);
  if (!firstDt) return [];

  const now = new Date();
  const capFrom = subYears(now, PERIOD_RETURN_HISTORY_YEARS);
  const rangeStart = maxDate([firstDt, capFrom]);
  const toYmd = ymd(now);

  let rawBuckets: RawBucket[];
  if (calendarYear != null && granularity !== "annually") {
    const yearStart = startOfYear(new Date(calendarYear, 0, 1));
    const yearEnd = minDate([endOfYear(new Date(calendarYear, 11, 31)), now]);
    const from = maxDate([rangeStart, yearStart]);
    if (from > yearEnd) return [];
    const yearPrefix = `${calendarYear}-`;
    rawBuckets = buildBuckets(granularity, from, yearEnd).filter((b) =>
      b.periodStart.startsWith(yearPrefix),
    );
  } else {
    rawBuckets = sliceRecent(buildBuckets(granularity, rangeStart, now), MAX_BARS[granularity]);
  }
  if (rawBuckets.length === 0) return [];

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

  const [barsBySymbol, spyBars, nasdaqBars] = await Promise.all([
    loadPortfolioEodBars(symbols, fromYmd, toYmd),
    loadPortfolioBenchmarkEodBars("SPY", fromYmd, toYmd),
    loadPortfolioBenchmarkEodBars("QQQ", fromYmd, toYmd),
  ]);
  if (spyBars.length === 0 && nasdaqBars.length === 0) return [];

  const spySorted = [...spyBars].sort((a, b) => a.date.localeCompare(b.date));
  const nasdaqSorted = [...nasdaqBars].sort((a, b) => a.date.localeCompare(b.date));
  const sessionSorted = spySorted.length > 0 ? spySorted : nasdaqSorted;
  const spyPriceOnOrBefore = spySorted.length > 0 ? makePriceOnOrBefore(spySorted) : null;
  const nasdaqPriceOnOrBefore = nasdaqSorted.length > 0 ? makePriceOnOrBefore(nasdaqSorted) : null;

  const out: PortfolioPeriodReturnBar[] = [];

  for (const b of rawBuckets) {
    const marks = resolvePeriodReturnSessionMarks({
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      asOfYmd: toYmd,
      firstTxYmd: firstYmd,
      benchSorted: sessionSorted,
    });
    if (!marks) {
      out.push({ ...b, portfolioPct: null, benchmarkPct: null, nasdaqPct: null });
      continue;
    }
    const { d0, d1 } = marks;

    const portfolioVStart =
      d0 < firstYmd ? 0 : portfolioNetWorthOnDate(transactions, barsBySymbol, d0);
    const portfolioVEnd = portfolioNetWorthOnDate(transactions, barsBySymbol, d1);

    const spyCompare =
      spyPriceOnOrBefore == null ?
        null
      : comparePortfolioToBenchmark({
          transactions,
          portfolioVStart,
          portfolioVEnd,
          startYmd: d0,
          endYmd: d1,
          priceOnOrBefore: spyPriceOnOrBefore,
        });
    const nasdaqCompare =
      nasdaqPriceOnOrBefore == null ?
        null
      : comparePortfolioToBenchmark({
          transactions,
          portfolioVStart,
          portfolioVEnd,
          startYmd: d0,
          endYmd: d1,
          priceOnOrBefore: nasdaqPriceOnOrBefore,
        });

    out.push({
      label: b.label,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      portfolioPct: spyCompare?.portfolioPct ?? nasdaqCompare?.portfolioPct ?? null,
      benchmarkPct: spyCompare?.benchmarkPct ?? null,
      nasdaqPct: nasdaqCompare?.benchmarkPct ?? null,
    });
  }

  return out;
}

function parseOptionalCalendarYear(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1990 || n > 2100) return null;
  return n;
}

export function parsePortfolioPeriodReturnsBody(body: unknown): {
  transactions: PortfolioTransaction[];
  granularity: PeriodReturnGranularity;
  benchmark: string;
  year: number | null;
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const g = o.granularity;
  const granularity =
    g === "monthly" || g === "quarterly" || g === "annually" ? g : null;
  if (!granularity) return null;

  const rawTx = o.transactions;
  if (!Array.isArray(rawTx) || rawTx.length > MAX_TX) return null;
  const transactions = parseBodyTransactions(rawTx);
  if (transactions == null) return null;

  const b = o.benchmark;
  const benchmark = typeof b === "string" && b.trim() ? b.trim().toUpperCase() : "SPY";
  const year = parseOptionalCalendarYear(o.year);

  return { transactions, granularity, benchmark, year };
}
