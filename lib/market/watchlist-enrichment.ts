import "server-only";

import { WATCHLIST_CRYPTO_PREFIX, WATCHLIST_INDEX_PREFIX } from "@/lib/watchlist/constants";
import type { WatchlistEnrichedItem } from "@/lib/watchlist/enriched-types";
import type { WatchlistRow } from "@/lib/watchlist/types";
import { getCryptoAsset } from "@/lib/market/crypto-asset";
import { ALL_CRYPTO_METAS, fetchEodhdCryptoDailyBars, toSupportedCryptoTicker } from "@/lib/market/eodhd-crypto";
import { fetchEodhdFundamentalsHighlights } from "@/lib/market/eodhd-fundamentals";
import {
  getSimpleCryptoDerived,
  getSimpleIndicesDerived,
  getSimpleMarketData,
  getSimpleScreenerDerived,
} from "@/lib/market/simple-market-layer";
import type { EodhdDailyBar } from "@/lib/market/eodhd-eod";
import { getStockPerformance } from "@/lib/market/stock-performance";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { getCachedStockLogoUrl } from "@/lib/market/stock-logo-url";
import { eodFetchWindowUtc, formatMarketCapDisplay, formatPeDisplay } from "@/lib/screener/eod-derived-metrics";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { getIndexDisplayMeta } from "@/lib/market/indices-top10";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";
import { isSingleAssetMode, isSupportedAsset } from "@/lib/features/single-asset";
import { getNvdaPerformance, getNvdaHeaderMeta } from "@/lib/fixtures/nvda";

/** Caps parallel EODHD work when the watchlist has many symbols. */
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

function closeAtTradingOffset(bars: EodhdDailyBar[], tradingDaysBack: number): number | null {
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const idx = sorted.length - 1 - tradingDaysBack;
  if (idx < 0 || idx >= sorted.length) return null;
  const c = sorted[idx]?.close;
  return typeof c === "number" && Number.isFinite(c) ? c : null;
}

function pctChange(current: number | null, base: number | null): number | null {
  if (current == null || base == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) return null;
  return ((current - base) / base) * 100;
}

async function enrichStock(entry: WatchlistRow): Promise<WatchlistEnrichedItem> {
  const ticker = entry.ticker.trim().toUpperCase();
  const meta = getStockDetailMetaFromTicker(ticker);

  // Reduced universe: realtime + daily-derived %s + fundamentals for valuation rows.
  if (ticker === "NVDA" || ticker === "AAPL") {
    const [d, screener, f, logoResolved] = await Promise.all([
      getSimpleMarketData(),
      getSimpleScreenerDerived(),
      fetchEodhdFundamentalsHighlights(meta.ticker),
      getCachedStockLogoUrl(meta.ticker),
    ]);
    const datum = ticker === "NVDA" ? d.NVDA : d.AAPL;
    const s = ticker === "NVDA" ? screener.NVDA : screener.AAPL;
    const mcap = formatMarketCapDisplay(f?.marketCapUsd ?? null);
    const pe = formatPeDisplay(f?.peTrailing ?? null, f?.peForward ?? null);
    const earn = f?.nextEarningsDateDisplay?.trim();
    const logoUrl = logoResolved.trim() || meta.logoUrl?.trim() || null;
    return {
      entryId: entry.id,
      storageKey: entry.ticker,
      symbol: meta.ticker,
      name: meta.name,
      kind: "stock",
      href: `/stock/${encodeURIComponent(meta.ticker)}`,
      logoUrl,
      price: datum.price,
      pct1d: datum.changePercent1D,
      pct7d: s.changePercent7D,
      pct1m: s.changePercent1M,
      ytd: s.changePercentYTD,
      mcapDisplay: mcap,
      peDisplay: pe,
      earningsDisplay: earn && earn.length > 0 ? earn : "-",
    };
  }

  if (isSingleAssetMode()) {
    // Single-asset mode: avoid EODHD provider calls for watchlist enrichment.
    if (isSupportedAsset(ticker)) {
      const perf = getNvdaPerformance();
      const header = getNvdaHeaderMeta();
      return {
        entryId: entry.id,
        storageKey: entry.ticker,
        symbol: header.fullName ? perf.ticker : perf.ticker,
        name: meta.name,
        kind: "stock",
        href: `/stock/${encodeURIComponent(meta.ticker)}`,
        logoUrl: (header.logoUrl ?? meta.logoUrl ?? null) ?? null,
        price: perf.price,
        pct1d: perf.d1,
        pct7d: perf.d7,
        pct1m: perf.m1,
        ytd: perf.ytd,
        mcapDisplay: "-",
        peDisplay: "-",
        earningsDisplay: "-",
      };
    }

    // Unsupported ticker: keep row shape, but do not call providers.
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
      pct7d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  const [[perfSettled, fundSettled], logoResolved] = await Promise.all([
    Promise.allSettled([getStockPerformance(meta.ticker), fetchEodhdFundamentalsHighlights(meta.ticker)]),
    getCachedStockLogoUrl(meta.ticker),
  ]);

  const p = perfSettled.status === "fulfilled" ? perfSettled.value : null;
  const f = fundSettled.status === "fulfilled" ? fundSettled.value : null;
  const logoUrl = logoResolved.trim() || meta.logoUrl?.trim() || null;

  const mcap = formatMarketCapDisplay(f?.marketCapUsd ?? null);
  const pe = formatPeDisplay(f?.peTrailing ?? null, f?.peForward ?? null);
  const earn = f?.nextEarningsDateDisplay?.trim();

  return {
    entryId: entry.id,
    storageKey: entry.ticker,
    symbol: meta.ticker,
    name: meta.name,
    kind: "stock",
    href: `/stock/${encodeURIComponent(meta.ticker)}`,
    logoUrl,
    price: p?.price ?? null,
    pct1d: p?.d1 ?? null,
    pct7d: p?.d7 ?? null,
    pct1m: p?.m1 ?? null,
    ytd: p?.ytd ?? null,
    mcapDisplay: mcap,
    peDisplay: pe,
    earningsDisplay: earn && earn.length > 0 ? earn : "-",
  };
}

async function enrichCrypto(entry: WatchlistRow): Promise<WatchlistEnrichedItem> {
  const { symbol } = parseWatchlistStorageKey(entry.ticker);
  const sup = toSupportedCryptoTicker(symbol);

  // Reduced universe: realtime + daily-derived %s; market cap from crypto asset fundamentals path.
  if (sup === "BTC" || sup === "ETH") {
    const [d, cryptoDer, row] = await Promise.all([
      getSimpleMarketData(),
      getSimpleCryptoDerived(),
      getCryptoAsset(sup),
    ]);
    const datum = sup === "BTC" ? d.BTC : d.ETH;
    const c = sup === "BTC" ? cryptoDer.BTC : cryptoDer.ETH;
    const meta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === sup.toUpperCase());
    const name = meta?.name ?? sup;
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
      price: datum.price,
      pct1d: datum.changePercent1D,
      pct7d: c.changePercent7D,
      pct1m: c.changePercent1M,
      ytd: c.changePercentYTD,
      mcapDisplay,
      peDisplay: "—",
      earningsDisplay: "—",
    };
  }

  if (isSingleAssetMode()) {
    // Single-asset mode: do not hit crypto providers; show a placeholder row.
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
      pct7d: null,
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
      pct7d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  const meta = ALL_CRYPTO_METAS.find((m) => m.symbol.toUpperCase() === sup.toUpperCase());
  const row = await getCryptoAsset(sup);

  const window = eodFetchWindowUtc();
  const bars =
    meta != null ? (await fetchEodhdCryptoDailyBars(meta.eodhdSymbol, window.from, window.to)) ?? [] : [];
  const sorted = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const price = row?.price ?? null;
  const prev7 = closeAtTradingOffset(sorted, 7);
  const pct7d = pctChange(price, prev7);

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
    pct7d,
    pct1m: row?.changePercent1M ?? null,
    ytd: row?.changePercentYTD ?? null,
    mcapDisplay,
    peDisplay: "-",
    earningsDisplay: "-",
  };
}

