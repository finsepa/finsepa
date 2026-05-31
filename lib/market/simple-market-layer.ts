import "server-only";

import { unstable_cache } from "next/cache";

import {
  REVALIDATE_SCREENER_MARKET,
  REVALIDATE_TIER_SCREENER_COMBINED,
  REVALIDATE_TIER_SCREENER_DERIVED,
} from "@/lib/data/cache-policy";
import {
  getScreenerUsMarketCacheEpoch,
  withScreenerUsMarketCache,
} from "@/lib/screener/screener-us-market-cache";
import {
  CRYPTO_SCREENER_ALL,
  CRYPTO_SCREENER_PAGE2,
  CRYPTO_TOP10,
  type CryptoMeta,
  cryptoRealtimeRequestSymbols,
  fetchCryptoMarketCapUsdForMeta,
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
import { getScreenerEtfsTop20, screenerEtfTickers } from "@/lib/screener/screener-etfs-universe";
import { SCREENER_INDEX_SYMBOLS } from "@/lib/screener/screener-indices-universe";
import { toEodhdUsSymbol } from "@/lib/market/eodhd-symbol";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";
import { MARKET_SNAPSHOT_KEY } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshot, readMarketSnapshotSlow } from "@/lib/market/market-snapshot-store";
import { readCryptoDerivedSnapshot, upsertCryptoDerivedSnapshot } from "@/lib/market/crypto-derived-snapshot";
import {
  mergeWatchlistStockMarketSlice,
  pickScreenerDerivedForTickers,
  sliceSimpleMarketDataForStockTickers,
  stockTickersMissingFromMarketSlice,
  sliceSimpleMarketDataScreenerStocksPage1,
} from "@/lib/market/market-snapshot-slice";

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

export type SimpleEtfsDerived = Record<string, CryptoDerivedSlice>;

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

function datumFromEodDailyBars(bars: EodhdDailyBar[]): SimpleMarketDatum {
  if (!bars.length) return emptyDatum();
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1]!;
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2]! : null;
  const price = typeof last.close === "number" && Number.isFinite(last.close) && last.close > 0 ? last.close : null;
  const previousClose =
    prev && typeof prev.close === "number" && Number.isFinite(prev.close) && prev.close > 0 ? prev.close : null;
  const changePercent1D =
    price != null && previousClose != null && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null;
  return { price, previousClose, changePercent1D };
}

