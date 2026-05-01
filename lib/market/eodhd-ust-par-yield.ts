import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

/** Same shape as {@link MacroPoint} — avoids import cycle with `eodhd-macro`. */
export type UstYieldPoint = { time: string; value: number };

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** One HTTP round-trip for the full par yield curve; filtered per tenor in-process. */
async function fetchUstParYieldRatesRawUncached(): Promise<
  Array<{ date: string; tenor: string; rate: number }>
> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const to = new Date().toISOString().slice(0, 10);
  const from = "1980-01-01";
  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    from,
    to,
  });
  const url = `https://eodhd.com/api/ust/yield-rates?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchUstParYieldRatesRawUncached", { from, to })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_STATIC_DAY } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
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
  } catch {
    return [];
  }
}

const fetchUstParYieldRatesRawCached = unstable_cache(fetchUstParYieldRatesRawUncached, ["eodhd-ust-yield-rates-raw-v1"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

function rowsToTenorSeries(rows: Array<{ date: string; tenor: string; rate: number }>, tenor: "10Y" | "20Y"): UstYieldPoint[] {
  const tmp: UstYieldPoint[] = [];
  for (const r of rows) {
    if (r.tenor !== tenor) continue;
    tmp.push({ time: r.date, value: r.rate });
  }
  tmp.sort((a, b) => a.time.localeCompare(b.time));
  const byDay = new Map<string, UstYieldPoint>();
  for (const p of tmp) {
    byDay.set(p.time, p);
  }
  return Array.from(byDay.values()).sort((a, b) => a.time.localeCompare(b.time));
}

export async function fetchUstParYieldTenorCached(tenor: "10Y" | "20Y"): Promise<UstYieldPoint[]> {
  const raw = await fetchUstParYieldRatesRawCached();
  return rowsToTenorSeries(raw, tenor);
}
