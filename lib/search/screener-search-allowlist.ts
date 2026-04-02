import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SEARCH } from "@/lib/data/cache-policy";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { getCachedStockLogoUrl } from "@/lib/market/stock-logo-url";
import type { SearchAssetItem } from "@/lib/search/search-types";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Matches query against name, symbol, and common aliases (e.g. SPX → S&P 500). */
function matchesAsset(item: SearchAssetItem, q: string): boolean {
  const n = norm(q);
  if (!n) return true;
  if (norm(item.name).includes(n) || norm(item.symbol).includes(n)) return true;
  if (item.type === "index" && item.symbol === "GSPC.INDX") {
    if (n.includes("sp500") || n === "spx" || n.includes("s&p") || n.includes("s and p")) return true;
  }
  if (item.type === "crypto" && item.symbol === "BTC" && (n.includes("bitcoin") || n === "btc")) return true;
  if (item.type === "crypto" && item.symbol === "ETH" && (n.includes("ethereum") || n === "eth")) return true;
  if (item.type === "stock" && item.symbol === "NVDA" && n.includes("nvidia")) return true;
  if (item.type === "stock" && item.symbol === "AAPL" && n.includes("apple")) return true;
  return false;
}

function buildBaseItems(): SearchAssetItem[] {
  const aapl = getStockDetailMetaFromTicker("AAPL");
  const nvda = getStockDetailMetaFromTicker("NVDA");
  return [
    {
      id: "stock:AAPL",
      type: "stock",
      symbol: aapl.ticker,
      name: aapl.name,
      subtitle: "US",
      logoUrl: aapl.logoUrl,
      route: `/stock/${encodeURIComponent(aapl.ticker)}`,
      marketLabel: "US equity",
    },
    {
      id: "stock:NVDA",
      type: "stock",
      symbol: nvda.ticker,
      name: nvda.name,
      subtitle: "US",
      logoUrl: nvda.logoUrl,
      route: `/stock/${encodeURIComponent(nvda.ticker)}`,
      marketLabel: "US equity",
    },
    {
      id: "crypto:BTC",
      type: "crypto",
      symbol: "BTC",
      name: "Bitcoin",
      subtitle: "BTC-USD",
      logoUrl: getCryptoLogoUrl("BTC"),
      route: `/crypto/${encodeURIComponent("BTC")}`,
      marketLabel: "Crypto",
    },
    {
      id: "crypto:ETH",
      type: "crypto",
      symbol: "ETH",
      name: "Ethereum",
      subtitle: "ETH-USD",
      logoUrl: getCryptoLogoUrl("ETH"),
      route: `/crypto/${encodeURIComponent("ETH")}`,
      marketLabel: "Crypto",
    },
    {
      id: "index:GSPC.INDX",
      type: "index",
      symbol: "GSPC.INDX",
      name: "S&P 500",
      subtitle: "GSPC.INDX",
      logoUrl: null,
      route: `/index/${encodeURIComponent("GSPC.INDX")}`,
      marketLabel: "Index",
    },
  ];
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
  ["screener-search-allowlist-v1"],
  { revalidate: REVALIDATE_SEARCH },
);

/**
 * Search limited to the current screener universe: AAPL, NVDA, BTC, ETH, S&P 500 (GSPC.INDX).
 * Extend {@link buildBaseItems} when adding assets.
 */
export async function searchScreenerAllowlist(query: string): Promise<SearchAssetItem[]> {
  const raw = query.trim();
  if (raw.length < 1) return [];
  const qNorm = norm(raw);
  return getCachedScreenerSearch(qNorm);
}
