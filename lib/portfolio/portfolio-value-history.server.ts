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
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import { toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdIntraday, type EodhdIntradayBar } from "@/lib/market/eodhd-intraday";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import {
  intradayBarsToTwoPerDaySamples,
  minGapDownsampleChartPoints,
  ONE_MONTH_BAR_GAP_SEC,
  oneSamplePerMonthByKey,
  oneSamplePerWeekByKey,
  STOCK_1D_INTRADAY_CHART_BAR_GAP_SEC,
  usSessionMonthKeyFromUnixSeconds,
  usSessionWeekKeyFromUnixSeconds,
  usSessionYmdFromUnixSeconds,
  getStockChartPointsForApi,
  type IntradayTwoPerDaySample,
} from "@/lib/market/stock-chart-data";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { loadPortfolioEodBars } from "@/lib/portfolio/data/load-portfolio-eod-bars";
import { sessionMarkUsd } from "@/lib/portfolio/session-mark-price";
import { netCashUsdUpTo } from "@/lib/portfolio/overview-metrics";
import { effectiveSamplingRange } from "@/lib/portfolio/portfolio-chart-sampling";
import type { PortfolioChartRange, PortfolioValueHistoryPoint } from "@/lib/portfolio/portfolio-chart-types";
import { replayTradeTransactionsToHoldingsUpTo } from "@/lib/portfolio/rebuild-holdings-from-trades";
import { cumulativeRealizedGainUsdUpTo } from "@/lib/portfolio/realized-pnl-from-trades";
import {
  dietzReturnPctFromInceptionNav,
  portfolioNetWorthOnDate,
} from "@/lib/portfolio/returns/portfolio-nav.server";
import { portfolioPeriodReturnDietz } from "@/lib/portfolio/returns/portfolio-return-engine";

const MAX_TX = 4000;
/** Portfolio 1D/5D/1M bar spacing — 1D ~1m, 5D native 5m (BTC-style), 1M ~30m. */
const PORTFOLIO_1D_BAR_GAP_SEC = STOCK_1D_INTRADAY_CHART_BAR_GAP_SEC;
const PORTFOLIO_5D_BAR_GAP_SEC = 5 * 60;
const PORTFOLIO_1M_BAR_GAP_SEC = ONE_MONTH_BAR_GAP_SEC;
const PORTFOLIO_5D_CALENDAR_DAYS = 5;
/** Wider 5m lookback for 5D so weekends/holidays still resolve. */
const PORTFOLIO_5D_INTRADAY_LOOKBACK_SEC = 14 * 86400;

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
      fromD = subDays(now, 1);
      break;
    case "5d":
      fromD = subDays(now, PORTFOLIO_5D_CALENDAR_DAYS);
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

async function fetchSymbolIntraday1d(
  sym: string,
  fromSec: number,
  nowSec: number,
): Promise<EodhdIntradayBar[] | null> {
  const eodhd = toEodhdCryptoSymbol(sym) ?? toEodhdSymbol(sym);
  // One request per symbol — prefer native 1m (asset 1D cadence), then 5m fallback.
  for (const interval of ["1m", "5m"] as const) {
    const bars = await fetchEodhdIntraday(eodhd, fromSec, nowSec, interval);
    if (bars?.length) return bars;
  }
  return null;
}

async function fetchSymbolIntraday5d(
  sym: string,
  fromSec: number,
  nowSec: number,
): Promise<EodhdIntradayBar[] | null> {
  const eodhd = toEodhdCryptoSymbol(sym) ?? toEodhdSymbol(sym);
  const fetchFrom = Math.min(fromSec, nowSec - PORTFOLIO_5D_INTRADAY_LOOKBACK_SEC);
  // One request per symbol — native 5m like BTC 1D/5D; hourly only if 5m is empty.
  for (const interval of ["5m", "1h"] as const) {
    const bars = await fetchEodhdIntraday(eodhd, fetchFrom, nowSec, interval);
    if (!bars?.length) continue;
    const clipped = bars.filter((b) => b.timestamp >= fromSec && b.timestamp <= nowSec);
    if (clipped.length) return clipped;
  }
  return null;
}

