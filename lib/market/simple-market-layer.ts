import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SCREENER_MARKET } from "@/lib/data/cache-policy";
import {
  CRYPTO_SCREENER_ALL,
  CRYPTO_SCREENER_PAGE2,
  CRYPTO_TOP10,
  type CryptoMeta,
  cryptoRealtimeRequestSymbols,
  fetchCryptoMarketCapUsdForMeta,
  lastPositiveCloseFromCryptoBars,
  fetchEodhdCryptoDailyBarsForMeta,
  pickCryptoRealtimePayload,
} from "@/lib/market/eodhd-crypto";
import { fetchEodhdRealtimeSymbolsRaw, type EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import { getEodhdApiKey } from "@/lib/env/server";
import { fetchEodhdEodDailyScreener, type EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { deriveMetricsFromDailyBars, eodFetchWindowUtc } from "@/lib/screener/eod-derived-metrics";
import { getScreenerCompaniesStaticLayer } from "@/lib/screener/screener-companies-layers";
import { pickScreenerPage2Tickers } from "@/lib/screener/pick-screener-page2-tickers";
import {
  SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
  SCREENER_EOD_DERIVED_INDEX_CONCURRENCY,
  SCREENER_EOD_DERIVED_STOCK_CONCURRENCY,
} from "@/lib/screener/screener-scale-config";
import { TOP10_TICKERS, type Top10Ticker } from "@/lib/screener/top10-config";
import { SCREENER_INDEX_SYMBOLS } from "@/lib/screener/screener-indices-universe";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

/**
 * EODHD bills per historical EOD symbol; we cannot merge multi-symbol ranges in one HTTP call.
 * Screener stocks: top 10 + every page-2 ticker each get a daily-bars fetch.
 */

export type SimpleMarketDatum = {
  price: number | null;
  previousClose: number | null;
  changePercent1D: number | null;
};

export type SimpleMarketData = {
  stocks: Record<Top10Ticker, SimpleMarketDatum>;
  /**
   * Next screener page: largest US names not on page 1, by cached universe market-cap order.
   * Quotes share the same realtime batch as page 1 (no extra HTTP).
   */
  screenerStocksPage2Tickers: string[];
  /** Uppercase ticker → quote slice for {@link screenerStocksPage2Tickers}. */
  extraScreenerStocks: Record<string, SimpleMarketDatum>;
  /** Screener crypto grid (page 1 + page 2) — keyed by display symbol (e.g. BTC). */
  crypto: Record<string, SimpleMarketDatum>;
  /** Screener + index cards: keyed by full EODHD symbol (e.g. GSPC.INDX). */
  indices: Record<string, SimpleMarketDatum>;
};

export type SimpleScreenerStockDerived = {
  changePercent7D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  last5DailyCloses: number[];
};

/** Top-10 curated rows + screener page-2 tickers (same EOD bar batch). */
export type SimpleScreenerDerived = {
  top10: Record<Top10Ticker, SimpleScreenerStockDerived>;
  /** Uppercase ticker → 1M/YTD/spark from daily bars (matches page 1 derivation). */
  page2: Record<string, SimpleScreenerStockDerived>;
};

export type CryptoDerivedSlice = {
  changePercent7D: number | null;
  changePercent1M: number | null;
  changePercentYTD: number | null;
  last5DailyCloses: number[];
  /** From EODHD crypto fundamentals when available (screener M Cap column). */
  marketCapUsd: number | null;
};

export type SimpleCryptoDerived = Record<string, CryptoDerivedSlice>;

export type SimpleIndicesDerived = Record<string, CryptoDerivedSlice>;

function emptyDatum(): SimpleMarketDatum {
  return { price: null, previousClose: null, changePercent1D: null };
}

function emptyStockDerived(): SimpleScreenerStockDerived {
  return { changePercent7D: null, changePercent1M: null, changePercentYTD: null, last5DailyCloses: [] };
}

function emptyCryptoDerived(): CryptoDerivedSlice {
  return {
    changePercent7D: null,
    changePercent1M: null,
    changePercentYTD: null,
    last5DailyCloses: [],
    marketCapUsd: null,
  };
}

function toDatum(p: EodhdRealtimePayload | undefined): SimpleMarketDatum {
  if (!p) return emptyDatum();
  const priceRaw = typeof p.close === "number" && Number.isFinite(p.close) ? p.close : null;
  const price = priceRaw != null && priceRaw > 0 ? priceRaw : null;
  const previousCloseRaw =
    typeof p.previousClose === "number" && Number.isFinite(p.previousClose) ? p.previousClose : null;
  const previousClose = previousCloseRaw != null && previousCloseRaw > 0 ? previousCloseRaw : null;
  const changeFromApi = typeof p.change_p === "number" && Number.isFinite(p.change_p) ? p.change_p : null;
  const changePercent1D =
    changeFromApi ??
    (price != null && previousClose != null && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null);

  return { price, previousClose, changePercent1D };
}

function buildEmptyMarketData(): SimpleMarketData {
  const stocks = {} as Record<Top10Ticker, SimpleMarketDatum>;
  for (const t of TOP10_TICKERS) stocks[t] = emptyDatum();
  const crypto: Record<string, SimpleMarketDatum> = {};
  for (const c of CRYPTO_SCREENER_ALL) crypto[c.symbol] = emptyDatum();
  const indices: Record<string, SimpleMarketDatum> = {};
  for (const sym of SCREENER_INDEX_SYMBOLS) indices[sym] = emptyDatum();
  return {
    stocks,
    screenerStocksPage2Tickers: [],
    extraScreenerStocks: {},
    crypto,
    indices,
  };
}

type SimpleMarketBatchOpts = {
  /** When false, TOP10 keys are present but quotes are empty (tab-only loads). */
  includeTop10Stocks: boolean;
  page2Tickers: string[];
  includeCrypto: boolean;
  /** When `includeCrypto`: load quotes for page-1 only, page-2 only, or the full screener grid. */
  cryptoBatch: "top10" | "page2" | "all";
  includeIndices: boolean;
};

function cryptoMetasForBatch(mode: "top10" | "page2" | "all"): CryptoMeta[] {
  if (mode === "top10") return [...CRYPTO_TOP10];
  if (mode === "page2") return [...CRYPTO_SCREENER_PAGE2];
  return [...CRYPTO_SCREENER_ALL];
}

/** Realtime batch: configurable US top10, page-2 slice, crypto, indices — chunked EODHD requests. */
async function loadSimpleMarketDataBatch(opts: SimpleMarketBatchOpts): Promise<SimpleMarketData> {
  const { page2Tickers, includeCrypto, cryptoBatch, includeIndices, includeTop10Stocks } = opts;
  const key = getEodhdApiKey();
  const empty = buildEmptyMarketData();
  if (!key) return empty;

  try {
    const symbolList: string[] = [];
    if (includeTop10Stocks) {
      symbolList.push(...TOP10_TICKERS.map((t) => toEodhdUsSymbol(t)));
    }
    symbolList.push(...page2Tickers.map((t) => toEodhdUsSymbol(t)));
    const cryptoMetas = includeCrypto ? cryptoMetasForBatch(cryptoBatch) : [];
    if (includeCrypto) {
      symbolList.push(...cryptoRealtimeRequestSymbols(cryptoMetas));
    }
    if (includeIndices) {
      symbolList.push(...SCREENER_INDEX_SYMBOLS);
    }

    const map = await fetchEodhdRealtimeSymbolsRaw(symbolList);

    const stocks = {} as Record<Top10Ticker, SimpleMarketDatum>;
    for (const t of TOP10_TICKERS) {
      stocks[t] = includeTop10Stocks ? toDatum(map.get(toEodhdUsSymbol(t).toUpperCase())) : emptyDatum();
    }
    const extraScreenerStocks: Record<string, SimpleMarketDatum> = {};
    for (const t of page2Tickers) {
      extraScreenerStocks[t] = toDatum(map.get(toEodhdUsSymbol(t).toUpperCase()));
    }
    const crypto: Record<string, SimpleMarketDatum> = {};
    for (const c of CRYPTO_SCREENER_ALL) {
      crypto[c.symbol] = emptyDatum();
    }
    if (includeCrypto) {
      for (const c of cryptoMetas) {
        crypto[c.symbol] = toDatum(pickCryptoRealtimePayload(map, c));
      }
    }

    const indices: Record<string, SimpleMarketDatum> = {};
    for (const sym of SCREENER_INDEX_SYMBOLS) {
      indices[sym] = includeIndices ? toDatum(map.get(sym.toUpperCase())) : emptyDatum();
    }

    return {
      stocks,
      screenerStocksPage2Tickers: page2Tickers,
      extraScreenerStocks,
      crypto,
      indices,
    };
  } catch {
    return empty;
  }
}

async function loadSimpleMarketDataForPage2Tickers(page2Tickers: string[]): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: true,
    page2Tickers,
    includeCrypto: true,
    cryptoBatch: "all",
    includeIndices: true,
  });
}

