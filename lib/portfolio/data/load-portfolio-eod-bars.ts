/**
 * Canonical app-wide historical daily EOD loader (equity + crypto).
 *
 * Data only — no Dietz / benchmark / analytics math.
 * Portfolio, stock/index pages, charts, screener misses, and performance should load
 * bars through this module so identical (symbol, from, to, retry) requests share one
 * EODHD fetch via `unstable_cache` + in-flight dedupe.
 */
import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_WARM } from "@/lib/data/cache-policy";
import { fetchEodhdCryptoDailyBars, toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDailyRetry } from "@/lib/market/eodhd-eod-retry";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { isUsEquityExchangeHolidayYmd } from "@/lib/market/us-equity-exchange-holidays";
import { portfolioEodBarsCacheKey } from "@/lib/portfolio/data/portfolio-eod-bars-cache-key";
import { nyCalendarYmd, previousNyTradingDayYmd } from "@/lib/screener/screener-us-market-cache";

export { PORTFOLIO_EOD_GRANULARITY, portfolioEodBarsCacheKey } from "@/lib/portfolio/data/portfolio-eod-bars-cache-key";

/**
 * Equity daily bars only change when a new session's bar is published, so the cache key carries
 * {@link latestPublishedUsEodYmd} and the TTL only guards late publishes / provider corrections.
 */
const REVALIDATE_EQUITY_EOD_BARS = 60 * 60;
/** Crypto's current-day bar keeps moving (24/7 market). */
const REVALIDATE_CRYPTO_EOD_BARS = REVALIDATE_WARM;

/** EODHD publishes US EOD bars shortly after the 16:00 ET close; allow an hour of slack. */
const US_EOD_PUBLISH_LAG_MS = 60 * 60 * 1000;
const US_REGULAR_CLOSE_MINUTES = 16 * 60;

function nyWeekdayAndMinutes(now: Date): { weekday: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { weekday: parts.find((p) => p.type === "weekday")?.value ?? "", minutes: hour * 60 + minute };
}

/** Latest US trading day whose daily bar should already be published (America/New_York). */
function latestPublishedUsEodYmd(now: Date): string {
  const lagged = new Date(now.getTime() - US_EOD_PUBLISH_LAG_MS);
  const ymd = nyCalendarYmd(lagged);
  const { weekday, minutes } = nyWeekdayAndMinutes(lagged);
  const tradingDay = weekday !== "Sat" && weekday !== "Sun" && !isUsEquityExchangeHolidayYmd(ymd);
  if (tradingDay && minutes >= US_REGULAR_CLOSE_MINUTES) return ymd;
  return previousNyTradingDayYmd(lagged);
}

/** Thrown inside cached loaders so empty / budget-blocked responses are never stored. */
class EmptyEodBarsError extends Error {}

function throwIfEmpty(bars: EodhdDailyBar[]): EodhdDailyBar[] {
  if (bars.length === 0) throw new EmptyEodBarsError();
  return bars;
}

/** Short per-isolate memory of empty series (delisted / custom symbols) so they don't refetch every view. */
const EMPTY_BARS_TTL_MS = 10 * 60 * 1000;
const emptyBarsUntil = new Map<string, number>();

async function emptyOnMiss(key: string, run: () => Promise<EodhdDailyBar[]>): Promise<EodhdDailyBar[]> {
  const until = emptyBarsUntil.get(key);
  if (until != null) {
    if (until > Date.now()) return [];
    emptyBarsUntil.delete(key);
  }
  try {
    return await run();
  } catch (e) {
    if (e instanceof EmptyEodBarsError) {
      emptyBarsUntil.set(key, Date.now() + EMPTY_BARS_TTL_MS);
      return [];
    }
    throw e;
  }
}

function normalizePortfolioSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function fetchEquityBarsUncached(
  providerSymbol: string,
  fromYmd: string,
  toYmd: string,
  retry: boolean,
): Promise<EodhdDailyBar[]> {
  if (retry) {
    return fetchEodhdEodDailyRetry(providerSymbol, fromYmd, toYmd);
  }
  return (await fetchEodhdEodDaily(providerSymbol, fromYmd, toYmd)) ?? [];
}

async function fetchCryptoBarsUncached(
  providerSymbol: string,
  fromYmd: string,
  toYmd: string,
): Promise<EodhdDailyBar[]> {
  return (await fetchEodhdCryptoDailyBars(providerSymbol, fromYmd, toYmd)) ?? [];
}

/**
 * Per-key `unstable_cache`. Args are the cache key parts (Next Data Cache).
 * `cacheKey` is included so keys stay explicit and greppable.
 */
