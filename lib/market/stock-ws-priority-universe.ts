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

const DEFAULT_TOP_STOCKS = 48;

export function stockWsTopStocksCount(): number {
  const n = Number(process.env.STOCK_WS_TOP_STOCKS ?? DEFAULT_TOP_STOCKS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_TOP_STOCKS;
}

/** Curated US tickers for WebSocket minute ingest (ETFs + top N by market cap). */
export const getStockWsPriorityTickerSet = unstable_cache(
  async (): Promise<ReadonlySet<string>> => {
    const out = new Set<string>();
    for (const t of STOCK_WS_PRIORITY_ETFS) out.add(t.toUpperCase());
    for (const t of (process.env.STOCK_WS_TICKERS ?? "").split(",")) {
      const sym = t.trim().toUpperCase();
      if (sym) out.add(sym);
    }

    const snapshot = await readMarketSnapshot<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market);
    const topN = stockWsTopStocksCount();
    let stockCount = 0;
    for (const row of snapshot ?? []) {
      if (stockCount >= topN) break;
      const t = row.ticker.trim().toUpperCase();
      if (!t || out.has(t)) continue;
      out.add(t);
      stockCount += 1;
    }
    return out;
  },
  ["stock-ws-priority-universe-v1"],
  { revalidate: 900 },
);

export async function isStockWsPriorityTicker(ticker: string): Promise<boolean> {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return false;
  const set = await getStockWsPriorityTickerSet();
  return set.has(sym);
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
