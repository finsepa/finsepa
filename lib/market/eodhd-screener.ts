import "server-only";

import { unstable_cache } from "next/cache";

import { getEodhdApiKey } from "@/lib/env/server";

export type EodhdScreenerRow = {
  code?: string;
  name?: string;
  exchange?: string;
  market_capitalization?: number | string;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchEodhdScreenerUncached(args: {
  limit: number;
  offset: number;
  exchangeFilter: "us" | "NYSE" | "NASDAQ";
}): Promise<Array<{ ticker: string; name: string; marketCapUsd: number }>> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const limit = Math.max(1, Math.min(100, Math.trunc(args.limit)));
  const offset = Math.max(0, Math.min(999, Math.trunc(args.offset)));

  const filters = JSON.stringify([["exchange", "=", args.exchangeFilter]]);
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    sort: "market_capitalization.desc",
    limit: String(limit),
    offset: String(offset),
    filters,
  });

  const url = `https://eodhd.com/api/screener?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 12 } }); // 12h
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== "object") return [];
    const data = (json as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];

    const out: Array<{ ticker: string; name: string; marketCapUsd: number }> = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as EodhdScreenerRow;
      const ticker = typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
      if (!ticker) continue;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const mc = num(r.market_capitalization);
      if (mc == null || mc <= 0) continue;
      out.push({ ticker, name: name || ticker, marketCapUsd: mc });
    }
    return out;
  } catch {
    return [];
  }
}

const fetchEodhdScreenerCached = unstable_cache(fetchEodhdScreenerUncached, ["eodhd-screener-v1"], {
  revalidate: 60 * 60 * 12,
});

export async function fetchEodhdTopByMarketCap(args: {
  limit: number;
  offset: number;
  exchangeFilter?: "us" | "NYSE" | "NASDAQ";
}): Promise<Array<{ ticker: string; name: string; marketCapUsd: number }>> {
  return fetchEodhdScreenerCached({
    limit: args.limit,
    offset: args.offset,
    exchangeFilter: args.exchangeFilter ?? "us",
  });
}

