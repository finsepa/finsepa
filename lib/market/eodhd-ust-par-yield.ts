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
async function fetchUstParYieldRatesRawUncached(): Promise<Array<{ date: string; tenor: string; rate: number }>> {
  const key = getEodhdApiKey();
  if (!key) return [];
  const apiToken: string = key;

  async function fetchWindow(from: string, to: string): Promise<Array<{ date: string; tenor: string; rate: number }>> {
    const params = new URLSearchParams({
      api_token: apiToken,
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

  const to = new Date().toISOString().slice(0, 10);
  const from = "1980-01-01";

  // Try a single wide request first. Some providers silently cap results; if we detect that,
  // fall back to chunked window fetching to ensure "All" has a long history.
  const wide = await fetchWindow(from, to);
  const wideFirst = wide.length ? wide.reduce((min, r) => (r.date < min ? r.date : min), wide[0]!.date) : null;
  const wideLast = wide.length ? wide.reduce((max, r) => (r.date > max ? r.date : max), wide[0]!.date) : null;
  const spanYears =
    wideFirst && wideLast
      ? (Date.parse(`${wideLast}T00:00:00Z`) - Date.parse(`${wideFirst}T00:00:00Z`)) /
        (365.25 * 86_400_000)
      : 0;
  /** Wide request often returns only recent rows — chunk when history is short or starts after 2000. */
  const needsChunked =
    wide.length === 0 || spanYears < 8 || (wideFirst != null && wideFirst > "2000-01-01");
  if (!needsChunked) return wide;

  const out: Array<{ date: string; tenor: string; rate: number }> = [];
  const startYear = 1980;
  const endYear = new Date().getUTCFullYear();
  const stepYears = 2;
  for (let y = startYear; y <= endYear; y += stepYears) {
    const wFrom = `${y.toString().padStart(4, "0")}-01-01`;
    const wToYear = Math.min(endYear, y + stepYears - 1);
    const wTo = `${wToYear.toString().padStart(4, "0")}-12-31`;
    const chunk = await fetchWindow(wFrom, y === endYear ? to : wTo);
    if (chunk.length) out.push(...chunk);
  }

  // De-dupe just in case windows overlap or provider repeats rows.
  const byKey = new Map<string, { date: string; tenor: string; rate: number }>();
  for (const r of out) byKey.set(`${r.date}|${r.tenor}`, r);
  return Array.from(byKey.values());
}

const fetchUstParYieldRatesRawCached = unstable_cache(fetchUstParYieldRatesRawUncached, ["eodhd-ust-yield-rates-raw-v3"], {
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
