import "server-only";

import { stock1DLiveSessionMinuteBucketUnix } from "@/lib/chart/stock-1d-live-session-chart";
import { STOCK_DISPLAY_TZ, usSessionWallClockUnix, usSessionYmdFromUnixSeconds } from "@/lib/market/chart-timestamp-format";
import { fetchEodhdUsTicks } from "@/lib/market/eodhd-us-ticks";
import {
  countStockSessionMinuteBarsInDb,
  fetchStockSessionMinuteBarBackfillRow,
  listPendingStockSessionTickBackfillRows,
  listDistinctWatchlistStockTickers,
  upsertStockSessionMinuteBarBackfillRow,
  upsertStockSessionMinuteBarsBatchToDb,
} from "@/lib/market/stock-session-minute-bar-store";
import {
  getUsEquityMarketSession,
  lastCompletedUsRegularSessionYmd,
  usEquityTodayRegularSessionComplete,
} from "@/lib/market/us-equity-market-session";

export type StockSessionTickBackfillStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "partial"
  | "unavailable"
  | "failed";

/** ~6.5h session; treat as complete when most minute buckets exist. */
export const STOCK_SESSION_MINUTE_BAR_COMPLETE_THRESHOLD = 300;

/** 5-minute tick windows → ~78 API calls per full session (vs 390 for 1-minute). */
export const STOCK_TICK_BACKFILL_WINDOW_SEC = 5 * 60;

export function stockSessionTickBackfillEnabled(): boolean {
  return process.env.FINSEPA_STOCK_TICK_BACKFILL !== "0";
}

export function isStockSessionTickBackfillEligible(sessionYmd: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionYmd.trim())) return false;
  const todayYmd = usSessionYmdFromUnixSeconds(Math.floor(now.getTime() / 1000));
  if (sessionYmd > todayYmd) return false;
  if (sessionYmd === todayYmd && getUsEquityMarketSession(now) === "regular") return false;
  if (sessionYmd === todayYmd && !usEquityTodayRegularSessionComplete(now)) return false;
  return true;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function ticksToMinuteCloses(
  ticks: readonly { timestampSec: number; price: number }[],
  sessionYmd: string,
): Map<number, number> {
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);
  const buckets = new Map<number, number>();
  for (const tick of ticks) {
    if (tick.timestampSec < openSec || tick.timestampSec >= closeSec) continue;
    const bucket = stock1DLiveSessionMinuteBucketUnix(sessionYmd, tick.timestampSec, STOCK_DISPLAY_TZ);
    buckets.set(bucket, tick.price);
  }
  return buckets;
}

async function fetchTicksForWindow(
  ticker: string,
  fromSec: number,
  toSec: number,
  depth = 0,
): Promise<{ ticks: { timestampSec: number; price: number }[]; apiCalls: number }> {
  const res = await fetchEodhdUsTicks(ticker, fromSec, toSec);
  if (!res.ok) return { ticks: [], apiCalls: 1 };

  if (res.truncated && depth < 4 && toSec - fromSec > 60) {
    const mid = fromSec + Math.floor((toSec - fromSec) / 2);
    const left = await fetchTicksForWindow(ticker, fromSec, mid, depth + 1);
    const right = await fetchTicksForWindow(ticker, mid, toSec, depth + 1);
    return {
      ticks: [...left.ticks, ...right.ticks],
      apiCalls: 1 + left.apiCalls + right.apiCalls,
    };
  }

  return { ticks: res.ticks, apiCalls: 1 };
}

