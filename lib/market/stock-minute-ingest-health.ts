import "server-only";

import { STOCK_DISPLAY_TZ } from "@/lib/market/chart-timestamp-format";
import { countStockSessionMinuteBarsInDb } from "@/lib/market/stock-session-minute-bar-store";
import { pickProcessEnv } from "@/lib/env/pick-process-env";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";

export type StockMinuteIngestWorkerHealth = {
  ok: boolean;
  authorized?: boolean;
  authorizedQuote?: boolean;
  subscribed?: number;
  lastTradeAt?: string | null;
  lastWsActivityAt?: string | null;
  lastRestPollAt?: string | null;
  tradeMsgCount?: number;
  quoteMsgCount?: number;
  restPollCount?: number;
  session?: string;
  error?: string;
};

function todayUsSessionYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STOCK_DISPLAY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getStockMinuteIngestHealthUrl(): string | undefined {
  return pickProcessEnv("STOCK_MINUTE_INGEST_HEALTH_URL")?.trim() || undefined;
}

export async function fetchStockMinuteIngestWorkerHealth(): Promise<StockMinuteIngestWorkerHealth | null> {
  const url = getStockMinuteIngestHealthUrl();
  if (!url) return null;

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as StockMinuteIngestWorkerHealth & {
      ok?: boolean;
      tradeMsgCount?: number;
      quoteMsgCount?: number;
      restPollCount?: number;
    };
    const authorized = json.authorized === true;
    const subscribed = typeof json.subscribed === "number" ? json.subscribed : 0;
    const tradeMsgCount = typeof json.tradeMsgCount === "number" ? json.tradeMsgCount : 0;
    const quoteMsgCount = typeof json.quoteMsgCount === "number" ? json.quoteMsgCount : 0;
    const restPollCount = typeof json.restPollCount === "number" ? json.restPollCount : 0;
    const hasActivity =
      tradeMsgCount > 0 ||
      quoteMsgCount > 0 ||
      restPollCount > 0 ||
      json.lastTradeAt != null ||
      json.lastRestPollAt != null;
    return {
      ok: authorized && subscribed >= 1 && hasActivity,
      authorized,
      authorizedQuote: json.authorizedQuote === true,
      subscribed,
      lastTradeAt: json.lastTradeAt ?? null,
      lastWsActivityAt: json.lastWsActivityAt ?? null,
      lastRestPollAt: json.lastRestPollAt ?? null,
      tradeMsgCount,
      quoteMsgCount,
      restPollCount,
      session: typeof json.session === "string" ? json.session : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Probe NVDA minute-bar store + optional Railway worker health (regular session only). */
export async function checkStockMinuteIngestPipeline(
  probeTicker = "NVDA",
): Promise<{
  configured: boolean;
  worker: StockMinuteIngestWorkerHealth | null;
  minuteBarsToday: number;
  sessionYmd: string;
  marketSession: ReturnType<typeof getUsEquityMarketSession>;
}> {
  const sessionYmd = todayUsSessionYmd();
  const marketSession = getUsEquityMarketSession(new Date());
  const [worker, minuteBarsToday] = await Promise.all([
    fetchStockMinuteIngestWorkerHealth(),
    countStockSessionMinuteBarsInDb(probeTicker, sessionYmd),
  ]);

  return {
    configured: Boolean(getStockMinuteIngestHealthUrl()),
    worker,
    minuteBarsToday,
    sessionYmd,
    marketSession,
  };
}