function toDatum(p: EodhdRealtimePayload | undefined): SimpleMarketDatum {
  if (!p) return emptyDatum();
  const asFinite = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const priceRaw = asFinite(p.close);
  const price = priceRaw != null && priceRaw > 0 ? priceRaw : null;
  const previousCloseRaw = asFinite(p.previousClose);
  const previousClose = previousCloseRaw != null && previousCloseRaw > 0 ? previousCloseRaw : null;
  const changeFromApi = asFinite(p.change_p);
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

async function loadUsStockDatumsFromEodDaily(
  includeTop10Stocks: boolean,
  page2Tickers: string[],
): Promise<{ stocks: Record<Top10Ticker, SimpleMarketDatum>; extraScreenerStocks: Record<string, SimpleMarketDatum> }> {
  const tickers: string[] = [];
  if (includeTop10Stocks) tickers.push(...TOP10_TICKERS);
  tickers.push(...page2Tickers);
  const barsPerTicker = tickers.length ? await getCachedScreenerEodBarsForTickers(tickers) : [];

  const stocks = {} as Record<Top10Ticker, SimpleMarketDatum>;
  for (const t of TOP10_TICKERS) {
    stocks[t] = emptyDatum();
  }
  if (includeTop10Stocks) {
    TOP10_TICKERS.forEach((t, i) => {
      const raw = barsPerTicker[i];
      stocks[t] = datumFromEodDailyBars(Array.isArray(raw) ? raw : []);
    });
  }

  const extraScreenerStocks: Record<string, SimpleMarketDatum> = {};
  const topLen = includeTop10Stocks ? TOP10_TICKERS.length : 0;
  page2Tickers.forEach((t, i) => {
    const raw = barsPerTicker[topLen + i];
    extraScreenerStocks[t] = datumFromEodDailyBars(Array.isArray(raw) ? raw : []);
  });
  return { stocks, extraScreenerStocks };
}

async function loadIndexDatumsFromEodDaily(): Promise<Record<string, SimpleMarketDatum>> {
  const window = eodFetchWindowUtc();
  const { fetchEodhdEodDaily } = await import("@/lib/market/eodhd-eod");
  const barsPerSymbol = await runWithConcurrencyLimit(
    [...SCREENER_INDEX_SYMBOLS],
    SCREENER_EOD_DERIVED_INDEX_CONCURRENCY,
    (sym) => fetchEodhdEodDaily(sym, window.from, window.to),
  );
  const indices: Record<string, SimpleMarketDatum> = {};
  SCREENER_INDEX_SYMBOLS.forEach((sym, i) => {
    const raw = barsPerSymbol[i];
    indices[sym] = datumFromEodDailyBars(Array.isArray(raw) ? raw : []);
  });
  return indices;
}

/** Realtime batch: configurable US top10, page-2 slice, crypto, indices — chunked EODHD requests. */
async function loadSimpleMarketDataBatch(opts: SimpleMarketBatchOpts): Promise<SimpleMarketData> {
  const { page2Tickers, includeCrypto, cryptoBatch, includeIndices, includeTop10Stocks } = opts;
  const key = getEodhdApiKey();
  const empty = buildEmptyMarketData();
  if (!key) return empty;

  const epoch = getScreenerUsMarketCacheEpoch();
  const usStocksNeeded = includeTop10Stocks || page2Tickers.length > 0;

  if (epoch.mode === "frozen" && (usStocksNeeded || includeIndices)) {
    try {
      const [stockQuotes, indexQuotes] = await Promise.all([
        usStocksNeeded ? loadUsStockDatumsFromEodDaily(includeTop10Stocks, page2Tickers) : null,
        includeIndices ? loadIndexDatumsFromEodDaily() : null,
      ]);

      const crypto: Record<string, SimpleMarketDatum> = {};
      for (const c of CRYPTO_SCREENER_ALL) crypto[c.symbol] = emptyDatum();
      if (includeCrypto) {
        const cryptoMetas = cryptoMetasForBatch(cryptoBatch);
        const symbolList = cryptoRealtimeRequestSymbols(cryptoMetas);
        const map = await fetchEodhdRealtimeSymbolsRaw(symbolList);
        for (const c of cryptoMetas) {
          crypto[c.symbol] = toDatum(pickCryptoRealtimePayload(map, c));
        }
      }

      const indices: Record<string, SimpleMarketDatum> = {};
      for (const sym of SCREENER_INDEX_SYMBOLS) {
        indices[sym] = indexQuotes?.[sym] ?? emptyDatum();
      }

      return {
        stocks: stockQuotes?.stocks ?? empty.stocks,
        screenerStocksPage2Tickers: page2Tickers,
        extraScreenerStocks: stockQuotes?.extraScreenerStocks ?? {},
        crypto,
        indices,
      };
    } catch {
      return empty;
    }
  }

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
      const sym = toEodhdUsSymbol(t).toUpperCase();
      const payload =
        map.get(sym) ??
        // Some EODHD realtime responses return `code` without exchange suffix (e.g. `AAPL`).
        map.get(sym.replace(/\.US$/i, "")) ??
        // Others may normalize `.` to `-` differently depending on endpoint.
        map.get(sym.replace(/\.US$/i, "").replace(/\./g, "-"));
      stocks[t] = includeTop10Stocks ? toDatum(payload) : emptyDatum();
    }
    const extraScreenerStocks: Record<string, SimpleMarketDatum> = {};
    for (const t of page2Tickers) {
      const sym = toEodhdUsSymbol(t).toUpperCase();
      const payload =
        map.get(sym) ??
        map.get(sym.replace(/\.US$/i, "")) ??
        map.get(sym.replace(/\.US$/i, "").replace(/\./g, "-"));
      extraScreenerStocks[t] = toDatum(payload);
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
      const k = sym.toUpperCase();
      const payload = map.get(k) ?? map.get(k.split(".")[0] ?? k);
      indices[sym] = includeIndices ? toDatum(payload) : emptyDatum();
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
    includeIndices: false,
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

/** ETFs tab: live quotes for top ETF tickers only. */
async function loadSimpleMarketDataEtfsTabUncached(): Promise<SimpleMarketData> {
  const metas = await getScreenerEtfsTop20();
  const etfTickers = screenerEtfTickers(metas);
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers: etfTickers,
    includeCrypto: false,
    cryptoBatch: "all",
    includeIndices: false,
  });
}