async function loadSimpleMarketDataUncached(): Promise<SimpleMarketData> {
  const { universe } = await getScreenerCompaniesStaticLayer();
  const page2Tickers = pickScreenerPage2Tickers(universe);
  return loadSimpleMarketDataForPage2Tickers(page2Tickers);
}

/** Stocks screener only: TOP10 + page-2 quotes — no crypto or index symbols (Gainers/Losers, etc.). */
async function loadSimpleMarketDataScreenerStocksAllPagesUncached(): Promise<SimpleMarketData> {
  const { universe } = await getScreenerCompaniesStaticLayer();
  const page2Tickers = pickScreenerPage2Tickers(universe);
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: true,
    page2Tickers,
    includeCrypto: false,
    cryptoBatch: "all",
    includeIndices: false,
  });
}

/**
 * First-paint screener path: same realtime batch as full data but **without** page-2 stock symbols.
 * Avoids tying the critical path to the full page-2 stock quote batch.
 */
async function loadSimpleMarketDataSlimUncached(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: true,
    page2Tickers: [],
    includeCrypto: true,
    cryptoBatch: "top10",
    includeIndices: true,
  });
}

/** Stocks tab: TOP10 + index benchmarks — no crypto symbols in the realtime batch. */
async function loadSimpleMarketDataScreenerStocksUncached(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: true,
    page2Tickers: [],
    includeCrypto: false,
    cryptoBatch: "all",
    includeIndices: true,
  });
}

