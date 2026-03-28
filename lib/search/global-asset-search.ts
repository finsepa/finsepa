import "server-only";

import { TOP10_META } from "@/lib/screener/top10-config";
import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { fetchEodhdSearch, type EodhdSearchRow } from "@/lib/market/eodhd-search";
import { ALL_CRYPTO_METAS, toSupportedCryptoTicker } from "@/lib/market/eodhd-crypto";
import { INDEX_TOP10 } from "@/lib/market/indices-top10";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import type { SearchAssetItem, SearchScope } from "@/lib/search/search-types";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function matchesQuery(name: string, symbol: string, q: string): boolean {
  const n = norm(q);
  if (!n) return true;
  return norm(name).includes(n) || norm(symbol).includes(n);
}

function stockItemFromTicker(ticker: string, nameFallback?: string): SearchAssetItem {
  const t = ticker.trim().toUpperCase();
  const meta = getStockDetailMetaFromTicker(t);
  return {
    id: `stock:${t}`,
    type: "stock",
    symbol: meta.ticker,
    name: nameFallback ?? meta.name,
    subtitle: "US",
    logoUrl: meta.logoUrl,
    route: `/stock/${encodeURIComponent(meta.ticker)}`,
    marketLabel: "US equity",
  };
}

function indexItem(name: string, symbol: string): SearchAssetItem {
  return {
    id: `index:${symbol}`,
    type: "index",
    symbol,
    name,
    subtitle: symbol,
    logoUrl: null,
    route: `/index/${encodeURIComponent(symbol)}`,
    marketLabel: "Index",
  };
}

function cryptoItem(symbol: string, name: string): SearchAssetItem {
  const sym = symbol.trim().toUpperCase();
  return {
    id: `crypto:${sym}`,
    type: "crypto",
    symbol: sym,
    name,
    subtitle: `${sym}-USD`,
    logoUrl: getCryptoLogoUrl(sym),
    route: `/crypto/${encodeURIComponent(sym)}`,
    marketLabel: "Crypto",
  };
}

function isEtfOrFund(t: string | undefined): boolean {
  if (!t) return false;
  const u = t.toUpperCase();
  return u.includes("ETF") || u.includes("FUND") || u.includes("MUTUAL");
}

function parseEodhdRow(row: EodhdSearchRow): SearchAssetItem | null {
  const code = typeof row.Code === "string" ? row.Code.trim() : "";
  const name = typeof row.Name === "string" ? row.Name.trim() : "";
  const typ = typeof row.Type === "string" ? row.Type : "";

  if (!code || !name) return null;

  if (code.endsWith(".CC")) {
    const base = code.split("-")[0]?.trim().toUpperCase() ?? "";
    if (!base || !toSupportedCryptoTicker(base)) return null;
    return cryptoItem(base, name);
  }

  if (code.includes(".INDX") || typ.toUpperCase().includes("INDEX")) {
    return indexItem(name, code);
  }

  if (code.endsWith(".US")) {
    if (isEtfOrFund(typ)) return null;
    const ticker = code.replace(/\.US$/i, "").replace(/-/g, ".");
    return stockItemFromTicker(ticker, name);
  }

  const dot = code.lastIndexOf(".");
  if (dot > 0) {
    const maybeExch = code.slice(dot + 1).toUpperCase();
    if (["FOREX", "CC", "INDX"].includes(maybeExch)) return null;
  }

  return null;
}

function localCryptoMatches(q: string): SearchAssetItem[] {
  const out: SearchAssetItem[] = [];
  for (const m of ALL_CRYPTO_METAS) {
    if (matchesQuery(m.name, m.symbol, q)) {
      out.push(cryptoItem(m.symbol, m.name));
    }
  }
  return out;
}

function localIndexMatches(q: string): SearchAssetItem[] {
  const out: SearchAssetItem[] = [];
  for (const row of INDEX_TOP10) {
    if (matchesQuery(row.name, row.symbol, q)) {
      out.push(indexItem(row.name, row.symbol));
    }
  }
  return out;
}

export async function globalAssetSearch(query: string, scope: SearchScope): Promise<SearchAssetItem[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const seen = new Set<string>();
  const ordered: SearchAssetItem[] = [];

  const addFiltered = (item: SearchAssetItem | null) => {
    if (!item) return;
    if (scope !== "all" && item.type !== scope) return;
    if (seen.has(item.id)) return;
    seen.add(item.id);
    ordered.push(item);
  };

  if (scope === "all" || scope === "crypto") {
    for (const c of localCryptoMatches(q)) addFiltered(c);
  }
  if (scope === "all" || scope === "indices") {
    for (const i of localIndexMatches(q)) addFiltered(i);
  }

  const remote = await fetchEodhdSearch(q, scope === "all" ? 50 : 40);
  for (const row of remote) {
    addFiltered(parseEodhdRow(row));
  }

  if (scope === "stocks" || scope === "all") {
    for (const ticker of Object.keys(TOP10_META) as (keyof typeof TOP10_META)[]) {
      const meta = TOP10_META[ticker];
      if (matchesQuery(meta.name, ticker, q)) {
        addFiltered(stockItemFromTicker(ticker, meta.name));
      }
    }
  }

  return ordered;
}
