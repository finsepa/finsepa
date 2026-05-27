import "server-only";

import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import type { WatchlistRow } from "@/lib/watchlist/types";
import { getCryptoAsset } from "@/lib/market/crypto-asset";
import { ALL_CRYPTO_METAS, CRYPTO_SCREENER_ALL, toSupportedCryptoTicker } from "@/lib/market/eodhd-crypto";
import type { EodhdRealtimePayload } from "@/lib/market/eodhd-realtime";
import {
  getSimpleCryptoDerivedForMetas,
  getSimpleIndicesDerived,
  getSimpleMarketDataCryptoScreenerPage2,
  getSimpleMarketDataCryptoTab,
  getSimpleMarketDataIndicesTab,
  getSimpleMarketDataForWatchlistStocks,
  getSimpleScreenerStockDerivedForTickers,
  type SimpleCryptoDerived,
  type SimpleMarketData,
  type SimpleMarketDatum,
  type SimpleScreenerStockDerived,
} from "@/lib/market/simple-market-layer";
import {
  buildScreenerCompanyRowFromUniverse,
  screenerPeDisplayFromUniverse,
} from "@/lib/screener/companies-rows";
import { getScreenerCompaniesStaticLayer, type ScreenerCompanyIdentity } from "@/lib/screener/screener-companies-layers";
import { resolveEquityLogoUrlFromTicker } from "@/lib/screener/resolve-equity-logo-url";
import type { EodhdTopUniverseRow } from "@/lib/market/eodhd-screener";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { isTop10Ticker } from "@/lib/screener/top10-config";
import { SCREENER_INDEX_SYMBOL_SET } from "@/lib/screener/screener-indices-universe";
import { getIndexDisplayMeta } from "@/lib/market/indices-top10";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { withScreenerUsMarketCache } from "@/lib/screener/screener-us-market-cache";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaPerformance, getNvdaHeaderMeta } from "@/lib/fixtures/nvda";

/** Caps parallel work when the watchlist has many symbols. */
const WATCHLIST_ENRICH_CONCURRENCY = 8;

export function parseWatchlistStorageKey(key: string): { kind: "stock" | "crypto" | "index"; symbol: string } {
  const t = key.trim().toUpperCase();
  if (t.startsWith(WATCHLIST_CRYPTO_PREFIX)) {
    return { kind: "crypto", symbol: t.slice(WATCHLIST_CRYPTO_PREFIX.length).trim() || "?" };
  }
  if (t.startsWith(WATCHLIST_INDEX_PREFIX)) {
    return { kind: "index", symbol: t.slice(WATCHLIST_INDEX_PREFIX.length).trim() || "?" };
  }
  return { kind: "stock", symbol: t };
}

function simpleDatumToQuote(d: SimpleMarketDatum | undefined): EodhdRealtimePayload | undefined {
  if (!d || d.price == null) return undefined;
  return {
    close: d.price,
    previousClose: d.previousClose ?? undefined,
    change_p: d.changePercent1D ?? undefined,
  };
}

function pickPct(snapshot: number | null | undefined, derived: number | null | undefined): number | null {
  if (snapshot != null && Number.isFinite(snapshot)) return snapshot;
  if (derived != null && Number.isFinite(derived)) return derived;
  return null;
}

type WatchlistStockBatch = {
  identityByTicker: Record<string, ScreenerCompanyIdentity>;
  universeByTicker: Map<string, EodhdTopUniverseRow>;
  marketData: SimpleMarketData;
  derivedByTicker: Record<string, SimpleScreenerStockDerived>;
};

