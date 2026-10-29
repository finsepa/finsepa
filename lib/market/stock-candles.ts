import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT, REVALIDATE_STATIC, REVALIDATE_WARM_LONG } from "@/lib/data/cache-policy";
import { isEodhdUsRealtimeFromTodaySession } from "@/lib/market/eodhd-live-quote-freshness";
import {
  fetchEodhdDailyOhlc,
  fetchEodhdIntradayOhlc,
  type DailyOhlcBar,
  type OhlcBar,
} from "@/lib/market/eodhd-ohlc";
import { fetchEodhdUsRealtime } from "@/lib/market/eodhd-realtime";
import { getStockChartPointsForApi } from "@/lib/market/stock-chart-data";
import type { StockChartRange } from "@/lib/market/stock-chart-types";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

export type StockCandleInterval = "5m" | "30m" | "1d" | "1w" | "1mo";

export type StockCandlesResponse = {
  ticker: string;
  range: StockChartRange;
  interval: StockCandleInterval;
  candles: OhlcBar[];
  /** US regular or post-market session — today's candles are still forming; clients refresh ~1/min. */
  live: boolean;
};

const US_REGULAR_OPEN_MIN = 9 * 60 + 30;
const US_REGULAR_CLOSE_MIN = 16 * 60;
const RECENT_DAILY_YEARS = 6;
/** EODHD finalizes US intraday bars 2–3h after after-hours end (20:00 ET). */
const INTRADAY_FINALIZED_HOUR_ET = 23;

const nyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function nyYmdAndMinutes(sec: number): { ymd: string; minutes: number } {
  const parts = nyFormatter.formatToParts(new Date(sec * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftYmd(ymd: string, { years = 0, months = 0 }: { years?: number; months?: number }): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years, d.getUTCMonth() + months);
  return utcYmd(d);
}

/** Merge consecutive bars sharing a group key into one candle (time = first bar's time). */
function aggregateBy<T extends OhlcBar>(bars: readonly T[], keyOf: (bar: T) => string): OhlcBar[] {
  const out: OhlcBar[] = [];
  let currentKey: string | null = null;
  for (const bar of bars) {
    const key = keyOf(bar);
    const last = out[out.length - 1];
    if (key === currentKey && last) {
      last.high = Math.max(last.high, bar.high);
      last.low = Math.min(last.low, bar.low);
      last.close = bar.close;
      if (bar.volume != null) last.volume = (last.volume ?? 0) + bar.volume;
    } else {
      out.push({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
      currentKey = key;
    }
  }
  return out;
}

function weekKey(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return utcYmd(d);
}

/**
 * Finalized EODHD 5m bars. `epoch` flips once a day after {@link INTRADAY_FINALIZED_HOUR_ET} ET, so each stock costs one
 * intraday request per day; the forming session comes from the live 1D pipeline instead.
 */
const getFinalizedIntraday5mBars = unstable_cache(
  async (symbol: string, _epoch: string): Promise<OhlcBar[]> => {
    const nowSec = Math.floor(Date.now() / 1000);
    return (await fetchEodhdIntradayOhlc(symbol, nowSec - 12 * 86400, nowSec, "5m")) ?? [];
  },
  ["stock-candles-intraday-5m-v3"],
  { revalidate: REVALIDATE_STATIC },
);

function intradayEpoch(nowSec: number): string {
  return nyYmdAndMinutes(nowSec - INTRADAY_FINALIZED_HOUR_ET * 3600).ymd;
}

/** Today's forming daily candle from one shared realtime quote (regular / post session only). */
const getTodayRealtimeDailyCandle = unstable_cache(
  async (symbol: string): Promise<DailyOhlcBar | null> => {
    const rt = await fetchEodhdUsRealtime(symbol);
    if (!rt || !isEodhdUsRealtimeFromTodaySession(rt) || typeof rt.timestamp !== "number") return null;
    const { open, high, low, close } = rt;
    if (![open, high, low, close].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0)) return null;
    const date = nyYmdAndMinutes(rt.timestamp).ymd;
    return {
      date,
      time: Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000),
      open: open!,
      high: Math.max(high!, open!, close!),
      low: Math.min(low!, open!, close!),
      close: close!,
      volume: typeof rt.volume === "number" && Number.isFinite(rt.volume) && rt.volume >= 0 ? rt.volume : undefined,
    };
  },
  ["stock-candles-today-realtime-v2"],
  { revalidate: REVALIDATE_HOT },
);

/** 5m candles for the most recent session from the stock page's 1D line series (live minute store for allowlisted tickers). */
async function latestSessionCandlesFromLineChart(symbol: string): Promise<{ ymd: string; bars: OhlcBar[] } | null> {
  const points = await getStockChartPointsForApi(symbol, "1D", "price");
  const rows: (OhlcBar & { ymd: string; bucket: number })[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    const time = Math.floor(p.time / 60) * 60;
    const { ymd, minutes } = nyYmdAndMinutes(time);
    if (minutes < US_REGULAR_OPEN_MIN || minutes >= US_REGULAR_CLOSE_MIN) continue;
    const bucket = US_REGULAR_OPEN_MIN + Math.floor((minutes - US_REGULAR_OPEN_MIN) / 5) * 5;
    rows.push({ ymd, bucket, time: time - (minutes - bucket) * 60, open: p.value, high: p.value, low: p.value, close: p.value });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => a.time - b.time);
  const ymd = rows[rows.length - 1]!.ymd;
  return { ymd, bars: aggregateBy(rows.filter((r) => r.ymd === ymd), (r) => `${r.bucket}`) };
}

const getRecentDailyBars = unstable_cache(
  async (symbol: string): Promise<DailyOhlcBar[]> => {
    const today = utcYmd(new Date());
    return (await fetchEodhdDailyOhlc(symbol, shiftYmd(today, { years: -RECENT_DAILY_YEARS }), today)) ?? [];
  },
  ["stock-candles-daily-recent-v2"],
  { revalidate: REVALIDATE_WARM_LONG },
);

/** Full history stored as monthly candles — keeps the cache entry small for decades-old listings. */
const getAllTimeMonthlyCandles = unstable_cache(
  async (symbol: string): Promise<(OhlcBar & { month: string })[]> => {
    const bars = (await fetchEodhdDailyOhlc(symbol, "1900-01-01", utcYmd(new Date()))) ?? [];
    const monthly = aggregateBy(bars, (b) => b.date.slice(0, 7));
    return monthly.map((c) => ({ ...c, month: utcYmd(new Date(c.time * 1000)).slice(0, 7) }));
  },
  ["stock-candles-monthly-all-v2"],
  { revalidate: REVALIDATE_STATIC },
);

/**
 * EODHD intraday volume carries sporadic bogus prints (single 5m bars at 30–60× a normal bar; a day's bars summing to
 * 3–7× the consolidated daily volume). Bars far above the session median are left without volume instead.
 */
const INTRADAY_VOLUME_OUTLIER_MULTIPLE = 20;

function dropIntradayVolumeOutliers(bars: OhlcBar[]): OhlcBar[] {
  const volumes = bars.map((b) => b.volume).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  if (volumes.length < 10) return bars;
  const median = volumes[Math.floor(volumes.length / 2)]!;
  const cap = median * INTRADAY_VOLUME_OUTLIER_MULTIPLE;
  return bars.map((b) => (b.volume != null && b.volume > cap ? { ...b, volume: undefined } : b));
}

function regularSessionBarsByDay(bars: readonly OhlcBar[]): Map<string, { bar: OhlcBar; minutes: number }[]> {
  const byDay = new Map<string, { bar: OhlcBar; minutes: number }[]>();
  for (const bar of bars) {
    const { ymd, minutes } = nyYmdAndMinutes(bar.time);
    if (minutes < US_REGULAR_OPEN_MIN || minutes >= US_REGULAR_CLOSE_MIN) continue;
    const list = byDay.get(ymd);
    if (list) list.push({ bar, minutes });
    else byDay.set(ymd, [{ bar, minutes }]);
  }
  return byDay;
}

export async function loadStockCandles(ticker: string, range: StockChartRange): Promise<StockCandlesResponse> {
  const symbol = ticker.trim().toUpperCase();
  const now = new Date();
  const session = getUsEquityMarketSession(now);
  const live = session === "regular" || session === "post";

  if (range === "1D" || range === "5D") {
    const nowSec = Math.floor(now.getTime() / 1000);
    const [finalized, latest] = await Promise.all([
      getFinalizedIntraday5mBars(symbol, intradayEpoch(nowSec)),
      latestSessionCandlesFromLineChart(symbol),
    ]);
    const byDay = new Map<string, OhlcBar[]>(
      [...regularSessionBarsByDay(finalized)].map(([ymd, rows]) => [ymd, dropIntradayVolumeOutliers(rows.map((r) => r.bar))]),
    );
    if (latest && latest.bars.length > (byDay.get(latest.ymd)?.length ?? 0)) {
      byDay.set(latest.ymd, latest.bars);
    }
    const days = [...byDay.keys()].sort().slice(range === "1D" ? -1 : -5);
    if (range === "1D") {
      return { ticker: symbol, range, interval: "5m", candles: days.length ? byDay.get(days[0])! : [], live };
    }
    const candles: OhlcBar[] = [];
    for (const day of days) {
      const rows = byDay.get(day)!.map((bar) => {
        const { minutes } = nyYmdAndMinutes(bar.time);
        const bucket = US_REGULAR_OPEN_MIN + Math.floor((minutes - US_REGULAR_OPEN_MIN) / 30) * 30;
        return { ...bar, time: bar.time - (minutes - bucket) * 60, bucket };
      });
      candles.push(...aggregateBy(rows, (r) => `${r.bucket}`));
    }
    return { ticker: symbol, range, interval: "30m", candles, live };
  }

  const recentDaily = await getRecentDailyBars(symbol);
  const todayCandle = live ? await getTodayRealtimeDailyCandle(symbol) : null;
  const lastDate = recentDaily[recentDaily.length - 1]?.date ?? "";
  const daily = todayCandle && todayCandle.date > lastDate ? [...recentDaily, todayCandle] : recentDaily;
  const today = utcYmd(now);

  if (range === "ALL") {
    const recentMonthly = aggregateBy(daily, (b) => b.date.slice(0, 7));
    const firstRecentMonth = daily[0]?.date.slice(0, 7);
    const older = (await getAllTimeMonthlyCandles(symbol))
      .filter((c) => firstRecentMonth == null || c.month < firstRecentMonth)
      .map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume }));
    return { ticker: symbol, range, interval: "1mo", candles: [...older, ...recentMonthly], live };
  }

  const fromYmd =
    range === "1M"
      ? shiftYmd(today, { months: -1 })
      : range === "6M"
        ? shiftYmd(today, { months: -6 })
        : range === "YTD"
          ? `${today.slice(0, 4)}-01-01`
          : range === "1Y"
            ? shiftYmd(today, { years: -1 })
            : shiftYmd(today, { years: -5 });
  const inRange = daily.filter((b) => b.date >= fromYmd);

  if (range === "5Y") {
    return { ticker: symbol, range, interval: "1w", candles: aggregateBy(inRange, (b) => weekKey(b.date)), live };
  }
  return {
    ticker: symbol,
    range,
    interval: "1d",
    candles: inRange.map(({ time, open, high, low, close, volume }) => ({ time, open, high, low, close, volume })),
    live,
  };
}
