import "server-only";

import { unstable_cache } from "next/cache";

import { getEodhdApiKey } from "@/lib/env/server";

export type EodhdExchangeSymbolRow = {
  Code?: string;
  Name?: string;
  Type?: string;
  Exchange?: string;
  Country?: string;
  Currency?: string;
  MarketCapitalization?: number | string;
  MarketCapitalisation?: number | string;
  MarketCap?: number | string;
  Website?: string;
  URL?: string;
  WebURL?: string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchEodhdExchangeSymbolListUncached(exchange = "US"): Promise<EodhdExchangeSymbolRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const ex = exchange.trim() || "US";
  const url = `https://eodhd.com/api/exchange-symbol-list/${encodeURIComponent(ex)}?api_token=${encodeURIComponent(
    key,
  )}&fmt=json`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 12 } }); // 12h
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((x) => x && typeof x === "object") as EodhdExchangeSymbolRow[];
  } catch {
    return [];
  }
}

const fetchEodhdExchangeSymbolListCached = unstable_cache(
  fetchEodhdExchangeSymbolListUncached,
  ["eodhd-exchange-symbol-list-v1"],
  { revalidate: 60 * 60 * 12 },
);

/**
 * Provider symbol universe for an exchange (cached cross-request).
 * This is used to build "top N by market cap" without hardcoding tickers.
 */
export async function fetchEodhdExchangeSymbolList(exchange = "US"): Promise<
  Array<{
    ticker: string;
    name: string;
    marketCapUsd: number | null;
    type: string | null;
  }>
> {
  const rows = await fetchEodhdExchangeSymbolListCached(exchange);

  const cleaned: Array<{ ticker: string; name: string; marketCapUsd: number | null; type: string | null }> = [];
  for (const r of rows) {
    const ticker = typeof r.Code === "string" ? r.Code.trim().toUpperCase() : "";
    if (!ticker) continue;
    const name = typeof r.Name === "string" ? r.Name.trim() : "";
    const marketCapUsd =
      num(r.MarketCapitalization) ?? num(r.MarketCapitalisation) ?? num(r.MarketCap) ?? null;
    const type = typeof r.Type === "string" ? r.Type.trim() : null;
    cleaned.push({ ticker, name: name || ticker, marketCapUsd, type });
  }

  return cleaned;
}

