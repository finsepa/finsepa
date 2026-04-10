import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC } from "@/lib/data/cache-policy";

import { traceEodhdHttp } from "@/lib/market/provider-trace";
import { getEodhdApiKey } from "@/lib/env/server";

export type EodhdScreenerRow = {
  code?: string;
  name?: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  market_capitalization?: number | string;
  adjusted_close?: number | string;
  refund_1d_p?: number | string;
  refund_5d_p?: number | string;
  /** When present on screener rows — 1-month total return % (signal field name may vary by package). */
  refund_1m_p?: number | string;
  refund_1M_p?: number | string;
  /** Year-to-date total return % when provided. */
  refund_ytd_p?: number | string;
  refund_YTD_p?: number | string;
  earnings_share?: number | string;
};

/** One row from the market-cap screener — includes snapshot fields used by the Companies table (no per-ticker fundamentals calls). */
export type EodhdTopUniverseRow = {
  ticker: string;
  name: string;
  marketCapUsd: number;
  /** Last EOD adjusted close from screener (stale vs live quote). */
  adjustedClose: number | null;
  /** Prior-session 1D % move from screener (used when live quote missing). */
  refund1dP: number | null;
  refund5dP: number | null;
  /** 1M % from screener snapshot when the provider includes it. */
  refund1mP: number | null;
  /** YTD % from screener snapshot when the provider includes it. */
  refundYtdP: number | null;
  /** Last 5 session adjusted closes (ascending), only when the API returns them on the row. */
  closes5d: number[] | null;
  /** Trailing EPS from screener — used with price for implied P/E when fundamentals JSON is not loaded. */
  earningsShare: number | null;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Prefer explicit signal fields; some accounts use alternate casing. */
function refund1mFromRaw(r: Record<string, unknown>): number | null {
  return num(r.refund_1m_p) ?? num(r.refund_1M_p) ?? null;
}

function refundYtdFromRaw(r: Record<string, unknown>): number | null {
  return num(r.refund_ytd_p) ?? num(r.refund_YTD_p) ?? null;
}

/**
 * If the screener ever returns five session closes on the row, use them for the mini chart (no extra API).
 */
function closes5dFromRaw(r: Record<string, unknown>): number[] | null {
  const keys = ["last_5_adj_close", "last_5_adjusted_close", "adj_close_last_5", "closes_5d"] as const;
  for (const key of keys) {
    const v = r[key];
    if (!Array.isArray(v)) continue;
    const closes: number[] = [];
    for (const x of v.slice(0, 5)) {
      const c = num(x);
      if (c == null || !(c > 0)) {
        closes.length = 0;
        break;
      }
      closes.push(c);
    }
    if (closes.length === 5) return closes;
  }
  return null;
}

async function fetchEodhdScreenerUncached(args: {
  limit: number;
  offset: number;
  exchangeFilter: "us" | "NYSE" | "NASDAQ";
}): Promise<EodhdTopUniverseRow[]> {
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
    if (!traceEodhdHttp("fetchEodhdScreenerUncached", { offset: args.offset, limit: args.limit })) return [];
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 12 } }); // 12h
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!json || typeof json !== "object") return [];
    const data = (json as { data?: unknown }).data;
    if (!Array.isArray(data)) return [];

    const out: EodhdTopUniverseRow[] = [];
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as EodhdScreenerRow;
      const rr = raw as Record<string, unknown>;
      const ticker = typeof r.code === "string" ? r.code.trim().toUpperCase() : "";
      if (!ticker) continue;
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const mc = num(r.market_capitalization);
      if (mc == null || mc <= 0) continue;
      out.push({
        ticker,
        name: name || ticker,
        marketCapUsd: mc,
        adjustedClose: num(r.adjusted_close),
        refund1dP: num(r.refund_1d_p),
        refund5dP: num(r.refund_5d_p),
        refund1mP: refund1mFromRaw(rr),
        refundYtdP: refundYtdFromRaw(rr),
        closes5d: closes5dFromRaw(rr),
        earningsShare: num(r.earnings_share),
      });
    }
    return out;
  } catch {
    return [];
  }
}

const fetchEodhdScreenerCached = unstable_cache(fetchEodhdScreenerUncached, ["eodhd-screener-v5-snapshot-perf"], {
  revalidate: REVALIDATE_STATIC,
});

export async function fetchEodhdTopByMarketCap(args: {
  limit: number;
  offset: number;
  exchangeFilter?: "us" | "NYSE" | "NASDAQ";
}): Promise<EodhdTopUniverseRow[]> {
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
    if (!traceEodhdHttp("fetchEodhdScreenerCandidates", { limit: args.limit })) return [];
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

