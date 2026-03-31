import "server-only";

import { unstable_cache } from "next/cache";

import { getEodhdApiKey } from "@/lib/env/server";

export type EodhdScreenerRow = {
  code?: string;
  name?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
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

export async function fetchEodhdScreenerCandidates(args: {
  q: { sector?: string | null; industry?: string | null; code?: string | null };
  limit?: number;
}): Promise<Array<{ ticker: string; name: string; marketCapUsd: number; sector: string | null; industry: string | null }>> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const limit = Math.max(1, Math.min(100, Math.trunc(args.limit ?? 30)));

  const filters: Array<[string, string, string | number]> = [["exchange", "=", "us"]];
  const sector = typeof args.q.sector === "string" ? args.q.sector.trim() : "";
  const industry = typeof args.q.industry === "string" ? args.q.industry.trim() : "";
  const code = typeof args.q.code === "string" ? args.q.code.trim().toUpperCase() : "";

  if (code) filters.push(["code", "=", code]);
  if (industry) filters.push(["industry", "=", industry]);
  else if (sector) filters.push(["sector", "=", sector]);

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    sort: "market_capitalization.desc",
    limit: String(limit),
    offset: "0",
    filters: JSON.stringify(filters),
  });

  const url = `https://eodhd.com/api/screener?${params.toString()}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 } }); // 1h
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== "object") return [];
    const data = (json as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];

    const out: Array<{ ticker: string; name: string; marketCapUsd: number; sector: string | null; industry: string | null }> = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as EodhdScreenerRow;
      const ticker = typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
      if (!ticker) continue;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const mc = num(r.market_capitalization);
      if (mc == null || mc <= 0) continue;
      const sec = typeof r.sector === "string" && r.sector.trim() ? r.sector.trim() : null;
      const ind = typeof r.industry === "string" && r.industry.trim() ? r.industry.trim() : null;
      out.push({ ticker, name: name || ticker, marketCapUsd: mc, sector: sec, industry: ind });
    }
    return out;
  } catch {
    return [];
  }
}

