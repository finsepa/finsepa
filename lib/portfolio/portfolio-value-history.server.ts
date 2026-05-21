import "server-only";

import {
  addDays,
  addMonths,
  format,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

import type { PortfolioTransaction } from "@/components/portfolio/portfolio-types";
import { fetchEodhdCryptoDailyBars, toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdIntraday, type EodhdIntradayBar } from "@/lib/market/eodhd-intraday";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import {
  intradayBarsToTwoPerDaySamples,
  type IntradayTwoPerDaySample,
} from "@/lib/market/stock-chart-data";
import { netCashUsdUpTo, totalHistoricalEquityCostBasisAsOf } from "@/lib/portfolio/overview-metrics";
import type { PortfolioChartRange, PortfolioValueHistoryPoint } from "@/lib/portfolio/portfolio-chart-types";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";
import { cumulativeRealizedGainUsdUpTo } from "@/lib/portfolio/realized-pnl-from-trades";

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

function parseYmdToUnixSeconds(ymdStr: string): number | null {
  const t = Date.parse(`${ymdStr}T12:00:00.000Z`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

function lastIntradayCloseOnOrBefore(bars: EodhdIntradayBar[], ts: number): number | null {
  let lo = 0;
  let hi = bars.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid]!.timestamp <= ts) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? bars[ans]!.close : null;
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

/** One sample every 7 days (5Y chart); uses last trading day on or before each week anchor when bars exist. */
function oneSamplePerWeekInRange(
  fromYmd: string,
  toYmd: string,
  sortedTradingDates: readonly string[],
): string[] {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return [];
  const from = minDate([a, b]);
  const to = maxDate([a, b]);
  const trading = sortedTradingDates.filter((d) => d >= fromYmd && d <= toYmd);

  const pickForTarget = (target: string): string | null => {
    if (trading.length === 0) return target;
    let pick: string | null = null;
    for (const t of trading) {
      if (t <= target) pick = t;
      else break;
    }
    if (pick != null) return pick;
    return trading.find((t) => t >= target) ?? null;
  };

  const out: string[] = [];
  for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 7)) {
    const picked = pickForTarget(ymd(d));
    if (picked) out.push(picked);
  }
  return [...new Set([fromYmd, ...out, toYmd])].sort((x, y) => x.localeCompare(y));
}

/** One sample per calendar month (ALL chart); last trading day on or before month start when bars exist. */
function oneSamplePerMonthInRange(
  fromYmd: string,
  toYmd: string,
  sortedTradingDates: readonly string[],
): string[] {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return [];
  const from = minDate([a, b]);
  const to = maxDate([a, b]);
  const trading = sortedTradingDates.filter((d) => d >= fromYmd && d <= toYmd);

  const pickForTarget = (target: string): string | null => {
    if (trading.length === 0) return target;
    let pick: string | null = null;
    for (const t of trading) {
      if (t <= target) pick = t;
      else break;
    }
    if (pick != null) return pick;
    return trading.find((t) => t >= target) ?? null;
  };

  const out: string[] = [];
  for (let d = startOfMonth(from); d.getTime() <= to.getTime(); d = addMonths(d, 1)) {
    const picked = pickForTarget(ymd(d));
    if (picked) out.push(picked);
  }
  return [...new Set([fromYmd, ...out, toYmd])].sort((x, y) => x.localeCompare(y));
}

/** Every calendar day in range (1Y chart: one portfolio point per day). */
function everyCalendarDayInRange(fromYmd: string, toYmd: string): string[] {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  if (!a || !b) return [];
  const from = minDate([a, b]);
  const to = maxDate([a, b]);
  const out: string[] = [];
  for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) {
    out.push(ymd(d));
  }
  return out;
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

export function parseBodyTransactions(raw: unknown): PortfolioTransaction[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_TX) return null;
  const out: PortfolioTransaction[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const portfolioId = typeof o.portfolioId === "string" ? o.portfolioId : "";
    const kind =
      o.kind === "trade" || o.kind === "cash" || o.kind === "income" || o.kind === "expense" ? o.kind : null;
    const operation = typeof o.operation === "string" ? o.operation : "";
    const symbol = typeof o.symbol === "string" ? o.symbol : "";
    const name = typeof o.name === "string" ? o.name : "";
    const date = typeof o.date === "string" ? o.date : "";
    const shares = typeof o.shares === "number" && Number.isFinite(o.shares) ? o.shares : 0;
    const price = typeof o.price === "number" && Number.isFinite(o.price) ? o.price : 0;
    const fee = typeof o.fee === "number" && Number.isFinite(o.fee) ? o.fee : 0;
    const sum = typeof o.sum === "number" && Number.isFinite(o.sum) ? o.sum : 0;
    if (!id || !kind || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    let note: string | null | undefined;
    if (o.note === undefined) note = undefined;
    else if (o.note === null) note = null;
    else if (typeof o.note === "string") note = o.note;
    else note = undefined;

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
      ...(note !== undefined ? { note } : {}),
    });
  }
  return out;
}

async function fetchSymbolIntradayYtd(
  sym: string,
  ytdStartSec: number,
  nowSec: number,
): Promise<EodhdIntradayBar[] | null> {
  if (toEodhdCryptoSymbol(sym) != null) return null;
  const eodhd = toEodhdSymbol(sym);
  for (const interval of ["1h", "5m"] as const) {
    const bars = await fetchEodhdIntraday(eodhd, ytdStartSec, nowSec, interval);
    if (bars?.length) return bars;
  }
  return null;
}

