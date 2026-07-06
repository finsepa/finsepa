/** WebSocket / minute-store tickers — live 1m 1D charts. All others: last traded day @ 2m. */
export const STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS = ["NVDA", "AAPL", "QQQ", "SPY"] as const;

function parseLiveMinuteChartTickersEnv(raw: string | undefined): string[] {
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

/** `STOCK_1D_LIVE_MINUTE_CHART=NVDA,AAPL,QQQ,SPY` — all others use last trading day @ 2m on 1D. */
export function stock1DLiveMinuteChartTickers(): readonly string[] {
  if (process.env.STOCK_1D_LIVE_MINUTE_CHART === "") return [];
  const fromEnv = parseLiveMinuteChartTickersEnv(process.env.STOCK_1D_LIVE_MINUTE_CHART);
  if (fromEnv.length) return fromEnv;
  return [...STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS];
}

export function isStock1DLiveMinuteChartTicker(ticker: string): boolean {
  const sym = ticker.trim().toUpperCase();
  if (!sym) return false;
  return stock1DLiveMinuteChartTickers().includes(sym);
}