/**
 * On-demand page-2 slice: quotes for `page2Tickers` only (no TOP10/crypto/indices in the batch).
 * Used by `/api/screener/companies` pagination to avoid the full 30+ symbol quote fan-out.
 */
export async function getSimpleMarketDataForScreenerPage2Slice(page2Tickers: string[]): Promise<SimpleMarketData> {
  const fromSnapshot = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.stocksAllPages);
  if (fromSnapshot) return sliceSimpleMarketDataForStockTickers(fromSnapshot, page2Tickers);

  const tickersKey = [...page2Tickers]
    .map((t) => t.trim().toUpperCase())
    .sort()
    .join(",");
  return withScreenerUsMarketCache(
    "simple-market-data-page2-slice-v1",
    () =>
      loadSimpleMarketDataBatch({
        includeTop10Stocks: false,
        page2Tickers,
        includeCrypto: false,
        cryptoBatch: "all",
        includeIndices: false,
      }),
    [tickersKey],
  );
}

/** Watchlist rail/page: quotes for saved stock tickers only (top-10 batch + page-2 slice). */
export async function getSimpleMarketDataForWatchlistStocks(stockTickers: string[]): Promise<SimpleMarketData> {
  const normalized = [...new Set(stockTickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].sort();
  const fromSnapshot = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.stocksAllPages);
  if (fromSnapshot && normalized.length) {
    const sliced = sliceSimpleMarketDataForStockTickers(fromSnapshot, normalized);
    const missing = stockTickersMissingFromMarketSlice(sliced, normalized);
    if (!missing.length) return sliced;

    const top10Set = new Set<string>(TOP10_TICKERS);
    const includeTop10Stocks = missing.some((t) => top10Set.has(t));
    const page2Tickers = missing.filter((t) => !top10Set.has(t));
    const tickersKey = missing.join(",");
    const fetched = await withScreenerUsMarketCache(
      "simple-market-data-watchlist-stocks-off-universe-v1",
      () =>
        loadSimpleMarketDataBatch({
          includeTop10Stocks,
          page2Tickers,
          includeCrypto: false,
          cryptoBatch: "all",
          includeIndices: false,
        }),
      [tickersKey],
    );
    return mergeWatchlistStockMarketSlice(sliced, fetched);
  }
  if (!normalized.length) {
    return loadSimpleMarketDataBatch({
      includeTop10Stocks: false,
      page2Tickers: [],
      includeCrypto: false,
      cryptoBatch: "all",
      includeIndices: false,
    });
  }
  const top10Set = new Set<string>(TOP10_TICKERS);
  const includeTop10Stocks = normalized.some((t) => top10Set.has(t));
  const page2Tickers = normalized.filter((t) => !top10Set.has(t));
  const tickersKey = normalized.join(",");
  return withScreenerUsMarketCache(
    "simple-market-data-watchlist-stocks-v2",
    () =>
      loadSimpleMarketDataBatch({
        includeTop10Stocks,
        page2Tickers,
        includeCrypto: false,
        cryptoBatch: "all",
        includeIndices: false,
      }),
    [tickersKey],
  );
}

/** Screener Crypto tab page 2 — quotes for {@link CRYPTO_SCREENER_PAGE2} only (on-demand pagination). */
export async function getSimpleMarketDataCryptoScreenerPage2(): Promise<SimpleMarketData> {
  const snap = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.cryptoPage2);
  if (snap) return snap;
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers: [],
    includeCrypto: true,
    cryptoBatch: "page2",
    includeIndices: false,
  });
}

export const getSimpleMarketData = unstable_cache(loadSimpleMarketDataUncached, ["simple-market-data-v15-stocks500"], {
  /** ~3m batch quote snapshot — scales to many concurrent users under a 4k EODHD/hour budget. */
  revalidate: REVALIDATE_TIER_SCREENER_COMBINED,
});

export async function getSimpleMarketDataSlim(): Promise<SimpleMarketData> {
  return withScreenerUsMarketCache("simple-market-data-v14-slim-session", () => loadSimpleMarketDataSlimUncached());
}