/** Crypto tab: crypto quotes only (US stocks + indices empty). */
async function loadSimpleMarketDataCryptoTabUncached(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers: [],
    includeCrypto: true,
    cryptoBatch: "top10",
    includeIndices: false,
  });
}

/** Indices tab: benchmark quotes only. */
async function loadSimpleMarketDataIndicesTabUncached(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers: [],
    includeCrypto: false,
    cryptoBatch: "all",
    includeIndices: true,
  });
}

/**
 * On-demand page-2 slice: quotes for `page2Tickers` only (no TOP10/crypto/indices in the batch).
 * Used by `/api/screener/companies` pagination to avoid the full 30+ symbol quote fan-out.
 */
export async function getSimpleMarketDataForScreenerPage2Slice(page2Tickers: string[]): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers,
    includeCrypto: false,
    cryptoBatch: "all",
    includeIndices: false,
  });
}

/** Screener Crypto tab page 2 — quotes for {@link CRYPTO_SCREENER_PAGE2} only (on-demand pagination). */
export async function getSimpleMarketDataCryptoScreenerPage2(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers: [],
    includeCrypto: true,
    cryptoBatch: "page2",
    includeIndices: false,
  });
}

export const getSimpleMarketData = unstable_cache(loadSimpleMarketDataUncached, ["simple-market-data-v14-crypto50"], {
  /** ~3m batch quote snapshot — scales to many concurrent users under a 4k EODHD/hour budget. */
  revalidate: 180,
});

