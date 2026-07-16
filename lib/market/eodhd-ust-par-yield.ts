import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

/** Same shape as {@link MacroPoint} — avoids import cycle with `eodhd-macro`. */
export type UstYieldPoint = { time: string; value: number };

/** 20Y CMT on the par yield curve resumes in EODHD around Oct 1993. */
const UST_20Y_YIELD_START_YEAR = 1993;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

/**
 * Long 10Y history via government-bond EOD (`US10Y.GBOND`).
 * Prefer this over `/ust/yield-rates` (defaults to current year without `filter[year]`).
 */
async function fetchUst10YGbondUncached(): Promise<UstYieldPoint[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    period: "d",
    order: "a",
    from: "1990-01-01",
  });
  const url = `https://eodhd.com/api/eod/US10Y.GBOND?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchUst10YGbondUncached", { symbol: "US10Y.GBOND" })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_STATIC_DAY } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return [];

    const byDay = new Map<string, UstYieldPoint>();
    for (const row of json) {
      if (!row || typeof row !== "object") continue;
      const o = row as { date?: unknown; close?: unknown; adjusted_close?: unknown };
      const date = typeof o.date === "string" ? o.date.trim().slice(0, 10) : "";
      const value = num(o.adjusted_close) ?? num(o.close);
      if (!date || value == null) continue;
      byDay.set(date, { time: date, value });
    }
    return Array.from(byDay.values()).sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}

function parseYieldRows(json: unknown): Array<{ date: string; tenor: string; rate: number }> {
  let data: unknown[] = [];
  if (Array.isArray(json)) data = json;
  else if (json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)) {
    data = (json as { data: unknown[] }).data;
  }
  const out: Array<{ date: string; tenor: string; rate: number }> = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const o = row as { date?: unknown; tenor?: unknown; rate?: unknown };
    const rawDate = typeof o.date === "string" ? o.date : "";
    const date = rawDate.trim().slice(0, 10);
    const tenor = typeof o.tenor === "string" ? o.tenor : "";
    const rate = num(o.rate);
    if (!date || !tenor || rate == null) continue;
    out.push({ date, tenor, rate });
  }
  return out;
}

/**
 * One year of par yield curve. Must use `filter[year]` — omitting it returns the current year only.
 */
async function fetchUstYieldYear20Y(apiToken: string, year: number): Promise<UstYieldPoint[]> {
  const params = new URLSearchParams({
    api_token: apiToken,
    fmt: "json",
    "filter[year]": String(year),
    "page[limit]": "5000",
  });
  const url = `https://eodhd.com/api/ust/yield-rates?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchUstYieldYear20Y", { year })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_STATIC_DAY } });
    if (!res.ok) return [];
    const rows = parseYieldRows(await res.json());
    const out: UstYieldPoint[] = [];
    for (const r of rows) {
      if (r.tenor !== "20Y") continue;
      out.push({ time: r.date, value: r.rate });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * `US20Y.GBOND` only starts ~2020. Pull 20Y CMT from `/ust/yield-rates` year-by-year
 * so Macro 20Y / All windows have real multi-decade history (gaps where Treasury omitted the tenor).
 */
async function fetchUst20YYieldRatesUncached(): Promise<UstYieldPoint[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const endYear = new Date().getUTCFullYear();
  const years: number[] = [];
  for (let y = UST_20Y_YIELD_START_YEAR; y <= endYear; y++) years.push(y);

  const chunks = await mapPool(years, 4, (year) => fetchUstYieldYear20Y(key, year));
  const byDay = new Map<string, UstYieldPoint>();
  for (const chunk of chunks) {
    for (const p of chunk) byDay.set(p.time, p);
  }
  return Array.from(byDay.values()).sort((a, b) => a.time.localeCompare(b.time));
}

const fetchUst10YGbondCached = unstable_cache(fetchUst10YGbondUncached, ["eodhd-ust-gbond-10y-v2"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

const fetchUst20YYieldRatesCached = unstable_cache(
  fetchUst20YYieldRatesUncached,
  ["eodhd-ust-yield-rates-20y-v1"],
  { revalidate: REVALIDATE_STATIC_DAY },
);

export async function fetchUstParYieldTenorCached(tenor: "10Y" | "20Y"): Promise<UstYieldPoint[]> {
  return tenor === "10Y" ? fetchUst10YGbondCached() : fetchUst20YYieldRatesCached();
}
