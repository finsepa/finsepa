import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_SEARCH } from "@/lib/data/cache-policy";

import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { fetchEodhdSearch, type EodhdSearchRow } from "@/lib/market/eodhd-search";
import { ALL_CRYPTO_METAS, toSupportedCryptoTicker } from "@/lib/market/eodhd-crypto";
import { INDEX_TOP10 } from "@/lib/market/indices-top10";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { getCachedStockLogoUrl } from "@/lib/market/stock-logo-url";
import { getTop500Universe } from "@/lib/screener/top500-companies";
import type { SearchAssetItem, SearchScope } from "@/lib/search/search-types";
import { runWithConcurrencyLimit } from "@/lib/utils/run-with-concurrency-limit";

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
  const exch = typeof row.Exchange === "string" ? row.Exchange.trim().toUpperCase() : "";

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

  if (!code.includes(".") && exch === "US") {
    if (isEtfOrFund(typ)) return null;
    return stockItemFromTicker(code.replace(/-/g, "."), name);
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

async function attachStockLogos(items: SearchAssetItem[]): Promise<SearchAssetItem[]> {
  const stockSyms = [...new Set(items.filter((i) => i.type === "stock").map((i) => i.symbol.trim().toUpperCase()))];
  if (stockSyms.length === 0) return items;
  const urls = await runWithConcurrencyLimit(stockSyms, 8, (sym) => getCachedStockLogoUrl(sym));
  const bySym = new Map(stockSyms.map((s, i) => [s, urls[i] ?? ""] as const));
  return items.map((item) => {
    if (item.type !== "stock") return item;
    const sym = item.symbol.trim().toUpperCase();
    const resolved = (bySym.get(sym) ?? "").trim();
    if (!resolved) return item;
    return { ...item, logoUrl: resolved };
  });
}

/** Core search (normalized query). Cached per (qNorm, scope) in {@link globalAssetSearch}. */
async function runGlobalAssetSearch(qNorm: string, scope: SearchScope): Promise<SearchAssetItem[]> {
  const n = qNorm;
  if (n.length < 1) return [];

  type Scored = { item: SearchAssetItem; score: number; marketCapUsd: number | null };
  const candidates: Scored[] = [];

  function scoreItem(name: string, symbol: string, type: SearchAssetItem["type"]): number {
    const nn = n;
    const sym = norm(symbol);
    const nm = norm(name);
    if (!nn) return 0;

    const symExact = sym === nn;
    const symPrefix = sym.startsWith(nn);
    const symHit = sym.includes(nn);
    const nameExact = nm === nn;
    const namePrefix = nm.startsWith(nn);
    const nameHit = nm.includes(nn);

    let s = 0;
    if (symExact) s = 1000;
    else if (symPrefix) s = 850;
    else if (symHit) s = 750;
    else if (nameExact) s = 700;
    else if (namePrefix) s = 650;
    else if (nameHit) s = 550;

    if (type === "index") s += 10;
    return s;
  }

  if (scope === "all" || scope === "indices") {
    for (const i of localIndexMatches(n)) {
      candidates.push({ item: i, score: scoreItem(i.name, i.symbol, i.type), marketCapUsd: null });
    }
  }
  if (scope === "all" || scope === "crypto") {
    for (const c of localCryptoMatches(n)) {
      candidates.push({ item: c, score: scoreItem(c.name, c.symbol, c.type), marketCapUsd: null });
    }
  }

  if (scope === "all" || scope === "stocks") {
    const universe = await getTop500Universe();
    const hits = universe.filter((u) => {
      const tL = u.ticker.trim().toLowerCase();
      const nL = u.name.trim().toLowerCase();
      return nL.includes(n) || tL.includes(n);
    });
    hits.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));
    const max = scope === "stocks" ? 80 : 40;
    for (const u of hits.slice(0, max)) {
      const t = u.ticker.trim().toUpperCase();
      const item: SearchAssetItem = {
        id: `stock:${t}`,
        type: "stock",
        symbol: t,
        name: u.name,
        subtitle: "US",
        logoUrl: null,
        route: `/stock/${encodeURIComponent(t)}`,
        marketLabel: "US equity",
      };
      candidates.push({ item, score: scoreItem(item.name, item.symbol, item.type), marketCapUsd: u.marketCapUsd });
    }
  }

  const remote = await fetchEodhdSearch(n, scope === "all" ? 60 : 50);
  for (const row of remote) {
    const item = parseEodhdRow(row);
    if (!item) continue;
    if (scope !== "all" && item.type !== scope) continue;
    candidates.push({ item, score: scoreItem(item.name, item.symbol, item.type), marketCapUsd: null });
  }

  const best = new Map<string, Scored>();
  for (const c of candidates) {
    const prev = best.get(c.item.id);
    if (!prev) best.set(c.item.id, c);
    else if (c.score > prev.score) best.set(c.item.id, c);
    else if (c.score === prev.score) {
      const mcA = c.marketCapUsd ?? -1;
      const mcB = prev.marketCapUsd ?? -1;
      if (mcA > mcB) best.set(c.item.id, c);
    }
  }

  const out = Array.from(best.values())
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const mcA = a.marketCapUsd ?? -1;
      const mcB = b.marketCapUsd ?? -1;
      if (mcB !== mcA) return mcB - mcA;
      return a.item.symbol.localeCompare(b.item.symbol);
    })
    .map((c) => c.item);

  const sliced = out.slice(0, scope === "stocks" ? 60 : 50);
  return attachStockLogos(sliced);
}

const getCachedGlobalAssetSearch = unstable_cache(
  async (qNorm: string, scope: SearchScope) => runGlobalAssetSearch(qNorm, scope),
  ["global-asset-search-v4"],
  { revalidate: REVALIDATE_SEARCH },
);

/**
 * Global asset search. Normalizes the query, dedupes remote + local sources, ranks by match quality.
 * Results for the same normalized query + scope are cached briefly (~45s) to avoid repeat EODHD work.
 */
export async function globalAssetSearch(query: string, scope: SearchScope): Promise<SearchAssetItem[]> {
  const raw = query.trim();
  if (raw.length < 1) return [];
  const qNorm = norm(raw);
  return getCachedGlobalAssetSearch(qNorm, scope);
}