export async function backfillStockSessionMinuteBarsFromTicks(
  ticker: string,
  sessionYmd: string,
  options: { maxApiCalls?: number } = {},
): Promise<{
  status: StockSessionTickBackfillStatus;
  barCount: number;
  apiCalls: number;
  error?: string;
}> {
  const sym = normalizeTicker(ticker);
  const maxApiCalls = options.maxApiCalls ?? 120;
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, STOCK_DISPLAY_TZ);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, STOCK_DISPLAY_TZ);

  await upsertStockSessionMinuteBarBackfillRow(sym, sessionYmd, {
    status: "in_progress",
  });

  const minuteCloses = new Map<number, number>();
  let apiCalls = 0;
  let sawNotFound = false;

  for (let start = openSec; start < closeSec && apiCalls < maxApiCalls; start += STOCK_TICK_BACKFILL_WINDOW_SEC) {
    const end = Math.min(start + STOCK_TICK_BACKFILL_WINDOW_SEC, closeSec);
    const res = await fetchEodhdUsTicks(sym, start, end);
    apiCalls += 1;
    if (!res.ok) {
      if (res.reason === "not_found") {
        sawNotFound = true;
        break;
      }
      if (res.reason === "budget") break;
      continue;
    }
    if (res.truncated) {
      const split = await fetchTicksForWindow(sym, start, end);
      apiCalls += split.apiCalls - 1;
      for (const [bucket, close] of ticksToMinuteCloses(split.ticks, sessionYmd)) {
        minuteCloses.set(bucket, close);
      }
    } else {
      for (const [bucket, close] of ticksToMinuteCloses(res.ticks, sessionYmd)) {
        minuteCloses.set(bucket, close);
      }
    }
  }

  if (sawNotFound && minuteCloses.size === 0) {
    await upsertStockSessionMinuteBarBackfillRow(sym, sessionYmd, {
      status: "unavailable",
      apiCalls,
      lastError: "ticks_not_found",
    });
    return { status: "unavailable", barCount: 0, apiCalls, error: "ticks_not_found" };
  }

  if (minuteCloses.size > 0) {
    await upsertStockSessionMinuteBarsBatchToDb(
      sym,
      sessionYmd,
      Array.from(minuteCloses.entries()).map(([bucket_unix, close]) => ({ bucket_unix, close })),
    );
  }

  const totalBars = await countStockSessionMinuteBarsInDb(sym, sessionYmd);
  const status: StockSessionTickBackfillStatus =
    totalBars >= STOCK_SESSION_MINUTE_BAR_COMPLETE_THRESHOLD
      ? "complete"
      : minuteCloses.size > 0
        ? "partial"
        : "failed";

  await upsertStockSessionMinuteBarBackfillRow(sym, sessionYmd, {
    status,
    barCount: totalBars,
    apiCalls,
    completedAt: status === "complete" ? new Date().toISOString() : null,
    lastError: status === "failed" ? "no_ticks" : null,
  });

  return { status, barCount: totalBars, apiCalls };
}

/** Queue backfill when a completed session lacks full minute-bar coverage. */
export async function requestStockSessionTickBackfill(
  ticker: string,
  sessionYmd: string,
  now: Date = new Date(),
): Promise<void> {
  if (!stockSessionTickBackfillEnabled()) return;
  if (!isStockSessionTickBackfillEligible(sessionYmd, now)) return;

  const sym = normalizeTicker(ticker);
  if (!sym) return;

  const existing = await fetchStockSessionMinuteBarBackfillRow(sym, sessionYmd);
  if (existing?.status === "complete" || existing?.status === "unavailable") return;
  if (existing?.status === "in_progress") return;

  const barCount = await countStockSessionMinuteBarsInDb(sym, sessionYmd);
  if (barCount >= STOCK_SESSION_MINUTE_BAR_COMPLETE_THRESHOLD) {
    await upsertStockSessionMinuteBarBackfillRow(sym, sessionYmd, {
      status: "complete",
      barCount,
      completedAt: new Date().toISOString(),
    });
    return;
  }

  await upsertStockSessionMinuteBarBackfillRow(sym, sessionYmd, {
    status: "pending",
    barCount,
  });
}

export async function processStockSessionTickBackfillBatch(options: {
  maxTickers?: number;
  maxApiCallsPerTicker?: number;
} = {}): Promise<{
  processed: number;
  results: { ticker: string; sessionYmd: string; status: string; apiCalls: number }[];
}> {
  if (!stockSessionTickBackfillEnabled()) {
    return { processed: 0, results: [] };
  }

  const maxTickers = options.maxTickers ?? Number(process.env.STOCK_TICK_BACKFILL_MAX_TICKERS_PER_RUN ?? 15);
  const maxApiCallsPerTicker =
    options.maxApiCallsPerTicker ?? Number(process.env.STOCK_TICK_BACKFILL_MAX_CALLS_PER_TICKER ?? 90);

  const pending = await listPendingStockSessionTickBackfillRows(maxTickers);
  const results: { ticker: string; sessionYmd: string; status: string; apiCalls: number }[] = [];

  for (const row of pending) {
    if (!isStockSessionTickBackfillEligible(row.session_ymd)) continue;
    const outcome = await backfillStockSessionMinuteBarsFromTicks(row.ticker, row.session_ymd, {
      maxApiCalls: maxApiCallsPerTicker,
    });
    results.push({
      ticker: row.ticker,
      sessionYmd: row.session_ymd,
      status: outcome.status,
      apiCalls: outcome.apiCalls,
    });
  }

  return { processed: results.length, results };
}

export async function enqueueWatchlistStockSessionTickBackfills(
  sessionYmd: string,
  now: Date = new Date(),
): Promise<number> {
  if (!stockSessionTickBackfillEnabled()) return 0;
  if (!isStockSessionTickBackfillEligible(sessionYmd, now)) return 0;

  const tickers = await listDistinctWatchlistStockTickers();
  let enqueued = 0;
  for (const ticker of tickers) {
    const before = await fetchStockSessionMinuteBarBackfillRow(ticker, sessionYmd);
    if (before?.status === "complete" || before?.status === "unavailable") continue;
    await requestStockSessionTickBackfill(ticker, sessionYmd, now);
    enqueued += 1;
  }
  return enqueued;
}

export { lastCompletedUsRegularSessionYmd };