function dailyYtdTwoPerDayFallback(fromYmd: string, toYmd: string): IntradayTwoPerDaySample[] {
  const dates = calendarDatesInRange(fromYmd, toYmd, 160);
  const out: IntradayTwoPerDaySample[] = [];
  for (const d of dates) {
    const base = parseYmdToUnixSeconds(d);
    if (base == null) continue;
    out.push({ time: base + 14 * 3600, sessionDate: d }, { time: base + 21 * 3600, sessionDate: d });
  }
  return out;
}

function portfolioPointAtSession(
  transactions: PortfolioTransaction[],
  sessionYmd: string,
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  intradayBySymbol: Map<string, EodhdIntradayBar[]>,
  markTs: number | null,
): PortfolioValueHistoryPoint {
  const holdings = replayTradeTransactionsToHoldingsUpTo(transactions, sessionYmd);
  let equity = 0;
  let cost = 0;
  for (const h of holdings) {
    cost += h.costBasis;
    const sym = h.symbol.toUpperCase();
    const intraday = intradayBySymbol.get(sym);
    const px =
      markTs != null && intraday?.length ?
        lastIntradayCloseOnOrBefore(intraday, markTs)
      : lastCloseOnOrBefore(barsBySymbol.get(sym) ?? [], sessionYmd);
    if (px != null && Number.isFinite(px) && h.shares > 0) {
      equity += h.shares * px;
    }
  }
  const cash = netCashUsdUpTo(transactions, sessionYmd);
  const value = equity + cash;
  const unrealized = equity - cost;
  const realized = cumulativeRealizedGainUsdUpTo(transactions, sessionYmd);
  const profit = unrealized + realized;
  const denom = totalHistoricalEquityCostBasisAsOf(cost, transactions, sessionYmd);
  const returnPct =
    Number.isFinite(denom) && denom > 0 && Number.isFinite(profit) ? (profit / denom) * 100 : null;
  return { t: sessionYmd, value, profit, returnPct };
}

async function computePortfolioValueHistoryYtd(
  transactions: PortfolioTransaction[],
  symbols: string[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  fromYmd: string,
  toYmd: string,
): Promise<PortfolioValueHistoryPoint[]> {
  const now = new Date();
  const nowSec = Math.floor(now.getTime() / 1000);
  const ytdStartSec = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);

  const intradayBySymbol = new Map<string, EodhdIntradayBar[]>();
  await Promise.all(
    symbols.map(async (sym) => {
      const bars = await fetchSymbolIntradayYtd(sym, ytdStartSec, nowSec);
      if (bars?.length) intradayBySymbol.set(sym.toUpperCase(), bars);
    }),
  );

  let samples: IntradayTwoPerDaySample[] = [];
  for (const sym of ["SPY", ...symbols]) {
    const bars = intradayBySymbol.get(sym.toUpperCase());
    if (!bars?.length) continue;
    const s = intradayBarsToTwoPerDaySamples(bars);
    if (s.length >= 4) {
      samples = s;
      break;
    }
  }
  if (samples.length < 4) {
    samples = dailyYtdTwoPerDayFallback(fromYmd, toYmd);
  }

  samples = samples.filter((s) => s.sessionDate >= fromYmd && s.sessionDate <= toYmd);
  if (samples.length === 0) return [];

  const points: PortfolioValueHistoryPoint[] = [];
  for (const sample of samples) {
    const base = portfolioPointAtSession(
      transactions,
      sample.sessionDate,
      barsBySymbol,
      intradayBySymbol,
      sample.time,
    );
    points.push({ ...base, time: sample.time });
  }
  return points;
}

export async function computePortfolioValueHistory(
  range: PortfolioChartRange,
  transactions: PortfolioTransaction[],
): Promise<PortfolioValueHistoryPoint[]> {
  if (transactions.length === 0) return [];

  const firstTx = earliestTxYmd(transactions);
  const now = new Date();
  const { fromYmd, toYmd } = rangeToFromTo(range, now, firstTx);
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

  if (range === "ytd") {
    return computePortfolioValueHistoryYtd(transactions, symbols, barsBySymbol, fromYmd, toYmd);
  }

  const dateSet = new Set<string>();
  for (const [, bars] of barPairs) {
    for (const b of bars) {
      if (b.date >= fromYmd && b.date <= toYmd) dateSet.add(b.date);
    }
  }

  let sampleDates: string[];
  if (range === "1y") {
    const trading =
      dateSet.size > 0 ?
        [...dateSet].filter((d) => d >= fromYmd && d <= toYmd).sort((a, b) => a.localeCompare(b))
      : everyCalendarDayInRange(fromYmd, toYmd);
    sampleDates = [...new Set([fromYmd, ...trading, toYmd])].sort((a, b) => a.localeCompare(b));
  } else if (range === "5y") {
    const trading = [...dateSet].sort((a, b) => a.localeCompare(b));
    sampleDates = oneSamplePerWeekInRange(fromYmd, toYmd, trading);
  } else if (range === "all") {
    const trading = [...dateSet].sort((a, b) => a.localeCompare(b));
    sampleDates = oneSamplePerMonthInRange(fromYmd, toYmd, trading);
  } else {
    sampleDates =
      dateSet.size > 0 ?
        subsampleSortedYmd([...dateSet].sort((a, b) => a.localeCompare(b)), maxPts)
      : calendarDatesInRange(fromYmd, toYmd, maxPts);
    if (sampleDates.length === 0) sampleDates = [toYmd];
    const withBounds = [...new Set([fromYmd, ...sampleDates, toYmd])].sort((a, b) => a.localeCompare(b));
    sampleDates = subsampleSortedYmd(withBounds, maxPts);
  }

  const points: PortfolioValueHistoryPoint[] = [];

  for (const d of sampleDates) {
    points.push(portfolioPointAtSession(transactions, d, barsBySymbol, new Map(), null));
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