async function buildWatchlistStockBatch(stockTickers: string[]): Promise<WatchlistStockBatch> {
  const staticLayer = await getScreenerCompaniesStaticLayer();
  const universeByTicker = new Map(staticLayer.universe.map((u) => [u.ticker.trim().toUpperCase(), u] as const));
  if (!stockTickers.length) {
    return {
      identityByTicker: staticLayer.identityByTicker,
      universeByTicker,
      marketData: {
        stocks: {} as SimpleMarketData["stocks"],
        extraScreenerStocks: {},
        screenerStocksPage2Tickers: [],
        crypto: {},
        indices: {},
      },
      derivedByTicker: {},
    };
  }
  const marketData = await getSimpleMarketDataForWatchlistStocks(stockTickers);
  const derivedByTicker = await getSimpleScreenerStockDerivedForTickers(
    stockTickers,
    marketData,
    staticLayer.universe,
  );
  return {
    identityByTicker: staticLayer.identityByTicker,
    universeByTicker,
    marketData,
    derivedByTicker,
  };
}

function stockDatum(batch: WatchlistStockBatch, ticker: string): SimpleMarketDatum | undefined {
  const tk = ticker.trim().toUpperCase();
  if (isTop10Ticker(tk)) return batch.marketData.stocks[tk];
  return batch.marketData.extraScreenerStocks[tk] ?? batch.marketData.extraScreenerStocks[ticker];
}

function enrichStockWithBatch(entry: WatchlistRow, batch: WatchlistStockBatch): WatchlistEnrichedItem {
  const ticker = entry.ticker.trim().toUpperCase();
  const meta = getStockDetailMetaFromTicker(ticker);
  const identity = batch.identityByTicker[ticker];
  const u = batch.universeByTicker.get(ticker);
  const datum = stockDatum(batch, ticker);
  const derived = batch.derivedByTicker[ticker] ?? null;
  const logoUrl =
    identity?.logoUrl?.trim() || resolveEquityLogoUrlFromTicker(ticker).trim() || meta.logoUrl?.trim() || null;

  if (u) {
    const row = buildScreenerCompanyRowFromUniverse(
      u,
      0,
      simpleDatumToQuote(datum),
      logoUrl ?? "",
      derived,
      screenerPeDisplayFromUniverse(u),
    );
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: meta.ticker,
      name: identity?.name ?? row.name,
      kind: "stock",
      href: `/stock/${encodeURIComponent(meta.ticker)}`,
      logoUrl,
      price: row.price,
      pct1d: row.change1D,
      pct1m: row.change1M,
      ytd: row.changeYTD,
      mcapDisplay: row.marketCap,
      peDisplay: row.pe,
      earningsDisplay: "-",
    };
  }

  const price = datum?.price ?? null;
  const pct1d = datum?.changePercent1D ?? null;
  const pct1m = pickPct(null, derived?.changePercent1M);
  const ytd = pickPct(null, derived?.changePercentYTD);

  return {
    entryId: entry.id,
    storageKey: entry.ticker,
    symbol: meta.ticker,
    name: identity?.name ?? meta.name,
    kind: "stock",
    href: `/stock/${encodeURIComponent(meta.ticker)}`,
    logoUrl,
    price,
    pct1d,
    pct1m,
    ytd,
    mcapDisplay: "-",
    peDisplay: "-",
    earningsDisplay: "-",
  };
}

