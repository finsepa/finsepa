import "server-only";

import { STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS } from "@/lib/market/stock-1d-live-minute-chart-tickers";

/** Tick-perfect 1D: worker streams these from the 9:30 open (never dropped from WS cap). */
export const STOCK_WS_ALWAYS_ON_DEFAULT_TICKERS = STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS;

function parseAlwaysOnEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const sym = part.trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
}

/** `STOCK_WS_ALWAYS_ON=NVDA,AAPL` — pinned WebSocket minute ingest for tick-perfect 1D. */
export function stockWsAlwaysOnTickers(): readonly string[] {
  if (process.env.STOCK_WS_ALWAYS_ON === "") return [];
  const fromEnv = parseAlwaysOnEnv(process.env.STOCK_WS_ALWAYS_ON);
  if (fromEnv.length) return fromEnv;
  return [...STOCK_WS_ALWAYS_ON_DEFAULT_TICKERS];
}

export function isStockWsAlwaysOnTicker(ticker: string): boolean {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return false;
  return stockWsAlwaysOnTickers().includes(sym);
}