export const getSimpleMarketDataSlim = unstable_cache(loadSimpleMarketDataSlimUncached, ["simple-market-data-v13-slim-screener-ttl"], {
  revalidate: REVALIDATE_SCREENER_MARKET,
});

export const getSimpleMarketDataScreenerStocks = unstable_cache(
  loadSimpleMarketDataScreenerStocksUncached,
  ["simple-market-data-v16-screener-stocks-tab-ttl"],
  { revalidate: REVALIDATE_SCREENER_MARKET },
);

export const getSimpleMarketDataCryptoTab = unstable_cache(
  loadSimpleMarketDataCryptoTabUncached,
  ["simple-market-data-v16-crypto-tab-ttl"],
  { revalidate: REVALIDATE_SCREENER_MARKET },
);

export const getSimpleMarketDataIndicesTab = unstable_cache(
  loadSimpleMarketDataIndicesTabUncached,
  ["simple-market-data-v16-indices-tab-ttl"],
  { revalidate: REVALIDATE_SCREENER_MARKET },
);

export const getSimpleMarketDataScreenerStocksAllPages = unstable_cache(
  loadSimpleMarketDataScreenerStocksAllPagesUncached,
  ["simple-market-data-v1-screener-stocks-all-pages"],
  { revalidate: REVALIDATE_SCREENER_MARKET },
);

/** Use live quote as "current" price when valid so 1M/YTD match the same snapshot as the Price column. */
function barsToStockDerived(bars: EodhdDailyBar[], livePrice: number | null | undefined): SimpleScreenerStockDerived {
  const empty = emptyStockDerived();
  if (!bars.length) return empty;
  const lastClose = (() => {
    const c = bars[bars.length - 1]?.close;
    return typeof c === "number" && Number.isFinite(c) ? c : null;
  })();
  const currentPrice =
    livePrice != null && Number.isFinite(livePrice) && livePrice > 0 ? livePrice : lastClose;
  if (currentPrice == null) return empty;
  const d = deriveMetricsFromDailyBars(bars, currentPrice);
  return {
    changePercent7D: d.changePercent7D,
    changePercent1M: d.changePercent1M,
    changePercentYTD: d.changePercentYTD,
    last5DailyCloses: d.sparkline5d.length === 5 ? d.sparkline5d : d.sparkline5d.slice(-5),
  };
}

async function loadSimpleScreenerDerivedUncached(): Promise<SimpleScreenerDerived> {
  const window = eodFetchWindowUtc();
  const [{ universe }, marketSlim] = await Promise.all([
    getScreenerCompaniesStaticLayer(),
    getSimpleMarketDataSlim(),
  ]);
  const page2Tickers = pickScreenerPage2Tickers(universe);
  const allTickers = [...TOP10_TICKERS, ...page2Tickers];

  const barsPerTicker = await runWithConcurrencyLimit(
    allTickers,
    SCREENER_EOD_DERIVED_STOCK_CONCURRENCY,
    (t) => fetchEodhdEodDailyScreener(t, window.from, window.to),
  );

  const top10 = {} as Record<Top10Ticker, SimpleScreenerStockDerived>;
  TOP10_TICKERS.forEach((t, i) => {
    const raw = barsPerTicker[i];
    const bars = Array.isArray(raw) ? raw : [];
    const live = marketSlim.stocks[t]?.price ?? null;
    top10[t] = barsToStockDerived(bars, live);
  });

  const page2: Record<string, SimpleScreenerStockDerived> = {};
  page2Tickers.forEach((t, i) => {
    const idx = TOP10_TICKERS.length + i;
    const raw = barsPerTicker[idx];
    const bars = Array.isArray(raw) ? raw : [];
    const tk = t.toUpperCase();
    const live =
      marketSlim.extraScreenerStocks[t] ?? marketSlim.extraScreenerStocks[tk] ?? undefined;
    const livePx = live?.price ?? null;
    page2[tk] = barsToStockDerived(bars, livePx);
  });

  return { top10, page2 };
}

