import "server-only";

import {
  addDays,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { fetchEodhdCryptoDailyBars, toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { netCashUsdUpTo } from "@/lib/portfolio/overview-metrics";
import type { PortfolioChartRange, PortfolioValueHistoryPoint } from "@/lib/portfolio/portfolio-chart-types";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";

const MAX_TX = 4000;

function maxPointsForRange(r: PortfolioChartRange): number {
  switch (r) {
    case "1d":
      return 12;
    case "7d":
      return 16;
    case "1m":
      return 24;
    case "6m":
      return 36;
    case "ytd":
      return 42;
    case "1y":
      return 52;
    case "5y":
      return 64;
    case "all":
      return 80;
    default:
      return 40;
  }
}

function parseYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = parseISO(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
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

function subsampleSortedYmd(dates: string[], maxPoints: number): string[] {
  if (dates.length <= maxPoints) return dates;
  const out: string[] = [];
  const n = dates.length;
  const step = (n - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(n - 1, Math.round(i * step));
    out.push(dates[idx]!);
  }
  return [...new Set(out)];
}

function calendarDatesInRange(fromYmd: string, toYmd: string, maxPoints: number): string[] {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return [];
  const from = minDate([a, b]);
  const to = maxDate([a, b]);
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);
  const step = Math.max(1, Math.ceil(days / maxPoints));
  const out: string[] = [];
  for (let i = 0; from.getTime() + i * step * 86400000 <= to.getTime(); i++) {
    out.push(ymd(addDays(from, i * step)));
  }
  if (out[out.length - 1] !== ymd(to)) out.push(ymd(to));
  return subsampleSortedYmd(out, maxPoints);
}

function rangeToFromTo(
  range: PortfolioChartRange,
  now: Date,
  firstTxYmd: string | null,
): { fromYmd: string; toYmd: string } {
  const toYmd = ymd(now);
  let fromD: Date;

  switch (range) {
    case "1d":
      fromD = subDays(now, 10);
      break;
    case "7d":
      fromD = subDays(now, 21);
      break;
    case "1m":
      fromD = subMonths(now, 1);
      break;
    case "6m":
      fromD = subMonths(now, 6);
      break;
    case "ytd":
      fromD = startOfYear(now);
      break;
    case "1y":
      fromD = subYears(now, 1);
      break;
    case "5y":
      fromD = subYears(now, 5);
      break;
    case "all": {
      const cap = subYears(now, 12);
      if (firstTxYmd) {
        const ft = parseYmd(firstTxYmd);
        fromD = ft ? maxDate([ft, cap]) : cap;
      } else {
        fromD = cap;
      }
      break;
    }
    default:
      fromD = subMonths(now, 1);
  }

  let fromYmd = ymd(fromD);
  if (firstTxYmd && fromYmd < firstTxYmd) fromYmd = firstTxYmd;
  if (fromYmd > toYmd) fromYmd = toYmd;
  return { fromYmd, toYmd };
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

function parseBodyTransactions(raw: unknown): PortfolioTransaction[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_TX) return null;
  const out: PortfolioTransaction[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const portfolioId = typeof o.portfolioId === "string" ? o.portfolioId : "";
    const kind = o.kind === "trade" || o.kind === "cash" || o.kind === "income" ? o.kind : null;
    const operation = typeof o.operation === "string" ? o.operation : "";
    const symbol = typeof o.symbol === "string" ? o.symbol : "";
    const name = typeof o.name === "string" ? o.name : "";
    const date = typeof o.date === "string" ? o.date : "";
    const shares = typeof o.shares === "number" && Number.isFinite(o.shares) ? o.shares : 0;
    const price = typeof o.price === "number" && Number.isFinite(o.price) ? o.price : 0;
    const fee = typeof o.fee === "number" && Number.isFinite(o.fee) ? o.fee : 0;
    const sum = typeof o.sum === "number" && Number.isFinite(o.sum) ? o.sum : 0;
    if (!id || !kind || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    out.push({
      id,
      portfolioId,
      kind,
      operation,
      symbol,
      name,
      logoUrl: typeof o.logoUrl === "string" || o.logoUrl === null ? (o.logoUrl as string | null) : null,
      date,
      shares,
      price,
      fee,
      sum,
      profitPct: null,
      profitUsd: null,
      holdingId: typeof o.holdingId === "string" ? o.holdingId : undefined,
    });
  }
  return out;
}

export async function computePortfolioValueHistory(
  range: PortfolioChartRange,
  transactions: PortfolioTransaction[],
): Promise<PortfolioValueHistoryPoint[]> {
  if (transactions.length === 0) return [];

  const firstTx = earliestTxYmd(transactions);
  const { fromYmd, toYmd } = rangeToFromTo(range, new Date(), firstTx);
  const maxPts = maxPointsForRange(range);
  const symbols = tradeSymbols(transactions);

  const barTasks = symbols.map(async (sym) => {
    const cryptoPair = toEodhdCryptoSymbol(sym);
    const bars =
      cryptoPair != null ?
        await fetchEodhdCryptoDailyBars(cryptoPair, fromYmd, toYmd)
      : await fetchEodhdEodDaily(toEodhdSymbol(sym), fromYmd, toYmd);
    return [sym, bars ?? []] as const;
  });

  const barPairs = await Promise.all(barTasks);
  const barsBySymbol = new Map<string, EodhdDailyBar[]>(barPairs);

  const dateSet = new Set<string>();
  for (const [, bars] of barPairs) {
    for (const b of bars) {
      if (b.date >= fromYmd && b.date <= toYmd) dateSet.add(b.date);
    }
  }

  let sampleDates =
    dateSet.size > 0 ?
      subsampleSortedYmd([...dateSet].sort((a, b) => a.localeCompare(b)), maxPts)
    : calendarDatesInRange(fromYmd, toYmd, maxPts);

  if (sampleDates.length === 0) sampleDates = [toYmd];
  const withBounds = [...new Set([fromYmd, ...sampleDates, toYmd])].sort((a, b) => a.localeCompare(b));
  sampleDates = subsampleSortedYmd(withBounds, maxPts);

  const points: PortfolioValueHistoryPoint[] = [];

  for (const d of sampleDates) {
    const holdings = replayTradeTransactionsToHoldingsUpTo(transactions, d);
    let equity = 0;
    let cost = 0;
    for (const h of holdings) {
      cost += h.costBasis;
      const bars = barsBySymbol.get(h.symbol.toUpperCase()) ?? [];
      const px = lastCloseOnOrBefore(bars, d);
      if (px != null && Number.isFinite(px) && h.shares > 0) {
        equity += h.shares * px;
      }
    }
    const cash = netCashUsdUpTo(transactions, d);
    const value = equity + cash;
    const profit = equity - cost;
    points.push({ t: d, value, profit });
  }

  return points;
}

export function parsePortfolioValueHistoryBody(body: unknown): {
  range: PortfolioChartRange;
  transactions: PortfolioTransaction[];
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const r = o.range;
  const range =
    r === "1d" || r === "7d" || r === "1m" || r === "6m" || r === "ytd" || r === "1y" || r === "5y" || r === "all" ?
      r
    : null;
  if (!range) return null;
  const transactions = parseBodyTransactions(o.transactions);
  if (transactions == null) return null;
  return { range, transactions };
}
