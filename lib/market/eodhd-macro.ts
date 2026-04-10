import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

import { getEodhdApiKey } from "@/lib/env/server";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type MacroPoint = { time: string; value: number };

export type MacroSeriesKind = "percent" | "usd" | "index" | "number";

export type MacroSeriesId =
  | "inflation_consumer_prices_annual"
  | "consumer_price_index"
  | "unemployment_total_percent"
  | "real_interest_rate"
  | "gdp_current_usd"
  | "gdp_growth_annual"
  | "debt_percent_gdp"
  | "market_cap_domestic_companies_percent_gdp"
  | "internet_users_per_hundred";

export type MacroSeriesDef = {
  id: MacroSeriesId;
  title: string;
  kind: MacroSeriesKind;
};

/**
 * EODHD Macro Indicators API (https://eodhd.com/financial-apis/macroeconomics-data-and-macro-indicators-api)
 *
 * These series are the ones we currently request + render on `/macro` for the MVP.
 * If EODHD adds more indicators we want, extend this list (no UI changes needed).
 */
export const MACRO_SERIES: MacroSeriesDef[] = [
  { id: "inflation_consumer_prices_annual", title: "Inflation (CPI, YoY)", kind: "percent" },
  { id: "consumer_price_index", title: "Consumer Price Index (2010=100)", kind: "index" },
  { id: "unemployment_total_percent", title: "Unemployment Rate", kind: "percent" },
  { id: "real_interest_rate", title: "Real Interest Rate", kind: "percent" },
  { id: "gdp_current_usd", title: "GDP (Current USD)", kind: "usd" },
  { id: "gdp_growth_annual", title: "GDP Growth (Annual)", kind: "percent" },
  { id: "debt_percent_gdp", title: "Debt (% of GDP)", kind: "percent" },
  { id: "market_cap_domestic_companies_percent_gdp", title: "Market Cap (% of GDP)", kind: "percent" },
  { id: "internet_users_per_hundred", title: "Internet Users (per 100)", kind: "number" },
];

function clamp5y(from: Date): string {
  const d = new Date(from);
  d.setUTCFullYear(d.getUTCFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

async function fetchMacroIndicatorUncached(args: {
  country: string; // ISO-3166 alpha-3, e.g. "USA"
  indicator: MacroSeriesId;
}): Promise<MacroPoint[]> {
  const key = getEodhdApiKey();
  if (!key) return [];

  const params = new URLSearchParams({
    api_token: key,
    fmt: "json",
    indicator: args.indicator,
  });

  const url = `https://eodhd.com/api/macro-indicator/${encodeURIComponent(args.country)}?${params.toString()}`;
  try {
    if (!traceEodhdHttp("fetchMacroIndicatorUncached", { country: args.country, indicator: args.indicator }))
      return [];
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }); // 24h
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return [];

    const out: MacroPoint[] = [];
    for (const r of json) {
      if (!r || typeof r !== "object") continue;
      // EODHD Macro Indicators API returns keys like: Date, Value (plus CountryCode, Indicator, etc.)
      const row = r as { date?: unknown; value?: unknown; Date?: unknown; Value?: unknown };
      const rawDate = typeof row.date === "string" ? row.date : typeof row.Date === "string" ? row.Date : "";
      const time = rawDate ? rawDate.trim().slice(0, 10) : "";
      const value = num(row.value ?? row.Value);
      if (!time || value == null) continue;
      out.push({ time, value });
    }

    out.sort((a, b) => a.time.localeCompare(b.time));
    return out;
  } catch {
    return [];
  }
}

const fetchMacroIndicatorCached = unstable_cache(fetchMacroIndicatorUncached, ["eodhd-macro-indicator-v2"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

export async function fetchMacroSeries5y(country: string, def: MacroSeriesDef): Promise<MacroPoint[]> {
  const all = await fetchMacroIndicatorCached({ country, indicator: def.id });
  if (!all.length) return [];
  const minDate = clamp5y(new Date());
  return all.filter((p) => p.time >= minDate);
}