/** Downsample union timestamps to asset-style min-gap spacing (1m for 1D, 5m for 5D). */
function minGapDownsampleUnixTimes(times: number[], minGapSec: number): number[] {
  if (times.length === 0) return [];
  const stub: StockChartPoint[] = times.map((t) => ({
    time: t,
    value: 0,
    sessionDate: usSessionYmdFromUnixSeconds(t),
  }));
  return minGapDownsampleChartPoints(stub, minGapSec).map((p) => p.time);
}

function isUsRegularSessionUnix(ts: number): boolean {
  if (!Number.isFinite(ts)) return false;
  const sessionYmd = usSessionYmdFromUnixSeconds(ts);
  const open = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const close = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  return ts >= open && ts <= close;
}

async function computePortfolioValueHistory5d(
  transactions: PortfolioTransaction[],
  symbols: string[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  firstTxYmd: string | null,
  now: Date,
): Promise<PortfolioValueHistoryPoint[]> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const fromSec = nowSec - PORTFOLIO_5D_CALENDAR_DAYS * 86400;
  const fromYmd = usSessionYmdFromUnixSeconds(fromSec);
  const toYmd = usSessionYmdFromUnixSeconds(nowSec);

  const intradayBySymbol = new Map<string, EodhdIntradayBar[]>();
  await Promise.all(
    symbols.map(async (sym) => {
      const bars = await fetchSymbolIntraday5d(sym, fromSec, nowSec);
      if (bars?.length) intradayBySymbol.set(sym.toUpperCase(), bars);
    }),
  );

  const tsSet = new Set<number>();
  for (const bars of intradayBySymbol.values()) {
    for (const b of bars) {
      if (b.timestamp >= fromSec && b.timestamp <= nowSec) tsSet.add(b.timestamp);
    }
  }
  let times = minGapDownsampleUnixTimes([...tsSet].sort((a, b) => a - b), PORTFOLIO_5D_BAR_GAP_SEC);

  if (times.length < 3) {
    const eodDates =
      [...barsBySymbol.values()]
        .flatMap((bars) => bars.map((b) => b.date))
        .filter((d) => d >= fromYmd && d <= toYmd)
        .sort((a, b) => a.localeCompare(b));
    const unique = [...new Set(eodDates)];
    times = unique.flatMap((d) => {
      const base = parseYmdToUnixSeconds(d);
      return base == null ? [] : [base];
    });
  }

  if (times.length === 0) return [];

  const points: PortfolioValueHistoryPoint[] = [];
  for (const ts of times) {
    const sessionDate = usSessionYmdFromUnixSeconds(ts);
    const hasIntraday = intradayBySymbol.size > 0;
    const base = portfolioPointAtSession(
      transactions,
      sessionDate,
      barsBySymbol,
      hasIntraday ? intradayBySymbol : new Map(),
      hasIntraday ? ts : null,
      firstTxYmd,
    );
    points.push({ ...base, time: ts });
  }
  return points;
}

async function computePortfolioValueHistory1d(
  transactions: PortfolioTransaction[],
  symbols: string[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  firstTxYmd: string | null,
  now: Date,
): Promise<PortfolioValueHistoryPoint[]> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const fromSec = nowSec - 24 * 3600;
  const fromYmd = ymd(new Date(fromSec * 1000));
  const toYmd = ymd(now);

  const intradayBySymbol = new Map<string, EodhdIntradayBar[]>();
  await Promise.all(
    symbols.map(async (sym) => {
      const bars = await fetchSymbolIntraday1d(sym, fromSec, nowSec);
      if (bars?.length) intradayBySymbol.set(sym.toUpperCase(), bars);
    }),
  );

  const tsSet = new Set<number>();
  for (const bars of intradayBySymbol.values()) {
    for (const b of bars) {
      if (b.timestamp >= fromSec && b.timestamp <= nowSec) tsSet.add(b.timestamp);
    }
  }
  let times = minGapDownsampleUnixTimes([...tsSet].sort((a, b) => a - b), PORTFOLIO_1D_BAR_GAP_SEC);

  if (times.length < 3) {
    const eodDates =
      [...barsBySymbol.values()]
        .flatMap((bars) => bars.map((b) => b.date))
        .filter((d) => d >= fromYmd && d <= toYmd)
        .sort((a, b) => a.localeCompare(b));
    const unique = [...new Set(eodDates)];
    times = unique.flatMap((d) => {
      const base = parseYmdToUnixSeconds(d);
      return base == null ? [] : [base];
    });
  }

  if (times.length === 0) return [];

  const points: PortfolioValueHistoryPoint[] = [];
  for (const ts of times) {
    const sessionDate = usSessionYmdFromUnixSeconds(ts);
    const hasIntraday = intradayBySymbol.size > 0;
    const base = portfolioPointAtSession(
      transactions,
      sessionDate,
      barsBySymbol,
      hasIntraday ? intradayBySymbol : new Map(),
      hasIntraday ? ts : null,
      firstTxYmd,
    );
    points.push({ ...base, time: ts });
  }
  return points;
}

