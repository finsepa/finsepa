import "server-only";

import { unstable_cache } from "next/cache";

import { usSessionWallClockUnix } from "@/lib/market/chart-timestamp-format";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshot } from "@/lib/market/market-snapshot-store";
import type { StockChartPoint } from "@/lib/market/stock-chart-types";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import type { TopCompanyUniverseRow } from "@/lib/screener/top500-companies";

/** Always-on WebSocket ETFs (count toward the EODHD symbol cap). */
export const STOCK_WS_PRIORITY_ETFS = ["SPY", "QQQ"] as const;

/** Mirrors scripts/lib/stock-ws-priority-universe.mjs — used when top500 snapshot is missing. */
export const STOCK_WS_FALLBACK_CURATED_TOP_STOCKS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "GOOGL",
  "AMZN",
  "META",
  "BRK-B",
  "TSLA",
  "LLY",
  "AVGO",
  "JPM",
  "V",
  "UNH",
  "XOM",
  "MA",
  "PG",
  "JNJ",
  "HD",
  "COST",
  "ABBV",
  "NFLX",
  "CRM",
  "BAC",
  "KO",
  "AMD",
  "MRK",
  "ORCL",
  "PEP",
  "CVX",
  "TMO",
  "ACN",
  "CSCO",
  "WMT",
  "MCD",
  "ADBE",
  "LIN",
  "DIS",
  "INTU",
  "QCOM",
  "TXN",
  "AMGN",
  "HON",
  "AMAT",
  "IBM",
  "GE",
  "CAT",
  "PANW",
  "SBUX",
] as const;

const DEFAULT_TOP_STOCKS = 48;

export function stockWsTopStocksCount(): number {
  const raw = process.env.STOCK_WS_TOP_STOCKS;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return DEFAULT_TOP_STOCKS;
}

function normalizeTop500SnapshotRows(snapshot: unknown): TopCompanyUniverseRow[] {
  if (Array.isArray(snapshot)) {
    return snapshot.filter(
      (row): row is TopCompanyUniverseRow =>
        row != null && typeof row === "object" && typeof (row as TopCompanyUniverseRow).ticker === "string",
    );
  }
  if (snapshot && typeof snapshot === "object") {
    return Object.values(snapshot).filter(
      (row): row is TopCompanyUniverseRow =>
        row != null && typeof row === "object" && typeof (row as TopCompanyUniverseRow).ticker === "string",
    );
  }
  return [];
}

/** Curated US tickers for WebSocket minute ingest (ETFs + top N by market cap). */
async function loadStockWsPriorityTickersUncached(): Promise<string[]> {
  const out = new Set<string>();
  for (const t of STOCK_WS_PRIORITY_ETFS) out.add(t.toUpperCase());
  for (const t of (process.env.STOCK_WS_TICKERS ?? "").split(",")) {
    const sym = t.trim().toUpperCase();
    if (sym) out.add(sym);
  }

  const snapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market);
  const rows = normalizeTop500SnapshotRows(snapshot);
  const topN = stockWsTopStocksCount();
  let stockCount = 0;
  for (const row of rows) {
    if (stockCount >= topN) break;
    const t = row.ticker.trim().toUpperCase();
    if (!t || out.has(t)) continue;
    out.add(t);
    stockCount += 1;
  }

  if (stockCount < topN) {
    for (const t of STOCK_WS_FALLBACK_CURATED_TOP_STOCKS) {
      if (stockCount >= topN) break;
      const sym = t.toUpperCase();
      if (!sym || out.has(sym)) continue;
      out.add(sym);
      stockCount += 1;
    }
  }

  return [...out];
}

function parseStockWsPriorityTickers(raw: unknown): string[] | null {
  if (typeof raw === "string") {
    try {
      return parseStockWsPriorityTickers(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const tickers = raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  return tickers.length > 0 ? tickers : null;
}

/** JSON string only — `unstable_cache` cannot round-trip `Set` or reliably preserve arrays. */
const getStockWsPriorityTickersJson = unstable_cache(
  async (): Promise<string> => JSON.stringify(await loadStockWsPriorityTickersUncached()),
  ["stock-ws-priority-universe-v4"],
  { revalidate: 900 },
);

async function getStockWsPriorityTickers(): Promise<string[]> {
  const cached = parseStockWsPriorityTickers(await getStockWsPriorityTickersJson());
  return cached ?? loadStockWsPriorityTickersUncached();
}

export async function getStockWsPriorityTickerSet(): Promise<ReadonlySet<string>> {
  return new Set(await getStockWsPriorityTickers());
}

export async function isStockWsPriorityTicker(ticker: string): Promise<boolean> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return false;
  const tickers = await getStockWsPriorityTickers();
  return tickers.includes(sym);
}

/**
 * WS-priority tickers get minute-store charts with sparse bars (worker fills continuously).
 * Everyone else needs enough polled coverage — otherwise fall back to 60s poll + delayed live.
 */
export function sessionMinuteBarsAdequateForLiveChart(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (bars.length < 3) return false;
  const sorted = bars
    .filter((p) => typeof p.time === "number" && Number.isFinite(p.time) && Number.isFinite(p.value))
    .sort((a, b) => a.time - b.time);
  if (sorted.length < 3) return false;

  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, closeSec) : closeSec;

  const inSession = sorted.filter((p) => p.time >= openSec && p.time <= endSec);
  if (inSession.length < 3) return false;

  const spanSec = inSession[inSession.length - 1]!.time - inSession[0]!.time;
  return spanSec >= 10 * 60;
}

/** Largest gap between consecutive in-session minute bars (seconds). */
export function sessionMinuteBarsMaxGapSec(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
): number {
  if (bars.length < 2) return 0;
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, closeSec) : closeSec;
  const inSession = bars
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        p.time >= openSec &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);
  if (inSession.length < 2) return 0;
  let maxGap = 0;
  for (let i = 1; i < inSession.length; i++) {
    maxGap = Math.max(maxGap, inSession[i]!.time - inSession[i - 1]!.time);
  }
  return maxGap;
}