async function enrichIndex(entry: WatchlistRow): Promise<WatchlistEnrichedItem> {
  const { symbol } = parseWatchlistStorageKey(entry.ticker);
  const meta = getIndexDisplayMeta(symbol);
  const name = meta?.name ?? symbol;
  const displaySymbol = meta?.symbol ?? symbol;

  // Reduced universe: index realtime + daily-derived %s.
  if (displaySymbol === "GSPC.INDX" || displaySymbol === "NDX.INDX") {
    const [d, idxDer] = await Promise.all([getSimpleMarketData(), getSimpleIndicesDerived()]);
    const datum = displaySymbol === "GSPC.INDX" ? d.SPX : d.NDX;
    const i = displaySymbol === "GSPC.INDX" ? idxDer.SPX : idxDer.NDX;
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
      pct7d: i.changePercent7D,
      pct1m: i.changePercent1M,
      ytd: i.changePercentYTD,
      mcapDisplay: "—",
      peDisplay: "—",
      earningsDisplay: "—",
    };
  }

  if (isSingleAssetMode()) {
    // Single-asset mode: avoid index providers.
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
      pct7d: null,
      pct1m: null,
      ytd: null,
      mcapDisplay: "-",
      peDisplay: "-",
      earningsDisplay: "-",
    };
  }

  const perfSettled = await Promise.allSettled([getStockPerformance(symbol)]);
  const p = perfSettled[0]?.status === "fulfilled" ? perfSettled[0].value : null;

  return {
    entryId: entry.id,
    storageKey: entry.ticker,
    symbol: displaySymbol,
    name,
    kind: "index",
    href: "/screener",
    logoUrl: null,
    price: p?.price ?? null,
    pct1d: p?.d1 ?? null,
    pct7d: p?.d7 ?? null,
    pct1m: p?.m1 ?? null,
    ytd: p?.ytd ?? null,
    mcapDisplay: "-",
    peDisplay: "-",
    earningsDisplay: "-",
  };
}

export async function buildWatchlistEnrichedGroups(items: WatchlistRow[]): Promise<{
  stocks: WatchlistEnrichedItem[];
  crypto: WatchlistEnrichedItem[];
  indices: WatchlistEnrichedItem[];
}> {
  const results = await runWithConcurrencyLimit(items, WATCHLIST_ENRICH_CONCURRENCY, async (entry) => {
    try {
      const { kind } = parseWatchlistStorageKey(entry.ticker);
      const row =
        kind === "crypto"
          ? await enrichCrypto(entry)
          : kind === "index"
            ? await enrichIndex(entry)
            : await enrichStock(entry);
      return { kind, row } as const;
    } catch {
      return null;
    }
  });

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