/** Screener Stocks tab first paint: TOP10 EOD metrics only (no page-2 bar fan-out). */
async function loadSimpleScreenerDerivedTop10Uncached(): Promise<SimpleScreenerDerived> {
  const window = eodFetchWindowUtc();
  const marketStocks = await getSimpleMarketDataScreenerStocks();
  const barsPerTicker = await runWithConcurrencyLimit(
    [...TOP10_TICKERS],
    SCREENER_EOD_DERIVED_STOCK_CONCURRENCY,
    (t) => fetchEodhdEodDailyScreener(t, window.from, window.to),
  );
  const top10 = {} as Record<Top10Ticker, SimpleScreenerStockDerived>;
  TOP10_TICKERS.forEach((t, i) => {
    const raw = barsPerTicker[i];
    const bars = Array.isArray(raw) ? raw : [];
    const live = marketStocks.stocks[t]?.price ?? null;
    top10[t] = barsToStockDerived(bars, live);
  });
  return { top10, page2: {} };
}

export const getSimpleScreenerDerived = unstable_cache(
  loadSimpleScreenerDerivedUncached,
  ["simple-screener-derived-v10-page2-90"],
  {
    revalidate: 1800,
  },
);

export const getSimpleScreenerDerivedTop10 = unstable_cache(
  loadSimpleScreenerDerivedTop10Uncached,
  ["simple-screener-derived-top10-v1-live-quote"],
  { revalidate: 1800 },
);

/** EOD-derived rows for an arbitrary US ticker slice (e.g. screener page-2 pagination). */
export async function getSimpleScreenerStockDerivedForTickers(
  tickers: string[],
  marketLive: SimpleMarketData,
): Promise<Record<string, SimpleScreenerStockDerived>> {
  if (!tickers.length) return {};
  const window = eodFetchWindowUtc();
  const barsPerTicker = await runWithConcurrencyLimit(
    tickers,
    SCREENER_EOD_DERIVED_STOCK_CONCURRENCY,
    (t) => fetchEodhdEodDailyScreener(t, window.from, window.to),
  );
  const out: Record<string, SimpleScreenerStockDerived> = {};
  tickers.forEach((t, i) => {
    const raw = barsPerTicker[i];
    const bars = Array.isArray(raw) ? raw : [];
    const tk = t.toUpperCase();
    const live = marketLive.extraScreenerStocks[t] ?? marketLive.extraScreenerStocks[tk];
    out[tk] = barsToStockDerived(bars, live?.price ?? null);
  });
  return out;
}

function barsToCryptoDerived(bars: EodhdDailyBar[]): CryptoDerivedSlice {
  const empty = emptyCryptoDerived();
  if (!bars.length) return empty;
  const c = bars[bars.length - 1]?.close;
  const lastClose = typeof c === "number" && Number.isFinite(c) ? c : null;
  if (lastClose == null || lastClose <= 0) return empty;
  const d = deriveMetricsFromDailyBars(bars, lastClose);
  return {
    changePercent7D: d.changePercent7D,
    changePercent1M: d.changePercent1M,
    changePercentYTD: d.changePercentYTD,
    last5DailyCloses: d.sparkline5d.length === 5 ? d.sparkline5d : d.sparkline5d.slice(-5),
    marketCapUsd: null,
  };
}

async function loadSimpleCryptoDerivedUncached(): Promise<SimpleCryptoDerived> {
  const window = eodFetchWindowUtc();
  const barsList = await runWithConcurrencyLimit(
    CRYPTO_SCREENER_ALL,
    SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
    (c) => fetchEodhdCryptoDailyBarsForMeta(c, window.from, window.to),
  );
  const mcList = await runWithConcurrencyLimit(
    CRYPTO_SCREENER_ALL,
    SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
    (c, i) => {
      const raw = barsList[i];
      const bars = Array.isArray(raw) ? raw : [];
      return fetchCryptoMarketCapUsdForMeta(c, lastPositiveCloseFromCryptoBars(bars));
    },
  );
  const out: SimpleCryptoDerived = {};
  CRYPTO_SCREENER_ALL.forEach((c, i) => {
    const raw = barsList[i];
    const bars = Array.isArray(raw) ? raw : [];
    const mc = typeof mcList[i] === "number" && Number.isFinite(mcList[i]!) ? mcList[i]! : null;
    out[c.symbol] = { ...barsToCryptoDerived(bars), marketCapUsd: mc };
  });
  return out;
}

