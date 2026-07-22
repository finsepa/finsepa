/**
 * Overview / chart period Modified Dietz returns (server).
 */
import "server-only";

import { format, parseISO, startOfYear, subDays, subMonths, subYears } from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import {
  loadPortfolioEodBars,
  loadPortfolioSpyEodBars,
} from "@/lib/portfolio/data/load-portfolio-eod-bars";
import type { OverviewProfitPeriod } from "@/lib/portfolio/overview-market-types";
import { parseBodyTransactions } from "@/lib/portfolio/portfolio-value-history.server";
import type { ModifiedDietzResult } from "@/lib/portfolio/returns/portfolio-return-engine";
import {
  dietzBetweenSessions,
  dietzFromInception,
  lastBarDateOnOrBefore,
} from "@/lib/portfolio/returns/portfolio-nav.server";

const MAX_TX = 4000;

export type DietzPeriodKey =
  | "d1"
  | "d7"
  | "m1"
  | "m3"
  | "m6"
  | "ytd"
  | "y1"
  | "y3"
  | "y5"
  | "all";

export type DietzPeriodPayload = {
  pct: number | null;
  gainUsd: number | null;
  vStart: number;
  vEnd: number;
  netFlow: number;
  startYmd: string;
  endYmd: string;
};

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

function resultToPayload(
  r: ModifiedDietzResult,
  startYmd: string,
  endYmd: string,
): DietzPeriodPayload {
  return {
    pct: r.pct,
    gainUsd: r.gainUsd,
    vStart: r.vStart,
    vEnd: r.vEnd,
    netFlow: r.netFlow,
    startYmd,
    endYmd,
  };
}

/**
 * Resolve session marks for [windowStart, windowEnd]:
 * d0 = last session on/before day before windowStart
 * d1 = last session on/before windowEnd
 */
function resolveSessionMarks(
  windowStartYmd: string,
  windowEndYmd: string,
  sessionCalendar: EodhdDailyBar[],
): { d0: string; d1: string } | null {
  const startDt = parseYmd(windowStartYmd);
  const preStart = startDt ? ymd(subDays(startDt, 1)) : windowStartYmd;

  if (sessionCalendar.length === 0) {
    if (preStart >= windowEndYmd) return null;
    return { d0: preStart, d1: windowEndYmd };
  }

  const sorted = [...sessionCalendar].sort((a, b) => a.date.localeCompare(b.date));
  const d0 = lastBarDateOnOrBefore(sorted, preStart);
  const d1 = lastBarDateOnOrBefore(sorted, windowEndYmd);
  if (!d0 || !d1 || d0 >= d1) return null;
  return { d0, d1 };
}

function calendarPeriodStart(key: Exclude<DietzPeriodKey, "all">, now: Date): string {
  switch (key) {
    case "d1":
      return ymd(subDays(now, 1));
    case "d7":
      return ymd(subDays(now, 7));
    case "m1":
      return ymd(subMonths(now, 1));
    case "m3":
      return ymd(subMonths(now, 3));
    case "m6":
      return ymd(subMonths(now, 6));
    case "ytd":
      return ymd(startOfYear(now));
    case "y1":
      return ymd(subYears(now, 1));
    case "y3":
      return ymd(subYears(now, 3));
    case "y5":
      return ymd(subYears(now, 5));
  }
}

export async function computePortfolioDietzPeriods(
  transactions: PortfolioTransaction[],
  keys: DietzPeriodKey[] = ["d1", "d7", "m1", "m3", "m6", "ytd", "y1", "y3", "y5", "all"],
): Promise<Partial<Record<DietzPeriodKey, DietzPeriodPayload>>> {
  if (transactions.length === 0) return {};

  const firstYmd = earliestTxYmd(transactions);
  if (!firstYmd) return {};

  const now = new Date();
  const toYmd = ymd(now);

  const nonAll = keys.filter((k): k is Exclude<DietzPeriodKey, "all"> => k !== "all");
  const fromCandidates = [
    ymd(subDays(parseYmd(firstYmd) ?? now, 1)),
    ...nonAll.map((k) => calendarPeriodStart(k, now)),
  ];
  const fromYmd = fromCandidates.reduce((a, b) => (a < b ? a : b));

  const symbols = tradeSymbols(transactions);
  const [barsBySymbol, spyBars] = await Promise.all([
    loadPortfolioEodBars(symbols, fromYmd, toYmd),
    loadPortfolioSpyEodBars(fromYmd, toYmd),
  ]);

  const out: Partial<Record<DietzPeriodKey, DietzPeriodPayload>> = {};

  for (const key of keys) {
    if (key === "all") {
      const r = dietzFromInception({
        transactions,
        barsBySymbol,
        firstTxYmd: firstYmd,
        asOfYmd: toYmd,
        sessionCalendar: spyBars,
      });
      const firstDt = parseYmd(firstYmd);
      const startYmd = firstDt ? ymd(subDays(firstDt, 1)) : firstYmd;
      out.all = resultToPayload(r, startYmd, toYmd);
      continue;
    }

    let windowStart = calendarPeriodStart(key, now);
    // Clamp: if period starts before first activity, use inception Dietz for that card.
    if (windowStart < firstYmd) {
      const r = dietzFromInception({
        transactions,
        barsBySymbol,
        firstTxYmd: firstYmd,
        asOfYmd: toYmd,
        sessionCalendar: spyBars,
      });
      const firstDt = parseYmd(firstYmd);
      const startYmd = firstDt ? ymd(subDays(firstDt, 1)) : firstYmd;
      out[key] = resultToPayload(r, startYmd, toYmd);
      continue;
    }

    const marks = resolveSessionMarks(windowStart, toYmd, spyBars);
    if (!marks) {
      out[key] = {
        pct: null,
        gainUsd: null,
        vStart: 0,
        vEnd: 0,
        netFlow: 0,
        startYmd: windowStart,
        endYmd: toYmd,
      };
      continue;
    }

    const r = dietzBetweenSessions({
      transactions,
      barsBySymbol,
      d0: marks.d0,
      d1: marks.d1,
    });
    out[key] = resultToPayload(r, marks.d0, marks.d1);
  }

  return out;
}

export async function computeOverviewDietzPeriods(
  transactions: PortfolioTransaction[],
): Promise<Partial<Record<Exclude<OverviewProfitPeriod, "all">, DietzPeriodPayload>>> {
  const full = await computePortfolioDietzPeriods(transactions, ["m1", "ytd", "y1", "y5"]);
  return {
    m1: full.m1,
    ytd: full.ytd,
    y1: full.y1,
    y5: full.y5,
  };
}

export function parseDietzReturnsBody(body: unknown): {
  transactions: PortfolioTransaction[];
  periods: DietzPeriodKey[];
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const rawTx = o.transactions;
  if (!Array.isArray(rawTx) || rawTx.length > MAX_TX) return null;
  const transactions = parseBodyTransactions(rawTx);
  if (transactions == null) return null;

  const allowed: DietzPeriodKey[] = [
    "d1",
    "d7",
    "m1",
    "m3",
    "m6",
    "ytd",
    "y1",
    "y3",
    "y5",
    "all",
  ];
  let periods: DietzPeriodKey[] = ["m1", "ytd", "y1", "y5"];
  if (Array.isArray(o.periods)) {
    const parsed = o.periods.filter(
      (p): p is DietzPeriodKey => typeof p === "string" && (allowed as string[]).includes(p),
    );
    if (parsed.length > 0) periods = parsed;
  }
  return { transactions, periods };
}