const getCachedEquityBars = unstable_cache(
  async (
    _cacheKey: string,
    _publishedEodYmd: string,
    providerSymbol: string,
    fromYmd: string,
    toYmd: string,
    retryFlag: "0" | "1",
  ): Promise<EodhdDailyBar[]> => {
    return throwIfEmpty(await fetchEquityBarsUncached(providerSymbol, fromYmd, toYmd, retryFlag === "1"));
  },
  ["portfolio-eod-equity-bars-v2"],
  { revalidate: REVALIDATE_EQUITY_EOD_BARS },
);

const getCachedCryptoBars = unstable_cache(
  async (
    _cacheKey: string,
    providerSymbol: string,
    fromYmd: string,
    toYmd: string,
  ): Promise<EodhdDailyBar[]> => {
    return throwIfEmpty(await fetchCryptoBarsUncached(providerSymbol, fromYmd, toYmd));
  },
  ["portfolio-eod-crypto-bars-v2"],
  { revalidate: REVALIDATE_CRYPTO_EOD_BARS },
);

/** In-flight coalesce for identical keys in one isolate (parallel Promise.all / routes). */
const inflight = new Map<string, Promise<EodhdDailyBar[]>>();

function withInflight(key: string, run: () => Promise<EodhdDailyBar[]>): Promise<EodhdDailyBar[]> {
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

export type LoadPortfolioSymbolEodBarsOpts = {
  /**
   * When true, use one retry on empty/null (analytics / benchmark path).
   * Cached separately from non-retry so empty no-retry misses do not skip retry.
   */
  retry?: boolean;
};

/**
 * Load daily EOD bars for one Portfolio holding symbol (ticker or crypto id).
 * Returns [] when the provider has no series (same as prior `bars ?? []` call sites).
 */
export async function loadPortfolioSymbolEodBars(
  portfolioSymbol: string,
  fromYmd: string,
  toYmd: string,
  opts?: LoadPortfolioSymbolEodBarsOpts,
): Promise<EodhdDailyBar[]> {
  if (!isYmd(fromYmd) || !isYmd(toYmd)) return [];
  const sym = normalizePortfolioSymbol(portfolioSymbol);
  if (!sym) return [];

  const retry = opts?.retry === true;
  const cryptoPair = toEodhdCryptoSymbol(sym);

  if (cryptoPair != null) {
    const cacheKey = portfolioEodBarsCacheKey({
      route: "crypto",
      providerSymbol: cryptoPair,
      fromYmd,
      toYmd,
      retry: false,
    });
    return withInflight(cacheKey, () =>
      emptyOnMiss(cacheKey, () => getCachedCryptoBars(cacheKey, cryptoPair, fromYmd, toYmd)),
    );
  }

  const providerSymbol = toEodhdSymbol(sym);
  const cacheKey = portfolioEodBarsCacheKey({
    route: "equity",
    providerSymbol,
    fromYmd,
    toYmd,
    retry,
  });
  const publishedEodYmd = latestPublishedUsEodYmd(new Date());
  const epochKey = `${cacheKey}|${publishedEodYmd}`;
  return withInflight(epochKey, () =>
    emptyOnMiss(epochKey, () =>
      getCachedEquityBars(cacheKey, publishedEodYmd, providerSymbol, fromYmd, toYmd, retry ? "1" : "0"),
    ),
  );
}

/**
 * Parallel load for many Portfolio symbols → Map keyed by **portfolio** symbol (uppercase).
 */
export async function loadPortfolioEodBars(
  symbols: readonly string[],
  fromYmd: string,
  toYmd: string,
  opts?: LoadPortfolioSymbolEodBarsOpts,
): Promise<Map<string, EodhdDailyBar[]>> {
  const unique = [...new Set(symbols.map(normalizePortfolioSymbol).filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (sym) => {
      const bars = await loadPortfolioSymbolEodBars(sym, fromYmd, toYmd, opts);
      return [sym, bars] as const;
    }),
  );
  return new Map(pairs);
}

/**
 * Shared benchmark / session-calendar history (typically SPY).
 * Same cache namespace as equity holdings — identical SPY windows reuse one fetch.
 */
export async function loadPortfolioBenchmarkEodBars(
  benchmarkTicker: string,
  fromYmd: string,
  toYmd: string,
  opts?: LoadPortfolioSymbolEodBarsOpts,
): Promise<EodhdDailyBar[]> {
  const ticker = normalizePortfolioSymbol(benchmarkTicker) || "SPY";
  return loadPortfolioSymbolEodBars(ticker, fromYmd, toYmd, opts);
}

/** Convenience: SPY session calendar / contribution benchmark. */
export async function loadPortfolioSpyEodBars(
  fromYmd: string,
  toYmd: string,
  opts?: LoadPortfolioSymbolEodBarsOpts,
): Promise<EodhdDailyBar[]> {
  return loadPortfolioBenchmarkEodBars("SPY", fromYmd, toYmd, opts);
}

/** Greppable alias — same cache namespace as {@link loadPortfolioSymbolEodBars}. */
export { loadPortfolioSymbolEodBars as loadCanonicalEodDailyBars };
