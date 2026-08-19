import "server-only";

import { fetchEodhdFundamentalsJson } from "@/lib/market/eodhd-fundamentals";
import { stockKeyIndicatorsServerEnabled } from "@/lib/features/key-indicators";
import { isEarningsNotifiableTicker } from "@/lib/notifications/ticker-notify-eligibility";
import { getStockPerformance } from "@/lib/market/stock-performance";
import type { StockPerformance } from "@/lib/market/stock-performance-types";
import {
  buildSlowKeyIndicators,
  buildVsSp500YtdIndicator,
  isKeyIndicatorsEligibleFundamentalsRoot,
  KEY_INDICATORS_BENCHMARK_SYMBOL,
  KEY_INDICATORS_HOT_TTL_MS,
  KEY_INDICATORS_SLOW_TTL_MS,
  keyIndicatorsResponseIsRenderable,
  mergeKeyIndicatorsForDisplay,
} from "@/lib/market/stock-key-indicators-build";
import { readStockKeyIndicatorsSnapshot, upsertStockKeyIndicatorsSnapshot } from "@/lib/market/stock-key-indicators-store";
import type {
  StockKeyIndicatorsResponse,
  StockKeyIndicatorsSnapshot,
} from "@/lib/market/stock-key-indicators-types";

export function stockKeyIndicatorsEnabled(): boolean {
  return stockKeyIndicatorsServerEnabled();
}

function isFresh(iso: string | undefined | null, maxAgeMs: number, now = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return now - t < maxAgeMs;
}