async function enrichStock(entry: WatchlistRow, batch: WatchlistStockBatch | null): Promise<WatchlistEnrichedItem> {
  if (batch) return enrichStockWithBatch(entry, batch);

  const ticker = entry.ticker.trim().toUpperCase();
  const meta = getStockDetailMetaFromTicker(ticker);

  if (isSingleAssetMode()) {
    if (isSupportedAsset(ticker)) {
      const perf = getNvdaPerformance();
      const header = getNvdaHeaderMeta();
      return {
        entryId: entry.id,
        storageKey: entry.ticker,
        symbol: perf.ticker,
        name: meta.name,
        kind: "stock",
        href: `/stock/${encodeURIComponent(meta.ticker)}`,
        logoUrl: (header.logoUrl ?? meta.logoUrl ?? null) ?? null,
        price: perf.price,
        pct1d: perf.d1,
        pct1m: perf.m1,
        ytd: perf.ytd,
        mcapDisplay: "-",
        peDisplay: "-",
        earningsDisplay: "-",
      };
    }
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: meta.ticker,
      name: meta.name,
      kind: "stock",
      href: `/stock/${encodeURIComponent(meta.ticker)}`,
      logoUrl: meta.logoUrl,
      price: null,
      pct1d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  const b = await buildWatchlistStockBatch([ticker]);
  return enrichStockWithBatch(entry, b);
}

async function enrichCrypto(entry: WatchlistRow): Promise<WatchlistEnrichedItem> {
  const { symbol } = parseWatchlistStorageKey(entry.ticker);
  const sup = toSupportedCryptoTicker(symbol);

  if (sup && CRYPTO_SCREENER_ALL.some((c) => c.symbol === sup)) {
    const derivedMeta =
      CRYPTO_SCREENER_ALL.find((m) => m.symbol.toUpperCase() === sup.toUpperCase()) ??
      ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === sup.toUpperCase()) ??
      null;
    const [d, cryptoDer, row] = await Promise.all([
      CRYPTO_SCREENER_ALL.slice(0, 10).some((m) => m.symbol.toUpperCase() === sup.toUpperCase())
        ? getSimpleMarketDataCryptoTab()
        : getSimpleMarketDataCryptoScreenerPage2(),
      derivedMeta ? getSimpleCryptoDerivedForMetas([derivedMeta]) : Promise.resolve({} as SimpleCryptoDerived),
      getCryptoAsset(sup),
    ]);
    const datum = d.crypto[sup] ?? d.crypto[sup.toUpperCase()];
    const c =
      (derivedMeta ? cryptoDer[derivedMeta.symbol] : null) ?? cryptoDer[sup] ?? cryptoDer[sup.toUpperCase()];
    const displayMeta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === sup.toUpperCase());
    const name = displayMeta?.name ?? sup;
    const logoUrl = getCryptoLogoUrl(sup);
    const mcapRaw = row?.marketCap?.trim() ?? "";
    const mcapDisplay = mcapRaw && mcapRaw !== "-" ? mcapRaw : "—";
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: sup,
      name,
      kind: "crypto",
      href: `/crypto/${encodeURIComponent(sup)}`,
      logoUrl,
      price: datum?.price ?? null,
      pct1d: datum?.changePercent1D ?? null,
      pct1m: c?.changePercent1M ?? row?.changePercent1M ?? null,
      ytd: c?.changePercentYTD ?? row?.changePercentYTD ?? null,
      mcapDisplay,
      peDisplay: "—",
      earningsDisplay: "—",
    };
  }

  if (isSingleAssetMode()) {
    const meta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === (sup ?? "").toUpperCase());
    const name = meta?.name ?? symbol;
    const logoUrl = sup ? getCryptoLogoUrl(sup) : null;
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: sup ?? symbol,
      name,
      kind: "crypto",
      href: `/crypto/${encodeURIComponent(sup ?? symbol)}`,
      logoUrl,
      price: null,
      pct1d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  if (!sup) {
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol,
      name: symbol,
      kind: "crypto",
      href: `/crypto/${encodeURIComponent(symbol)}`,
      logoUrl: null,
      price: null,
      pct1d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  const meta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === sup.toUpperCase());
  const row = await getCryptoAsset(sup);
  const price = row?.price ?? null;
  const logoUrl = getCryptoLogoUrl(sup);
  const mcapRaw = row?.marketCap?.trim() ?? "";
  const mcapDisplay = mcapRaw && mcapRaw !== "-" ? (mcapRaw.startsWith("$") ? mcapRaw : `$${mcapRaw}`) : "-";

  return {
    entryId: entry.id,
    storageKey: entry.ticker,
    symbol: sup,
    name: row?.name ?? meta?.name ?? sup,
    kind: "crypto",
    href: `/crypto/${encodeURIComponent(sup)}`,
    logoUrl,
    price,
    pct1d: row?.changePercent1D ?? null,
    pct1m: row?.changePercent1M ?? null,
    ytd: row?.changePercentYTD ?? null,
    mcapDisplay,
    peDisplay: "-",
    earningsDisplay: "—",
  };
}

