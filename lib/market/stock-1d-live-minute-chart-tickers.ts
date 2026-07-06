import {
  getUsEquityMarketSession,
  usEquityTodayRegularSessionComplete,
} from "@/lib/market/us-equity-market-session";

/** WebSocket / minute-store tickers — live 1m 1D charts. All others: last traded day @ 2m. */
export const STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS = [
  "NVDA",
  "AAPL",
  "QQQ",
  "SPY",
] as const;

/** Alias — same four tickers for WS ingest + live 1D reference implementation. */
export const STOCK_LIVE_1D_REFERENCE_TICKERS = STOCK_1D_LIVE_MINUTE_CHART_DEFAULT_TICKERS;

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

/**
 * Single gate for the live 1D WS pipeline (chart, header spot poll, client tail pin).
 * Uses allowlist + regular session clock only — no per-symbol EODHD holiday probes.
 */
export function usesStock1DLiveWsMinutePipeline(
  ticker: string,
  now: Date = new Date(),
): boolean {
  return isStock1DLiveMinuteChartTicker(ticker) && getUsEquityMarketSession(now) === "regular";
}

/** Live after-hours tail updates — allowlist only, 16:00–20:00 ET. */
export function usesStock1DLiveWsPostMarketPipeline(
  ticker: string,
  now: Date = new Date(),
): boolean {
  return isStock1DLiveMinuteChartTicker(ticker) && getUsEquityMarketSession(now) === "post";
}

/**
 * Frozen today's regular session + AH tail — post-market and same-evening after 20:00 ET.
 * Excludes pre-market and non-allowlist tickers.
 */
export function usesStock1DLiveWsPostMarketChart(
  ticker: string,
  now: Date = new Date(),
): boolean {
  if (!isStock1DLiveMinuteChartTicker(ticker)) return false;
  const session = getUsEquityMarketSession(now);
  if (session === "post") return true;
  return session === "closed" && usEquityTodayRegularSessionComplete(now);
}
