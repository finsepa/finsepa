/**
 * Canonical Portfolio historical daily EOD loader.
 *
 * Data only — no Dietz / benchmark / analytics math.
 * All Portfolio compute routes should load bars through this module so identical
 * (symbol, from, to, retry) requests share one EODHD fetch via `unstable_cache`.
 */
import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_HOT } from "@/lib/data/cache-policy";
import { fetchEodhdCryptoDailyBars, toEodhdCryptoSymbol } from "@/lib/market/eodhd-crypto";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDaily } from "@/lib/market/eodhd-eod";
import { fetchEodhdEodDailyRetry } from "@/lib/market/eodhd-eod-retry";
import { toEodhdSymbol } from "@/lib/market/eodhd-symbol";
import { portfolioEodBarsCacheKey } from "@/lib/portfolio/data/portfolio-eod-bars-cache-key";

export { PORTFOLIO_EOD_GRANULARITY, portfolioEodBarsCacheKey } from "@/lib/portfolio/data/portfolio-eod-bars-cache-key";

/**
 * Freshness: {@link REVALIDATE_HOT} (60s) — same tier as `getStockPerformance` on Overview.
 * Does not lengthen beyond existing Portfolio price caches; collapses identical EODHD GETs.
 */
const REVALIDATE_PORTFOLIO_EOD_BARS = REVALIDATE_HOT;

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
    providerSymbol: string,
    fromYmd: string,
    toYmd: string,
    retryFlag: "0" | "1",
  ): Promise<EodhdDailyBar[]> => {
    return fetchEquityBarsUncached(providerSymbol, fromYmd, toYmd, retryFlag === "1");
  },
  ["portfolio-eod-equity-bars-v1"],
  { revalidate: REVALIDATE_PORTFOLIO_EOD_BARS },
);

const getCachedCryptoBars = unstable_cache(
  async (
    _cacheKey: string,
    providerSymbol: string,
    fromYmd: string,
    toYmd: string,
  ): Promise<EodhdDailyBar[]> => {
    return fetchCryptoBarsUncached(providerSymbol, fromYmd, toYmd);
  },
  ["portfolio-eod-crypto-bars-v1"],
  { revalidate: REVALIDATE_PORTFOLIO_EOD_BARS },
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
    return withInflight(cacheKey, () => getCachedCryptoBars(cacheKey, cryptoPair, fromYmd, toYmd));
  }

  const providerSymbol = toEodhdSymbol(sym);
  const cacheKey = portfolioEodBarsCacheKey({
    route: "equity",
    providerSymbol,
    fromYmd,
    toYmd,
    retry,
  });
  return withInflight(cacheKey, () =>
    getCachedEquityBars(cacheKey, providerSymbol, fromYmd, toYmd, retry ? "1" : "0"),
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