function latestComputedAt(snapshot: StockKeyIndicatorsSnapshot | null): string | null {
  if (!snapshot) return null;
  const times = [snapshot.slow?.computedAt, snapshot.hot?.computedAt].filter(Boolean) as string[];
  if (!times.length) return null;
  return times.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function emptyResponse(ticker: string): StockKeyIndicatorsResponse {
  return { ticker, computedAt: null, indicators: [] };
}

const inflight = new Map<string, Promise<StockKeyIndicatorsResponse>>();

export type StockKeyIndicatorsLoadOpts = {
  /**
   * When the caller already computed performance from the same daily bars window
   * (e.g. stock page SSR), pass it here to skip a redundant `getStockPerformance` fetch.
   */
  stockPerformance?: Promise<StockPerformance> | StockPerformance;
};

async function resolveStockPerformance(
  ticker: string,
  prefetched?: Promise<StockPerformance> | StockPerformance,
): Promise<StockPerformance> {
  if (prefetched != null) return prefetched;
  return getStockPerformance(ticker);
}

async function computeHotTier(ticker: string, now = new Date(), opts?: StockKeyIndicatorsLoadOpts) {
  const [stockPerf, benchPerf] = await Promise.all([
    resolveStockPerformance(ticker, opts?.stockPerformance),
    getStockPerformance(KEY_INDICATORS_BENCHMARK_SYMBOL),
  ]);
  const stockYtd = stockPerf.ytd;
  const benchYtd = benchPerf.ytd;
  const indicator = buildVsSp500YtdIndicator(stockYtd, benchYtd);
  return {
    computedAt: now.toISOString(),
    indicator,
    stockYtd,
    benchYtd,
  };
}

async function computeSlowTier(ticker: string, now = new Date(), opts?: StockKeyIndicatorsLoadOpts) {
  const root = await fetchEodhdFundamentalsJson(ticker);
  if (!root || !isKeyIndicatorsEligibleFundamentalsRoot(root)) {
    return null;
  }

  const perf = await resolveStockPerformance(ticker, opts?.stockPerformance);
  const price = perf.price;
  const indicators = buildSlowKeyIndicators({ root, price, now });
  return {
    computedAt: now.toISOString(),
    indicators,
    price,
  };
}

function mergeSnapshotResponse(ticker: string, snapshot: StockKeyIndicatorsSnapshot): StockKeyIndicatorsResponse {
  const hotIndicator = snapshot.hot?.indicator ?? null;
  const slowIndicators = snapshot.slow?.indicators ?? [];
  const indicators = mergeKeyIndicatorsForDisplay(slowIndicators, hotIndicator);
  if (!keyIndicatorsResponseIsRenderable(indicators)) return emptyResponse(ticker);
  return {
    ticker,
    computedAt: latestComputedAt(snapshot),
    indicators,
  };
}

async function refreshStockKeyIndicatorsUncached(
  ticker: string,
  opts?: StockKeyIndicatorsLoadOpts,
): Promise<StockKeyIndicatorsResponse> {
  const sym = ticker.trim().toUpperCase();
  if (!sym || !isEarningsNotifiableTicker(sym)) return emptyResponse(sym);

  const now = new Date();
  const existingRow = await readStockKeyIndicatorsSnapshot(sym);
  const existing = existingRow?.data ?? null;

  let snapshot: StockKeyIndicatorsSnapshot = existing ?? { ticker: sym, slow: null, hot: null };

  const slowFresh = isFresh(snapshot.slow?.computedAt, KEY_INDICATORS_SLOW_TTL_MS, now.getTime());
  const hotFresh = isFresh(snapshot.hot?.computedAt, KEY_INDICATORS_HOT_TTL_MS, now.getTime());

  const tasks: Promise<void>[] = [];

  if (!slowFresh) {
    tasks.push(
      computeSlowTier(sym, now, opts).then((slow) => {
        if (slow) snapshot = { ...snapshot, slow };
      }),
    );
  }

  if (!hotFresh) {
    tasks.push(
      computeHotTier(sym, now, opts).then((hot) => {
        if (hot.indicator != null || hot.stockYtd != null || hot.benchYtd != null) {
          snapshot = { ...snapshot, hot };
        }
      }),
    );
  }

  if (tasks.length) {
    await Promise.all(tasks);
    if (snapshot.slow || snapshot.hot) {
      await upsertStockKeyIndicatorsSnapshot(sym, snapshot);
    }
  }

  return mergeSnapshotResponse(sym, snapshot);
}

export async function getStockKeyIndicators(
  ticker: string,
  opts?: StockKeyIndicatorsLoadOpts,
): Promise<StockKeyIndicatorsResponse> {
  if (!stockKeyIndicatorsEnabled()) return emptyResponse(ticker.trim().toUpperCase());

  const sym = ticker.trim().toUpperCase();
  if (!sym || !isEarningsNotifiableTicker(sym)) return emptyResponse(sym);

  const existingRow = await readStockKeyIndicatorsSnapshot(sym);
  const existing = existingRow?.data ?? null;
  const now = Date.now();

  if (existing) {
    const slowFresh = isFresh(existing.slow?.computedAt, KEY_INDICATORS_SLOW_TTL_MS, now);
    const hotFresh = isFresh(existing.hot?.computedAt, KEY_INDICATORS_HOT_TTL_MS, now);
    if (slowFresh && hotFresh) {
      return mergeSnapshotResponse(sym, existing);
    }
  }

  const pending = inflight.get(sym);
  if (pending) return pending;

  const work = refreshStockKeyIndicatorsUncached(sym, opts).finally(() => {
    inflight.delete(sym);
  });
  inflight.set(sym, work);
  return work;
}

/** Cron / batch warm — forces slow tier refresh when stale or missing. */
export async function warmStockKeyIndicators(ticker: string): Promise<{ ok: boolean; reason?: string }> {
  if (!stockKeyIndicatorsEnabled()) return { ok: false, reason: "disabled" };
  const sym = ticker.trim().toUpperCase();
  if (!sym || !isEarningsNotifiableTicker(sym)) return { ok: false, reason: "ineligible" };

  try {
    const result = await refreshStockKeyIndicatorsUncached(sym);
    return { ok: keyIndicatorsResponseIsRenderable(result.indicators) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "warm_failed";
    return { ok: false, reason: message };
  }
}