/** Largest gap between the last in-session bar and wall-clock `now` (seconds). */
export function sessionMinuteBarsTrailingGapSec(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
): number {
  if (getUsEquityMarketSession(now) !== "regular") return 0;

  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(nowSec, closeSec);
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);

  const inSession = bars
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time >= openSec &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);

  if (!inSession.length) return endSec - openSec;
  return Math.max(0, endSec - inSession[inSession.length - 1]!.time);
}

/** True when WS store has holes large enough to create misleading flat chart segments. */
export function sessionMinuteBarsHasLargeGaps(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
  maxGapSec = 5 * 60,
): boolean {
  return sessionMinuteBarsMaxGapSec(bars, sessionYmd, timeZone, now) > maxGapSec;
}

/** True when today's minute store missed the open or is too sparse for a credible 1D chart. */
export function sessionMinuteBarsNeedsGapFill(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
): boolean {
  if (getUsEquityMarketSession(now) !== "regular") return false;

  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(nowSec, closeSec);
  const elapsedSec = endSec - openSec;
  if (elapsedSec < 3 * 60) return false;

  const inSession = bars
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time >= openSec &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);

  if (!inSession.length) return true;
  if (inSession[0]!.time > openSec + 5 * 60) return true;

  const elapsedMinutes = Math.floor(elapsedSec / 60);
  const minBars = Math.max(3, Math.floor(elapsedMinutes * 0.2));
  if (inSession.length < minBars) return true;

  if (sessionMinuteBarsTrailingGapSec(bars, sessionYmd, timeZone, now) > 2 * 60) return true;

  return sessionMinuteBarsHasLargeGaps(bars, sessionYmd, timeZone, now, 5 * 60);
}

/** True when the first in-session bar is near the 9:30 open (tick-perfect WS coverage). */
export function sessionMinuteBarsCoverSessionOpen(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
  maxLateSec = 10 * 60,
): boolean {
  if (getUsEquityMarketSession(now) !== "regular") return false;

  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = Math.min(nowSec, closeSec);

  const inSession = bars
    .filter(
      (p) =>
        typeof p.time === "number" &&
        Number.isFinite(p.time) &&
        Number.isFinite(p.value) &&
        p.time >= openSec &&
        p.time <= endSec,
    )
    .sort((a, b) => a.time - b.time);

  if (!inSession.length) return false;
  return inSession[0]!.time <= openSec + maxLateSec;
}

/** Min $ move across session bars before we treat the WS minute store as a real tick chart. */
export const STOCK_SESSION_MINUTE_BAR_MIN_SPREAD_USD = 0.5;

/** Flat polled closes (same price every bucket) are not a tick chart — fall back to intraday / OHLC. */
export function sessionMinuteBarsHavePriceVariation(
  bars: readonly StockChartPoint[],
  sessionYmd: string,
  timeZone: string,
  now: Date = new Date(),
  minDistinctCents = 2,
  minSpreadUsd = STOCK_SESSION_MINUTE_BAR_MIN_SPREAD_USD,
): boolean {
  if (bars.length < 2) return false;
  const openSec = usSessionWallClockUnix(sessionYmd, 9, 30, timeZone);
  const closeSec = usSessionWallClockUnix(sessionYmd, 16, 0, timeZone);
  const nowSec = Math.floor(now.getTime() / 1000);
  const endSec = getUsEquityMarketSession(now) === "regular" ? Math.min(nowSec, closeSec) : closeSec;
  const inSession = bars.filter(
    (p) =>
      typeof p.time === "number" &&
      Number.isFinite(p.time) &&
      Number.isFinite(p.value) &&
      p.time >= openSec &&
      p.time <= endSec,
  );
  if (inSession.length < 2) return false;
  const cents = new Set(inSession.map((p) => Math.round(p.value * 100)));
  if (cents.size < minDistinctCents) return false;
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;
  for (const p of inSession) {
    minVal = Math.min(minVal, p.value);
    maxVal = Math.max(maxVal, p.value);
  }
  return maxVal - minVal >= minSpreadUsd;
}
