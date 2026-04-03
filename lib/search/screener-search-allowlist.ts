import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SEARCH } from "@/lib/data/cache-policy";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { CRYPTO_TOP10 } from "@/lib/market/eodhd-crypto";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { getCachedStockLogoUrl } from "@/lib/market/stock-logo-url";
import { SCREENER_INDICES_10 } from "@/lib/screener/screener-indices-universe";
import { TOP10_TICKERS } from "@/lib/screener/top10-config";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Extra substring hints beyond name/symbol (screener universe only). */
function extraMatches(item: SearchAssetItem, n: string): boolean {
  if (item.type === "stock") {
    if (item.symbol === "GOOGL" && (n.includes("google") || n.includes("alphabet"))) return true;
    if (item.symbol === "META" && (n.includes("facebook") || n.includes("fb"))) return true;
    if (item.symbol === "BRK-B" && (n.includes("berkshire") || n.includes("brk"))) return true;
    if (item.symbol === "TSM" && (n.includes("tsmc") || n.includes("taiwan semi"))) return true;
    return false;
  }
  if (item.type === "crypto") {
    if (item.symbol === "BTC" && (n.includes("bitcoin") || n === "btc")) return true;
    if (item.symbol === "ETH" && (n.includes("ethereum") || n === "eth")) return true;
    if (item.symbol === "DOGE" && (n.includes("doge") || n.includes("dogecoin"))) return true;
    return false;
  }
  if (item.type === "index") {
    const bySym: Record<string, readonly string[]> = {
      "GSPC.INDX": ["sp500", "spx", "s&p", "s and p", "sp 500"],
      "NDX.INDX": ["ndx", "nasdaq 100", "qqq"],
      "DJI.INDX": ["dow", "dji", "dow jones"],
      "IWM.US": ["russell", "iwm", "rut", "small cap"],
      "VIX.INDX": ["vix", "volatility", "fear index"],
      "BUK100P.INDX": ["ftse", "ftse 100", "uk100"],
      "GDAXI.INDX": ["dax", "germany"],
      "N225.INDX": ["nikkei", "japan", "n225"],
      "FCHI.INDX": ["cac", "france", "cac 40"],
      "HSI.INDX": ["hang seng", "hong kong", "hsi"],
    };
    const hints = bySym[item.symbol];
    if (hints?.some((h) => n.includes(h))) return true;
  }
  return false;
}

/** Matches query against name, symbol, and common aliases. */
function matchesAsset(item: SearchAssetItem, q: string): boolean {
  const n = norm(q);
  if (!n) return true;
  if (norm(item.name).includes(n) || norm(item.symbol).includes(n)) return true;
  if (extraMatches(item, n)) return true;
  return false;
}

function buildBaseItems(): SearchAssetItem[] {
  const stocks: SearchAssetItem[] = TOP10_TICKERS.map((t) => {
    const m = getStockDetailMetaFromTicker(t);
    return {
      id: `stock:${m.ticker}`,
      type: "stock",
      symbol: m.ticker,
      name: m.name,
      subtitle: "US",
      logoUrl: m.logoUrl,
      route: `/stock/${encodeURIComponent(m.ticker)}`,
      marketLabel: "US equity",
    };
  });

  const cryptos: SearchAssetItem[] = CRYPTO_TOP10.map((c) => ({
    id: `crypto:${c.symbol}`,
    type: "crypto",
    symbol: c.symbol,
    name: c.name,
    subtitle: c.eodhdSymbol,
    logoUrl: getCryptoLogoUrl(c.symbol),
    route: `/crypto/${encodeURIComponent(c.symbol)}`,
    marketLabel: "Crypto",
  }));

  const indices: SearchAssetItem[] = SCREENER_INDICES_10.map(({ name, symbol }) => ({
    id: `index:${symbol}`,
    type: "index",
    symbol,
    name,
    subtitle: symbol,
    logoUrl: null,
    route: `/index/${encodeURIComponent(symbol)}`,
    marketLabel: "Index",
  }));

  return [...stocks, ...cryptos, ...indices];
}

async function attachStockLogos(items: SearchAssetItem[]): Promise<SearchAssetItem[]> {
  const stockSyms = [...new Set(items.filter((i) => i.type === "stock").map((i) => i.symbol.trim().toUpperCase()))];
  if (stockSyms.length === 0) return items;
  const urls = await runWithConcurrencyLimit(stockSyms, 4, (sym) => getCachedStockLogoUrl(sym));
  const bySym = new Map(stockSyms.map((s, i) => [s, urls[i] ?? ""] as const));
  return items.map((item) => {
    if (item.type !== "stock") return item;
    const sym = item.symbol.trim().toUpperCase();
    const resolved = (bySym.get(sym) ?? "").trim();
    if (!resolved) return item;
    return { ...item, logoUrl: resolved };
  });
}

async function runScreenerSearchAllowlistUncached(qNorm: string): Promise<SearchAssetItem[]> {
  const base = buildBaseItems();
  const hits = base.filter((item) => matchesAsset(item, qNorm));
  hits.sort((a, b) => a.name.localeCompare(b.name));
  return attachStockLogos(hits);
}

const getCachedScreenerSearch = unstable_cache(
  async (qNorm: string) => runScreenerSearchAllowlistUncached(qNorm),
  ["screener-search-allowlist-v2"],
  { revalidate: REVALIDATE_SEARCH },
);

/**
 * Search limited to the screener universe: 10 US equities, 10 cryptos, 10 indices (30 total).
 */
export async function searchScreenerAllowlist(query: string): Promise<SearchAssetItem[]> {
  const raw = query.trim();
  if (raw.length < 1) return [];
  const qNorm = norm(raw);
  return getCachedScreenerSearch(qNorm);
}
