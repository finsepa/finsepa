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
import { fetchEodhdCryptoDailyBars, toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { netCashUsdUpTo } from "@/lib/portfolio/overview-metrics";
import type {
  PeriodReturnGranularity,
  PortfolioPeriodReturnBar,
} from "@/lib/portfolio/portfolio-period-returns-types";
import { parseBodyTransactions } from "@/lib/portfolio/portfolio-value-history.server";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";

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

function lastCloseOnOrBefore(bars: EodhdDailyBar[], ymdStr: string): number | null {
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

function lastBarDateOnOrBefore(bars: EodhdDailyBar[], ymdStr: string): string | null {
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

function portfolioNetWorthOnDate(
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
  const fromYmd = ymd(rangeStart);
  const toYmd = ymd(now);

  const symbols = tradeSymbols(transactions);
  const benchSym = benchmarkTicker.trim().toUpperCase() || "SPY";
  const benchEod = toEodhdSymbol(benchSym);

  const fetchOne = async (sym: string): Promise<[string, EodhdDailyBar[]]> => {
    const cryptoPair = toEodhdCryptoSymbol(sym);
    const bars =
      cryptoPair != null ?
        await fetchEodhdCryptoDailyBars(cryptoPair, fromYmd, toYmd)
      : await fetchEodhdEodDaily(toEodhdSymbol(sym), fromYmd, toYmd);
    return [sym, bars ?? []];
  };

  const equityPairs = await Promise.all(symbols.map(fetchOne));
  const benchBars = (await fetchEodhdEodDaily(benchEod, fromYmd, toYmd)) ?? [];
  if (benchBars.length === 0) return [];

  const barsBySymbol = new Map<string, EodhdDailyBar[]>(equityPairs);
  const benchSorted = [...benchBars].sort((a, b) => a.date.localeCompare(b.date));

  let rawBuckets = buildBuckets(granularity, rangeStart, now);
  rawBuckets = sliceRecent(rawBuckets, MAX_BARS[granularity]);

  const out: PortfolioPeriodReturnBar[] = [];

  for (const b of rawBuckets) {
    const preStart = ymdSubDays(b.periodStart, 1);
    const d0 = lastBarDateOnOrBefore(benchSorted, preStart);
    const d1 = lastBarDateOnOrBefore(benchSorted, b.periodEnd);
    if (!d0 || !d1 || d0 >= d1) {
      out.push({ ...b, portfolioPct: null, benchmarkPct: null });
      continue;
    }

    const v0 = portfolioNetWorthOnDate(transactions, barsBySymbol, d0);
    const v1 = portfolioNetWorthOnDate(transactions, barsBySymbol, d1);
    /** Denominator floor avoids unstable % when NW rounds to ~0; both ~0 → 0% (e.g. flat cash). */
    const tol = 1e-6;
    const portfolioPct =
      Number.isFinite(v0) && Number.isFinite(v1) && Math.abs(v0) > tol
        ? (v1 / v0 - 1) * 100
        : Number.isFinite(v0) && Number.isFinite(v1) && Math.abs(v0) <= tol && Math.abs(v1) <= tol
          ? 0
          : null;

    const p0 = lastCloseOnOrBefore(benchSorted, d0);
    const p1 = lastCloseOnOrBefore(benchSorted, d1);
    const benchmarkPct =
      p0 != null && p1 != null && p0 > 0 && d0 < d1 ? (p1 / p0 - 1) * 100 : null;

    out.push({
      label: b.label,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      portfolioPct,
      benchmarkPct,
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
