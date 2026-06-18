import "server-only";

import { unstable_cache } from "next/cache";

import { REVALIDATE_STATIC_DAY } from "@/lib/data/cache-policy";

import { getEodhdApiKey } from "@/lib/env/server";
import { fetchBlsCpiIndexSeriesCached } from "@/lib/market/bls-cpi-macro";
import { fetchShillerIeMacroSeriesCached, type ShillerIeMacroMetric } from "@/lib/market/shiller-ie-macro";
import { fetchFedFundsTargetSeriesCached } from "@/lib/market/eodhd-fed-funds-macro";
import { fetchUstParYieldTenorCached } from "@/lib/market/eodhd-ust-par-yield";
import { traceEodhdHttp } from "@/lib/market/provider-trace";

export type MacroPoint = { time: string; value: number };

export type MacroSeriesKind = "percent" | "usd" | "index" | "number";

/** Indicator codes accepted by EODHD `macro-indicator` for USA (see their macro docs). */
export type MacroIndicatorCode =
  | "inflation_consumer_prices_annual"
  | "consumer_price_index"
  | "unemployment_total_percent"
  | "real_interest_rate"
  | "gdp_current_usd"
  | "gdp_growth_annual"
  | "gdp_per_capita_usd"
  | "inflation_gdp_deflator_annual"
  | "population_growth_annual"
  | "debt_percent_gdp"
  | "market_cap_domestic_companies_percent_gdp"
  | "internet_users_per_hundred";

export type MacroSeriesDef =
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      provider: { type: "macro_indicator"; indicator: MacroIndicatorCode };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      provider: { type: "ust_par_yield"; tenor: "10Y" | "20Y" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      provider: { type: "shiller_ie"; metric: ShillerIeMacroMetric };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** FOMC `actual` → federal funds target (not World Bank annual policy rate). */
      provider: { type: "fed_funds_fomc" };
    }
  | {
      id: string;
      title: string;
      kind: MacroSeriesKind;
      /** Monthly BLS CPI-U rebased to 2010 = 100 (World Bank macro card scale). */
      provider: { type: "bls_cpi_index" };
    };

/**
 * Macro dashboard series — EODHD macro indicators + Treasury par yields (`ust/yield-rates`)
 * + Shiller `ie_data.xls` valuation metrics (long-history S&P 500 P/E and Shiller P/E).
 *
 * @see https://eodhd.com/financial-apis/macroeconomics-data-and-macro-indicators-api
 * @see https://eodhd.com/financial-apis/us-treasury-ust-interest-rates-api-beta
 * @see http://www.econ.yale.edu/~shiller/data.htm
 */
export const MACRO_SERIES: MacroSeriesDef[] = [
  { id: "shiller_pe", title: "Shiller P/E", kind: "number", provider: { type: "shiller_ie", metric: "shiller_tr_cape" } },
  { id: "sp500_earnings", title: "S&P 500 Earnings", kind: "number", provider: { type: "shiller_ie", metric: "sp500_earnings" } },
  { id: "sp500_trailing_pe", title: "S&P 500 P/E", kind: "number", provider: { type: "shiller_ie", metric: "sp500_pe" } },
  { id: "ust_par_yield_10y", title: "10-Year Treasury", kind: "percent", provider: { type: "ust_par_yield", tenor: "10Y" } },
  { id: "ust_par_yield_20y", title: "20-Year Treasury", kind: "percent", provider: { type: "ust_par_yield", tenor: "20Y" } },
  { id: "fed_interest_rate", title: "Fed funds rate", kind: "percent", provider: { type: "fed_funds_fomc" } },
  { id: "inflation_consumer_prices_annual", title: "Inflation", kind: "percent", provider: { type: "macro_indicator", indicator: "inflation_consumer_prices_annual" } },
  { id: "inflation_gdp_deflator_annual", title: "GDP deflator", kind: "percent", provider: { type: "macro_indicator", indicator: "inflation_gdp_deflator_annual" } },
  { id: "consumer_price_index", title: "Consumer Price Index", kind: "index", provider: { type: "bls_cpi_index" } },
  { id: "gdp_growth_annual", title: "GDP Growth", kind: "percent", provider: { type: "macro_indicator", indicator: "gdp_growth_annual" } },
  { id: "gdp_current_usd", title: "GDP", kind: "usd", provider: { type: "macro_indicator", indicator: "gdp_current_usd" } },
  { id: "gdp_per_capita_usd", title: "GDP per capita", kind: "usd", provider: { type: "macro_indicator", indicator: "gdp_per_capita_usd" } },
  { id: "unemployment_total_percent", title: "Unemployment Rate", kind: "percent", provider: { type: "macro_indicator", indicator: "unemployment_total_percent" } },
  { id: "real_interest_rate", title: "Real Interest Rate", kind: "percent", provider: { type: "macro_indicator", indicator: "real_interest_rate" } },
  { id: "debt_percent_gdp", title: "Debt", kind: "percent", provider: { type: "macro_indicator", indicator: "debt_percent_gdp" } },
  { id: "market_cap_domestic_companies_percent_gdp", title: "Market Cap", kind: "percent", provider: { type: "macro_indicator", indicator: "market_cap_domestic_companies_percent_gdp" } },
  { id: "population_growth_annual", title: "Population growth", kind: "percent", provider: { type: "macro_indicator", indicator: "population_growth_annual" } },
  { id: "internet_users_per_hundred", title: "Internet Users", kind: "number", provider: { type: "macro_indicator", indicator: "internet_users_per_hundred" } },
];

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
  indicator: MacroIndicatorCode;
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
    const res = await fetch(url, { next: { revalidate: REVALIDATE_STATIC_DAY } });
    if (!res.ok) return [];
    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return [];

    const out: MacroPoint[] = [];
    for (const r of json) {
      if (!r || typeof r !== "object") continue;
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

const fetchMacroIndicatorCached = unstable_cache(fetchMacroIndicatorUncached, ["eodhd-macro-indicator-v4"], {
  revalidate: REVALIDATE_STATIC_DAY,
});

/** Full history for the series (sorted ascending). Range windows are applied in the UI. */
export async function fetchMacroSeriesAll(country: string, def: MacroSeriesDef): Promise<MacroPoint[]> {
  if (def.provider.type === "ust_par_yield") {
    return fetchUstParYieldTenorCached(def.provider.tenor);
  }
  if (def.provider.type === "shiller_ie") {
    return fetchShillerIeMacroSeriesCached(def.provider.metric);
  }
  if (def.provider.type === "fed_funds_fomc") {
    return fetchFedFundsTargetSeriesCached();
  }
  if (def.provider.type === "bls_cpi_index") {
    return fetchBlsCpiIndexSeriesCached();
  }
  return fetchMacroIndicatorCached({ country, indicator: def.provider.indicator });
}