export const getSimpleCryptoDerived = unstable_cache(loadSimpleCryptoDerivedUncached, ["simple-crypto-derived-v8-fund-meta-cap"], {
  revalidate: 1800,
});

/** Screener Crypto tab page 1 — daily bars for {@link CRYPTO_TOP10} only. */
async function loadSimpleCryptoDerivedTop10Uncached(): Promise<SimpleCryptoDerived> {
  const window = eodFetchWindowUtc();
  const barsList = await runWithConcurrencyLimit(
    CRYPTO_TOP10,
    SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
    (c) => fetchEodhdCryptoDailyBarsForMeta(c, window.from, window.to),
  );
  const mcList = await runWithConcurrencyLimit(
    CRYPTO_TOP10,
    SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
    (c, i) => {
      const raw = barsList[i];
      const bars = Array.isArray(raw) ? raw : [];
      return fetchCryptoMarketCapUsdForMeta(c, lastPositiveCloseFromCryptoBars(bars));
    },
  );
  const out: SimpleCryptoDerived = {};
  CRYPTO_TOP10.forEach((c, i) => {
    const raw = barsList[i];
    const bars = Array.isArray(raw) ? raw : [];
    const mc = typeof mcList[i] === "number" && Number.isFinite(mcList[i]!) ? mcList[i]! : null;
    out[c.symbol] = { ...barsToCryptoDerived(bars), marketCapUsd: mc };
  });
  return out;
}

export const getSimpleCryptoDerivedTop10 = unstable_cache(
  loadSimpleCryptoDerivedTop10Uncached,
  ["simple-crypto-derived-top10-v5-fund-meta-cap"],
  { revalidate: 1800 },
);

/** Daily-bar metrics for an arbitrary crypto meta list (e.g. screener page 2). */
export async function getSimpleCryptoDerivedForMetas(metas: readonly CryptoMeta[]): Promise<SimpleCryptoDerived> {
  if (!metas.length) return {};
  const window = eodFetchWindowUtc();
  const list = [...metas];
  const barsList = await runWithConcurrencyLimit(list, SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY, (c) =>
    fetchEodhdCryptoDailyBarsForMeta(c, window.from, window.to),
  );
  const mcList = await runWithConcurrencyLimit(list, SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY, (c, i) => {
    const raw = barsList[i];
    const bars = Array.isArray(raw) ? raw : [];
    return fetchCryptoMarketCapUsdForMeta(c, lastPositiveCloseFromCryptoBars(bars));
  });
  const out: SimpleCryptoDerived = {};
  metas.forEach((c, i) => {
    const raw = barsList[i];
    const bars = Array.isArray(raw) ? raw : [];
    const mc = typeof mcList[i] === "number" && Number.isFinite(mcList[i]!) ? mcList[i]! : null;
    out[c.symbol] = { ...barsToCryptoDerived(bars), marketCapUsd: mc };
  });
  return out;
}

async function loadSimpleIndicesDerivedUncached(): Promise<SimpleIndicesDerived> {
  const window = eodFetchWindowUtc();
  const barsList = await runWithConcurrencyLimit(
    [...SCREENER_INDEX_SYMBOLS],
    SCREENER_EOD_DERIVED_INDEX_CONCURRENCY,
    (sym) => fetchEodhdEodDailyScreener(sym, window.from, window.to),
  );
  const out: SimpleIndicesDerived = {};
  SCREENER_INDEX_SYMBOLS.forEach((sym, i) => {
    const raw = barsList[i];
    const bars = Array.isArray(raw) ? raw : [];
    out[sym] = barsToCryptoDerived(bars);
  });
  return out;
}

export const getSimpleIndicesDerived = unstable_cache(loadSimpleIndicesDerivedUncached, ["simple-indices-derived-v2"], {
  revalidate: 1800,
});