export async function getSimpleMarketDataScreenerStocks(): Promise<SimpleMarketData> {
  const fromSnapshot = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.stocksAllPages);
  if (fromSnapshot) return sliceSimpleMarketDataScreenerStocksPage1(fromSnapshot);
  return withScreenerUsMarketCache(
    "simple-market-data-v17-screener-stocks-session",
    () => loadSimpleMarketDataScreenerStocksUncached(),
  );
}

async function getSimpleMarketDataCryptoTabCached(): Promise<SimpleMarketData> {
  return unstable_cache(
    loadSimpleMarketDataCryptoTabUncached,
    ["simple-market-data-v16-crypto-tab-ttl"],
    { revalidate: REVALIDATE_SCREENER_MARKET },
  )();
}

export async function getSimpleMarketDataCryptoTab(): Promise<SimpleMarketData> {
  const snap = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.cryptoTab);
  if (snap) return snap;
  return getSimpleMarketDataCryptoTabCached();
}

export async function getSimpleMarketDataIndicesTab(): Promise<SimpleMarketData> {
  const snap = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.indicesTab);
  if (snap) return snap;
  return withScreenerUsMarketCache(
    "simple-market-data-v17-indices-tab-session",
    () => loadSimpleMarketDataIndicesTabUncached(),
  );
}

export async function getSimpleMarketDataEtfsTab(): Promise<SimpleMarketData> {
  return withScreenerUsMarketCache("simple-market-data-v2-etfs-tab-session", () => loadSimpleMarketDataEtfsTabUncached());
}

export async function getSimpleMarketDataScreenerStocksAllPages(): Promise<SimpleMarketData> {
  const fromSnapshot = await readMarketSnapshot<SimpleMarketData>(MARKET_SNAPSHOT_KEY.stocksAllPages);
  if (fromSnapshot) return fromSnapshot;
  return withScreenerUsMarketCache(
    "simple-market-data-v3-screener-stocks-all-pages-session",
    () => loadSimpleMarketDataScreenerStocksAllPagesUncached(),
  );
}

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
  const [{ universe }, marketSlim] = await Promise.all([
    getScreenerCompaniesStaticLayer(),
    getSimpleMarketDataSlim(),
  ]);
  const page2Tickers = pickScreenerPage2Tickers(universe);
  const allTickers = [...TOP10_TICKERS, ...page2Tickers];

  const barsPerTicker = await getCachedScreenerEodBarsForTickers(allTickers);

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
  const [marketStocks, barsPerTicker] = await Promise.all([
    getSimpleMarketDataScreenerStocks(),
    getCachedScreenerEodBarsForTickers([...TOP10_TICKERS]),
  ]);
  const top10 = {} as Record<Top10Ticker, SimpleScreenerStockDerived>;
  TOP10_TICKERS.forEach((t, i) => {
    const raw = barsPerTicker[i];
    const bars = Array.isArray(raw) ? raw : [];
    const live = marketStocks.stocks[t]?.price ?? null;
    top10[t] = barsToStockDerived(bars, live);
  });
  return { top10, page2: {} };
}

export async function getSimpleScreenerDerived(): Promise<SimpleScreenerDerived> {
  const snap = await readMarketSnapshotSlow<SimpleScreenerDerived>(MARKET_SNAPSHOT_KEY.screenerDerived);
  if (snap) return snap;
  return withScreenerUsMarketCache("simple-screener-derived-v12-session", () => loadSimpleScreenerDerivedUncached());
}

export async function getSimpleScreenerDerivedTop10(): Promise<SimpleScreenerDerived> {
  return withScreenerUsMarketCache(
    "simple-screener-derived-top10-v2-session",
    () => loadSimpleScreenerDerivedTop10Uncached(),
  );
}

async function fetchScreenerEodBarsOnce(tickers: string[]): Promise<(EodhdDailyBar[] | null)[]> {
  if (!tickers.length) return [];
  const window = eodFetchWindowUtc();
  return runWithConcurrencyLimit(tickers, SCREENER_EOD_DERIVED_STOCK_CONCURRENCY, (t) =>
    fetchEodhdEodDailyScreener(t, window.from, window.to),
  );
}

