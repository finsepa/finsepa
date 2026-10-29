import "server-only";

import { unstable_cache } from "next/cache";

import { ALL_CRYPTO_METAS } from "@/lib/market/crypto-meta";
import { INDEX_TOP10 } from "@/lib/market/indices-top10";
import { MARKET_SNAPSHOT_KEY, type MarketSnapshotKey } from "@/lib/market/market-snapshot-keys";
import { readMarketSnapshotRow } from "@/lib/market/market-snapshot-store";
import type { SimpleCryptoDerived, SimpleMarketData, SimpleMarketDatum } from "@/lib/market/simple-market-layer";
import { STOCK_DISPLAY_TZ } from "@/lib/market/chart-timestamp-format";
import { fetchLatestStockSessionMinuteBarFromDb } from "@/lib/market/stock-session-minute-bar-store";
import { getUsEquityMarketSession } from "@/lib/market/us-equity-market-session";
import { normalizeTop500SnapshotRows, type TopCompanyUniverseRow } from "@/lib/screener/top500-snapshot-normalize";
import { POPULAR_US_ETFS } from "@/lib/search/popular-us-etfs";
import type { SearchDirectoryPayload, SearchDirectoryRow } from "@/lib/search/search-directory-types";
import { SUPERINVESTOR_REGISTRY } from "@/lib/superinvestors/superinvestor-registry";
import { superinvestorSearchItem } from "@/lib/superinvestors/superinvestor-search";

const SEARCH_DIRECTORY_REVALIDATE_SEC = 60;
/** WS minute-store fallback is one small Supabase query per ticker — keep it bounded. */
const MINUTE_STORE_FALLBACK_MAX = 25;

function finite(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function positive(n: unknown): number | null {
  const v = finite(n);
  return v != null && v > 0 ? v : null;
}

/** Latest row regardless of segment/age — browsing must never trigger a rebuild. */
async function readLatest<T>(key: MarketSnapshotKey): Promise<T | null> {
  const row = await readMarketSnapshotRow(key);
  return (row?.data as T | undefined) ?? null;
}

function stockQuote(market: SimpleMarketData | null, ticker: string): SimpleMarketDatum | null {
  if (!market) return null;
  return (
    (market.stocks as Record<string, SimpleMarketDatum | undefined>)[ticker] ??
    market.extraScreenerStocks?.[ticker] ??
    null
  );
}

async function buildSearchDirectory(): Promise<SearchDirectoryPayload> {
  const [top500, stocks, etfs, cryptoTab, cryptoPage2, cryptoDerived, indices] = await Promise.all([
    readLatest<TopCompanyUniverseRow[]>(MARKET_SNAPSHOT_KEY.top500Market),
    readLatest<SimpleMarketData>(MARKET_SNAPSHOT_KEY.stocksAllPages),
    readLatest<SimpleMarketData>(MARKET_SNAPSHOT_KEY.etfsTab),
    readLatest<SimpleMarketData>(MARKET_SNAPSHOT_KEY.cryptoTab),
    readLatest<SimpleMarketData>(MARKET_SNAPSHOT_KEY.cryptoPage2),
    readLatest<SimpleCryptoDerived>(MARKET_SNAPSHOT_KEY.cryptoDerived),
    readLatest<SimpleMarketData>(MARKET_SNAPSHOT_KEY.indicesTab),
  ]);

  const rows: SearchDirectoryRow[] = [];
  const universe = normalizeTop500SnapshotRows(top500) ?? [];

  // Snapshot quotes can be missing for the WS-priority names; their live close is in the minute store,
  // and the universe's last EOD close is the prior session close while the US session is open.
  const liveCloseByTicker = new Map<string, number>();
  if (getUsEquityMarketSession(new Date()) !== "closed") {
    const sessionYmd = new Intl.DateTimeFormat("en-CA", { timeZone: STOCK_DISPLAY_TZ }).format(new Date());
    const missing = universe
      .map((u) => u.ticker.trim().toUpperCase())
      .filter((t) => positive(stockQuote(stocks, t)?.price) == null)
      .slice(0, MINUTE_STORE_FALLBACK_MAX);
    const latest = await Promise.all(missing.map((t) => fetchLatestStockSessionMinuteBarFromDb(t, sessionYmd)));
    missing.forEach((t, i) => {
      const close = latest[i]?.close;
      if (close != null && close > 0) liveCloseByTicker.set(t, close);
    });
  }

  for (const u of universe) {
    const t = u.ticker.trim().toUpperCase();
    const q = stockQuote(stocks, t);
    const liveClose = liveCloseByTicker.get(t);
    const priorClose = positive(u.adjustedClose);
    const fromMinuteStore =
      liveClose != null && priorClose != null
        ? { price: liveClose, changePct: ((liveClose - priorClose) / priorClose) * 100 }
        : null;
    rows.push({
      category: "stock",
      symbol: t,
      name: u.name,
      price: positive(q?.price) ?? fromMinuteStore?.price ?? priorClose,
      changePct: finite(q?.changePercent1D) ?? fromMinuteStore?.changePct ?? finite(u.refund1dP),
      marketCapUsd: positive(u.marketCapUsd),
    });
  }

  const etfNames = new Map(POPULAR_US_ETFS.map((e) => [e.ticker, e.name] as const));
  const etfTickers = [...new Set([...(etfs?.screenerStocksPage2Tickers ?? []), ...etfNames.keys()])];
  for (const raw of etfTickers) {
    const t = raw.trim().toUpperCase();
    const q = etfs?.extraScreenerStocks?.[t] ?? null;
    rows.push({
      category: "etf",
      symbol: t,
      name: etfNames.get(t) ?? t,
      price: positive(q?.price),
      changePct: finite(q?.changePercent1D),
      marketCapUsd: null,
    });
  }

  const cryptoQuotes = { ...(cryptoPage2?.crypto ?? {}), ...(cryptoTab?.crypto ?? {}) };
  const cryptoRows: SearchDirectoryRow[] = [];
  for (const meta of ALL_CRYPTO_METAS) {
    const sym = meta.symbol.toUpperCase();
    const q = cryptoQuotes[sym];
    if (!q) continue;
    cryptoRows.push({
      category: "crypto",
      symbol: sym,
      name: meta.name,
      price: positive(q.price),
      changePct: finite(q.changePercent1D),
      marketCapUsd: positive(cryptoDerived?.[sym]?.marketCapUsd),
    });
  }
  cryptoRows.sort((a, b) => (b.marketCapUsd ?? -1) - (a.marketCapUsd ?? -1));
  rows.push(...cryptoRows);

  for (const idx of INDEX_TOP10) {
    const q = indices?.indices?.[idx.symbol] ?? null;
    rows.push({
      category: "index",
      symbol: idx.symbol,
      name: idx.name,
      price: positive(q?.price),
      changePct: finite(q?.changePercent1D),
      marketCapUsd: null,
    });
  }

  return {
    builtAt: new Date().toISOString(),
    rows,
    superinvestors: SUPERINVESTOR_REGISTRY.map(superinvestorSearchItem),
  };
}

/**
 * Search browse directory (names + last price / 1D / market cap) for the global search dialog.
 * Supabase snapshot reads only, shared across users for 60s — zero EODHD calls.
 */
export const getSearchDirectory = unstable_cache(buildSearchDirectory, ["search-directory-v2-minute-store"], {
  revalidate: SEARCH_DIRECTORY_REVALIDATE_SEC,
});
