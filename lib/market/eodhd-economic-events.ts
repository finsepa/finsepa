import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_EARNINGS_CALENDAR } from "@/lib/data/cache-policy";
import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type EodhdRawEconomicEventRow = {
  type?: string;
  comparison?: string | null;
  period?: string | null;
  country?: string;
  date?: string;
  actual?: number | null;
  previous?: number | null;
  estimate?: number | null;
  change?: number | null;
  change_percentage?: number | null;
};

function numField(o: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function strField(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function parseRawRow(raw: unknown): EodhdRawEconomicEventRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    type: typeof o.type === "string" ? o.type : undefined,
    comparison: o.comparison === null || o.comparison === undefined ? null : String(o.comparison),
    period: o.period === null || o.period === undefined ? null : String(o.period),
    country: typeof o.country === "string" ? o.country : undefined,
    date: typeof o.date === "string" ? o.date : undefined,
    actual: numField(o, "actual", "Actual"),
    previous: numField(o, "previous", "Previous"),
    estimate: numField(o, "estimate", "Estimate"),
    change: numField(o, "change", "Change"),
    change_percentage: numField(o, "change_percentage", "changePercentage"),
  };
}

function extractRows(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const candidates = ["economic_events", "economicEvents", "events", "data"];
    for (const k of candidates) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return [];
}

/**
 * One HTTP page — use {@link fetchEodhdEconomicEventsAll} for full week ranges.
 * @see https://eodhd.com/financial-apis/economic-events-data-api
 */
async function fetchEodhdEconomicEventsPageUncached(
  fromYmd: string,
  toYmd: string,
  country: string,
  offset: number,
): Promise<EodhdRawEconomicEventRow[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    from: fromYmd,
    to: toYmd,
    country: country.trim().toUpperCase(),
    api_token: key,
    fmt: "json",
    limit: "1000",
    offset: String(Math.max(0, offset)),
  });
  const url = `https://eodhd.com/api/economic-events?${params.toString()}`;

  try {
    if (!traceEodhdHttp("fetchEodhdEconomicEventsPage", { from: fromYmd, to: toYmd, country, offset })) return [];
    const res = await fetch(url, { next: { revalidate: REVALIDATE_EARNINGS_CALENDAR } });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    const rows = extractRows(json);
    return rows.map(parseRawRow).filter(Boolean) as EodhdRawEconomicEventRow[];
  } catch {
    return [];
  }
}

const fetchEodhdEconomicEventsPageCached = unstable_cache(
  fetchEodhdEconomicEventsPageUncached,
  ["eodhd-economic-events-page-v1"],
  { revalidate: REVALIDATE_EARNINGS_CALENDAR },
);

/** Paginates until a short page or safety cap (week slices should stay bounded). */
export async function fetchEodhdEconomicEventsAll(fromYmd: string, toYmd: string, country: string): Promise<EodhdRawEconomicEventRow[]> {
  const out: EodhdRawEconomicEventRow[] = [];
  let offset = 0;
  const maxOffsets = 10;
  for (let i = 0; i < maxOffsets; i++) {
    const page = await fetchEodhdEconomicEventsPageCached(fromYmd, toYmd, country.trim().toUpperCase(), offset);
    out.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return out;
}