async function fetchScreenerEodBarsForTickers(tickers: string[]): Promise<(EodhdDailyBar[] | null)[]> {
  const barsPerTicker = await fetchScreenerEodBarsOnce(tickers);
  const retryIndices: number[] = [];
  tickers.forEach((_, i) => {
    const raw = barsPerTicker[i];
    if (!Array.isArray(raw) || raw.length === 0) retryIndices.push(i);
  });
  if (!retryIndices.length) return barsPerTicker;

  const retryTickers = retryIndices.map((i) => tickers[i]!);
  const retryBars = await fetchScreenerEodBarsOnce(retryTickers);
  retryIndices.forEach((origIdx, j) => {
    const retryRaw = retryBars[j];
    if (Array.isArray(retryRaw) && retryRaw.length > 0) barsPerTicker[origIdx] = retryRaw;
  });
  return barsPerTicker;
}

/** Per-ticker EOD bars — shared across market quotes and derived metrics in the same US session segment. */
function getCachedScreenerEodBarsForTickers(tickers: string[]): Promise<(EodhdDailyBar[] | null)[]> {
  const tickersKey = [...tickers]
    .map((t) => t.trim().toUpperCase())
    .sort()
    .join(",");
  return withScreenerUsMarketCache(
    "screener-eod-bars-v1",
    () => fetchScreenerEodBarsForTickers(tickers),
    [tickersKey],
  );
}

function tickerNeedsEodDerivedPct(u: { refund1mP: number | null; refundYtdP: number | null; adjustedClose?: number | null } | undefined): boolean {
  if (!u) return true;
  const has1m = u.refund1mP != null && Number.isFinite(u.refund1mP);
  const hasYtd = u.refundYtdP != null && Number.isFinite(u.refundYtdP);
  const hasClose = u.adjustedClose != null && Number.isFinite(u.adjustedClose) && u.adjustedClose > 0;
  return !has1m || !hasYtd || !hasClose;
}

/**
 * EOD-derived 1M/YTD for a ticker slice (pagination / industry drill).
 * Skips daily-bar HTTP when the screener universe row already has both snapshot fields.
 */
async function loadSimpleScreenerStockDerivedForTickersUncached(
  tickers: string[],
  marketLive: SimpleMarketData,
  universeRows?: readonly { ticker: string; refund1mP: number | null; refundYtdP: number | null; adjustedClose?: number | null }[],
): Promise<Record<string, SimpleScreenerStockDerived>> {
  if (!tickers.length) return {};
  const byTicker = universeRows
    ? new Map(universeRows.map((u) => [u.ticker.trim().toUpperCase(), u] as const))
    : null;

  const eodTickers = tickers.filter((t) => tickerNeedsEodDerivedPct(byTicker?.get(t.trim().toUpperCase())));

  const barsByUpper = new Map<string, EodhdDailyBar[]>();
  if (eodTickers.length) {
    const barsPerTicker = await getCachedScreenerEodBarsForTickers(eodTickers);
    eodTickers.forEach((t, i) => {
      const raw = barsPerTicker[i];
      barsByUpper.set(t.trim().toUpperCase(), Array.isArray(raw) ? raw : []);
    });
  }

  const epoch = getScreenerUsMarketCacheEpoch();
  const out: Record<string, SimpleScreenerStockDerived> = {};
  tickers.forEach((t) => {
    const tk = t.toUpperCase();
    const bars = barsByUpper.get(tk) ?? [];
    const live = marketLive.extraScreenerStocks[t] ?? marketLive.extraScreenerStocks[tk];
    const livePx = epoch.mode === "frozen" ? null : (live?.price ?? null);
    out[tk] = barsToStockDerived(bars, livePx);
  });
  return out;
}