/** Asset 1M clock (~30m). One SPY series — not N× 5m/1m holding fan-out. */
async function fetchPortfolio1mClockTimes(fromSec: number, nowSec: number): Promise<number[]> {
  try {
    const clock = await getStockChartPointsForApi("SPY", "1M", "price");
    const times = clock
      .map((p) => p.time)
      .filter((t) => Number.isFinite(t) && t >= fromSec && t <= nowSec)
      .sort((a, b) => a - b);
    if (times.length >= 18) return times;
  } catch {
    /* fall through */
  }
  return [];
}

/** One request per symbol — 1h bars (6M / YTD / 1Y samples, and 1M holding marks). */
async function fetchSymbolIntradayHourly(
  sym: string,
  fromSec: number,
  nowSec: number,
): Promise<EodhdIntradayBar[] | null> {
  const eodhd = toEodhdCryptoSymbol(sym) ?? toEodhdSymbol(sym);
  const fetchFrom = fromSec - 14 * 86400;
  const bars = await fetchEodhdIntraday(eodhd, fetchFrom, nowSec, "1h");
  if (!bars?.length) return null;
  const clipped = bars.filter((b) => b.timestamp >= fromSec && b.timestamp <= nowSec);
  return clipped.length ? clipped : null;
}

function dailyTwoPerDayFallback(fromYmd: string, toYmd: string): IntradayTwoPerDaySample[] {
  const dates = calendarDatesInRange(fromYmd, toYmd, 160);
  const out: IntradayTwoPerDaySample[] = [];
  for (const d of dates) {
    const base = parseYmdToUnixSeconds(d);
    if (base == null) continue;
    out.push({ time: base + 14 * 3600, sessionDate: d }, { time: base + 21 * 3600, sessionDate: d });
  }
  return out;
}

async function resolvePortfolioTwoPerDaySamples(
  symbols: string[],
  fromYmd: string,
  toYmd: string,
  fromSec: number,
  nowSec: number,
  minSamples: number,
): Promise<{ samples: IntradayTwoPerDaySample[]; intradayBySymbol: Map<string, EodhdIntradayBar[]> }> {
  const intradayBySymbol = new Map<string, EodhdIntradayBar[]>();
  await Promise.all(
    symbols.map(async (sym) => {
      const bars = await fetchSymbolIntradayHourly(sym, fromSec, nowSec);
      if (bars?.length) intradayBySymbol.set(sym.toUpperCase(), bars);
    }),
  );

  let samples: IntradayTwoPerDaySample[] = [];
  for (const sym of ["SPY", ...symbols]) {
    const bars = intradayBySymbol.get(sym.toUpperCase());
    if (!bars?.length) continue;
    const s = intradayBarsToTwoPerDaySamples(bars);
    if (s.length >= minSamples) {
      samples = s;
      break;
    }
  }
  if (samples.length < minSamples) {
    samples = dailyTwoPerDayFallback(fromYmd, toYmd);
  }
  samples = samples.filter((s) => s.sessionDate >= fromYmd && s.sessionDate <= toYmd);
  return { samples, intradayBySymbol };
}