async function enrichIndex(entry: WatchlistRow): Promise<WatchlistEnrichedItem> {
  const { symbol } = parseWatchlistStorageKey(entry.ticker);
  const meta = getIndexDisplayMeta(symbol);
  const name = meta?.name ?? symbol;
  const displaySymbol = meta?.symbol ?? symbol;

  if (SCREENER_INDEX_SYMBOL_SET.has(displaySymbol)) {
    const [d, idxDer] = await Promise.all([getSimpleMarketDataIndicesTab(), getSimpleIndicesDerived()]);
    const datum = d.indices[displaySymbol] ?? { price: null, previousClose: null, changePercent1D: null };
    const i = idxDer[displaySymbol] ?? {
      changePercent7D: null,
      changePercent1M: null,
      changePercentYTD: null,
      last5DailyCloses: [],
    };
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: displaySymbol,
      name,
      kind: "index",
      href: `/index/${encodeURIComponent(displaySymbol)}`,
      logoUrl: null,
      price: datum.price,
      pct1d: datum.changePercent1D,
      pct1m: i.changePercent1M ?? null,
      ytd: i.changePercentYTD ?? null,
      mcapDisplay: "—",
      peDisplay: "—",
      earningsDisplay: "—",
    };
  }

  if (isSingleAssetMode()) {
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: displaySymbol,
      name,
      kind: "index",
      href: "/screener",
      logoUrl: null,
      price: null,
      pct1d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  return {
    entryId: entry.id,
    storageKey: entry.ticker,
    symbol: displaySymbol,
    name,
    kind: "index",
    href: "/screener",
    logoUrl: null,
    price: null,
    pct1d: null,
    pct1m: null,
    ytd: null,
    mcapDisplay: "-",
    peDisplay: "-",
    earningsDisplay: "-",
  };
}

async function buildWatchlistEnrichedGroupsUncached(items: WatchlistRow[]): Promise<{
  stocks: WatchlistEnrichedItem[];
  crypto: WatchlistEnrichedItem[];
  indices: WatchlistEnrichedItem[];
}> {
  const stockEntries: WatchlistRow[] = [];
  const otherEntries: WatchlistRow[] = [];
  for (const entry of items) {
    const { kind } = parseWatchlistStorageKey(entry.ticker);
    if (kind === "stock") stockEntries.push(entry);
    else otherEntries.push(entry);
  }

  const stockTickers = stockEntries.map((e) => parseWatchlistStorageKey(e.ticker).symbol);
  const stockBatch = isSingleAssetMode() ? null : await buildWatchlistStockBatch(stockTickers);

  const results = await runWithConcurrencyLimit(
    items,
    WATCHLIST_ENRICH_CONCURRENCY,
    async (entry) => {
      try {
        const { kind } = parseWatchlistStorageKey(entry.ticker);
        const row =
          kind === "crypto"
            ? await enrichCrypto(entry)
            : kind === "index"
              ? await enrichIndex(entry)
              : await enrichStock(entry, stockBatch);
        return { kind, row } as const;
      } catch {
        return null;
      }
    },
  );

  const stocks: WatchlistEnrichedItem[] = [];
  const crypto: WatchlistEnrichedItem[] = [];
  const indices: WatchlistEnrichedItem[] = [];

  for (const s of results) {
    if (!s) continue;
    if (s.kind === "stock") stocks.push(s.row);
    else if (s.kind === "crypto") crypto.push(s.row);
    else indices.push(s.row);
  }

  return { stocks, crypto, indices };
}

export async function buildWatchlistEnrichedGroups(items: WatchlistRow[]): Promise<{
  stocks: WatchlistEnrichedItem[];
  crypto: WatchlistEnrichedItem[];
  indices: WatchlistEnrichedItem[];
}> {
  const tickersKey = items
    .map((i) => i.ticker.trim().toUpperCase())
    .sort()
    .join(",");
  return withScreenerUsMarketCache("watchlist-enriched-groups-v3", () => buildWatchlistEnrichedGroupsUncached(items), [
    tickersKey,
  ]);
}