export async function getSimpleScreenerStockDerivedForTickers(
  tickers: string[],
  marketLive: SimpleMarketData,
  universeRows?: readonly { ticker: string; refund1mP: number | null; refundYtdP: number | null }[],
): Promise<Record<string, SimpleScreenerStockDerived>> {
  const fromSnapshot = await readMarketSnapshotSlow<SimpleScreenerDerived>(MARKET_SNAPSHOT_KEY.screenerDerived);
  if (fromSnapshot) return pickScreenerDerivedForTickers(fromSnapshot, tickers);

  const tickersKey = [...tickers]
    .map((t) => t.trim().toUpperCase())
    .sort()
    .join(",");
  return withScreenerUsMarketCache(
    "screener-stock-derived-slice-v1",
    () => loadSimpleScreenerStockDerivedForTickersUncached(tickers, marketLive, universeRows),
    [tickersKey],
  );
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

async function cryptoDerivedForMeta(meta: CryptoMeta, from: string, to: string): Promise<CryptoDerivedSlice> {
  const cached = await readCryptoDerivedSnapshot(meta.symbol);
  if (cached !== undefined && cached) return { ...cached, marketCapUsd: null };
  if (cached !== undefined && cached === null) return emptyCryptoDerived();

  const raw = await fetchEodhdCryptoDailyBarsForMeta(meta, from, to);
  const bars = Array.isArray(raw) ? raw : [];
  const derived = barsToCryptoDerived(bars);
  const snap = {
    changePercent7D: derived.changePercent7D,
    changePercent1M: derived.changePercent1M,
    changePercentYTD: derived.changePercentYTD,
    last5DailyCloses: derived.last5DailyCloses,
  };
  void upsertCryptoDerivedSnapshot(meta.symbol, snap);
  return derived;
}

async function loadSimpleCryptoDerivedUncached(): Promise<SimpleCryptoDerived> {
  const window = eodFetchWindowUtc();
  const derivedList = await runWithConcurrencyLimit(
    CRYPTO_SCREENER_ALL,
    SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
    (c) => cryptoDerivedForMeta(c, window.from, window.to),
  );
  const mcList = await runWithConcurrencyLimit(CRYPTO_SCREENER_ALL, SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY, (c, i) => {
    const d = derivedList[i];
    const lastClose = d?.last5DailyCloses?.length ? d.last5DailyCloses[d.last5DailyCloses.length - 1]! : null;
    return fetchCryptoMarketCapUsdForMeta(c, typeof lastClose === "number" ? lastClose : null);
  });
  const out: SimpleCryptoDerived = {};
  CRYPTO_SCREENER_ALL.forEach((c, i) => {
    const mc = typeof mcList[i] === "number" && Number.isFinite(mcList[i]!) ? mcList[i]! : null;
    out[c.symbol] = { ...(derivedList[i] ?? emptyCryptoDerived()), marketCapUsd: mc };
  });
  return out;
}

async function getSimpleCryptoDerivedCached(): Promise<SimpleCryptoDerived> {
  return unstable_cache(loadSimpleCryptoDerivedUncached, ["simple-crypto-derived-v9-ton-pol-eodhd"], {
    revalidate: REVALIDATE_TIER_SCREENER_DERIVED,
  })();
}

export async function getSimpleCryptoDerived(): Promise<SimpleCryptoDerived> {
  const snap = await readMarketSnapshotSlow<SimpleCryptoDerived>(MARKET_SNAPSHOT_KEY.cryptoDerived);
  if (snap) return snap;
  return getSimpleCryptoDerivedCached();
}

/** Screener Crypto tab page 1 — daily bars for {@link CRYPTO_TOP10} only. */
async function loadSimpleCryptoDerivedTop10Uncached(): Promise<SimpleCryptoDerived> {
  const window = eodFetchWindowUtc();
  const derivedList = await runWithConcurrencyLimit(
    CRYPTO_TOP10,
    SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY,
    (c) => cryptoDerivedForMeta(c, window.from, window.to),
  );
  const mcList = await runWithConcurrencyLimit(CRYPTO_TOP10, SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY, (c, i) => {
    const d = derivedList[i];
    const lastClose = d?.last5DailyCloses?.length ? d.last5DailyCloses[d.last5DailyCloses.length - 1]! : null;
    return fetchCryptoMarketCapUsdForMeta(c, typeof lastClose === "number" ? lastClose : null);
  });
  const out: SimpleCryptoDerived = {};
  CRYPTO_TOP10.forEach((c, i) => {
    const mc = typeof mcList[i] === "number" && Number.isFinite(mcList[i]!) ? mcList[i]! : null;
    out[c.symbol] = { ...(derivedList[i] ?? emptyCryptoDerived()), marketCapUsd: mc };
  });
  return out;
}

export const getSimpleCryptoDerivedTop10 = unstable_cache(
  loadSimpleCryptoDerivedTop10Uncached,
  ["simple-crypto-derived-top10-v6-ton-pol-eodhd"],
  { revalidate: REVALIDATE_TIER_SCREENER_DERIVED },
);

/** Daily-bar metrics for an arbitrary crypto meta list (e.g. screener page 2). */
export async function getSimpleCryptoDerivedForMetas(metas: readonly CryptoMeta[]): Promise<SimpleCryptoDerived> {
  if (!metas.length) return {};
  const metasKey = [...metas]
    .map((m) => m.symbol.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(",");

  return withScreenerUsMarketCache(
    "simple-crypto-derived-metas-v1",
    async () => {
      const window = eodFetchWindowUtc();
      const list = [...metas];
      const derivedList = await runWithConcurrencyLimit(list, SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY, (c) =>
        cryptoDerivedForMeta(c, window.from, window.to),
      );
      const mcList = await runWithConcurrencyLimit(list, SCREENER_EOD_DERIVED_CRYPTO_CONCURRENCY, (c, i) => {
        const d = derivedList[i];
        const lastClose = d?.last5DailyCloses?.length ? d.last5DailyCloses[d.last5DailyCloses.length - 1]! : null;
        return fetchCryptoMarketCapUsdForMeta(c, typeof lastClose === "number" ? lastClose : null);
      });
      const out: SimpleCryptoDerived = {};
      metas.forEach((c, i) => {
        const mc = typeof mcList[i] === "number" && Number.isFinite(mcList[i]!) ? mcList[i]! : null;
        out[c.symbol] = { ...(derivedList[i] ?? emptyCryptoDerived()), marketCapUsd: mc };
      });
      return out;
    },
    [metasKey],
  );
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

export async function getSimpleIndicesDerived(): Promise<SimpleIndicesDerived> {
  const snap = await readMarketSnapshotSlow<SimpleIndicesDerived>(MARKET_SNAPSHOT_KEY.indicesDerived);
  if (snap) return snap;
  return withScreenerUsMarketCache("simple-indices-derived-v3-session", () => loadSimpleIndicesDerivedUncached());
}

async function loadSimpleEtfsDerivedUncached(): Promise<SimpleEtfsDerived> {
  const metas = await getScreenerEtfsTop20();
  const tickers = screenerEtfTickers(metas);
  if (!tickers.length) return {};

  const window = eodFetchWindowUtc();
  const barsList = await runWithConcurrencyLimit(tickers, SCREENER_EOD_DERIVED_STOCK_CONCURRENCY, (t) =>
    fetchEodhdEodDailyScreener(toEodhdUsSymbol(t), window.from, window.to),
  );
  const out: SimpleEtfsDerived = {};
  tickers.forEach((tk, i) => {
    const raw = barsList[i];
    const bars = Array.isArray(raw) ? raw : [];
    out[tk] = barsToCryptoDerived(bars);
  });
  return out;
}

export async function getSimpleEtfsDerived(): Promise<SimpleEtfsDerived> {
  return withScreenerUsMarketCache("simple-etfs-derived-v2-session", () => loadSimpleEtfsDerivedUncached());
}

// --- Cron ingest (EODHD → Supabase; bypasses snapshot reads above) ---

export async function buildMarketSnapshotStocksAllPagesForIngest(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataScreenerStocksAllPagesUncached();
}

export async function buildMarketSnapshotScreenerDerivedForIngest(): Promise<SimpleScreenerDerived> {
  return loadSimpleScreenerDerivedUncached();
}

export async function buildMarketSnapshotCryptoTabForIngest(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataCryptoTabUncached();
}

export async function buildMarketSnapshotCryptoPage2ForIngest(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataBatch({
    includeTop10Stocks: false,
    page2Tickers: [],
    includeCrypto: true,
    cryptoBatch: "page2",
    includeIndices: false,
  });
}

export async function buildMarketSnapshotCryptoDerivedForIngest(): Promise<SimpleCryptoDerived> {
  return loadSimpleCryptoDerivedUncached();
}

export async function buildMarketSnapshotIndicesTabForIngest(): Promise<SimpleMarketData> {
  return loadSimpleMarketDataIndicesTabUncached();
}

export async function buildMarketSnapshotIndicesDerivedForIngest(): Promise<SimpleIndicesDerived> {
  return loadSimpleIndicesDerivedUncached();
}