function portfolioPointsFromTwoPerDaySamples(
  samples: readonly IntradayTwoPerDaySample[],
  transactions: PortfolioTransaction[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  intradayBySymbol: Map<string, EodhdIntradayBar[]>,
  firstTxYmd: string | null,
): PortfolioValueHistoryPoint[] {
  const points: PortfolioValueHistoryPoint[] = [];
  for (const sample of samples) {
    const base = portfolioPointAtSession(
      transactions,
      sample.sessionDate,
      barsBySymbol,
      intradayBySymbol,
      sample.time,
      firstTxYmd,
    );
    points.push({ ...base, time: sample.time });
  }
  return points;
}

async function computePortfolioValueHistory1m(
  transactions: PortfolioTransaction[],
  symbols: string[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  fromYmd: string,
  toYmd: string,
  firstTxYmd: string | null,
  now: Date,
): Promise<PortfolioValueHistoryPoint[]> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const fromDt = parseYmd(fromYmd);
  const fromSec = fromDt ? Math.floor(fromDt.getTime() / 1000) : nowSec - 31 * 86400;

  const [clockTimes, hourlyPairs] = await Promise.all([
    fetchPortfolio1mClockTimes(fromSec, nowSec),
    Promise.all(
      symbols.map(async (sym) => {
        const bars = await fetchSymbolIntradayHourly(sym, fromSec, nowSec);
        return [sym.toUpperCase(), bars] as const;
      }),
    ),
  ]);

  const intradayBySymbol = new Map<string, EodhdIntradayBar[]>();
  for (const [sym, bars] of hourlyPairs) {
    if (bars?.length) intradayBySymbol.set(sym, bars);
  }

  let times = clockTimes;
  if (times.length < 18) {
    const tsSet = new Set<number>();
    for (const bars of intradayBySymbol.values()) {
      for (const b of bars) {
        if (b.timestamp >= fromSec && b.timestamp <= nowSec) tsSet.add(b.timestamp);
      }
    }
    const rthTimes = [...tsSet].filter(isUsRegularSessionUnix);
    times = minGapDownsampleUnixTimes(
      (rthTimes.length >= 18 ? rthTimes : [...tsSet]).sort((a, b) => a - b),
      PORTFOLIO_1M_BAR_GAP_SEC,
    );
  }

  if (times.length < 18) {
    const eodDates =
      [...barsBySymbol.values()]
        .flatMap((bars) => bars.map((b) => b.date))
        .filter((d) => d >= fromYmd && d <= toYmd)
        .sort((a, b) => a.localeCompare(b));
    const unique = [...new Set(eodDates)];
    times = unique.flatMap((d) => {
      const base = parseYmdToUnixSeconds(d);
      return base == null ? [] : [base];
    });
  }

  if (times.length === 0) return [];

  const points: PortfolioValueHistoryPoint[] = [];
  for (const ts of times) {
    const sessionDate = usSessionYmdFromUnixSeconds(ts);
    const hasIntraday = intradayBySymbol.size > 0;
    const base = portfolioPointAtSession(
      transactions,
      sessionDate,
      barsBySymbol,
      hasIntraday ? intradayBySymbol : new Map(),
      hasIntraday ? ts : null,
      firstTxYmd,
    );
    points.push({ ...base, time: ts });
  }
  return points;
}

async function computePortfolioValueHistoryTwoPerDay(
  transactions: PortfolioTransaction[],
  symbols: string[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  fromYmd: string,
  toYmd: string,
  fromSec: number,
  firstTxYmd: string | null,
  now: Date,
  minSamples: number,
): Promise<PortfolioValueHistoryPoint[]> {
  const nowSec = Math.floor(now.getTime() / 1000);
  const { samples, intradayBySymbol } = await resolvePortfolioTwoPerDaySamples(
    symbols,
    fromYmd,
    toYmd,
    fromSec,
    nowSec,
    minSamples,
  );
  if (samples.length === 0) return [];
  return portfolioPointsFromTwoPerDaySamples(
    samples,
    transactions,
    barsBySymbol,
    intradayBySymbol,
    firstTxYmd,
  );
}

function oneSamplePerWeekFromTradingYmd(
  trading: readonly string[],
  fromYmd: string,
  toYmd: string,
): string[] {
  if (trading.length === 0) {
    return [...new Set([fromYmd, toYmd])].sort((a, b) => a.localeCompare(b));
  }
  const stubs: StockChartPoint[] = trading
    .map((d) => {
      const time = parseYmdToUnixSeconds(d);
      return time == null ? null : ({ time, value: 0, sessionDate: d } satisfies StockChartPoint);
    })
    .filter(Boolean) as StockChartPoint[];
  const sampled = oneSamplePerWeekByKey(stubs, (p) => usSessionWeekKeyFromUnixSeconds(p.time));
  const dates = sampled.map((p) => p.sessionDate!).filter(Boolean);
  return [...new Set([fromYmd, ...dates, toYmd])].sort((a, b) => a.localeCompare(b));
}

function oneSamplePerMonthFromTradingYmd(
  trading: readonly string[],
  fromYmd: string,
  toYmd: string,
): string[] {
  if (trading.length === 0) {
    return [...new Set([fromYmd, toYmd])].sort((a, b) => a.localeCompare(b));
  }
  const stubs: StockChartPoint[] = trading
    .map((d) => {
      const time = parseYmdToUnixSeconds(d);
      return time == null ? null : ({ time, value: 0, sessionDate: d } satisfies StockChartPoint);
    })
    .filter(Boolean) as StockChartPoint[];
  const sampled = oneSamplePerMonthByKey(stubs, (p) => usSessionMonthKeyFromUnixSeconds(p.time));
  const dates = sampled.map((p) => p.sessionDate!).filter(Boolean);
  return [...new Set([fromYmd, ...dates, toYmd])].sort((a, b) => a.localeCompare(b));
}


function returnWindowForChartRange(
  range: PortfolioChartRange,
  now: Date,
  firstTxYmd: string | null,
): { startYmd: string; vStartZero: boolean } {
  if (range === "all") {
    const first = firstTxYmd ?? ymd(now);
    const firstDt = parseYmd(first);
    return {
      startYmd: firstDt ? ymd(subDays(firstDt, 1)) : first,
      vStartZero: true,
    };
  }

  let start: string;
  switch (range) {
    case "1d":
      start = ymd(subDays(now, 1));
      break;
    case "5d":
      start = ymd(subDays(now, PORTFOLIO_5D_CALENDAR_DAYS));
      break;
    case "1m":
      start = ymd(subMonths(now, 1));
      break;
    case "6m":
      start = ymd(subMonths(now, 6));
      break;
    case "ytd":
      start = ymd(startOfYear(now));
      break;
    case "1y":
      start = ymd(subYears(now, 1));
      break;
    case "5y":
      start = ymd(subYears(now, 5));
      break;
    default:
      start = ymd(subMonths(now, 1));
  }

  // Match dietz-periods: if the window starts before first activity, use inception Dietz.
  if (firstTxYmd && start < firstTxYmd) {
    const firstDt = parseYmd(firstTxYmd);
    return {
      startYmd: firstDt ? ymd(subDays(firstDt, 1)) : firstTxYmd,
      vStartZero: true,
    };
  }
  return { startYmd: start, vStartZero: false };
}

/**
 * Stamps range-relative Return % and Total profit $ on history points.
 * - Period ranges (6M, 1Y, …): Modified Dietz from window start through each sample
 *   (`gainUsd` / `pct`) — same definition as Overview Total profit cards / dietz-returns.
 * - ALL (or window before first activity): keep inception equity P/L from point build;
 *   ensure returnPct is inception Dietz.
 */
function applyRangeReturnPcts(
  points: PortfolioValueHistoryPoint[],
  transactions: PortfolioTransaction[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  range: PortfolioChartRange,
  now: Date,
  firstTxYmd: string | null,
): PortfolioValueHistoryPoint[] {
  if (points.length === 0) return points;

  const { startYmd: windowStart, vStartZero } = returnWindowForChartRange(range, now, firstTxYmd);

  if (vStartZero) {
    // Inception Dietz — profit already lifetime equity P/L from portfolioPointAtSession.
    return points.map((p) => {
      if (p.returnPct != null) return p;
      if (!firstTxYmd || p.t < firstTxYmd) return { ...p, returnPct: null };
      return {
        ...p,
        returnPct: dietzReturnPctFromInceptionNav({
          transactions,
          firstTxYmd,
          asOfYmd: p.t,
          vEnd: p.value,
        }),
      };
    });
  }

  // Match `/api/portfolio/dietz-returns`: V_B on the session on/before day before window start.
  const windowStartDt = parseYmd(windowStart);
  const d0 = windowStartDt ? ymd(subDays(windowStartDt, 1)) : windowStart;
  const vStart = portfolioNetWorthOnDate(transactions, barsBySymbol, d0);
  return points.map((p) => {
    if (p.t <= d0) {
      return { ...p, returnPct: 0, profit: 0 };
    }
    const period = portfolioPeriodReturnDietz({
      transactions,
      vStart,
      vEnd: p.value,
      startYmd: d0,
      endYmd: p.t,
    });
    return {
      ...p,
      returnPct: period.pct,
      // Prefer Dietz period gain; fall back to prior equity P/L only if gain is unavailable.
      profit:
        period.gainUsd != null && Number.isFinite(period.gainUsd) ? period.gainUsd : p.profit,
    };
  });
}

function portfolioPointAtSession(
  transactions: PortfolioTransaction[],
  sessionYmd: string,
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  intradayBySymbol: Map<string, EodhdIntradayBar[]>,
  markTs: number | null,
  firstTxYmd: string | null,
): PortfolioValueHistoryPoint {
  const holdings = replayTradeTransactionsToHoldingsUpTo(transactions, sessionYmd);
  let equity = 0;
  let cost = 0;
  for (const h of holdings) {
    cost += h.costBasis;
    const sym = h.symbol.toUpperCase();
    const bars = barsBySymbol.get(sym) ?? [];
    const intraday = intradayBySymbol.get(sym);
    const eodPx = lastCloseOnOrBefore(bars, sessionYmd);
    const intraPx =
      markTs != null && intraday?.length ? lastIntradayCloseOnOrBefore(intraday, markTs) : null;
    const px = sessionMarkUsd(intraPx, eodPx);
    if (px != null && Number.isFinite(px) && h.shares > 0) {
      equity += h.shares * px;
    }
  }
  const cash = netCashUsdUpTo(transactions, sessionYmd);
  const value = equity + cash;
  const unrealized = equity - cost;
  const realized = cumulativeRealizedGainUsdUpTo(transactions, sessionYmd);
  /** Lifetime equity P/L as-of session; period ranges rewrite `profit` in `applyRangeReturnPcts`. */
  const profit = unrealized + realized;
  /** Inception Dietz; period ranges overwrite returnPct in `applyRangeReturnPcts`. */
  const returnPct =
    firstTxYmd != null && sessionYmd >= firstTxYmd ?
      dietzReturnPctFromInceptionNav({
        transactions,
        firstTxYmd,
        asOfYmd: sessionYmd,
        vEnd: value,
      })
    : null;
  return { t: sessionYmd, value, profit, returnPct };
}

async function computePortfolioValueHistoryYtd(
  transactions: PortfolioTransaction[],
  symbols: string[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  fromYmd: string,
  toYmd: string,
  firstTxYmd: string | null,
): Promise<PortfolioValueHistoryPoint[]> {
  const now = new Date();
  const ytdStartSec = Math.floor(Date.UTC(now.getUTCFullYear(), 0, 1) / 1000);
  return computePortfolioValueHistoryTwoPerDay(
    transactions,
    symbols,
    barsBySymbol,
    fromYmd,
    toYmd,
    ytdStartSec,
    firstTxYmd,
    now,
    4,
  );
}

function finalizePortfolioHistoryPoints(
  points: PortfolioValueHistoryPoint[],
  transactions: PortfolioTransaction[],
  barsBySymbol: Map<string, EodhdDailyBar[]>,
  range: PortfolioChartRange,
  now: Date,
  toYmd: string,
  firstTx: string | null,
): PortfolioValueHistoryPoint[] {
  const withReturns = applyRangeReturnPcts(points, transactions, barsBySymbol, range, now, firstTx);
  if (withReturns.length === 0 && transactions.length > 0) {
    return [portfolioPointAtSession(transactions, toYmd, barsBySymbol, new Map(), null, firstTx)];
  }
  return withReturns;
}

export async function computePortfolioValueHistory(
  range: PortfolioChartRange,
  transactions: PortfolioTransaction[],
): Promise<PortfolioValueHistoryPoint[]> {
  if (transactions.length === 0) return [];

  const firstTx = earliestTxYmd(transactions);
  const now = new Date();
  const { fromYmd, toYmd } = rangeToFromTo(range, now, firstTx);
  // Pad bar fetch so Dietz V_B (day before period start) has marks — same as dietz-returns.
  const { startYmd: returnWindowStart } = returnWindowForChartRange(range, now, firstTx);
  const returnStartDt = parseYmd(returnWindowStart);
  const barFromYmd = ymd(
    minDate([
      parseYmd(fromYmd) ?? now,
      returnStartDt ? subDays(returnStartDt, 14) : now,
    ]),
  );
  // Dietz still uses `range`. Sampling follows how long the clamped window actually is
  // (young ALL/5Y inherit 1D/5D/1Y cadence instead of weekly).
  const samplingRange = effectiveSamplingRange(range, fromYmd, toYmd);
  const symbols = tradeSymbols(transactions);

  const barsBySymbol = await loadPortfolioEodBars(symbols, barFromYmd, toYmd);
  const nowSec = Math.floor(now.getTime() / 1000);

  if (samplingRange === "1d") {
    return finalizePortfolioHistoryPoints(
      await computePortfolioValueHistory1d(transactions, symbols, barsBySymbol, firstTx, now),
      transactions,
      barsBySymbol,
      range,
      now,
      toYmd,
      firstTx,
    );
  }

  if (samplingRange === "5d") {
    return finalizePortfolioHistoryPoints(
      await computePortfolioValueHistory5d(transactions, symbols, barsBySymbol, firstTx, now),
      transactions,
      barsBySymbol,
      range,
      now,
      toYmd,
      firstTx,
    );
  }

  if (range === "ytd") {
    return finalizePortfolioHistoryPoints(
      await computePortfolioValueHistoryYtd(transactions, symbols, barsBySymbol, fromYmd, toYmd, firstTx),
      transactions,
      barsBySymbol,
      range,
      now,
      toYmd,
      firstTx,
    );
  }

  if (samplingRange === "1m") {
    return finalizePortfolioHistoryPoints(
      await computePortfolioValueHistory1m(
        transactions,
        symbols,
        barsBySymbol,
        fromYmd,
        toYmd,
        firstTx,
        now,
      ),
      transactions,
      barsBySymbol,
      range,
      now,
      toYmd,
      firstTx,
    );
  }

  if (samplingRange === "6m") {
    const fromDt = parseYmd(fromYmd);
    const fromSec = fromDt ? Math.floor(fromDt.getTime() / 1000) : nowSec - 183 * 86400;
    return finalizePortfolioHistoryPoints(
      await computePortfolioValueHistoryTwoPerDay(
        transactions,
        symbols,
        barsBySymbol,
        fromYmd,
        toYmd,
        fromSec,
        firstTx,
        now,
        40,
      ),
      transactions,
      barsBySymbol,
      range,
      now,
      toYmd,
      firstTx,
    );
  }

  if (samplingRange === "1y") {
    const fromDt = parseYmd(fromYmd);
    const fromSec = fromDt ? Math.floor(fromDt.getTime() / 1000) : nowSec - 365 * 86400;
    return finalizePortfolioHistoryPoints(
      await computePortfolioValueHistoryTwoPerDay(
        transactions,
        symbols,
        barsBySymbol,
        fromYmd,
        toYmd,
        fromSec,
        firstTx,
        now,
        40,
      ),
      transactions,
      barsBySymbol,
      range,
      now,
      toYmd,
      firstTx,
    );
  }

  const dateSet = new Set<string>();
  for (const [, bars] of barsBySymbol.entries()) {
    for (const b of bars) {
      if (b.date >= fromYmd && b.date <= toYmd) dateSet.add(b.date);
    }
  }
  const trading = [...dateSet].filter((d) => d >= fromYmd && d <= toYmd).sort((a, b) => a.localeCompare(b));
  const sampleDates =
    samplingRange === "5y"
      ? oneSamplePerWeekFromTradingYmd(trading, fromYmd, toYmd)
      : oneSamplePerMonthFromTradingYmd(trading, fromYmd, toYmd);

  const points: PortfolioValueHistoryPoint[] = [];
  for (const d of sampleDates) {
    points.push(portfolioPointAtSession(transactions, d, barsBySymbol, new Map(), null, firstTx));
  }

  return finalizePortfolioHistoryPoints(points, transactions, barsBySymbol, range, now, toYmd, firstTx);
}

export function parsePortfolioValueHistoryBody(body: unknown): {
  range: PortfolioChartRange;
  transactions: PortfolioTransaction[];
} | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const r = o.range;
  let range: PortfolioChartRange | null = null;
  if (r === "7d") range = "5d";
  else if (
    r === "1d" ||
    r === "5d" ||
    r === "1m" ||
    r === "6m" ||
    r === "ytd" ||
    r === "1y" ||
    r === "5y" ||
    r === "all"
  ) {
    range = r;
  }
  if (!range) return null;
  const transactions = parseBodyTransactions(o.transactions);
  if (transactions == null) return null;
  return { range, transactions };
}
