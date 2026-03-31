import "server-only";

import { getStockDetailMetaFromTicker } from "@/lib/market/stock-detail-meta";
import { fetchEodhdSearch, type EodhdSearchRow } from "@/lib/market/eodhd-search";
import { ALL_CRYPTO_METAS, toSupportedCryptoTicker } from "@/lib/market/eodhd-crypto";
import { INDEX_TOP10 } from "@/lib/market/indices-top10";
import { getCryptoLogoUrl } from "@/lib/crypto/crypto-logo-url";
import { getTop500Universe } from "@/lib/screener/top500-companies";
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

async function top500StockMatches(q: string, max = 40): Promise<SearchAssetItem[]> {
  const universe = await getTop500Universe();
  const n = norm(q);
  if (!n) return [];

  const hits = universe.filter((u) => norm(u.name).includes(n) || norm(u.ticker).includes(n));
  hits.sort((a, b) => b.marketCapUsd - a.marketCapUsd || a.ticker.localeCompare(b.ticker));

  return hits.slice(0, max).map((u) => {
    const t = u.ticker.trim().toUpperCase();
    return {
      id: `stock:${t}`,
      type: "stock",
      symbol: t,
      name: u.name,
      subtitle: "US",
      logoUrl: null,
      route: `/stock/${encodeURIComponent(t)}`,
      marketLabel: "US equity",
    };
  });
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

  // EODHD Search can return US stocks as bare tickers with Exchange="US" (e.g. HOOD).
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

export async function globalAssetSearch(query: string, scope: SearchScope): Promise<SearchAssetItem[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const n = norm(q);

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

    // Small bias so major index queries don't get drowned by unrelated stocks.
    if (type === "index") s += 10;
    return s;
  }

  // Local indices & crypto (fast).
  if (scope === "all" || scope === "indices") {
    for (const i of localIndexMatches(q)) {
      candidates.push({ item: i, score: scoreItem(i.name, i.symbol, i.type), marketCapUsd: null });
    }
  }
  if (scope === "all" || scope === "crypto") {
    for (const c of localCryptoMatches(q)) {
      candidates.push({ item: c, score: scoreItem(c.name, c.symbol, c.type), marketCapUsd: null });
    }
  }

  // Stocks from our top-500 universe (consistent with Screener).
  if (scope === "all" || scope === "stocks") {
    const universe = await getTop500Universe();
    const hits = universe.filter((u) => norm(u.name).includes(n) || norm(u.ticker).includes(n));
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

  // Remote EODHD search (broad coverage across supported universe).
  const remote = await fetchEodhdSearch(q, scope === "all" ? 60 : 50);
  for (const row of remote) {
    const item = parseEodhdRow(row);
    if (!item) continue;
    if (scope !== "all" && item.type !== scope) continue;
    candidates.push({ item, score: scoreItem(item.name, item.symbol, item.type), marketCapUsd: null });
  }

  // De-dupe by id while keeping the best scoring version.
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

  return out.slice(0, scope === "stocks" ? 60 : 50);
}
